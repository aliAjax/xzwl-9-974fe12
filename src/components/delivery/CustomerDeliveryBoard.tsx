import React, { useMemo } from 'react';
import {
  Users,
  Filter,
  ArrowUpDown,
  Eye,
  EyeOff,
  AlertTriangle,
  TrendingUp,
  Package,
  Clock,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAppStore } from '../../store/useAppStore';
import { RiskLevel } from '../../types';
import { CustomerCard } from './CustomerCard';

const sortOptions = [
  { value: 'deliveryDate', label: '按交付日期', icon: Clock },
  { value: 'riskLevel', label: '按风险等级', icon: AlertTriangle },
  { value: 'priority', label: '按优先级', icon: TrendingUp },
  { value: 'progress', label: '按进度', icon: Package },
];

const riskFilterOptions = [
  { value: 'all', label: '全部风险' },
  { value: 'critical', label: '极高风险' },
  { value: 'high', label: '高风险' },
  { value: 'medium', label: '中风险' },
  { value: 'low', label: '低风险' },
];

const riskLevelOrder: Record<RiskLevel, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const priorityOrder = {
  high: 0,
  medium: 1,
  low: 2,
};

export const CustomerDeliveryBoard: React.FC = () => {
  const {
    getCustomerOrderSummaries,
    deliveryBoard,
    setShowCompletedOrders,
    setSortBy,
    setFilterRiskLevel,
    toggleCustomerExpand,
  } = useAppStore();

  const { showCompletedOrders, sortBy, filterRiskLevel, expandedCustomers } = deliveryBoard;

  const summaries = useMemo(() => {
    let result = getCustomerOrderSummaries();

    if (filterRiskLevel !== 'all') {
      result = result.filter((s) => s.riskLevel === filterRiskLevel);
    }

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'deliveryDate':
          if (!a.earliestDeliveryDate) return 1;
          if (!b.earliestDeliveryDate) return -1;
          return a.earliestDeliveryDate.localeCompare(b.earliestDeliveryDate);
        case 'riskLevel':
          return riskLevelOrder[a.riskLevel] - riskLevelOrder[b.riskLevel];
        case 'priority': {
          const aMaxPriority = a.orders.reduce(
            (max, o) => Math.min(max, priorityOrder[o.priority]),
            3
          );
          const bMaxPriority = b.orders.reduce(
            (max, o) => Math.min(max, priorityOrder[o.priority]),
            3
          );
          return aMaxPriority - bMaxPriority;
        }
        case 'progress':
          return a.overallProgress - b.overallProgress;
        default:
          return 0;
      }
    });

    return result;
  }, [getCustomerOrderSummaries, sortBy, filterRiskLevel]);

  const stats = useMemo(() => {
    const total = summaries.length;
    const withRisk = summaries.filter((s) => s.riskLevel !== 'low').length;
    const withOverdue = summaries.filter((s) => s.overdueOrders > 0).length;
    const totalOrders = summaries.reduce((sum, s) => sum + s.totalOrders, 0);
    const totalPending = summaries.reduce((sum, s) => sum + s.pendingOrders, 0);
    const totalInProduction = summaries.reduce((sum, s) => sum + s.inProductionOrders, 0);
    const totalCompleted = summaries.reduce((sum, s) => sum + s.completedOrders, 0);
    const totalOverdue = summaries.reduce((sum, s) => sum + s.overdueOrders, 0);

    return {
      totalCustomers: total,
      customersWithRisk: withRisk,
      customersWithOverdue: withOverdue,
      totalOrders,
      totalPending,
      totalInProduction,
      totalCompleted,
      totalOverdue,
    };
  }, [summaries]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-incense-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-incense-500">客户总数</p>
              <p className="text-3xl font-bold text-incense-800 mt-1">{stats.totalCustomers}</p>
            </div>
            <div className="w-12 h-12 bg-incense-100 rounded-full flex items-center justify-center">
              <Users size={24} className="text-incense-600" />
            </div>
          </div>
          {stats.customersWithRisk > 0 && (
            <p className="text-xs text-amber-600 mt-2">
              {stats.customersWithRisk} 个客户存在风险
            </p>
          )}
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-incense-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-incense-500">订单总数</p>
              <p className="text-3xl font-bold text-incense-800 mt-1">{stats.totalOrders}</p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
              <Package size={24} className="text-amber-600" />
            </div>
          </div>
          <p className="text-xs text-incense-500 mt-2">
            生产中 {stats.totalInProduction}，待生产 {stats.totalPending}
          </p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-incense-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-incense-500">已完成订单</p>
              <p className="text-3xl font-bold text-bamboo-600 mt-1">{stats.totalCompleted}</p>
            </div>
            <div className="w-12 h-12 bg-bamboo-100 rounded-full flex items-center justify-center">
              <Package size={24} className="text-bamboo-600" />
            </div>
          </div>
          <p className="text-xs text-incense-500 mt-2">
            完成率 {stats.totalOrders > 0 ? Math.round((stats.totalCompleted / stats.totalOrders) * 100) : 0}%
          </p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-incense-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-incense-500">逾期订单</p>
              <p className="text-3xl font-bold text-red-600 mt-1">{stats.totalOverdue}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle size={24} className="text-red-600" />
            </div>
          </div>
          {stats.customersWithOverdue > 0 && (
            <p className="text-xs text-red-600 mt-2">
              涉及 {stats.customersWithOverdue} 个客户
            </p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-incense-100 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-incense-400" />
              <span className="text-sm text-incense-600">风险筛选：</span>
              <div className="flex items-center gap-1">
                {riskFilterOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setFilterRiskLevel(option.value as RiskLevel | 'all')}
                    className={clsx(
                      'px-3 py-1 text-sm rounded-lg transition-colors',
                      filterRiskLevel === option.value
                        ? 'bg-incense-700 text-white'
                        : 'text-incense-600 hover:bg-incense-100'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <ArrowUpDown size={16} className="text-incense-400" />
              <span className="text-sm text-incense-600">排序：</span>
              <div className="flex items-center gap-1">
                {sortOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSortBy(option.value as typeof sortBy)}
                    className={clsx(
                      'flex items-center gap-1 px-3 py-1 text-sm rounded-lg transition-colors',
                      sortBy === option.value
                        ? 'bg-incense-700 text-white'
                        : 'text-incense-600 hover:bg-incense-100'
                    )}
                  >
                    <option.icon size={14} />
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setShowCompletedOrders(!showCompletedOrders)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors border',
                showCompletedOrders
                  ? 'bg-incense-700 text-white border-incense-700'
                  : 'bg-white text-incense-600 border-incense-200 hover:bg-incense-50'
              )}
            >
              {showCompletedOrders ? <Eye size={16} /> : <EyeOff size={16} />}
              {showCompletedOrders ? '显示已完成' : '隐藏已完成'}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {summaries.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-incense-100">
            <Users size={48} className="mx-auto text-incense-300 mb-4" />
            <h3 className="text-lg font-medium text-incense-600 mb-2">暂无客户数据</h3>
            <p className="text-sm text-incense-400">
              {filterRiskLevel !== 'all'
                ? '当前筛选条件下没有客户数据，请调整筛选条件'
                : '还没有订单数据，创建第一个订单开始吧'}
            </p>
          </div>
        ) : (
          summaries.map((summary) => (
            <CustomerCard
              key={summary.customerName}
              summary={summary}
              isExpanded={expandedCustomers.includes(summary.customerName)}
              onToggle={() => toggleCustomerExpand(summary.customerName)}
            />
          ))
        )}
      </div>
    </div>
  );
};
