import React from 'react';
import { X, Package, AlertTriangle, Calendar, TrendingDown, ShoppingCart } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { ProgressBar } from '../common/ProgressBar';
import { formatDateChinese, daysBetween, getToday } from '../../utils/dateUtils';
import { clsx } from 'clsx';
import { Badge } from '../common/Badge';

interface IngredientPanelProps {
  onClose: () => void;
}

export const IngredientPanel: React.FC<IngredientPanelProps> = ({ onClose }) => {
  const { ingredients, purchaseSuggestions, setShowPurchaseSuggestion } = useAppStore();

  const getStockStatus = (ingredient: typeof ingredients[0]) => {
    const ratio = ingredient.quantity / ingredient.safetyStock;
    if (ratio < 0.3) return 'critical';
    if (ratio < 0.5) return 'warning';
    return 'success';
  };

  const getExpiryStatus = (ingredient: typeof ingredients[0]) => {
    const days = daysBetween(getToday(), ingredient.expiryDate);
    if (days <= 7) return 'critical';
    if (days <= 30) return 'warning';
    return 'success';
  };

  const sortedIngredients = [...ingredients].sort((a, b) => {
    const aStatus = getStockStatus(a);
    const bStatus = getStockStatus(b);
    const priority = { critical: 0, warning: 1, success: 2 };
    return priority[aStatus] - priority[bStatus];
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end print:hidden">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg bg-incense-50 h-full shadow-2xl flex flex-col animate-slide-up">
        <div className="flex items-center justify-between p-4 border-b border-incense-200 bg-white">
          <div className="flex items-center gap-2">
            <Package className="text-incense-600" size={24} />
            <h2 className="text-xl font-bold font-song text-incense-800">原料库存</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-incense-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 border-b border-incense-200 bg-white/50">
          <button
            onClick={() => {
              onClose();
              setShowPurchaseSuggestion(true);
            }}
            className="w-full flex items-center justify-between p-3 bg-sandal-50 hover:bg-sandal-100 border border-sandal-200 rounded-lg transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-sandal-500 rounded-lg flex items-center justify-center">
                <ShoppingCart className="text-white" size={20} />
              </div>
              <div className="text-left">
                <div className="font-semibold text-incense-800 group-hover:text-sandal-700">
                  查看采购建议
                </div>
                <div className="text-xs text-incense-500">
                  基于库存、订单和有效期智能计算
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {purchaseSuggestions.length > 0 && (
                <Badge variant="critical">
                  {purchaseSuggestions.length} 种待采购
                </Badge>
              )}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-incense-400 group-hover:text-sandal-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
          {sortedIngredients.map((ingredient) => {
            const stockStatus = getStockStatus(ingredient);
            const expiryStatus = getExpiryStatus(ingredient);
            const daysToExpiry = daysBetween(getToday(), ingredient.expiryDate);
            const hasWarning = stockStatus !== 'success' || expiryStatus !== 'success';

            return (
              <div
                key={ingredient.id}
                className={clsx(
                  'card p-4 transition-all duration-200',
                  hasWarning && 'border-l-4 border-l-sandal-500'
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-incense-800">{ingredient.name}</h3>
                    <p className="text-xs text-incense-500">批次：{ingredient.batchNo}</p>
                  </div>
                  {hasWarning && (
                    <AlertTriangle size={16} className="text-sandal-500 flex-shrink-0" />
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-incense-600 flex items-center gap-1">
                        <TrendingDown size={14} />
                        库存
                      </span>
                      <span className="font-medium text-incense-800">
                        {ingredient.quantity} {ingredient.unit}
                        <span className="text-xs text-incense-500 ml-1">
                          / 安全库存 {ingredient.safetyStock}
                        </span>
                      </span>
                    </div>
                    <ProgressBar
                      value={ingredient.quantity}
                      max={ingredient.safetyStock}
                      variant={stockStatus === 'success' ? 'success' : stockStatus === 'warning' ? 'warning' : 'critical'}
                    />
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-incense-600 flex items-center gap-1">
                      <Calendar size={14} />
                      有效期
                    </span>
                    <span
                      className={clsx(
                        'font-medium',
                        expiryStatus === 'critical' && 'text-warning-critical',
                        expiryStatus === 'warning' && 'text-sandal-500',
                        expiryStatus === 'success' && 'text-incense-800'
                      )}
                    >
                      {formatDateChinese(ingredient.expiryDate)}
                      {daysToExpiry <= 30 && (
                        <span className="text-xs ml-1">
                          ({daysToExpiry > 0 ? `${daysToExpiry}天后到期` : `已过期${Math.abs(daysToExpiry)}天`})
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-incense-100 grid grid-cols-2 gap-2 text-xs text-incense-500">
                    <div>
                      <span className="text-incense-400">入库日期：</span>
                      {formatDateChinese(ingredient.receiveDate)}
                    </div>
                    <div>
                      <span className="text-incense-400">供应商：</span>
                      {ingredient.supplier}
                    </div>
                    <div className="col-span-2">
                      <span className="text-incense-400">单价：</span>
                      ¥{ingredient.unitPrice.toFixed(2)}/{ingredient.unit}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
