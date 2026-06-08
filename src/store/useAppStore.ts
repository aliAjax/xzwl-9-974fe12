import { create } from 'zustand';
import {
  type AppState,
  type AppActions,
  type StepType,
  type StepStatus,
  type ViewType,
  STEP_ORDER,
  type CreateOrderData,
  type Order,
  type Recipe,
  type RecipeFormData,
  type StepUpdateData,
  type PurchaseDecision,
  type PurchaseStatus,
} from '../types';
import { mockCraftsmen } from '../data/mockCraftsmen';
import { calculateAllWarnings, mergeWarningsWithResolvedState } from '../utils/warningUtils';
import {
  calculatePurchaseSuggestions,
  mergeSuggestionsWithDecisions,
  groupBySupplier,
  createPurchaseDecision,
  cleanObsoleteDecisions,
} from '../utils/purchaseUtils';
import { getToday, addDaysToDate } from '../utils/dateUtils';
import { applyStepAdjustment, validateStepAdjustment } from '../utils/scheduleUtils';
import {
  loadFromStorage,
  saveToStorage,
  getDefaultData,
  clearStorage,
} from '../utils/storage';
import {
  generateSandboxSchedule,
  applySandboxResult,
} from '../utils/sandboxUtils';
import {
  selectOrderWarnings,
  selectRecipeById,
  selectOrdersByStep,
  selectOrdersByDate,
  selectCraftsmanTasks,
  selectCraftsmanWorkload,
  selectAllCraftsmenWorkload,
  selectSortedCraftsmenForAssignment,
  selectOrderMaterialGap,
  selectCustomerOrderSummaries,
  selectCustomerOrderSummary,
} from './selectors';

type AppStore = AppState & AppActions;

const getInitialState = (): AppState => {
  const savedData = loadFromStorage();
  const defaultData = getDefaultData();

  const data = savedData || defaultData;
  const purchaseSuggestions = calculatePurchaseSuggestions(
    data.orders,
    data.ingredients,
    data.recipes
  );

  const purchaseDecisions = (data as unknown as { purchaseDecisions?: PurchaseDecision[] }).purchaseDecisions || [];
  const cleanedDecisions = cleanObsoleteDecisions(
    purchaseDecisions,
    purchaseSuggestions.map((s) => s.ingredientId)
  );
  const purchasePlanItems = mergeSuggestionsWithDecisions(purchaseSuggestions, cleanedDecisions);
  const supplierPurchaseGroups = groupBySupplier(purchasePlanItems);

  return {
    orders: data.orders,
    recipes: data.recipes,
    ingredients: data.ingredients,
    craftsmen: mockCraftsmen,
    warnings: data.warnings,
    currentView: data.viewPreferences.currentView,
    selectedDate: data.viewPreferences.selectedDate,
    selectedOrderId: null,
    showIngredientPanel: data.viewPreferences.showIngredientPanel,
    showWarningPanel: data.viewPreferences.showWarningPanel,
    showCreateOrderModal: false,
    showRecipePanel: data.viewPreferences.showRecipePanel,
    showRecipeModal: false,
    showSchedulePanel: data.viewPreferences.showSchedulePanel,
    showPrintPreview: false,
    showPurchaseSuggestion: data.viewPreferences.showPurchaseSuggestion,
    showScheduleAdjustModal: false,
    scheduleAdjustOrderId: null,
    printOrderId: null,
    editingRecipeId: null,
    copyingRecipeId: null,
    purchaseSuggestions,
    purchaseDecisions: cleanedDecisions,
    purchasePlanItems,
    supplierPurchaseGroups,
    deliveryBoard: data.viewPreferences.deliveryBoard,
    showIngredientGapModal: false,
    ingredientGapOrderId: null,
    showSandboxModal: false,
    sandboxSelectedOrderIds: [],
    sandboxPriorityStrategy: 'priority_first',
    sandboxResult: null,
  };
};

const initialState = getInitialState();

