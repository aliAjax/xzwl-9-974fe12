import { type Order, type Recipe, type IngredientBatch, type OrderMaterialGap, type MaterialGapDetail, type Priority } from '../types';
import { daysBetween, getToday } from './dateUtils';

export interface IngredientStockInfo {
  totalEffectiveStock: number;
  earliestExpiry: string;
  minDaysToExpiry: number;
  unit: string;
}

export interface IngredientMaps {
  ingredientIdToName: Map<string, string>;
  ingredientNameToBatches: Map<string, IngredientBatch[]>;
}

export const calculateEffectiveStock = (
  batches: IngredientBatch[],
  referenceDate: string = getToday()
): number => {
  return batches.reduce((sum, batch) => {
    const daysToExpiry = daysBetween(referenceDate, batch.expiryDate);
    if (daysToExpiry <= 0) return sum;
    if (daysToExpiry <= 7) return sum + batch.quantity * 0.3;
    if (daysToExpiry <= 30) return sum + batch.quantity * 0.7;
    return sum + batch.quantity;
  }, 0);
};

export const buildIngredientMaps = (
  ingredients: IngredientBatch[]
): IngredientMaps => {
  const ingredientIdToName = new Map<string, string>();
  const ingredientNameToBatches = new Map<string, IngredientBatch[]>();

  ingredients.forEach((ing) => {
    ingredientIdToName.set(ing.id, ing.name);
    const existing = ingredientNameToBatches.get(ing.name) || [];
    ingredientNameToBatches.set(ing.name, [...existing, ing]);
  });

  return { ingredientIdToName, ingredientNameToBatches };
};

export const getIngredientStockInfo = (
  batches: IngredientBatch[],
  referenceDate: string = getToday()
): IngredientStockInfo => {
  const today = getToday();
  let minDaysToExpiry = Infinity;
  let earliestExpiry = '';
  let unit = 'g';

  batches.forEach((batch) => {
    const daysToExpiry = daysBetween(today, batch.expiryDate);
    if (daysToExpiry < minDaysToExpiry) {
      minDaysToExpiry = daysToExpiry;
      earliestExpiry = batch.expiryDate;
    }
    if (batch.unit) {
      unit = batch.unit;
    }
  });

  return {
    totalEffectiveStock: calculateEffectiveStock(batches, referenceDate),
    earliestExpiry,
    minDaysToExpiry,
    unit,
  };
};

export const calculateIngredientDemand = (
  ingredientName: string,
  ingredientIdToName: Map<string, string>,
  orders: Order[],
  recipes: Recipe[],
  today: string = getToday()
): {
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
} => {
  let total = 0;
  const relatedOrders: {
    orderId: string;
    orderNo: string;
    customerName: string;
    quantity: number;
    priority: Priority;
    deliveryDate: string;
    daysToDelivery: number;
  }[] = [];

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

export const calculateRequiredQuantity = (
  ingredientId: string,
  orderQuantity: number,
  recipe: Recipe
): number => {
  const matchingIngredients = recipe.ingredients.filter(
    (ri) => ri.ingredientId === ingredientId
  );
  const totalRecipeQuantity = matchingIngredients.reduce((sum, ri) => sum + ri.quantity, 0);
  return (totalRecipeQuantity / 100) * orderQuantity;
};

export const getOrderMaterialGap = (
  orderId: string,
  orders: Order[],
  recipes: Recipe[],
  ingredients: IngredientBatch[]
): OrderMaterialGap | null => {
  const order = orders.find((o) => o.id === orderId);
  if (!order) return null;

  const recipe = recipes.find((r) => r.id === order.recipeId);
  if (!recipe) return null;

  const today = getToday();
  const { ingredientIdToName, ingredientNameToBatches } = buildIngredientMaps(ingredients);

  const gaps: MaterialGapDetail[] = [];

  recipe.ingredients.forEach((ri) => {
    const ingredientName = ingredientIdToName.get(ri.ingredientId);
    if (!ingredientName) return;

    const required = calculateRequiredQuantity(ri.ingredientId, order.quantity, recipe);
    const batches = ingredientNameToBatches.get(ingredientName) || [];
    const stockInfo = getIngredientStockInfo(batches, today);
    const available = stockInfo.totalEffectiveStock;

    const gap = required - available;
    if (gap > 0) {
      const relatedOrders = orders
        .filter((o) => o.status !== 'completed' && o.id !== orderId)
        .map((o) => {
          const r = recipes.find((rec) => rec.id === o.recipeId);
          if (!r) return null;
          const ing = r.ingredients.find((i) => i.ingredientId === ri.ingredientId);
          if (!ing) return null;
          const reqQty = calculateRequiredQuantity(ri.ingredientId, o.quantity, r);
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
        unit: stockInfo.unit,
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
};
