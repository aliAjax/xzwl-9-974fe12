import { describe, it, expect } from 'vitest';
import { calculateStepAdjustPreview, applyStepAdjustment, validateStepAdjustment } from './scheduleUtils';
import {
  createOrderWithMultipleSteps,
  createMockRecipe,
  createMockOrder,
  TEST_TODAY,
} from '../test/testHelpers';
import { addDaysToDate } from './dateUtils';
import type { StepType } from '../types';

describe('scheduleUtils', () => {
  const recipes = [createMockRecipe()];

  describe('calculateStepAdjustPreview', () => {
    it('应该返回不变的预览当步骤ID不存在时', () => {
      const order = createOrderWithMultipleSteps();
      const result = calculateStepAdjustPreview(order, 'non-existent-step', {}, recipes);

      expect(result.orderId).toBe(order.id);
      expect(result.steps.every(s => !s.isChanged && !s.isAffected)).toBe(true);
      expect(result.totalDelayDays).toBe(0);
    });

    it('应该正确计算工序延后的联动效果', () => {
      const order = createOrderWithMultipleSteps();
      const stepToAdjust = order.steps[1];
      const newStartDate = addDaysToDate(stepToAdjust.startDate, 5);

      const result = calculateStepAdjustPreview(
        order,
        stepToAdjust.id,
        { startDate: newStartDate },
        recipes
      );

      expect(result.steps[0].isChanged).toBe(false);
      expect(result.steps[0].isAffected).toBe(false);
      expect(result.steps[1].isChanged).toBe(true);
      expect(result.steps[1].shiftDays).toBe(5);

      for (let i = 2; i < result.steps.length; i++) {
        expect(result.steps[i].isAffected).toBe(true);
        expect(result.steps[i].shiftDays).toBe(5);
      }
    });

    it('应该正确计算工序提前的联动效果', () => {
      const order = createOrderWithMultipleSteps();
      const stepToAdjust = order.steps[2];
      const newStartDate = addDaysToDate(stepToAdjust.startDate, -3);

      const result = calculateStepAdjustPreview(
        order,
        stepToAdjust.id,
        { startDate: newStartDate },
        recipes
      );

      for (let i = 0; i < 2; i++) {
        expect(result.steps[i].isChanged).toBe(false);
        expect(result.steps[i].isAffected).toBe(false);
      }
      expect(result.steps[2].isChanged).toBe(true);
      expect(result.steps[2].shiftDays).toBe(-3);

      for (let i = 3; i < result.steps.length; i++) {
        expect(result.steps[i].isAffected).toBe(true);
        expect(result.steps[i].shiftDays).toBe(-3);
      }
    });

    it('应该正确计算工序时长调整的联动效果', () => {
      const order = createOrderWithMultipleSteps();
      const stepToAdjust = order.steps[1];
      const originalDuration = stepToAdjust.durationDays;
      const newDuration = originalDuration + 4;

      const result = calculateStepAdjustPreview(
        order,
        stepToAdjust.id,
        { durationDays: newDuration },
        recipes
      );

      expect(result.steps[1].isChanged).toBe(true);
      expect(result.steps[1].newDurationDays).toBe(newDuration);
      expect(result.steps[1].shiftDays).toBe(0);

      for (let i = 2; i < result.steps.length; i++) {
        expect(result.steps[i].isAffected).toBe(true);
        expect(result.steps[i].shiftDays).toBe(4);
      }
    });

    it('应该正确计算交付影响摘要', () => {
      const order = createOrderWithMultipleSteps();
      const lastStep = order.steps[order.steps.length - 1];
      const stepToAdjust = order.steps[1];
      const newStartDate = addDaysToDate(stepToAdjust.startDate, 10);

      const result = calculateStepAdjustPreview(
        order,
        stepToAdjust.id,
        { startDate: newStartDate },
        recipes
      );

      expect(result.deliveryImpact.originalCompletionDate).toBe(lastStep.endDate);
      expect(result.deliveryImpact.completionShiftDays).toBe(10);
      expect(result.deliveryImpact.affectedSteps.length).toBeGreaterThan(0);
    });

    it('应该正确计算总延迟天数', () => {
      const order = createOrderWithMultipleSteps();
      const stepToAdjust = order.steps[0];
      const newStartDate = addDaysToDate(TEST_TODAY, 20);

      const result = calculateStepAdjustPreview(
        order,
        stepToAdjust.id,
        { startDate: newStartDate },
        recipes
      );

      const lastStep = result.steps[result.steps.length - 1];
      const expectedDelay = Math.max(0,
        Math.ceil((new Date(lastStep.newEndDate).getTime() - new Date(order.deliveryDate).getTime()) / (1000 * 60 * 60 * 24))
      );
      expect(result.totalDelayDays).toBe(expectedDelay);
    });

    it('应该正确处理阴干工序调整导致的交付延期', () => {
      const dryingRecipe = createMockRecipe({
        id: 'recipe-drying-test',
        dryingDays: 20,
        cellaringDays: 30,
      });

      const stepTypes: StepType[] = ['kneading', 'shaping', 'drying', 'cellaring', 'packaging'];
      const durations = [2, 3, dryingRecipe.dryingDays, dryingRecipe.cellaringDays, 2];

      let currentDate = TEST_TODAY;
      const steps = stepTypes.map((type, index) => {
        const duration = durations[index];
        const startDate = currentDate;
        const endDate = addDaysToDate(startDate, duration);
        currentDate = endDate;
        return {
          id: `order-drying-step-${index}`,
          orderId: 'order-drying',
          stepType: type,
          stepName: type,
          status: 'not_started' as const,
          startDate,
          endDate,
          durationDays: duration,
          notes: '',
          assignee: '',
        };
      });

      const order = createMockOrder({
        id: 'order-drying',
        recipeId: dryingRecipe.id,
        steps,
        deliveryDate: addDaysToDate(TEST_TODAY, 55),
      });

      const dryingStep = order.steps.find(s => s.stepType === 'drying')!;
      const result = calculateStepAdjustPreview(
        order,
        dryingStep.id,
        { durationDays: 30 },
        [dryingRecipe]
      );

      expect(result.totalDelayDays).toBeGreaterThan(0);
      expect(result.deliveryImpact.isOnSchedule).toBe(false);
      expect(result.newWarnings.some(w => w.type === 'drying' || w.type === 'delivery')).toBe(true);
    });
  });

  describe('applyStepAdjustment', () => {
    it('应该返回原步骤当步骤ID不存在时', () => {
      const order = createOrderWithMultipleSteps();
      const result = applyStepAdjustment(order, 'non-existent-step', {});

      expect(result).toEqual(order.steps);
    });

    it('应该正确应用工序开始日期调整', () => {
      const order = createOrderWithMultipleSteps();
      const stepToAdjust = order.steps[1];
      const newStartDate = addDaysToDate(stepToAdjust.startDate, 5);

      const result = applyStepAdjustment(order, stepToAdjust.id, { startDate: newStartDate });

      expect(result[1].startDate).toBe(newStartDate);
      expect(result[1].endDate).toBe(addDaysToDate(newStartDate, stepToAdjust.durationDays));

      for (let i = 2; i < result.length; i++) {
        expect(result[i].startDate).toBe(result[i - 1].endDate);
      }
    });

    it('应该正确应用工序时长调整', () => {
      const order = createOrderWithMultipleSteps();
      const stepToAdjust = order.steps[2];
      const newDuration = stepToAdjust.durationDays + 5;

      const result = applyStepAdjustment(order, stepToAdjust.id, { durationDays: newDuration });

      expect(result[2].durationDays).toBe(newDuration);
      expect(result[2].endDate).toBe(addDaysToDate(result[2].startDate, newDuration));

      for (let i = 3; i < result.length; i++) {
        expect(result[i].startDate).toBe(result[i - 1].endDate);
      }
    });

    it('不应该影响调整步骤之前的工序', () => {
      const order = createOrderWithMultipleSteps();
      const stepToAdjust = order.steps[2];
      const newStartDate = addDaysToDate(stepToAdjust.startDate, 3);

      const result = applyStepAdjustment(order, stepToAdjust.id, { startDate: newStartDate });

      for (let i = 0; i < 2; i++) {
        expect(result[i]).toEqual(order.steps[i]);
      }
    });

    it('应该正确处理中间工序提前的联动', () => {
      const order = createOrderWithMultipleSteps();
      const stepToAdjust = order.steps[1];
      const newStartDate = addDaysToDate(stepToAdjust.startDate, -2);

      const result = applyStepAdjustment(order, stepToAdjust.id, { startDate: newStartDate });

      expect(result[1].startDate).toBe(newStartDate);
      expect(result[2].startDate).toBe(result[1].endDate);
      expect(result[3].startDate).toBe(result[2].endDate);
    });
  });

  describe('validateStepAdjustment', () => {
    it('应该拒绝已完成工序的调整', () => {
      const order = createOrderWithMultipleSteps();
      const completedStep = { ...order.steps[0], status: 'completed' as const };
      const orderWithCompletedStep = {
        ...order,
        steps: [completedStep, ...order.steps.slice(1)],
      };

      const result = validateStepAdjustment(orderWithCompletedStep, completedStep.id, {
        startDate: addDaysToDate(completedStep.startDate, 1),
      });

      expect(result.valid).toBe(false);
      expect(result.message).toContain('已完成的工序无法调整');
    });

    it('应该拒绝无效的持续天数', () => {
      const order = createOrderWithMultipleSteps();
      const step = order.steps[0];

      const result = validateStepAdjustment(order, step.id, { durationDays: 0 });

      expect(result.valid).toBe(false);
      expect(result.message).toContain('持续天数必须大于0');
    });

    it('应该拒绝开始日期早于上一工序结束日期', () => {
      const order = createOrderWithMultipleSteps();
      const step = order.steps[2];
      const prevStep = order.steps[1];
      const invalidStartDate = addDaysToDate(prevStep.endDate, -1);

      const result = validateStepAdjustment(order, step.id, { startDate: invalidStartDate });

      expect(result.valid).toBe(false);
      expect(result.message).toContain('不能早于上一工序');
    });

    it('应该接受有效的调整', () => {
      const order = createOrderWithMultipleSteps();
      const step = order.steps[1];
      const newStartDate = addDaysToDate(step.startDate, 2);

      const result = validateStepAdjustment(order, step.id, { startDate: newStartDate });

      expect(result.valid).toBe(true);
    });

    it('应该返回工序不存在错误', () => {
      const order = createOrderWithMultipleSteps();

      const result = validateStepAdjustment(order, 'non-existent', { startDate: TEST_TODAY });

      expect(result.valid).toBe(false);
      expect(result.message).toContain('工序不存在');
    });
  });
});
