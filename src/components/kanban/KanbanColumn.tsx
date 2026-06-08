import React from 'react';
import { Hand, Scroll, Cloud, Archive, Package, ChevronRight } from 'lucide-react';
import { type Order, type StepType, STEP_CONFIG, STEP_ORDER } from '../../types';
import { OrderCard } from './OrderCard';
import { useAppStore } from '../../store/useAppStore';
import { clsx } from 'clsx';

interface KanbanColumnProps {
  stepType: StepType;
  orders: Order[];
}

const iconMap: Record<string, React.ReactNode> = {
  Hand: <Hand size={18} />,
  Scroll: <Scroll size={18} />,
  Cloud: <Cloud size={18} />,
  Archive: <Archive size={18} />,
  Package: <Package size={18} />,
};

export const KanbanColumn: React.FC<KanbanColumnProps> = ({ stepType, orders }) => {
  const { moveOrderToStep } = useAppStore();
  const config = STEP_CONFIG[stepType];
  const stepIndex = STEP_ORDER.indexOf(stepType);
  const nextStep = STEP_ORDER[stepIndex + 1];

  const handleMoveNext = (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const order = orders.find((item) => item.id === orderId);
    const targetStep = order?.status === 'pending' ? stepType : nextStep;

    if (targetStep) {
      moveOrderToStep(orderId, targetStep);
    }
  };

  return (
    <div className="kanban-column">
      <div className="flex items-center justify-between mb-3 pb-2 border-b-2 border-incense-300">
        <div className="flex items-center gap-2">
          <div
            className="p-1.5 rounded-md text-white"
            style={{ backgroundColor: config.color }}
          >
            {iconMap[config.icon]}
          </div>
          <h3 className="font-semibold text-incense-800 font-song">{config.name}</h3>
          <span className="text-xs bg-incense-200 text-incense-600 px-2 py-0.5 rounded-full">
            {orders.length}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin pr-1 -mr-1">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-incense-400">
            <p className="text-sm">暂无订单</p>
          </div>
        ) : (
          orders.map((order) => (
            <div key={order.id} className="relative group">
              <OrderCard order={order} />
              {(nextStep || order.status === 'pending') && (
                <button
                  onClick={(e) => handleMoveNext(order.id, e)}
                  className={clsx(
                    'absolute right-2 top-1/2 -translate-y-1/2',
                    'opacity-0 group-hover:opacity-100 transition-opacity',
                    'bg-incense-600 hover:bg-incense-700 text-white p-1 rounded-full',
                    'shadow-md hover:shadow-lg'
                  )}
                  title={
                    order.status === 'pending'
                      ? `开始${config.name}`
                      : `移至${STEP_CONFIG[nextStep].name}`
                  }
                >
                  <ChevronRight size={14} />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
