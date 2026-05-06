import {useCallback, useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {AnimatePresence, motion} from 'framer-motion';
import {AlertCircle, CheckCircle, Clock, FileStack, FileText, RefreshCw, Search, Sparkles, Upload} from 'lucide-react';
import {historyApi, ResumeListItem} from '../api/history';
import DeleteConfirmDialog from '../components/DeleteConfirmDialog';
import {formatDateOnly} from '../utils/date';
import {getScoreProgressColor} from '../utils/score';
import {ROUTES} from '../constants/routes';

interface HistoryListProps {
  onSelectResume: (id: number) => void;
}

function isAnalyzing(status?: string): boolean {
  return status === 'PENDING' || status === 'PROCESSING';
}

function AnalyzeStatusIcon({status}: { status?: string }) {
  if (status === 'FAILED') return <AlertCircle className="w-4 h-4" style={{color: 'var(--color-error)'}}/>;
  if (isAnalyzing(status)) return <RefreshCw className="w-4 h-4 animate-spin" style={{color: 'var(--color-primary)'}}/>;
  if (status === 'COMPLETED') return <CheckCircle className="w-4 h-4" style={{color: 'var(--color-success)'}}/>;
  return <Clock className="w-4 h-4" style={{color: 'var(--color-warning)'}}/>;
}

function getAnalyzeStatusText(status?: string): string {
  if (status === 'FAILED') return '分析失败';
  if (status === 'PROCESSING') return '分析中';
  if (status === 'PENDING') return '等待分析';
  if (status === 'COMPLETED') return '分析完成';
  return '待分析';
}

function resumesEqual(a: ResumeListItem[], b: ResumeListItem[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id ||
      a[i].analyzeStatus !== b[i].analyzeStatus ||
      a[i].latestScore !== b[i].latestScore) return false;
  }
  return true;
}

