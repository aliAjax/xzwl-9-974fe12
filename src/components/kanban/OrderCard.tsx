import React from 'react';
import { Calendar, User, AlertTriangle, Clock } from 'lucide-react';
import { type Order } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { formatDateChinese, getDaysRemaining } from '../../utils/dateUtils';
import { Badge } from '../common/Badge';
import { clsx } from 'clsx';

interface OrderCardProps {
  order: Order;
}

export const OrderCard: React.FC<OrderCardProps> = ({ order }) => {
  const { setSelectedOrderId, getRecipeById, getOrderWarnings } = useAppStore();
  const recipe = getRecipeById(order.recipeId);
  const warnings = getOrderWarnings(order.id);

  const daysToDelivery = getDaysRemaining(order.deliveryDate);
  const hasCriticalWarning = warnings.some((w) => w.level === 'critical');
  const hasWarning = warnings.length > 0;

  const statusClass = hasCriticalWarning
    ? 'status-delayed'
    : hasWarning
      ? 'status-warning'
      : 'status-normal';

  const priorityLabel = {
    high: '高优先级',
    medium: '中优先级',
    low: '低优先级',
  };

  const currentStep = order.steps.find((s) => s.status === 'in_progress');

  return (
    <div
      className={clsx('order-card', statusClass, 'animate-fade-in-up')}
      onClick={() => setSelectedOrderId(order.id)}
      style={{ opacity: 0 }}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <h4 className="font-semibold text-incense-800 font-song">{order.orderNo}</h4>
          <p className="text-xs text-incense-500">{order.customerName}</p>
        </div>
        <Badge variant={order.priority}>{priorityLabel[order.priority]}</Badge>
      </div>

      <div className="mb-2">
        <p className="text-sm font-medium text-incense-700">{recipe?.name}</p>
        <p className="text-xs text-incense-500">
          {order.quantity} {order.unit}
        </p>
      </div>

      {currentStep && (
        <div className="flex items-center gap-2 mb-2 text-xs text-incense-600 bg-incense-50 px-2 py-1 rounded">
          <Clock size={12} />
          <span>当前：{currentStep.stepName}</span>
          {currentStep.assignee && (
            <>
              <User size={12} />
              <span>{currentStep.assignee}</span>
            </>
          )}
        </div>
      )}

      <div className="flex items-center justify-between text-xs">
        <div
          className={clsx(
            'flex items-center gap-1',
            daysToDelivery <= 3 ? 'text-warning-critical' : 'text-incense-600'
          )}
        >
          <Calendar size={12} />
          <span>
            交付：{formatDateChinese(order.deliveryDate)}
            {daysToDelivery <= 3 && daysToDelivery > 0 && (
              <span className="ml-1 text-warning-critical">({daysToDelivery}天后)</span>
            )}
            {daysToDelivery < 0 && (
              <span className="ml-1 text-warning-critical">(已逾期{Math.abs(daysToDelivery)}天)</span>
            )}
          </span>
        </div>

        {hasWarning && (
          <div className="flex items-center gap-1 text-warning-warning">
            <AlertTriangle size={12} />
            <span>{warnings.length}</span>
          </div>
        )}
      </div>

      {warnings.length > 0 && (
        <div className="mt-2 pt-2 border-t border-incense-100">
          {warnings.slice(0, 1).map((warning) => (
            <p
              key={warning.id}
              className={clsx(
                'text-xs line-clamp-2',
                warning.level === 'critical' ? 'text-warning-critical' : 'text-sandal-500'
              )}
            >
              ⚠ {warning.message}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};
