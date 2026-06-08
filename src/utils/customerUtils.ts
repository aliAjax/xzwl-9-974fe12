import {
  type Order,
  type CustomerOrderSummary,
  type RiskLevel,
  type Warning,
  type IngredientBatch,
  type Recipe,
} from '../types';
import { getToday, daysBetween, isDateBefore } from './dateUtils';
import { calculateDeliveryCommitment } from './deliveryUtils';

export interface CalculateCustomerSummariesOptions {
  getOrderWarnings: (orderId: string) => Warning[];
  warnings: Warning[];
  ingredients: IngredientBatch[];
  recipes: Recipe[];
}

export const calculateRiskLevel = (
  customerOrders: Order[],
  getOrderWarnings: (orderId: string) => Warning[],
  today: string
): RiskLevel => {
  const activeOrders = customerOrders.filter((o) => o.status !== 'completed');

  const overdueOrders = activeOrders.filter(
    (o) => isDateBefore(o.deliveryDate, today)
  );

  if (overdueOrders.length > 0) {
    return 'critical';
  }

  const highPriorityOrders = activeOrders.filter(
    (o) => o.priority === 'high'
  );

  if (highPriorityOrders.length > 0) {
    const hasNearDelivery = activeOrders.some((o) => {
      const days = daysBetween(today, o.deliveryDate);
      return days <= 7;
    });
    if (hasNearDelivery) {
      return 'high';
    }
    return 'medium';
  }

  const hasWarnings = activeOrders.some((o) => {
    const orderWarnings = getOrderWarnings(o.id);
    return orderWarnings.some((w) => w.level === 'critical' || w.level === 'warning');
  });

  if (hasWarnings) {
    return 'medium';
  }

  return 'low';
};

export const calculateCustomerSummaries = (
  orders: Order[],
  options: CalculateCustomerSummariesOptions
): CustomerOrderSummary[] => {
  const { getOrderWarnings, warnings, ingredients, recipes } = options;
  const customerMap = new Map<string, Order[]>();

  orders.forEach((order) => {
    const existing = customerMap.get(order.customerName) || [];
    customerMap.set(order.customerName, [...existing, order]);
  });

  const summaries: CustomerOrderSummary[] = [];
  const today = getToday();

  customerMap.forEach((customerOrders, customerName) => {
    const totalOrders = customerOrders.length;
    const pendingOrders = customerOrders.filter((o) => o.status === 'pending').length;
    const inProductionOrders = customerOrders.filter((o) => o.status === 'in_production').length;
    const completedOrders = customerOrders.filter((o) => o.status === 'completed').length;

    const overdueOrders = customerOrders.filter(
      (o) => o.status !== 'completed' && isDateBefore(o.deliveryDate, today)
    ).length;

    const highPriorityOrders = customerOrders.filter(
      (o) => o.priority === 'high' && o.status !== 'completed'
    ).length;

    const activeOrders = customerOrders.filter((o) => o.status !== 'completed');
    const sortedByDelivery = [...activeOrders].sort((a, b) =>
      a.deliveryDate.localeCompare(b.deliveryDate)
    );
    const earliestDeliveryDate =
      sortedByDelivery.length > 0 ? sortedByDelivery[0].deliveryDate : '';
    const latestDeliveryDate =
      sortedByDelivery.length > 0
        ? sortedByDelivery[sortedByDelivery.length - 1].deliveryDate
        : '';

    const totalSteps = customerOrders.reduce(
      (sum, o) => sum + o.steps.length,
      0
    );
    const completedSteps = customerOrders.reduce(
      (sum, o) => sum + o.steps.filter((s) => s.status === 'completed').length,
      0
    );
    const overallProgress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

    const riskLevel = calculateRiskLevel(customerOrders, getOrderWarnings, today);

    const deliveryCommitment = calculateDeliveryCommitment(
      customerOrders,
      warnings,
      ingredients,
      recipes,
      today
    );

    summaries.push({
      customerName,
      totalOrders,
      pendingOrders,
      inProductionOrders,
      completedOrders,
      overdueOrders,
      highPriorityOrders,
      earliestDeliveryDate,
      latestDeliveryDate,
      overallProgress,
      riskLevel,
      orders: customerOrders,
      orderIds: customerOrders.map((o) => o.id),
      deliveryCommitment,
    });
  });

  return summaries;
};

export const getCustomerSummary = (
  customerName: string,
  summaries: CustomerOrderSummary[]
): CustomerOrderSummary | undefined => {
  return summaries.find((s) => s.customerName === customerName);
};
