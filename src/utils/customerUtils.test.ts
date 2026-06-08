import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import {
  calculateRiskLevel,
  calculateCustomerSummaries,
  getCustomerSummary,
} from './customerUtils';
import {
  createMockRecipe,
  createMockOrder,
  createCompletedOrder,
  createMockWarning,
  createMockIngredientBatch,
  TEST_TODAY,
} from '../test/testHelpers';
import { addDaysToDate } from './dateUtils';
import * as dateUtils from './dateUtils';
import type { Warning, Order } from '../types';

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
  const { id, recipeId, ...rest } = overrides;
  return createMockOrder({
    ...rest,
    id,
    recipeId,
  });
};

describe('customerUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (dateUtils.getToday as Mock).mockReturnValue(TEST_TODAY);
  });

  describe('calculateRiskLevel', () => {
    it('应该在存在逾期订单时返回 critical', () => {
      const overdueOrder = createTestOrder({
        id: 'order-overdue',
        recipeId: 'recipe-test',
        deliveryDate: addDaysToDate(TEST_TODAY, -5),
        status: 'in_production',
      });

      const level = calculateRiskLevel(
        [overdueOrder],
        () => [],
        TEST_TODAY
      );

      expect(level).toBe('critical');
    });

    it('应该在高优先级且临近交付时返回 high', () => {
      const highPriorityOrder = createTestOrder({
        id: 'order-high',
        recipeId: 'recipe-test',
        priority: 'high',
        status: 'in_production',
        deliveryDate: addDaysToDate(TEST_TODAY, 5),
      });

      const level = calculateRiskLevel(
        [highPriorityOrder],
        () => [],
        TEST_TODAY
      );

      expect(level).toBe('high');
    });

    it('应该在高优先级但不临近交付时返回 medium', () => {
      const highPriorityOrder = createTestOrder({
        id: 'order-high-medium',
        recipeId: 'recipe-test',
        priority: 'high',
        status: 'in_production',
        deliveryDate: addDaysToDate(TEST_TODAY, 10),
      });

      const level = calculateRiskLevel(
        [highPriorityOrder],
        () => [],
        TEST_TODAY
      );

      expect(level).toBe('medium');
    });

    it('应该在存在预警时返回 medium', () => {
      const normalOrder = createTestOrder({
        id: 'order-warn',
        recipeId: 'recipe-test',
        status: 'in_production',
        deliveryDate: addDaysToDate(TEST_TODAY, 10),
      });

      const getOrderWarnings = (orderId: string): Warning[] => {
        if (orderId === 'order-warn') {
          return [createMockWarning({ relatedId: orderId, level: 'warning' })];
        }
        return [];
      };

      const level = calculateRiskLevel(
        [normalOrder],
        getOrderWarnings,
        TEST_TODAY
      );

      expect(level).toBe('medium');
    });

    it('应该在无风险时返回 low', () => {
      const nearDeliveryOrder = createTestOrder({
        id: 'order-near',
        recipeId: 'recipe-test',
        status: 'in_production',
        deliveryDate: addDaysToDate(TEST_TODAY, 3),
        priority: 'medium',
      });

      const level = calculateRiskLevel(
        [nearDeliveryOrder],
        () => [],
        TEST_TODAY
      );

      expect(level).toBe('low');
    });

    it('应该在正常情况下返回 low', () => {
      const normalOrder = createTestOrder({
        id: 'order-normal',
        recipeId: 'recipe-test',
        priority: 'medium',
        status: 'in_production',
        deliveryDate: addDaysToDate(TEST_TODAY, 30),
      });

      const level = calculateRiskLevel(
        [normalOrder],
        () => [],
        TEST_TODAY
      );

      expect(level).toBe('low');
    });

    it('已完成订单不影响风险等级', () => {
      const completedOverdueOrder = createCompletedOrder();
      completedOverdueOrder.id = 'order-completed-overdue';
      completedOverdueOrder.deliveryDate = addDaysToDate(TEST_TODAY, -10);
      completedOverdueOrder.priority = 'high';

      const level = calculateRiskLevel(
        [completedOverdueOrder],
        () => [],
        TEST_TODAY
      );

      expect(level).toBe('low');
    });
  });

  describe('calculateCustomerSummaries', () => {
    it('应该正确按客户汇总订单', () => {
      const recipe = createMockRecipe({ id: 'recipe-cust' });
      const customer1Order1 = createTestOrder({
        id: 'order-c1-1',
        recipeId: recipe.id,
        customerName: '客户A',
        deliveryDate: addDaysToDate(TEST_TODAY, 5),
      });
      const customer1Order2 = createTestOrder({
        id: 'order-c1-2',
        recipeId: recipe.id,
        customerName: '客户A',
        deliveryDate: addDaysToDate(TEST_TODAY, 20),
      });
      const customer2Order = createTestOrder({
        id: 'order-c2-1',
        recipeId: recipe.id,
        customerName: '客户B',
        deliveryDate: addDaysToDate(TEST_TODAY, 10),
      });

      const summaries = calculateCustomerSummaries(
        [customer1Order1, customer1Order2, customer2Order],
        {
          getOrderWarnings: () => [],
          warnings: [],
          ingredients: [],
          recipes: [recipe],
        }
      );

      expect(summaries).toHaveLength(2);
      expect(summaries[0].customerName).toBe('客户A');
      expect(summaries[0].totalOrders).toBe(2);
      expect(summaries[1].customerName).toBe('客户B');
      expect(summaries[1].totalOrders).toBe(1);
    });

    it('应该正确计算交付承诺信息', () => {
      const recipe = createMockRecipe({
        id: 'recipe-delivery',
        ingredients: [
          { ingredientId: 'ing-1', name: '原料1', quantity: 50, unit: 'g' },
        ],
      });
      const ingredient = createMockIngredientBatch({
        id: 'ing-1',
        name: '原料1',
        quantity: 0,
        expiryDate: addDaysToDate(TEST_TODAY, 180),
      });

      const order = createTestOrder({
        id: 'order-delivery',
        recipeId: recipe.id,
        customerName: '测试客户',
        deliveryDate: addDaysToDate(TEST_TODAY, 10),
        status: 'in_production',
        quantity: 100,
      });

      const summaries = calculateCustomerSummaries(
        [order],
        {
          getOrderWarnings: () => [],
          warnings: [],
          ingredients: [ingredient],
          recipes: [recipe],
        }
      );

      expect(summaries).toHaveLength(1);
      const summary = summaries[0];
      expect(summary.deliveryCommitment.earliestDeliveryDate).toBe(order.deliveryDate);
      expect(summary.deliveryCommitment.materialShortageRisk).toBe(true);
    });

    it('已完成订单不计入活跃订单统计', () => {
      const recipe = createMockRecipe({ id: 'recipe-completed' });
      const activeOrder = createTestOrder({
        id: 'order-active',
        recipeId: recipe.id,
        customerName: '测试客户',
        status: 'in_production',
      });
      const completedOrder = createCompletedOrder();
      completedOrder.id = 'order-completed';
      completedOrder.customerName = '测试客户';
      completedOrder.recipeId = recipe.id;

      const summaries = calculateCustomerSummaries(
        [activeOrder, completedOrder],
        {
          getOrderWarnings: () => [],
          warnings: [],
          ingredients: [],
          recipes: [recipe],
        }
      );

      expect(summaries).toHaveLength(1);
      expect(summaries[0].totalOrders).toBe(2);
      expect(summaries[0].inProductionOrders).toBe(1);
      expect(summaries[0].completedOrders).toBe(1);
    });

    it('空订单列表应该返回空数组', () => {
      const summaries = calculateCustomerSummaries([], {
        getOrderWarnings: () => [],
        warnings: [],
        ingredients: [],
        recipes: [],
      });

      expect(summaries).toEqual([]);
    });
  });

  describe('getCustomerSummary', () => {
    it('应该正确按客户名称筛选汇总', () => {
      const summaries = [
        { customerName: '客户A', totalOrders: 1 },
        { customerName: '客户B', totalOrders: 2 },
      ] as any;

      const result = getCustomerSummary('客户A', summaries);
      expect(result?.customerName).toBe('客户A');
      expect(result?.totalOrders).toBe(1);
    });

    it('客户名称不匹配时应该返回 undefined', () => {
      const summaries = [
        { customerName: '客户A', totalOrders: 1 },
      ] as any;

      const result = getCustomerSummary('不存在的客户', summaries);
      expect(result).toBeUndefined();
    });
  });
});
