import { type Order, type Recipe, type IngredientBatch, type PurchaseSuggestionIngredient, type PurchaseDecision, type PurchasePlanItem, type SupplierPurchaseGroup, type Priority } from '../types';
import { getToday, daysBetween } from './dateUtils';
import { buildIngredientMaps, calculateEffectiveStock, calculateIngredientDemand } from './ingredientUtils';

interface RelatedOrder {
  orderId: string;
  orderNo: string;
  customerName: string;
  quantity: number;
  priority: Priority;
  deliveryDate: string;
  daysToDelivery: number;
}

const calculatePriority = (
  gap: number,
  safetyStock: number,
  daysToExpiry: number,
  relatedOrders: RelatedOrder[]
): 'critical' | 'high' | 'medium' | 'low' => {
  if (gap <= 0) return 'low';

  const gapRatio = gap / safetyStock;
  const hasHighPriorityOrder = relatedOrders.some((o: RelatedOrder) => o.priority === 'high');
  const hasUrgentDelivery = relatedOrders.some((o: RelatedOrder) => o.daysToDelivery <= 15);
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

  const { ingredientIdToName, ingredientNameToBatches } = buildIngredientMaps(ingredients);

  ingredientNameToBatches.forEach((batches, ingredientName) => {
    const representativeBatch = batches[0];
    const ingredientId = representativeBatch.id;

    const totalCurrentStock = calculateEffectiveStock(batches, today);

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
        supplier: representativeBatch.supplier,
        unitPrice: representativeBatch.unitPrice,
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

export const mergeSuggestionsWithDecisions = (
  suggestions: PurchaseSuggestionIngredient[],
  decisions: PurchaseDecision[]
): PurchasePlanItem[] => {
  const decisionMap = new Map(decisions.map((d) => [d.ingredientId, d]));

  return suggestions.map((suggestion) => {
    const decision = decisionMap.get(suggestion.ingredientId);
    const adjustedQuantity = decision?.adjustedQuantity ?? null;
    const finalQuantity = adjustedQuantity !== null ? adjustedQuantity : suggestion.suggestedPurchase;

    return {
      ...suggestion,
      adjustedQuantity,
      finalQuantity,
      status: decision?.status ?? 'pending',
      notes: decision?.notes,
      decisionUpdatedAt: decision?.updatedAt,
    };
  });
};

export const groupBySupplier = (
  planItems: PurchasePlanItem[]
): SupplierPurchaseGroup[] => {
  const supplierMap = new Map<string, PurchasePlanItem[]>();

  planItems.forEach((item) => {
    if (item.status === 'skip') return;
    const existing = supplierMap.get(item.supplier) || [];
    supplierMap.set(item.supplier, [...existing, item]);
  });

  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

  const groups: SupplierPurchaseGroup[] = [];
  supplierMap.forEach((items, supplier) => {
    const totalQuantity = items.reduce((sum, item) => sum + item.finalQuantity, 0);
    const totalEstimatedCost = items.reduce(
      (sum, item) => sum + item.finalQuantity * item.unitPrice,
      0
    );

    const highestPriority = items.reduce<'critical' | 'high' | 'medium' | 'low'>(
      (highest, item) =>
        priorityOrder[item.priority] < priorityOrder[highest] ? item.priority : highest,
      'low'
    );

    groups.push({
      supplier,
      items: items.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]),
      totalQuantity: Number(totalQuantity.toFixed(2)),
      totalEstimatedCost: Number(totalEstimatedCost.toFixed(2)),
      priority: highestPriority,
    });
  });

  return groups.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
};

export const createPurchaseDecision = (
  ingredientId: string,
  updates: Partial<Pick<PurchaseDecision, 'adjustedQuantity' | 'status' | 'notes'>>,
  existingDecisions: PurchaseDecision[]
): PurchaseDecision[] => {
  const existingIndex = existingDecisions.findIndex((d) => d.ingredientId === ingredientId);
  const existing = existingDecisions[existingIndex];

  const updatedDecision: PurchaseDecision = {
    ingredientId,
    adjustedQuantity: updates.adjustedQuantity !== undefined ? updates.adjustedQuantity : (existing?.adjustedQuantity ?? null),
    status: updates.status ?? existing?.status ?? 'pending',
    notes: updates.notes ?? existing?.notes,
    updatedAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    const newDecisions = [...existingDecisions];
    newDecisions[existingIndex] = updatedDecision;
    return newDecisions;
  }

  return [...existingDecisions, updatedDecision];
};

export const cleanObsoleteDecisions = (
  decisions: PurchaseDecision[],
  currentSuggestionIds: string[]
): PurchaseDecision[] => {
  return decisions.filter((d) => currentSuggestionIds.includes(d.ingredientId));
};
