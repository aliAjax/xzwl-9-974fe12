import { create } from 'zustand';
import {
  AppState,
  AppActions,
  StepType,
  StepStatus,
  ViewType,
  STEP_ORDER,
  CreateOrderData,
  Order,
  Recipe,
  RecipeFormData,
} from '../types';
import { mockOrders } from '../data/mockOrders';
import { mockRecipes } from '../data/mockRecipes';
import { mockIngredients } from '../data/mockIngredients';
import { calculateAllWarnings } from '../utils/warningUtils';
import { getToday, addDaysToDate } from '../utils/dateUtils';

type AppStore = AppState & AppActions;

const initialWarnings = calculateAllWarnings(mockOrders, mockIngredients, mockRecipes);

const generateOrderId = (): string => `order-${Date.now().toString().slice(-6)}`;
const generateOrderNo = (): string => {
  const today = getToday();
  const yearMonth = today.slice(0, 7).replace('-', '');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `XY-${yearMonth}-${random}`;
};

const generateRecipeId = (): string => `recipe-${Date.now().toString().slice(-6)}`;

export const useAppStore = create<AppStore>((set, get) => ({
  orders: mockOrders,
  recipes: mockRecipes,
  ingredients: mockIngredients,
  warnings: initialWarnings,
  currentView: 'kanban',
  selectedDate: getToday(),
  selectedOrderId: null,
  showIngredientPanel: false,
  showWarningPanel: false,
  showCreateOrderModal: false,
  showRecipePanel: false,
  showRecipeModal: false,
  editingRecipeId: null,

  setCurrentView: (view: ViewType) => set({ currentView: view }),

  setSelectedDate: (date: string) => set({ selectedDate: date }),

  setSelectedOrderId: (id: string | null) => set({ selectedOrderId: id }),

  setShowIngredientPanel: (show: boolean) => set({ showIngredientPanel: show }),

  setShowWarningPanel: (show: boolean) => set({ showWarningPanel: show }),

  setShowCreateOrderModal: (show: boolean) => set({ showCreateOrderModal: show }),

  setShowRecipePanel: (show: boolean) => set({ showRecipePanel: show }),

  setShowRecipeModal: (show: boolean) => set({ showRecipeModal: show }),

  setEditingRecipeId: (id: string | null) => set({ editingRecipeId: id }),

  createRecipe: (data: RecipeFormData): Recipe => {
    const recipeId = generateRecipeId();

    const newRecipe: Recipe = {
      id: recipeId,
      name: data.name,
      description: data.description,
      ingredients: data.ingredients,
      dryingDays: data.dryingDays,
      cellaringDays: data.cellaringDays,
      craftNotes: data.craftNotes,
    };

    set((state) => ({
      recipes: [...state.recipes, newRecipe],
      showRecipeModal: false,
      editingRecipeId: null,
    }));

    return newRecipe;
  },

  updateRecipe: (id: string, data: RecipeFormData): Recipe => {
    const updatedRecipe: Recipe = {
      id,
      name: data.name,
      description: data.description,
      ingredients: data.ingredients,
      dryingDays: data.dryingDays,
      cellaringDays: data.cellaringDays,
      craftNotes: data.craftNotes,
    };

    set((state) => ({
      recipes: state.recipes.map((r) => (r.id === id ? updatedRecipe : r)),
      showRecipeModal: false,
      editingRecipeId: null,
    }));

    get().recalculateWarnings();

    return updatedRecipe;
  },

  deleteRecipe: (id: string) => {
    set((state) => ({
      recipes: state.recipes.filter((r) => r.id !== id),
    }));
    get().recalculateWarnings();
  },

  createOrder: (data: CreateOrderData): Order => {
    const orderId = generateOrderId();
    const orderNo = generateOrderNo();
    const today = getToday();

    const { getRecipeById } = get();
    const recipe = getRecipeById(data.recipeId);

    const stepDurations: Record<StepType, number> = {
      kneading: 2,
      shaping: 3,
      drying: recipe?.dryingDays || 15,
      cellaring: recipe?.cellaringDays || 30,
      packaging: 2,
    };

    const stepNames: Record<StepType, string> = {
      kneading: '揉料',
      shaping: '成型',
      drying: '阴干',
      cellaring: '窖藏',
      packaging: '包装',
    };

    const stepTypes: StepType[] = ['kneading', 'shaping', 'drying', 'cellaring', 'packaging'];
    const totalDuration = stepTypes.reduce((sum, type) => sum + stepDurations[type], 0);
    const startDate = addDaysToDate(data.deliveryDate, -totalDuration);

    let currentDate = startDate;

    const steps = stepTypes.map((stepType, index) => {
      const duration = stepDurations[stepType];
      const stepStartDate = currentDate;
      const stepEndDate = addDaysToDate(stepStartDate, duration);
      currentDate = stepEndDate;

      return {
        id: `${orderId}-step-${index}`,
        orderId,
        stepType,
        stepName: stepNames[stepType],
        status: 'not_started' as const,
        startDate: stepStartDate,
        endDate: stepEndDate,
        durationDays: duration,
        notes: '',
        assignee: '',
      };
    });

    const newOrder: Order = {
      id: orderId,
      orderNo,
      customerName: data.customerName,
      recipeId: data.recipeId,
      quantity: data.quantity,
      unit: data.unit,
      orderDate: today,
      deliveryDate: data.deliveryDate,
      status: 'pending',
      priority: data.priority,
      currentStepIndex: -1,
      steps,
    };

    set((state) => ({
      orders: [newOrder, ...state.orders],
      showCreateOrderModal: false,
    }));

    get().recalculateWarnings();

    return newOrder;
  },

  updateStepStatus: (orderId: string, stepId: string, status: StepStatus) => {
    set((state) => ({
      orders: state.orders.map((order) => {
        if (order.id !== orderId) return order;
        return {
          ...order,
          steps: order.steps.map((step) => {
            if (step.id !== stepId) return step;
            return { ...step, status };
          }),
        };
      }),
    }));
    get().recalculateWarnings();
  },

  moveOrderToStep: (orderId: string, targetStepType: StepType) => {
    const { orders, recipes } = get();
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    const recipe = recipes.find((r) => r.id === order.recipeId);
    if (!recipe) return;

    const targetStepIndex = STEP_ORDER.indexOf(targetStepType);
    if (targetStepIndex < 0) return;

    const today = getToday();

    set((state) => ({
      orders: state.orders.map((o) => {
        if (o.id !== orderId) return o;

        let runningDate = today;
        const updatedSteps = o.steps.map((step) => {
          const stepIndex = STEP_ORDER.indexOf(step.stepType);
          let newStatus: StepStatus = step.status;
          let newStartDate = step.startDate;
          let newEndDate = step.endDate;

          if (stepIndex < targetStepIndex) {
            newStatus = 'completed';
          } else if (stepIndex === targetStepIndex) {
            newStatus = 'in_progress';
            newStartDate = today;
            newEndDate = addDaysToDate(today, step.durationDays);
          } else {
            newStatus = 'not_started';
            newStartDate = runningDate;
            newEndDate = addDaysToDate(runningDate, step.durationDays);
          }

          runningDate = newEndDate;

          return {
            ...step,
            status: newStatus,
            startDate: newStartDate,
            endDate: newEndDate,
            assignee: newStatus === 'in_progress' ? '李师傅' : '',
          };
        });

        const newStatus =
          targetStepIndex >= STEP_ORDER.length
            ? 'completed'
            : targetStepIndex >= 0
              ? 'in_production'
              : 'pending';

        return {
          ...o,
          steps: updatedSteps,
          currentStepIndex: targetStepIndex,
          status: newStatus,
        };
      }),
    }));

    get().recalculateWarnings();
  },

  completeOrder: (orderId: string) => {
    set((state) => ({
      orders: state.orders.map((order) => {
        if (order.id !== orderId) return order;

        return {
          ...order,
          status: 'completed',
          currentStepIndex: STEP_ORDER.length,
          steps: order.steps.map((step) => ({
            ...step,
            status: 'completed',
            assignee: '',
          })),
        };
      }),
    }));
    get().recalculateWarnings();
  },

  resolveWarning: (warningId: string) => {
    set((state) => ({
      warnings: state.warnings.map((w) =>
        w.id === warningId ? { ...w, isResolved: true } : w
      ),
    }));
  },

  recalculateWarnings: () => {
    const { orders, ingredients, recipes } = get();
    const existingResolved = get().warnings.filter((w) => w.isResolved);
    const newWarnings = calculateAllWarnings(orders, ingredients, recipes);
    set({ warnings: [...existingResolved, ...newWarnings] });
  },

  getOrderWarnings: (orderId: string) => {
    return get().warnings.filter((w) => w.relatedId === orderId && !w.isResolved);
  },

  getRecipeById: (recipeId: string) => {
    return get().recipes.find((r) => r.id === recipeId);
  },

  getOrdersByStep: (stepType: StepType) => {
    return get().orders.filter((order) => {
      if (order.status === 'completed') return false;
      if (order.status === 'pending') return stepType === STEP_ORDER[0];
      const currentStep = order.steps.find((s) => s.status === 'in_progress');
      return currentStep?.stepType === stepType;
    });
  },

  getOrdersByDate: (date: string) => {
    return get().orders.filter((order) => {
      return order.steps.some(
        (step) =>
          step.status === 'in_progress' &&
          step.startDate <= date &&
          step.endDate >= date
      );
    });
  },
}));
