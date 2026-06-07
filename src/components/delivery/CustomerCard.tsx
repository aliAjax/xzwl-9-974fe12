import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  Calendar,
  Clock,
  Package,
  CheckCircle,
  XCircle,
  User,
} from 'lucide-react';
import { clsx } from 'clsx';
import { CustomerOrderSummary, Order } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { formatDateChinese, getDaysRemaining } from '../../utils/dateUtils';
import { Badge } from '../common/Badge';
import { ProgressBar } from '../common/ProgressBar';

interface CustomerCardProps {
  summary: CustomerOrderSummary;
  isExpanded: boolean;
  onToggle: () => void;
  searchTerm?: string;
}

const riskLevelConfig = {
  critical: { label: '极高风险', color: 'bg-red-100 text-red-700', border: 'border-red-300' },
  high: { label: '高风险', color: 'bg-orange-100 text-orange-700', border: 'border-orange-300' },
  medium: { label: '中风险', color: 'bg-amber-100 text-amber-700', border: 'border-amber-300' },
  low: { label: '低风险', color: 'bg-bamboo-100 text-bamboo-700', border: 'border-bamboo-300' },
};

const priorityLabel = {
  high: '高优',
  medium: '中优',
  low: '低优',
};

const statusLabel = {
  pending: '待生产',
  in_production: '生产中',
  completed: '已完成',
};

const highlightMatch = (text: string, searchTerm: string): React.ReactNode => {
  if (!searchTerm.trim()) return text;

  const term = searchTerm.trim().toLowerCase();
  const index = text.toLowerCase().indexOf(term);

  if (index === -1) return text;

  return (
    <>
      {text.slice(0, index)}
      <mark className="bg-amber-200 text-amber-900 px-0.5 rounded font-medium">
        {text.slice(index, index + term.length)}
      </mark>
      {text.slice(index + term.length)}
    </>
  );
};

