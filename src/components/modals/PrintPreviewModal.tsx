import React from 'react';
import { X, Printer, Calendar, User, AlertTriangle, CheckCircle, Circle, Play } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { formatDateChinese, getDaysRemaining } from '../../utils/dateUtils';
import { ProductionStep, StepStatus, STEP_CONFIG } from '../../types';
import { clsx } from 'clsx';

const PrintPreviewModal: React.FC = () => {
  const {
    selectedOrderId,
    showPrintPreview,
    setShowPrintPreview,
    setSelectedOrderId,
    getRecipeById,
    getOrderWarnings,
  } = useAppStore();

  const order = useAppStore((state) => state.orders.find((o) => o.id === selectedOrderId));
  const recipe = order ? getRecipeById(order.recipeId) : undefined;
  const warnings = order ? getOrderWarnings(order.id) : [];

  if (!showPrintPreview || !order || !recipe) return null;

  const completedSteps = order.steps.filter((s) => s.status === 'completed').length;
  const totalSteps = order.steps.length;
  const progress = (completedSteps / totalSteps) * 100;
  const daysToDelivery = getDaysRemaining(order.deliveryDate);

  const getStepIcon = (status: StepStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={16} className="text-bamboo-500" />;
      case 'in_progress':
        return <Play size={16} className="text-sandal-500" />;
      case 'delayed':
        return <AlertTriangle size={16} className="text-warning-critical" />;
      default:
        return <Circle size={16} className="text-incense-300" />;
    }
  };

  const getStatusLabel = (status: StepStatus) => {
    switch (status) {
      case 'completed':
        return '已完成';
      case 'in_progress':
        return '进行中';
      case 'delayed':
        return '已延期';
      default:
        return '未开始';
    }
  };

  const priorityLabel = {
    high: '高优先级',
    medium: '中优先级',
    low: '低优先级',
  };

  const handlePrint = () => {
    window.print();
  };

  const handleClose = () => {
    setShowPrintPreview(false);
    setSelectedOrderId(null);
  };

  const totalIngredients = recipe.ingredients.reduce((sum, ing) => sum + ing.quantity, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:p-0">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm print:hidden"
        onClick={handleClose}
      />
      <div className="relative w-full max-w-3xl max-h-[95vh] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col animate-fade-in-up print:max-h-none print:rounded-none print:shadow-none print:animate-none">
        <div className="flex items-center justify-between p-4 border-b border-incense-200 bg-incense-50 print:hidden">
          <h2 className="text-lg font-bold font-song text-incense-800">工单打印预览</h2>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} className="btn-primary flex items-center gap-2">
              <Printer size={16} />
              打印工单
            </button>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg hover:bg-incense-100 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 print:overflow-visible print:p-0 print:pt-6">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8 pb-6 border-b-2 border-incense-800">
              <h1 className="text-3xl font-bold font-song text-incense-800 mb-2">生产工单</h1>
              <p className="text-incense-500 font-song">香韵堂传统制香工艺</p>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-8">
              <div>
                <p className="text-sm text-incense-500 mb-1">订单编号</p>
                <p className="text-xl font-bold font-song text-incense-800">{order.orderNo}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-incense-500 mb-1">优先级</p>
                <span
                  className={clsx(
                    'inline-block px-3 py-1 rounded-full text-sm font-medium',
                    order.priority === 'high' && 'bg-red-100 text-red-700',
                    order.priority === 'medium' && 'bg-amber-100 text-amber-700',
                    order.priority === 'low' && 'bg-green-100 text-green-700'
                  )}
                >
                  {priorityLabel[order.priority]}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-8 p-4 bg-incense-50 rounded-lg">
              <div>
                <p className="text-sm text-incense-500 mb-1 flex items-center gap-1">
                  <User size={14} />
                  客户名称
                </p>
                <p className="font-medium text-incense-800">{order.customerName}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-incense-500 mb-1 flex items-center gap-1 justify-end">
                  <Calendar size={14} />
                  交付日期
                </p>
                <p
                  className={clsx(
                    'font-medium',
                    daysToDelivery <= 3 ? 'text-warning-critical' : 'text-incense-800'
                  )}
                >
                  {formatDateChinese(order.deliveryDate)}
                </p>
                <p className="text-xs text-incense-500">
                  {daysToDelivery > 0
                    ? `还剩 ${daysToDelivery} 天`
                    : daysToDelivery < 0
                      ? `已逾期 ${Math.abs(daysToDelivery)} 天`
                      : '今天到期'}
                </p>
              </div>
            </div>

            <div className="mb-8">
              <h2 className="text-lg font-bold font-song text-incense-800 mb-4 pb-2 border-b border-incense-200">
                香方信息
              </h2>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-incense-500 mb-1">香方名称</p>
                  <p className="font-medium text-incense-800 font-song text-lg">{recipe.name}</p>
                  <p className="text-sm text-incense-500 mt-1">{recipe.description}</p>
                </div>
                <div>
                  <p className="text-sm text-incense-500 mb-1">生产数量</p>
                  <p className="font-medium text-incense-800">
                    {order.quantity} {order.unit}
                  </p>
                  <p className="text-xs text-incense-500 mt-1">
                    下单日期：{formatDateChinese(order.orderDate)}
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-8">
              <h2 className="text-lg font-bold font-song text-incense-800 mb-4 pb-2 border-b border-incense-200">
                配方用量
              </h2>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-incense-50">
                    <th className="text-left p-3 border border-incense-200 text-sm font-medium text-incense-700">
                      原料名称
                    </th>
                    <th className="text-right p-3 border border-incense-200 text-sm font-medium text-incense-700">
                      用量
                    </th>
                    <th className="text-right p-3 border border-incense-200 text-sm font-medium text-incense-700">
                      单位
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recipe.ingredients.map((ing) => (
                    <tr key={ing.ingredientId}>
                      <td className="p-3 border border-incense-200 text-incense-800">{ing.name}</td>
                      <td className="p-3 border border-incense-200 text-right text-incense-600 font-mono">
                        {ing.quantity}
                      </td>
                      <td className="p-3 border border-incense-200 text-right text-incense-500">
                        {ing.unit}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-incense-50 font-medium">
                    <td className="p-3 border border-incense-200 text-incense-800">合计</td>
                    <td className="p-3 border border-incense-200 text-right text-incense-800 font-mono">
                      {totalIngredients}
                    </td>
                    <td className="p-3 border border-incense-200 text-right text-incense-500">g</td>
                  </tr>
                </tbody>
              </table>
              <div className="mt-4 p-3 bg-amber-50 rounded border border-amber-200">
                <p className="text-sm text-incense-700">
                  <span className="font-medium">工艺说明：</span>
                  {recipe.craftNotes}
                </p>
                <div className="flex gap-6 mt-2 text-sm text-incense-500">
                  <span>阴干期：{recipe.dryingDays} 天</span>
                  <span>窖藏期：{recipe.cellaringDays} 天</span>
                </div>
              </div>
            </div>

            <div className="mb-8">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-incense-200">
                <h2 className="text-lg font-bold font-song text-incense-800">生产步骤</h2>
                <span className="text-sm text-incense-500">
                  进度：{completedSteps}/{totalSteps} ({Math.round(progress)}%)
                </span>
              </div>
              <div className="space-y-3">
                {order.steps.map((step: ProductionStep, index: number) => (
                  <div
                    key={step.id}
                    className={clsx(
                      'flex items-center gap-4 p-4 rounded-lg border',
                      step.status === 'in_progress' && 'bg-sandal-50 border-sandal-300',
                      step.status === 'completed' && 'bg-bamboo-50 border-bamboo-300',
                      step.status === 'delayed' && 'bg-red-50 border-red-300',
                      step.status === 'not_started' && 'bg-incense-50 border-incense-200'
                    )}
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white flex items-center justify-center border-2 border-incense-200">
                      {index + 1}
                    </div>
                    <div className="flex-shrink-0">{getStepIcon(step.status)}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-incense-800">{step.stepName}</span>
                        <span
                          className="text-xs px-2 py-0.5 rounded font-medium"
                          style={{
                            backgroundColor: `${STEP_CONFIG[step.stepType].color}20`,
                            color: STEP_CONFIG[step.stepType].color,
                          }}
                        >
                          {getStatusLabel(step.status)}
                        </span>
                        <span className="text-xs text-incense-500">{step.durationDays} 天</span>
                      </div>
                      <div className="text-sm text-incense-500 mt-1">
                        {formatDateChinese(step.startDate)} → {formatDateChinese(step.endDate)}
                      </div>
                    </div>
                    {step.assignee && (
                      <div className="text-right">
                        <p className="text-sm text-incense-600">{step.assignee}</p>
                        <p className="text-xs text-incense-400">负责人</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {warnings.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-bold font-song text-warning-critical mb-4 pb-2 border-b border-warning-critical flex items-center gap-2">
                  <AlertTriangle size={20} />
                  预警摘要
                </h2>
                <div className="space-y-2">
                  {warnings.map((warning) => (
                    <div
                      key={warning.id}
                      className={clsx(
                        'p-3 rounded-lg border-l-4',
                        warning.level === 'critical' &&
                          'bg-red-50 border-l-red-500 text-red-700',
                        warning.level === 'warning' &&
                          'bg-amber-50 border-l-amber-500 text-amber-700',
                        warning.level === 'info' &&
                          'bg-blue-50 border-l-blue-500 text-blue-700'
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-sm">
                            {warning.level === 'critical' && '【严重】'}
                            {warning.level === 'warning' && '【警告】'}
                            {warning.level === 'info' && '【提示】'}
                            {warning.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-12 pt-6 border-t border-incense-300 text-center text-sm text-incense-400">
              <p>打印时间：{formatDateChinese(new Date().toISOString().split('T')[0])}</p>
              <p className="mt-1">香韵堂 · 传统制香工艺管理系统</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintPreviewModal;
