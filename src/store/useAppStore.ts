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
  ProductionStep,
  StepUpdateData,
  CustomerOrderSummary,
  RiskLevel,
  CustomerDeliveryBoardState,
  PurchaseDecision,
  PurchaseStatus,
  DeliveryCommitmentSummary,
  OrderMaterialGap,
  MaterialGapDetail,
  Warning,
  IngredientBatch,
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
import { getToday, addDaysToDate, isDateBefore, daysBetween } from '../utils/dateUtils';
import { applyStepAdjustment, validateStepAdjustment } from '../utils/scheduleUtils';
import {
  loadFromStorage,
  saveToStorage,
  getDefaultData,
  clearStorage,
} from '../utils/storage';
import {
  analyzeCraftsmanWorkload,
  analyzeAllCraftsmenWorkload,
  sortCraftsmenForAssignment,
} from '../utils/workloadUtils';
import {
  CraftsmanWorkload,
  WorkloadAnalysisOptions,
  SandboxPriorityStrategy,
  SandboxResult,
} from '../types';
import {
  generateSandboxSchedule,
  applySandboxResult,
} from '../utils/sandboxUtils';

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

const calculateDeliveryCommitment = (
  customerOrders: Order[],
  warnings: Warning[],
  ingredients: IngredientBatch[],
  recipes: Recipe[],
  today: string
): DeliveryCommitmentSummary => {
  const activeOrders = customerOrders.filter((o) => o.status !== 'completed');

  const sortedByDelivery = [...activeOrders].sort((a, b) =>
    a.deliveryDate.localeCompare(b.deliveryDate)
  );
  const earliestDeliveryDate =
    sortedByDelivery.length > 0 ? sortedByDelivery[0].deliveryDate : '';
  const earliestDaysRemaining = earliestDeliveryDate
    ? daysBetween(today, earliestDeliveryDate)
    : 0;

  const overdueOrders = activeOrders.filter((o) => isDateBefore(o.deliveryDate, today));
  const hasOverdueRisk = overdueOrders.length > 0;
  const overdueRiskCount = overdueOrders.length;

  const blockingStepMap = new Map<string, { orderCount: number; orderNos: string[] }>();
  activeOrders.forEach((order) => {
    const currentStep = order.steps.find((s) => s.status === 'in_progress');
    if (!currentStep) {
      const firstStep = order.steps[0];
      if (firstStep) {
        const existing = blockingStepMap.get(firstStep.stepName) || {
          orderCount: 0,
          orderNos: [],
        };
        blockingStepMap.set(firstStep.stepName, {
          orderCount: existing.orderCount + 1,
          orderNos: [...existing.orderNos, order.orderNo],
        });
      }
    }
  });
  const criticalBlockingSteps = Array.from(blockingStepMap.entries())
    .map(([stepName, data]) => ({ stepName, ...data }))
    .sort((a, b) => b.orderCount - a.orderCount)
    .slice(0, 3);

  const ingredientIdToName = new Map<string, string>();
  ingredients.forEach((ing) => {
    ingredientIdToName.set(ing.id, ing.name);
  });

  const ingredientMap = new Map<string, typeof ingredients[0][]>();
  ingredients.forEach((ing) => {
    const existing = ingredientMap.get(ing.name) || [];
    ingredientMap.set(ing.name, [...existing, ing]);
  });

  const ingredientStockMap = new Map<string, number>();
  ingredientMap.forEach((batches, name) => {
    const totalStock = batches.reduce((sum, batch) => {
      const daysToExpiry = daysBetween(today, batch.expiryDate);
      if (daysToExpiry <= 0) return sum;
      if (daysToExpiry <= 7) return sum + batch.quantity * 0.3;
      if (daysToExpiry <= 30) return sum + batch.quantity * 0.7;
      return sum + batch.quantity;
    }, 0);
    ingredientStockMap.set(name, totalStock);
  });

  const materialShortageDetails: {
    ingredientName: string;
    gap: number;
    unit: string;
    orderNos: string[];
  }[] = [];

  customerOrders.forEach((order) => {
    if (order.status === 'completed') return;
    const recipe = recipes.find((r) => r.id === order.recipeId);
    if (!recipe) return;

    recipe.ingredients.forEach((ri) => {
      const ingredientName = ingredientIdToName.get(ri.ingredientId);
      if (!ingredientName) return;

      const required = (ri.quantity / 100) * order.quantity;
      const available = ingredientStockMap.get(ingredientName) || 0;
      const gap = required - available;

      if (gap > 0) {
        const existing = materialShortageDetails.find(
          (d) => d.ingredientName === ingredientName
        );
        if (existing) {
          existing.gap += gap;
          if (!existing.orderNos.includes(order.orderNo)) {
            existing.orderNos.push(order.orderNo);
          }
        } else {
          const batches = ingredientMap.get(ingredientName) || [];
          materialShortageDetails.push({
            ingredientName,
            gap: Number(gap.toFixed(2)),
            unit: batches[0]?.unit || 'g',
            orderNos: [order.orderNo],
          });
        }
      }
    });
  });

  const materialShortageRisk = materialShortageDetails.length > 0;
  const materialShortageCount = materialShortageDetails.length;

  const highPriorityOrders = activeOrders.filter((o) => o.priority === 'high');
  const highPriorityOrderCount = highPriorityOrders.length;
  const highPriorityOrderNos = highPriorityOrders.map((o) => o.orderNo);

  const needsThisWeek = activeOrders.some((o) => {
    const days = daysBetween(today, o.deliveryDate);
    return days <= 7;
  });

  return {
    earliestDeliveryDate,
    earliestDaysRemaining,
    hasOverdueRisk,
    overdueRiskCount,
    criticalBlockingSteps,
    materialShortageRisk,
    materialShortageCount,
    materialShortageDetails,
    highPriorityOrderCount,
    highPriorityOrderNos,
    needsThisWeek,
  };
};

