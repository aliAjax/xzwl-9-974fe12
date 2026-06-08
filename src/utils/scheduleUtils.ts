import { Order, ProductionStep, StepAdjustPreview, ScheduleAdjustPreview, Warning, Recipe, WarningDiff, DeliveryImpactSummary } from '../types';
import { addDaysToDate, daysBetween, isDateBefore, isDateSame } from './dateUtils';
import { calculateScheduleAllWarnings, getWarningKey } from './warningUtils';

const calculateWarningDiff = (original: Warning[], updated: Warning[]): WarningDiff => {
  const originalKeys = new Map(original.map((w) => [getWarningKey(w), w]));
  const updatedKeys = new Map(updated.map((w) => [getWarningKey(w), w]));

  const added: Warning[] = [];
  const removed: Warning[] = [];
  const unchanged: Warning[] = [];

  updated.forEach((warning) => {
    const key = getWarningKey(warning);
    if (!originalKeys.has(key)) {
      added.push(warning);
    } else {
      unchanged.push(warning);
    }
  });

  original.forEach((warning) => {
    const key = getWarningKey(warning);
    if (!updatedKeys.has(key)) {
      removed.push(warning);
    }
  });

  return { added, removed, unchanged };
};

const calculateDeliveryImpact = (
  order: Order,
  previews: StepAdjustPreview[]
): DeliveryImpactSummary => {
  if (!order?.steps?.length || !previews?.length) {
    return {
      newCompletionDate: order?.deliveryDate || '',
      originalCompletionDate: order?.deliveryDate || '',
      deliveryDate: order?.deliveryDate || '',
      daysRelativeToDelivery: 0,
      isAheadOfDelivery: false,
      isOnSchedule: true,
      completionShiftDays: 0,
      affectedSteps: [],
    };
  }

  const originalLastStep = order.steps[order.steps.length - 1];
  const newLastStep = previews[previews.length - 1];

  const originalCompletionDate = originalLastStep.endDate;
  const newCompletionDate = newLastStep.newEndDate;
  const deliveryDate = order.deliveryDate;

  const daysRelativeToDelivery = daysBetween(deliveryDate, newCompletionDate);
  const isAheadOfDelivery = daysRelativeToDelivery < 0;
  const isOnSchedule = isDateSame(newCompletionDate, deliveryDate) || daysRelativeToDelivery < 0;
  const completionShiftDays = daysBetween(originalCompletionDate, newCompletionDate);

  const affectedSteps = previews
    .filter((p) => p.isChanged || p.isAffected)
    .map((p) => {
      const step = order.steps.find((s) => s.id === p.stepId);
      return {
        stepId: p.stepId,
        stepName: step?.stepName || '',
        shiftDays: p.shiftDays,
        isChanged: p.isChanged,
      };
    })
    .filter((s) => s.stepName);

  return {
    newCompletionDate,
    originalCompletionDate,
    deliveryDate,
    daysRelativeToDelivery,
    isAheadOfDelivery,
    isOnSchedule,
    completionShiftDays,
    affectedSteps,
  };
};

