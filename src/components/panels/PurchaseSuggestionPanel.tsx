import React, { useState } from 'react';
import { X, ShoppingCart, AlertTriangle, TrendingDown, Package, Calendar, ChevronDown, ChevronUp, RefreshCw, Download, Copy, Check } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { formatDateChinese } from '../../utils/dateUtils';
import { clsx } from 'clsx';
import { Badge } from '../common/Badge';
import type { BadgeProps } from '../common/Badge';
import { ProgressBar } from '../common/ProgressBar';
import { PurchaseSuggestionIngredient } from '../../types';

interface PurchaseSuggestionPanelProps {
  onClose: () => void;
}

type PriorityLevel = PurchaseSuggestionIngredient['priority'];

const priorityConfig: Record<PriorityLevel, {
  label: string;
  color: BadgeProps['variant'];
  bgColor: string;
  borderColor: string;
}> = {
  critical: { label: '紧急', color: 'critical', bgColor: 'bg-red-50', borderColor: 'border-l-red-500' },
  high: { label: '高', color: 'high', bgColor: 'bg-amber-50', borderColor: 'border-l-amber-500' },
  medium: { label: '中', color: 'medium', bgColor: 'bg-amber-50', borderColor: 'border-l-amber-400' },
  low: { label: '低', color: 'low', bgColor: 'bg-bamboo-50', borderColor: 'border-l-bamboo-400' },
};

