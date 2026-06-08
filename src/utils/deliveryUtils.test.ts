import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { calculateDeliveryCommitment } from './deliveryUtils';
import {
  createMockRecipe,
  createMockIngredientBatch,
  createCompletedOrder,
  TEST_TODAY,
} from '../test/testHelpers';
import { addDaysToDate } from './dateUtils';
import * as dateUtils from './dateUtils';
import type { Order, StepType } from '../types';

vi.mock('./dateUtils', async () => {
  const actual = await vi.importActual('./dateUtils');
  return {
    ...actual,
    getToday: vi.fn(() => TEST_TODAY),
  };
});

const createTestOrder = (
  overrides: Partial<Order> & { id: string; recipeId: string }
): Order => {
  const { id, recipeId, ...restOverrides } = overrides;

  const stepTypes: StepType[] = ['kneading', 'shaping', 'drying', 'cellaring', 'packaging'];
  const steps = stepTypes.map((type, index) => ({
    id: `${id}-step-${index}`,
    orderId: id,
    stepType: type,
    stepName: type,
    status: 'not_started' as const,
    startDate: addDaysToDate(TEST_TODAY, index * 5),
    endDate: addDaysToDate(TEST_TODAY, index * 5 + 2),
    durationDays: 2,
    notes: '',
    assignee: '',
  }));

  return {
    id,
    orderNo: id.toUpperCase(),
    customerName: '测试客户',
    recipeId,
    quantity: 100,
    unit: '克',
    orderDate: TEST_TODAY,
    deliveryDate: addDaysToDate(TEST_TODAY, 30),
    status: 'in_production',
    priority: 'medium',
    currentStepIndex: 0,
    steps,
    ...restOverrides,
  };
};

