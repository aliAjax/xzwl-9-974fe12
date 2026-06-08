import {
  type Order,
  type Craftsman,
  type Recipe,
  type IngredientBatch,
  type StepType,
  type SandboxPriorityStrategy,
  type SandboxResult,
  type SandboxOrderPreview,
  type SandboxStepPreview,
  type SandboxConflict,
  type SandboxCraftsmanLoad,
  type SandboxStepAssignment,
  type ProductionStep,
} from '../types';
import {
  getToday,
  addDaysToDate,
  daysBetween,
  isDateBefore,
  isDateAfter,
  isDateSame,
  formatDateChinese,
} from './dateUtils';
import { analyzeAllCraftsmenWorkload } from './workloadUtils';
import { analyzeCraftsmanWorkload } from './workloadUtils';
import { buildIngredientMaps, calculateEffectiveStock, calculateRequiredQuantity, getIngredientStockInfo } from './ingredientUtils';

const generateConflictId = (): string =>
  `conflict-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const getStepDuration = (stepType: StepType, recipe: Recipe): number => {
  const durations: Record<StepType, number> = {
    kneading: 2,
    shaping: 3,
    drying: recipe.dryingDays,
    cellaring: recipe.cellaringDays,
    packaging: 2,
  };
  return durations[stepType];
};

export const sortOrdersByStrategy = (
  orders: Order[],
  strategy: SandboxPriorityStrategy,
  craftsmen: Craftsman[]
): Order[] => {
  const today = getToday();
  const sorted = [...orders];

  switch (strategy) {
    case 'priority_first': {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return sorted.sort((a, b) => {
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        return a.deliveryDate.localeCompare(b.deliveryDate);
      });
    }

    case 'nearest_delivery_first': {
      return sorted.sort((a, b) => {
        const daysToA = daysBetween(today, a.deliveryDate);
        const daysToB = daysBetween(today, b.deliveryDate);
        if (daysToA !== daysToB) return daysToA - daysToB;
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
    }

    case 'balanced_load': {
      const workloads = analyzeAllCraftsmenWorkload(craftsmen, orders, { daysAhead: 60 });
      const avgLoad = workloads.reduce((sum, w) => sum + w.totalDurationDays, 0) / Math.max(1, workloads.length);

      return sorted.sort((a, b) => {
        const aHasInProgress = a.steps.some((s) => s.status === 'in_progress');
        const bHasInProgress = b.steps.some((s) => s.status === 'in_progress');
        if (aHasInProgress && !bHasInProgress) return -1;
        if (!aHasInProgress && bHasInProgress) return 1;

        const aRemainingSteps = a.steps.filter((s) => s.status !== 'completed').length;
        const bRemainingSteps = b.steps.filter((s) => s.status !== 'completed').length;
        if (aRemainingSteps !== bRemainingSteps) return aRemainingSteps - bRemainingSteps;

        const priorityOrder = { high: 0, medium: 1, low: 2 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }

        const aLoadDeviation = Math.abs(daysBetween(today, a.deliveryDate) - avgLoad);
        const bLoadDeviation = Math.abs(daysBetween(today, b.deliveryDate) - avgLoad);
        return aLoadDeviation - bLoadDeviation;
      });
    }

    default:
      return sorted;
  }
};

const getFirstUncompletedStepIndex = (order: Order): number => {
  const index = order.steps.findIndex((s) => s.status !== 'completed');
  return index < 0 ? order.steps.length : index;
};

const findBestCraftsman = (
  stepType: StepType,
  craftsmen: Craftsman[],
  existingAssignments: SandboxStepAssignment[],
  startDate: string,
  endDate: string
): string => {
  const capableCraftsmen = craftsmen.filter((c) => c.skills.includes(stepType) && c.status !== 'rest');

  if (capableCraftsmen.length === 0) {
    const anyAvailable = craftsmen.find((c) => c.status !== 'rest');
    return anyAvailable?.name || '';
  }

  const craftsmanLoads = capableCraftsmen.map((craftsman) => {
    const overlappingTasks = existingAssignments.filter((a) => {
      if (a.assignee !== craftsman.name) return false;
      if (a.isCompleted) return false;
      const overlaps =
        (isDateBefore(a.startDate, endDate) || isDateSame(a.startDate, endDate)) &&
        (isDateAfter(a.endDate, startDate) || isDateSame(a.endDate, startDate));
      return overlaps;
    });

    const overlapDays = overlappingTasks.reduce((days, task) => {
      const overlapStart = isDateAfter(task.startDate, startDate) ? task.startDate : startDate;
      const overlapEnd = isDateBefore(task.endDate, endDate) ? task.endDate : endDate;
      return days + Math.max(1, daysBetween(overlapStart, overlapEnd) + 1);
    }, 0);

    return {
      craftsman,
      overlapDays,
      totalTasks: overlappingTasks.length,
    };
  });

  craftsmanLoads.sort((a, b) => {
    if (a.overlapDays !== b.overlapDays) return a.overlapDays - b.overlapDays;
    if (a.totalTasks !== b.totalTasks) return a.totalTasks - b.totalTasks;
    return 0;
  });

  return craftsmanLoads[0].craftsman.name;
};

export const detectSkillMismatch = (
  step: SandboxStepPreview,
  craftsmen: Craftsman[]
): SandboxConflict | null => {
  if (step.isCompleted) return null;
  if (!step.newAssignee) return null;

  const craftsman = craftsmen.find((c) => c.name === step.newAssignee);
  if (!craftsman) return null;

  if (!craftsman.skills.includes(step.stepType)) {
    return {
      id: generateConflictId(),
      type: 'skill_mismatch',
      level: 'warning',
      message: `工匠技能不匹配`,
      detail: `${step.newAssignee} 不具备 ${step.stepName} 工序的技能`,
      stepId: step.stepId,
      craftsmanId: craftsman.id,
      suggestion: '建议更换具备对应技能的工匠',
    };
  }

  return null;
};

export const detectOverload = (
  assignments: SandboxStepAssignment[],
  craftsmen: Craftsman[],
  daysAhead = 60
): SandboxConflict[] => {
  const conflicts: SandboxConflict[] = [];
  const today = getToday();
  const endDate = addDaysToDate(today, daysAhead);

  craftsmen.forEach((craftsman) => {
    if (craftsman.status === 'rest') return;

    const dayAssignments = new Map<string, SandboxStepAssignment[]>();

    assignments
      .filter((a) => a.assignee === craftsman.name && !a.isCompleted)
      .forEach((assignment) => {
        let current = assignment.startDate;
        while (
          (isDateBefore(current, assignment.endDate) || isDateSame(current, assignment.endDate)) &&
          (isDateAfter(current, today) || isDateSame(current, today)) &&
          (isDateBefore(current, endDate) || isDateSame(current, endDate))
        ) {
          const existing = dayAssignments.get(current) || [];
          dayAssignments.set(current, [...existing, assignment]);
          current = addDaysToDate(current, 1);
        }
      });

    dayAssignments.forEach((tasks, date) => {
      if (tasks.length >= 3) {
        const level = tasks.length >= 4 ? 'critical' : 'warning';
        const taskDescriptions = tasks
          .map((t) => `${t.stepType} (${t.orderId})`)
          .join('、');

        tasks.forEach((task) => {
          conflicts.push({
            id: generateConflictId(),
            type: 'overload',
            level,
            message: `工匠日负载过高`,
            detail: `${craftsman.name} 在 ${formatDateChinese(date)} 被分配了 ${tasks.length} 个任务：${taskDescriptions}`,
            craftsmanId: craftsman.id,
            orderId: task.orderId,
            stepId: task.stepId,
            suggestion: '建议调整任务分配日期，避免同一日安排过多任务',
          });
        });
      }
    });
  });

  return conflicts;
};

export const detectDeliveryDelay = (
  orderPreview: SandboxOrderPreview
): SandboxConflict | null => {
  if (!orderPreview.isDeliveryDelayed) return null;

  const level = orderPreview.delayDays > 7 ? 'critical' : orderPreview.delayDays > 3 ? 'warning' : 'info';

  return {
    id: generateConflictId(),
    type: 'delivery_delay',
    level,
    message: `订单交付延误`,
    detail: `订单 ${orderPreview.orderNo} 预计 ${formatDateChinese(orderPreview.newCompletionDate)} 完成，比交付期 ${formatDateChinese(orderPreview.deliveryDate)} 晚 ${orderPreview.delayDays} 天`,
    orderId: orderPreview.orderId,
    suggestion: '建议优先安排该订单生产，或与客户沟通调整交付日期',
  };
};

export const detectMaterialShortage = (
  order: Order,
  recipe: Recipe | undefined,
  ingredients: IngredientBatch[],
  newStartDate: string
): SandboxConflict[] => {
  const conflicts: SandboxConflict[] = [];
  if (!recipe) return conflicts;

  const { ingredientIdToName, ingredientNameToBatches } = buildIngredientMaps(ingredients);

  recipe.ingredients.forEach((recipeIng) => {
    const ingredientName = ingredientIdToName.get(recipeIng.ingredientId);
    if (!ingredientName) return;

    const batches = ingredientNameToBatches.get(ingredientName) || [];
    const required = calculateRequiredQuantity(recipeIng.ingredientId, order.quantity, recipe);

    const totalAvailable = calculateEffectiveStock(batches, newStartDate);
    const { earliestExpiry, minDaysToExpiry } = getIngredientStockInfo(batches);

    const gap = required - totalAvailable;

    if (gap > 0) {
      conflicts.push({
        id: generateConflictId(),
        type: 'material_shortage',
        level: gap > required * 0.5 ? 'critical' : 'warning',
        message: `原料 ${ingredientName} 库存不足`,
        detail: `订单 ${order.orderNo} 生产需要 ${required.toFixed(2)}${recipeIng.unit}，但可用库存仅 ${totalAvailable.toFixed(2)}${recipeIng.unit}，缺口 ${gap.toFixed(2)}${recipeIng.unit}`,
        orderId: order.id,
        ingredientId: recipeIng.ingredientId,
        suggestion: '请及时采购，确保开工前原料到位',
      });
    }

    if (minDaysToExpiry <= 30 && minDaysToExpiry > 0) {
      if (isDateAfter(newStartDate, addDaysToDate(earliestExpiry, -7))) {
        conflicts.push({
          id: generateConflictId(),
          type: 'material_shortage',
          level: minDaysToExpiry <= 7 ? 'critical' : 'warning',
          message: `原料 ${ingredientName} 临期风险`,
          detail: `最早批次将于 ${formatDateChinese(earliestExpiry)} 过期，而该订单预计 ${formatDateChinese(newStartDate)} 开工，可能使用临期原料`,
          orderId: order.id,
          ingredientId: recipeIng.ingredientId,
          suggestion: '建议优先使用临期原料生产其他订单，或补充新原料',
        });
      }
    }
  });

  return conflicts;
};

export const generateSandboxSchedule = (
  selectedOrders: Order[],
  strategy: SandboxPriorityStrategy,
  allOrders: Order[],
  craftsmen: Craftsman[],
  recipes: Recipe[],
  ingredients: IngredientBatch[]
): SandboxResult => {
  const today = getToday();

  const sortedOrders = sortOrdersByStrategy(selectedOrders, strategy, craftsmen);

  const allAssignments: SandboxStepAssignment[] = [];

  allOrders.forEach((order) => {
    order.steps.forEach((step) => {
      if (step.status === 'completed') {
        allAssignments.push({
          orderId: order.id,
          stepId: step.id,
          stepType: step.stepType,
          startDate: step.startDate,
          endDate: step.endDate,
          assignee: step.assignee,
          isCompleted: true,
        });
      } else if (step.assignee) {
        allAssignments.push({
          orderId: order.id,
          stepId: step.id,
          stepType: step.stepType,
          startDate: step.startDate,
          endDate: step.endDate,
          assignee: step.assignee,
          isCompleted: false,
        });
      }
    });
  });

  const orderPreviews: SandboxOrderPreview[] = [];

  sortedOrders.forEach((order) => {
    const recipe = recipes.find((r) => r.id === order.recipeId);
    const firstUncompletedIndex = getFirstUncompletedStepIndex(order);

    let currentDate = today;
    if (firstUncompletedIndex > 0) {
      const lastCompletedStep = order.steps[firstUncompletedIndex - 1];
      if (isDateAfter(lastCompletedStep.endDate, today)) {
        currentDate = lastCompletedStep.endDate;
      }
    }

    const stepPreviews: SandboxStepPreview[] = [];
    const orderConflicts: SandboxConflict[] = [];

    order.steps.forEach((step, index) => {
      const isCompleted = step.status === 'completed';
      let newStartDate = step.startDate;
      let newEndDate = step.endDate;
      let newAssignee = step.assignee;

      if (!isCompleted && index >= firstUncompletedIndex) {
        const duration = recipe ? getStepDuration(step.stepType, recipe) : step.durationDays;
        newStartDate = currentDate;
        newEndDate = addDaysToDate(newStartDate, duration);

        newAssignee = findBestCraftsman(
          step.stepType,
          craftsmen,
          allAssignments,
          newStartDate,
          newEndDate
        );

        const existingIndex = allAssignments.findIndex((a) => a.stepId === step.id);
        const newAssignment: SandboxStepAssignment = {
          orderId: order.id,
          stepId: step.id,
          stepType: step.stepType,
          startDate: newStartDate,
          endDate: newEndDate,
          assignee: newAssignee,
          isCompleted: false,
        };

        if (existingIndex >= 0) {
          allAssignments[existingIndex] = newAssignment;
        } else {
          allAssignments.push(newAssignment);
        }

        currentDate = newEndDate;
      }

      const shiftDays = daysBetween(step.startDate, newStartDate);
      const isChanged =
        shiftDays !== 0 ||
        newAssignee !== step.assignee ||
        newEndDate !== step.endDate;

      const stepConflicts: SandboxConflict[] = [];

      const stepPreview: SandboxStepPreview = {
        stepId: step.id,
        stepType: step.stepType,
        stepName: step.stepName,
        originalStartDate: step.startDate,
        originalEndDate: step.endDate,
        originalAssignee: step.assignee,
        originalStatus: step.status,
        newStartDate,
        newEndDate,
        newAssignee,
        isCompleted,
        isChanged: !isCompleted && isChanged,
        shiftDays: isCompleted ? 0 : shiftDays,
        conflicts: stepConflicts,
      };

      if (!isCompleted) {
        const skillConflict = detectSkillMismatch(stepPreview, craftsmen);
        if (skillConflict) {
          stepConflicts.push(skillConflict);
        }
      }

      stepPreviews.push(stepPreview);
    });

    const originalCompletionDate = order.steps[order.steps.length - 1].endDate;
    const newCompletionDate = stepPreviews[stepPreviews.length - 1].newEndDate;
    const isDeliveryDelayed = isDateAfter(newCompletionDate, order.deliveryDate);
    const delayDays = isDeliveryDelayed ? daysBetween(order.deliveryDate, newCompletionDate) : 0;

    const firstUncompletedStep = stepPreviews.find((s) => !s.isCompleted);
    if (firstUncompletedStep && recipe) {
      const materialConflicts = detectMaterialShortage(
        order,
        recipe,
        ingredients,
        firstUncompletedStep.newStartDate
      );
      orderConflicts.push(...materialConflicts);
    }

    const orderPreview: SandboxOrderPreview = {
      orderId: order.id,
      orderNo: order.orderNo,
      customerName: order.customerName,
      priority: order.priority,
      deliveryDate: order.deliveryDate,
      originalCompletionDate,
      newCompletionDate,
      isDeliveryDelayed,
      delayDays,
      steps: stepPreviews,
      conflicts: orderConflicts,
    };

    const deliveryConflict = detectDeliveryDelay(orderPreview);
    if (deliveryConflict) {
      orderPreview.conflicts.push(deliveryConflict);
    }

    orderPreviews.push(orderPreview);
  });

  const overloadConflicts = detectOverload(allAssignments, craftsmen, 90);

  orderPreviews.forEach((orderPreview) => {
    orderPreview.steps.forEach((stepPreview) => {
      const stepOverloads = overloadConflicts.filter(
        (c) => c.stepId === stepPreview.stepId
      );
      stepPreview.conflicts.push(...stepOverloads);
    });

    const orderOverloads = overloadConflicts.filter(
      (c) => c.orderId === orderPreview.orderId
    );
    orderPreview.conflicts.push(...orderOverloads);
  });

  const allConflicts: SandboxConflict[] = [];
  orderPreviews.forEach((op) => {
    allConflicts.push(...op.conflicts);
    op.steps.forEach((sp) => {
      allConflicts.push(...sp.conflicts);
    });
  });
  allConflicts.push(...overloadConflicts.filter((c) => !c.orderId));

  const uniqueConflicts = Array.from(new Map(allConflicts.map((c) => [c.id, c])).values());

  const craftsmenLoad: SandboxCraftsmanLoad[] = craftsmen.map((craftsman) => {
    const originalWorkload = analyzeCraftsmanWorkload(craftsman, allOrders, { daysAhead: 90 });

    const previewOrders: Order[] = orderPreviews.map((op) => ({
      ...allOrders.find((o) => o.id === op.orderId)!,
      steps: op.steps.map((sp) => ({
        ...allOrders.find((o) => o.id === op.orderId)!.steps.find((s) => s.id === sp.stepId)!,
        startDate: sp.newStartDate,
        endDate: sp.newEndDate,
        assignee: sp.newAssignee,
        status: sp.isCompleted ? 'completed' : 'not_started',
      })),
    }));

    const otherOrders = allOrders.filter(
      (o) => !orderPreviews.some((op) => op.orderId === o.id)
    );

    const newWorkload = analyzeCraftsmanWorkload(
      craftsman,
      [...previewOrders, ...otherOrders],
      { daysAhead: 90 }
    );

    const overloadDays: string[] = [];
    const dayCounts = new Map<string, number>();

    allAssignments
      .filter((a) => a.assignee === craftsman.name && !a.isCompleted)
      .forEach((a) => {
        let current = a.startDate;
        while (isDateBefore(current, a.endDate) || isDateSame(current, a.endDate)) {
          dayCounts.set(current, (dayCounts.get(current) || 0) + 1);
          current = addDaysToDate(current, 1);
        }
      });

    dayCounts.forEach((count, date) => {
      if (count >= 3) overloadDays.push(date);
    });

    const craftsmanConflicts = overloadConflicts.filter(
      (c) => c.craftsmanId === craftsman.id
    );

    return {
      craftsmanId: craftsman.id,
      craftsmanName: craftsman.name,
      originalLoad: originalWorkload.totalDurationDays,
      newLoad: newWorkload.totalDurationDays,
      loadChange: newWorkload.totalDurationDays - originalWorkload.totalDurationDays,
      overloadDays,
      conflicts: craftsmanConflicts,
    };
  });

  const ordersWithDelays = orderPreviews.filter((o) => o.isDeliveryDelayed).length;
  const ordersWithConflicts = orderPreviews.filter(
    (o) =>
      o.conflicts.length > 0 || o.steps.some((s) => s.conflicts.length > 0)
  ).length;
  const criticalConflicts = uniqueConflicts.filter((c) => c.level === 'critical').length;
  const warningConflicts = uniqueConflicts.filter((c) => c.level === 'warning').length;

  return {
    orders: orderPreviews,
    craftsmenLoad,
    allConflicts: uniqueConflicts,
    strategy,
    statistics: {
      totalOrders: orderPreviews.length,
      ordersWithDelays,
      ordersWithConflicts,
      totalConflicts: uniqueConflicts.length,
      criticalConflicts,
      warningConflicts,
    },
  };
};

export const applySandboxResult = (
  orders: Order[],
  sandboxResult: SandboxResult
): Order[] => {
  return orders.map((order) => {
    const preview = sandboxResult.orders.find((p) => p.orderId === order.id);
    if (!preview) return order;

    const updatedSteps: ProductionStep[] = order.steps.map((step) => {
      const stepPreview = preview.steps.find((sp) => sp.stepId === step.id);
      if (!stepPreview || stepPreview.isCompleted) return step;

      return {
        ...step,
        startDate: stepPreview.newStartDate,
        endDate: stepPreview.newEndDate,
        assignee: stepPreview.newAssignee,
      };
    });

    const newCurrentStepIndex = updatedSteps.findIndex((s) => s.status === 'in_progress');
    if (newCurrentStepIndex < 0) {
      const firstNotStarted = updatedSteps.findIndex((s) => s.status === 'not_started');
      return {
        ...order,
        steps: updatedSteps,
        currentStepIndex: firstNotStarted >= 0 ? firstNotStarted - 1 : order.currentStepIndex,
      };
    }

    return {
      ...order,
      steps: updatedSteps,
    };
  });
};
