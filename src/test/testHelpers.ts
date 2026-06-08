import { type Order, type ProductionStep, type Recipe, type IngredientBatch, type Warning, type StepType } from '../types';
import { addDaysToDate } from '../utils/dateUtils';

export const TEST_TODAY = '2026-06-07';

export const createMockRecipe = (overrides: Partial<Recipe> = {}): Recipe => ({
  id: 'recipe-test',
  name: '测试香方',
  description: '测试用香方',
  ingredients: [
    { ingredientId: 'ing-001', name: '沉香粉', quantity: 50, unit: 'g' },
    { ingredientId: 'ing-004', name: '粘粉', quantity: 15, unit: 'g' },
  ],
  dryingDays: 15,
  cellaringDays: 30,
  craftNotes: '',
  ...overrides,
});

export const createMockStep = (
  overrides: Partial<ProductionStep> & { orderId: string; stepType: StepType; index: number }
): ProductionStep => {
  const stepNames: Record<StepType, string> = {
    kneading: '揉料',
    shaping: '成型',
    drying: '阴干',
    cellaring: '窖藏',
    packaging: '包装',
  };
  const stepDurations: Record<StepType, number> = {
    kneading: 2,
    shaping: 3,
    drying: 15,
    cellaring: 30,
    packaging: 2,
  };

  const { orderId, stepType, index, ...restOverrides } = overrides;

  const baseDate = TEST_TODAY;
  const startDate = addDaysToDate(baseDate, index * 5);
  const duration = restOverrides.durationDays ?? stepDurations[stepType];

  return {
    id: `${orderId}-step-${index}`,
    orderId,
    stepType,
    stepName: stepNames[stepType],
    status: 'not_started',
    startDate,
    endDate: addDaysToDate(startDate, duration),
    durationDays: duration,
    notes: '',
    assignee: '',
    ...restOverrides,
  };
};

export const createMockOrder = (overrides: Partial<Order> = {}): Order => {
  const orderId = overrides.id ?? 'order-test';
  const stepTypes: StepType[] = ['kneading', 'shaping', 'drying', 'cellaring', 'packaging'];
  const steps = overrides.steps ?? stepTypes.map((type, index) =>
    createMockStep({ orderId, stepType: type, index })
  );

  const lastStep = steps[steps.length - 1];
  const deliveryDate = overrides.deliveryDate ?? (lastStep ? lastStep.endDate : TEST_TODAY);

  return {
    id: orderId,
    orderNo: 'XY-TEST-001',
    customerName: '测试客户',
    recipeId: 'recipe-test',
    quantity: 100,
    unit: '克',
    orderDate: TEST_TODAY,
    deliveryDate,
    status: 'in_production',
    priority: 'medium',
    currentStepIndex: 0,
    steps,
    ...overrides,
  };
};

export const createMockIngredientBatch = (
  overrides: Partial<IngredientBatch> = {}
): IngredientBatch => ({
  id: 'ing-test',
  name: '测试原料',
  batchNo: 'BATCH-TEST-001',
  quantity: 100,
  unit: 'g',
  unitPrice: 50,
  expiryDate: addDaysToDate(TEST_TODAY, 180),
  receiveDate: TEST_TODAY,
  supplier: '测试供应商',
  safetyStock: 50,
  ...overrides,
});

export const createMockWarning = (overrides: Partial<Warning> = {}): Warning => ({
  id: 'warn-test',
  type: 'delivery',
  level: 'warning',
  message: '测试预警',
  relatedId: 'order-test',
  relatedType: 'order',
  createdAt: new Date().toISOString(),
  isResolved: false,
  ...overrides,
});

