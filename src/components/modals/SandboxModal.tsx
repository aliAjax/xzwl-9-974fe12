import React, { useState, useMemo } from 'react';
import {
  X,
  Check,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  AlertCircle,
  Info,
  TrendingUp,
  Clock,
  Users,
  Calendar,
  User,
  Shield,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import {
  Order,
  SandboxPriorityStrategy,
  SandboxConflict,
  SandboxOrderPreview,
  SandboxStepPreview,
  STEP_CONFIG,
} from '../../types';
import {
  getToday,
  daysBetween,
  formatDateChinese,
} from '../../utils/dateUtils';
import { Badge } from '../common/Badge';
import { ProgressBar } from '../common/ProgressBar';

type SandboxStep = 'select' | 'strategy' | 'preview' | 'confirm';

const strategyOptions: {
  value: SandboxPriorityStrategy;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    value: 'priority_first',
    label: '优先高优先级',
    description: '按订单优先级排序，高优先级订单优先排产',
    icon: <TrendingUp size={20} />,
  },
  {
    value: 'nearest_delivery_first',
    label: '优先临近交付',
    description: '按交付日期排序，临近交付的订单优先排产',
    icon: <Clock size={20} />,
  },
  {
    value: 'balanced_load',
    label: '均衡工匠负载',
    description: '综合考虑优先级和工匠负载，均衡分配任务',
    icon: <Users size={20} />,
  },
];

const getConflictIcon = (level: SandboxConflict['level']) => {
  switch (level) {
    case 'critical':
      return <AlertCircle size={16} className="text-red-500" />;
    case 'warning':
      return <AlertTriangle size={16} className="text-amber-500" />;
    case 'info':
      return <Info size={16} className="text-blue-500" />;
  }
};

const getConflictColor = (level: SandboxConflict['level']) => {
  switch (level) {
    case 'critical':
      return 'bg-red-50 border-red-200 text-red-700';
    case 'warning':
      return 'bg-amber-50 border-amber-200 text-amber-700';
    case 'info':
      return 'bg-blue-50 border-blue-200 text-blue-700';
  }
};

const getConflictTypeName = (type: SandboxConflict['type']) => {
  const names: Record<SandboxConflict['type'], string> = {
    skill_mismatch: '技能不匹配',
    overload: '负载过高',
    delivery_delay: '交付延误',
    material_shortage: '原料不足',
  };
  return names[type];
};