export default function HistoryList({onSelectResume}: HistoryListProps) {
  const navigate = useNavigate();
  const [resumes, setResumes] = useState<ResumeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; filename: string } | null>(null);

  const loadResumes = useCallback(async (isPolling = false) => {
    if (!isPolling) setLoading(true);
    try {
      const data = await historyApi.getResumes();
      setResumes(prev => {
        if (isPolling && resumesEqual(prev, data)) return prev;
        return data;
      });
    } catch (err) {
      console.error('加载历史记录失败', err);
    } finally {
      if (!isPolling) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadResumes();
  }, [loadResumes]);

  const hasAnalyzing = resumes.some(r => isAnalyzing(r.analyzeStatus));

  useEffect(() => {
    if (!hasAnalyzing) return;
    const id = window.setInterval(() => loadResumes(true), 3000);
    return () => clearInterval(id);
  }, [hasAnalyzing, loadResumes]);

  const handleDeleteClick = (id: number, filename: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirm({id, filename});
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    const {id} = deleteConfirm;
    setDeletingId(id);
    try {
      await historyApi.deleteResume(id);
      await loadResumes();
      setDeleteConfirm(null);
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
      initial={{opacity: 0}}
      animate={{opacity: 1}}
    >
      {/* 头部 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="page-title flex items-center gap-2.5">
            <FileStack className="w-5 h-5" style={{color: 'var(--color-primary)'}}/>
            简历管理
          </h1>
          <p className="page-subtitle">管理您的简历，AI 智能分析与评分</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(ROUTES.resumeUpload)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
            style={{backgroundColor: 'var(--color-primary)'}}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-primary-active)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-primary)'; }}
          >
            <Upload className="w-4 h-4"/>
            上传简历
          </button>
          <button
            onClick={() => navigate('/interview-hub')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors"
            style={{
              backgroundColor: 'var(--color-canvas)',
              color: 'var(--color-body-text)',
              borderColor: 'var(--color-hairline)',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-soft)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-canvas)'; }}
          >
            <Sparkles className="w-4 h-4"/>
            模拟面试
          </button>
        </div>
      </div>

      {/* 搜索栏 */}
      <div className="mb-5">
        <div
          className="flex items-center gap-2.5 border rounded-lg px-3 py-2 max-w-sm transition-all"
          style={{
            backgroundColor: 'var(--color-surface-card)',
            borderColor: 'var(--color-hairline)',
          }}
        >
          <Search className="w-4 h-4" style={{color: 'var(--color-muted-soft)'}}/>
          <input
            type="text"
            placeholder="搜索简历..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 outline-none text-sm bg-transparent"
            style={{color: 'var(--color-ink)'}}
          />
        </div>
      </div>

      {/* 加载状态 */}
      {loading && (
        <div className="text-center py-20">
          <motion.div
            className="w-8 h-8 border-2 rounded-full mx-auto mb-4"
            style={{borderColor: 'var(--color-hairline)', borderTopColor: 'var(--color-primary)'}}
            animate={{rotate: 360}}
            transition={{duration: 1, repeat: Infinity, ease: "linear"}}
          />
          <p className="text-sm" style={{color: 'var(--color-muted)'}}>加载中...</p>
        </div>
      )}

      {/* 空状态 */}
      {!loading && filteredResumes.length === 0 && (
        <motion.div
          className="empty-state"
          initial={{opacity: 0, scale: 0.97}}
          animate={{opacity: 1, scale: 1}}
        >
          <div
            className="w-14 h-14 mx-auto mb-4 rounded-lg flex items-center justify-center"
            style={{backgroundColor: 'var(--color-surface-soft)'}}
          >
            <FileText className="w-7 h-7" style={{color: 'var(--color-muted-soft)'}}/>
          </div>
          <h3 className="text-base font-semibold mb-1.5" style={{color: 'var(--color-body-text)'}}>暂无简历记录</h3>
          <p className="text-sm" style={{color: 'var(--color-muted)'}}>上传简历开始您的第一次 AI 面试分析</p>
        </motion.div>
      )}

      {/* 表格 */}
      {!loading && filteredResumes.length > 0 && (
        <motion.div
          className="table-container"
          initial={{opacity: 0, y: 12}}
          animate={{opacity: 1, y: 0}}
          transition={{delay: 0.15}}
        >
          <table className="w-full">
            <thead>
            <tr style={{backgroundColor: 'var(--color-surface-soft)', borderBottom: '1px solid var(--color-hairline)'}}>
              <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{color: 'var(--color-muted)'}}>简历名称</th>
              <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{color: 'var(--color-muted)'}}>上传日期</th>
              <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{color: 'var(--color-muted)'}}>分析状态</th>
              <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{color: 'var(--color-muted)'}}>AI 评分</th>
              <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{color: 'var(--color-muted)'}}>面试状态</th>
              <th className="w-16"></th>
            </tr>
            </thead>
            <tbody>
            <AnimatePresence>
              {filteredResumes.map((resume, index) => (
                <motion.tr
                  key={resume.id}
                  initial={{opacity: 0, x: -12}}
                  animate={{opacity: 1, x: 0}}
                  transition={{delay: index * 0.03}}
                  onClick={() => onSelectResume(resume.id)}
                  className="group cursor-pointer transition-colors"
                  style={{borderBottom: '1px solid var(--color-hairline-soft)'}}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-soft)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center"
                        style={{backgroundColor: 'var(--color-surface-card)', color: 'var(--color-primary)'}}
                      >
                        <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none">
                          <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <span className="text-sm font-medium" style={{color: 'var(--color-ink)'}}>{resume.filename}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm" style={{color: 'var(--color-muted)'}}>{formatDateOnly(resume.uploadedAt)}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <AnalyzeStatusIcon status={resume.analyzeStatus}/>
                      <span className="text-sm" style={{color: 'var(--color-body-text)'}}>
                        {getAnalyzeStatusText(resume.analyzeStatus)}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {resume.analyzeStatus === 'COMPLETED' && resume.latestScore !== undefined ? (
                      <div className="flex items-center gap-2.5">
                        <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{backgroundColor: 'var(--color-hairline)'}}>
                          <motion.div
                            className={`h-full ${getScoreProgressColor(resume.latestScore)} rounded-full`}
                            initial={{width: 0}}
                            animate={{width: `${resume.latestScore}%`}}
                            transition={{duration: 0.6, delay: index * 0.03}}
                          />
                        </div>
                        <span className="text-sm font-semibold tabular-nums" style={{color: 'var(--color-ink)'}}>{resume.latestScore}</span>
                      </div>
                    ) : isAnalyzing(resume.analyzeStatus) ? (
                      <span className="text-sm" style={{color: 'var(--color-primary)'}}>生成中...</span>
                    ) : resume.analyzeStatus === 'FAILED' ? (
                      <span className="text-sm" style={{color: 'var(--color-error)'}} title={resume.analyzeError}>失败</span>
                    ) : (
                      <span className="text-sm" style={{color: 'var(--color-muted-soft)'}}>-</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {resume.interviewCount > 0 ? (
                      <span className="badge-completed">
                        <CheckCircle className="w-3.5 h-3.5"/>
                        已完成
                      </span>
                    ) : (
                      <span className="badge-pending">待面试</span>
                    )}
                  </td>
                  <td className="px-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => handleDeleteClick(resume.id, resume.filename, e)}
                        disabled={deletingId === resume.id}
                        className="p-1.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{color: 'var(--color-muted-soft)'}}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-error)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-muted-soft)'; }}
                        title="删除简历"
                      >
                        {deletingId === resume.id ? (
                          <motion.div
                            className="w-4 h-4 border-2 rounded-full"
                            style={{borderColor: 'var(--color-error)', borderTopColor: 'transparent'}}
                            animate={{rotate: 360}}
                            transition={{duration: 1, repeat: Infinity, ease: "linear"}}
                          />
                        ) : (
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                            <path d="M3 6H5H21M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z"
                              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M10 11V17M14 11V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </button>
                      <svg className="arrow-icon" viewBox="0 0 24 24" fill="none">
                        <polyline points="9,18 15,12 9,6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
            </tbody>
          </table>
        </motion.div>
      )}

      {/* 删除确认对话框 */}
      <DeleteConfirmDialog
        open={deleteConfirm !== null}
        item={deleteConfirm}
        itemType="简历"
        loading={deletingId !== null}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirm(null)}
        customMessage={
          deleteConfirm ? (
            <>
              <p className="mb-2">确定要删除简历 <strong>"{deleteConfirm.filename}"</strong> 吗？</p>
              <p className="text-xs mb-1.5" style={{color: 'var(--color-muted)'}}>删除后将同时删除：</p>
              <ul className="text-xs list-disc list-inside mb-2" style={{color: 'var(--color-error)'}}>
                <li>简历评价记录</li>
                <li>所有模拟面试记录</li>
              </ul>
              <p className="text-xs font-semibold" style={{color: 'var(--color-error)'}}>此操作不可恢复！</p>
            </>
          ) : undefined
        }
      />
    </motion.div>
  );
}
