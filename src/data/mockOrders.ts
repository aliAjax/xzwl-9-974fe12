import { Order, ProductionStep, StepType } from '../types';
import { mockRecipes } from './mockRecipes';
import { addDays, formatISO } from 'date-fns';

const today = new Date('2026-06-07');

const createSteps = (
  orderId: string,
  recipeId: string,
  currentStepIndex: number
): ProductionStep[] => {
  const recipe = mockRecipes.find((r) => r.id === recipeId);
  if (!recipe) return [];

  const stepDurations: Record<StepType, number> = {
    kneading: 2,
    shaping: 3,
    drying: recipe.dryingDays,
    cellaring: recipe.cellaringDays,
    packaging: 2,
  };

  const stepNames: Record<StepType, string> = {
    kneading: '揉料',
    shaping: '成型',
    drying: '阴干',
    cellaring: '窖藏',
    packaging: '包装',
  };

  const stepTypes: StepType[] = ['kneading', 'shaping', 'drying', 'cellaring', 'packaging'];

  let currentDate = addDays(today, -3);

  return stepTypes.map((stepType, index) => {
    const duration = stepDurations[stepType];
    const startDate = currentDate;
    const endDate = addDays(startDate, duration);
    currentDate = endDate;

    let status: ProductionStep['status'] = 'not_started';
    if (index < currentStepIndex) {
      status = 'completed';
    } else if (index === currentStepIndex) {
      status = 'in_progress';
    }

    return {
      id: `${orderId}-step-${index}`,
      orderId,
      stepType,
      stepName: stepNames[stepType],
      status,
      startDate: formatISO(startDate, { representation: 'date' }),
      endDate: formatISO(endDate, { representation: 'date' }),
      durationDays: duration,
      notes: '',
      assignee: index === currentStepIndex ? '李师傅' : '',
    };
  });
};

export const mockOrders: Order[] = [
  {
    id: 'order-001',
    orderNo: 'XY-2026-0601',
    customerName: '北京静心斋',
    recipeId: 'recipe-001',
    quantity: 500,
    unit: '克',
    orderDate: formatISO(addDays(today, -10), { representation: 'date' }),
    deliveryDate: formatISO(addDays(today, 25), { representation: 'date' }),
    status: 'in_production',
    priority: 'high',
    currentStepIndex: 2,
    steps: createSteps('order-001', 'recipe-001', 2),
  },
  {
    id: 'order-002',
    orderNo: 'XY-2026-0602',
    customerName: '上海云栖茶馆',
    recipeId: 'recipe-003',
    quantity: 200,
    unit: '克',
    orderDate: formatISO(addDays(today, -8), { representation: 'date' }),
    deliveryDate: formatISO(addDays(today, 40), { representation: 'date' }),
    status: 'in_production',
    priority: 'medium',
    currentStepIndex: 0,
    steps: createSteps('order-002', 'recipe-003', 0),
  },
  {
    id: 'order-003',
    orderNo: 'XY-2026-0603',
    customerName: '杭州龙井书院',
    recipeId: 'recipe-002',
    quantity: 800,
    unit: '克',
    orderDate: formatISO(addDays(today, -15), { representation: 'date' }),
    deliveryDate: formatISO(addDays(today, 10), { representation: 'date' }),
    status: 'in_production',
    priority: 'high',
    currentStepIndex: 3,
    steps: createSteps('order-003', 'recipe-002', 3),
  },
  {
    id: 'order-004',
    orderNo: 'XY-2026-0604',
    customerName: '成都文殊院',
    recipeId: 'recipe-005',
    quantity: 1500,
    unit: '克',
    orderDate: formatISO(addDays(today, -5), { representation: 'date' }),
    deliveryDate: formatISO(addDays(today, 15), { representation: 'date' }),
    status: 'in_production',
    priority: 'medium',
    currentStepIndex: 1,
    steps: createSteps('order-004', 'recipe-005', 1),
  },
  {
    id: 'order-005',
    orderNo: 'XY-2026-0605',
    customerName: '广州普洱茶庄',
    recipeId: 'recipe-004',
    quantity: 100,
    unit: '克',
    orderDate: formatISO(addDays(today, -3), { representation: 'date' }),
    deliveryDate: formatISO(addDays(today, 60), { representation: 'date' }),
    status: 'in_production',
    priority: 'low',
    currentStepIndex: 0,
    steps: createSteps('order-005', 'recipe-004', 0),
  },
  {
    id: 'order-006',
    orderNo: 'XY-2026-0606',
    customerName: '南京夫子庙文创',
    recipeId: 'recipe-001',
    quantity: 300,
    unit: '克',
    orderDate: formatISO(addDays(today, -20), { representation: 'date' }),
    deliveryDate: formatISO(addDays(today, 5), { representation: 'date' }),
    status: 'in_production',
    priority: 'high',
    currentStepIndex: 4,
    steps: createSteps('order-006', 'recipe-001', 4),
  },
  {
    id: 'order-007',
    orderNo: 'XY-2026-0528',
    customerName: '苏州园林管理处',
    recipeId: 'recipe-002',
    quantity: 400,
    unit: '克',
    orderDate: formatISO(addDays(today, -25), { representation: 'date' }),
    deliveryDate: formatISO(addDays(today, -2), { representation: 'date' }),
    status: 'completed',
    priority: 'medium',
    currentStepIndex: 5,
    steps: createSteps('order-007', 'recipe-002', 5),
  },
  {
    id: 'order-008',
    orderNo: 'XY-2026-0607',
    customerName: '西安大唐不夜城',
    recipeId: 'recipe-003',
    quantity: 600,
    unit: '克',
    orderDate: formatISO(today, { representation: 'date' }),
    deliveryDate: formatISO(addDays(today, 50), { representation: 'date' }),
    status: 'pending',
    priority: 'medium',
    currentStepIndex: -1,
    steps: createSteps('order-008', 'recipe-003', -1),
  },
];