export const calculateStepAdjustPreview = (
  order: Order,
  stepId: string,
  updates: { startDate?: string; durationDays?: number },
  recipes: Recipe[]
): ScheduleAdjustPreview => {
  const stepIndex = order.steps.findIndex((s) => s.id === stepId);
  if (stepIndex < 0) {
    const defaultSteps = order.steps.map((step) => ({
      stepId: step.id,
      originalStartDate: step.startDate,
      originalEndDate: step.endDate,
      originalDurationDays: step.durationDays,
      newStartDate: step.startDate,
      newEndDate: step.endDate,
      newDurationDays: step.durationDays,
      isChanged: false,
      isAffected: false,
      shiftDays: 0,
    }));

    const recipe = recipes.find((r) => r.id === order.recipeId);
    const originalWarnings: Warning[] = calculateScheduleAllWarnings(order, recipe);

    return {
      orderId: order.id,
      steps: defaultSteps,
      newWarnings: originalWarnings,
      originalWarnings,
      totalDelayDays: 0,
      warningDiff: { added: [], removed: [], unchanged: originalWarnings },
      deliveryImpact: calculateDeliveryImpact(order, defaultSteps),
    };
  }

  const adjustedStep = order.steps[stepIndex];
  const newStartDate = updates.startDate || adjustedStep.startDate;
  const newDurationDays = updates.durationDays || adjustedStep.durationDays;
  const newEndDate = addDaysToDate(newStartDate, newDurationDays);

  const previews: StepAdjustPreview[] = [];
  for (let index = 0; index < order.steps.length; index++) {
    const step = order.steps[index];

    if (index < stepIndex) {
      previews.push({
        stepId: step.id,
        originalStartDate: step.startDate,
        originalEndDate: step.endDate,
        originalDurationDays: step.durationDays,
        newStartDate: step.startDate,
        newEndDate: step.endDate,
        newDurationDays: step.durationDays,
        isChanged: false,
        isAffected: false,
        shiftDays: 0,
      });
    } else if (index === stepIndex) {
      const isChanged =
        updates.startDate !== undefined || updates.durationDays !== undefined;
      previews.push({
        stepId: step.id,
        originalStartDate: step.startDate,
        originalEndDate: step.endDate,
        originalDurationDays: step.durationDays,
        newStartDate,
        newEndDate,
        newDurationDays,
        isChanged,
        isAffected: false,
        shiftDays: daysBetween(step.startDate, newStartDate),
      });
    } else {
      const prevPreview = previews[index - 1];
      const shiftedStartDate = prevPreview.newEndDate;
      const shiftedEndDate = addDaysToDate(shiftedStartDate, step.durationDays);
      const shiftDays = daysBetween(step.startDate, shiftedStartDate);

      previews.push({
        stepId: step.id,
        originalStartDate: step.startDate,
        originalEndDate: step.endDate,
        originalDurationDays: step.durationDays,
        newStartDate: shiftedStartDate,
        newEndDate: shiftedEndDate,
        newDurationDays: step.durationDays,
        isChanged: false,
        isAffected: true,
        shiftDays,
      });
    }
  }

  const adjustedOrder: Order = {
    ...order,
    steps: order.steps.map((step) => {
      const preview = previews.find((p) => p.stepId === step.id)!;
      return {
        ...step,
        startDate: preview.newStartDate,
        endDate: preview.newEndDate,
        durationDays: preview.newDurationDays,
      };
    }),
  };

  const recipe = recipes.find((r) => r.id === order.recipeId);
  const originalWarnings: Warning[] = calculateScheduleAllWarnings(order, recipe);
  const newWarnings: Warning[] = calculateScheduleAllWarnings(adjustedOrder, recipe);

  const lastStep = previews[previews.length - 1];
  const totalDelayDays = isDateBefore(order.deliveryDate, lastStep.newEndDate)
    ? daysBetween(order.deliveryDate, lastStep.newEndDate)
    : 0;

  const warningDiff = calculateWarningDiff(originalWarnings, newWarnings);
  const deliveryImpact = calculateDeliveryImpact(order, previews);

  return {
    orderId: order.id,
    steps: previews,
    newWarnings,
    originalWarnings,
    totalDelayDays,
    warningDiff,
    deliveryImpact,
  };
};

export const applyStepAdjustment = (
  order: Order,
  stepId: string,
  updates: { startDate?: string; durationDays?: number }
): ProductionStep[] => {
  const stepIndex = order.steps.findIndex((s) => s.id === stepId);
  if (stepIndex < 0) return order.steps;

  const adjustedStep = order.steps[stepIndex];
  const newStartDate = updates.startDate || adjustedStep.startDate;
  const newDurationDays = updates.durationDays || adjustedStep.durationDays;

  let currentEndDate = addDaysToDate(newStartDate, newDurationDays);

  return order.steps.map((step, index) => {
    if (index < stepIndex) {
      return step;
    }

    if (index === stepIndex) {
      const updatedStep = {
        ...step,
        startDate: newStartDate,
        endDate: currentEndDate,
        durationDays: newDurationDays,
      };
      return updatedStep;
    }

    const newStepStart = currentEndDate;
    const newStepEnd = addDaysToDate(newStepStart, step.durationDays);
    currentEndDate = newStepEnd;

    return {
      ...step,
      startDate: newStepStart,
      endDate: newStepEnd,
    };
  });
};

export const validateStepAdjustment = (
  order: Order,
  stepId: string,
  updates: { startDate?: string; durationDays?: number }
): { valid: boolean; message?: string } => {
  const stepIndex = order.steps.findIndex((s) => s.id === stepId);
  if (stepIndex < 0) {
    return { valid: false, message: '工序不存在' };
  }

  const step = order.steps[stepIndex];

  if (step.status === 'completed') {
    return { valid: false, message: '已完成的工序无法调整' };
  }

  if (updates.durationDays !== undefined && updates.durationDays <= 0) {
    return { valid: false, message: '持续天数必须大于0' };
  }

  if (updates.startDate !== undefined && stepIndex > 0) {
    const prevStep = order.steps[stepIndex - 1];
    if (isDateBefore(updates.startDate, prevStep.endDate)) {
      return {
        valid: false,
        message: `开始日期不能早于上一工序（${prevStep.stepName}）的结束日期`,
      };
    }
  }

  return { valid: true };
};

export const getStepAdjustTooltip = (preview: StepAdjustPreview): string => {
  if (preview.isChanged) {
    return `已调整：${preview.shiftDays > 0 ? '延后' : '提前'}${Math.abs(preview.shiftDays)}天`;
  }
  if (preview.isAffected) {
    return `联动${preview.shiftDays > 0 ? '延后' : '提前'}${Math.abs(preview.shiftDays)}天`;
  }
  return '';
};