const persistState = (state: AppState) => {
  saveToStorage({
    orders: state.orders,
    recipes: state.recipes,
    ingredients: state.ingredients,
    warnings: state.warnings,
    purchaseDecisions: state.purchaseDecisions,
    viewPreferences: {
      currentView: state.currentView,
      selectedDate: state.selectedDate,
      showIngredientPanel: state.showIngredientPanel,
      showWarningPanel: state.showWarningPanel,
      showRecipePanel: state.showRecipePanel,
      showSchedulePanel: state.showSchedulePanel,
      showPurchaseSuggestion: state.showPurchaseSuggestion,
      deliveryBoard: state.deliveryBoard,
    },
  });
};

const recalculateDerivedData = (state: AppState): Partial<AppState> => {
  const { orders, ingredients, recipes, purchaseDecisions } = state;

  const newWarnings = calculateAllWarnings(orders, ingredients, recipes);
  const existingResolved = state.warnings.filter((w) => w.isResolved);
  const mergedWarnings = mergeWarningsWithResolvedState(newWarnings, existingResolved);

  const newPurchaseSuggestions = calculatePurchaseSuggestions(orders, ingredients, recipes);
  const cleanedDecisions = cleanObsoleteDecisions(
    purchaseDecisions,
    newPurchaseSuggestions.map((s) => s.ingredientId)
  );
  const newPurchasePlanItems = mergeSuggestionsWithDecisions(newPurchaseSuggestions, cleanedDecisions);
  const newSupplierGroups = groupBySupplier(newPurchasePlanItems);

  return {
    warnings: mergedWarnings,
    purchaseSuggestions: newPurchaseSuggestions,
    purchaseDecisions: cleanedDecisions,
    purchasePlanItems: newPurchasePlanItems,
    supplierPurchaseGroups: newSupplierGroups,
  };
};

const recalculatePurchasePlan = (state: AppState): Partial<AppState> => {
  const { purchaseSuggestions, purchaseDecisions } = state;
  const planItems = mergeSuggestionsWithDecisions(purchaseSuggestions, purchaseDecisions);
  const supplierGroups = groupBySupplier(planItems);
  return {
    purchasePlanItems: planItems,
    supplierPurchaseGroups: supplierGroups,
  };
};

const createCommitHelpers = (
  set: (
    partial: AppStore | Partial<AppStore> | ((state: AppStore) => AppStore | Partial<AppStore>),
    replace?: false
  ) => void,
  get: () => AppStore
) => {
  const commitStateChange = (stateUpdate: Partial<AppState> | ((state: AppState) => Partial<AppState>)) => {
    if (typeof stateUpdate === 'function') {
      set((state) => stateUpdate(state));
    } else {
      set(stateUpdate);
    }
    set(recalculateDerivedData(get()));
    persistState(get());
  };

  const commitPurchaseChange = (stateUpdate: Partial<AppState>) => {
    set(stateUpdate);
    set(recalculatePurchasePlan(get()));
    persistState(get());
  };

  const commitViewPreference = (stateUpdate: Partial<AppState> | ((state: AppState) => Partial<AppState>)) => {
    if (typeof stateUpdate === 'function') {
      set((state) => stateUpdate(state));
    } else {
      set(stateUpdate);
    }
    persistState(get());
  };

  return {
    commitStateChange,
    commitPurchaseChange,
    commitViewPreference,
  };
};

const generateOrderId = (): string => `order-${Date.now().toString().slice(-6)}`;
const generateOrderNo = (): string => {
  const today = getToday();
  const yearMonth = today.slice(0, 7).replace('-', '');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `XY-${yearMonth}-${random}`;
};

const generateRecipeId = (): string => `recipe-${Date.now().toString().slice(-6)}`;

