import {
  type Craftsman,
  type Order,
  type ProductionStep,
  type StepType,
  type CraftsmanWorkload,
  type WorkloadAnalysisOptions,
} from '../types';
import { getToday, isDateAfter, isDateBefore, addDaysToDate } from './dateUtils';

export const getWorkloadLevel = (totalDurationDays: number): 'low' | 'medium' | 'high' => {
  if (totalDurationDays <= 7) return 'low';
  if (totalDurationDays <= 14) return 'medium';
  return 'high';
};

export const getWorkloadLevelColor = (level: 'low' | 'medium' | 'high'): string => {
  switch (level) {
    case 'low':
      return '#10b981';
    case 'medium':
      return '#f59e0b';
    case 'high':
      return '#ef4444';
  }
};

export const getWorkloadLevelLabel = (level: 'low' | 'medium' | 'high'): string => {
  switch (level) {
    case 'low':
      return '低负载';
    case 'medium':
      return '中负载';
    case 'high':
      return '高负载';
  }
};

export const analyzeCraftsmanWorkload = (
  craftsman: Craftsman,
  orders: Order[],
  options: WorkloadAnalysisOptions = {}
): CraftsmanWorkload => {
  const { daysAhead = 7, requiredSkill } = options;
  const today = getToday();
  const endDate = addDaysToDate(today, daysAhead);

  const tasks: { order: Order; step: ProductionStep }[] = [];
  const stepTypesSet = new Set<StepType>();
  let totalDurationDays = 0;

  orders.forEach((order) => {
    order.steps.forEach((step) => {
      if (step.assignee !== craftsman.name) return;
      if (step.status === 'completed') return;

      const stepStartsBeforeEnd = !isDateAfter(step.startDate, endDate);
      const stepEndsAfterToday = !isDateBefore(step.endDate, today);

      if (stepStartsBeforeEnd && stepEndsAfterToday) {
        tasks.push({ order, step });
        stepTypesSet.add(step.stepType);

        const overlapStart = isDateAfter(step.startDate, today) ? step.startDate : today;
        const overlapEnd = isDateBefore(step.endDate, endDate) ? step.endDate : endDate;

        const start = new Date(overlapStart);
        const end = new Date(overlapEnd);
        const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        totalDurationDays += Math.max(1, diffDays);
      }
    });
  });

  const stepTypes = Array.from(stepTypesSet);
  const workloadLevel = getWorkloadLevel(totalDurationDays);
  const isResting = craftsman.status === 'rest';
  const hasMatchingSkill = requiredSkill ? craftsman.skills.includes(requiredSkill) : true;

  return {
    craftsmanId: craftsman.id,
    craftsmanName: craftsman.name,
    taskCount: tasks.length,
    totalDurationDays,
    stepTypes,
    tasks,
    workloadLevel,
    isResting,
    hasMatchingSkill,
  };
};

export const analyzeAllCraftsmenWorkload = (
  craftsmen: Craftsman[],
  orders: Order[],
  options: WorkloadAnalysisOptions = {}
): CraftsmanWorkload[] => {
  return craftsmen.map((craftsman) => analyzeCraftsmanWorkload(craftsman, orders, options));
};

export const sortCraftsmenForAssignment = (workloads: CraftsmanWorkload[]): CraftsmanWorkload[] => {
  return [...workloads].sort((a, b) => {
    if (a.isResting && !b.isResting) return 1;
    if (!a.isResting && b.isResting) return -1;

    if (a.hasMatchingSkill && !b.hasMatchingSkill) return -1;
    if (!a.hasMatchingSkill && b.hasMatchingSkill) return 1;

    const levelOrder = { low: 0, medium: 1, high: 2 };
    const aLevel = levelOrder[a.workloadLevel];
    const bLevel = levelOrder[b.workloadLevel];
    if (aLevel !== bLevel) return aLevel - bLevel;

    if (a.totalDurationDays !== b.totalDurationDays) return a.totalDurationDays - b.totalDurationDays;

    return a.taskCount - b.taskCount;
  });
};