export const PurchaseSuggestionPanel: React.FC<PurchaseSuggestionPanelProps> = ({ onClose }) => {
  const { purchaseSuggestions, recalculatePurchaseSuggestions } = useAppStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    recalculatePurchaseSuggestions();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const generateExportText = (): string => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const priorityLabels = { critical: '紧急', high: '高', medium: '中', low: '低' };
    const sorted = [...purchaseSuggestions].sort((a, b) => {
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return b.gap - a.gap;
    });

    const header = [
      '原料名',
      '优先级',
      '建议采购量',
      '单位',
      '缺口',
      '安全库存',
      '最早有效期',
      '关联订单数量'
    ].join('\t');

    const rows = sorted.map((s) => [
      s.name,
      priorityLabels[s.priority],
      s.suggestedPurchase,
      s.unit,
      s.gap,
      s.safetyStock,
      formatDateChinese(s.expiryDate),
      s.relatedOrders.length
    ].join('\t'));

    return [header, ...rows].join('\n');
  };

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generateExportText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  const getExpiryStatus = (daysToExpiry: number) => {
    if (daysToExpiry <= 0) return { status: 'critical', text: '已过期' };
    if (daysToExpiry <= 7) return { status: 'critical', text: `${daysToExpiry}天后过期` };
    if (daysToExpiry <= 30) return { status: 'warning', text: `${daysToExpiry}天后过期` };
    return { status: 'success', text: `${daysToExpiry}天后过期` };
  };

  const criticalCount = purchaseSuggestions.filter((s) => s.priority === 'critical').length;
  const highCount = purchaseSuggestions.filter((s) => s.priority === 'high').length;

  const SuggestionCard: React.FC<{ suggestion: PurchaseSuggestionIngredient }> = ({ suggestion }) => {
    const isExpanded = expandedId === suggestion.ingredientId;
    const config = priorityConfig[suggestion.priority];
    const expiryInfo = getExpiryStatus(suggestion.daysToExpiry);

    return (
      <div
        className={clsx(
          'card transition-all duration-200 border-l-4 overflow-hidden',
          config.borderColor,
          config.bgColor
        )}
      >
        <div
          className="p-4 cursor-pointer hover:bg-white/50 transition-colors"
          onClick={() => setExpandedId(isExpanded ? null : suggestion.ingredientId)}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-incense-800">{suggestion.name}</h3>
                <Badge variant={config.color}>{config.label}</Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-incense-500">
                <span className="flex items-center gap-1">
                  <Package size={14} />
                  库存: {suggestion.currentStock} {suggestion.unit}
                </span>
                <span className="flex items-center gap-1">
                  <TrendingDown size={14} />
                  缺口: <span className="text-warning-critical font-medium">{suggestion.gap} {suggestion.unit}</span>
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs text-incense-500">建议采购</div>
                <div className="text-lg font-bold text-incense-800">
                  {suggestion.suggestedPurchase}
                  <span className="text-sm font-normal text-incense-500 ml-1">{suggestion.unit}</span>
                </div>
              </div>
              {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-incense-600">可用库存 / 需求</span>
              <span className="font-medium">
                {suggestion.currentStock} / {suggestion.pendingDemand} {suggestion.unit}
              </span>
            </div>
            <ProgressBar
              value={suggestion.currentStock}
              max={Math.max(suggestion.pendingDemand, suggestion.currentStock)}
              variant={suggestion.currentStock >= suggestion.pendingDemand ? 'success' : suggestion.gap > suggestion.safetyStock * 0.5 ? 'critical' : 'warning'}
            />
          </div>
        </div>

        {isExpanded && (
          <div className="border-t border-incense-100 p-4 bg-white/60 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="text-xs text-incense-500">安全库存</div>
                <div className="font-medium text-incense-800">{suggestion.safetyStock} {suggestion.unit}</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-incense-500">最早有效期</div>
                <div className={clsx(
                  'font-medium',
                  expiryInfo.status === 'critical' && 'text-warning-critical',
                  expiryInfo.status === 'warning' && 'text-sandal-500',
                  expiryInfo.status === 'success' && 'text-incense-800'
                )}>
                  {formatDateChinese(suggestion.expiryDate)}
                  <span className="text-xs ml-1">({expiryInfo.text})</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-incense-500">未完成订单需求</div>
                <div className="font-medium text-incense-800">{suggestion.pendingDemand} {suggestion.unit}</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-incense-500">总缺口</div>
                <div className="font-medium text-warning-critical">{suggestion.gap} {suggestion.unit}</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-incense-500">订单需求缺口</div>
                <div className="font-medium text-incense-700">{suggestion.demandGap} {suggestion.unit}</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-incense-500">安全库存缺口</div>
                <div className="font-medium text-sandal-600">{suggestion.safetyStockGap} {suggestion.unit}</div>
              </div>
            </div>

            {suggestion.relatedOrders.length > 0 && (
              <div>
                <div className="text-sm font-medium text-incense-700 mb-2 flex items-center gap-1">
                  <Calendar size={14} />
                  关联订单 ({suggestion.relatedOrders.length})
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {suggestion.relatedOrders.map((order) => (
                    <div
                      key={order.orderId}
                      className="flex items-center justify-between p-2 bg-white rounded-lg border border-incense-100 text-sm"
                    >
                      <div>
                        <div className="font-medium text-incense-800">{order.orderNo}</div>
                        <div className="text-xs text-incense-500">{order.customerName}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-incense-700">{order.quantity} {order.quantity > 1 ? '克' : '克'}</div>
                        <div className={clsx(
                          'text-xs',
                          order.daysToDelivery <= 15 ? 'text-warning-critical' : 'text-incense-500'
                        )}>
                          {order.daysToDelivery > 0 ? `${order.daysToDelivery}天后交货` : `已逾期${Math.abs(order.daysToDelivery)}天`}
                        </div>
                      </div>
                      <Badge variant={order.priority as BadgeProps['variant']} className="ml-2">
                        {order.priority === 'high' ? '高' : order.priority === 'medium' ? '中' : '低'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end print:hidden">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-xl bg-incense-50 h-full shadow-2xl flex flex-col animate-slide-up">
        <div className="flex items-center justify-between p-4 border-b border-incense-200 bg-white">
          <div className="flex items-center gap-2">
            <ShoppingCart className="text-sandal-600" size={24} />
            <div>
              <h2 className="text-xl font-bold font-song text-incense-800">原料采购建议</h2>
              <p className="text-xs text-incense-500">基于库存、订单和有效期智能计算</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowExportModal(true)}
              className="p-2 rounded-lg hover:bg-incense-100 transition-colors"
              title="导出采购清单"
            >
              <Download size={20} />
            </button>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-lg hover:bg-incense-100 transition-colors disabled:opacity-50"
              title="重新计算"
            >
              <RefreshCw size={20} className={clsx(isRefreshing && 'animate-spin')} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-incense-100 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-4 border-b border-incense-200 bg-white/50">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-warning-critical" />
              <span className="text-sm text-incense-600">
                需要采购: <span className="font-bold text-warning-critical">{purchaseSuggestions.length}</span> 种原料
              </span>
            </div>
            {criticalCount > 0 && (
              <Badge variant="critical">
                {criticalCount} 种紧急
              </Badge>
            )}
            {highCount > 0 && (
              <Badge variant="high">
                {highCount} 种高优先级
              </Badge>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
          {purchaseSuggestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-incense-400">
              <ShoppingCart size={48} className="mb-4 opacity-30" />
              <p className="text-lg font-medium">暂无采购需求</p>
              <p className="text-sm">当前库存充足，无需采购</p>
            </div>
          ) : (
            purchaseSuggestions.map((suggestion) => (
              <SuggestionCard key={suggestion.ingredientId} suggestion={suggestion} />
            ))
          )}
        </div>
      </div>

      {showExportModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col m-4">
            <div className="flex items-center justify-between p-6 border-b border-incense-200">
              <div>
                <h3 className="text-xl font-bold font-song text-incense-800">导出采购清单</h3>
                <p className="text-sm text-incense-500 mt-1">按优先级排序，可复制后发送给采购同事</p>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="p-2 rounded-lg hover:bg-incense-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <div className="bg-incense-50 rounded-lg p-4 font-mono text-sm">
                <pre className="whitespace-pre-wrap text-incense-700">{generateExportText()}</pre>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-incense-200">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 rounded-lg border border-incense-200 text-incense-600 hover:bg-incense-50 transition-colors"
              >
                关闭
              </button>
              <button
                onClick={handleCopyToClipboard}
                className={clsx(
                  'px-4 py-2 rounded-lg flex items-center gap-2 transition-colors',
                  copied
                    ? 'bg-green-500 text-white'
                    : 'bg-sandal-600 text-white hover:bg-sandal-700'
                )}
              >
                {copied ? (
                  <>
                    <Check size={18} />
                    已复制
                  </>
                ) : (
                  <>
                    <Copy size={18} />
                    复制到剪贴板
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
