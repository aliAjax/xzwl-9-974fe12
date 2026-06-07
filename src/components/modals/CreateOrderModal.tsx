import React, { useState, useMemo } from 'react';
import { X, Plus, Calendar, User, Clock, AlertTriangle, ChevronRight } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { formatDateChinese, getToday, addDaysToDate, daysBetween, isDateBefore } from '../../utils/dateUtils';
import { Priority, Recipe, STEP_ORDER, STEP_CONFIG, StepType } from '../../types';
import { clsx } from 'clsx';

interface StepSchedulePreview {
  stepType: StepType;
  name: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  color: string;
  isOverdue: boolean;
}

const customerSuggestions = [
  '北京静心斋',
  '上海云栖茶馆',
  '杭州龙井书院',
  '成都文殊院',
  '广州普洱茶庄',
  '南京夫子庙文创',
  '苏州园林管理处',
  '西安大唐不夜城',
];

const CreateOrderModal: React.FC = () => {
  const {
    showCreateOrderModal,
    setShowCreateOrderModal,
    recipes,
    createOrder,
    getRecipeById,
  } = useAppStore();

  const [customerName, setCustomerName] = useState('');
  const [recipeId, setRecipeId] = useState('');
  const [quantity, setQuantity] = useState<number>(100);
  const [unit, setUnit] = useState('克');
  const [deliveryDate, setDeliveryDate] = useState(addDaysToDate(getToday(), 30));
  const [priority, setPriority] = useState<Priority>('medium');
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);

  const selectedRecipe = useMemo(() => {
    return recipeId ? getRecipeById(recipeId) : undefined;
  }, [recipeId, getRecipeById]);

  const estimatedProductionDays = useMemo(() => {
    if (!selectedRecipe) return 0;
    return 2 + 3 + selectedRecipe.dryingDays + selectedRecipe.cellaringDays + 2;
  }, [selectedRecipe]);

  const estimatedStartDate = useMemo(() => {
    return addDaysToDate(deliveryDate, -estimatedProductionDays);
  }, [deliveryDate, estimatedProductionDays]);

  const daysToStart = useMemo(() => {
    return daysBetween(getToday(), estimatedStartDate);
  }, [estimatedStartDate]);

  const isDeliveryDateTooEarly = daysToStart < 0;

  const stepSchedules = useMemo((): StepSchedulePreview[] => {
    if (!selectedRecipe) return [];

    const stepDurations: Record<StepType, number> = {
      kneading: 2,
      shaping: 3,
      drying: selectedRecipe.dryingDays,
      cellaring: selectedRecipe.cellaringDays,
      packaging: 2,
    };

    const today = getToday();
    let currentEndDate = deliveryDate;
    const schedules: StepSchedulePreview[] = [];

    for (let i = STEP_ORDER.length - 1; i >= 0; i--) {
      const stepType = STEP_ORDER[i];
      const duration = stepDurations[stepType];
      const startDate = addDaysToDate(currentEndDate, -duration);
      const config = STEP_CONFIG[stepType];

      schedules.unshift({
        stepType,
        name: config.name,
        startDate,
        endDate: currentEndDate,
        durationDays: duration,
        color: config.color,
        isOverdue: isDateBefore(startDate, today),
      });

      currentEndDate = startDate;
    }

    return schedules;
  }, [selectedRecipe, deliveryDate]);

  const hasOverdueSteps = stepSchedules.some((s) => s.isOverdue);

  const filteredCustomers = customerSuggestions.filter((c) =>
    c.toLowerCase().includes(customerName.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !recipeId || quantity <= 0 || !deliveryDate) return;

    createOrder({
      customerName,
      recipeId,
      quantity,
      unit,
      deliveryDate,
      priority,
    });

    setCustomerName('');
    setRecipeId('');
    setQuantity(100);
    setUnit('克');
    setDeliveryDate(addDaysToDate(getToday(), 30));
    setPriority('medium');
  };

  const priorityConfig = {
    high: { label: '高优先级', color: 'text-red-600 bg-red-50 border-red-200' },
    medium: { label: '中优先级', color: 'text-amber-600 bg-amber-50 border-amber-200' },
    low: { label: '低优先级', color: 'text-green-600 bg-green-50 border-green-200' },
  };

  if (!showCreateOrderModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm print:hidden"
        onClick={() => setShowCreateOrderModal(false)}
      />
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-incense-50 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-fade-in-up">
        <div className="flex items-center justify-between p-6 border-b border-incense-200 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-incense-700 rounded-xl flex items-center justify-center">
              <Plus size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-song text-incense-800">
                创建新订单
              </h2>
              <p className="text-sm text-incense-500">填写订单信息，生成生产计划</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateOrderModal(false)}
            className="p-2 rounded-lg hover:bg-incense-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-thin">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-incense-700">
              <User size={14} className="inline mr-1" />
              客户名称
            </label>
            <div className="relative">
              <input
                type="text"
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  setShowCustomerSuggestions(true);
                }}
                onFocus={() => setShowCustomerSuggestions(true)}
                placeholder="请输入或选择客户名称"
                className="w-full px-4 py-3 bg-white border border-incense-200 rounded-lg focus:ring-2 focus:ring-incense-500 focus:border-transparent outline-none transition-all"
                required
              />
              {showCustomerSuggestions && customerName && filteredCustomers.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-incense-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredCustomers.map((customer) => (
                    <button
                      key={customer}
                      type="button"
                      onClick={() => {
                        setCustomerName(customer);
                        setShowCustomerSuggestions(false);
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-incense-50 text-incense-700 transition-colors"
                    >
                      {customer}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-incense-700">
              <Clock size={14} className="inline mr-1" />
              选择香方
            </label>
            <div className="grid grid-cols-1 gap-3">
              {recipes.map((recipe: Recipe) => (
                <button
                  key={recipe.id}
                  type="button"
                  onClick={() => setRecipeId(recipe.id)}
                  className={clsx(
                    'p-4 rounded-lg border-2 text-left transition-all',
                    recipeId === recipe.id
                      ? 'border-incense-600 bg-incense-50'
                      : 'border-incense-200 bg-white hover:border-incense-400'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-incense-800">{recipe.name}</h4>
                      <p className="text-sm text-incense-500 mt-1">{recipe.description}</p>
                      <div className="flex gap-4 mt-2 text-xs text-incense-400">
                        <span>阴干: {recipe.dryingDays}天</span>
                        <span>窖藏: {recipe.cellaringDays}天</span>
                        <span>共 {2 + 3 + recipe.dryingDays + recipe.cellaringDays + 2} 天</span>
                      </div>
                    </div>
                    {recipeId === recipe.id && (
                      <div className="w-5 h-5 bg-incense-600 rounded-full flex items-center justify-center">
                        <X size={12} className="text-white" />
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-incense-700">
                数量
              </label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                min="1"
                className="w-full px-4 py-3 bg-white border border-incense-200 rounded-lg focus:ring-2 focus:ring-incense-500 focus:border-transparent outline-none transition-all"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-incense-700">
                单位
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-incense-200 rounded-lg focus:ring-2 focus:ring-incense-500 focus:border-transparent outline-none transition-all"
              >
                <option value="克">克</option>
                <option value="千克">千克</option>
                <option value="支">支</option>
                <option value="盒">盒</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-incense-700">
              <Calendar size={14} className="inline mr-1" />
              交付日期
            </label>
            <input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-incense-200 rounded-lg focus:ring-2 focus:ring-incense-500 focus:border-transparent outline-none transition-all"
              required
            />
            {selectedRecipe && (
              <div className={clsx(
                'text-sm flex items-center gap-1',
                isDeliveryDateTooEarly ? 'text-red-600' : 'text-incense-500'
              )}>
                {isDeliveryDateTooEarly ? (
                  <>
                    <AlertTriangle size={14} />
                    <span className="font-medium">
                      交付日期过紧！该香方生产周期约 {estimatedProductionDays} 天，预计需在 {formatDateChinese(estimatedStartDate)} 前开工（已逾期 {Math.abs(daysToStart)} 天）
                    </span>
                  </>
                ) : (
                  <>
                    <Clock size={14} />
                    <span>
                      预计开工日期: {formatDateChinese(estimatedStartDate)}，距今天还有 {daysToStart} 天，生产周期约 {estimatedProductionDays} 天
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-incense-700">
              优先级
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['low', 'medium', 'high'] as Priority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={clsx(
                    'px-4 py-3 rounded-lg border-2 font-medium transition-all',
                    priority === p
                      ? priorityConfig[p].color + ' border-current'
                      : 'border-incense-200 bg-white text-incense-500 hover:border-incense-300'
                  )}
                >
                  {priorityConfig[p].label}
                </button>
              ))}
            </div>
          </div>

          {selectedRecipe && stepSchedules.length > 0 && (
            <div className="card p-4 bg-incense-100/50">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-incense-800">预计排期预览</h4>
                <div className="text-xs text-incense-500">
                  总周期: {estimatedProductionDays}天
                </div>
              </div>

              {hasOverdueSteps && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-700">
                        排期冲突警告
                      </p>
                      <p className="text-xs text-red-600 mt-1">
                        预计开工日期（{formatDateChinese(estimatedStartDate)}）早于今日（{formatDateChinese(getToday())}），
                        需立即安排生产或调整交付日期。逾期天数: {Math.abs(daysToStart)}天
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {stepSchedules.map((step, index) => (
                  <div key={step.stepType} className="flex items-center gap-3">
                    <div
                      className={clsx(
                        'w-24 py-2 px-3 rounded-lg text-center text-white text-sm font-medium flex-shrink-0',
                        step.isOverdue && 'ring-2 ring-red-400 ring-offset-1'
                      )}
                      style={{ backgroundColor: step.color }}
                    >
                      {step.name}
                    </div>
                    <div className="flex-1 flex items-center gap-2">
                      <div className={clsx(
                        'text-sm',
                        step.isOverdue ? 'text-red-600 font-medium' : 'text-incense-700'
                      )}>
                        {formatDateChinese(step.startDate)}
                      </div>
                      <ChevronRight size={14} className="text-incense-400" />
                      <div className={clsx(
                        'text-sm',
                        step.isOverdue ? 'text-red-600 font-medium' : 'text-incense-700'
                      )}>
                        {formatDateChinese(step.endDate)}
                      </div>
                    </div>
                    <div className={clsx(
                      'text-xs px-2 py-1 rounded',
                      step.isOverdue
                        ? 'bg-red-100 text-red-600'
                        : 'bg-incense-200 text-incense-600'
                    )}>
                      {step.durationDays}天
                    </div>
                    {step.isOverdue && (
                      <span className="text-xs text-red-500 font-medium">已逾期</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-3 border-t border-incense-200 flex items-center justify-between text-xs">
                <div className="text-incense-600">
                  <span className="font-medium">开工:</span> {formatDateChinese(stepSchedules[0]?.startDate)}
                </div>
                <div className="text-incense-600">
                  <span className="font-medium">完工:</span> {formatDateChinese(stepSchedules[stepSchedules.length - 1]?.endDate)}
                </div>
              </div>
            </div>
          )}
        </form>

        <div className="p-4 border-t border-incense-200 bg-white flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setShowCreateOrderModal(false)}
            className="btn-secondary"
          >
            取消
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={!customerName || !recipeId || quantity <= 0 || !deliveryDate}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={16} className="inline mr-1" />
            创建订单
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateOrderModal;
