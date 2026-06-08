import React, { useState } from 'react';
import {
  X,
  ShoppingCart,
  AlertTriangle,
  TrendingDown,
  Package,
  Calendar,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Download,
  Copy,
  Check,
  Building2,
  List,
  CheckCircle2,
  Clock,
  Ban,
  RotateCcw,
  Edit3,
  Save,
  Trash2,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { formatDateChinese } from '../../utils/dateUtils';
import { clsx } from 'clsx';
import { Badge } from '../common/Badge';
import type { BadgeProps } from '../common/Badge';
import { ProgressBar } from '../common/ProgressBar';
import type {
  PurchasePlanItem,
  SupplierPurchaseGroup,
  PurchaseStatus,
} from '../../types';

interface PurchaseSuggestionPanelProps {
  onClose: () => void;
}

type ViewMode = 'byIngredient' | 'bySupplier';

type PriorityLevel = PurchasePlanItem['priority'];

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

const statusConfig: Record<PurchaseStatus, {
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}> = {
  pending: { label: '待确认', icon: <Clock size={14} />, color: 'text-sandal-600', bgColor: 'bg-sandal-50' },
  ordered: { label: '已下单', icon: <CheckCircle2 size={14} />, color: 'text-green-600', bgColor: 'bg-green-50' },
  skip: { label: '暂不采购', icon: <Ban size={14} />, color: 'text-incense-400', bgColor: 'bg-incense-50' },
};

export const PurchaseSuggestionPanel: React.FC<PurchaseSuggestionPanelProps> = ({ onClose }) => {
  const {
    purchasePlanItems,
    supplierPurchaseGroups,
    recalculatePurchaseSuggestions,
    updatePurchaseQuantity,
    updatePurchaseStatus,
    updatePurchaseNotes,
    clearPurchaseDecision,
    clearAllPurchaseDecisions,
  } = useAppStore();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('byIngredient');
  const [editingQuantityId, setEditingQuantityId] = useState<string | null>(null);
  const [editingQuantity, setEditingQuantity] = useState<string>('');
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string>('');

  const handleRefresh = () => {
    setIsRefreshing(true);
    recalculatePurchaseSuggestions();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleQuantityEdit = (item: PurchasePlanItem) => {
    setEditingQuantityId(item.ingredientId);
    setEditingQuantity(item.adjustedQuantity?.toString() || item.suggestedPurchase.toString());
  };

  const handleQuantitySave = (ingredientId: string) => {
    const num = parseFloat(editingQuantity);
    if (!isNaN(num) && num >= 0) {
      updatePurchaseQuantity(ingredientId, num);
    }
    setEditingQuantityId(null);
    setEditingQuantity('');
  };

  const handleQuantityReset = (ingredientId: string) => {
    updatePurchaseQuantity(ingredientId, null);
  };

  const handleNotesEdit = (item: PurchasePlanItem) => {
    setEditingNotesId(item.ingredientId);
    setEditingNotes(item.notes || '');
  };

  const handleNotesSave = (ingredientId: string) => {
    updatePurchaseNotes(ingredientId, editingNotes);
    setEditingNotesId(null);
    setEditingNotes('');
  };

  const generateExportText = (): string => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const priorityLabels = { critical: '紧急', high: '高', medium: '中', low: '低' };
    const statusLabels = { pending: '待确认', ordered: '已下单', skip: '暂不采购' };

    if (viewMode === 'bySupplier') {
      const rows: string[] = [];
      supplierPurchaseGroups.forEach((group) => {
        rows.push(`【${group.supplier}】`);
        rows.push(['原料名', '优先级', '采购量', '单位', '单价', '预估金额', '状态', '关联订单数'].join('\t'));
        group.items.forEach((item) => {
          rows.push([
            item.name,
            priorityLabels[item.priority],
            item.finalQuantity,
            item.unit,
            item.unitPrice.toFixed(2),
            (item.finalQuantity * item.unitPrice).toFixed(2),
            statusLabels[item.status],
            item.relatedOrders.length,
          ].join('\t'));
        });
        rows.push(`小计：${group.totalQuantity} 单位，预估金额 ¥${group.totalEstimatedCost.toFixed(2)}`);
        rows.push('');
      });
      const totalCost = supplierPurchaseGroups.reduce((sum, g) => sum + g.totalEstimatedCost, 0);
      rows.push(`总计预估金额：¥${totalCost.toFixed(2)}`);
      return rows.join('\n');
    }

    const sorted = [...purchasePlanItems].sort((a, b) => {
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return b.gap - a.gap;
    });

    const header = [
      '原料名',
      '供应商',
      '优先级',
      '建议采购',
      '调整采购',
      '最终采购',
      '单位',
      '单价',
      '预估金额',
      '缺口',
      '状态',
      '最早有效期',
      '关联订单数量',
    ].join('\t');

    const rows = sorted.map((s) => [
      s.name,
      s.supplier,
      priorityLabels[s.priority],
      s.suggestedPurchase,
      s.adjustedQuantity ?? '-',
      s.finalQuantity,
      s.unit,
      s.unitPrice.toFixed(2),
      (s.finalQuantity * s.unitPrice).toFixed(2),
      s.gap,
      statusLabels[s.status],
      formatDateChinese(s.expiryDate),
      s.relatedOrders.length,
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

  const criticalCount = purchasePlanItems.filter((s) => s.priority === 'critical').length;
  const highCount = purchasePlanItems.filter((s) => s.priority === 'high').length;
  const orderedCount = purchasePlanItems.filter((s) => s.status === 'ordered').length;
  const skipCount = purchasePlanItems.filter((s) => s.status === 'skip').length;
  const pendingCount = purchasePlanItems.filter((s) => s.status === 'pending').length;

  const StatusButton: React.FC<{
    status: PurchaseStatus;
    current: PurchaseStatus;
    onClick: () => void;
  }> = ({ status, current, onClick }) => {
    const config = statusConfig[status];
    const isActive = current === status;
    return (
      <button
        onClick={onClick}
        className={clsx(
          'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all',
          isActive
            ? `${config.bgColor} ${config.color} ring-2 ring-offset-1 ring-current/30`
            : 'hover:bg-incense-100 text-incense-500'
        )}
        title={config.label}
      >
        {config.icon}
        <span className="hidden sm:inline">{config.label}</span>
      </button>
    );
  };

  const IngredientCard: React.FC<{ item: PurchasePlanItem }> = ({ item }) => {
    const isExpanded = expandedId === item.ingredientId;
    const config = priorityConfig[item.priority];
    const expiryInfo = getExpiryStatus(item.daysToExpiry);
    const statusInfo = statusConfig[item.status];
    const isEditingQuantity = editingQuantityId === item.ingredientId;
    const isEditingNotes = editingNotesId === item.ingredientId;
    const hasAdjustment = item.adjustedQuantity !== null;

    return (
      <div
        className={clsx(
          'card transition-all duration-200 border-l-4 overflow-hidden',
          config.borderColor,
          config.bgColor,
          item.status === 'skip' && 'opacity-60'
        )}
      >
        <div
          className="p-4 cursor-pointer hover:bg-white/50 transition-colors"
          onClick={() => setExpandedId(isExpanded ? null : item.ingredientId)}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className="font-semibold text-incense-800">{item.name}</h3>
                <Badge variant={config.color}>{config.label}</Badge>
                <span className={clsx('flex items-center gap-1 text-xs px-2 py-0.5 rounded', statusInfo.bgColor, statusInfo.color)}>
                  {statusInfo.icon}
                  {statusInfo.label}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-incense-500 flex-wrap">
                <span className="flex items-center gap-1">
                  <Building2 size={12} />
                  {item.supplier}
                </span>
                <span className="flex items-center gap-1">
                  <Package size={12} />
                  库存: {item.currentStock} {item.unit}
                </span>
                <span className="flex items-center gap-1">
                  <TrendingDown size={12} />
                  缺口: <span className="text-warning-critical font-medium">{item.gap} {item.unit}</span>
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs text-incense-500">采购量</div>
                {isEditingQuantity ? (
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="number"
                      value={editingQuantity}
                      onChange={(e) => setEditingQuantity(e.target.value)}
                      className="w-20 px-2 py-1 text-right border border-incense-200 rounded text-lg font-bold focus:outline-none focus:ring-2 focus:ring-sandal-500"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleQuantitySave(item.ingredientId);
                        if (e.key === 'Escape') setEditingQuantityId(null);
                      }}
                    />
                    <button
                      onClick={() => handleQuantitySave(item.ingredientId)}
                      className="p-1 text-green-600 hover:bg-green-50 rounded"
                    >
                      <Save size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <span
                      className={clsx(
                        'text-lg font-bold',
                        hasAdjustment ? 'text-sandal-600' : 'text-incense-800'
                      )}
                    >
                      {item.finalQuantity}
                    </span>
                    <span className="text-sm font-normal text-incense-500 ml-1">{item.unit}</span>
                    {hasAdjustment && (
                      <span className="text-xs text-incense-400 line-through ml-1">
                        建议 {item.suggestedPurchase}
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleQuantityEdit(item);
                      }}
                      className="p-1 text-incense-400 hover:text-sandal-600 hover:bg-incense-100 rounded transition-colors"
                      title="调整采购量"
                    >
                      <Edit3 size={14} />
                    </button>
                  </div>
                )}
              </div>
              {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-incense-600">可用库存 / 需求</span>
              <span className="font-medium">
                {item.currentStock} / {item.pendingDemand} {item.unit}
              </span>
            </div>
            <ProgressBar
              value={item.currentStock}
              max={Math.max(item.pendingDemand, item.currentStock)}
              variant={item.currentStock >= item.pendingDemand ? 'success' : item.gap > item.safetyStock * 0.5 ? 'critical' : 'warning'}
            />
          </div>
        </div>

        {isExpanded && (
          <div className="border-t border-incense-100 p-4 bg-white/60 space-y-4">
            <div className="flex items-center gap-2 justify-end flex-wrap">
              <StatusButton
                status="pending"
                current={item.status}
                onClick={() => updatePurchaseStatus(item.ingredientId, 'pending')}
              />
              <StatusButton
                status="ordered"
                current={item.status}
                onClick={() => updatePurchaseStatus(item.ingredientId, 'ordered')}
              />
              <StatusButton
                status="skip"
                current={item.status}
                onClick={() => updatePurchaseStatus(item.ingredientId, 'skip')}
              />
              <div className="w-px h-5 bg-incense-200 mx-1" />
              {hasAdjustment && (
                <button
                  onClick={() => handleQuantityReset(item.ingredientId)}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs text-incense-500 hover:bg-incense-100 transition-colors"
                  title="重置为建议值"
                >
                  <RotateCcw size={14} />
                  <span className="hidden sm:inline">重置</span>
                </button>
              )}
              <button
                onClick={() => clearPurchaseDecision(item.ingredientId)}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs text-warning-critical hover:bg-red-50 transition-colors"
                title="清除决策"
              >
                <Trash2 size={14} />
                <span className="hidden sm:inline">清除</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="text-xs text-incense-500">建议采购量</div>
                <div className="font-medium text-incense-800">{item.suggestedPurchase} {item.unit}</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-incense-500">安全库存</div>
                <div className="font-medium text-incense-800">{item.safetyStock} {item.unit}</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-incense-500">最早有效期</div>
                <div className={clsx(
                  'font-medium',
                  expiryInfo.status === 'critical' && 'text-warning-critical',
                  expiryInfo.status === 'warning' && 'text-sandal-500',
                  expiryInfo.status === 'success' && 'text-incense-800'
                )}>
                  {formatDateChinese(item.expiryDate)}
                  <span className="text-xs ml-1">({expiryInfo.text})</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-incense-500">单价</div>
                <div className="font-medium text-incense-800">¥{item.unitPrice.toFixed(2)} / {item.unit}</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-incense-500">未完成订单需求</div>
                <div className="font-medium text-incense-800">{item.pendingDemand} {item.unit}</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-incense-500">预估金额</div>
                <div className="font-medium text-sandal-600">¥{(item.finalQuantity * item.unitPrice).toFixed(2)}</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-incense-500">订单需求缺口</div>
                <div className="font-medium text-incense-700">{item.demandGap} {item.unit}</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-incense-500">安全库存缺口</div>
                <div className="font-medium text-sandal-600">{item.safetyStockGap} {item.unit}</div>
              </div>
            </div>

            <div>
              <div className="text-xs text-incense-500 mb-1">备注</div>
              {isEditingNotes ? (
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    value={editingNotes}
                    onChange={(e) => setEditingNotes(e.target.value)}
                    placeholder="添加采购备注..."
                    className="flex-1 px-3 py-2 border border-incense-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sandal-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleNotesSave(item.ingredientId);
                      if (e.key === 'Escape') setEditingNotesId(null);
                    }}
                  />
                  <button
                    onClick={() => handleNotesSave(item.ingredientId)}
                    className="px-3 py-2 bg-sandal-600 text-white rounded-lg text-sm hover:bg-sandal-700"
                  >
                    保存
                  </button>
                </div>
              ) : (
                <div
                  className={clsx(
                    'px-3 py-2 rounded-lg text-sm min-h-[40px]',
                    item.notes ? 'bg-incense-50 text-incense-700' : 'bg-incense-50/50 text-incense-400 italic'
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNotesEdit(item);
                  }}
                >
                  {item.notes || '点击添加备注...'}
                </div>
              )}
            </div>

            {item.relatedOrders.length > 0 && (
              <div>
                <div className="text-sm font-medium text-incense-700 mb-2 flex items-center gap-1">
                  <Calendar size={14} />
                  关联订单 ({item.relatedOrders.length})
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {item.relatedOrders.map((order) => (
                    <div
                      key={order.orderId}
                      className="flex items-center justify-between p-2 bg-white rounded-lg border border-incense-100 text-sm"
                    >
                      <div>
                        <div className="font-medium text-incense-800">{order.orderNo}</div>
                        <div className="text-xs text-incense-500">{order.customerName}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-incense-700">{order.quantity} 克</div>
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

  const SupplierCard: React.FC<{ group: SupplierPurchaseGroup }> = ({ group }) => {
    const isExpanded = expandedSupplier === group.supplier;
    const config = priorityConfig[group.priority];

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
          onClick={() => setExpandedSupplier(isExpanded ? null : group.supplier)}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Building2 size={18} className="text-sandal-600" />
                <h3 className="font-semibold text-incense-800">{group.supplier}</h3>
                <Badge variant={config.color}>{config.label}</Badge>
                <Badge variant="info">{group.items.length} 种原料</Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-incense-500">
                <span>采购总量: <span className="font-medium text-incense-700">{group.totalQuantity}</span> 单位</span>
                <span>预估金额: <span className="font-medium text-sandal-600">¥{group.totalEstimatedCost.toFixed(2)}</span></span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="border-t border-incense-100 bg-white/60">
            <div className="divide-y divide-incense-100">
              {group.items.map((item) => (
                <IngredientCard key={item.ingredientId} item={item} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const totalEstimatedCost = purchasePlanItems
    .filter((i) => i.status !== 'skip')
    .reduce((sum, i) => sum + i.finalQuantity * i.unitPrice, 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end print:hidden">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-2xl bg-incense-50 h-full shadow-2xl flex flex-col animate-slide-up">
        <div className="flex items-center justify-between p-4 border-b border-incense-200 bg-white">
          <div className="flex items-center gap-2">
            <ShoppingCart className="text-sandal-600" size={24} />
            <div>
              <h2 className="text-xl font-bold font-song text-incense-800">原料采购计划</h2>
              <p className="text-xs text-incense-500">基于库存、订单和有效期智能计算，支持手动调整</p>
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

        <div className="p-4 border-b border-incense-200 bg-white/50 space-y-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-warning-critical" />
              <span className="text-sm text-incense-600">
                需要采购: <span className="font-bold text-warning-critical">{purchasePlanItems.length}</span> 种原料
              </span>
            </div>
            {criticalCount > 0 && (
              <Badge variant="critical">{criticalCount} 种紧急</Badge>
            )}
            {highCount > 0 && (
              <Badge variant="high">{highCount} 种高优先级</Badge>
            )}
            {orderedCount > 0 && (
              <Badge variant="success">{orderedCount} 种已下单</Badge>
            )}
            {skipCount > 0 && (
              <Badge variant="info">{skipCount} 种暂不采购</Badge>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 bg-incense-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('byIngredient')}
                className={clsx(
                  'flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  viewMode === 'byIngredient'
                    ? 'bg-white text-incense-800 shadow-sm'
                    : 'text-incense-500 hover:text-incense-700'
                )}
              >
                <List size={16} />
                按原料
              </button>
              <button
                onClick={() => setViewMode('bySupplier')}
                className={clsx(
                  'flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  viewMode === 'bySupplier'
                    ? 'bg-white text-incense-800 shadow-sm'
                    : 'text-incense-500 hover:text-incense-700'
                )}
              >
                <Building2 size={16} />
                按供应商
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-incense-500">
                预估总金额: <span className="font-bold text-sandal-600">¥{totalEstimatedCost.toFixed(2)}</span>
              </span>
              <button
                onClick={clearAllPurchaseDecisions}
                className="px-3 py-1.5 text-xs text-incense-500 hover:bg-incense-100 rounded-lg transition-colors"
                title="清除所有采购决策"
              >
                重置全部
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
          {purchasePlanItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-incense-400">
              <ShoppingCart size={48} className="mb-4 opacity-30" />
              <p className="text-lg font-medium">暂无采购需求</p>
              <p className="text-sm">当前库存充足，无需采购</p>
            </div>
          ) : viewMode === 'byIngredient' ? (
            purchasePlanItems.map((item) => (
              <IngredientCard key={item.ingredientId} item={item} />
            ))
          ) : supplierPurchaseGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-incense-400">
              <Ban size={48} className="mb-4 opacity-30" />
              <p className="text-lg font-medium">没有待采购的项</p>
              <p className="text-sm">所有原料已标记为暂不采购</p>
            </div>
          ) : (
            supplierPurchaseGroups.map((group) => (
              <SupplierCard key={group.supplier} group={group} />
            ))
          )}
        </div>
      </div>

      {showExportModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col m-4">
            <div className="flex items-center justify-between p-6 border-b border-incense-200">
              <div>
                <h3 className="text-xl font-bold font-song text-incense-800">导出采购清单</h3>
                <p className="text-sm text-incense-500 mt-1">
                  {viewMode === 'bySupplier' ? '按供应商分组，可直接发送给对应供应商' : '按原料列表，可复制后发送给采购同事'}
                </p>
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
            <div className="flex items-center justify-between p-6 border-t border-incense-200">
              <div className="text-sm text-incense-500">
                {viewMode === 'bySupplier'
                  ? `共 ${supplierPurchaseGroups.length} 个供应商，${supplierPurchaseGroups.reduce((s, g) => s + g.items.length, 0)} 种原料`
                  : `共 ${purchasePlanItems.length} 种原料，待确认 ${pendingCount} 种，已下单 ${orderedCount} 种`
                }
              </div>
              <div className="flex items-center gap-3">
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
        </div>
      )}
    </div>
  );
};
