import { Order, IngredientBatch, Warning, WarningLevel, Recipe, STEP_ORDER } from '../types';
import { getToday, daysBetween, isDateBefore, addDaysToDate, formatDateChinese } from './dateUtils';
import { formatISO } from 'date-fns';

const generateId = (): string => `warn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const calculateDryingWarnings = (order: Order, recipe: Recipe | undefined): Warning[] => {
  const warnings: Warning[] = [];

  if (!recipe) return warnings;

  const dryingStep = order.steps.find((s) => s.stepType === 'drying');
  if (!dryingStep) return warnings;

  const dryingEndDate = dryingStep.endDate;
  const remainingSteps = order.steps.filter(
    (s) => STEP_ORDER.indexOf(s.stepType) > STEP_ORDER.indexOf('drying')
  );
  const remainingDays = remainingSteps.reduce((sum, s) => sum + s.durationDays, 0);

  const earliestDeliveryDate = addDaysToDate(dryingEndDate, remainingDays);

  if (isDateBefore(order.deliveryDate, earliestDeliveryDate)) {
    const delayDays = daysBetween(order.deliveryDate, earliestDeliveryDate);
    const level: WarningLevel = delayDays > 5 ? 'critical' : 'warning';

    warnings.push({
      id: generateId(),
      type: 'drying',
      level,
      message: `订单 ${order.orderNo} 的阴干周期预计 ${formatDateChinese(dryingEndDate)} 完成，加上后续工序${remainingDays}天，预计 ${formatDateChinese(earliestDeliveryDate)} 完成，比交付期 ${formatDateChinese(order.deliveryDate)} 晚 ${delayDays} 天`,
      relatedId: order.id,
      relatedType: 'order',
      createdAt: formatISO(new Date(), { representation: 'complete' }),
      isResolved: false,
    });
  }

  return warnings;
};

export const calculateDeliveryWarnings = (order: Order): Warning[] => {
  const warnings: Warning[] = [];

  const daysToDelivery = daysBetween(getToday(), order.deliveryDate);

  const incompleteSteps = order.steps.filter((s) => s.status !== 'completed');

  const currentStep = order.steps.find((s) => s.status === 'in_progress');
  if (currentStep) {
    const elapsedDays = daysBetween(currentStep.startDate, getToday());
    const remainingInCurrent = Math.max(0, currentStep.durationDays - elapsedDays);
    const otherSteps = incompleteSteps.filter((s) => s.id !== currentStep.id);
    const adjustedRemaining = remainingInCurrent + otherSteps.reduce((sum, s) => sum + s.durationDays, 0);

    if (adjustedRemaining > daysToDelivery) {
      const delayDays = adjustedRemaining - daysToDelivery;
      const level: WarningLevel = delayDays > 7 ? 'critical' : delayDays > 3 ? 'warning' : 'info';

      warnings.push({
        id: generateId(),
        type: 'delivery',
        level,
        message: `订单 ${order.orderNo} 预计还需 ${adjustedRemaining} 天完成，距交付期 ${formatDateChinese(order.deliveryDate)} 仅剩 ${daysToDelivery} 天，可能延误 ${delayDays} 天`,
        relatedId: order.id,
        relatedType: 'order',
        createdAt: formatISO(new Date(), { representation: 'complete' }),
        isResolved: false,
      });
    }
  }

  if (daysToDelivery <= 3 && order.status !== 'completed') {
    const level: WarningLevel = daysToDelivery <= 1 ? 'critical' : 'warning';
    warnings.push({
      id: generateId(),
      type: 'delivery',
      level,
      message: `订单 ${order.orderNo} 距交付期仅剩 ${daysToDelivery} 天，请加紧生产`,
      relatedId: order.id,
      relatedType: 'order',
      createdAt: formatISO(new Date(), { representation: 'complete' }),
      isResolved: false,
    });
  }

  return warnings;
};

export const calculateScheduleDeliveryWarnings = (order: Order): Warning[] => {
  const warnings: Warning[] = [];

  const lastStep = order.steps[order.steps.length - 1];
  const plannedCompletionDate = lastStep.endDate;
  const deliveryDate = order.deliveryDate;

  const delayDays = daysBetween(deliveryDate, plannedCompletionDate);

  if (delayDays > 0) {
    const level: WarningLevel = delayDays > 7 ? 'critical' : delayDays > 3 ? 'warning' : 'info';

    warnings.push({
      id: generateId(),
      type: 'delivery',
      level,
      message: `订单 ${order.orderNo} 按计划 ${formatDateChinese(plannedCompletionDate)} 完成，比交付期 ${formatDateChinese(deliveryDate)} 晚 ${delayDays} 天`,
      relatedId: order.id,
      relatedType: 'order',
      createdAt: formatISO(new Date(), { representation: 'complete' }),
      isResolved: false,
    });
  }

  return warnings;
};

export const calculateScheduleAllWarnings = (order: Order, recipe: Recipe | undefined): Warning[] => {
  return [
    ...calculateDryingWarnings(order, recipe),
    ...calculateScheduleDeliveryWarnings(order),
  ];
};

export const calculateIngredientWarnings = (ingredient: IngredientBatch): Warning[] => {
  const warnings: Warning[] = [];

  const stockRatio = ingredient.quantity / ingredient.safetyStock;

  if (stockRatio < 0.3) {
    warnings.push({
      id: generateId(),
      type: 'ingredient',
      level: 'critical',
      message: `原料 ${ingredient.name} (批次 ${ingredient.batchNo}) 库存仅剩 ${ingredient.quantity}${ingredient.unit}，低于安全库存的 30%，请及时采购`,
      relatedId: ingredient.id,
      relatedType: 'ingredient',
      createdAt: formatISO(new Date(), { representation: 'complete' }),
      isResolved: false,
    });
  } else if (stockRatio < 0.5) {
    warnings.push({
      id: generateId(),
      type: 'ingredient',
      level: 'warning',
      message: `原料 ${ingredient.name} (批次 ${ingredient.batchNo}) 库存为 ${ingredient.quantity}${ingredient.unit}，低于安全库存的 50%，建议安排采购`,
      relatedId: ingredient.id,
      relatedType: 'ingredient',
      createdAt: formatISO(new Date(), { representation: 'complete' }),
      isResolved: false,
    });
  }

  const daysToExpiry = daysBetween(getToday(), ingredient.expiryDate);

  if (daysToExpiry <= 30) {
    const level: WarningLevel = daysToExpiry <= 7 ? 'critical' : 'warning';
    warnings.push({
      id: generateId(),
      type: 'inventory',
      level,
      message: `原料 ${ingredient.name} (批次 ${ingredient.batchNo}) 将于 ${formatDateChinese(ingredient.expiryDate)} 到期，距今天还有 ${daysToExpiry} 天，请尽快使用`,
      relatedId: ingredient.id,
      relatedType: 'ingredient',
      createdAt: formatISO(new Date(), { representation: 'complete' }),
      isResolved: false,
    });
  }

  return warnings;
};

export const calculateAllWarnings = (
  orders: Order[],
  ingredients: IngredientBatch[],
  recipes: Recipe[]
): Warning[] => {
  let allWarnings: Warning[] = [];

  orders.forEach((order) => {
    const recipe = recipes.find((r) => r.id === order.recipeId);
    if (order.status !== 'completed') {
      allWarnings = [...allWarnings, ...calculateDryingWarnings(order, recipe)];
      allWarnings = [...allWarnings, ...calculateDeliveryWarnings(order)];
    }
  });

  ingredients.forEach((ingredient) => {
    allWarnings = [...allWarnings, ...calculateIngredientWarnings(ingredient)];
  });

  return allWarnings.sort((a, b) => {
    const levelOrder = { critical: 0, warning: 1, info: 2 };
    return levelOrder[a.level] - levelOrder[b.level];
  });
};

export const getUnresolvedWarnings = (warnings: Warning[]): Warning[] => {
  return warnings.filter((w) => !w.isResolved);
};

export const getWarningsByType = (warnings: Warning[], type: Warning['type']): Warning[] => {
  return warnings.filter((w) => w.type === type && !w.isResolved);
};

const getWarningSubtype = (warning: Warning): string => {
  if (warning.type === 'delivery') {
    if (warning.message.includes('预计还需')) return 'schedule-delay';
    if (warning.message.includes('距交付期仅剩')) return 'deadline-near';
    if (warning.message.includes('按计划')) return 'plan-delay';
  }

  if (warning.type === 'ingredient') return 'stock-low';
  if (warning.type === 'inventory') return 'expiry-near';
  if (warning.type === 'drying') return 'drying-cycle';

  return warning.message;
};

export const getWarningKey = (warning: Warning): string => {
  return [
    warning.type,
    warning.relatedType,
    warning.relatedId,
    warning.level,
    getWarningSubtype(warning),
  ].join('-');
};

export const mergeWarningsWithResolvedState = (
  newWarnings: Warning[],
  existingResolvedWarnings: Warning[]
): Warning[] => {
  const resolvedKeys = new Set(existingResolvedWarnings.map(getWarningKey));

  const merged = newWarnings.map((warning) => {
    const key = getWarningKey(warning);
    if (resolvedKeys.has(key)) {
      return { ...warning, isResolved: true };
    }
    return warning;
  });

  const remainingResolved = existingResolvedWarnings.filter((w) => {
    const key = getWarningKey(w);
    return !merged.some((m) => getWarningKey(m) === key);
  });

  return [...remainingResolved, ...merged].sort((a, b) => {
    const levelOrder = { critical: 0, warning: 1, info: 2 };
    return levelOrder[a.level] - levelOrder[b.level];
  });
};
