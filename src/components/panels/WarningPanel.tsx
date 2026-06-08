import React from 'react';
import { X, AlertTriangle, Cloud, Package, Clock, CheckCircle } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { type Warning, type WarningType } from '../../types';
import { getUnresolvedWarnings, getWarningsByType } from '../../utils/warningUtils';
import { formatDateChinese } from '../../utils/dateUtils';
import { clsx } from 'clsx';

interface WarningPanelProps {
  onClose: () => void;
}

const typeConfig: Record<WarningType, { label: string; icon: React.ReactNode; color: string }> = {
  drying: { label: '晾晒周期', icon: <Cloud size={16} />, color: 'text-blue-600' },
  inventory: { label: '库存有效期', icon: <Package size={16} />, color: 'text-purple-600' },
  delivery: { label: '交付期', icon: <Clock size={16} />, color: 'text-orange-600' },
  ingredient: { label: '原料库存', icon: <Package size={16} />, color: 'text-amber-600' },
};

export const WarningPanel: React.FC<WarningPanelProps> = ({ onClose }) => {
  const { warnings, resolveWarning, setSelectedOrderId, setShowWarningPanel } = useAppStore();
  const unresolvedWarnings = getUnresolvedWarnings(warnings);

  const [activeType, setActiveType] = React.useState<WarningType | 'all'>('all');

  const filteredWarnings =
    activeType === 'all' ? unresolvedWarnings : getWarningsByType(unresolvedWarnings, activeType);

  const handleRelatedClick = (warning: Warning) => {
    if (warning.relatedType === 'order') {
      setSelectedOrderId(warning.relatedId);
      setShowWarningPanel(false);
    }
  };

  const types: (WarningType | 'all')[] = ['all', 'drying', 'delivery', 'ingredient', 'inventory'];

  return (
    <div className="fixed inset-0 z-50 flex justify-end print:hidden">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg bg-incense-50 h-full shadow-2xl flex flex-col animate-slide-up">
        <div className="flex items-center justify-between p-4 border-b border-incense-200 bg-white">
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-sandal-500" size={24} />
            <h2 className="text-xl font-bold font-song text-incense-800">预警中心</h2>
            <span className="bg-warning-critical text-white text-xs px-2 py-0.5 rounded-full">
              {unresolvedWarnings.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-incense-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex gap-1 p-3 bg-white border-b border-incense-200 overflow-x-auto">
          {types.map((type) => (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              className={clsx(
                'px-3 py-1.5 text-sm rounded-md whitespace-nowrap transition-colors',
                activeType === type
                  ? 'bg-incense-700 text-white'
                  : 'bg-incense-100 text-incense-600 hover:bg-incense-200'
              )}
            >
              {type === 'all' ? '全部' : typeConfig[type].label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
          {filteredWarnings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-incense-400">
              <CheckCircle size={48} className="mb-2" />
              <p>暂无预警信息</p>
            </div>
          ) : (
            filteredWarnings.map((warning) => (
              <div
                key={warning.id}
                className={clsx(
                  'card p-3 transition-all duration-200',
                  warning.level === 'critical' && 'border-l-4 border-l-warning-critical',
                  warning.level === 'warning' && 'border-l-4 border-l-sandal-500',
                  warning.level === 'info' && 'border-l-4 border-l-bamboo-500'
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={clsx(
                        'p-1 rounded',
                        warning.level === 'critical' && 'bg-red-100 text-warning-critical',
                        warning.level === 'warning' && 'bg-amber-100 text-sandal-500',
                        warning.level === 'info' && 'bg-blue-100 text-warning-info'
                      )}
                    >
                      {typeConfig[warning.type].icon}
                    </span>
                    <span className="text-xs text-incense-500">
                      {typeConfig[warning.type].label}
                    </span>
                  </div>
                  <span
                    className={clsx(
                      'text-xs px-2 py-0.5 rounded',
                      warning.level === 'critical' && 'bg-red-100 text-warning-critical',
                      warning.level === 'warning' && 'bg-amber-100 text-sandal-500',
                      warning.level === 'info' && 'bg-blue-100 text-warning-info'
                    )}
                  >
                    {warning.level === 'critical' ? '紧急' : warning.level === 'warning' ? '警告' : '提示'}
                  </span>
                </div>

                <p className="text-sm text-incense-700 mb-2">{warning.message}</p>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-incense-400">
                    {formatDateChinese(warning.createdAt)}
                  </span>
                  <div className="flex items-center gap-2">
                    {warning.relatedType === 'order' && (
                      <button
                        onClick={() => handleRelatedClick(warning)}
                        className="text-xs text-incense-600 hover:text-incense-800 underline"
                      >
                        查看订单
                      </button>
                    )}
                    <button
                      onClick={() => resolveWarning(warning.id)}
                      className="text-xs text-bamboo-500 hover:text-bamboo-600 font-medium"
                    >
                      标记已处理
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
