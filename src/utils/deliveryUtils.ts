import {
  Order,
  Warning,
  IngredientBatch,
  Recipe,
  DeliveryCommitmentSummary,
} from '../types';
import { daysBetween, isDateBefore } from './dateUtils';

export const calculateDeliveryCommitment = (
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

  const ingredientDemandMap = new Map<string, { totalRequired: number; orderNos: string[] }>();

  customerOrders.forEach((order) => {
    if (order.status === 'completed') return;
    const recipe = recipes.find((r) => r.id === order.recipeId);
    if (!recipe) return;

    recipe.ingredients.forEach((ri) => {
      const ingredientName = ingredientIdToName.get(ri.ingredientId);
      if (!ingredientName) return;

      const required = (ri.quantity / 100) * order.quantity;
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
      const batches = ingredientMap.get(ingredientName) || [];
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
