// frontend/src/components/interviewschedule/ScheduleHeader.tsx

import React from 'react';
import { motion } from 'framer-motion';
import { Plus, ChevronLeft, ChevronRight, Calendar, List, LayoutGrid } from 'lucide-react';
import dayjs from 'dayjs';

interface ScheduleHeaderProps {
  view: 'day' | 'week' | 'month' | 'list';
  onViewChange: (view: 'day' | 'week' | 'month' | 'list') => void;
  date: Date;
  onDateChange: (date: Date) => void;
  onAddClick: () => void;
}

export const ScheduleHeader: React.FC<ScheduleHeaderProps> = ({
  view,
  onViewChange,
  date,
  onDateChange,
  onAddClick,
}) => {
  const handlePrevious = () => {
    const newDate = new Date(date);
    if (view === 'day') {
      newDate.setDate(newDate.getDate() - 1);
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else if (view === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    }
    onDateChange(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(date);
    if (view === 'day') {
      newDate.setDate(newDate.getDate() + 1);
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else if (view === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    onDateChange(newDate);
  };

  const handleToday = () => {
    onDateChange(new Date());
  };

  const getTitle = () => {
    if (view === 'list') {
      return '面试列表';
    }
    return dayjs(date).format(view === 'month' ? 'YYYY年MM月' : 'YYYY年MM月DD日');
  };

  const viewBtnStyle = (active: boolean): React.CSSProperties => active
    ? {
        backgroundColor: 'var(--color-surface-card)',
        color: 'var(--color-primary)',
        border: '1px solid var(--color-hairline)',
      }
    : {
        backgroundColor: 'transparent',
        color: 'var(--color-muted)',
        border: '1px solid transparent',
      };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="card-container p-6 mb-6"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <motion.h2
            key={getTitle()}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-2xl font-bold tracking-tight"
            style={{color: 'var(--color-ink)', fontFamily: 'var(--font-display)'}}
          >
            {getTitle()}
          </motion.h2>

          {view !== 'list' && (
            <div className="flex items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handlePrevious}
                className="p-2.5 rounded-lg transition-colors"
                style={{color: 'var(--color-body-text)'}}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-soft)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                title="上一页"
              >
                <ChevronLeft className="w-5 h-5" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleToday}
                className="px-4 py-2 text-sm font-medium rounded-lg transition-all"
                style={{backgroundColor: 'rgba(204,120,92,0.12)', color: 'var(--color-primary)', border: '1px solid rgba(204,120,92,0.3)'}}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(204,120,92,0.2)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(204,120,92,0.12)'; }}
              >
                今天
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleNext}
                className="p-2.5 rounded-lg transition-colors"
                style={{color: 'var(--color-body-text)'}}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-soft)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                title="下一页"
              >
                <ChevronRight className="w-5 h-5" />
              </motion.button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex rounded-lg p-1.5 gap-1" style={{backgroundColor: 'var(--color-surface-soft)'}}>
            {[
              { key: 'day', icon: Calendar, label: '日视图' },
              { key: 'week', icon: Calendar, label: '周视图' },
              { key: 'month', icon: LayoutGrid, label: '月视图' },
              { key: 'list', icon: List, label: '列表' },
            ].map(({ key, icon: Icon, label }) => (
              <motion.button
                key={key}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onViewChange(key as any)}
                className="px-4 py-2 rounded-lg flex items-center gap-2 font-medium text-sm transition-all"
                style={viewBtnStyle(view === key)}
              >
                <Icon className="w-4 h-4" />
                {label}
              </motion.button>
            ))}
          </div>

          <motion.button
            whileHover={{ scale: 1.05, y: -1 }}
            whileTap={{ scale: 0.95 }}
            onClick={onAddClick}
            className="px-5 py-2.5 text-white rounded-lg font-medium flex items-center gap-2 transition-all"
            style={{backgroundColor: 'var(--color-primary)'}}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.9'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
          >
            <Plus className="w-4 h-4" />
            添加面试
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};
