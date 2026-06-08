import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import {
  selectOrderWarnings,
  selectRecipeById,
  selectOrdersByStep,
  selectOrdersByDate,
  selectCraftsmanTasks,
  selectCraftsmanWorkload,
  selectAllCraftsmenWorkload,
  selectSortedCraftsmenForAssignment,
  selectOrderMaterialGap,
  selectCustomerOrderSummaries,
  selectCustomerOrderSummary,
} from './selectors';
import {
  createMockRecipe,
  createMockOrder,
  createCompletedOrder,
  createMockIngredientBatch,
  createMockWarning,
  TEST_TODAY,
} from '../test/testHelpers';
import { addDaysToDate } from '../utils/dateUtils';
import * as dateUtils from '../utils/dateUtils';
import type { AppState } from '../types';
import { STEP_ORDER } from '../types';
import { mockCraftsmen } from '../data/mockCraftsmen';

vi.mock('../utils/dateUtils', async () => {
  const actual = await vi.importActual('../utils/dateUtils');
  return {
    ...actual,
    getToday: vi.fn(() => TEST_TODAY),
  };
});

const createTestState = (overrides: Partial<AppState> = {}): AppState => {
  const defaultState: AppState = {
    orders: [],
    recipes: [],
    ingredients: [],
    craftsmen: mockCraftsmen,
    warnings: [],
    currentView: 'kanban',
    selectedDate: TEST_TODAY,
    selectedOrderId: null,
    showIngredientPanel: false,
    showWarningPanel: false,
    showCreateOrderModal: false,
    showRecipePanel: false,
    showRecipeModal: false,
    showSchedulePanel: false,
    showPrintPreview: false,
    showPurchaseSuggestion: false,
    showScheduleAdjustModal: false,
    scheduleAdjustOrderId: null,
    printOrderId: null,
    editingRecipeId: null,
    copyingRecipeId: null,
    purchaseSuggestions: [],
    purchaseDecisions: [],
    purchasePlanItems: [],
    supplierPurchaseGroups: [],
    deliveryBoard: {
      showCompletedOrders: false,
      sortBy: 'deliveryDate',
      filterRiskLevel: 'all',
      expandedCustomers: [],
      showThisWeekOnly: false,
    },
    showIngredientGapModal: false,
    ingredientGapOrderId: null,
    showSandboxModal: false,
    sandboxSelectedOrderIds: [],
    sandboxPriorityStrategy: 'priority_first',
    sandboxResult: null,
    ...overrides,
  };
  return defaultState;
};