const saveState = (state: AppState) => {
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

const generateOrderId = (): string => `order-${Date.now().toString().slice(-6)}`;
const generateOrderNo = (): string => {
  const today = getToday();
  const yearMonth = today.slice(0, 7).replace('-', '');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `XY-${yearMonth}-${random}`;
};

const generateRecipeId = (): string => `recipe-${Date.now().toString().slice(-6)}`;

export const useAppStore = create<AppStore>((set, get) => ({
  ...initialState,

  setCurrentView: (view: ViewType) => {
    set({ currentView: view });
    saveState(get());
  },

  setSelectedDate: (date: string) => {
    set({ selectedDate: date });
    saveState(get());
  },

  setSelectedOrderId: (id: string | null) => set({ selectedOrderId: id }),

  setShowIngredientPanel: (show: boolean) => {
    set({ showIngredientPanel: show });
    saveState(get());
  },

  setShowWarningPanel: (show: boolean) => {
    set({ showWarningPanel: show });
    saveState(get());
  },

  setShowCreateOrderModal: (show: boolean) => set({ showCreateOrderModal: show }),

  setShowRecipePanel: (show: boolean) => {
    set({ showRecipePanel: show });
    saveState(get());
  },

  setShowRecipeModal: (show: boolean) => set({ showRecipeModal: show }),

  setShowSchedulePanel: (show: boolean) => {
    set({ showSchedulePanel: show });
    saveState(get());
  },

  setShowPrintPreview: (show: boolean) => set({ showPrintPreview: show }),

  setShowPurchaseSuggestion: (show: boolean) => {
    set({ showPurchaseSuggestion: show });
    saveState(get());
  },

  setPrintOrderId: (id: string | null) => set({ printOrderId: id }),

  setEditingRecipeId: (id: string | null) => set({ editingRecipeId: id }),

  setCopyingRecipeId: (id: string | null) => set({ copyingRecipeId: id }),

  setShowScheduleAdjustModal: (show: boolean) => set({ showScheduleAdjustModal: show }),

  setScheduleAdjustOrderId: (id: string | null) => set({ scheduleAdjustOrderId: id }),

  setShowCompletedOrders: (show: boolean) => {
    set((state) => ({
      deliveryBoard: { ...state.deliveryBoard, showCompletedOrders: show },
    }));
    saveState(get());
  },

  setSortBy: (sortBy: CustomerDeliveryBoardState['sortBy']) => {
    set((state) => ({
      deliveryBoard: { ...state.deliveryBoard, sortBy },
    }));
    saveState(get());
  },

  setFilterRiskLevel: (level: RiskLevel | 'all') => {
    set((state) => ({
      deliveryBoard: { ...state.deliveryBoard, filterRiskLevel: level },
    }));
    saveState(get());
  },

  toggleCustomerExpand: (customerName: string) => {
    set((state) => {
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
    });
    saveState(get());
  },

  setShowThisWeekOnly: (show: boolean) => {
    set((state) => ({
      deliveryBoard: { ...state.deliveryBoard, showThisWeekOnly: show },
    }));
    saveState(get());
  },

  setShowIngredientGapModal: (show: boolean) => set({ showIngredientGapModal: show }),

  setIngredientGapOrderId: (id: string | null) => set({ ingredientGapOrderId: id }),

  getOrderMaterialGap: (orderId: string): OrderMaterialGap | null => {
    const { orders, recipes, ingredients } = get();
    const order = orders.find((o) => o.id === orderId);
    if (!order) return null;

    const recipe = recipes.find((r) => r.id === order.recipeId);
    if (!recipe) return null;

    const today = getToday();

    const ingredientIdToName = new Map<string, string>();
    ingredients.forEach((ing) => {
      ingredientIdToName.set(ing.id, ing.name);
    });

    const ingredientMap = new Map<string, typeof ingredients[0][]>();
    ingredients.forEach((ing) => {
      const existing = ingredientMap.get(ing.name) || [];
      ingredientMap.set(ing.name, [...existing, ing]);
    });

    const gaps: MaterialGapDetail[] = [];

    recipe.ingredients.forEach((ri) => {
      const ingredientName = ingredientIdToName.get(ri.ingredientId);
      if (!ingredientName) return;

      const required = (ri.quantity / 100) * order.quantity;
      const batches = ingredientMap.get(ingredientName) || [];

      const available = batches.reduce((sum, batch) => {
        const daysToExpiry = daysBetween(today, batch.expiryDate);
        if (daysToExpiry <= 0) return sum;
        if (daysToExpiry <= 7) return sum + batch.quantity * 0.3;
        if (daysToExpiry <= 30) return sum + batch.quantity * 0.7;
        return sum + batch.quantity;
      }, 0);

      const gap = required - available;
      if (gap > 0) {
        const relatedOrders = orders
          .filter((o) => o.status !== 'completed' && o.id !== orderId)
          .map((o) => {
            const r = recipes.find((rec) => rec.id === o.recipeId);
            if (!r) return null;
            const ing = r.ingredients.find((i) => i.ingredientId === ri.ingredientId);
            if (!ing) return null;
            const reqQty = (ing.quantity / 100) * o.quantity;
            return {
              orderId: o.id,
              orderNo: o.orderNo,
              requiredQuantity: Number(reqQty.toFixed(2)),
              deliveryDate: o.deliveryDate,
              priority: o.priority,
            };
          })
          .filter(Boolean) as MaterialGapDetail['relatedOrders'];

        gaps.push({
          ingredientId: ri.ingredientId,
          ingredientName,
          required: Number(required.toFixed(2)),
          available: Number(available.toFixed(2)),
          unit: batches[0]?.unit || 'g',
          gap: Number(gap.toFixed(2)),
          relatedOrders,
        });
      }
    });

    return {
      orderId: order.id,
      orderNo: order.orderNo,
      recipeName: recipe.name,
      gaps,
      totalGapCount: gaps.length,
    };
  },

  getCustomerOrderSummaries: (): CustomerOrderSummary[] => {
    const { orders, getOrderWarnings, warnings, ingredients, recipes } = get();
    const customerMap = new Map<string, Order[]>();

    orders.forEach((order) => {
      const existing = customerMap.get(order.customerName) || [];
      customerMap.set(order.customerName, [...existing, order]);
    });

    const summaries: CustomerOrderSummary[] = [];
    const today = getToday();

    customerMap.forEach((customerOrders, customerName) => {
      const totalOrders = customerOrders.length;
      const pendingOrders = customerOrders.filter((o) => o.status === 'pending').length;
      const inProductionOrders = customerOrders.filter((o) => o.status === 'in_production').length;
      const completedOrders = customerOrders.filter((o) => o.status === 'completed').length;

      const overdueOrders = customerOrders.filter(
        (o) => o.status !== 'completed' && isDateBefore(o.deliveryDate, today)
      ).length;

      const highPriorityOrders = customerOrders.filter(
        (o) => o.priority === 'high' && o.status !== 'completed'
      ).length;

      const activeOrders = customerOrders.filter((o) => o.status !== 'completed');
      const sortedByDelivery = [...activeOrders].sort((a, b) =>
        a.deliveryDate.localeCompare(b.deliveryDate)
      );
      const earliestDeliveryDate =
        sortedByDelivery.length > 0 ? sortedByDelivery[0].deliveryDate : '';
      const latestDeliveryDate =
        sortedByDelivery.length > 0
          ? sortedByDelivery[sortedByDelivery.length - 1].deliveryDate
          : '';

      const totalSteps = customerOrders.reduce(
        (sum, o) => sum + o.steps.length,
        0
      );
      const completedSteps = customerOrders.reduce(
        (sum, o) => sum + o.steps.filter((s) => s.status === 'completed').length,
        0
      );
      const overallProgress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

      let riskLevel: RiskLevel = 'low';
      if (overdueOrders > 0) {
        riskLevel = 'critical';
      } else if (highPriorityOrders > 0) {
        const hasNearDelivery = activeOrders.some((o) => {
          const days = daysBetween(today, o.deliveryDate);
          return days <= 7;
        });
        if (hasNearDelivery) {
          riskLevel = 'high';
        } else {
          riskLevel = 'medium';
        }
      } else {
        const hasWarnings = activeOrders.some((o) => {
          const orderWarnings = getOrderWarnings(o.id);
          return orderWarnings.some((w) => w.level === 'critical' || w.level === 'warning');
        });
        if (hasWarnings) {
          riskLevel = 'medium';
        }
      }

      const deliveryCommitment = calculateDeliveryCommitment(
        customerOrders,
        warnings,
        ingredients,
        recipes,
        today
      );

      summaries.push({
        customerName,
        totalOrders,
        pendingOrders,
        inProductionOrders,
        completedOrders,
        overdueOrders,
        highPriorityOrders,
        earliestDeliveryDate,
        latestDeliveryDate,
        overallProgress,
        riskLevel,
        orders: customerOrders,
        orderIds: customerOrders.map((o) => o.id),
        deliveryCommitment,
      });
    });

    return summaries;
  },

  getCustomerOrderSummary: (customerName: string): CustomerOrderSummary | undefined => {
    const summaries = get().getCustomerOrderSummaries();
    return summaries.find((s) => s.customerName === customerName);
  },

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

    saveState(get());
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
    get().recalculatePurchaseSuggestions();
    saveState(get());

    return updatedRecipe;
  },

  deleteRecipe: (id: string) => {
    set((state) => ({
      recipes: state.recipes.filter((r) => r.id !== id),
    }));
    get().recalculateWarnings();
    get().recalculatePurchaseSuggestions();
    saveState(get());
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
    get().recalculatePurchaseSuggestions();
    saveState(get());

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
    get().recalculatePurchaseSuggestions();
    saveState(get());
  },

  assignStepToCraftsman: (orderId: string, stepId: string, craftsmanName: string) => {
    set((state) => ({
      orders: state.orders.map((order) => {
        if (order.id !== orderId) return order;
        return {
          ...order,
          steps: order.steps.map((step) => {
            if (step.id !== stepId) return step;
            return { ...step, assignee: craftsmanName };
          }),
        };
      }),
    }));
    saveState(get());
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
    get().recalculatePurchaseSuggestions();
    saveState(get());
  },

  updateProductionStep: (orderId: string, stepId: string, updates: StepUpdateData) => {
    const { orders } = get();
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    const validation = validateStepAdjustment(order, stepId, updates);
    if (!validation.valid) return;

    const updatedSteps = applyStepAdjustment(order, stepId, updates);

    set((state) => ({
      orders: state.orders.map((o) => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          steps: updatedSteps,
        };
      }),
    }));

    get().recalculateWarnings();
    get().recalculatePurchaseSuggestions();
    saveState(get());
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
    get().recalculatePurchaseSuggestions();
    saveState(get());
  },

  resolveWarning: (warningId: string) => {
    set((state) => ({
      warnings: state.warnings.map((w) =>
        w.id === warningId ? { ...w, isResolved: true } : w
      ),
    }));
    saveState(get());
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
    const { purchaseSuggestions, purchaseDecisions } = get();
    const planItems = mergeSuggestionsWithDecisions(purchaseSuggestions, purchaseDecisions);
    const supplierGroups = groupBySupplier(planItems);
    set({
      purchasePlanItems: planItems,
      supplierPurchaseGroups: supplierGroups,
    });
  },

  updatePurchaseQuantity: (ingredientId: string, quantity: number | null) => {
    const { purchaseDecisions } = get();
    const newDecisions = createPurchaseDecision(
      ingredientId,
      { adjustedQuantity: quantity },
      purchaseDecisions
    );
    set({ purchaseDecisions: newDecisions });
    get().recalculatePurchasePlan();
    saveState(get());
  },

  updatePurchaseStatus: (ingredientId: string, status: PurchaseStatus) => {
    const { purchaseDecisions } = get();
    const newDecisions = createPurchaseDecision(
      ingredientId,
      { status },
      purchaseDecisions
    );
    set({ purchaseDecisions: newDecisions });
    get().recalculatePurchasePlan();
    saveState(get());
  },

  updatePurchaseNotes: (ingredientId: string, notes: string) => {
    const { purchaseDecisions } = get();
    const newDecisions = createPurchaseDecision(
      ingredientId,
      { notes },
      purchaseDecisions
    );
    set({ purchaseDecisions: newDecisions });
    saveState(get());
  },

  clearPurchaseDecision: (ingredientId: string) => {
    const { purchaseDecisions } = get();
    const newDecisions = purchaseDecisions.filter((d) => d.ingredientId !== ingredientId);
    set({ purchaseDecisions: newDecisions });
    get().recalculatePurchasePlan();
    saveState(get());
  },

  clearAllPurchaseDecisions: () => {
    set({ purchaseDecisions: [] });
    get().recalculatePurchasePlan();
    saveState(get());
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

  getCraftsmanTasks: (craftsmanName: string) => {
    const tasks: { order: Order; step: ProductionStep }[] = [];
    get().orders.forEach((order) => {
      order.steps.forEach((step) => {
        if (step.assignee === craftsmanName) {
          tasks.push({ order, step });
        }
      });
    });
    return tasks;
  },

  getCraftsmanWorkload: (craftsmanId: string, options: WorkloadAnalysisOptions = {}): CraftsmanWorkload => {
    const { craftsmen, orders } = get();
    const craftsman = craftsmen.find((c) => c.id === craftsmanId);
    if (!craftsman) {
      return {
        craftsmanId,
        craftsmanName: '',
        taskCount: 0,
        totalDurationDays: 0,
        stepTypes: [],
        tasks: [],
        workloadLevel: 'low',
        isResting: false,
        hasMatchingSkill: true,
      };
    }
    return analyzeCraftsmanWorkload(craftsman, orders, options);
  },

  getAllCraftsmenWorkload: (options: WorkloadAnalysisOptions = {}): CraftsmanWorkload[] => {
    const { craftsmen, orders } = get();
    return analyzeAllCraftsmenWorkload(craftsmen, orders, options);
  },

  getSortedCraftsmenForAssignment: (requiredSkill: StepType): CraftsmanWorkload[] => {
    const { craftsmen, orders } = get();
    const workloads = analyzeAllCraftsmenWorkload(craftsmen, orders, {
      daysAhead: 7,
      requiredSkill,
    });
    return sortCraftsmenForAssignment(workloads);
  },

  setShowSandboxModal: (show: boolean) => set({ showSandboxModal: show }),

  setSandboxSelectedOrderIds: (orderIds: string[]) => set({ sandboxSelectedOrderIds: orderIds }),

  setSandboxPriorityStrategy: (strategy: SandboxPriorityStrategy) => set({ sandboxPriorityStrategy: strategy }),

  setSandboxResult: (result: SandboxResult | null) => set({ sandboxResult: result }),

  generateSandboxPreview: (orderIds: string[], strategy: SandboxPriorityStrategy): SandboxResult => {
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
    const { orders, sandboxResult, recalculateWarnings, recalculatePurchaseSuggestions } = get();
    if (!sandboxResult) return;

    const updatedOrders = applySandboxResult(orders, sandboxResult);
    set({ orders: updatedOrders });

    recalculateWarnings();
    recalculatePurchaseSuggestions();
    saveState(get());

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

    console.log('[Store] Reset to default data completed');
  },
}));
