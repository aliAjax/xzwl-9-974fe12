import React from 'react';
import { clsx } from 'clsx';

interface ProgressBarProps {
  value: number;
  max?: number;
  variant?: 'default' | 'success' | 'warning' | 'critical';
  showLabel?: boolean;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  variant = 'default',
  showLabel = false,
  className,
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const variants = {
    default: 'bg-incense-500',
    success: 'bg-bamboo-500',
    warning: 'bg-sandal-500',
    critical: 'bg-warning-critical',
  };

  return (
    <div className={clsx('w-full', className)}>
      <div className="flex justify-between text-xs text-incense-600 mb-1">
        {showLabel && (
          <>
            <span>{value}</span>
            <span>{Math.round(percentage)}%</span>
          </>
        )}
      </div>
      <div className="h-2 bg-incense-200 rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all duration-500', variants[variant])}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