describe('store/selectors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (dateUtils.getToday as Mock).mockReturnValue(TEST_TODAY);
  });

  describe('selectOrderWarnings', () => {
    it('应该正确返回订单关联的未解决预警', () => {
      const warning1 = createMockWarning({ id: 'w1', relatedId: 'order-1', isResolved: false });
      const warning2 = createMockWarning({ id: 'w2', relatedId: 'order-1', isResolved: true });
      const warning3 = createMockWarning({ id: 'w3', relatedId: 'order-2', isResolved: false });
      const state = createTestState({ warnings: [warning1, warning2, warning3] });

      const result = selectOrderWarnings(state, 'order-1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('w1');
    });

    it('当没有预警时应该返回空数组', () => {
      const state = createTestState({ warnings: [] });
      const result = selectOrderWarnings(state, 'order-1');
      expect(result).toEqual([]);
    });
  });

  describe('selectRecipeById', () => {
    it('应该正确根据ID查找配方', () => {
      const recipe1 = createMockRecipe({ id: 'recipe-1' });
      const recipe2 = createMockRecipe({ id: 'recipe-2' });
      const state = createTestState({ recipes: [recipe1, recipe2] });

      const result = selectRecipeById(state, 'recipe-1');
      expect(result?.id).toBe('recipe-1');
    });

    it('当配方不存在时应该返回 undefined', () => {
      const state = createTestState({ recipes: [] });
      const result = selectRecipeById(state, 'non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('selectOrdersByStep', () => {
    it('应该正确返回待处理订单到第一步', () => {
      const pendingOrder = createMockOrder({ id: 'order-pending', status: 'pending' });
      const state = createTestState({ orders: [pendingOrder] });

      const result = selectOrdersByStep(state, STEP_ORDER[0]);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('order-pending');
    });

    it('应该正确返回进行中工序的订单', () => {
      const order = createMockOrder({
        id: 'order-shaping',
        currentStepIndex: 1,
        status: 'in_production',
      });
      order.steps.forEach((step, index) => {
        step.status = index === 1 ? 'in_progress' : index < 1 ? 'completed' : 'not_started';
      });
      const state = createTestState({ orders: [order] });

      const result = selectOrdersByStep(state, 'shaping');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('order-shaping');
    });

    it('已完成订单不应该出现在任何工序中', () => {
      const completedOrder = createCompletedOrder();
      const state = createTestState({ orders: [completedOrder] });

      for (const step of STEP_ORDER) {
        const result = selectOrdersByStep(state, step);
        expect(result).toHaveLength(0);
      }
    });
  });

  describe('selectOrdersByDate', () => {
    it('应该正确返回指定日期正在进行的订单', () => {
      const order = createMockOrder({
        id: 'order-date',
        status: 'in_production',
      });
      const date = TEST_TODAY;
      order.steps.forEach((step, index) => {
        step.startDate = addDaysToDate(TEST_TODAY, index * 5);
        step.endDate = addDaysToDate(TEST_TODAY, index * 5 + 2);
        step.status = index === 0 ? 'in_progress' : 'not_started';
      });
      const state = createTestState({ orders: [order] });

      const result = selectOrdersByDate(state, date);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('order-date');
    });
  });

  describe('selectCraftsmanTasks', () => {
    it('应该正确返回工匠分配的任务', () => {
      const order1 = createMockOrder({ id: 'order-1' });
      const order2 = createMockOrder({ id: 'order-2' });
      order1.steps[0].assignee = '李师傅';
      order2.steps[1].assignee = '李师傅';
      order1.steps[2].assignee = '王师傅';
      const state = createTestState({ orders: [order1, order2] });

      const result = selectCraftsmanTasks(state, '李师傅');
      expect(result).toHaveLength(2);
      expect(result[0].order.id).toBe('order-1');
      expect(result[1].order.id).toBe('order-2');
    });

    it('没有分配任务时应该返回空数组', () => {
      const state = createTestState({ orders: [] });
      const result = selectCraftsmanTasks(state, '无工匠');
      expect(result).toEqual([]);
    });
  });

  describe('selectCraftsmanWorkload', () => {
    it('应该正确返回工匠工作负载', () => {
      const state = createTestState({});
      const craftsmanId = mockCraftsmen[0].id;
      const result = selectCraftsmanWorkload(state, craftsmanId);
      expect(result.craftsmanId).toBe(craftsmanId);
      expect(result.craftsmanName).toBe(mockCraftsmen[0].name);
    });

    it('工匠不存在时应该返回默认值', () => {
      const state = createTestState({});
      const result = selectCraftsmanWorkload(state, 'non-existent');
      expect(result.craftsmanId).toBe('non-existent');
      expect(result.taskCount).toBe(0);
    });
  });

  describe('selectAllCraftsmenWorkload', () => {
    it('应该返回所有工匠的工作负载', () => {
      const state = createTestState({});
      const result = selectAllCraftsmenWorkload(state);
      expect(result).toHaveLength(mockCraftsmen.length);
    });
  });

  describe('selectSortedCraftsmenForAssignment', () => {
    it('应该按分配优先级返回排序后的工匠', () => {
      const state = createTestState({});
      const result = selectSortedCraftsmenForAssignment(state, 'kneading');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('selectOrderMaterialGap', () => {
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

      const state = createTestState({
        orders: [order],
        recipes: [recipe],
        ingredients: [ingredient],
      });

      const result = selectOrderMaterialGap(state, order.id);
      expect(result).not.toBeNull();
      expect(result?.totalGapCount).toBeGreaterThan(0);
      expect(result?.gaps.length).toBeGreaterThan(0);
    });

    it('订单不存在时应该返回null', () => {
      const state = createTestState({});
      const result = selectOrderMaterialGap(state, 'non-existent');
      expect(result).toBeNull();
    });
  });

  describe('selectCustomerOrderSummaries', () => {
    it('应该正确返回客户订单汇总', () => {
      const recipe = createMockRecipe({ id: 'recipe-summary' });
      const order = createMockOrder({
        id: 'order-summary',
        recipeId: recipe.id,
        customerName: '汇总客户',
        status: 'in_production',
      });
      const state = createTestState({
        orders: [order],
        recipes: [recipe],
      });

      const result = selectCustomerOrderSummaries(state);
      expect(result).toHaveLength(1);
      expect(result[0].customerName).toBe('汇总客户');
    });

    it('空订单时应该返回空数组', () => {
      const state = createTestState({});
      const result = selectCustomerOrderSummaries(state);
      expect(result).toEqual([]);
    });
  });

  describe('selectCustomerOrderSummary', () => {
    it('应该正确返回指定客户的汇总', () => {
      const recipe = createMockRecipe({ id: 'recipe-cust' });
      const order = createMockOrder({
        id: 'order-cust',
        recipeId: recipe.id,
        customerName: '客户A',
        status: 'in_production',
      });
      const state = createTestState({
        orders: [order],
        recipes: [recipe],
      });

      const result = selectCustomerOrderSummary(state, '客户A');
      expect(result?.customerName).toBe('客户A');
    });

    it('客户不存在时应该返回 undefined', () => {
      const state = createTestState({});
      const result = selectCustomerOrderSummary(state, '不存在的客户');
      expect(result).toBeUndefined();
    });
  });
});