export const useAppStore = create<AppStore>((set, get) => {
  const { commitStateChange, commitPurchaseChange, commitViewPreference } = createCommitHelpers(set, get);

  return {
    ...initialState,

    setCurrentView: (view: ViewType) => commitViewPreference({ currentView: view }),

    setSelectedDate: (date: string) => commitViewPreference({ selectedDate: date }),

    setSelectedOrderId: (id: string | null) => set({ selectedOrderId: id }),

    setShowIngredientPanel: (show: boolean) => commitViewPreference({ showIngredientPanel: show }),

    setShowWarningPanel: (show: boolean) => commitViewPreference({ showWarningPanel: show }),

    setShowCreateOrderModal: (show: boolean) => set({ showCreateOrderModal: show }),

    setShowRecipePanel: (show: boolean) => commitViewPreference({ showRecipePanel: show }),

    setShowRecipeModal: (show: boolean) => set({ showRecipeModal: show }),

    setShowSchedulePanel: (show: boolean) => commitViewPreference({ showSchedulePanel: show }),

    setShowPrintPreview: (show: boolean) => set({ showPrintPreview: show }),

    setShowPurchaseSuggestion: (show: boolean) => commitViewPreference({ showPurchaseSuggestion: show }),

    setPrintOrderId: (id: string | null) => set({ printOrderId: id }),

    setEditingRecipeId: (id: string | null) => set({ editingRecipeId: id }),

    setCopyingRecipeId: (id: string | null) => set({ copyingRecipeId: id }),

    setShowScheduleAdjustModal: (show: boolean) => set({ showScheduleAdjustModal: show }),

    setScheduleAdjustOrderId: (id: string | null) => set({ scheduleAdjustOrderId: id }),

    setShowCompletedOrders: (show: boolean) =>
      commitViewPreference((state) => ({
        deliveryBoard: { ...state.deliveryBoard, showCompletedOrders: show },
      })),

    setSortBy: (sortBy: AppState['deliveryBoard']['sortBy']) =>
      commitViewPreference((state) => ({
        deliveryBoard: { ...state.deliveryBoard, sortBy },
      })),

    setFilterRiskLevel: (level: AppState['deliveryBoard']['filterRiskLevel']) =>
      commitViewPreference((state) => ({
        deliveryBoard: { ...state.deliveryBoard, filterRiskLevel: level },
      })),

    toggleCustomerExpand: (customerName: string) =>
      commitViewPreference((state) => {
        const expanded = state.deliveryBoard.expandedCustomers;
        const isExpanded = expanded.includes(customerName);
        return {
          deliveryBoard: {
            ...state.deliveryBoard,
            expandedCustomers: isExpanded
              ? expanded.filter((c) => c !== customerName)
              : [...expanded, customerName],
          },
        };
      }),

    setShowThisWeekOnly: (show: boolean) =>
      commitViewPreference((state) => ({
        deliveryBoard: { ...state.deliveryBoard, showThisWeekOnly: show },
      })),

    setShowIngredientGapModal: (show: boolean) => set({ showIngredientGapModal: show }),

    setIngredientGapOrderId: (id: string | null) => set({ ingredientGapOrderId: id }),

    getOrderMaterialGap: (orderId: string) => selectOrderMaterialGap(get(), orderId),

    getCustomerOrderSummaries: () => selectCustomerOrderSummaries(get()),

    getCustomerOrderSummary: (customerName: string) => selectCustomerOrderSummary(get(), customerName),

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

      commitStateChange({
        recipes: [...get().recipes, newRecipe],
        showRecipeModal: false,
        editingRecipeId: null,
      });

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

      commitStateChange({
        recipes: get().recipes.map((r) => (r.id === id ? updatedRecipe : r)),
        showRecipeModal: false,
        editingRecipeId: null,
      });

      return updatedRecipe;
    },

    deleteRecipe: (id: string) => {
      commitStateChange({
        recipes: get().recipes.filter((r) => r.id !== id),
      });
    },

    createOrder: (data: CreateOrderData): Order => {
      const orderId = generateOrderId();
      const orderNo = generateOrderNo();
      const today = getToday();

      const recipe = get().getRecipeById(data.recipeId);

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

      commitStateChange({
        orders: [newOrder, ...get().orders],
        showCreateOrderModal: false,
      });

      return newOrder;
    },

    updateStepStatus: (orderId: string, stepId: string, status: StepStatus) => {
      commitStateChange({
        orders: get().orders.map((order) => {
          if (order.id !== orderId) return order;
          return {
            ...order,
            steps: order.steps.map((step) => {
              if (step.id !== stepId) return step;
              return { ...step, status };
            }),
          };
        }),
      });
    },

    assignStepToCraftsman: (orderId: string, stepId: string, craftsmanName: string) => {
      commitViewPreference({
        orders: get().orders.map((order) => {
          if (order.id !== orderId) return order;
          return {
            ...order,
            steps: order.steps.map((step) => {
              if (step.id !== stepId) return step;
              return { ...step, assignee: craftsmanName };
            }),
          };
        }),
      });
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

      const updatedOrders = orders.map((o) => {
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

        const newStatus: Order['status'] =
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
      });

      commitStateChange({ orders: updatedOrders });
    },

    updateProductionStep: (orderId: string, stepId: string, updates: StepUpdateData) => {
      const { orders } = get();
      const order = orders.find((o) => o.id === orderId);
      if (!order) return;

      const validation = validateStepAdjustment(order, stepId, updates);
      if (!validation.valid) return;

      const updatedSteps = applyStepAdjustment(order, stepId, updates);

      commitStateChange({
        orders: orders.map((o) => {
          if (o.id !== orderId) return o;
          return { ...o, steps: updatedSteps };
        }),
      });
    },

    completeOrder: (orderId: string) => {
      commitStateChange({
        orders: get().orders.map((order) => {
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
      });
    },

    resolveWarning: (warningId: string) => {
      commitViewPreference({
        warnings: get().warnings.map((w) =>
          w.id === warningId ? { ...w, isResolved: true } : w
        ),
      });
    },

    recalculateWarnings: () => {
      const { orders, ingredients, recipes } = get();
      const existingResolved = get().warnings.filter((w) => w.isResolved);
      const newWarnings = calculateAllWarnings(orders, ingredients, recipes);
      const mergedWarnings = mergeWarningsWithResolvedState(newWarnings, existingResolved);
      set({ warnings: mergedWarnings });
    },

    recalculatePurchaseSuggestions: () => {
      const { orders, ingredients, recipes, purchaseDecisions } = get();
      const suggestions = calculatePurchaseSuggestions(orders, ingredients, recipes);
      const cleanedDecisions = cleanObsoleteDecisions(
        purchaseDecisions,
        suggestions.map((s) => s.ingredientId)
      );
      const planItems = mergeSuggestionsWithDecisions(suggestions, cleanedDecisions);
      const supplierGroups = groupBySupplier(planItems);
      set({
        purchaseSuggestions: suggestions,
        purchaseDecisions: cleanedDecisions,
        purchasePlanItems: planItems,
        supplierPurchaseGroups: supplierGroups,
      });
    },

    recalculatePurchasePlan: () => {
      set(recalculatePurchasePlan(get()));
    },

    updatePurchaseQuantity: (ingredientId: string, quantity: number | null) => {
      const { purchaseDecisions } = get();
      const newDecisions = createPurchaseDecision(
        ingredientId,
        { adjustedQuantity: quantity },
        purchaseDecisions
      );
      commitPurchaseChange({ purchaseDecisions: newDecisions });
    },

    updatePurchaseStatus: (ingredientId: string, status: PurchaseStatus) => {
      const { purchaseDecisions } = get();
      const newDecisions = createPurchaseDecision(
        ingredientId,
        { status },
        purchaseDecisions
      );
      commitPurchaseChange({ purchaseDecisions: newDecisions });
    },

    updatePurchaseNotes: (ingredientId: string, notes: string) => {
      const { purchaseDecisions } = get();
      const newDecisions = createPurchaseDecision(
        ingredientId,
        { notes },
        purchaseDecisions
      );
      commitViewPreference({ purchaseDecisions: newDecisions });
    },

    clearPurchaseDecision: (ingredientId: string) => {
      const { purchaseDecisions } = get();
      const newDecisions = purchaseDecisions.filter((d) => d.ingredientId !== ingredientId);
      commitPurchaseChange({ purchaseDecisions: newDecisions });
    },

    clearAllPurchaseDecisions: () => {
      commitPurchaseChange({ purchaseDecisions: [] });
    },

    getOrderWarnings: (orderId: string) => selectOrderWarnings(get(), orderId),

    getRecipeById: (recipeId: string) => selectRecipeById(get(), recipeId),

    getOrdersByStep: (stepType: StepType) => selectOrdersByStep(get(), stepType),

    getOrdersByDate: (date: string) => selectOrdersByDate(get(), date),

    getCraftsmanTasks: (craftsmanName: string) => selectCraftsmanTasks(get(), craftsmanName),

    getCraftsmanWorkload: (craftsmanId: string, options) => selectCraftsmanWorkload(get(), craftsmanId, options),

    getAllCraftsmenWorkload: (options) => selectAllCraftsmenWorkload(get(), options),

    getSortedCraftsmenForAssignment: (requiredSkill: StepType) => selectSortedCraftsmenForAssignment(get(), requiredSkill),

    setShowSandboxModal: (show: boolean) => set({ showSandboxModal: show }),

    setSandboxSelectedOrderIds: (orderIds: string[]) => set({ sandboxSelectedOrderIds: orderIds }),

    setSandboxPriorityStrategy: (strategy) => set({ sandboxPriorityStrategy: strategy }),

    setSandboxResult: (result) => set({ sandboxResult: result }),

    generateSandboxPreview: (orderIds, strategy) => {
      const { orders, craftsmen, recipes, ingredients } = get();
      const selectedOrders = orders.filter((o) => orderIds.includes(o.id) && o.status !== 'completed');
      const result = generateSandboxSchedule(
        selectedOrders,
        strategy,
        orders,
        craftsmen,
        recipes,
        ingredients
      );
      set({ sandboxResult: result });
      return result;
    },

    applySandboxChanges: () => {
      const { orders, sandboxResult } = get();
      if (!sandboxResult) return;

      const updatedOrders = applySandboxResult(orders, sandboxResult);
      commitStateChange({ orders: updatedOrders });

      set({
        showSandboxModal: false,
        sandboxSelectedOrderIds: [],
        sandboxResult: null,
      });
    },

    clearSandbox: () => {
      set({
        sandboxSelectedOrderIds: [],
        sandboxResult: null,
        sandboxPriorityStrategy: 'priority_first',
      });
    },

    resetToDefault: () => {
      clearStorage();
      const defaultData = getDefaultData();
      const purchaseSuggestions = calculatePurchaseSuggestions(
        defaultData.orders,
        defaultData.ingredients,
        defaultData.recipes
      );
      const purchaseDecisions: PurchaseDecision[] = [];
      const purchasePlanItems = mergeSuggestionsWithDecisions(purchaseSuggestions, purchaseDecisions);
      const supplierPurchaseGroups = groupBySupplier(purchasePlanItems);

      set({
        orders: defaultData.orders,
        recipes: defaultData.recipes,
        ingredients: defaultData.ingredients,
        warnings: defaultData.warnings,
        purchaseSuggestions,
        purchaseDecisions,
        purchasePlanItems,
        supplierPurchaseGroups,
        ...defaultData.viewPreferences,
        selectedOrderId: null,
        showCreateOrderModal: false,
        showRecipeModal: false,
        showPrintPreview: false,
        showScheduleAdjustModal: false,
        scheduleAdjustOrderId: null,
        printOrderId: null,
        editingRecipeId: null,
        showIngredientGapModal: false,
        ingredientGapOrderId: null,
        showSandboxModal: false,
        sandboxSelectedOrderIds: [],
        sandboxPriorityStrategy: 'priority_first',
        sandboxResult: null,
      });

      console.info('[Store] Reset to default data completed');
    },
  };
});
