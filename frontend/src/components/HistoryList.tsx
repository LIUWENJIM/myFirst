import {useCallback, useEffect, useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {AnalyzeStatus, historyApi, ResumeListItem, ResumeStats} from '../api/history';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import {getScoreColor} from '../utils/score';
import {formatDate} from '../utils/date';
import {
  AlertCircle,
  CheckCircle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileStack,
  FileText,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';

interface HistoryListProps {
  onSelectResume: (id: number) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function StatusIcon({ status, hasScore }: { status?: AnalyzeStatus; hasScore: boolean }) {
  if (status === undefined) {
    if (hasScore) {
      return <CheckCircle className="w-4 h-4" style={{color: 'var(--color-success)'}} />;
    }
    return <Clock className="w-4 h-4" style={{color: 'var(--color-warning)'}} />;
  }

  switch (status) {
    case 'COMPLETED':
      return <CheckCircle className="w-4 h-4" style={{color: 'var(--color-success)'}} />;
    case 'PROCESSING':
      return <Loader2 className="w-4 h-4 animate-spin" style={{color: 'var(--color-primary)'}} />;
    case 'PENDING':
      return <Clock className="w-4 h-4" style={{color: 'var(--color-warning)'}} />;
    case 'FAILED':
      return <AlertCircle className="w-4 h-4" style={{color: 'var(--color-error)'}} />;
    default:
      return <CheckCircle className="w-4 h-4" style={{color: 'var(--color-success)'}} />;
  }
}

function getStatusText(status?: AnalyzeStatus, hasScore?: boolean): string {
  if (status === undefined) {
    if (hasScore) {
      return '已完成';
    }
    return '待分析';
  }

  switch (status) {
    case 'COMPLETED':
      return '已完成';
    case 'PROCESSING':
      return '分析中';
    case 'PENDING':
      return '待分析';
    case 'FAILED':
      return '失败';
    default:
      return '未知';
  }
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-container-interactive p-6"
    >
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-lg" style={{backgroundColor: color}}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
          <p className="text-sm" style={{color: 'var(--color-muted)'}}>{label}</p>
          <p className="text-2xl font-bold" style={{color: 'var(--color-ink)', fontFamily: 'var(--font-display)'}}>{value.toLocaleString()}</p>
        </div>
      </div>
    </motion.div>
  );
}

export default function HistoryList({ onSelectResume }: HistoryListProps) {
  const [resumes, setResumes] = useState<ResumeListItem[]>([]);
  const [stats, setStats] = useState<ResumeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteItem, setDeleteItem] = useState<ResumeListItem | null>(null);
  const [reanalyzingId, setReanalyzingId] = useState<number | null>(null);

  const loadDataSilent = useCallback(async () => {
    try {
      const [resumeData, statsData] = await Promise.all([
        historyApi.getResumes(),
        historyApi.getStatistics(),
      ]);
      setResumes(resumeData);
      setStats(statsData);
    } catch (err) {
      console.error('加载数据失败', err);
    }
  }, []);

  const loadResumes = useCallback(async () => {
    setLoading(true);
    try {
      const [resumeData, statsData] = await Promise.all([
        historyApi.getResumes(),
        historyApi.getStatistics(),
      ]);
      setResumes(resumeData);
      setStats(statsData);
    } catch (err) {
      console.error('加载数据失败', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadResumes();
  }, [loadResumes]);

  useEffect(() => {
    const hasPendingItems = resumes.some(
      r => r.analyzeStatus === 'PENDING' ||
        r.analyzeStatus === 'PROCESSING' ||
        (r.analyzeStatus === undefined && r.latestScore === undefined)
    );

    if (hasPendingItems && !loading) {
      const timer = setInterval(() => {
        loadDataSilent();
      }, 5000);

      return () => clearInterval(timer);
    }
  }, [resumes, loading, loadDataSilent]);

  const handleDownload = (resume: ResumeListItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (resume.storageUrl) {
      const link = document.createElement('a');
      link.href = resume.storageUrl;
      link.download = resume.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleReanalyze = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setReanalyzingId(id);
      await historyApi.reanalyze(id);
      await loadDataSilent();
    } catch (err) {
      console.error('重新分析失败', err);
    } finally {
      setReanalyzingId(null);
    }
  };

  const handleDeleteClick = (resume: ResumeListItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteItem(resume);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteItem) return;

    setDeletingId(deleteItem.id);
    try {
      await historyApi.deleteResume(deleteItem.id);
      await loadResumes();
      setDeleteItem(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败，请稍后重试');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredResumes = resumes.filter(resume =>
    resume.filename.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <motion.div
      className="w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-8 flex-wrap gap-6">
        <div>
          <motion.h1
            className="text-2xl font-bold flex items-center gap-3"
            style={{color: 'var(--color-ink)', fontFamily: 'var(--font-display)'}}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <FileStack className="w-7 h-7" style={{color: 'var(--color-primary)'}} />
            简历库
          </motion.h1>
          <motion.p
            className="mt-1"
            style={{color: 'var(--color-muted)'}}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            管理您已分析过的所有简历及面试记录
          </motion.p>
        </div>

        <motion.div
          className="flex items-center gap-3 border rounded-lg px-4 py-2.5 min-w-[280px] transition-all"
          style={{backgroundColor: 'var(--color-surface-card)', borderColor: 'var(--color-hairline)'}}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Search className="w-5 h-5" style={{color: 'var(--color-muted)'}} />
          <input
            type="text"
            placeholder="搜索简历..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 outline-none bg-transparent text-sm"
            style={{color: 'var(--color-ink)'}}
          />
        </motion.div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            icon={FileStack}
            label="简历总数"
            value={stats.totalCount}
            color="var(--color-primary)"
          />
          <StatCard
            icon={MessageSquare}
            label="面试总数"
            value={stats.totalInterviewCount}
            color="#6366f1"
          />
          <StatCard
            icon={Eye}
            label="总访问次数"
            value={stats.totalAccessCount}
            color="#10b981"
          />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin" style={{color: 'var(--color-primary)'}} />
        </div>
      )}

      {/* Empty */}
      {!loading && filteredResumes.length === 0 && (
        <motion.div
          className="card-container text-center py-20"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <FileText className="w-16 h-16 mx-auto mb-4" style={{color: 'var(--color-muted-soft)'}} />
          <h3 className="text-xl font-semibold mb-2" style={{color: 'var(--color-body-text)'}}>暂无简历记录</h3>
          <p style={{color: 'var(--color-muted)'}}>上传简历开始您的第一次 AI 面试分析</p>
        </motion.div>
      )}

      {/* Table */}
      {!loading && filteredResumes.length > 0 && (
        <motion.div
          className="table-container"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <table className="w-full">
            <thead>
              <tr style={{backgroundColor: 'var(--color-surface-soft)', borderBottom: '1px solid var(--color-hairline)'}}>
                <th className="text-left px-6 py-4 text-sm font-medium" style={{color: 'var(--color-muted)'}}>名称</th>
                <th className="text-left px-6 py-4 text-sm font-medium" style={{color: 'var(--color-muted)'}}>大小</th>
                <th className="text-left px-6 py-4 text-sm font-medium" style={{color: 'var(--color-muted)'}}>分析状态</th>
                <th className="text-left px-6 py-4 text-sm font-medium" style={{color: 'var(--color-muted)'}}>AI 评分</th>
                <th className="text-left px-6 py-4 text-sm font-medium" style={{color: 'var(--color-muted)'}}>面试</th>
                <th className="text-left px-6 py-4 text-sm font-medium" style={{color: 'var(--color-muted)'}}>上传时间</th>
                <th className="text-right px-6 py-4 text-sm font-medium" style={{color: 'var(--color-muted)'}}>操作</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {filteredResumes.map((resume, index) => (
                  <motion.tr
                    key={resume.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => onSelectResume(resume.id)}
                    className="group cursor-pointer transition-colors"
                    style={{borderBottom: '1px solid var(--color-hairline-soft)'}}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-soft)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5" style={{color: 'var(--color-muted-soft)'}} />
                        <div>
                          <p className="font-medium" style={{color: 'var(--color-ink)'}}>{resume.filename}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm" style={{color: 'var(--color-body-text)'}}>
                      {formatFileSize(resume.fileSize)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <StatusIcon status={resume.analyzeStatus} hasScore={resume.latestScore !== undefined} />
                        <span className="text-sm" style={{color: 'var(--color-body-text)'}}>
                          {getStatusText(resume.analyzeStatus, resume.latestScore !== undefined)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {resume.latestScore !== undefined ? (
                        <div className="flex items-center gap-3">
                          <div className="w-16 h-2 rounded-full overflow-hidden" style={{backgroundColor: 'var(--color-hairline)'}}>
                            <motion.div
                              className={`h-full ${getScoreColor(resume.latestScore).split(' ')[0]} rounded-full`}
                              initial={{ width: 0 }}
                              animate={{ width: `${resume.latestScore}%` }}
                              transition={{ duration: 0.8, delay: index * 0.05 }}
                            />
                          </div>
                          <span className="font-bold" style={{color: 'var(--color-ink)'}}>{resume.latestScore}</span>
                        </div>
                      ) : (
                        <span style={{color: 'var(--color-muted-soft)'}}>-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {resume.interviewCount > 0 ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium" style={{backgroundColor: 'rgba(16,185,129,0.1)', color: '#10b981'}}>
                          <CheckCircle2 className="w-4 h-4" />
                          {resume.interviewCount} 次
                        </span>
                      ) : (
                        <span className="inline-flex px-3 py-1 rounded-full text-sm" style={{backgroundColor: 'var(--color-surface-card)', color: 'var(--color-muted)'}}>待面试</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm" style={{color: 'var(--color-muted)'}}>
                      {formatDate(resume.uploadedAt)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {resume.storageUrl && (
                          <button
                            onClick={(e) => handleDownload(resume, e)}
                            className="p-2 rounded-lg transition-colors"
                            style={{color: 'var(--color-muted)'}}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-primary)'; (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-soft)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-muted)'; (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                            title="下载"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        )}
                        {resume.analyzeStatus === 'FAILED' && (
                          <button
                            onClick={(e) => handleReanalyze(resume.id, e)}
                            disabled={reanalyzingId === resume.id}
                            className="p-2 rounded-lg transition-colors disabled:opacity-50"
                            style={{color: 'var(--color-muted)'}}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-primary)'; (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-soft)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-muted)'; (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                            title="重新分析"
                          >
                            <RefreshCw className={`w-4 h-4 ${reanalyzingId === resume.id ? 'animate-spin' : ''}`} />
                          </button>
                        )}
                        <button
                          onClick={(e) => handleDeleteClick(resume, e)}
                          disabled={deletingId === resume.id}
                          className="p-2 rounded-lg transition-colors disabled:opacity-50"
                          style={{color: 'var(--color-muted)'}}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-error)'; (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(198,69,69,0.08)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-muted)'; (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <ChevronRight className="w-5 h-5 flex-shrink-0 transition-all" style={{color: 'var(--color-hairline)'}} />
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </motion.div>
      )}

      <DeleteConfirmDialog
        open={deleteItem !== null}
        item={deleteItem ? { id: deleteItem.id, name: deleteItem.filename } : null}
        itemType="简历"
        loading={deletingId !== null}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteItem(null)}
      />
    </motion.div>
  );
}
