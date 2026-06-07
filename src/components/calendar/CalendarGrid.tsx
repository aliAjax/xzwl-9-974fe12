import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday as isDateToday, getDay, startOfWeek, endOfWeek } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { CalendarEvent } from './CalendarEvent';
import { useAppStore } from '../../store/useAppStore';
import { getToday } from '../../utils/dateUtils';
import { clsx } from 'clsx';

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

export const CalendarGrid: React.FC = () => {
  const { orders, setSelectedOrderId, getOrdersByDate } = useAppStore();
  const [currentMonth, setCurrentMonth] = useState(new Date('2026-06-07'));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const getOrdersForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return orders.filter((order) => {
      if (order.status === 'completed') return false;
      return order.steps.some(
        (step) =>
          step.status !== 'not_started' &&
          step.startDate <= dateStr &&
          step.endDate >= dateStr
      );
    });
  };

  const today = getToday();

  return (
    <div className="card-paper p-4 animate-fade-in-up" style={{ opacity: 0 }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold font-song text-incense-800">
          {format(currentMonth, 'yyyy年 M月', { locale: zhCN })}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg hover:bg-incense-200 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => setCurrentMonth(new Date('2026-06-07'))}
            className="px-3 py-1 text-sm bg-incense-600 text-white rounded-md hover:bg-incense-700 transition-colors"
          >
            今天
          </button>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg hover:bg-incense-200 transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="text-center py-2 text-sm font-medium text-incense-600 bg-incense-100"
          >
            {day}
          </div>
        ))}

        {days.map((day, index) => {
          const dayOrders = getOrdersForDate(day);
          const dateStr = format(day, 'yyyy-MM-dd');
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isToday = dateStr === today;
          const isWeekend = getDay(day) === 0 || getDay(day) === 6;

          return (
            <div
              key={dateStr}
              className={clsx(
                'min-h-[120px] p-1 border border-incense-200',
                'transition-colors duration-200',
                !isCurrentMonth && 'bg-incense-50/50',
                isCurrentMonth && 'bg-white',
                isToday && 'bg-sandal-50 ring-2 ring-sandal-500 ring-inset',
                isWeekend && isCurrentMonth && 'bg-incense-50'
              )}
            >
              <div
                className={clsx(
                  'text-sm font-medium mb-1 px-1',
                  !isCurrentMonth && 'text-incense-300',
                  isToday && 'text-sandal-500 font-bold',
                  isWeekend && isCurrentMonth && !isToday && 'text-incense-400'
                )}
              >
                {format(day, 'd')}
              </div>
              <div className="space-y-1 max-h-[90px] overflow-y-auto scrollbar-thin">
                {dayOrders.slice(0, 3).map((order) => (
                  <CalendarEvent
                    key={order.id}
                    order={order}
                    onClick={() => setSelectedOrderId(order.id)}
                  />
                ))}
                {dayOrders.length > 3 && (
                  <div className="text-xs text-incense-500 text-center">
                    +{dayOrders.length - 3} 更多
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-incense-600">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-incense-400"></div>
          <span>进行中</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-sandal-500"></div>
          <span>有预警</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-warning-critical"></div>
          <span>紧急</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded ring-2 ring-sandal-500"></div>
          <span>今天</span>
        </div>
      </div>
    </div>
  );
};
