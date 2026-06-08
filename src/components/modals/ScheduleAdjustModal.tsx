import React from 'react';
import {
  X,
  Calendar,
  Clock,
  User,
  AlertTriangle,
  CheckCircle,
  Circle,
  Play,
  ChevronRight,
  RotateCcw,
  GripVertical,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  Plus,
  MinusCircle,
  Info,
  AlertCircle,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useScheduleAdjust } from '../../hooks/useScheduleAdjust';
import { formatDateChinese, getDaysRemaining } from '../../utils/dateUtils';
import { getStepAdjustTooltip } from '../../utils/scheduleUtils';
import { ProductionStep, StepStatus, STEP_CONFIG, StepUpdateData, Warning } from '../../types';
import { clsx } from 'clsx';

const ScheduleAdjustModal: React.FC = () => {
  const {
    scheduleAdjustOrderId,
    setScheduleAdjustOrderId,
    setShowScheduleAdjustModal,
    updateProductionStep,
    recipes,
    getRecipeById,
  } = useAppStore();

  const order = useAppStore((state) =>
    state.orders.find((o) => o.id === scheduleAdjustOrderId)
  );

  const recipe = order ? getRecipeById(order.recipeId) : undefined;

  const handleClose = () => {
    setScheduleAdjustOrderId(null);
    setShowScheduleAdjustModal(false);
  };

  const handleApply = (orderId: string, stepId: string, updates: StepUpdateData) => {
    updateProductionStep(orderId, stepId, updates);
  };

  const {
    selectedStepId,
    preview,
    hasChanges,
    selectStep,
    updateStepStartDate,
    updateStepDuration,
    resetChanges,
    applyChanges,
    getStepPreview,
  } = useScheduleAdjust({
    order,
    recipes,
    onApply: handleApply,
    onClose: handleClose,
  });

  if (!order || !recipe) return null;

  const daysToDelivery = getDaysRemaining(order.deliveryDate);
  const completedSteps = order.steps.filter((s) => s.status === 'completed').length;
  const totalSteps = order.steps.length;
  const progress = (completedSteps / totalSteps) * 100;

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

  const handleDateChange = (stepId: string, value: string) => {
    if (!value) return;
    const result = updateStepStartDate(stepId, value);
    if (result && !result.success && result.message) {
      alert(result.message);
    }
  };

  const handleDurationChange = (stepId: string, value: string) => {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue <= 0) return;
    const result = updateStepDuration(stepId, numValue);
    if (result && !result.success && result.message) {
      alert(result.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-incense-50 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-fade-in-up">
        <div className="flex items-center justify-between p-6 border-b border-incense-200 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-sandal-600 rounded-xl flex items-center justify-center">
              <Calendar size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-song text-incense-800">
                生产排期调整
              </h2>
              <p className="text-sm text-incense-500">
                {order.orderNo} - {order.customerName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {hasChanges && (
              <span className="text-xs bg-sandal-100 text-sandal-600 px-2 py-1 rounded-full">
                有未保存的更改
              </span>
            )}
            <button
              onClick={handleClose}
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
                <Calendar
                  size={16}
                  className={daysToDelivery <= 3 ? 'text-warning-critical' : 'text-incense-500'}
                />
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
            <div className="h-2 bg-incense-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-bamboo-400 to-bamboo-600 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-incense-800">调整生产排期</h3>
              <p className="text-xs text-incense-500">
                点击工序卡片修改开始日期或持续天数，后续工序将自动顺延
              </p>
            </div>

            <div className="space-y-2">
              {order.steps.map((step: ProductionStep, index: number) => {
                const stepPreview = getStepPreview(step.id);
                const isSelected = selectedStepId === step.id;
                const isCompleted = step.status === 'completed';
                const canEdit = !isCompleted;

                return (
                  <div
                    key={step.id}
                    className={clsx(
                      'relative transition-all duration-300',
                      stepPreview?.isChanged && 'animate-pulse-subtle'
                    )}
                  >
                    {index < order.steps.length - 1 && (
                      <div className="absolute left-6 top-full w-0.5 h-2 bg-incense-200 z-0" />
                    )}

                    <div
                      className={clsx(
                        'relative z-10 flex items-center gap-4 p-4 rounded-xl transition-all duration-200 cursor-pointer border-2',
                        isSelected && 'border-sandal-400 bg-sandal-50',
                        !isSelected && stepPreview?.isChanged && 'border-sandal-300 bg-sandal-50/50',
                        !isSelected && stepPreview?.isAffected && !stepPreview.isChanged && 'border-incense-200 bg-amber-50/50',
                        !isSelected && !stepPreview?.isChanged && !stepPreview?.isAffected && 'border-transparent bg-white hover:bg-incense-50',
                        isCompleted && 'opacity-60 cursor-not-allowed'
                      )}
                      onClick={() => canEdit && selectStep(step.id)}
                      title={getStepAdjustTooltip(stepPreview!)}
                    >
                      <div className="flex-shrink-0">
                        <GripVertical
                          size={20}
                          className={clsx(
                            'transition-colors',
                            canEdit ? 'text-incense-300 hover:text-incense-500' : 'text-incense-200'
                          )}
                        />
                      </div>

                      <div className="flex-shrink-0">{getStepIcon(step.status)}</div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-incense-800">{step.stepName}</span>
                          <span
                            className="text-xs px-2 py-0.5 rounded"
                            style={{
                              backgroundColor: `${STEP_CONFIG[step.stepType].color}20`,
                              color: STEP_CONFIG[step.stepType].color,
                            }}
                          >
                            {stepPreview?.newDurationDays || step.durationDays}天
                          </span>
                          {stepPreview?.isChanged && (
                            <span className="text-xs bg-sandal-100 text-sandal-700 px-2 py-0.5 rounded-full">
                              已调整
                            </span>
                          )}
                          {stepPreview?.isAffected && !stepPreview.isChanged && (
                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                              将{stepPreview.shiftDays > 0 ? '延后' : '提前'}{Math.abs(stepPreview.shiftDays)}天
                            </span>
                          )}
                        </div>

                        {isSelected && canEdit ? (
                          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-incense-500 mb-1">
                                开始日期
                              </label>
                              <input
                                type="date"
                                value={stepPreview?.newStartDate || step.startDate}
                                onChange={(e) => handleDateChange(step.id, e.target.value)}
                                className="w-full px-3 py-2 border border-incense-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sandal-500 focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-incense-500 mb-1">
                                持续天数
                              </label>
                              <input
                                type="number"
                                min="1"
                                value={stepPreview?.newDurationDays || step.durationDays}
                                onChange={(e) => handleDurationChange(step.id, e.target.value)}
                                className="w-full px-3 py-2 border border-incense-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sandal-500 focus:border-transparent"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-incense-500 mt-1">
                            <span className={clsx(
                              stepPreview?.isChanged && 'text-sandal-600 font-medium'
                            )}>
                              {formatDateChinese(stepPreview?.newStartDate || step.startDate)}
                            </span>
                            {' → '}
                            <span className={clsx(
                              stepPreview?.isChanged && 'text-sandal-600 font-medium'
                            )}>
                              {formatDateChinese(stepPreview?.newEndDate || step.endDate)}
                            </span>
                            {stepPreview?.isChanged && (
                              <span className="ml-2 text-sandal-500">
                                (原: {formatDateChinese(step.startDate)} → {formatDateChinese(step.endDate)})
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {step.assignee && (
                        <div className="flex items-center gap-1 text-xs text-incense-500 flex-shrink-0">
                          <User size={12} />
                          <span>{step.assignee}</span>
                        </div>
                      )}

                      {index < order.steps.length - 1 && (
                        <ChevronRight size={16} className="text-incense-300 flex-shrink-0" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {hasChanges && preview && preview.deliveryImpact && (
            <div className="card p-4 border-l-4 border-l-sandal-500 bg-gradient-to-r from-sandal-50/50 to-incense-50">
              <h3 className="font-semibold text-incense-800 mb-4 flex items-center gap-2">
                <Info size={18} className="text-sandal-600" />
                交付影响摘要
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-white p-3 rounded-lg border border-incense-200">
                  <div className="text-xs text-incense-500 mb-1">预计完工日期</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-incense-800">
                      {formatDateChinese(preview.deliveryImpact.newCompletionDate)}
                    </span>
                    {preview.deliveryImpact.newCompletionDate !== preview.deliveryImpact.originalCompletionDate && (
                      <>
                        <span className="text-xs text-incense-400">
                          (原: {formatDateChinese(preview.deliveryImpact.originalCompletionDate)})
                        </span>
                        <span className={clsx(
                          'text-xs px-2 py-0.5 rounded-full font-medium',
                          preview.deliveryImpact.completionShiftDays > 0
                            ? 'bg-red-50 text-warning-critical'
                            : 'bg-green-50 text-bamboo-600'
                        )}>
                          {preview.deliveryImpact.completionShiftDays > 0 ? '+' : ''}
                          {preview.deliveryImpact.completionShiftDays}天
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className={clsx(
                  'bg-white p-3 rounded-lg border',
                  preview.deliveryImpact.daysRelativeToDelivery > 0
                    ? 'border-warning-critical/30 bg-red-50/30'
                    : preview.deliveryImpact.daysRelativeToDelivery < 0
                      ? 'border-bamboo-400/30 bg-green-50/30'
                      : 'border-incense-200'
                )}>
                  <div className="text-xs text-incense-500 mb-1">相对交付期</div>
                  <div className="flex items-center gap-2">
                    {preview.deliveryImpact.daysRelativeToDelivery > 0 ? (
                      <>
                        <TrendingUp size={16} className="text-warning-critical" />
                        <span className="font-semibold text-warning-critical">
                          延误 {preview.deliveryImpact.daysRelativeToDelivery} 天
                        </span>
                      </>
                    ) : preview.deliveryImpact.daysRelativeToDelivery < 0 ? (
                      <>
                        <TrendingDown size={16} className="text-bamboo-600" />
                        <span className="font-semibold text-bamboo-600">
                          提前 {Math.abs(preview.deliveryImpact.daysRelativeToDelivery)} 天
                        </span>
                      </>
                    ) : (
                      <>
                        <CheckCircle size={16} className="text-bamboo-600" />
                        <span className="font-semibold text-bamboo-600">准时交付</span>
                      </>
                    )}
                  </div>
                  <div className="text-xs text-incense-400 mt-1">
                    交付期: {formatDateChinese(preview.deliveryImpact.deliveryDate)}
                  </div>
                </div>

                <div className="bg-white p-3 rounded-lg border border-incense-200">
                  <div className="text-xs text-incense-500 mb-1">预警变化</div>
                  <div className="flex items-center gap-3 flex-wrap">
                    {preview.warningDiff.added.length > 0 && (
                      <div className="flex items-center gap-1">
                        <AlertCircle size={14} className="text-warning-critical" />
                        <span className="text-sm font-medium text-warning-critical">
                          +{preview.warningDiff.added.length} 新增
                        </span>
                      </div>
                    )}
                    {preview.warningDiff.removed.length > 0 && (
                      <div className="flex items-center gap-1">
                        <CheckCircle size={14} className="text-bamboo-600" />
                        <span className="text-sm font-medium text-bamboo-600">
                          -{preview.warningDiff.removed.length} 解除
                        </span>
                      </div>
                    )}
                    {preview.warningDiff.added.length === 0 && preview.warningDiff.removed.length === 0 && (
                      <div className="flex items-center gap-1">
                        <Minus size={14} className="text-incense-400" />
                        <span className="text-sm text-incense-500">无变化</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {preview.deliveryImpact.affectedSteps.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs text-incense-500 mb-2">受影响的工序</div>
                  <div className="flex flex-wrap gap-2">
                    {preview.deliveryImpact.affectedSteps.map((affected, idx) => (
                      <div
                        key={`${affected.stepId}-${idx}`}
                        className={clsx(
                          'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs',
                          affected.isChanged
                            ? 'bg-sandal-100 text-sandal-700 border border-sandal-300'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        )}
                      >
                        {affected.isChanged ? (
                          <GripVertical size={12} />
                        ) : (
                          <ArrowRight size={12} />
                        )}
                        <span>{affected.stepName}</span>
                        {affected.shiftDays !== 0 && (
                          <span className={clsx(
                            'ml-1',
                            affected.shiftDays > 0 ? 'text-warning-critical' : 'text-bamboo-600'
                          )}>
                            {affected.shiftDays > 0 ? '+' : ''}{affected.shiftDays}天
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {preview.warningDiff.added.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs text-warning-critical mb-2 flex items-center gap-1">
                    <Plus size={12} />
                    新增预警
                  </div>
                  <div className="space-y-1">
                    {preview.warningDiff.added.map((warning: Warning) => (
                      <div
                        key={warning.id}
                        className={clsx(
                          'p-2 rounded text-xs',
                          warning.level === 'critical' && 'bg-red-50 text-warning-critical border border-warning-critical/20',
                          warning.level === 'warning' && 'bg-amber-50 text-sandal-500 border border-sandal-300/20',
                          warning.level === 'info' && 'bg-blue-50 text-blue-600 border border-blue-200'
                        )}
                      >
                        {warning.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {preview.warningDiff.removed.length > 0 && (
                <div>
                  <div className="text-xs text-bamboo-600 mb-2 flex items-center gap-1">
                    <MinusCircle size={12} />
                    解除预警
                  </div>
                  <div className="space-y-1">
                    {preview.warningDiff.removed.map((warning: Warning) => (
                      <div
                        key={warning.id}
                        className="p-2 rounded text-xs bg-green-50 text-bamboo-600 border border-bamboo-300/20 line-through opacity-70"
                      >
                        {warning.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {preview && preview.warningDiff.unchanged.length > 0 && hasChanges && (
            <div className="card p-4 border-l-4 border-l-warning-critical">
              <h3 className="font-semibold text-warning-critical mb-3 flex items-center gap-2">
                <AlertTriangle size={18} />
                仍存在的预警
              </h3>
              <div className="space-y-2">
                {preview.warningDiff.unchanged.map((warning: Warning) => (
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

          {!hasChanges && preview && preview.newWarnings.length > 0 && (
            <div className="card p-4 border-l-4 border-l-warning-critical">
              <h3 className="font-semibold text-warning-critical mb-3 flex items-center gap-2">
                <AlertTriangle size={18} />
                当前预警
              </h3>
              <div className="space-y-2">
                {preview.newWarnings.map((warning: Warning) => (
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
          <button onClick={handleClose} className="btn-secondary">
            取消
          </button>
          {hasChanges && (
            <button onClick={resetChanges} className="btn-secondary flex items-center gap-2">
              <RotateCcw size={16} />
              重置
            </button>
          )}
          <button
            onClick={applyChanges}
            disabled={!hasChanges}
            className={clsx(
              'flex items-center gap-2',
              hasChanges ? 'btn-primary' : 'btn-secondary opacity-50 cursor-not-allowed'
            )}
          >
            <CheckCircle size={16} />
            确认调整
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleAdjustModal;
