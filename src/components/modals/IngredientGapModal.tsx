import React from 'react';
import {
  X,
  TrendingDown,
  Package,
  AlertTriangle,
  Calendar,
  ArrowRight,
  ShoppingCart,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { formatDateChinese } from '../../utils/dateUtils';
import { Badge } from '../common/Badge';

const priorityLabel = {
  high: '高优',
  medium: '中优',
  low: '低优',
};

const IngredientGapModal: React.FC = () => {
  const {
    showIngredientGapModal,
    ingredientGapOrderId,
    setShowIngredientGapModal,
    setIngredientGapOrderId,
    getOrderMaterialGap,
    setShowPurchaseSuggestion,
  } = useAppStore();

  const materialGap = ingredientGapOrderId
    ? getOrderMaterialGap(ingredientGapOrderId)
    : null;

  const handleClose = () => {
    setShowIngredientGapModal(false);
    setIngredientGapOrderId(null);
  };

  const handleGoToPurchase = () => {
    handleClose();
    setShowPurchaseSuggestion(true);
  };

  if (!showIngredientGapModal || !materialGap) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-incense-50 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-fade-in-up">
        <div className="flex items-center justify-between p-6 border-b border-incense-200 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <TrendingDown size={24} className="text-orange-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-song text-incense-800">
                原料缺口分析
              </h2>
              <p className="text-sm text-incense-500">
                {materialGap.orderNo} - {materialGap.recipeName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {materialGap.totalGapCount > 0 && (
              <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full">
                {materialGap.totalGapCount} 种原料缺口
              </span>
            )}
            <button
              onClick={handleClose}
              className="p-2 rounded-lg hover:bg-incense-100 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
          {materialGap.gaps.length === 0 ? (
            <div className="text-center py-12">
              <Package size={48} className="mx-auto text-bamboo-400 mb-4" />
              <h3 className="text-lg font-medium text-incense-600 mb-2">
                原料充足
              </h3>
              <p className="text-sm text-incense-500">
                该订单所需的所有原料库存充足，可以正常生产
              </p>
            </div>
          ) : (
            <>
              <div className="card p-4 border-l-4 border-l-orange-500 bg-gradient-to-r from-orange-50/50 to-incense-50">
                <div className="flex items-start gap-3">
                  <AlertTriangle
                    size={20}
                    className="text-orange-500 flex-shrink-0 mt-0.5"
                  />
                  <div>
                    <h3 className="font-semibold text-incense-800 mb-1">
                      原料缺口警告
                    </h3>
                    <p className="text-sm text-incense-600">
                      该订单有 {materialGap.totalGapCount} 种原料存在缺口，
                      建议尽快采购以确保生产进度
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {materialGap.gaps.map((gap, index) => (
                  <div
                    key={gap.ingredientId}
                    className="card p-4 animate-fade-in"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-incense-800 flex items-center gap-2">
                          {gap.ingredientName}
                          <Badge variant="critical">缺口 {gap.gap.toFixed(2)} {gap.unit}</Badge>
                        </h4>
                        <p className="text-sm text-incense-500 mt-1">
                          需要 {gap.required.toFixed(2)} {gap.unit}，
                          可用 {gap.available.toFixed(2)} {gap.unit}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div className="bg-incense-50 rounded-lg p-3 text-center">
                        <div className="text-xs text-incense-500 mb-1">需求量</div>
                        <div className="text-lg font-bold text-incense-700">
                          {gap.required.toFixed(2)}
                        </div>
                        <div className="text-xs text-incense-400">{gap.unit}</div>
                      </div>
                      <div className="bg-bamboo-50 rounded-lg p-3 text-center">
                        <div className="text-xs text-incense-500 mb-1">可用量</div>
                        <div className="text-lg font-bold text-bamboo-600">
                          {gap.available.toFixed(2)}
                        </div>
                        <div className="text-xs text-incense-400">{gap.unit}</div>
                      </div>
                      <div className="bg-red-50 rounded-lg p-3 text-center">
                        <div className="text-xs text-incense-500 mb-1">缺口</div>
                        <div className="text-lg font-bold text-red-600">
                          {gap.gap.toFixed(2)}
                        </div>
                        <div className="text-xs text-incense-400">{gap.unit}</div>
                      </div>
                    </div>

                    <div className="h-2 bg-incense-100 rounded-full overflow-hidden mb-3">
                      <div
                        className="h-full bg-gradient-to-r from-bamboo-400 to-orange-500 transition-all duration-500"
                        style={{
                          width: `${Math.min(100, (gap.available / gap.required) * 100)}%`,
                        }}
                      />
                    </div>

                    {gap.relatedOrders.length > 0 && (
                      <div>
                        <div className="text-xs text-incense-500 mb-2 flex items-center gap-1">
                          <ArrowRight size={12} />
                          其他占用该原料的订单：
                        </div>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {gap.relatedOrders.map((order) => (
                            <div
                              key={order.orderId}
                              className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-incense-100"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-incense-700">
                                  {order.orderNo}
                                </span>
                                <Badge variant={order.priority} className="text-xs">
                                  {priorityLabel[order.priority]}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-incense-500">
                                  需求 {order.requiredQuantity.toFixed(2)} {gap.unit}
                                </span>
                                <div className="flex items-center gap-1 text-xs text-incense-400">
                                  <Calendar size={12} />
                                  {formatDateChinese(order.deliveryDate)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="p-4 border-t border-incense-200 bg-white flex justify-end gap-3">
          <button onClick={handleClose} className="btn-secondary">
            关闭
          </button>
          {materialGap.totalGapCount > 0 && (
            <button
              onClick={handleGoToPurchase}
              className="btn-primary flex items-center gap-2"
            >
              <ShoppingCart size={16} />
              去采购建议
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default IngredientGapModal;
