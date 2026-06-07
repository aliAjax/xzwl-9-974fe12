import React from 'react';
import { X, Calendar, User, Clock, CheckCircle, Circle, Play, AlertTriangle, ChevronRight, Printer } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { ProgressBar } from '../common/ProgressBar';
import { Badge } from '../common/Badge';
import { formatDateChinese, getDaysRemaining } from '../../utils/dateUtils';
import { ProductionStep, StepStatus, STEP_ORDER, STEP_CONFIG } from '../../types';
import { clsx } from 'clsx';

const OrderDetailModal: React.FC = () => {
  const {
    selectedOrderId,
    setSelectedOrderId,
    getRecipeById,
    getOrderWarnings,
    moveOrderToStep,
    completeOrder,
    setShowPrintPreview,
    setPrintOrderId,
  } = useAppStore();

  const order = useAppStore((state) => state.orders.find((o) => o.id === selectedOrderId));
  const recipe = order ? getRecipeById(order.recipeId) : undefined;
  const warnings = order ? getOrderWarnings(order.id) : [];

  if (!order || !recipe) return null;

  const completedSteps = order.steps.filter((s) => s.status === 'completed').length;
  const totalSteps = order.steps.length;
  const progress = (completedSteps / totalSteps) * 100;

  const daysToDelivery = getDaysRemaining(order.deliveryDate);

  const getStepIcon = (status: StepStatus) => {
    switch (status) {
      case 'completed':
      return <CheckCircle size={18} className="text-bamboo-500" />;
      case 'in_progress':
      return <Play size={18} className="text-sandal-500" />;
      case 'delayed':
      return <AlertTriangle size={18} className="text-warning-critical" />;
      default:
      return <Circle size={18} className="text-incense-300" />;
    }
  };

  const handleMoveNext = () => {
    const currentStepIndex = order.steps.findIndex((s) => s.status === 'in_progress');
    if (currentStepIndex < 0) {
      moveOrderToStep(order.id, STEP_ORDER[0]);
      return;
    }

    const nextStepType = STEP_ORDER[currentStepIndex + 1];
    if (nextStepType) {
      moveOrderToStep(order.id, nextStepType);
    } else {
      completeOrder(order.id);
    }
  };

  const currentStepIndex = order.steps.findIndex((s) => s.status === 'in_progress');
  const actionLabel =
    currentStepIndex < 0
      ? `开始${STEP_CONFIG[STEP_ORDER[0]].name}`
      : currentStepIndex === STEP_ORDER.length - 1
        ? '完成订单'
        : '完成当前步骤，进入下一工序';

  const priorityLabel = {
    high: '高优先级',
    medium: '中优先级',
    low: '低优先级',
  };

  const handlePrintOrder = () => {
    if (selectedOrderId) {
      setPrintOrderId(selectedOrderId);
    }
    setSelectedOrderId(null);
    setTimeout(() => {
      setShowPrintPreview(true);
    }, 50);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setSelectedOrderId(null)}
      />
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-incense-50 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-fade-in-up">
        <div className="flex items-center justify-between p-6 border-b border-incense-200 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-incense-700 rounded-xl flex items-center justify-center">
              <span className="font-song text-2xl font-bold text-white">香</span>
            </div>
            <div>
              <h2 className="text-xl font-bold font-song text-incense-800">
                {order.orderNo}
              </h2>
              <p className="text-sm text-incense-500">{order.customerName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={order.priority}>{priorityLabel[order.priority]}</Badge>
            <button
              onClick={() => setSelectedOrderId(null)}
              className="p-2 rounded-lg hover:bg-incense-100 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar size={16} className="text-incense-500" />
                <span className="text-sm text-incense-600">香方</span>
              </div>
              <p className="font-medium text-incense-800">{recipe.name}</p>
              <p className="text-xs text-incense-500 mt-1">{recipe.description}</p>
            </div>

            <div className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={16} className="text-incense-500" />
                <span className="text-sm text-incense-600">数量</span>
              </div>
              <p className="font-medium text-incense-800">
                {order.quantity} {order.unit}
              </p>
              <p className="text-xs text-incense-500 mt-1">
                下单：{formatDateChinese(order.orderDate)}
              </p>
            </div>

            <div className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar size={16} className={daysToDelivery <= 3 ? 'text-warning-critical' : 'text-incense-500'} />
                <span className="text-sm text-incense-600">交付期</span>
              </div>
              <p
                className={clsx(
                  'font-medium',
                  daysToDelivery <= 3 ? 'text-warning-critical' : 'text-incense-800'
                )}
              >
                {formatDateChinese(order.deliveryDate)}
              </p>
              <p className="text-xs text-incense-500 mt-1">
                {daysToDelivery > 0
                  ? `还剩 ${daysToDelivery} 天`
                  : daysToDelivery < 0
                    ? `已逾期 ${Math.abs(daysToDelivery)} 天`
                    : '今天到期'}
              </p>
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-incense-800">生产进度</h3>
              <span className="text-sm text-incense-500">
                {completedSteps}/{totalSteps} 步骤完成
              </span>
            </div>
            <ProgressBar value={progress} max={100} variant="success" />
          </div>

          <div className="card p-4">
            <h3 className="font-semibold text-incense-800 mb-4">生产步骤</h3>
            <div className="space-y-2">
              {order.steps.map((step: ProductionStep, index: number) => (
                <div
                  key={step.id}
                  className={clsx(
                    'flex items-center gap-4 p-3 rounded-lg transition-colors',
                    step.status === 'in_progress' && 'bg-sandal-50 border border-sandal-200',
                    step.status === 'completed' && 'bg-bamboo-50',
                    step.status === 'delayed' && 'bg-red-50 border border-red-200'
                  )}
                >
                  <div className="flex-shrink-0">{getStepIcon(step.status)}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-incense-800">{step.stepName}</span>
                      <span
                        className="text-xs px-2 py-0.5 rounded"
                        style={{ backgroundColor: `${STEP_CONFIG[step.stepType].color}20`, color: STEP_CONFIG[step.stepType].color }}
                      >
                        {step.durationDays}天
                      </span>
                    </div>
                    <div className="text-xs text-incense-500 mt-0.5">
                      {formatDateChinese(step.startDate)} → {formatDateChinese(step.endDate)}
                    </div>
                  </div>
                  {step.assignee && (
                    <div className="flex items-center gap-1 text-xs text-incense-500">
                      <User size={12} />
                      <span>{step.assignee}</span>
                    </div>
                  )}
                  {index < order.steps.length - 1 && (
                    <ChevronRight size={16} className="text-incense-300" />
                  )}
                </div>
              ))}
            </div>

            {order.status !== 'completed' && (
              <div className="mt-4 pt-4 border-t border-incense-100">
                <button
                  onClick={handleMoveNext}
                  className="w-full btn-primary flex items-center justify-center gap-2"
                >
                  <CheckCircle size={16} />
                  {actionLabel}
                </button>
              </div>
            )}
          </div>

          <div className="card p-4">
            <h3 className="font-semibold text-incense-800 mb-3">香方配方</h3>
            <div className="space-y-2">
              {recipe.ingredients.map((ing) => (
              <div key={ing.ingredientId} className="flex items-center justify-between text-sm">
                <span className="text-incense-700">{ing.name}</span>
                <span className="text-incense-500">{ing.quantity} {ing.unit}</span>
              </div>
            ))}
            </div>
            <div className="mt-3 pt-3 border-t border-incense-100">
              <div className="text-xs text-incense-500">
                <span className="font-medium">工艺说明：</span>
                {recipe.craftNotes}
              </div>
              <div className="flex gap-4 mt-2 text-xs text-incense-500">
                <span>阴干：{recipe.dryingDays}天</span>
                <span>窖藏：{recipe.cellaringDays}天</span>
              </div>
            </div>
          </div>

          {warnings.length > 0 && (
            <div className="card p-4 border-l-4 border-l-warning-critical">
              <h3 className="font-semibold text-warning-critical mb-3 flex items-center gap-2">
                <AlertTriangle size={18} />
                预警信息
              </h3>
              <div className="space-y-2">
                {warnings.map((warning) => (
                  <div
                    key={warning.id}
                    className={clsx(
                      'p-2 rounded text-sm',
                      warning.level === 'critical' && 'bg-red-50 text-warning-critical',
                      warning.level === 'warning' && 'bg-amber-50 text-sandal-500',
                      warning.level === 'info' && 'bg-blue-50 text-warning-info'
                    )}
                  >
                    {warning.message}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-incense-200 bg-white flex justify-end gap-3">
          <button onClick={() => setSelectedOrderId(null)} className="btn-secondary">
            关闭
          </button>
          <button onClick={handlePrintOrder} className="btn-primary flex items-center gap-2">
            <Printer size={16} />
            打印工单
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderDetailModal;