const SandboxModal: React.FC = () => {
  const {
    orders,
    showSandboxModal,
    sandboxSelectedOrderIds,
    sandboxPriorityStrategy,
    sandboxResult,
    setShowSandboxModal,
    setSandboxSelectedOrderIds,
    setSandboxPriorityStrategy,
    generateSandboxPreview,
    applySandboxChanges,
    clearSandbox,
  } = useAppStore();

  const [currentStep, setCurrentStep] = useState<SandboxStep>('select');
  const [isGenerating, setIsGenerating] = useState(false);

  const uncompletedOrders = useMemo(() => {
    return orders.filter((o) => o.status !== 'completed');
  }, [orders]);

  const handleClose = () => {
    setShowSandboxModal(false);
    setCurrentStep('select');
    clearSandbox();
  };

  const toggleOrderSelection = (orderId: string) => {
    const newSelection = sandboxSelectedOrderIds.includes(orderId)
      ? sandboxSelectedOrderIds.filter((id) => id !== orderId)
      : [...sandboxSelectedOrderIds, orderId];
    setSandboxSelectedOrderIds(newSelection);
  };

  const selectAllOrders = () => {
    setSandboxSelectedOrderIds(uncompletedOrders.map((o) => o.id));
  };

  const clearSelection = () => {
    setSandboxSelectedOrderIds([]);
  };

  const handleNext = async () => {
    if (currentStep === 'select') {
      if (sandboxSelectedOrderIds.length === 0) return;
      setCurrentStep('strategy');
    } else if (currentStep === 'strategy') {
      setIsGenerating(true);
      try {
        generateSandboxPreview(sandboxSelectedOrderIds, sandboxPriorityStrategy);
        setCurrentStep('preview');
      } finally {
        setIsGenerating(false);
      }
    } else if (currentStep === 'preview') {
      setCurrentStep('confirm');
    } else if (currentStep === 'confirm') {
      applySandboxChanges();
    }
  };

  const handleBack = () => {
    if (currentStep === 'strategy') {
      setCurrentStep('select');
    } else if (currentStep === 'preview') {
      setCurrentStep('strategy');
    } else if (currentStep === 'confirm') {
      setCurrentStep('preview');
    }
  };

  const handleRegenerate = () => {
    setIsGenerating(true);
    try {
      generateSandboxPreview(sandboxSelectedOrderIds, sandboxPriorityStrategy);
    } finally {
      setIsGenerating(false);
    }
  };

  const renderOrderCard = (order: Order) => {
    const isSelected = sandboxSelectedOrderIds.includes(order.id);
    const priorityColors = {
      high: 'bg-red-100 text-red-700',
      medium: 'bg-amber-100 text-amber-700',
      low: 'bg-green-100 text-green-700',
    };
    const priorityLabels = { high: '高', medium: '中', low: '低' };

    const completedSteps = order.steps.filter((s) => s.status === 'completed').length;
    const progress = (completedSteps / order.steps.length) * 100;
    const daysToDelivery = daysBetween(getToday(), order.deliveryDate);

    return (
      <div
        key={order.id}
        onClick={() => toggleOrderSelection(order.id)}
        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
          isSelected
            ? 'border-incense-600 bg-incense-50'
            : 'border-gray-200 bg-white hover:border-incense-300'
        }`}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                isSelected
                  ? 'bg-incense-600 border-incense-600'
                  : 'border-gray-300'
              }`}
            >
              {isSelected && <Check size={12} className="text-white" />}
            </div>
            <div>
              <div className="font-medium text-incense-800">{order.orderNo}</div>
              <div className="text-sm text-incense-500">{order.customerName}</div>
            </div>
          </div>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              priorityColors[order.priority]
            }`}
          >
            {priorityLabels[order.priority]}优先级
          </span>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-incense-500">交付日期</span>
            <span
              className={`font-medium ${
                daysToDelivery <= 7 ? 'text-red-600' : 'text-incense-700'
              }`}
            >
              {formatDateChinese(order.deliveryDate)}
              {daysToDelivery <= 7 && ` (剩${daysToDelivery}天)`}
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-incense-500">生产进度</span>
              <span className="text-incense-700">
                {completedSteps}/{order.steps.length} 工序
              </span>
            </div>
            <ProgressBar value={progress} className="h-1.5" />
          </div>
        </div>
      </div>
    );
  };

  const renderSelectStep = () => (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-incense-800">选择要排程的订单</h3>
        <div className="flex gap-2">
          <button
            onClick={selectAllOrders}
            className="text-sm text-incense-600 hover:text-incense-800"
          >
            全选
          </button>
          <button
            onClick={clearSelection}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            清空
          </button>
        </div>
      </div>

      <div className="mb-4 p-3 bg-incense-50 rounded-lg">
        <div className="flex items-center gap-2 text-sm text-incense-600">
          <Info size={16} />
          <span>
            已选择 <strong>{sandboxSelectedOrderIds.length}</strong> 个订单，共{' '}
            <strong>{uncompletedOrders.length}</strong> 个未完成订单
          </span>
        </div>
      </div>

      <div className="grid gap-3 max-h-96 overflow-y-auto pr-2">
        {uncompletedOrders.map(renderOrderCard)}
      </div>
    </div>
  );

  const renderStrategyStep = () => (
    <div>
      <h3 className="text-lg font-semibold text-incense-800 mb-4">
        选择排程优先级策略
      </h3>

      <div className="space-y-3">
        {strategyOptions.map((option) => (
          <div
            key={option.value}
            onClick={() => setSandboxPriorityStrategy(option.value)}
            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
              sandboxPriorityStrategy === option.value
                ? 'border-incense-600 bg-incense-50'
                : 'border-gray-200 bg-white hover:border-incense-300'
            }`}
          >
            <div className="flex items-start gap-4">
              <div
                className={`p-2 rounded-lg ${
                  sandboxPriorityStrategy === option.value
                    ? 'bg-incense-600 text-white'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {option.icon}
              </div>
              <div className="flex-1">
                <div className="font-medium text-incense-800">{option.label}</div>
                <div className="text-sm text-incense-500 mt-1">
                  {option.description}
                </div>
              </div>
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  sandboxPriorityStrategy === option.value
                    ? 'border-incense-600 bg-incense-600'
                    : 'border-gray-300'
                }`}
              >
                {sandboxPriorityStrategy === option.value && (
                  <Check size={12} className="text-white" />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
        <div className="flex items-start gap-3">
          <Shield size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-700">
            <div className="font-medium mb-1">注意事项</div>
            <ul className="list-disc list-inside space-y-1 text-amber-600">
              <li>已完成的工序不会被移动</li>
              <li>系统会自动检测技能不匹配、负载过高、交期延误和缺料问题</li>
              <li>您可以在预览阶段仔细检查后再应用到真实订单</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStepTimeline = (orderPreview: SandboxOrderPreview) => {
    const today = getToday();
    const minDate = orderPreview.steps[0]?.newStartDate || today;
    const maxDate = orderPreview.steps[orderPreview.steps.length - 1]?.newEndDate || today;
    const totalDays = Math.max(1, daysBetween(minDate, maxDate));

    return (
      <div className="mb-4">
        <div className="relative h-10 bg-gray-100 rounded-lg overflow-hidden">
          {orderPreview.steps.map((step) => {
            const startOffset = Math.max(
              0,
              (daysBetween(minDate, step.newStartDate) / totalDays) * 100
            );
            const stepWidth = Math.max(
              2,
              (daysBetween(step.newStartDate, step.newEndDate) / totalDays) * 100
            );
            const config = STEP_CONFIG[step.stepType];
            const hasConflict = step.conflicts.length > 0;

            return (
              <div
                key={step.stepId}
                className={`absolute top-1 bottom-1 rounded ${
                  step.isCompleted
                    ? 'bg-gray-400'
                    : hasConflict
                    ? 'bg-red-400'
                    : ''
                }`}
                style={{
                  left: `${startOffset}%`,
                  width: `${stepWidth}%`,
                  backgroundColor: step.isCompleted
                    ? undefined
                    : hasConflict
                    ? undefined
                    : config.color,
                }}
                title={`${step.stepName}: ${formatDateChinese(step.newStartDate)} - ${formatDateChinese(step.newEndDate)}`}
              >
                {stepWidth > 10 && (
                  <div className="h-full flex items-center justify-center text-white text-xs font-medium px-1 truncate">
                    {step.stepName}
                  </div>
                )}
              </div>
            );
          })}

          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
            style={{
              left: `${Math.max(0, Math.min(100, (daysBetween(minDate, today) / totalDays) * 100))}%`,
            }}
            title="今天"
          />
        </div>

        <div className="flex justify-between text-xs text-incense-500 mt-1">
          <span>{formatDateChinese(minDate)}</span>
          <span>{formatDateChinese(maxDate)}</span>
        </div>
      </div>
    );
  };

  const renderStepDetail = (step: SandboxStepPreview) => {
    if (step.isCompleted) return null;

    const config = STEP_CONFIG[step.stepType];
    const assigneeChanged = step.originalAssignee !== step.newAssignee;
    const dateChanged = step.shiftDays !== 0;

    return (
      <div
        key={step.stepId}
        className={`p-3 rounded-lg border ${
          step.isChanged ? 'border-incense-300 bg-incense-50' : 'border-gray-200 bg-white'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: config.color }}
            />
            <span className="font-medium text-incense-800">{step.stepName}</span>
          </div>
          {step.isChanged && (
            <span className="text-xs bg-incense-100 text-incense-600 px-2 py-0.5 rounded-full">
              已调整
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-incense-500 mb-1">开始日期</div>
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-incense-400" />
              <span
                className={dateChanged ? 'text-incense-800 font-medium' : 'text-incense-700'}
              >
                {formatDateChinese(step.newStartDate)}
              </span>
              {dateChanged && (
                <span
                  className={`text-xs ${
                    step.shiftDays > 0 ? 'text-red-500' : 'text-green-500'
                  }`}
                >
                  {step.shiftDays > 0 ? '+' : ''}
                  {step.shiftDays}天
                </span>
              )}
            </div>
          </div>

          <div>
            <div className="text-incense-500 mb-1">负责人</div>
            <div className="flex items-center gap-2">
              <User size={14} className="text-incense-400" />
              <span
                className={
                  assigneeChanged ? 'text-incense-800 font-medium' : 'text-incense-700'
                }
              >
                {step.newAssignee || '未分配'}
              </span>
              {assigneeChanged && step.originalAssignee && (
                <span className="text-xs text-gray-500">
                  (原: {step.originalAssignee})
                </span>
              )}
            </div>
          </div>
        </div>

        {step.conflicts.length > 0 && (
          <div className="mt-3 space-y-2">
            {step.conflicts.map((conflict) => (
              <div
                key={conflict.id}
                className={`p-2 rounded border text-sm flex items-start gap-2 ${
                  getConflictColor(conflict.level)
                }`}
              >
                {getConflictIcon(conflict.level)}
                <div>
                  <div className="font-medium">
                    {getConflictTypeName(conflict.type)}
                  </div>
                  <div className="text-xs opacity-80">{conflict.detail}</div>
                  {conflict.suggestion && (
                    <div className="text-xs mt-1 opacity-70">
                      建议: {conflict.suggestion}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderOrderPreview = (orderPreview: SandboxOrderPreview) => {
    const priorityColors = {
      high: 'bg-red-100 text-red-700',
      medium: 'bg-amber-100 text-amber-700',
      low: 'bg-green-100 text-green-700',
    };
    const priorityLabels = { high: '高', medium: '中', low: '低' };

    const changedSteps = orderPreview.steps.filter((s) => s.isChanged);
    const hasConflict = orderPreview.conflicts.length > 0;

    return (
      <div
        key={orderPreview.orderId}
        className={`p-4 rounded-lg border-2 ${
          hasConflict ? 'border-red-300' : 'border-gray-200'
        }`}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="font-semibold text-incense-800">
                {orderPreview.orderNo}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  priorityColors[orderPreview.priority]
                }`}
              >
                {priorityLabels[orderPreview.priority]}
              </span>
              {orderPreview.isDeliveryDelayed && (
                <Badge variant="critical" className="text-xs">
                  延误 {orderPreview.delayDays} 天
                </Badge>
              )}
            </div>
            <div className="text-sm text-incense-500">
              {orderPreview.customerName}
            </div>
          </div>

          <div className="text-right text-sm">
            <div className="text-incense-500">交付日期</div>
            <div
              className={`font-medium ${
                orderPreview.isDeliveryDelayed
                  ? 'text-red-600'
                  : 'text-incense-700'
              }`}
            >
              {formatDateChinese(orderPreview.deliveryDate)}
            </div>
          </div>
        </div>

        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-2 gap-4 text-sm mb-3">
            <div>
              <span className="text-incense-500">原预计完成: </span>
              <span className="text-incense-700">
                {formatDateChinese(orderPreview.originalCompletionDate)}
              </span>
            </div>
            <div>
              <span className="text-incense-500">新预计完成: </span>
              <span
                className={`font-medium ${
                  orderPreview.isDeliveryDelayed
                    ? 'text-red-600'
                    : 'text-green-600'
                }`}
              >
                {formatDateChinese(orderPreview.newCompletionDate)}
                {orderPreview.isDeliveryDelayed
                  ? ` (延误${orderPreview.delayDays}天)`
                  : orderPreview.delayDays < 0
                  ? ` (提前${Math.abs(orderPreview.delayDays)}天)`
                  : ''}
              </span>
            </div>
          </div>

          <div className="text-sm text-incense-500 mb-2">
            调整 {changedSteps.length} 个工序 ·{' '}
            {orderPreview.conflicts.length} 个冲突
          </div>

          {renderStepTimeline(orderPreview)}
        </div>

        {orderPreview.conflicts.length > 0 && (
          <div className="mb-4 space-y-2">
            {orderPreview.conflicts.map((conflict) => (
              <div
                key={conflict.id}
                className={`p-3 rounded border flex items-start gap-3 ${
                  getConflictColor(conflict.level)
                }`}
              >
                {getConflictIcon(conflict.level)}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {getConflictTypeName(conflict.type)}
                    </span>
                    <span className="text-xs opacity-70">
                      {conflict.level === 'critical'
                        ? '严重'
                        : conflict.level === 'warning'
                        ? '警告'
                        : '提示'}
                    </span>
                  </div>
                  <div className="text-sm mt-1">{conflict.detail}</div>
                  {conflict.suggestion && (
                    <div className="text-xs mt-1 opacity-70">
                      建议: {conflict.suggestion}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <div className="text-sm font-medium text-incense-700 mb-2">
            工序详情
          </div>
          {orderPreview.steps.map(renderStepDetail)}
        </div>
      </div>
    );
  };

  const renderPreviewStep = () => {
    if (!sandboxResult) return null;

    const { statistics, craftsmenLoad, allConflicts } = sandboxResult;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-incense-800">
            排程预览
          </h3>
          <button
            onClick={handleRegenerate}
            disabled={isGenerating}
            className="text-sm text-incense-600 hover:text-incense-800 flex items-center gap-1"
          >
            <Shield size={14} />
            重新生成
          </button>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 bg-white rounded-lg border border-gray-200">
            <div className="text-sm text-incense-500 mb-1">订单总数</div>
            <div className="text-2xl font-bold text-incense-800">
              {statistics.totalOrders}
            </div>
          </div>
          <div className="p-4 bg-white rounded-lg border border-gray-200">
            <div className="text-sm text-incense-500 mb-1">交付延误</div>
            <div
              className={`text-2xl font-bold ${
                statistics.ordersWithDelays > 0 ? 'text-red-600' : 'text-green-600'
              }`}
            >
              {statistics.ordersWithDelays}
            </div>
          </div>
          <div className="p-4 bg-white rounded-lg border border-gray-200">
            <div className="text-sm text-incense-500 mb-1">存在冲突</div>
            <div
              className={`text-2xl font-bold ${
                statistics.ordersWithConflicts > 0
                  ? 'text-amber-600'
                  : 'text-green-600'
              }`}
            >
              {statistics.ordersWithConflicts}
            </div>
          </div>
          <div className="p-4 bg-white rounded-lg border border-gray-200">
            <div className="text-sm text-incense-500 mb-1">冲突总数</div>
            <div
              className={`text-2xl font-bold ${
                statistics.criticalConflicts > 0
                  ? 'text-red-600'
                  : statistics.warningConflicts > 0
                  ? 'text-amber-600'
                  : 'text-green-600'
              }`}
            >
              {statistics.totalConflicts}
              <span className="text-sm font-normal text-incense-500 ml-1">
                (严重{statistics.criticalConflicts}/警告
                {statistics.warningConflicts})
              </span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-lg border border-gray-200">
          <h4 className="font-medium text-incense-800 mb-3 flex items-center gap-2">
            <Users size={18} className="text-incense-600" />
            工匠负载概览
          </h4>
          <div className="grid grid-cols-3 gap-4">
            {craftsmenLoad.map((cl) => (
              <div key={cl.craftsmanId} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-incense-700">
                    {cl.craftsmanName}
                  </span>
                  {cl.overloadDays.length > 0 && (
                    <Badge variant="critical" className="text-xs">
                      {cl.overloadDays.length} 天过载
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-incense-500">
                  原负载: {cl.originalLoad} 天 → 新负载:{' '}
                  <span
                    className={
                      cl.loadChange > 0
                        ? 'text-amber-600 font-medium'
                        : cl.loadChange < 0
                        ? 'text-green-600 font-medium'
                        : 'font-medium'
                    }
                  >
                    {cl.newLoad} 天
                    {cl.loadChange !== 0 &&
                      ` (${cl.loadChange > 0 ? '+' : ''}${cl.loadChange})`}
                  </span>
                </div>
                <ProgressBar
                  value={Math.min(100, (cl.newLoad / 30) * 100)}
                  variant={cl.newLoad > 14 ? 'critical' : cl.newLoad > 7 ? 'warning' : 'success'}
                  className="mt-2 h-1.5"
                />
              </div>
            ))}
          </div>
        </div>

        {allConflicts.length > 0 && (
          <div className="p-4 bg-white rounded-lg border border-gray-200">
            <h4 className="font-medium text-incense-800 mb-3 flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-600" />
              所有冲突 ({allConflicts.length})
            </h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {allConflicts.map((conflict) => (
                <div
                  key={conflict.id}
                  className={`p-3 rounded border flex items-start gap-3 ${
                    getConflictColor(conflict.level)
                  }`}
                >
                  {getConflictIcon(conflict.level)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {getConflictTypeName(conflict.type)}
                      </span>
                    </div>
                    <div className="text-sm mt-1">{conflict.detail}</div>
                    {conflict.suggestion && (
                      <div className="text-xs mt-1 opacity-70">
                        建议: {conflict.suggestion}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <h4 className="font-medium text-incense-800">订单排程详情</h4>
          {sandboxResult.orders.map(renderOrderPreview)}
        </div>
      </div>
    );
  };

  const renderConfirmStep = () => {
    if (!sandboxResult) return null;

    const { statistics } = sandboxResult;

    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-incense-800">
          确认应用排程
        </h3>

        <div className="p-6 bg-incense-50 rounded-lg border-2 border-incense-300">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 bg-incense-600 rounded-lg">
              <Shield size={24} className="text-white" />
            </div>
            <div>
              <h4 className="font-semibold text-incense-800 text-lg">
                即将应用以下排程变更
              </h4>
              <p className="text-incense-600 mt-1">
                请仔细确认，应用后将更新所有相关订单的工序日期和负责人，并重新计算预警和采购建议。
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-white rounded-lg">
              <div className="text-sm text-incense-500 mb-1">影响订单数</div>
              <div className="text-xl font-bold text-incense-800">
                {statistics.totalOrders} 个订单
              </div>
            </div>
            <div className="p-4 bg-white rounded-lg">
              <div className="text-sm text-incense-500 mb-1">存在冲突</div>
              <div
                className={`text-xl font-bold ${
                  statistics.totalConflicts > 0 ? 'text-amber-600' : 'text-green-600'
                }`}
              >
                {statistics.totalConflicts} 个冲突
              </div>
            </div>
          </div>

          {statistics.totalConflicts > 0 && (
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-300 mb-6">
              <div className="flex items-start gap-3">
                <AlertTriangle size={20} className="text-amber-600 flex-shrink-0" />
                <div className="text-amber-700">
                  <div className="font-medium">存在未解决的冲突</div>
                  <div className="text-sm mt-1">
                    系统检测到 {statistics.criticalConflicts} 个严重冲突和{' '}
                    {statistics.warningConflicts} 个警告。您可以选择继续应用，或返回预览调整排程策略。
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="p-4 bg-white rounded-lg">
            <div className="font-medium text-incense-800 mb-3">
              应用后系统将自动执行：
            </div>
            <ul className="space-y-2 text-sm text-incense-600">
              <li className="flex items-center gap-2">
                <Check size={16} className="text-green-500" />
                更新所有选中订单的未完成工序的开始日期和结束日期
              </li>
              <li className="flex items-center gap-2">
                <Check size={16} className="text-green-500" />
                重新分配工序负责人
              </li>
              <li className="flex items-center gap-2">
                <Check size={16} className="text-green-500" />
                保留所有已完成的工序不变
              </li>
              <li className="flex items-center gap-2">
                <Check size={16} className="text-green-500" />
                重新计算所有预警信息
              </li>
              <li className="flex items-center gap-2">
                <Check size={16} className="text-green-500" />
                重新计算采购建议
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'select':
        return renderSelectStep();
      case 'strategy':
        return renderStrategyStep();
      case 'preview':
        return renderPreviewStep();
      case 'confirm':
        return renderConfirmStep();
      default:
        return null;
    }
  };

  const steps: { key: SandboxStep; label: string }[] = [
    { key: 'select', label: '选择订单' },
    { key: 'strategy', label: '选择策略' },
    { key: 'preview', label: '预览排程' },
    { key: 'confirm', label: '确认应用' },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === currentStep);
  const canProceed =
    (currentStep === 'select' && sandboxSelectedOrderIds.length > 0) ||
    currentStep === 'strategy' ||
    currentStep === 'preview' ||
    currentStep === 'confirm';

  if (!showSandboxModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />

      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold font-song text-incense-800">
              全局排程沙盘
            </h2>
            <p className="text-sm text-incense-500 mt-1">
              模拟多订单排期重算，预览冲突后再应用到真实订单
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-center">
            {steps.map((step, index) => (
              <React.Fragment key={step.key}>
                <div className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      index < currentStepIndex
                        ? 'bg-incense-600 text-white'
                        : index === currentStepIndex
                        ? 'bg-incense-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {index < currentStepIndex ? (
                      <Check size={16} />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span
                    className={`ml-2 text-sm ${
                      index <= currentStepIndex
                        ? 'text-incense-800 font-medium'
                        : 'text-gray-400'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`w-16 h-0.5 mx-2 ${
                      index < currentStepIndex ? 'bg-incense-600' : 'bg-gray-200'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isGenerating ? (
            <div className="flex flex-col items-center justify-center h-64">
              <div className="w-12 h-12 border-4 border-incense-200 border-t-incense-600 rounded-full animate-spin mb-4" />
              <div className="text-incense-600 font-medium">正在生成排程...</div>
              <div className="text-sm text-incense-500 mt-1">
                系统正在计算最优工序日期和负责人分配
              </div>
            </div>
          ) : (
            renderStepContent()
          )}
        </div>

        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={currentStep === 'select' ? handleClose : handleBack}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 text-incense-600 hover:bg-incense-50 rounded-lg transition-colors"
          >
            {currentStep === 'select' ? (
              '取消'
            ) : (
              <>
                <ChevronLeft size={18} />
                上一步
              </>
            )}
          </button>

          <button
            onClick={handleNext}
            disabled={!canProceed || isGenerating}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-colors ${
              canProceed && !isGenerating
                ? currentStep === 'confirm'
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-incense-600 hover:bg-incense-700 text-white'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {currentStep === 'confirm' ? (
              <>
                <Check size={18} />
                确认应用
              </>
            ) : (
              <>
                {currentStep === 'preview' ? '继续确认' : '下一步'}
                <ChevronRight size={18} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SandboxModal;
