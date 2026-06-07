import { Order, Recipe, IngredientBatch, PurchaseSuggestionIngredient, Priority } from '../types';
import { getToday, daysBetween } from './dateUtils';

interface PendingDemand {
  total: number;
  orders: {
    orderId: string;
    orderNo: string;
    customerName: string;
    quantity: number;
    priority: Priority;
    deliveryDate: string;
    daysToDelivery: number;
  }[];
}

const calculateIngredientDemand = (
  ingredientName: string,
  ingredientIdToName: Map<string, string>,
  orders: Order[],
  recipes: Recipe[],
  today: string
): PendingDemand => {
  let total = 0;
  const relatedOrders: PendingDemand['orders'] = [];

  orders.forEach((order) => {
    if (order.status === 'completed') return;

    const recipe = recipes.find((r) => r.id === order.recipeId);
    if (!recipe) return;

    const matchingIngredients = recipe.ingredients.filter((ri) => {
      const name = ingredientIdToName.get(ri.ingredientId);
      return name === ingredientName;
    });

    if (matchingIngredients.length === 0) return;

    const totalRecipeQuantity = matchingIngredients.reduce((sum, ri) => sum + ri.quantity, 0);
    const demand = (totalRecipeQuantity / 100) * order.quantity;
    total += demand;

    const daysToDelivery = daysBetween(today, order.deliveryDate);
    relatedOrders.push({
      orderId: order.id,
      orderNo: order.orderNo,
      customerName: order.customerName,
      quantity: order.quantity,
      priority: order.priority,
      deliveryDate: order.deliveryDate,
      daysToDelivery,
    });
  });

  return { total, orders: relatedOrders };
};

const calculatePriority = (
  gap: number,
  safetyStock: number,
  daysToExpiry: number,
  relatedOrders: PendingDemand['orders']
): 'critical' | 'high' | 'medium' | 'low' => {
  if (gap <= 0) return 'low';

  const gapRatio = gap / safetyStock;
  const hasHighPriorityOrder = relatedOrders.some((o) => o.priority === 'high');
  const hasUrgentDelivery = relatedOrders.some((o) => o.daysToDelivery <= 15);
  const expiringSoon = daysToExpiry <= 30 && daysToExpiry > 0;
  const expired = daysToExpiry <= 0;

  let score = 0;

  if (gapRatio > 1) score += 3;
  else if (gapRatio > 0.5) score += 2;
  else if (gapRatio > 0) score += 1;

  if (expired) score += 3;
  else if (expiringSoon) score += 2;

  if (hasHighPriorityOrder) score += 2;
  if (hasUrgentDelivery) score += 2;

  if (score >= 6) return 'critical';
  if (score >= 4) return 'high';
  if (score >= 2) return 'medium';
  return 'low';
};

const calculateSuggestedPurchase = (
  gap: number,
  safetyStock: number,
  priority: 'critical' | 'high' | 'medium' | 'low'
): number => {
  if (gap <= 0) return 0;

  const bufferMultiplier = {
    critical: 1.5,
    high: 1.3,
    medium: 1.1,
    low: 1.0,
  };

  const basePurchase = Math.max(gap, safetyStock * 0.5);
  return Math.ceil(basePurchase * bufferMultiplier[priority]);
};

export const calculatePurchaseSuggestions = (
  orders: Order[],
  ingredients: IngredientBatch[],
  recipes: Recipe[]
): PurchaseSuggestionIngredient[] => {
  const today = getToday();
  const suggestions: PurchaseSuggestionIngredient[] = [];

  const ingredientIdToName = new Map<string, string>();
  ingredients.forEach((ing) => {
    ingredientIdToName.set(ing.id, ing.name);
  });

  const ingredientMap = new Map<string, typeof ingredients[0][]>();
  ingredients.forEach((ing) => {
    const existing = ingredientMap.get(ing.name) || [];
    ingredientMap.set(ing.name, [...existing, ing]);
  });

  ingredientMap.forEach((batches, ingredientName) => {
    const representativeBatch = batches[0];
    const ingredientId = representativeBatch.id;

    const totalCurrentStock = batches.reduce((sum, batch) => {
      const daysToExpiry = daysBetween(today, batch.expiryDate);
      if (daysToExpiry <= 0) return sum;
      if (daysToExpiry <= 7) return sum + batch.quantity * 0.3;
      if (daysToExpiry <= 30) return sum + batch.quantity * 0.7;
      return sum + batch.quantity;
    }, 0);

    const earliestExpiry = batches.reduce((earliest, batch) => {
      return daysBetween(today, batch.expiryDate) < daysBetween(today, earliest)
        ? batch.expiryDate
        : earliest;
    }, batches[0].expiryDate);

    const daysToExpiry = daysBetween(today, earliestExpiry);

    const demand = calculateIngredientDemand(ingredientName, ingredientIdToName, orders, recipes, today);

    const totalSafetyStock = batches.reduce((sum, batch) => sum + batch.safetyStock, 0);

    const demandGap = Math.max(0, demand.total - totalCurrentStock);
    const stockAfterDemand = Math.max(0, totalCurrentStock - demand.total);
    const safetyStockGap = Math.max(0, totalSafetyStock - stockAfterDemand);
    const gap = Math.max(0, demand.total + totalSafetyStock - totalCurrentStock);

    const priority = calculatePriority(gap, totalSafetyStock, daysToExpiry, demand.orders);

    const suggestedPurchase = calculateSuggestedPurchase(gap, totalSafetyStock, priority);

    if (gap > 0 || suggestedPurchase > 0) {
      suggestions.push({
        ingredientId,
        name: ingredientName,
        currentStock: Number(totalCurrentStock.toFixed(2)),
        safetyStock: totalSafetyStock,
        unit: representativeBatch.unit,
        expiryDate: earliestExpiry,
        daysToExpiry,
        pendingDemand: Number(demand.total.toFixed(2)),
        demandGap: Number(demandGap.toFixed(2)),
        safetyStockGap: Number(safetyStockGap.toFixed(2)),
        gap: Number(gap.toFixed(2)),
        suggestedPurchase,
        priority,
        relatedOrders: demand.orders.sort((a, b) => a.daysToDelivery - b.daysToDelivery),
      });
    }
  });

  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  suggestions.sort((a, b) => {
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return b.gap - a.gap;
  });

  return suggestions;
};
