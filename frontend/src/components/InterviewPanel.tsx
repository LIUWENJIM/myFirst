import {useMemo, useState} from 'react';
import {motion} from 'framer-motion';
import {CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
import {formatDateOnly} from '../utils/date';
import {getScoreColor} from '../utils/score';
import type {InterviewItem} from '../api/history';
import {historyApi} from '../api/history';
import ConfirmDialog from './ConfirmDialog';
import {Calendar, ChevronRight, Download, MessageSquare, Mic, Trash2, TrendingUp} from 'lucide-react';

interface InterviewPanelProps {
  interviews: InterviewItem[];
  onStartInterview: () => void;
  onViewInterview: (sessionId: string) => void;
  onExportInterview: (sessionId: string) => void;
  onDeleteInterview: (sessionId: string) => void;
  exporting: string | null;
  loadingInterview: boolean;
}

export default function InterviewPanel({
  interviews,
  onStartInterview,
  onViewInterview,
  onExportInterview,
  onDeleteInterview,
  exporting,
  loadingInterview
}: InterviewPanelProps) {
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ sessionId: string } | null>(null);

  const handleDeleteClick = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirm({ sessionId });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;

    const { sessionId } = deleteConfirm;
    setDeletingSessionId(sessionId);
    try {
      await historyApi.deleteInterview(sessionId);
      onDeleteInterview(sessionId);
      setDeleteConfirm(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败，请稍后重试');
    } finally {
      setDeletingSessionId(null);
    }
  };

  const chartData = useMemo(() => {
    return interviews
      .filter(i => i.overallScore !== null)
      .map((interview) => ({
        name: formatDateOnly(interview.createdAt),
        score: interview.overallScore || 0,
        index: interviews.length - interviews.indexOf(interview)
      }))
      .reverse();
  }, [interviews]);

  if (interviews.length === 0) {
    return (
      <div className="card-container p-12 text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center" style={{backgroundColor: 'var(--color-surface-soft)'}}>
          <Mic className="w-8 h-8" style={{color: 'var(--color-muted)'}} />
        </div>
        <h3 className="text-xl font-semibold mb-2" style={{color: 'var(--color-body-text)'}}>暂无面试记录</h3>
        <p className="mb-6" style={{color: 'var(--color-muted)'}}>开始模拟面试，获取专业评估</p>
        <motion.button
          onClick={onStartInterview}
          className="px-6 py-3 rounded-lg font-medium text-white"
          style={{backgroundColor: 'var(--color-primary)'}}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          开始模拟面试
        </motion.button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Chart */}
      {chartData.length > 0 && (
        <motion.div
          className="card-container p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" style={{color: 'var(--color-primary)'}} />
              <span className="font-semibold" style={{color: 'var(--color-ink)'}}>面试表现趋势</span>
            </div>
            <span className="text-sm" style={{color: 'var(--color-muted)'}}>共 {chartData.length} 场练习</span>
          </div>

          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-hairline)" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                />
                <YAxis
                  domain={[0, 100]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-surface-card)',
                    border: '1px solid var(--color-hairline)',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                  formatter={(value) => [`${value} 分`, '得分']}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="var(--color-primary)"
                  strokeWidth={3}
                  dot={{ fill: 'var(--color-primary)', strokeWidth: 2, r: 5 }}
                  activeDot={{ r: 8, fill: 'var(--color-primary)' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* History */}
      <motion.div
        className="card-container p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center justify-between mb-6">
          <span className="font-semibold" style={{color: 'var(--color-ink)'}}>历史面试场次</span>
        </div>

        <div className="space-y-4">
          {interviews.map((interview, index) => (
            <InterviewItemCard
              key={interview.id}
              interview={interview}
              index={index}
              total={interviews.length}
              exporting={exporting === interview.sessionId}
              deleting={deletingSessionId === interview.sessionId}
              onView={() => onViewInterview(interview.sessionId)}
              onExport={() => onExportInterview(interview.sessionId)}
              onDelete={(e) => handleDeleteClick(interview.sessionId, e)}
            />
          ))}
        </div>

        <ConfirmDialog
          open={deleteConfirm !== null}
          title="删除面试记录"
          message="确定要删除这条面试记录吗？删除后无法恢复。"
          confirmText="确定删除"
          cancelText="取消"
          confirmVariant="danger"
          loading={deletingSessionId !== null}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteConfirm(null)}
        />

        {loadingInterview && (
          <div className="fixed inset-0 flex items-center justify-center z-50" style={{backgroundColor: 'rgba(0,0,0,0.2)'}}>
            <div className="card-container p-6 flex items-center gap-4">
              <motion.div
                className="w-8 h-8 border-3 rounded-full"
                style={{borderColor: 'var(--color-hairline)', borderTopColor: 'var(--color-primary)'}}
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
              <span style={{color: 'var(--color-body-text)'}}>加载面试详情...</span>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function InterviewItemCard({
  interview,
  index,
  total,
  exporting,
  deleting,
  onView,
  onExport,
  onDelete
}: {
  interview: InterviewItem;
  index: number;
  total: number;
  exporting: boolean;
  deleting: boolean;
  onView: () => void;
  onExport: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      onClick={onView}
      className="flex items-center gap-4 p-4 rounded-lg cursor-pointer transition-colors group"
      style={{backgroundColor: 'var(--color-surface-soft)'}}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-card)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-soft)'; }}
    >
      <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg ${
        interview.overallScore !== null
          ? getScoreColor(interview.overallScore, [85, 70])
          : ''
      }`}
        style={interview.overallScore === null ? {backgroundColor: 'var(--color-surface-card)', color: 'var(--color-muted)'} : undefined}
      >
        {interview.overallScore ?? '-'}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium truncate" style={{color: 'var(--color-ink)'}}>
          模拟面试 #{total - index}
        </p>
        <div className="flex items-center gap-4 text-sm" style={{color: 'var(--color-muted)'}}>
          <span className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            {formatDateOnly(interview.createdAt)}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="w-4 h-4" />
            {interview.totalQuestions} 题
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100">
        <motion.button
          onClick={(e) => { e.stopPropagation(); onExport(); }}
          disabled={exporting}
          className="p-2 rounded-lg transition-all"
          style={{color: 'var(--color-muted)'}}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-primary)'; (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-card)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-muted)'; (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Download className="w-5 h-5" />
        </motion.button>

        <button
          onClick={onDelete}
          disabled={deleting}
          className="p-2 rounded-lg transition-colors disabled:opacity-50"
          style={{color: 'var(--color-muted)'}}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-error)'; (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(198,69,69,0.08)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-muted)'; (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          title="删除面试记录"
        >
          {deleting ? (
            <motion.div
              className="w-5 h-5 border rounded-full"
              style={{borderColor: 'var(--color-error)', borderTopColor: 'transparent'}}
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          ) : (
            <Trash2 className="w-5 h-5" />
          )}
        </button>
      </div>

      <ChevronRight
        className="w-5 h-5 flex-shrink-0 transition-all"
        style={{color: 'var(--color-hairline)'}}
      />
    </motion.div>
  );
}
