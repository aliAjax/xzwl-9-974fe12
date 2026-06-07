import React from 'react';
import { clsx } from 'clsx';

export interface BadgeProps {
  variant?: 'high' | 'medium' | 'low' | 'success' | 'warning' | 'critical' | 'info';
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'info', children, className }) => {
  const variants = {
    high: 'bg-red-100 text-warning-critical',
    medium: 'bg-amber-100 text-sandal-500',
    low: 'bg-bamboo-50 text-bamboo-500',
    success: 'bg-bamboo-100 text-bamboo-500',
    warning: 'bg-amber-100 text-warning-warning',
    critical: 'bg-red-100 text-warning-critical',
    info: 'bg-blue-100 text-warning-info',
  };

  return (
    <span className={clsx('badge', variants[variant], className)}>
      {children}
    </span>
  );
};
