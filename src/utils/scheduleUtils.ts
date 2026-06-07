import { Order, ProductionStep, StepAdjustPreview, ScheduleAdjustPreview, Warning, Recipe, STEP_ORDER } from '../types';
import { addDaysToDate, daysBetween, isDateBefore } from './dateUtils';
import { calculateDryingWarnings, calculateDeliveryWarnings } from './warningUtils';

export const calculateStepAdjustPreview = (
  order: Order,
  stepId: string,
  updates: { startDate?: string; durationDays?: number },
  recipes: Recipe[]
): ScheduleAdjustPreview => {
  const stepIndex = order.steps.findIndex((s) => s.id === stepId);
  if (stepIndex < 0) {
    return {
      orderId: order.id,
      steps: order.steps.map((step) => ({
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
      })),
      newWarnings: [],
      originalWarnings: [],
      totalDelayDays: 0,
    };
  }

  const adjustedStep = order.steps[stepIndex];
  const newStartDate = updates.startDate || adjustedStep.startDate;
  const newDurationDays = updates.durationDays || adjustedStep.durationDays;
  const newEndDate = addDaysToDate(newStartDate, newDurationDays);

  const previews: StepAdjustPreview[] = order.steps.map((step, index) => {
    if (index < stepIndex) {
      return {
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
      };
    }

    if (index === stepIndex) {
      const isChanged =
        updates.startDate !== undefined || updates.durationDays !== undefined;
      return {
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
      };
    }

    const prevPreview = previews[index - 1];
    const shiftedStartDate = prevPreview.newEndDate;
    const shiftedEndDate = addDaysToDate(shiftedStartDate, step.durationDays);
    const shiftDays = daysBetween(step.startDate, shiftedStartDate);

    return {
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
    };
  });

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
  const originalWarnings: Warning[] = [
    ...calculateDryingWarnings(order, recipe),
    ...calculateDeliveryWarnings(order),
  ];

  const newWarnings: Warning[] = [
    ...calculateDryingWarnings(adjustedOrder, recipe),
    ...calculateDeliveryWarnings(adjustedOrder),
  ];

  const lastStep = previews[previews.length - 1];
  const totalDelayDays = isDateBefore(order.deliveryDate, lastStep.newEndDate)
    ? daysBetween(order.deliveryDate, lastStep.newEndDate)
    : 0;

  return {
    orderId: order.id,
    steps: previews,
    newWarnings,
    originalWarnings,
    totalDelayDays,
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
