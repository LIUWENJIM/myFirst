// frontend/src/components/interviewschedule/InterviewEvent.tsx

import React from 'react';
import { motion } from 'framer-motion';
import type { InterviewSchedule } from '../../types/interviewSchedule';

interface InterviewEventProps {
  event: InterviewSchedule;
}

export const InterviewEvent: React.FC<InterviewEventProps> = ({ event }) => {
  const statusConfig = {
    PENDING: {
      bg: 'rgba(204,120,92,0.12)',
      text: 'var(--color-primary)',
      border: 'rgba(204,120,92,0.3)',
    },
    COMPLETED: {
      bg: 'rgba(16,185,129,0.12)',
      text: '#10b981',
      border: 'rgba(16,185,129,0.3)',
    },
    CANCELLED: {
      bg: 'var(--color-surface-soft)',
      text: 'var(--color-muted)',
      border: 'var(--color-hairline)',
    },
    RESCHEDULED: {
      bg: 'rgba(245,158,11,0.12)',
      text: '#f59e0b',
      border: 'rgba(245,158,11,0.3)',
    },
  };

  const config = statusConfig[event.status];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      className="p-1.5 rounded-lg h-full overflow-hidden"
      style={{
        backgroundColor: config.bg,
        color: config.text,
        border: `1px solid ${config.border}`,
      }}
    >
      <div className="font-semibold text-xs leading-tight mb-0.5 break-words" style={{fontFamily: 'var(--font-display)'}}>{event.companyName}</div>
      <div className="text-xs opacity-90 font-medium leading-tight break-words">{event.position}</div>
      {event.roundNumber > 1 && (
        <div className="text-xs opacity-75 mt-0.5 font-medium leading-tight">第{event.roundNumber}轮</div>
      )}
    </motion.div>
  );
};
