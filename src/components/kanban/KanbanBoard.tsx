import React from 'react';
import { KanbanColumn } from './KanbanColumn';
import { useAppStore } from '../../store/useAppStore';
import { STEP_ORDER, type StepType } from '../../types';

export const KanbanBoard: React.FC = () => {
  const { getOrdersByStep } = useAppStore();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {STEP_ORDER.map((stepType: StepType, index) => (
        <div
          key={stepType}
          className={`animate-fade-in-up stagger-${index + 1}`}
          style={{ opacity: 0 }}
        >
          <KanbanColumn stepType={stepType} orders={getOrdersByStep(stepType)} />
        </div>
      ))}
    </div>
  );
};
