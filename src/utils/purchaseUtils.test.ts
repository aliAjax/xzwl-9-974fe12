import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import {
  calculatePurchaseSuggestions,
  mergeSuggestionsWithDecisions,
  groupBySupplier,
  createPurchaseDecision,
  cleanObsoleteDecisions,
} from './purchaseUtils';
import {
  createMockOrder,
  createMockRecipe,
  createMockIngredientBatch,
  createExpiringIngredientBatches,
  createCompletedOrder,
  TEST_TODAY,
} from '../test/testHelpers';
import { addDaysToDate } from './dateUtils';
import * as dateUtils from './dateUtils';
import type { Recipe } from '../types';

vi.mock('./dateUtils', async () => {
  const actual = await vi.importActual('./dateUtils');
  return {
    ...actual,
    getToday: vi.fn(() => TEST_TODAY),
  };
});

describe('purchaseUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (dateUtils.getToday as Mock).mockReturnValue(TEST_TODAY);
  });

  describe('calculatePurchaseSuggestions', () => {
    it('应该正确计算原料需求和采购建议', () => {
      const recipe = createMockRecipe({
        id: 'recipe-purchase',
        ingredients: [
          { ingredientId: 'ing-001', name: '沉香粉', quantity: 50, unit: 'g' },
        ],
      });

      const order = createMockOrder({
        id: 'order-purchase',
        recipeId: recipe.id,
        quantity: 200,
        status: 'in_production',
      });

      const ingredient = createMockIngredientBatch({
        id: 'ing-001',
        name: '沉香粉',
        quantity: 50,
        safetyStock: 100,
        expiryDate: addDaysToDate(TEST_TODAY, 180),
      });

      const suggestions = calculatePurchaseSuggestions([order], [ingredient], [recipe]);

      expect(suggestions.length).toBe(1);
      expect(suggestions[0].name).toBe('沉香粉');
      expect(suggestions[0].pendingDemand).toBe(100);
      expect(suggestions[0].gap).toBeGreaterThan(0);
      expect(suggestions[0].suggestedPurchase).toBeGreaterThan(0);
    });

    it('应该正确处理多批次临期原料折算', () => {
      const recipe = createMockRecipe({
        id: 'recipe-expiry',
        ingredients: [
          { ingredientId: 'ing-expired', name: '临期原料', quantity: 50, unit: 'g' },
        ],
      });

      const order = createMockOrder({
        id: 'order-expiry',
        recipeId: recipe.id,
        quantity: 400,
        status: 'in_production',
      });

      const expiringBatches = createExpiringIngredientBatches();

      const suggestions = calculatePurchaseSuggestions([order], expiringBatches, [recipe]);

      expect(suggestions.length).toBe(1);
      const suggestion = suggestions[0];

      const expectedStock = 0 + 100 * 0.3 + 100 * 0.7 + 100;
      expect(suggestion.currentStock).toBeCloseTo(expectedStock, 1);
      expect(suggestion.daysToExpiry).toBe(-1);
    });

    it('已过期的原料不计入库存', () => {
      const recipe = createMockRecipe({
        id: 'recipe-expired',
        ingredients: [
          { ingredientId: 'ing-expired-only', name: '过期原料', quantity: 50, unit: 'g' },
        ],
      });

      const order = createMockOrder({
        id: 'order-expired',
        recipeId: recipe.id,
        quantity: 100,
        status: 'in_production',
      });

      const expiredIngredient = createMockIngredientBatch({
        id: 'ing-expired-only',
        name: '过期原料',
        quantity: 1000,
        expiryDate: addDaysToDate(TEST_TODAY, -10),
        safetyStock: 50,
      });

      const suggestions = calculatePurchaseSuggestions([order], [expiredIngredient], [recipe]);

      expect(suggestions.length).toBe(1);
      expect(suggestions[0].currentStock).toBe(0);
      expect(suggestions[0].gap).toBeGreaterThan(0);
    });

    it('已完成订单不参与采购需求计算', () => {
      const recipe = createMockRecipe({
        id: 'recipe-completed',
        ingredients: [
          { ingredientId: 'ing-completed', name: '已完成原料', quantity: 50, unit: 'g' },
        ],
      });

      const completedOrder = createCompletedOrder();
      completedOrder.recipeId = recipe.id;
      completedOrder.quantity = 1000;

      const activeOrder = createMockOrder({
        id: 'order-active-purchase',
        recipeId: recipe.id,
        quantity: 100,
        status: 'in_production',
      });

      const ingredient = createMockIngredientBatch({
        id: 'ing-completed',
        name: '已完成原料',
        quantity: 0,
        safetyStock: 50,
        expiryDate: addDaysToDate(TEST_TODAY, 180),
      });

      const suggestions = calculatePurchaseSuggestions(
        [completedOrder, activeOrder],
        [ingredient],
        [recipe]
      );

      expect(suggestions.length).toBe(1);
      const expectedDemand = (50 / 100) * 100;
      expect(suggestions[0].pendingDemand).toBeCloseTo(expectedDemand, 1);
    });

    it('应该正确关联相关订单', () => {
      const recipe = createMockRecipe({
        id: 'recipe-related',
        ingredients: [
          { ingredientId: 'ing-related', name: '关联原料', quantity: 50, unit: 'g' },
        ],
      });

      const order1 = createMockOrder({
        id: 'order-1',
        orderNo: 'XY-TEST-001',
        recipeId: recipe.id,
        quantity: 100,
        status: 'in_production',
        deliveryDate: addDaysToDate(TEST_TODAY, 10),
        priority: 'high',
      });

      const order2 = createMockOrder({
        id: 'order-2',
        orderNo: 'XY-TEST-002',
        recipeId: recipe.id,
        quantity: 200,
        status: 'in_production',
        deliveryDate: addDaysToDate(TEST_TODAY, 30),
        priority: 'medium',
      });

      const ingredient = createMockIngredientBatch({
        id: 'ing-related',
        name: '关联原料',
        quantity: 0,
        safetyStock: 50,
        expiryDate: addDaysToDate(TEST_TODAY, 180),
      });

      const suggestions = calculatePurchaseSuggestions([order1, order2], [ingredient], [recipe]);

      expect(suggestions.length).toBe(1);
      expect(suggestions[0].relatedOrders.length).toBe(2);
      expect(suggestions[0].relatedOrders[0].daysToDelivery).toBeLessThan(
        suggestions[0].relatedOrders[1].daysToDelivery
      );
    });

    it('应该按优先级和缺口排序', () => {
      const highPriorityRecipe = createMockRecipe({
        id: 'recipe-high',
        ingredients: [
          { ingredientId: 'ing-critical', name: '紧急原料', quantity: 50, unit: 'g' },
        ],
      });

      const lowPriorityRecipe = createMockRecipe({
        id: 'recipe-low',
        ingredients: [
          { ingredientId: 'ing-normal', name: '普通原料', quantity: 50, unit: 'g' },
        ],
      });

      const urgentOrder = createMockOrder({
        id: 'order-urgent-purchase',
        recipeId: highPriorityRecipe.id,
        quantity: 1000,
        status: 'in_production',
        deliveryDate: addDaysToDate(TEST_TODAY, 5),
        priority: 'high',
      });

      const normalOrder = createMockOrder({
        id: 'order-normal',
        recipeId: lowPriorityRecipe.id,
        quantity: 100,
        status: 'in_production',
        deliveryDate: addDaysToDate(TEST_TODAY, 60),
        priority: 'low',
      });

      const criticalIngredient = createMockIngredientBatch({
        id: 'ing-critical',
        name: '紧急原料',
        quantity: 0,
        safetyStock: 50,
        expiryDate: addDaysToDate(TEST_TODAY, 180),
      });

      const normalIngredient = createMockIngredientBatch({
        id: 'ing-normal',
        name: '普通原料',
        quantity: 0,
        safetyStock: 50,
        expiryDate: addDaysToDate(TEST_TODAY, 180),
      });

      const suggestions = calculatePurchaseSuggestions(
        [urgentOrder, normalOrder],
        [criticalIngredient, normalIngredient],
        [highPriorityRecipe, lowPriorityRecipe]
      );

      expect(suggestions.length).toBe(2);
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      expect(priorityOrder[suggestions[0].priority]).toBeLessThan(
        priorityOrder[suggestions[1].priority]
      );
    });

    it('不应该返回缺口为零且无建议采购量的原料', () => {
      const recipe = createMockRecipe({
        id: 'recipe-no-gap',
        ingredients: [
          { ingredientId: 'ing-sufficient', name: '充足原料', quantity: 50, unit: 'g' },
        ],
      });

      const order = createMockOrder({
        id: 'order-sufficient',
        recipeId: recipe.id,
        quantity: 100,
        status: 'in_production',
      });

      const sufficientIngredient = createMockIngredientBatch({
        id: 'ing-sufficient',
        name: '充足原料',
        quantity: 1000,
        safetyStock: 50,
        expiryDate: addDaysToDate(TEST_TODAY, 180),
      });

      const suggestions = calculatePurchaseSuggestions([order], [sufficientIngredient], [recipe]);

      expect(suggestions.length).toBe(0);
    });

    it('应该正确计算安全库存缺口', () => {
      const recipe = createMockRecipe({
        id: 'recipe-safety',
        ingredients: [
          { ingredientId: 'ing-safety', name: '安全库存原料', quantity: 10, unit: 'g' },
        ],
      });

      const order = createMockOrder({
        id: 'order-safety',
        recipeId: recipe.id,
        quantity: 100,
        status: 'in_production',
      });

      const ingredient = createMockIngredientBatch({
        id: 'ing-safety',
        name: '安全库存原料',
        quantity: 15,
        safetyStock: 100,
        expiryDate: addDaysToDate(TEST_TODAY, 180),
      });

      const suggestions = calculatePurchaseSuggestions([order], [ingredient], [recipe]);

      expect(suggestions.length).toBe(1);
      expect(suggestions[0].safetyStockGap).toBeGreaterThan(0);
    });

    it('应该正确处理高优先级订单的优先级计算', () => {
      const recipe = createMockRecipe({
        id: 'recipe-urgent-calc',
        ingredients: [
          { ingredientId: 'ing-urgent-calc', name: '高优原料', quantity: 50, unit: 'g' },
        ],
      });

      const urgentOrder = createMockOrder({
        id: 'order-urgent-calc',
        recipeId: recipe.id,
        quantity: 200,
        status: 'in_production',
        deliveryDate: addDaysToDate(TEST_TODAY, 10),
        priority: 'high',
      });

      const ingredient = createMockIngredientBatch({
        id: 'ing-urgent-calc',
        name: '高优原料',
        quantity: 0,
        safetyStock: 50,
        expiryDate: addDaysToDate(TEST_TODAY, 180),
      });

      const suggestions = calculatePurchaseSuggestions([urgentOrder], [ingredient], [recipe]);

      expect(suggestions.length).toBe(1);
      expect(['critical', 'high']).toContain(suggestions[0].priority);
    });

    it('应该正确处理多原料多订单场景', () => {
      const recipe = createMockRecipe({
        id: 'recipe-multi',
        ingredients: [
          { ingredientId: 'ing-multi-1', name: '原料A', quantity: 30, unit: 'g' },
          { ingredientId: 'ing-multi-2', name: '原料B', quantity: 40, unit: 'g' },
        ],
      });

      const order1 = createMockOrder({
        id: 'order-multi-1',
        recipeId: recipe.id,
        quantity: 100,
        status: 'in_production',
      });

      const order2 = createMockOrder({
        id: 'order-multi-2',
        recipeId: recipe.id,
        quantity: 200,
        status: 'in_production',
      });

      const ingredient1 = createMockIngredientBatch({
        id: 'ing-multi-1',
        name: '原料A',
        quantity: 0,
        safetyStock: 50,
        expiryDate: addDaysToDate(TEST_TODAY, 180),
      });

      const ingredient2 = createMockIngredientBatch({
        id: 'ing-multi-2',
        name: '原料B',
        quantity: 0,
        safetyStock: 50,
        expiryDate: addDaysToDate(TEST_TODAY, 180),
      });

      const suggestions = calculatePurchaseSuggestions(
        [order1, order2],
        [ingredient1, ingredient2],
        [recipe]
      );

      expect(suggestions.length).toBe(2);

      const suggestion1 = suggestions.find(s => s.name === '原料A')!;
      const suggestion2 = suggestions.find(s => s.name === '原料B')!;

      expect(suggestion1.pendingDemand).toBeCloseTo(90);
      expect(suggestion2.pendingDemand).toBeCloseTo(120);
    });
  });

  describe('mergeSuggestionsWithDecisions', () => {
    it('应该正确合并采购建议和决策', () => {
      const recipe = createMockRecipe({
        id: 'recipe-merge',
        ingredients: [
          { ingredientId: 'ing-merge', name: '合并原料', quantity: 50, unit: 'g' },
        ],
      });

      const order = createMockOrder({
        id: 'order-merge',
        recipeId: recipe.id,
        quantity: 100,
        status: 'in_production',
      });

      const ingredient = createMockIngredientBatch({
        id: 'ing-merge',
        name: '合并原料',
        quantity: 0,
        safetyStock: 50,
        expiryDate: addDaysToDate(TEST_TODAY, 180),
      });

      const suggestions = calculatePurchaseSuggestions([order], [ingredient], [recipe]);

      const decisions = [
        {
          ingredientId: 'ing-merge',
          adjustedQuantity: 200,
          status: 'ordered' as const,
          notes: '测试备注',
          updatedAt: new Date().toISOString(),
        },
      ];

      const merged = mergeSuggestionsWithDecisions(suggestions, decisions);

      expect(merged.length).toBe(1);
      expect(merged[0].adjustedQuantity).toBe(200);
      expect(merged[0].finalQuantity).toBe(200);
      expect(merged[0].status).toBe('ordered');
      expect(merged[0].notes).toBe('测试备注');
    });

    it('没有决策时应该使用建议采购量', () => {
      const recipe = createMockRecipe({
        id: 'recipe-no-decision',
        ingredients: [
          { ingredientId: 'ing-no-decision', name: '无决策原料', quantity: 50, unit: 'g' },
        ],
      });

      const order = createMockOrder({
        id: 'order-no-decision',
        recipeId: recipe.id,
        quantity: 100,
        status: 'in_production',
      });

      const ingredient = createMockIngredientBatch({
        id: 'ing-no-decision',
        name: '无决策原料',
        quantity: 0,
        safetyStock: 50,
        expiryDate: addDaysToDate(TEST_TODAY, 180),
      });

      const suggestions = calculatePurchaseSuggestions([order], [ingredient], [recipe]);
      const merged = mergeSuggestionsWithDecisions(suggestions, []);

      expect(merged.length).toBe(1);
      expect(merged[0].adjustedQuantity).toBeNull();
      expect(merged[0].finalQuantity).toBe(merged[0].suggestedPurchase);
      expect(merged[0].status).toBe('pending');
    });
  });

  describe('groupBySupplier', () => {
    it('应该按供应商分组采购计划', () => {
      const planItems = [
        {
        ingredientId: 'ing-1',
        name: '原料1',
        currentStock: 0,
        safetyStock: 50,
        unit: 'g',
        expiryDate: TEST_TODAY,
        daysToExpiry: 180,
        pendingDemand: 100,
        demandGap: 100,
        safetyStockGap: 50,
        gap: 150,
        suggestedPurchase: 200,
        priority: 'high' as const,
        supplier: '供应商A',
        unitPrice: 50,
        relatedOrders: [],
        adjustedQuantity: null,
        finalQuantity: 200,
        status: 'pending' as const,
      },
        {
        ingredientId: 'ing-2',
        name: '原料2',
        currentStock: 0,
        safetyStock: 50,
        unit: 'g',
        expiryDate: TEST_TODAY,
        daysToExpiry: 180,
        pendingDemand: 50,
        demandGap: 50,
        safetyStockGap: 50,
        gap: 100,
        suggestedPurchase: 150,
        priority: 'critical' as const,
        supplier: '供应商A',
        unitPrice: 30,
        relatedOrders: [],
        adjustedQuantity: null,
        finalQuantity: 150,
        status: 'pending' as const,
      },
        {
        ingredientId: 'ing-3',
        name: '原料3',
        currentStock: 0,
        safetyStock: 50,
        unit: 'g',
        expiryDate: TEST_TODAY,
        daysToExpiry: 180,
        pendingDemand: 80,
        demandGap: 80,
        safetyStockGap: 50,
        gap: 130,
        suggestedPurchase: 180,
        priority: 'medium' as const,
        supplier: '供应商B',
        unitPrice: 20,
        relatedOrders: [],
        adjustedQuantity: null,
        finalQuantity: 180,
        status: 'pending' as const,
      },
      ];

      const groups = groupBySupplier(planItems);

      expect(groups.length).toBe(2);

      const groupA = groups.find(g => g.supplier === '供应商A')!;
      const groupB = groups.find(g => g.supplier === '供应商B')!;

      expect(groupA.items.length).toBe(2);
      expect(groupA.totalQuantity).toBe(350);
      expect(groupA.totalEstimatedCost).toBe(200 * 50 + 150 * 30);
      expect(groupA.priority).toBe('critical');

      expect(groupB.items.length).toBe(1);
      expect(groupB.priority).toBe('medium');
    });

    it('应该排除已跳过的项目', () => {
      const planItems = [
        {
        ingredientId: 'ing-skip',
        name: '跳过原料',
        currentStock: 0,
        safetyStock: 50,
        unit: 'g',
        expiryDate: TEST_TODAY,
        daysToExpiry: 180,
        pendingDemand: 100,
        demandGap: 100,
        safetyStockGap: 50,
        gap: 150,
        suggestedPurchase: 200,
        priority: 'high' as const,
        supplier: '供应商A',
        unitPrice: 50,
        relatedOrders: [],
        adjustedQuantity: null,
        finalQuantity: 200,
        status: 'skip' as const,
      },
        {
        ingredientId: 'ing-keep',
        name: '保留原料',
        currentStock: 0,
        safetyStock: 50,
        unit: 'g',
        expiryDate: TEST_TODAY,
        daysToExpiry: 180,
        pendingDemand: 100,
        demandGap: 100,
        safetyStockGap: 50,
        gap: 150,
        suggestedPurchase: 150,
        priority: 'medium' as const,
        supplier: '供应商A',
        unitPrice: 30,
        relatedOrders: [],
        adjustedQuantity: null,
        finalQuantity: 150,
        status: 'pending' as const,
      },
      ];

      const groups = groupBySupplier(planItems);

      expect(groups.length).toBe(1);
      expect(groups[0].items.length).toBe(1);
      expect(groups[0].items[0].name).toBe('保留原料');
    });
  });

  describe('createPurchaseDecision', () => {
    it('应该创建新的采购决策', () => {
      const decisions = createPurchaseDecision('ing-new', { adjustedQuantity: 100 }, []);

      expect(decisions.length).toBe(1);
      expect(decisions[0].ingredientId).toBe('ing-new');
      expect(decisions[0].adjustedQuantity).toBe(100);
      expect(decisions[0].status).toBe('pending');
    });

    it('应该更新现有采购决策', () => {
      const existingDecisions = [
        {
          ingredientId: 'ing-existing',
          adjustedQuantity: 100,
          status: 'pending' as const,
          updatedAt: '2026-01-01',
        },
      ];

      const updated = createPurchaseDecision(
        'ing-existing',
        { adjustedQuantity: 200, status: 'ordered' },
        existingDecisions
      );

      expect(updated.length).toBe(1);
      expect(updated[0].adjustedQuantity).toBe(200);
      expect(updated[0].status).toBe('ordered');
    });
  });

  describe('cleanObsoleteDecisions', () => {
    it('应该清理过时的采购决策', () => {
      const decisions = [
        { ingredientId: 'ing-keep', adjustedQuantity: 100, status: 'pending' as const, updatedAt: '2026-01-01' },
        { ingredientId: 'ing-remove', adjustedQuantity: 200, status: 'ordered' as const, updatedAt: '2026-01-02' },
      ];

      const currentIds = ['ing-keep', 'ing-new'];

      const cleaned = cleanObsoleteDecisions(decisions, currentIds);

      expect(cleaned.length).toBe(1);
      expect(cleaned[0].ingredientId).toBe('ing-keep');
    });
  });
});
