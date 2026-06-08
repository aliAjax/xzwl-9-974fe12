import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import {
  calculateAllWarnings,
  calculateDryingWarnings,
  calculateDeliveryWarnings,
  calculateScheduleDeliveryWarnings,
  calculateIngredientWarnings,
  calculateScheduleAllWarnings,
  mergeWarningsWithResolvedState,
  getWarningKey,
  getUnresolvedWarnings,
  getWarningsByType,
} from './warningUtils';
import {
  createMockOrder,
  createMockRecipe,
  createMockIngredientBatch,
  createMockWarning,
  createOrderWithDryingDelay,
  createCompletedOrder,
  TEST_TODAY,
} from '../test/testHelpers';
import { addDaysToDate } from './dateUtils';
import * as dateUtils from './dateUtils';
import type { StepType } from '../types';

vi.mock('./dateUtils', async () => {
  const actual = await vi.importActual('./dateUtils');
  return {
    ...actual,
    getToday: vi.fn(() => TEST_TODAY),
  };
});

describe('warningUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (dateUtils.getToday as Mock).mockReturnValue(TEST_TODAY);
  });

  describe('calculateDryingWarnings', () => {
    it('应该生成阴干周期不足的预警', () => {
      const { order, recipe } = createOrderWithDryingDelay();
      const warnings = calculateDryingWarnings(order, recipe);

      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].type).toBe('drying');
      expect(warnings[0].message).toContain('阴干周期');
    });

    it('不应该生成预警当阴干周期足够时', () => {
      const recipe = createMockRecipe({ dryingDays: 10, cellaringDays: 20 });
      const stepTypes: StepType[] = ['kneading', 'shaping', 'drying', 'cellaring', 'packaging'];
      const durations = [2, 3, recipe.dryingDays, recipe.cellaringDays, 2];

      let currentDate = TEST_TODAY;
      const stepNames: Record<StepType, string> = {
        kneading: '揉料',
        shaping: '成型',
        drying: '阴干',
        cellaring: '窖藏',
        packaging: '包装',
      };
      const steps = stepTypes.map((type, index) => {
        const duration = durations[index];
        const startDate = currentDate;
        const endDate = addDaysToDate(startDate, duration);
        currentDate = endDate;
        let status: 'completed' | 'in_progress' | 'not_started' = 'not_started';
        if (index < 2) status = 'completed';
        else if (index === 2) status = 'in_progress';
        return {
          id: `order-ok-step-${index}`,
          orderId: 'order-ok',
          stepType: type,
          stepName: stepNames[type],
          status,
          startDate,
          endDate,
          durationDays: duration,
          notes: '',
          assignee: '',
        };
      });

      const lastStep = steps[steps.length - 1];
      const order = createMockOrder({
        id: 'order-ok',
        recipeId: recipe.id,
        steps,
        deliveryDate: addDaysToDate(lastStep.endDate, 5),
      });

      const warnings = calculateDryingWarnings(order, recipe);
      expect(warnings.length).toBe(0);
    });

    it('不应该生成预警当没有阴干工序时', () => {
      const recipe = createMockRecipe();
      const order = createMockOrder({
        steps: [],
      });

      const warnings = calculateDryingWarnings(order, recipe);
      expect(warnings.length).toBe(0);
    });

    it('应该根据延迟天数设置正确的预警级别', () => {
      const recipe = createMockRecipe({ dryingDays: 30, cellaringDays: 45 });
      const stepTypes: StepType[] = ['kneading', 'shaping', 'drying', 'cellaring', 'packaging'];
      const durations = [2, 3, recipe.dryingDays, recipe.cellaringDays, 2];

      let currentDate = TEST_TODAY;
      const stepNames2: Record<StepType, string> = {
        kneading: '揉料',
        shaping: '成型',
        drying: '阴干',
        cellaring: '窖藏',
        packaging: '包装',
      };
      const steps = stepTypes.map((type, index) => {
        const duration = durations[index];
        const startDate = currentDate;
        const endDate = addDaysToDate(startDate, duration);
        currentDate = endDate;
        let status2: 'completed' | 'in_progress' | 'not_started' = 'not_started';
        if (index < 2) status2 = 'completed';
        else if (index === 2) status2 = 'in_progress';
        return {
          id: `order-critical-step-${index}`,
          orderId: 'order-critical',
          stepType: type,
          stepName: stepNames2[type],
          status: status2,
          startDate,
          endDate,
          durationDays: duration,
          notes: '',
          assignee: '',
        };
      });

      const order = createMockOrder({
        id: 'order-critical',
        recipeId: recipe.id,
        steps,
        deliveryDate: addDaysToDate(TEST_TODAY, 30),
      });

      const warnings = calculateDryingWarnings(order, recipe);
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].level).toBe('critical');
    });
  });

  describe('calculateDeliveryWarnings', () => {
    it('应该生成交付临期预警', () => {
      const order = createMockOrder({
        deliveryDate: addDaysToDate(TEST_TODAY, 2),
        status: 'in_production',
      });

      const warnings = calculateDeliveryWarnings(order);
      const deadlineWarnings = warnings.filter(w => w.message.includes('距交付期仅剩'));

      expect(deadlineWarnings.length).toBeGreaterThan(0);
      expect(deadlineWarnings[0].level).toBe('warning');
    });

    it('应该生成紧急交付预警', () => {
      const order = createMockOrder({
        deliveryDate: addDaysToDate(TEST_TODAY, 1),
        status: 'in_production',
      });

      const warnings = calculateDeliveryWarnings(order);
      const deadlineWarnings = warnings.filter(w => w.message.includes('距交付期仅剩'));

      expect(deadlineWarnings.length).toBeGreaterThan(0);
      expect(deadlineWarnings[0].level).toBe('critical');
    });

    it('不应该为已完成订单生成预警', () => {
      const order = createCompletedOrder();
      const warnings = calculateDeliveryWarnings(order);

      expect(warnings.length).toBe(0);
    });
  });

  describe('calculateScheduleDeliveryWarnings', () => {
    it('应该生成计划交付延迟预警', () => {
      const order = createMockOrder({
        deliveryDate: addDaysToDate(TEST_TODAY, 10),
      });

      const lastStep = order.steps[order.steps.length - 1];
      const delayedSteps = order.steps.map((step, index) => ({
        ...step,
        startDate: addDaysToDate(step.startDate, 15),
        endDate: addDaysToDate(step.endDate, 15),
      }));

      const delayedOrder = { ...order, steps: delayedSteps };

      const warnings = calculateScheduleDeliveryWarnings(delayedOrder);
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].type).toBe('delivery');
      expect(warnings[0].message).toContain('按计划');
    });

    it('不应该生成预警当计划完成日期早于交付日期时', () => {
      const order = createMockOrder();
      const warnings = calculateScheduleDeliveryWarnings(order);

      expect(warnings.length).toBe(0);
    });
  });

  describe('calculateIngredientWarnings', () => {
    it('应该生成库存不足预警', () => {
      const ingredient = createMockIngredientBatch({
        quantity: 10,
        safetyStock: 100,
      });

      const warnings = calculateIngredientWarnings(ingredient);
      const stockWarnings = warnings.filter(w => w.type === 'ingredient');

      expect(stockWarnings.length).toBeGreaterThan(0);
      expect(stockWarnings[0].level).toBe('critical');
    });

    it('应该生成临期预警', () => {
      const ingredient = createMockIngredientBatch({
        expiryDate: addDaysToDate(TEST_TODAY, 5),
      });

      const warnings = calculateIngredientWarnings(ingredient);
      const expiryWarnings = warnings.filter(w => w.type === 'inventory');

      expect(expiryWarnings.length).toBeGreaterThan(0);
      expect(expiryWarnings[0].level).toBe('critical');
    });

    it('应该根据临期天数设置正确的预警级别', () => {
      const criticalIngredient = createMockIngredientBatch({
        id: 'ing-critical-expiry',
        expiryDate: addDaysToDate(TEST_TODAY, 3),
      });

      const warningIngredient = createMockIngredientBatch({
        id: 'ing-warning-expiry',
        expiryDate: addDaysToDate(TEST_TODAY, 15),
      });

      const criticalWarnings = calculateIngredientWarnings(criticalIngredient);
      const warningWarnings = calculateIngredientWarnings(warningIngredient);

      const criticalExpiry = criticalWarnings.find(w => w.type === 'inventory');
      const warningExpiry = warningWarnings.find(w => w.type === 'inventory');

      expect(criticalExpiry?.level).toBe('critical');
      expect(warningExpiry?.level).toBe('warning');
    });

    it('不应该生成预警当库存充足且临期较远时', () => {
      const ingredient = createMockIngredientBatch({
        quantity: 200,
        safetyStock: 50,
        expiryDate: addDaysToDate(TEST_TODAY, 180),
      });

      const warnings = calculateIngredientWarnings(ingredient);
      expect(warnings.length).toBe(0);
    });
  });

  describe('calculateAllWarnings', () => {
    it('应该综合计算所有预警', () => {
      const { order: dryingOrder, recipe: dryingRecipe } = createOrderWithDryingDelay();
      const urgentOrder = createMockOrder({
        id: 'order-urgent',
        orderNo: 'XY-TEST-URGENT',
        deliveryDate: addDaysToDate(TEST_TODAY, 2),
      });
      const lowStockIngredient = createMockIngredientBatch({
        id: 'ing-low-stock',
        quantity: 10,
        safetyStock: 100,
      });

      const warnings = calculateAllWarnings(
        [dryingOrder, urgentOrder],
        [lowStockIngredient],
        [dryingRecipe, createMockRecipe()]
      );

      expect(warnings.length).toBeGreaterThan(0);

      const deliveryWarnings = warnings.filter(w => w.type === 'delivery');
      const dryingWarnings = warnings.filter(w => w.type === 'drying');
      const ingredientWarnings = warnings.filter(w => w.type === 'ingredient');

      expect(deliveryWarnings.length).toBeGreaterThan(0);
      expect(dryingWarnings.length).toBeGreaterThan(0);
      expect(ingredientWarnings.length).toBeGreaterThan(0);
    });

    it('不应该为已完成订单生成订单预警', () => {
      const completedOrder = createCompletedOrder();
      const activeOrder = createMockOrder({
        id: 'order-active',
        deliveryDate: addDaysToDate(TEST_TODAY, 2),
      });

      const warnings = calculateAllWarnings(
        [completedOrder, activeOrder],
        [],
        [createMockRecipe()]
      );

      const orderWarnings = warnings.filter(w => w.relatedType === 'order');
      expect(orderWarnings.every(w => w.relatedId === 'order-active')).toBe(true);
    });

    it('应该按照严重程度排序', () => {
      const criticalIngredient = createMockIngredientBatch({
        id: 'ing-critical',
        quantity: 5,
        safetyStock: 100,
      });
      const warningIngredient = createMockIngredientBatch({
        id: 'ing-warning',
        name: '预警原料',
        batchNo: 'BATCH-WARN',
        quantity: 40,
        safetyStock: 100,
      });

      const warnings = calculateAllWarnings(
        [],
        [criticalIngredient, warningIngredient],
        []
      );

      expect(warnings[0].level).toBe('critical');
      expect(warnings[warnings.length - 1].level).not.toBe('critical');
    });

    it('应该包含原料预警', () => {
      const expiringIngredient = createMockIngredientBatch({
        expiryDate: addDaysToDate(TEST_TODAY, 10),
      });

      const warnings = calculateAllWarnings([], [expiringIngredient], []);
      const inventoryWarnings = warnings.filter(w => w.type === 'inventory');

      expect(inventoryWarnings.length).toBeGreaterThan(0);
    });
  });

  describe('calculateScheduleAllWarnings', () => {
    it('应该计算排程相关的所有预警', () => {
      const { order, recipe } = createOrderWithDryingDelay();
      const warnings = calculateScheduleAllWarnings(order, recipe);

      expect(warnings.length).toBeGreaterThan(0);
      const hasDryingOrDelivery = warnings.some(
        w => w.type === 'drying' || w.type === 'delivery'
      );
      expect(hasDryingOrDelivery).toBe(true);
    });
  });

  describe('mergeWarningsWithResolvedState', () => {
    it('应该保持已处理预警的状态', () => {
      const existingResolved = [
        createMockWarning({
          id: 'warn-1',
          type: 'delivery',
          relatedId: 'order-1',
          level: 'warning',
          message: '测试预警1',
          isResolved: true,
        }),
      ];

      const newWarnings = [
        createMockWarning({
          id: 'warn-new-1',
          type: 'delivery',
          relatedId: 'order-1',
          level: 'warning',
          message: '测试预警1',
          isResolved: false,
        }),
        createMockWarning({
          id: 'warn-new-2',
          type: 'ingredient',
          relatedId: 'ing-1',
          level: 'critical',
          message: '新的预警',
          isResolved: false,
        }),
      ];

      const merged = mergeWarningsWithResolvedState(newWarnings, existingResolved);

      const matchedWarning = merged.find(
        w => w.type === 'delivery' && w.relatedId === 'order-1'
      );
      const newWarning = merged.find(w => w.type === 'ingredient');

      expect(matchedWarning?.isResolved).toBe(true);
      expect(newWarning?.isResolved).toBe(false);
    });

    it('应该保留已解决但不在新预警列表中的预警', () => {
      const existingResolved = [
        createMockWarning({
          id: 'warn-old',
          type: 'delivery',
          relatedId: 'order-old',
          level: 'warning',
          message: '已解决的旧预警',
          isResolved: true,
        }),
      ];

      const newWarnings: ReturnType<typeof createMockWarning>[] = [];

      const merged = mergeWarningsWithResolvedState(newWarnings, existingResolved);

      expect(merged.length).toBe(1);
      expect(merged[0].id).toBe('warn-old');
      expect(merged[0].isResolved).toBe(true);
    });

    it('应该按照严重程度排序', () => {
      const existingResolved: ReturnType<typeof createMockWarning>[] = [];
      const newWarnings = [
        createMockWarning({
          id: 'warn-info',
          type: 'delivery',
          level: 'info',
          message: '信息预警',
          isResolved: false,
        }),
        createMockWarning({
          id: 'warn-critical',
          type: 'ingredient',
          level: 'critical',
          message: '严重预警',
          isResolved: false,
        }),
        createMockWarning({
          id: 'warn-warning',
          type: 'inventory',
          level: 'warning',
          message: '警告预警',
          isResolved: false,
        }),
      ];

      const merged = mergeWarningsWithResolvedState(newWarnings, existingResolved);

      expect(merged[0].level).toBe('critical');
      expect(merged[1].level).toBe('warning');
      expect(merged[2].level).toBe('info');
    });
  });

  describe('getWarningKey', () => {
    it('应该为相同类型和相关ID的预警生成相同的键', () => {
      const warning1 = createMockWarning({
        type: 'delivery',
        relatedType: 'order',
        relatedId: 'order-1',
        level: 'warning',
        message: '订单 XY-001 距交付期仅剩 2 天',
      });

      const warning2 = createMockWarning({
        id: 'different-id',
        type: 'delivery',
        relatedType: 'order',
        relatedId: 'order-1',
        level: 'warning',
        message: '订单 XY-001 距交付期仅剩 2 天',
        createdAt: new Date().toISOString(),
      });

      expect(getWarningKey(warning1)).toBe(getWarningKey(warning2));
    });

    it('应该为不同类型的预警生成不同的键', () => {
      const warning1 = createMockWarning({
        type: 'delivery',
        relatedId: 'order-1',
      });

      const warning2 = createMockWarning({
        type: 'ingredient',
        relatedId: 'order-1',
      });

      expect(getWarningKey(warning1)).not.toBe(getWarningKey(warning2));
    });
  });

  describe('getUnresolvedWarnings', () => {
    it('应该只返回未解决的预警', () => {
      const warnings = [
        createMockWarning({ id: 'w1', isResolved: false }),
        createMockWarning({ id: 'w2', isResolved: true }),
        createMockWarning({ id: 'w3', isResolved: false }),
      ];

      const unresolved = getUnresolvedWarnings(warnings);
      expect(unresolved.length).toBe(2);
      expect(unresolved.every(w => !w.isResolved)).toBe(true);
    });
  });

  describe('getWarningsByType', () => {
    it('应该按类型过滤预警', () => {
      const warnings = [
        createMockWarning({ id: 'w1', type: 'delivery', isResolved: false }),
        createMockWarning({ id: 'w2', type: 'ingredient', isResolved: false }),
        createMockWarning({ id: 'w3', type: 'delivery', isResolved: true }),
      ];

      const deliveryWarnings = getWarningsByType(warnings, 'delivery');
      expect(deliveryWarnings.length).toBe(1);
      expect(deliveryWarnings[0].id).toBe('w1');
    });
  });
});
