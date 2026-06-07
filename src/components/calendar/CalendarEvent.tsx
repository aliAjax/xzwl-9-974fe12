import React from 'react';
import { Order, STEP_CONFIG } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { clsx } from 'clsx';

interface CalendarEventProps {
  order: Order;
  onClick?: () => void;
}

export const CalendarEvent: React.FC<CalendarEventProps> = ({ order, onClick }) => {
  const { getRecipeById, getOrderWarnings } = useAppStore();
  const recipe = getRecipeById(order.recipeId);
  const warnings = getOrderWarnings(order.id);
  const currentStep = order.steps.find((s) => s.status === 'in_progress');

  const hasCriticalWarning = warnings.some((w) => w.level === 'critical');
  const hasWarning = warnings.length > 0;

  const stepColor = currentStep ? STEP_CONFIG[currentStep.stepType].color : '#8D6E63';

  return (
    <div
      onClick={onClick}
      className={clsx(
        'text-xs p-1.5 rounded mb-1 cursor-pointer transition-all duration-200',
        'hover:shadow-md hover:-translate-y-0.5',
        hasCriticalWarning
          ? 'bg-red-100 border-l-2 border-warning-critical'
          : hasWarning
            ? 'bg-amber-100 border-l-2 border-sandal-500'
            : 'bg-incense-100 border-l-2'
      )}
      style={{ borderLeftColor: hasCriticalWarning ? undefined : hasWarning ? undefined : stepColor }}
    >
      <div className="font-medium text-incense-800 truncate">{order.orderNo}</div>
      <div className="text-incense-600 text-[10px] truncate">{recipe?.name}</div>
      {currentStep && (
        <div
          className="text-[10px] mt-0.5 px-1 py-0.5 rounded inline-block text-white"
          style={{ backgroundColor: stepColor }}
        >
          {currentStep.stepName}
        </div>
      )}
    </div>
  );
};
