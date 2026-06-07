import React from 'react';
import { Clock, Package, AlertTriangle, CheckCircle } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { getUnresolvedWarnings } from '../../utils/warningUtils';

export const StatsCards: React.FC = () => {
  const { orders, warnings } = useAppStore();

  const todayTasks = orders.filter((order) => {
    return order.steps.some(
      (step) => step.status === 'in_progress'
    );
  }).length;

  const pendingOrders = orders.filter(
    (o) => o.status === 'pending' || o.status === 'in_production'
  ).length;

  const completedOrders = orders.filter((o) => o.status === 'completed').length;

  const unresolvedWarnings = getUnresolvedWarnings(warnings).length;

  const stats = [
    {
      label: '今日进行中',
      value: todayTasks,
      icon: <Clock size={24} />,
      color: 'text-incense-700',
      bgColor: 'bg-incense-100',
    },
    {
      label: '待处理订单',
      value: pendingOrders,
      icon: <Package size={24} />,
      color: 'text-sandal-500',
      bgColor: 'bg-sandal-50',
    },
    {
      label: '预警信息',
      value: unresolvedWarnings,
      icon: <AlertTriangle size={24} />,
      color: unresolvedWarnings > 0 ? 'text-warning-critical' : 'text-bamboo-500',
      bgColor: unresolvedWarnings > 0 ? 'bg-red-50' : 'bg-bamboo-50',
    },
    {
      label: '已完成订单',
      value: completedOrders,
      icon: <CheckCircle size={24} />,
      color: 'text-bamboo-500',
      bgColor: 'bg-bamboo-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {stats.map((stat, index) => (
        <div
          key={stat.label}
          className={`card-paper p-4 animate-fade-in-up stagger-${index + 1}`}
          style={{ opacity: 0 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-incense-600 mb-1">{stat.label}</p>
              <p className={`text-3xl font-bold font-song ${stat.color}`}>{stat.value}</p>
            </div>
            <div className={`p-3 rounded-lg ${stat.bgColor} ${stat.color}`}>
              {stat.icon}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
