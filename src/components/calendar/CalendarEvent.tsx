import React, { useState } from 'react';
import { User, Settings } from 'lucide-react';
import { Order, STEP_CONFIG } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { clsx } from 'clsx';

interface CalendarEventProps {
  order: Order;
  onClick?: () => void;
}

export const CalendarEvent: React.FC<CalendarEventProps> = ({ order, onClick }) => {
  const { getRecipeById, getOrderWarnings, setScheduleAdjustOrderId, setShowScheduleAdjustModal, setSelectedOrderId } = useAppStore();
  const recipe = getRecipeById(order.recipeId);
  const warnings = getOrderWarnings(order.id);
  const currentStep = order.steps.find((s) => s.status === 'in_progress');
  const [showTooltip, setShowTooltip] = useState(false);

  const hasCriticalWarning = warnings.some((w) => w.level === 'critical');
  const hasWarning = warnings.length > 0;

  const stepColor = currentStep ? STEP_CONFIG[currentStep.stepType].color : '#8D6E63';

  const handleAdjustSchedule = (e: React.MouseEvent) => {
    e.stopPropagation();
    setScheduleAdjustOrderId(order.id);
    setShowScheduleAdjustModal(true);
    setSelectedOrderId(null);
  };

  return (
    <div
      className={clsx(
        'text-xs p-1.5 rounded mb-1 cursor-pointer transition-all duration-200 group relative',
        'hover:shadow-md hover:-translate-y-0.5',
        hasCriticalWarning
          ? 'bg-red-100 border-l-2 border-warning-critical'
          : hasWarning
            ? 'bg-amber-100 border-l-2 border-sandal-500'
            : 'bg-incense-100 border-l-2'
      )}
      style={{ borderLeftColor: hasCriticalWarning ? undefined : hasWarning ? undefined : stepColor }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0" onClick={onClick}>
          <div className="font-medium text-incense-800 truncate">{order.orderNo}</div>
          <div className="text-incense-600 text-[10px] truncate">{recipe?.name}</div>
          {currentStep && (
            <div className="flex items-center gap-1 mt-0.5">
              <div
                className="text-[10px] px-1 py-0.5 rounded inline-block text-white"
                style={{ backgroundColor: stepColor }}
              >
                {currentStep.stepName}
              </div>
              {currentStep.assignee && (
                <div className="flex items-center gap-0.5 text-[10px] text-incense-500">
                  <User size={10} />
                  <span>{currentStep.assignee}</span>
                </div>
              )}
            </div>
          )}
        </div>
        <button
          onClick={handleAdjustSchedule}
          className={clsx(
            'ml-1 p-1 rounded transition-all duration-200',
            'hover:bg-white/80 hover:text-incense-700',
            'text-incense-400 opacity-0 group-hover:opacity-100'
          )}
          title="调整排期"
        >
          <Settings size={12} />
        </button>
      </div>

      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-incense-800 text-white text-[10px] rounded whitespace-nowrap z-50 pointer-events-none animate-fade-in">
          点击查看详情 · 点击齿轮调整排期
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-incense-800" />
        </div>
      )}
    </div>
  );
};