describe('deliveryUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (dateUtils.getToday as Mock).mockReturnValue(TEST_TODAY);
  });

  describe('calculateDeliveryCommitment', () => {
    it('应该正确计算最早交付日期', () => {
      const recipe = createMockRecipe({ id: 'recipe-delivery' });
      const order1 = createTestOrder({
        id: 'order-delivery-1',
        recipeId: recipe.id,
        deliveryDate: addDaysToDate(TEST_TODAY, 10),
      });
      const order2 = createTestOrder({
        id: 'order-delivery-2',
        recipeId: recipe.id,
        deliveryDate: addDaysToDate(TEST_TODAY, 20),
      });

      const result = calculateDeliveryCommitment(
        [order1, order2],
        [],
        [],
        [recipe],
        TEST_TODAY
      );

      expect(result.earliestDeliveryDate).toBe(order1.deliveryDate);
      expect(result.earliestDaysRemaining).toBe(10);
    });

    it('应该正确识别逾期风险', () => {
      const recipe = createMockRecipe({ id: 'recipe-overdue' });
      const overdueOrder = createTestOrder({
        id: 'order-overdue',
        recipeId: recipe.id,
        deliveryDate: addDaysToDate(TEST_TODAY, -5),
        status: 'in_production',
      });
      const normalOrder = createTestOrder({
        id: 'order-normal',
        recipeId: recipe.id,
        deliveryDate: addDaysToDate(TEST_TODAY, 10),
        status: 'in_production',
      });

      const result = calculateDeliveryCommitment(
        [overdueOrder, normalOrder],
        [],
        [],
        [recipe],
        TEST_TODAY
      );

      expect(result.hasOverdueRisk).toBe(true);
      expect(result.overdueRiskCount).toBe(1);
    });

    it('不应该将已完成订单计入逾期风险', () => {
      const recipe = createMockRecipe({ id: 'recipe-completed-overdue' });
      const completedOrder = createCompletedOrder();
      completedOrder.id = 'order-completed-overdue';
      completedOrder.deliveryDate = addDaysToDate(TEST_TODAY, -10);

      const result = calculateDeliveryCommitment(
        [completedOrder],
        [],
        [],
        [recipe],
        TEST_TODAY
      );

      expect(result.hasOverdueRisk).toBe(false);
      expect(result.overdueRiskCount).toBe(0);
    });

    it('应该正确识别关键阻塞工序', () => {
      const recipe = createMockRecipe({ id: 'recipe-blocking' });
      const order1 = createTestOrder({
        id: 'order-block-1',
        recipeId: recipe.id,
        currentStepIndex: -1,
        steps: [
          { id: 's1', orderId: 'order-block-1', stepType: 'kneading', stepName: '揉料', status: 'not_started', startDate: '2026-06-07', endDate: '2026-06-09', durationDays: 2, notes: '', assignee: '' },
        ],
      });
      const order2 = createTestOrder({
        id: 'order-block-2',
        recipeId: recipe.id,
        currentStepIndex: -1,
        steps: [
          { id: 's2', orderId: 'order-block-2', stepType: 'kneading', stepName: '揉料', status: 'not_started', startDate: '2026-06-07', endDate: '2026-06-09', durationDays: 2, notes: '', assignee: '' },
        ],
      });
      const order3 = createTestOrder({
        id: 'order-block-3',
        recipeId: recipe.id,
        currentStepIndex: 0,
        steps: [
          { id: 's3', orderId: 'order-block-3', stepType: 'kneading', stepName: '揉料', status: 'in_progress', startDate: '2026-06-07', endDate: '2026-06-09', durationDays: 2, notes: '', assignee: '' },
        ],
      });

      const result = calculateDeliveryCommitment(
        [order1, order2, order3],
        [],
        [],
        [recipe],
        TEST_TODAY
      );

      expect(result.criticalBlockingSteps.length).toBe(1);
      expect(result.criticalBlockingSteps[0].stepName).toBe('揉料');
      expect(result.criticalBlockingSteps[0].orderCount).toBe(2);
      expect(result.criticalBlockingSteps[0].orderNos).toContain('ORDER-BLOCK-1');
      expect(result.criticalBlockingSteps[0].orderNos).toContain('ORDER-BLOCK-2');
    });

    it('应该正确计算物料短缺风险', () => {
      const recipe = createMockRecipe({
        id: 'recipe-shortage',
        ingredients: [
          { ingredientId: 'ing-shortage', name: '短缺原料', quantity: 50, unit: 'g' },
        ],
      });

      const order = createTestOrder({
        id: 'order-shortage',
        recipeId: recipe.id,
        quantity: 200,
        status: 'in_production',
      });

      const ingredient = createMockIngredientBatch({
        id: 'ing-shortage',
        name: '短缺原料',
        quantity: 10,
        safetyStock: 50,
        expiryDate: addDaysToDate(TEST_TODAY, 180),
      });

      const result = calculateDeliveryCommitment(
        [order],
        [],
        [ingredient],
        [recipe],
        TEST_TODAY
      );

      expect(result.materialShortageRisk).toBe(true);
      expect(result.materialShortageCount).toBe(1);
      expect(result.materialShortageDetails[0].ingredientName).toBe('短缺原料');
      expect(result.materialShortageDetails[0].gap).toBeCloseTo(90);
    });

    it('应该正确处理临期原料的折算', () => {
      const recipe = createMockRecipe({
        id: 'recipe-expiry-stock',
        ingredients: [
          { ingredientId: 'ing-expiry-stock', name: '临期折算原料', quantity: 50, unit: 'g' },
        ],
      });

      const order = createTestOrder({
        id: 'order-expiry-stock',
        recipeId: recipe.id,
        quantity: 200,
        status: 'in_production',
      });

      const expiringIngredient = createMockIngredientBatch({
        id: 'ing-expiry-stock',
        name: '临期折算原料',
        quantity: 100,
        expiryDate: addDaysToDate(TEST_TODAY, 5),
        safetyStock: 50,
      });

      const result = calculateDeliveryCommitment(
        [order],
        [],
        [expiringIngredient],
        [recipe],
        TEST_TODAY
      );

      expect(result.materialShortageRisk).toBe(true);
      const expectedAvailable = 100 * 0.3;
      const expectedGap = 100 - expectedAvailable;
      expect(result.materialShortageDetails[0].gap).toBeCloseTo(expectedGap);
    });

    it('不应该将已完成订单计入物料需求', () => {
      const recipe = createMockRecipe({
        id: 'recipe-completed-demand',
        ingredients: [
          { ingredientId: 'ing-completed-demand', name: '已完成需求原料', quantity: 50, unit: 'g' },
        ],
      });

      const completedOrder = createCompletedOrder();
      completedOrder.id = 'order-completed-demand';
      completedOrder.recipeId = recipe.id;
      completedOrder.quantity = 1000;

      const activeOrder = createTestOrder({
        id: 'order-active-demand',
        recipeId: recipe.id,
        quantity: 100,
        status: 'in_production',
      });

      const ingredient = createMockIngredientBatch({
        id: 'ing-completed-demand',
        name: '已完成需求原料',
        quantity: 0,
        safetyStock: 50,
        expiryDate: addDaysToDate(TEST_TODAY, 180),
      });

      const result = calculateDeliveryCommitment(
        [completedOrder, activeOrder],
        [],
        [ingredient],
        [recipe],
        TEST_TODAY
      );

      expect(result.materialShortageCount).toBe(1);
      expect(result.materialShortageDetails[0].gap).toBeCloseTo(50);
      expect(result.materialShortageDetails[0].orderNos).toContain('ORDER-ACTIVE-DEMAND');
      expect(result.materialShortageDetails[0].orderNos).not.toContain('ORDER-COMPLETED-DEMAND');
    });

    it('应该正确统计高优先级订单', () => {
      const recipe = createMockRecipe({ id: 'recipe-high-priority' });
      const highPriorityOrder1 = createTestOrder({
        id: 'order-high-1',
        recipeId: recipe.id,
        priority: 'high',
        status: 'in_production',
      });
      const highPriorityOrder2 = createTestOrder({
        id: 'order-high-2',
        recipeId: recipe.id,
        priority: 'high',
        status: 'in_production',
      });
      const mediumPriorityOrder = createTestOrder({
        id: 'order-medium',
        recipeId: recipe.id,
        priority: 'medium',
        status: 'in_production',
      });
      const completedHighPriority = createCompletedOrder();
      completedHighPriority.id = 'order-high-completed';
      completedHighPriority.priority = 'high';

      const result = calculateDeliveryCommitment(
        [highPriorityOrder1, highPriorityOrder2, mediumPriorityOrder, completedHighPriority],
        [],
        [],
        [recipe],
        TEST_TODAY
      );

      expect(result.highPriorityOrderCount).toBe(2);
      expect(result.highPriorityOrderNos).toContain('ORDER-HIGH-1');
      expect(result.highPriorityOrderNos).toContain('ORDER-HIGH-2');
      expect(result.highPriorityOrderNos).not.toContain('ORDER-HIGH-COMPLETED');
    });

    it('应该正确识别本周内需要交付的订单', () => {
      const recipe = createMockRecipe({ id: 'recipe-this-week' });
      const thisWeekOrder = createTestOrder({
        id: 'order-this-week',
        recipeId: recipe.id,
        deliveryDate: addDaysToDate(TEST_TODAY, 5),
        status: 'in_production',
      });
      const nextWeekOrder = createTestOrder({
        id: 'order-next-week',
        recipeId: recipe.id,
        deliveryDate: addDaysToDate(TEST_TODAY, 10),
        status: 'in_production',
      });

      const result = calculateDeliveryCommitment(
        [thisWeekOrder, nextWeekOrder],
        [],
        [],
        [recipe],
        TEST_TODAY
      );

      expect(result.needsThisWeek).toBe(true);
    });

    it('应该在没有活动订单时返回正确的默认值', () => {
      const completedOrder = createCompletedOrder();
      const recipe = createMockRecipe({ id: 'recipe-empty' });

      const result = calculateDeliveryCommitment(
        [completedOrder],
        [],
        [],
        [recipe],
        TEST_TODAY
      );

      expect(result.earliestDeliveryDate).toBe('');
      expect(result.earliestDaysRemaining).toBe(0);
      expect(result.hasOverdueRisk).toBe(false);
      expect(result.overdueRiskCount).toBe(0);
      expect(result.highPriorityOrderCount).toBe(0);
      expect(result.needsThisWeek).toBe(false);
    });

    it('应该正确聚合多个订单的物料短缺', () => {
      const recipe = createMockRecipe({
        id: 'recipe-aggregate',
        ingredients: [
          { ingredientId: 'ing-aggregate', name: '聚合原料', quantity: 50, unit: 'g' },
        ],
      });

      const order1 = createTestOrder({
        id: 'order-agg-1',
        recipeId: recipe.id,
        quantity: 100,
        status: 'in_production',
      });
      const order2 = createTestOrder({
        id: 'order-agg-2',
        recipeId: recipe.id,
        quantity: 200,
        status: 'in_production',
      });

      const ingredient = createMockIngredientBatch({
        id: 'ing-aggregate',
        name: '聚合原料',
        quantity: 50,
        safetyStock: 50,
        expiryDate: addDaysToDate(TEST_TODAY, 180),
      });

      const result = calculateDeliveryCommitment(
        [order1, order2],
        [],
        [ingredient],
        [recipe],
        TEST_TODAY
      );

      expect(result.materialShortageCount).toBe(1);
      const expectedGap = (50 + 100) - 50;
      expect(result.materialShortageDetails[0].gap).toBeCloseTo(expectedGap);
      expect(result.materialShortageDetails[0].orderNos).toContain('ORDER-AGG-1');
      expect(result.materialShortageDetails[0].orderNos).toContain('ORDER-AGG-2');
    });

    it('应该正确处理多个原料批次的库存计算', () => {
      const recipe = createMockRecipe({
        id: 'recipe-multi-batch',
        ingredients: [
          { ingredientId: 'ing-batch-1', name: '多批次原料', quantity: 50, unit: 'g' },
        ],
      });

      const order = createTestOrder({
        id: 'order-multi-batch',
        recipeId: recipe.id,
        quantity: 200,
        status: 'in_production',
      });

      const batch1 = createMockIngredientBatch({
        id: 'ing-batch-1',
        name: '多批次原料',
        batchNo: 'BATCH-1',
        quantity: 50,
        expiryDate: addDaysToDate(TEST_TODAY, 180),
      });

      const batch2 = createMockIngredientBatch({
        id: 'ing-batch-2',
        name: '多批次原料',
        batchNo: 'BATCH-2',
        quantity: 50,
        expiryDate: addDaysToDate(TEST_TODAY, 5),
      });

      const result = calculateDeliveryCommitment(
        [order],
        [],
        [batch1, batch2],
        [recipe],
        TEST_TODAY
      );

      expect(result.materialShortageCount).toBe(1);
      const expectedAvailable = 50 + 50 * 0.3;
      const expectedGap = 100 - expectedAvailable;
      expect(result.materialShortageDetails[0].gap).toBeCloseTo(expectedGap);
    });

    it('应该正确限制关键阻塞工序的数量', () => {
      const recipe = createMockRecipe({ id: 'recipe-many-blocks' });
      const orders: Order[] = [];

      const stepNames = ['揉料', '成型', '阴干', '窖藏', '包装'];
      for (let i = 0; i < 5; i++) {
        const stepName = stepNames[i];
        for (let j = 0; j < i + 1; j++) {
          orders.push(createTestOrder({
            id: `order-block-${i}-${j}`,
            recipeId: recipe.id,
            currentStepIndex: -1,
            steps: [
              { id: `s-${i}-${j}`, orderId: `order-block-${i}-${j}`, stepType: 'kneading', stepName, status: 'not_started', startDate: '2026-06-07', endDate: '2026-06-09', durationDays: 2, notes: '', assignee: '' },
            ],
          }));
        }
      }

      const result = calculateDeliveryCommitment(
        orders,
        [],
        [],
        [recipe],
        TEST_TODAY
      );

      expect(result.criticalBlockingSteps.length).toBeLessThanOrEqual(3);
    });

    it('应该正确排序关键阻塞工序按订单数量', () => {
      const recipe = createMockRecipe({ id: 'recipe-sort-blocks' });
      const orders: Order[] = [];

      for (let i = 0; i < 3; i++) {
        orders.push(createTestOrder({
          id: `order-kneading-${i}`,
          recipeId: recipe.id,
          currentStepIndex: -1,
          steps: [
            { id: `sk-${i}`, orderId: `order-kneading-${i}`, stepType: 'kneading', stepName: '揉料', status: 'not_started', startDate: '2026-06-07', endDate: '2026-06-09', durationDays: 2, notes: '', assignee: '' },
          ],
        }));
      }

      for (let i = 0; i < 5; i++) {
        orders.push(createTestOrder({
          id: `order-shaping-${i}`,
          recipeId: recipe.id,
          currentStepIndex: -1,
          steps: [
            { id: `ss-${i}`, orderId: `order-shaping-${i}`, stepType: 'shaping', stepName: '成型', status: 'not_started', startDate: '2026-06-07', endDate: '2026-06-09', durationDays: 2, notes: '', assignee: '' },
          ],
        }));
      }

      const result = calculateDeliveryCommitment(
        orders,
        [],
        [],
        [recipe],
        TEST_TODAY
      );

      expect(result.criticalBlockingSteps[0].stepName).toBe('成型');
      expect(result.criticalBlockingSteps[0].orderCount).toBe(5);
      expect(result.criticalBlockingSteps[1].stepName).toBe('揉料');
      expect(result.criticalBlockingSteps[1].orderCount).toBe(3);
    });
  });

  describe('客户汇总边界场景', () => {
    it('空订单列表应该返回默认值', () => {
      const result = calculateDeliveryCommitment([], [], [], [], TEST_TODAY);

      expect(result.earliestDeliveryDate).toBe('');
      expect(result.earliestDaysRemaining).toBe(0);
      expect(result.hasOverdueRisk).toBe(false);
      expect(result.overdueRiskCount).toBe(0);
      expect(result.criticalBlockingSteps).toEqual([]);
      expect(result.materialShortageRisk).toBe(false);
      expect(result.materialShortageCount).toBe(0);
      expect(result.highPriorityOrderCount).toBe(0);
      expect(result.needsThisWeek).toBe(false);
    });

    it('全部为已完成订单时应该返回默认值', () => {
      const completed1 = createCompletedOrder();
      completed1.id = 'order-all-done-1';
      const completed2 = createCompletedOrder();
      completed2.id = 'order-all-done-2';

      const result = calculateDeliveryCommitment([completed1, completed2], [], [], [], TEST_TODAY);

      expect(result.earliestDeliveryDate).toBe('');
      expect(result.hasOverdueRisk).toBe(false);
      expect(result.highPriorityOrderCount).toBe(0);
      expect(result.needsThisWeek).toBe(false);
    });

    it('多客户订单聚合计算', () => {
      const recipe = createMockRecipe({
        id: 'recipe-multi-customer',
        ingredients: [
          { ingredientId: 'ing-multi-cust', name: '多客户原料', quantity: 50, unit: 'g' },
        ],
      });

      const customer1Orders = [
        createTestOrder({
          id: 'order-cust1-1',
          recipeId: recipe.id,
          customerName: '客户A',
          deliveryDate: addDaysToDate(TEST_TODAY, 5),
          priority: 'high',
          quantity: 100,
          status: 'in_production',
        }),
        createTestOrder({
          id: 'order-cust1-2',
          recipeId: recipe.id,
          customerName: '客户A',
          deliveryDate: addDaysToDate(TEST_TODAY, 20),
          priority: 'medium',
          quantity: 200,
          status: 'in_production',
        }),
      ];

      const ingredient = createMockIngredientBatch({
        id: 'ing-multi-cust',
        name: '多客户原料',
        quantity: 100,
        safetyStock: 50,
        expiryDate: addDaysToDate(TEST_TODAY, 180),
      });

      const result = calculateDeliveryCommitment(
        customer1Orders,
        [],
        [ingredient],
        [recipe],
        TEST_TODAY
      );

      expect(result.earliestDeliveryDate).toBe(addDaysToDate(TEST_TODAY, 5));
      expect(result.highPriorityOrderCount).toBe(1);
      expect(result.needsThisWeek).toBe(true);
      expect(result.materialShortageRisk).toBe(true);
    });

    it('逾期订单风险级别边界', () => {
      const recipe = createMockRecipe({ id: 'recipe-risk-boundary' });
      const todayOrder = createTestOrder({
        id: 'order-today',
        recipeId: recipe.id,
        deliveryDate: TEST_TODAY,
        status: 'in_production',
      });
      const yesterdayOrder = createTestOrder({
        id: 'order-yesterday',
        recipeId: recipe.id,
        deliveryDate: addDaysToDate(TEST_TODAY, -1),
        status: 'in_production',
      });
      const tomorrowOrder = createTestOrder({
        id: 'order-tomorrow',
        recipeId: recipe.id,
        deliveryDate: addDaysToDate(TEST_TODAY, 1),
        status: 'in_production',
      });

      const result = calculateDeliveryCommitment(
        [todayOrder, yesterdayOrder, tomorrowOrder],
        [],
        [],
        [recipe],
        TEST_TODAY
      );

      expect(result.hasOverdueRisk).toBe(true);
      expect(result.overdueRiskCount).toBe(1);
    });

    it('本周交付边界条件验证', () => {
      const recipe = createMockRecipe({ id: 'recipe-week-boundary' });
      const day7Order = createTestOrder({
        id: 'order-day7',
        recipeId: recipe.id,
        deliveryDate: addDaysToDate(TEST_TODAY, 7),
        status: 'in_production',
      });
      const day8Order = createTestOrder({
        id: 'order-day8',
        recipeId: recipe.id,
        deliveryDate: addDaysToDate(TEST_TODAY, 8),
        status: 'in_production',
      });

      const resultWith7Days = calculateDeliveryCommitment([day7Order], [], [], [recipe], TEST_TODAY);
      expect(resultWith7Days.needsThisWeek).toBe(true);

      const resultWith8Days = calculateDeliveryCommitment([day8Order], [], [], [recipe], TEST_TODAY);
      expect(resultWith8Days.needsThisWeek).toBe(false);
    });
  });
});
