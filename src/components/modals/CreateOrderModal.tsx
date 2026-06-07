import React, { useState, useMemo } from 'react';
import { X, Plus, Calendar, User, Clock, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { formatDateChinese, getToday, addDaysToDate, daysBetween } from '../../utils/dateUtils';
import { Priority, Recipe, STEP_ORDER, STEP_CONFIG } from '../../types';
import { clsx } from 'clsx';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
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
              min={getToday()}
              className="w-full px-4 py-3 bg-white border border-incense-200 rounded-lg focus:ring-2 focus:ring-incense-500 focus:border-transparent outline-none transition-all"
              required
            />
            {selectedRecipe && (
              <div className={clsx(
                'text-sm flex items-center gap-1',
                isDeliveryDateTooEarly ? 'text-red-500' : 'text-incense-500'
              )}>
                {isDeliveryDateTooEarly ? (
                  <>
                    <AlertTriangle size={14} />
                    <span>
                      交付日期过紧！该香方生产周期约 {estimatedProductionDays} 天，需在 {formatDateChinese(estimatedStartDate)} 前开工
                    </span>
                  </>
                ) : (
                  <>
                    <Clock size={14} />
                    <span>
                      预计开工日期: {formatDateChinese(estimatedStartDate)}，生产周期约 {estimatedProductionDays} 天
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

          {selectedRecipe && (
            <div className="card p-4 bg-incense-100/50">
              <h4 className="font-semibold text-incense-800 mb-3">生产步骤预览</h4>
              <div className="flex items-center gap-1 text-xs">
                {STEP_ORDER.map((stepType, index) => {
                  const config = STEP_CONFIG[stepType];
                  const duration = stepType === 'drying'
                    ? selectedRecipe.dryingDays
                    : stepType === 'cellaring'
                      ? selectedRecipe.cellaringDays
                      : stepType === 'kneading' || stepType === 'packaging'
                        ? 2
                        : 3;
                  return (
                    <React.Fragment key={stepType}>
                      <div
                        className="flex-1 px-2 py-2 rounded text-center text-white"
                        style={{ backgroundColor: config.color }}
                      >
                        <div>{config.name}</div>
                        <div className="text-white/80">{duration}天</div>
                      </div>
                      {index < STEP_ORDER.length - 1 && (
                        <div className="text-incense-400">→</div>
                      )}
                    </React.Fragment>
                  );
                })}
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