export const createOrderWithDryingDelay = (): { order: Order; recipe: Recipe } => {
  const recipe = createMockRecipe({
    id: 'recipe-drying',
    dryingDays: 20,
    cellaringDays: 45,
  });

  const stepTypes: StepType[] = ['kneading', 'shaping', 'drying', 'cellaring', 'packaging'];
  const stepDurations: Record<StepType, number> = {
    kneading: 2,
    shaping: 3,
    drying: recipe.dryingDays,
    cellaring: recipe.cellaringDays,
    packaging: 2,
  };

  const orderId = 'order-drying-test';
  let currentDate = TEST_TODAY;
  const steps = stepTypes.map((type, index) => {
    const duration = stepDurations[type];
    const startDate = currentDate;
    const endDate = addDaysToDate(startDate, duration);
    currentDate = endDate;
    return createMockStep({
      orderId,
      stepType: type,
      index,
      startDate,
      endDate,
      durationDays: duration,
      status: index < 2 ? 'completed' : index === 2 ? 'in_progress' : 'not_started',
    });
  });

  const deliveryDate = addDaysToDate(TEST_TODAY, 60);

  const order = createMockOrder({
    id: orderId,
    recipeId: recipe.id,
    deliveryDate,
    steps,
    currentStepIndex: 2,
  });

  return { order, recipe };
};

export const createOrderWithMultipleSteps = (startDate: string = TEST_TODAY): Order => {
  const orderId = 'order-multi-step';
  const stepTypes: StepType[] = ['kneading', 'shaping', 'drying', 'cellaring', 'packaging'];
  const durations = [2, 3, 15, 30, 2];

  let currentDate = startDate;
  const steps = stepTypes.map((type, index) => {
    const duration = durations[index];
    const stepStart = currentDate;
    const stepEnd = addDaysToDate(stepStart, duration);
    currentDate = stepEnd;
    return createMockStep({
      orderId,
      stepType: type,
      index,
      startDate: stepStart,
      endDate: stepEnd,
      durationDays: duration,
      status: 'not_started',
    });
  });

  return createMockOrder({
    id: orderId,
    orderNo: 'XY-TEST-MULTI',
    steps,
    deliveryDate: steps[steps.length - 1].endDate,
  });
};

export const createExpiringIngredientBatches = (): IngredientBatch[] => {
  const baseDate = TEST_TODAY;
  return [
    createMockIngredientBatch({
      id: 'ing-expired',
      name: '临期原料',
      quantity: 100,
      expiryDate: addDaysToDate(baseDate, -1),
      safetyStock: 50,
    }),
    createMockIngredientBatch({
      id: 'ing-critical',
      name: '临期原料',
      batchNo: 'BATCH-TEST-CRITICAL',
      quantity: 100,
      expiryDate: addDaysToDate(baseDate, 5),
      safetyStock: 50,
    }),
    createMockIngredientBatch({
      id: 'ing-warning',
      name: '临期原料',
      batchNo: 'BATCH-TEST-WARNING',
      quantity: 100,
      expiryDate: addDaysToDate(baseDate, 15),
      safetyStock: 50,
    }),
    createMockIngredientBatch({
      id: 'ing-normal',
      name: '临期原料',
      batchNo: 'BATCH-TEST-NORMAL',
      quantity: 100,
      expiryDate: addDaysToDate(baseDate, 60),
      safetyStock: 50,
    }),
  ];
};

export const createCompletedOrder = (): Order => {
  return createMockOrder({
    id: 'order-completed',
    orderNo: 'XY-TEST-COMPLETED',
    status: 'completed',
    currentStepIndex: 5,
    steps: [
      createMockStep({ orderId: 'order-completed', stepType: 'kneading', index: 0, status: 'completed' }),
      createMockStep({ orderId: 'order-completed', stepType: 'shaping', index: 1, status: 'completed' }),
      createMockStep({ orderId: 'order-completed', stepType: 'drying', index: 2, status: 'completed' }),
      createMockStep({ orderId: 'order-completed', stepType: 'cellaring', index: 3, status: 'completed' }),
      createMockStep({ orderId: 'order-completed', stepType: 'packaging', index: 4, status: 'completed' }),
    ],
  });
};
