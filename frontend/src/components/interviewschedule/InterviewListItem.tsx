// frontend/src/components/interviewschedule/InterviewListItem.tsx

import React from 'react';
import { motion } from 'framer-motion';
import { Edit2, Trash2, ExternalLink } from 'lucide-react';
import dayjs from 'dayjs';
import type { InterviewSchedule, InterviewStatus } from '../../types/interviewSchedule';

interface InterviewListItemProps {
  interview: InterviewSchedule;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: InterviewStatus) => void;
}

const statusConfig: Record<InterviewStatus, { label: string; bg: string; text: string; border: string }> = {
  PENDING: {
    label: '待面试',
    bg: 'rgba(204,120,92,0.12)',
    text: 'var(--color-primary)',
    border: 'rgba(204,120,92,0.3)',
  },
  COMPLETED: {
    label: '已完成',
    bg: 'rgba(16,185,129,0.12)',
    text: '#10b981',
    border: 'rgba(16,185,129,0.3)',
  },
  CANCELLED: {
    label: '已取消',
    bg: 'var(--color-surface-soft)',
    text: 'var(--color-muted)',
    border: 'var(--color-hairline)',
  },
  RESCHEDULED: {
    label: '已改期',
    bg: 'rgba(245,158,11,0.12)',
    text: '#f59e0b',
    border: 'rgba(245,158,11,0.3)',
  },
};

const typeLabels: Record<string, string> = {
  ONSITE: '现场面试',
  VIDEO: '视频面试',
  PHONE: '电话面试',
};

export const InterviewListItem: React.FC<InterviewListItemProps> = ({
  interview,
  onEdit,
  onDelete,
  onStatusChange,
}) => {
  const sc = statusConfig[interview.status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className="card-container-interactive p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-3">
            <span
              className="status-badge px-2 py-0.5 rounded text-xs font-medium"
              style={{backgroundColor: sc.bg, color: sc.text, border: `1px solid ${sc.border}`}}
            >
              {sc.label}
            </span>
            <span className="text-sm font-medium" style={{color: 'var(--color-muted)'}}>
              {dayjs(interview.interviewTime).format('YYYY-MM-DD HH:mm')}
            </span>
          </div>

          <h3 className="font-bold text-xl mb-2 tracking-tight" style={{color: 'var(--color-ink)', fontFamily: 'var(--font-display)'}}>
            {interview.companyName}
          </h3>
          <p className="mb-3 font-medium" style={{color: 'var(--color-body-text)'}}>{interview.position}</p>

          <div className="flex flex-wrap items-center gap-3 text-sm" style={{color: 'var(--color-muted)'}}>
            <span className="px-3 py-1 rounded-lg font-medium" style={{backgroundColor: 'var(--color-surface-soft)'}}>
              第 {interview.roundNumber} 轮
            </span>
            <span style={{color: 'var(--color-hairline)'}}>•</span>
            <span className="font-medium">{typeLabels[interview.interviewType] || interview.interviewType}</span>
            {interview.interviewer && (
              <>
                <span style={{color: 'var(--color-hairline)'}}>•</span>
                <span className="font-medium">{interview.interviewer}</span>
              </>
            )}
          </div>

          {interview.meetingLink && (
            <motion.a
              whileHover={{ x: 2 }}
              href={interview.meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium mt-3 transition-colors"
              style={{color: 'var(--color-primary)'}}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.8'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
            >
              <ExternalLink className="w-4 h-4" />
              进入会议
            </motion.a>
          )}

          {interview.notes && (
            <p className="text-sm mt-3 italic" style={{color: 'var(--color-muted)'}}>{interview.notes}</p>
          )}
        </div>

        <div className="flex gap-2">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onEdit}
            className="p-2.5 rounded-lg transition-all"
            style={{color: 'var(--color-muted)'}}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-primary)'; (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(204,120,92,0.1)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-muted)'; (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            title="编辑"
          >
            <Edit2 className="w-5 h-5" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onDelete}
            className="p-2.5 rounded-lg transition-all"
            style={{color: 'var(--color-muted)'}}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-error)'; (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(198,69,69,0.08)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-muted)'; (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            title="删除"
          >
            <Trash2 className="w-5 h-5" />
          </motion.button>
        </div>
      </div>

      {interview.status === 'PENDING' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-4 pt-4 flex gap-3"
          style={{borderTop: '1px solid var(--color-hairline)'}}
        >
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onStatusChange('COMPLETED')}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-all"
            style={{backgroundColor: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)'}}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(16,185,129,0.2)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(16,185,129,0.12)'; }}
          >
            标记为已完成
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onStatusChange('CANCELLED')}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-all"
            style={{backgroundColor: 'var(--color-surface-soft)', color: 'var(--color-body-text)', border: '1px solid var(--color-hairline)'}}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-card)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-soft)'; }}
          >
            取消面试
          </motion.button>
        </motion.div>
      )}
    </motion.div>
  );
};