export const CustomerCard: React.FC<CustomerCardProps> = ({
  summary,
  isExpanded,
  onToggle,
  searchTerm = '',
}) => {
  const { setSelectedOrderId, getRecipeById, deliveryBoard } = useAppStore();
  const riskConfig = riskLevelConfig[summary.riskLevel];

  const { showCompletedOrders } = deliveryBoard;

  let displayOrders = showCompletedOrders
    ? summary.orders
    : summary.orders.filter((o) => o.status !== 'completed');

  if (searchTerm.trim()) {
    const term = searchTerm.trim().toLowerCase();
    const customerMatch = summary.customerName.toLowerCase().includes(term);
    if (!customerMatch) {
      displayOrders = displayOrders.filter((o) =>
        o.orderNo.toLowerCase().includes(term)
      );
    }
  }

  const sortedOrders = [...displayOrders].sort((a, b) => {
    if (a.priority === 'high' && b.priority !== 'high') return -1;
    if (a.priority !== 'high' && b.priority === 'high') return 1;

    const aOverdue = a.status !== 'completed' && getDaysRemaining(a.deliveryDate) < 0;
    const bOverdue = b.status !== 'completed' && getDaysRemaining(b.deliveryDate) < 0;
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;

    return a.deliveryDate.localeCompare(b.deliveryDate);
  });

  const earliestDaysRemaining = summary.earliestDeliveryDate
    ? getDaysRemaining(summary.earliestDeliveryDate)
    : 0;

  const handleOrderClick = (orderId: string) => {
    setSelectedOrderId(orderId);
  };

  const getOrderProgress = (order: Order): number => {
    const totalSteps = order.steps.length;
    const completedSteps = order.steps.filter((s) => s.status === 'completed').length;
    return totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
  };

  const getProgressVariant = (order: Order): 'default' | 'success' | 'warning' | 'critical' => {
    if (order.status === 'completed') return 'success';
    const daysRemaining = getDaysRemaining(order.deliveryDate);
    if (daysRemaining < 0) return 'critical';
    if (daysRemaining <= 7) return 'warning';
    return 'default';
  };

  return (
    <div
      className={clsx(
        'bg-white rounded-xl shadow-sm border-2 transition-all duration-300 overflow-hidden',
        riskConfig.border,
        isExpanded ? 'shadow-md' : 'hover:shadow-md'
      )}
    >
      <div
        className="p-5 cursor-pointer select-none"
        onClick={onToggle}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-incense-100 rounded-full flex items-center justify-center">
              <User size={24} className="text-incense-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold font-song text-incense-800">
                {highlightMatch(summary.customerName, searchTerm)}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-incense-500">
                  共 {summary.totalOrders} 单
                </span>
                {summary.overdueOrders > 0 && (
                  <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                    {summary.overdueOrders} 单逾期
                  </span>
                )}
                {summary.highPriorityOrders > 0 && (
                  <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                    {summary.highPriorityOrders} 单高优
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={summary.riskLevel === 'low' ? 'success' : summary.riskLevel}>
              {riskConfig.label}
            </Badge>
            {isExpanded ? (
              <ChevronUp size={20} className="text-incense-400" />
            ) : (
              <ChevronDown size={20} className="text-incense-400" />
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="text-center p-3 bg-incense-50 rounded-lg">
            <div className="flex items-center justify-center gap-1 text-incense-400 mb-1">
              <Package size={14} />
              <span className="text-xs">待生产</span>
            </div>
            <p className="text-xl font-bold text-incense-700">{summary.pendingOrders}</p>
          </div>
          <div className="text-center p-3 bg-amber-50 rounded-lg">
            <div className="flex items-center justify-center gap-1 text-amber-500 mb-1">
              <Clock size={14} />
              <span className="text-xs">生产中</span>
            </div>
            <p className="text-xl font-bold text-amber-600">{summary.inProductionOrders}</p>
          </div>
          <div className="text-center p-3 bg-bamboo-50 rounded-lg">
            <div className="flex items-center justify-center gap-1 text-bamboo-500 mb-1">
              <CheckCircle size={14} />
              <span className="text-xs">已完成</span>
            </div>
            <p className="text-xl font-bold text-bamboo-600">{summary.completedOrders}</p>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="flex items-center justify-center gap-1 text-red-500 mb-1">
              <XCircle size={14} />
              <span className="text-xs">已逾期</span>
            </div>
            <p className="text-xl font-bold text-red-600">{summary.overdueOrders}</p>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-incense-600">整体进度</span>
            <span className="text-sm font-medium text-incense-800">
              {summary.overallProgress}%
            </span>
          </div>
          <ProgressBar
            value={summary.overallProgress}
            variant={
              summary.riskLevel === 'critical'
                ? 'critical'
                : summary.riskLevel === 'high'
                  ? 'warning'
                  : summary.riskLevel === 'medium'
                    ? 'warning'
                    : 'success'
            }
          />
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            {summary.earliestDeliveryDate && (
              <div
                className={clsx(
                  'flex items-center gap-1',
                  earliestDaysRemaining < 0
                    ? 'text-red-600'
                    : earliestDaysRemaining <= 7
                      ? 'text-amber-600'
                      : 'text-incense-600'
                )}
              >
                <Calendar size={14} />
                <span>
                  最早交付：{formatDateChinese(summary.earliestDeliveryDate)}
                  {earliestDaysRemaining < 0 && (
                    <span className="ml-1">(逾期{Math.abs(earliestDaysRemaining)}天)</span>
                  )}
                  {earliestDaysRemaining >= 0 && earliestDaysRemaining <= 7 && earliestDaysRemaining > 0 && (
                    <span className="ml-1">({earliestDaysRemaining}天后)</span>
                  )}
                </span>
              </div>
            )}
            {summary.latestDeliveryDate && summary.latestDeliveryDate !== summary.earliestDeliveryDate && (
              <div className="flex items-center gap-1 text-incense-500">
                <Calendar size={14} />
                <span>
                  最晚交付：{formatDateChinese(summary.latestDeliveryDate)}
                </span>
              </div>
            )}
          </div>
          <div className="text-incense-500">
            {searchTerm.trim() && sortedOrders.length > 0
              ? `搜索匹配 ${sortedOrders.length} 个订单，点击展开查看详情`
              : sortedOrders.length > 0
                ? `点击展开查看 ${sortedOrders.length} 个订单详情`
                : '暂无匹配的订单'}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-incense-100 bg-incense-50/50">
          {sortedOrders.length === 0 ? (
            <div className="p-8 text-center text-incense-500">
              <Package size={40} className="mx-auto mb-2 opacity-50" />
              <p>
                {searchTerm.trim()
                  ? '未找到匹配的订单'
                  : '暂无订单数据'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-incense-100">
              {sortedOrders.map((order, index) => {
                const recipe = getRecipeById(order.recipeId);
                const daysToDelivery = getDaysRemaining(order.deliveryDate);
                const isOverdue = order.status !== 'completed' && daysToDelivery < 0;
                const isNearDelivery =
                  order.status !== 'completed' && daysToDelivery >= 0 && daysToDelivery <= 7;
                const currentStep = order.steps.find((s) => s.status === 'in_progress');
                const orderProgress = getOrderProgress(order);
                const progressVariant = getProgressVariant(order);

                return (
                  <div
                    key={order.id}
                    className={clsx(
                      'p-4 hover:bg-white transition-colors cursor-pointer animate-fade-in',
                      order.status === 'completed' && 'opacity-60',
                      index === 0 ? 'pt-4' : ''
                    )}
                    style={{ animationDelay: `${index * 50}ms` }}
                    onClick={() => handleOrderClick(order.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold text-incense-800">
                            {highlightMatch(order.orderNo, searchTerm)}
                          </span>
                          <Badge variant={order.priority}>{priorityLabel[order.priority]}</Badge>
                          <Badge
                            variant={
                              order.status === 'completed'
                                ? 'success'
                                : order.status === 'in_production'
                                  ? 'info'
                                  : 'low'
                            }
                          >
                            {statusLabel[order.status]}
                          </Badge>
                          {isOverdue && (
                            <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                              已逾期{Math.abs(daysToDelivery)}天
                            </span>
                          )}
                          {isNearDelivery && !isOverdue && (
                            <span className="text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">
                              {daysToDelivery}天后交付
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-4 mb-2">
                          <span className="text-sm text-incense-700">
                            {recipe?.name || '未知产品'}
                          </span>
                          <span className="text-sm text-incense-500">
                            {order.quantity} {order.unit}
                          </span>
                        </div>

                        {currentStep && order.status === 'in_production' && (
                          <div className="flex items-center gap-2 mb-2 text-xs text-incense-600">
                            <Clock size={12} />
                            <span>当前工序：{currentStep.stepName}</span>
                            {currentStep.assignee && (
                              <>
                                <User size={12} />
                                <span>{currentStep.assignee}</span>
                              </>
                            )}
                          </div>
                        )}

                        <div className="flex items-center gap-6">
                          <div className="flex items-center gap-1 text-xs text-incense-500">
                            <Calendar size={12} />
                            <span>交付：{formatDateChinese(order.deliveryDate)}</span>
                          </div>
                          <div className="flex-1 max-w-xs">
                            <ProgressBar
                              value={orderProgress}
                              variant={progressVariant}
                            />
                          </div>
                          <span className="text-xs text-incense-500">
                            {orderProgress}%
                          </span>
                        </div>
                      </div>

                      <div className="ml-4 text-incense-400">
                        <ChevronDown size={16} className="rotate-270" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
