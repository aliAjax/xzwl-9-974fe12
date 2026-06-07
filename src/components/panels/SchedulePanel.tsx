import React, { useState } from 'react';
import { X, Users, User, Clock, CheckCircle, Play, Circle, ChevronDown, ChevronUp, Hand, Scroll, Cloud, Archive, Package } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { STEP_CONFIG, STEP_ORDER, StepType, Order, ProductionStep, Craftsman } from '../../types';
import { formatDateChinese } from '../../utils/dateUtils';
import { clsx } from 'clsx';

interface SchedulePanelProps {
  onClose: () => void;
}

const StepIcon: React.FC<{ stepType: StepType; size?: number }> = ({ stepType, size = 16 }) => {
  const config = STEP_CONFIG[stepType];
  const IconComponent = {
    kneading: Hand,
    shaping: Scroll,
    drying: Cloud,
    cellaring: Archive,
    packaging: Package,
  }[stepType];
  return <IconComponent size={size} style={{ color: config.color }} />;
};

export const SchedulePanel: React.FC<SchedulePanelProps> = ({ onClose }) => {
  const {
    orders,
    craftsmen,
    assignStepToCraftsman,
    getCraftsmanTasks,
    setSelectedOrderId,
  } = useAppStore();

  const [selectedCraftsmanId, setSelectedCraftsmanId] = useState<string | null>(null);
  const [assigningStep, setAssigningStep] = useState<{ orderId: string; stepId: string } | null>(null);

  const inProgressSteps: { order: Order; step: ProductionStep }[] = [];
  orders.forEach((order) => {
    order.steps.forEach((step) => {
      if (step.status === 'in_progress') {
        inProgressSteps.push({ order, step });
      }
    });
  });

  const getStepIcon = (status: ProductionStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={14} className="text-bamboo-500" />;
      case 'in_progress':
        return <Play size={14} className="text-sandal-500" />;
      default:
        return <Circle size={14} className="text-incense-300" />;
    }
  };

  const getStatusLabel = (status: Craftsman['status']) => {
    switch (status) {
      case 'working':
        return { label: '工作中', color: 'bg-bamboo-500' };
      case 'available':
        return { label: '空闲', color: 'bg-blue-500' };
      case 'rest':
        return { label: '休息', color: 'bg-incense-400' };
    }
  };

  const getStepsByType = (craftsmanName: string) => {
    const tasks = getCraftsmanTasks(craftsmanName);
    const grouped: Record<StepType, { order: Order; step: ProductionStep }[]> = {
      kneading: [],
      shaping: [],
      drying: [],
      cellaring: [],
      packaging: [],
    };
    tasks.forEach((task) => {
      grouped[task.step.stepType].push(task);
    });
    return grouped;
  };

  const handleAssign = (craftsmanName: string) => {
    if (assigningStep) {
      assignStepToCraftsman(assigningStep.orderId, assigningStep.stepId, craftsmanName);
      setAssigningStep(null);
    }
  };

  const selectedCraftsman = craftsmen.find((c) => c.id === selectedCraftsmanId);

  return (
    <div className="fixed inset-0 z-50 flex justify-end print:hidden">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-3xl bg-incense-50 h-full shadow-2xl flex flex-col animate-slide-up">
        <div className="flex items-center justify-between p-4 border-b border-incense-200 bg-white">
          <div className="flex items-center gap-2">
            <Users className="text-incense-600" size={24} />
            <h2 className="text-xl font-bold font-song text-incense-800">生产排班</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-incense-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex">
          <div className="w-64 border-r border-incense-200 bg-white overflow-y-auto scrollbar-thin">
            <div className="p-3 border-b border-incense-100">
              <h3 className="text-sm font-semibold text-incense-600 mb-2">工匠列表</h3>
              <div className="space-y-1">
                {craftsmen.map((craftsman) => {
                  const statusInfo = getStatusLabel(craftsman.status);
                  const taskCount = getCraftsmanTasks(craftsman.name).length;
                  return (
                    <button
                      key={craftsman.id}
                      onClick={() => setSelectedCraftsmanId(
                        selectedCraftsmanId === craftsman.id ? null : craftsman.id
                      )}
                      className={clsx(
                        'w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left',
                        selectedCraftsmanId === craftsman.id
                          ? 'bg-sandal-100 border border-sandal-300'
                          : 'hover:bg-incense-50'
                      )}
                    >
                      <div className="w-10 h-10 rounded-full bg-incense-700 flex items-center justify-center text-white font-song font-bold">
                        {craftsman.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-incense-800 truncate">
                            {craftsman.name}
                          </span>
                          <span className={clsx('w-2 h-2 rounded-full', statusInfo.color)} />
                        </div>
                        <div className="flex items-center gap-2 text-xs text-incense-500">
                          <span>{statusInfo.label}</span>
                          <span>·</span>
                          <span>{taskCount} 个任务</span>
                        </div>
                      </div>
                      {selectedCraftsmanId === craftsman.id ? (
                        <ChevronUp size={16} className="text-incense-400" />
                      ) : (
                        <ChevronDown size={16} className="text-incense-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-3">
              <h3 className="text-sm font-semibold text-incense-600 mb-2">待指派工序</h3>
              <div className="space-y-2">
                {inProgressSteps.filter(({ step }) => !step.assignee).length === 0 ? (
                  <p className="text-xs text-incense-400 text-center py-4">
                    所有工序已指派
                  </p>
                ) : (
                  inProgressSteps
                    .filter(({ step }) => !step.assignee)
                    .map(({ order, step }) => (
                      <div
                        key={step.id}
                        className={clsx(
                          'p-2 rounded-lg border transition-colors',
                          assigningStep?.stepId === step.id
                            ? 'bg-sandal-50 border-sandal-400'
                            : 'bg-incense-50 border-incense-200 hover:border-incense-300'
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <StepIcon stepType={step.stepType} />
                          <span className="text-sm font-medium text-incense-800">
                            {order.orderNo}
                          </span>
                        </div>
                        <p className="text-xs text-incense-500 mb-2">
                          {step.stepName} · {order.customerName}
                        </p>
                        <button
                          onClick={() => setAssigningStep(
                            assigningStep?.stepId === step.id
                              ? null
                              : { orderId: order.id, stepId: step.id }
                          )}
                          className={clsx(
                            'w-full text-xs py-1 rounded transition-colors',
                            assigningStep?.stepId === step.id
                              ? 'bg-incense-200 text-incense-600'
                              : 'bg-incense-700 text-white hover:bg-incense-800'
                          )}
                        >
                          {assigningStep?.stepId === step.id ? '取消选择' : '指派工匠'}
                        </button>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
            {assigningStep && (
              <div className="mb-4 p-3 bg-sandal-50 border border-sandal-300 rounded-lg">
                <p className="text-sm text-incense-700 mb-2">
                  {(() => {
                    const order = orders.find((o) => o.id === assigningStep.orderId);
                    const step = order?.steps.find((s) => s.id === assigningStep.stepId);
                    return step?.assignee
                      ? `将「${order?.orderNo}」的${step?.stepName}工序从「${step.assignee}」改派给：`
                      : `请选择要指派「${order?.orderNo}」${step?.stepName}工序的工匠：`;
                  })()}
                </p>
                <div className="flex flex-wrap gap-2">
                  {craftsmen
                    .filter((c) => c.status !== 'rest')
                    .map((craftsman) => (
                      <button
                        key={craftsman.id}
                        onClick={() => handleAssign(craftsman.name)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-incense-200 rounded-lg hover:bg-incense-50 hover:border-incense-300 transition-colors"
                      >
                        <div className="w-6 h-6 rounded-full bg-incense-700 flex items-center justify-center text-white text-xs font-bold">
                          {craftsman.avatar}
                        </div>
                        <span className="text-sm text-incense-700">{craftsman.name}</span>
                      </button>
                    ))}
                  <button
                    onClick={() => setAssigningStep(null)}
                    className="px-3 py-1.5 text-sm text-incense-500 hover:text-incense-700 transition-colors"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}

            {selectedCraftsman ? (
              <div className="space-y-4">
                <div className="card p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full bg-incense-700 flex items-center justify-center text-white font-song text-xl font-bold">
                      {selectedCraftsman.avatar}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold font-song text-incense-800">
                        {selectedCraftsman.name}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-incense-500">
                        <span className={clsx('w-2 h-2 rounded-full', getStatusLabel(selectedCraftsman.status).color)} />
                        <span>{getStatusLabel(selectedCraftsman.status).label}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <span className="text-xs text-incense-500">擅长工序：</span>
                    {selectedCraftsman.skills.map((skill) => (
                      <span
                        key={skill}
                        className="text-xs px-2 py-0.5 rounded"
                        style={{
                          backgroundColor: `${STEP_CONFIG[skill].color}15`,
                          color: STEP_CONFIG[skill].color,
                        }}
                      >
                        {STEP_CONFIG[skill].name}
                      </span>
                    ))}
                  </div>
                </div>

                <h4 className="text-sm font-semibold text-incense-600">任务分布</h4>

                {STEP_ORDER.map((stepType) => {
                  const config = STEP_CONFIG[stepType];
                  const tasks = getStepsByType(selectedCraftsman.name)[stepType];
                  if (tasks.length === 0) return null;

                  return (
                    <div key={stepType} className="card p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${config.color}15` }}
                        >
                          <StepIcon stepType={stepType} size={18} />
                        </div>
                        <span className="font-medium text-incense-800">{config.name}</span>
                        <span className="text-xs text-incense-400">({tasks.length})</span>
                      </div>
                      <div className="space-y-2">
                        {tasks.map(({ order, step }) => (
                          <div
                            key={step.id}
                            className="p-2 bg-incense-50 rounded-lg hover:bg-incense-100 transition-colors cursor-pointer"
                            onClick={() => {
                              setSelectedOrderId(order.id);
                              onClose();
                            }}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                {getStepIcon(step.status)}
                                <span className="text-sm font-medium text-incense-800">
                                  {order.orderNo}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                {step.status === 'in_progress' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setAssigningStep({ orderId: order.id, stepId: step.id });
                                    }}
                                    className="text-xs px-1.5 py-0.5 bg-sandal-100 text-sandal-700 rounded hover:bg-sandal-200 transition-colors flex items-center gap-0.5"
                                  >
                                    <span>改派</span>
                                    <span>↻</span>
                                  </button>
                                )}
                                <span
                                  className="text-xs px-1.5 py-0.5 rounded"
                                  style={{
                                    backgroundColor: `${config.color}15`,
                                    color: config.color,
                                  }}
                                >
                                  {step.durationDays}天
                                </span>
                              </div>
                            </div>
                            <p className="text-xs text-incense-500">{order.customerName}</p>
                            <div className="flex items-center gap-1 mt-1 text-xs text-incense-400">
                              <Clock size={10} />
                              <span>
                                {formatDateChinese(step.startDate)} - {formatDateChinese(step.endDate)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {getCraftsmanTasks(selectedCraftsman.name).length === 0 && (
                  <div className="text-center py-8 text-incense-400">
                    <User size={48} className="mx-auto mb-2 opacity-30" />
                    <p>该工匠暂无任务</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-incense-600">全局任务概览</h4>
                {STEP_ORDER.map((stepType) => {
                  const config = STEP_CONFIG[stepType];
                  const stepOrders = orders.filter((order) => {
                    const currentStep = order.steps.find((s) => s.status === 'in_progress');
                    return currentStep?.stepType === stepType;
                  });

                  if (stepOrders.length === 0) return null;

                  return (
                    <div key={stepType} className="card p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${config.color}15` }}
                        >
                          <StepIcon stepType={stepType} size={18} />
                        </div>
                        <span className="font-medium text-incense-800">{config.name}</span>
                        <span className="text-xs text-incense-400">({stepOrders.length} 个进行中)</span>
                      </div>
                      <div className="space-y-2">
                        {stepOrders.map((order) => {
                          const step = order.steps.find((s) => s.status === 'in_progress')!;
                          return (
                            <div
                              key={order.id}
                              className="p-2 bg-incense-50 rounded-lg hover:bg-incense-100 transition-colors cursor-pointer"
                              onClick={() => {
                                setSelectedOrderId(order.id);
                                onClose();
                              }}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-incense-800">
                                    {order.orderNo}
                                  </span>
                                </div>
                                {step.assignee ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setAssigningStep({ orderId: order.id, stepId: step.id });
                                    }}
                                    className="flex items-center gap-1 text-xs text-incense-600 bg-white px-2 py-0.5 rounded border border-incense-200 hover:border-sandal-400 hover:bg-sandal-50 transition-colors"
                                  >
                                    <User size={10} />
                                    <span>{step.assignee}</span>
                                    <span className="text-incense-400 ml-1">↻</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setAssigningStep({ orderId: order.id, stepId: step.id });
                                    }}
                                    className="text-xs px-2 py-0.5 bg-sandal-500 text-white rounded hover:bg-sandal-600 transition-colors"
                                  >
                                    待指派
                                  </button>
                                )}
                              </div>
                              <p className="text-xs text-incense-500">{order.customerName}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
