import { useState, useMemo, useCallback } from 'react';
import { Order, Recipe, StepUpdateData, ScheduleAdjustPreview } from '../types';
import {
  calculateStepAdjustPreview,
  validateStepAdjustment,
} from '../utils/scheduleUtils';
import { calculateScheduleAllWarnings } from '../utils/warningUtils';

interface UseScheduleAdjustOptions {
  order: Order | undefined;
  recipes: Recipe[];
  onApply: (orderId: string, stepId: string, updates: StepUpdateData) => void;
  onClose: () => void;
}

export const useScheduleAdjust = ({
  order,
  recipes,
  onApply,
  onClose,
}: UseScheduleAdjustOptions) => {
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [pendingUpdates, setPendingUpdates] = useState<{
    stepId: string;
    updates: StepUpdateData;
  } | null>(null);

  const selectedStep = useMemo(() => {
    if (!order || !selectedStepId) return null;
    return order.steps.find((s) => s.id === selectedStepId) || null;
  }, [order, selectedStepId]);

  const preview: ScheduleAdjustPreview | null = useMemo(() => {
    if (!order) return null;

    if (pendingUpdates) {
      return calculateStepAdjustPreview(
        order,
        pendingUpdates.stepId,
        pendingUpdates.updates,
        recipes
      );
    }

    const recipe = recipes.find((r) => r.id === order.recipeId);
    const originalWarnings = calculateScheduleAllWarnings(order, recipe);

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

    const lastStep = order.steps[order.steps.length - 1];

    return {
      orderId: order.id,
      steps: defaultSteps,
      newWarnings: originalWarnings,
      originalWarnings,
      totalDelayDays: 0,
      warningDiff: { added: [], removed: [], unchanged: originalWarnings },
      deliveryImpact: {
        newCompletionDate: lastStep.endDate,
        originalCompletionDate: lastStep.endDate,
        deliveryDate: order.deliveryDate,
        daysRelativeToDelivery: 0,
        isAheadOfDelivery: false,
        isOnSchedule: true,
        completionShiftDays: 0,
        affectedSteps: [],
      },
    };
  }, [order, pendingUpdates, recipes]);

  const hasChanges = useMemo(() => {
    if (!preview) return false;
    return preview.steps.some((s) => s.isChanged || s.isAffected);
  }, [preview]);

  const selectStep = useCallback((stepId: string) => {
    setSelectedStepId(stepId);
    setPendingUpdates(null);
  }, []);

  const updateStepStartDate = useCallback(
    (stepId: string, startDate: string) => {
      if (!order) return;

      const existingUpdates = pendingUpdates?.stepId === stepId ? pendingUpdates.updates : {};
      const newUpdates: StepUpdateData = {
        ...existingUpdates,
        startDate,
      };

      const validation = validateStepAdjustment(order, stepId, newUpdates);
      if (!validation.valid) {
        return { success: false, message: validation.message };
      }

      setPendingUpdates({ stepId, updates: newUpdates });
      return { success: true };
    },
    [order, pendingUpdates]
  );

  const updateStepDuration = useCallback(
    (stepId: string, durationDays: number) => {
      if (!order) return;

      const existingUpdates = pendingUpdates?.stepId === stepId ? pendingUpdates.updates : {};
      const newUpdates: StepUpdateData = {
        ...existingUpdates,
        durationDays,
      };

      const validation = validateStepAdjustment(order, stepId, newUpdates);
      if (!validation.valid) {
        return { success: false, message: validation.message };
      }

      setPendingUpdates({ stepId, updates: newUpdates });
      return { success: true };
    },
    [order, pendingUpdates]
  );

  const resetChanges = useCallback(() => {
    setPendingUpdates(null);
    setSelectedStepId(null);
  }, []);

  const applyChanges = useCallback(() => {
    if (!order || !pendingUpdates) return { success: false };

    onApply(order.id, pendingUpdates.stepId, pendingUpdates.updates);
    setPendingUpdates(null);
    setSelectedStepId(null);
    onClose();

    return { success: true };
  }, [order, pendingUpdates, onApply, onClose]);

  const getStepPreview = useCallback(
    (stepId: string) => {
      return preview?.steps.find((s) => s.stepId === stepId) || null;
    },
    [preview]
  );

  return {
    selectedStepId,
    selectedStep,
    preview,
    hasChanges,
    pendingUpdates,
    selectStep,
    updateStepStartDate,
    updateStepDuration,
    resetChanges,
    applyChanges,
    getStepPreview,
  };
};
