import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import {
  calculateEffectiveStock,
  buildIngredientMaps,
  getIngredientStockInfo,
  calculateIngredientDemand,
  calculateRequiredQuantity,
  getOrderMaterialGap,
} from './ingredientUtils';
import {
  createMockRecipe,
  createMockIngredientBatch,
  createMockOrder,
  createCompletedOrder,
  createExpiringIngredientBatches,
  TEST_TODAY,
} from '../test/testHelpers';
import { addDaysToDate } from './dateUtils';
import * as dateUtils from './dateUtils';

vi.mock('./dateUtils', async () => {
  const actual = await vi.importActual('./dateUtils');
  return {
    ...actual,
    getToday: vi.fn(() => TEST_TODAY),
  };
});

describe('ingredientUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (dateUtils.getToday as Mock).mockReturnValue(TEST_TODAY);
  });

  describe('calculateEffectiveStock', () => {
    it('应该正确计算有效期>30天的原料库存为100%', () => {
      const batches = [
        createMockIngredientBatch({
          quantity: 100,
          expiryDate: addDaysToDate(TEST_TODAY, 60),
        }),
      ];
      expect(calculateEffectiveStock(batches, TEST_TODAY)).toBe(100);
    });

    it('应该正确计算有效期<=30天的原料库存为70%', () => {
      const batches = [
        createMockIngredientBatch({
          quantity: 100,
          expiryDate: addDaysToDate(TEST_TODAY, 30),
        }),
      ];
      expect(calculateEffectiveStock(batches, TEST_TODAY)).toBeCloseTo(70);
    });

    it('应该正确计算有效期<=7天的原料库存为30%', () => {
      const batches = [
        createMockIngredientBatch({
          quantity: 100,
          expiryDate: addDaysToDate(TEST_TODAY, 7),
        }),
      ];
      expect(calculateEffectiveStock(batches, TEST_TODAY)).toBeCloseTo(30);
    });

    it('应该正确计算过期原料库存为0%', () => {
      const batches = [
        createMockIngredientBatch({
          quantity: 100,
          expiryDate: addDaysToDate(TEST_TODAY, -1),
        }),
      ];
      expect(calculateEffectiveStock(batches, TEST_TODAY)).toBe(0);
    });

    it('应该正确聚合多个不同批次的有效库存', () => {
      const batches = createExpiringIngredientBatches();
      const expected = 0 + 30 + 70 + 100;
      expect(calculateEffectiveStock(batches, TEST_TODAY)).toBe(expected);
    });

    it('空批次列表应该返回0', () => {
      expect(calculateEffectiveStock([], TEST_TODAY)).toBe(0);
    });
  });

  describe('buildIngredientMaps', () => {
    it('应该正确构建 ingredientId 到名称和名称到批次的映射', () => {
      const batches = [
        createMockIngredientBatch({ id: 'ing-1', name: '原料A' }),
        createMockIngredientBatch({ id: 'ing-2', name: '原料B' }),
        createMockIngredientBatch({ id: 'ing-1', name: '原料A', batchNo: 'BATCH-2' }),
      ];
      const { ingredientIdToName, ingredientNameToBatches } = buildIngredientMaps(batches);
      expect(ingredientNameToBatches.get('原料A')).toHaveLength(2);
      expect(ingredientNameToBatches.get('原料B')).toHaveLength(1);
      expect(ingredientIdToName.get('ing-1')).toBe('原料A');
      expect(ingredientIdToName.get('ing-2')).toBe('原料B');
    });

    it('空数组应该返回空映射', () => {
      const { ingredientIdToName, ingredientNameToBatches } = buildIngredientMaps([]);
      expect(ingredientNameToBatches.size).toBe(0);
      expect(ingredientIdToName.size).toBe(0);
    });
  });

  describe('getIngredientStockInfo', () => {
    it('应该正确返回原料库存信息', () => {
      const batches = createExpiringIngredientBatches();
      const info = getIngredientStockInfo(batches, TEST_TODAY);
      expect(info.totalEffectiveStock).toBe(200);
      expect(info.minDaysToExpiry).toBe(-1);
    });

    it('应该正确识别正常库存状态', () => {
      const batches = [
        createMockIngredientBatch({
          quantity: 100,
          expiryDate: addDaysToDate(TEST_TODAY, 180),
        }),
      ];
      const info = getIngredientStockInfo(batches, TEST_TODAY);
      expect(info.totalEffectiveStock).toBe(100);
      expect(info.minDaysToExpiry).toBe(180);
    });
  });

  describe('calculateRequiredQuantity', () => {
    it('应该正确计算订单所需原料数量', () => {
      const recipe = createMockRecipe({
        ingredients: [
          { ingredientId: 'ing-1', name: '沉香粉', quantity: 50, unit: 'g' },
        ],
      });
      const result = calculateRequiredQuantity('ing-1', 100, recipe);
      expect(result).toBeCloseTo(50);
    });

    it('当配方中不存在该原料时应该返回0', () => {
      const recipe = createMockRecipe();
      const result = calculateRequiredQuantity('non-existent', 100, recipe);
      expect(result).toBe(0);
    });
  });

  describe('calculateIngredientDemand', () => {
    it('应该正确计算原料需求并关联订单', () => {
      const recipe = createMockRecipe({
        id: 'recipe-demand',
        ingredients: [
          { ingredientId: 'ing-demand', name: '需求原料', quantity: 50, unit: 'g' },
        ],
      });
      const order1 = createMockOrder({
        id: 'order-dmd-1',
        recipeId: recipe.id,
        quantity: 100,
        status: 'in_production',
      });
      const order2 = createMockOrder({
        id: 'order-dmd-2',
        recipeId: recipe.id,
        quantity: 200,
        status: 'in_production',
      });
      const completedOrder = createCompletedOrder();
      completedOrder.id = 'order-dmd-completed';
      completedOrder.recipeId = recipe.id;
      completedOrder.quantity = 1000;

      const ingredientIdToName = new Map([['ing-demand', '需求原料']]);
      const result = calculateIngredientDemand(
        '需求原料',
        ingredientIdToName,
        [order1, order2, completedOrder],
        [recipe]
      );

      expect(result.total).toBeCloseTo(50 + 100);
      expect(result.orders).toHaveLength(2);
      expect(result.orders.map((o) => o.orderNo)).not.toContain(completedOrder.orderNo);
    });
  });

  describe('getOrderMaterialGap', () => {
    it('应该正确计算订单物料缺口', () => {
      const recipe = createMockRecipe({
        id: 'recipe-gap',
        ingredients: [
          { ingredientId: 'ing-gap', name: '缺口原料', quantity: 50, unit: 'g' },
        ],
      });
      const order = createMockOrder({
        id: 'order-gap',
        recipeId: recipe.id,
        quantity: 200,
        status: 'in_production',
      });
      const ingredient = createMockIngredientBatch({
        id: 'ing-gap',
        name: '缺口原料',
        quantity: 10,
        expiryDate: addDaysToDate(TEST_TODAY, 180),
      });

      const result = getOrderMaterialGap(order.id, [order], [recipe], [ingredient]);

      expect(result).not.toBeNull();
      expect(result?.orderId).toBe(order.id);
      expect(result?.totalGapCount).toBe(1);
      expect(result?.gaps.length).toBe(1);
      expect(result?.gaps[0].gap).toBeCloseTo(90);
    });

    it('当库存充足时应该返回无缺口', () => {
      const recipe = createMockRecipe({
        id: 'recipe-sufficient',
        ingredients: [
          { ingredientId: 'ing-suf', name: '充足原料', quantity: 50, unit: 'g' },
        ],
      });
      const order = createMockOrder({
        id: 'order-suf',
        recipeId: recipe.id,
        quantity: 100,
        status: 'in_production',
      });
      const ingredient = createMockIngredientBatch({
        id: 'ing-suf',
        name: '充足原料',
        quantity: 1000,
        expiryDate: addDaysToDate(TEST_TODAY, 180),
      });

      const result = getOrderMaterialGap(order.id, [order], [recipe], [ingredient]);

      expect(result).not.toBeNull();
      expect(result?.totalGapCount).toBe(0);
      expect(result?.gaps.length).toBe(0);
    });

    it('当订单不存在时应该返回null', () => {
      const result = getOrderMaterialGap('non-existent', [], [], []);
      expect(result).toBeNull();
    });

    it('当配方不存在时应该返回null', () => {
      const order = createMockOrder({ id: 'order-no-recipe', recipeId: 'non-existent' });
      const result = getOrderMaterialGap(order.id, [order], [], []);
      expect(result).toBeNull();
    });
  });
});
