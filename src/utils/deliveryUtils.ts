import {
  type Order,
  type Warning,
  type IngredientBatch,
  type Recipe,
  type DeliveryCommitmentSummary,
} from '../types';
import { daysBetween, isDateBefore } from './dateUtils';
import { buildIngredientMaps, calculateEffectiveStock, calculateRequiredQuantity } from './ingredientUtils';

export const calculateDeliveryCommitment = (
  customerOrders: Order[],
  _warnings: Warning[],
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

  const { ingredientIdToName, ingredientNameToBatches } = buildIngredientMaps(ingredients);

  const ingredientStockMap = new Map<string, number>();
  ingredientNameToBatches.forEach((batches, name) => {
    ingredientStockMap.set(name, calculateEffectiveStock(batches, today));
  });

  const ingredientDemandMap = new Map<string, { totalRequired: number; orderNos: string[] }>();

  customerOrders.forEach((order) => {
    if (order.status === 'completed') return;
    const recipe = recipes.find((r) => r.id === order.recipeId);
    if (!recipe) return;

    recipe.ingredients.forEach((ri) => {
      const ingredientName = ingredientIdToName.get(ri.ingredientId);
      if (!ingredientName) return;

      const required = calculateRequiredQuantity(ri.ingredientId, order.quantity, recipe);
      const existing = ingredientDemandMap.get(ingredientName) || { totalRequired: 0, orderNos: [] };
      ingredientDemandMap.set(ingredientName, {
        totalRequired: existing.totalRequired + required,
        orderNos: existing.orderNos.includes(order.orderNo)
          ? existing.orderNos
          : [...existing.orderNos, order.orderNo],
      });
    });
  });

  const materialShortageDetails: {
    ingredientName: string;
    gap: number;
    unit: string;
    orderNos: string[];
  }[] = [];

  ingredientDemandMap.forEach((demand, ingredientName) => {
    const available = ingredientStockMap.get(ingredientName) || 0;
    const gap = demand.totalRequired - available;

    if (gap > 0) {
      const batches = ingredientNameToBatches.get(ingredientName) || [];
      materialShortageDetails.push({
        ingredientName,
        gap: Number(gap.toFixed(2)),
        unit: batches[0]?.unit || 'g',
        orderNos: demand.orderNos,
      });
    }
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
