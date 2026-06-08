import {
  type Order,
  type Recipe,
  type Warning,
  type StepType,
  type ProductionStep,
  type CraftsmanWorkload,
  type WorkloadAnalysisOptions,
  type OrderMaterialGap,
  type CustomerOrderSummary,
  type AppState,
} from '../types';
import { STEP_ORDER } from '../types';
import { analyzeCraftsmanWorkload, analyzeAllCraftsmenWorkload, sortCraftsmenForAssignment } from '../utils/workloadUtils';
import { getOrderMaterialGap as calculateOrderMaterialGap } from '../utils/ingredientUtils';
import { calculateCustomerSummaries, getCustomerSummary } from '../utils/customerUtils';

type SelectorState = AppState;

export const selectOrderWarnings = (
  state: SelectorState,
  orderId: string
): Warning[] => {
  return state.warnings.filter((w) => w.relatedId === orderId && !w.isResolved);
};

export const selectRecipeById = (
  state: SelectorState,
  recipeId: string
): Recipe | undefined => {
  return state.recipes.find((r) => r.id === recipeId);
};

export const selectOrdersByStep = (
  state: SelectorState,
  stepType: StepType
): Order[] => {
  return state.orders.filter((order) => {
    if (order.status === 'completed') return false;
    if (order.status === 'pending') return stepType === STEP_ORDER[0];
    const currentStep = order.steps.find((s) => s.status === 'in_progress');
    return currentStep?.stepType === stepType;
  });
};

export const selectOrdersByDate = (
  state: SelectorState,
  date: string
): Order[] => {
  return state.orders.filter((order) => {
    return order.steps.some(
      (step) =>
        step.status === 'in_progress' &&
        step.startDate <= date &&
        step.endDate >= date
    );
  });
};

export const selectCraftsmanTasks = (
  state: SelectorState,
  craftsmanName: string
): { order: Order; step: ProductionStep }[] => {
  const tasks: { order: Order; step: ProductionStep }[] = [];
  state.orders.forEach((order) => {
    order.steps.forEach((step) => {
      if (step.assignee === craftsmanName) {
        tasks.push({ order, step });
      }
    });
  });
  return tasks;
};

export const selectCraftsmanWorkload = (
  state: SelectorState,
  craftsmanId: string,
  options: WorkloadAnalysisOptions = {}
): CraftsmanWorkload => {
  const { craftsmen, orders } = state;
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
};

export const selectAllCraftsmenWorkload = (
  state: SelectorState,
  options: WorkloadAnalysisOptions = {}
): CraftsmanWorkload[] => {
  const { craftsmen, orders } = state;
  return analyzeAllCraftsmenWorkload(craftsmen, orders, options);
};

export const selectSortedCraftsmenForAssignment = (
  state: SelectorState,
  requiredSkill: StepType
): CraftsmanWorkload[] => {
  const { craftsmen, orders } = state;
  const workloads = analyzeAllCraftsmenWorkload(craftsmen, orders, {
    daysAhead: 7,
    requiredSkill,
  });
  return sortCraftsmenForAssignment(workloads);
};

export const selectOrderMaterialGap = (
  state: SelectorState,
  orderId: string
): OrderMaterialGap | null => {
  const { orders, recipes, ingredients } = state;
  return calculateOrderMaterialGap(orderId, orders, recipes, ingredients);
};

export const selectCustomerOrderSummaries = (
  state: SelectorState
): CustomerOrderSummary[] => {
  const { orders, warnings, ingredients, recipes } = state;
  return calculateCustomerSummaries(orders, {
    getOrderWarnings: (orderId) => selectOrderWarnings(state, orderId),
    warnings,
    ingredients,
    recipes,
  });
};

export const selectCustomerOrderSummary = (
  state: SelectorState,
  customerName: string
): CustomerOrderSummary | undefined => {
  const summaries = selectCustomerOrderSummaries(state);
  return getCustomerSummary(customerName, summaries);
};
