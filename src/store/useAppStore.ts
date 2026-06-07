import { create } from 'zustand';
import {
  Order,
  Recipe,
  IngredientBatch,
  Warning,
  AppState,
  AppActions,
  StepType,
  StepStatus,
  ViewType,
  STEP_ORDER,
} from '../types';
import { mockOrders } from '../data/mockOrders';
import { mockRecipes } from '../data/mockRecipes';
import { mockIngredients } from '../data/mockIngredients';
import { calculateAllWarnings } from '../utils/warningUtils';
import { getToday, addDaysToDate } from '../utils/dateUtils';

type AppStore = AppState & AppActions;

const initialWarnings = calculateAllWarnings(mockOrders, mockIngredients, mockRecipes);

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

  setCurrentView: (view: ViewType) => set({ currentView: view }),

  setSelectedDate: (date: string) => set({ selectedDate: date }),

  setSelectedOrderId: (id: string | null) => set({ selectedOrderId: id }),

  setShowIngredientPanel: (show: boolean) => set({ showIngredientPanel: show }),

  setShowWarningPanel: (show: boolean) => set({ showWarningPanel: show }),

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
        const updatedSteps = o.steps.map((step, index) => {
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
