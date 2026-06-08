import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Plus,
  Calendar,
  User,
  Clock,
  AlertTriangle,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  XCircle,
  Package,
  Users,
  Timer,
  TrendingUp,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import {
  formatDateChinese,
  getToday,
  addDaysToDate,
  daysBetween,
  isDateBefore,
} from '../../utils/dateUtils';
import {
  type Priority,
  type Recipe,
  STEP_ORDER,
  STEP_CONFIG,
  type StepType,
  type FeasibilityCheckResult,
  type FeasibilityIssue,
} from '../../types';
import { checkDeliveryFeasibility, getFeasibilityStatusColor, getFeasibilityStatusLabel } from '../../utils/feasibilityUtils';
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
    ingredients,
    craftsmen,
    orders,
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
  const [riskConfirmed, setRiskConfirmed] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['timeline', 'workload', 'ingredient', 'expiry']));

  const selectedRecipe = useMemo(() => {
    return recipeId ? getRecipeById(recipeId) : undefined;
  }, [recipeId, getRecipeById]);

  const feasibilityCheck = useMemo((): FeasibilityCheckResult | null => {
    if (!selectedRecipe || quantity <= 0 || !deliveryDate) return null;

    return checkDeliveryFeasibility(
      {
        customerName: customerName || '临时客户',
        recipeId,
        quantity,
        unit,
        deliveryDate,
        priority,
      },
      recipes,
      ingredients,
      craftsmen,
      orders
    );
  }, [selectedRecipe, recipeId, quantity, unit, deliveryDate, priority, customerName, recipes, ingredients, craftsmen, orders]);

  useEffect(() => {
    if (feasibilityCheck && feasibilityCheck.status === 'feasible') {
      setRiskConfirmed(true);
    } else {
      setRiskConfirmed(false);
    }
  }, [feasibilityCheck]);

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

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const getIssuesByCategory = (category: string): FeasibilityIssue[] => {
    if (!feasibilityCheck) return [];
    return feasibilityCheck.issues.filter((i) => i.category === category);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'timeline':
        return <Timer size={16} />;
      case 'workload':
        return <Users size={16} />;
      case 'ingredient':
        return <Package size={16} />;
      case 'expiry':
        return <TrendingUp size={16} />;
      default:
        return <Info size={16} />;
    }
  };

  const getCategoryLabel = (category: string): string => {
    switch (category) {
      case 'timeline':
        return '工期排期';
      case 'workload':
        return '工匠负载';
      case 'ingredient':
        return '原料库存';
      case 'expiry':
        return '有效期风险';
      default:
        return category;
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'critical':
        return <XCircle size={16} className="text-red-500" />;
      case 'warning':
        return <AlertTriangle size={16} className="text-amber-500" />;
      case 'info':
        return <Info size={16} className="text-blue-500" />;
      default:
        return <CheckCircle size={16} className="text-green-500" />;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !recipeId || quantity <= 0 || !deliveryDate) return;
    if (feasibilityCheck && feasibilityCheck.status !== 'feasible' && !riskConfirmed) return;

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
    setRiskConfirmed(false);
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
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-incense-50 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-fade-in-up">
        <div className="flex items-center justify-between p-6 border-b border-incense-200 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-incense-700 rounded-xl flex items-center justify-center">
              <Plus size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-song text-incense-800">
                创建新订单
              </h2>
              <p className="text-sm text-incense-500">填写订单信息，系统将自动检查交期可行性</p>
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

          {feasibilityCheck && selectedRecipe && (
            <div className="card p-4 bg-white border-2" style={{ borderColor: getFeasibilityStatusColor(feasibilityCheck.status) }}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: getFeasibilityStatusColor(feasibilityCheck.status) + '20' }}
                  >
                    {feasibilityCheck.status === 'feasible' ? (
                      <CheckCircle size={20} style={{ color: getFeasibilityStatusColor(feasibilityCheck.status) }} />
                    ) : feasibilityCheck.status === 'risky' ? (
                      <AlertCircle size={20} style={{ color: getFeasibilityStatusColor(feasibilityCheck.status) }} />
                    ) : (
                      <XCircle size={20} style={{ color: getFeasibilityStatusColor(feasibilityCheck.status) }} />
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-incense-800">交期可承诺检查</h4>
                    <p className="text-sm" style={{ color: getFeasibilityStatusColor(feasibilityCheck.status) }}>
                      {getFeasibilityStatusLabel(feasibilityCheck.status)} · 综合评分 {feasibilityCheck.overallScore} 分
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold" style={{ color: getFeasibilityStatusColor(feasibilityCheck.status) }}>
                    {feasibilityCheck.overallScore}
                  </div>
                  <div className="text-xs text-incense-400">/ 100</div>
                </div>
              </div>

              <p className="text-sm text-incense-600 mb-4 p-3 bg-incense-50 rounded-lg">
                {feasibilityCheck.summary}
              </p>

              {feasibilityCheck.issues.length > 0 && (
                <div className="space-y-3">
                  {['timeline', 'workload', 'ingredient', 'expiry'].map((category) => {
                    const issues = getIssuesByCategory(category);
                    if (issues.length === 0) return null;

                    const isExpanded = expandedCategories.has(category);
                    const maxLevel = issues.reduce((max, i) => {
                      if (i.level === 'critical') return 'critical';
                      if (i.level === 'warning' && max !== 'critical') return 'warning';
                      return max || i.level;
                    }, '' as string);

                    return (
                      <div key={category} className="border border-incense-200 rounded-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={() => toggleCategory(category)}
                          className="w-full flex items-center justify-between p-3 bg-incense-50 hover:bg-incense-100 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            {getCategoryIcon(category)}
                            <span className="font-medium text-incense-700">{getCategoryLabel(category)}</span>
                            <span className={clsx(
                              'text-xs px-2 py-0.5 rounded-full',
                              maxLevel === 'critical' ? 'bg-red-100 text-red-600' :
                              maxLevel === 'warning' ? 'bg-amber-100 text-amber-600' :
                              'bg-blue-100 text-blue-600'
                            )}>
                              {issues.length} 项
                            </span>
                          </div>
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        {isExpanded && (
                          <div className="p-3 space-y-2">
                            {issues.map((issue) => (
                              <div key={issue.id} className="flex items-start gap-2 text-sm">
                                {getLevelIcon(issue.level)}
                                <div className="flex-1">
                                  <p className={clsx(
                                    'font-medium',
                                    issue.level === 'critical' ? 'text-red-700' :
                                    issue.level === 'warning' ? 'text-amber-700' :
                                    'text-blue-700'
                                  )}>
                                    {issue.message}
                                  </p>
                                  {issue.detail && (
                                    <p className="text-xs text-incense-500 mt-1">{issue.detail}</p>
                                  )}
                                  {issue.suggestion && (
                                    <p className="text-xs text-incense-400 mt-1 flex items-center gap-1">
                                      <Info size={12} />
                                      建议：{issue.suggestion}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {feasibilityCheck.ingredients.details.length > 0 && (
                <div className="mt-4">
                  <h5 className="text-sm font-medium text-incense-700 mb-2">原料需求明细</h5>
                  <div className="grid grid-cols-2 gap-2">
                    {feasibilityCheck.ingredients.details.map((detail) => (
                      <div
                        key={detail.ingredientId}
                        className={clsx(
                          'p-2 rounded-lg text-xs',
                          detail.gap > 0 ? 'bg-red-50 border border-red-200' :
                          detail.hasExpiryRisk ? 'bg-amber-50 border border-amber-200' :
                          'bg-green-50 border border-green-200'
                        )}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-incense-700">{detail.ingredientName}</span>
                          {detail.gap > 0 ? (
                            <span className="text-red-600">缺口 {detail.gap}{detail.unit}</span>
                          ) : detail.hasExpiryRisk ? (
                            <span className="text-amber-600">临期 {detail.daysToExpiry}天</span>
                          ) : (
                            <span className="text-green-600">充足</span>
                          )}
                        </div>
                        <div className="text-incense-500 mt-1">
                          需 {detail.required}{detail.unit} / 库存 {detail.available}{detail.unit}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {feasibilityCheck.status !== 'feasible' && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={riskConfirmed}
                      onChange={(e) => setRiskConfirmed(e.target.checked)}
                      className="mt-0.5 w-4 h-4 text-amber-600 border-amber-300 rounded focus:ring-amber-500"
                    />
                    <span className="text-sm text-amber-800">
                      我已了解上述风险，确认仍然创建此订单。我理解这可能导致交付延误、成本增加或其他问题。
                    </span>
                  </label>
                </div>
              )}
            </div>
          )}

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
                {stepSchedules.map((step) => (
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
            disabled={!customerName || !recipeId || quantity <= 0 || !deliveryDate || (feasibilityCheck && feasibilityCheck.status !== 'feasible' && !riskConfirmed) || false}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={16} className="inline mr-1" />
            {feasibilityCheck && feasibilityCheck.status !== 'feasible' ? '确认风险并创建' : '创建订单'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateOrderModal;
