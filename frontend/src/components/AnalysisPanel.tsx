import {useMemo} from 'react';
import {motion} from 'framer-motion';
import RadarChart from './RadarChart';
import ScoreProgressBar from './ScoreProgressBar';
import {formatDateTime} from '../utils/date';
import {AlertCircle, CheckCircle2, Clock, Download, Loader2, RefreshCw, Target, TrendingUp,} from 'lucide-react';
import type {AnalyzeStatus} from '../api/history';

interface AnalysisPanelProps {
  analysis: any;
  analyzeStatus?: AnalyzeStatus;
  analyzeError?: string;
  onExport: () => void;
  exporting: boolean;
  onReanalyze?: () => void;
  reanalyzing?: boolean;
}

export default function AnalysisPanel({
  analysis,
  analyzeStatus,
  analyzeError,
  onExport,
  exporting,
  onReanalyze,
  reanalyzing,
}: AnalysisPanelProps) {
  const radarData = useMemo(() => {
    if (!analysis) return [];
    return [
      { subject: '表达专业性', score: analysis.expressionScore || 0, fullMark: 10 },
      { subject: '技能匹配', score: analysis.skillMatchScore || 0, fullMark: 20 },
      { subject: '内容完整性', score: analysis.contentScore || 0, fullMark: 15 },
      { subject: '结构清晰度', score: analysis.structureScore || 0, fullMark: 15 },
      { subject: '项目经验', score: analysis.projectScore || 0, fullMark: 40 },
    ];
  }, [analysis]);

  const suggestionsByPriority = useMemo(() => {
    if (!analysis?.suggestions) return { high: [], medium: [], low: [] };
    const suggestions = analysis.suggestions;
    return {
      high: suggestions.filter((s: any) => s.priority === '高'),
      medium: suggestions.filter((s: any) => s.priority === '中'),
      low: suggestions.filter((s: any) => s.priority === '低')
    };
  }, [analysis]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case '高': return { backgroundColor: 'rgba(198,69,69,0.08)', borderColor: 'rgba(198,69,69,0.2)', color: 'var(--color-error)' };
      case '中': return { backgroundColor: 'rgba(212,160,23,0.08)', borderColor: 'rgba(212,160,23,0.2)', color: 'var(--color-warning)' };
      case '低': return { backgroundColor: 'rgba(204,120,92,0.08)', borderColor: 'rgba(204,120,92,0.2)', color: 'var(--color-primary)' };
      default: return { backgroundColor: 'var(--color-surface-soft)', borderColor: 'var(--color-hairline)', color: 'var(--color-body-text)' };
    }
  };

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case '高': return { backgroundColor: 'var(--color-error)', color: 'white' };
      case '中': return { backgroundColor: 'var(--color-warning)', color: 'white' };
      case '低': return { backgroundColor: 'var(--color-primary)', color: 'white' };
      default: return { backgroundColor: 'var(--color-muted)', color: 'white' };
    }
  };

  const hasErrorKeywords = analysis?.summary && (
    analysis.summary.includes('I/O error') ||
    analysis.summary.includes('分析过程中出现错误') ||
    analysis.summary.includes('简历分析失败') ||
    analysis.summary.includes('Remote host terminated') ||
    analysis.summary.includes('handshake')
  );
  const isAnalysisValid = analysis && analysis.overallScore >= 10 && analysis.summary && !hasErrorKeywords;
  const isProcessing = analyzeStatus === 'PENDING' || analyzeStatus === 'PROCESSING' || (analyzeStatus === undefined && !analysis);

  if (isProcessing) {
    const isExplicitProcessing = analyzeStatus === 'PROCESSING';
    return (
      <div className="card-container p-12 text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center" style={{backgroundColor: 'var(--color-surface-soft)'}}>
          {isExplicitProcessing ? (
            <Loader2 className="w-8 h-8 animate-spin" style={{color: 'var(--color-primary)'}}/>
          ) : (
            <Clock className="w-8 h-8" style={{color: 'var(--color-warning)'}}/>
          )}
        </div>
        <h3 className="text-xl font-semibold mb-2" style={{color: 'var(--color-body-text)'}}>
          {isExplicitProcessing ? 'AI 正在分析中...' : '等待分析'}
        </h3>
        <p className="mb-4" style={{color: 'var(--color-muted)'}}>
          {isExplicitProcessing ? '请稍候，AI 正在对您的简历进行深度分析' : '简历已上传成功，即将开始 AI 分析'}
        </p>
        <p className="text-sm" style={{color: 'var(--color-muted-soft)'}}>页面将自动刷新显示分析结果</p>
      </div>
    );
  }

  if (analyzeStatus === 'FAILED' || !isAnalysisValid) {
    return (
      <div className="card-container p-12 text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center" style={{backgroundColor: 'rgba(198,69,69,0.1)'}}>
          <AlertCircle className="w-8 h-8" style={{color: 'var(--color-error)'}}/>
        </div>
        <h3 className="text-xl font-semibold mb-2" style={{color: 'var(--color-body-text)'}}>分析失败</h3>
        <p className="mb-4" style={{color: 'var(--color-muted)'}}>AI 服务暂时不可用，请稍后重试</p>
        {(analyzeError || analysis?.summary) && (
          <div className="mt-4 p-4 rounded-lg text-left mb-4" style={{backgroundColor: 'rgba(198,69,69,0.08)', border: '1px solid rgba(198,69,69,0.2)'}}>
            <p className="text-sm" style={{color: 'var(--color-error)'}}>{analyzeError || analysis.summary}</p>
          </div>
        )}
        {onReanalyze && (
          <motion.button
            onClick={onReanalyze}
            disabled={reanalyzing}
            className="px-6 py-2.5 rounded-lg font-medium text-white transition-colors disabled:opacity-50 flex items-center gap-2 mx-auto"
            style={{backgroundColor: 'var(--color-primary)'}}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <RefreshCw className={`w-4 h-4 ${reanalyzing ? 'animate-spin' : ''}`} />
            {reanalyzing ? '重新分析中...' : '重新分析'}
          </motion.button>
        )}
      </div>
    );
  }

  const projectScore = analysis.projectScore || 0;
  const skillMatchScore = analysis.skillMatchScore || 0;
  const contentScore = analysis.contentScore || 0;
  const structureScore = analysis.structureScore || 0;
  const expressionScore = analysis.expressionScore || 0;

  return (
    <div className="space-y-6">
      {/* 核心评价和雷达图 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div className="card-container p-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2" style={{color: 'var(--color-muted)'}}>
              <TrendingUp className="w-5 h-5" />
              <span className="font-semibold">核心评价</span>
            </div>
            <motion.button
              onClick={onExport}
              disabled={exporting}
              className="px-4 py-2 border rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-2"
              style={{borderColor: 'var(--color-hairline)', backgroundColor: 'var(--color-canvas)', color: 'var(--color-body-text)'}}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Download className="w-4 h-4" />
              {exporting ? '导出中...' : '导出分析报告'}
            </motion.button>
          </div>

          <div className="rounded-lg p-6" style={{backgroundColor: 'var(--color-surface-soft)'}}>
            <p className="text-lg leading-relaxed mb-6" style={{color: 'var(--color-ink)'}}>
              {analysis.summary || '候选人具备扎实的技术基础，有大型项目架构经验。'}
            </p>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="rounded-lg p-5" style={{backgroundColor: 'var(--color-surface-card)'}}>
                <span className="text-sm font-semibold block mb-2" style={{color: 'var(--color-primary)'}}>总分</span>
                <span className="text-4xl font-bold" style={{color: 'var(--color-ink)', fontFamily: 'var(--font-display)'}}>{analysis.overallScore || 0}</span>
                <span className="text-sm" style={{color: 'var(--color-muted)'}}>/ 100</span>
              </div>
              <div className="rounded-lg p-5" style={{backgroundColor: 'var(--color-surface-card)'}}>
                <span className="text-sm font-semibold block mb-2" style={{color: 'var(--color-primary)'}}>分析时间</span>
                <span className="text-sm" style={{color: 'var(--color-body-text)'}}>
                  {formatDateTime(analysis.analyzedAt)}
                </span>
              </div>
            </div>

            {analysis.strengths && analysis.strengths.length > 0 && (
              <div className="rounded-lg p-4" style={{backgroundColor: 'var(--color-surface-card)'}}>
                <span className="text-sm font-semibold block mb-3" style={{color: 'var(--color-primary)'}}>优势亮点</span>
                <div className="flex flex-wrap gap-2">
                  {analysis.strengths.map((s: string, i: number) => (
                    <span key={i} className="px-3 py-1.5 rounded-lg text-sm font-medium"
                      style={{backgroundColor: 'var(--color-surface-soft)', color: 'var(--color-primary)', border: '1px solid var(--color-hairline)'}}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>

        <motion.div className="card-container p-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="flex items-center gap-2 mb-6" style={{color: 'var(--color-muted)'}}>
            <Target className="w-5 h-5" />
            <span className="font-semibold">多维度评分</span>
          </div>
          <RadarChart data={radarData} height={320} />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <ScoreProgressBar label="项目经验" score={projectScore} maxScore={40} color="#8b5cf6" delay={0.3} className="col-span-2" />
            <ScoreProgressBar label="技能匹配" score={skillMatchScore} maxScore={20} color="#3b82f6" delay={0.4} />
            <ScoreProgressBar label="内容完整性" score={contentScore} maxScore={15} color="#10b981" delay={0.5} />
            <ScoreProgressBar label="结构清晰度" score={structureScore} maxScore={15} color="#06b6d4" delay={0.6} />
            <ScoreProgressBar label="表达专业性" score={expressionScore} maxScore={10} color="#f97316" delay={0.7} />
          </div>
        </motion.div>
      </div>

      {/* 改进建议 */}
      <motion.div className="card-container p-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <div className="flex items-center gap-2 mb-6" style={{color: 'var(--color-muted)'}}>
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-semibold">改进建议</span>
          <span className="text-sm" style={{color: 'var(--color-muted-soft)'}}>
            ({analysis.suggestions?.length || 0} 条)
          </span>
        </div>

        <div className="space-y-6">
          {suggestionsByPriority.high.length > 0 && (
            <SuggestionSection priority="高" suggestions={suggestionsByPriority.high} getPriorityColor={getPriorityColor} getPriorityBadgeColor={getPriorityBadgeColor} delay={0.4} />
          )}
          {suggestionsByPriority.medium.length > 0 && (
            <SuggestionSection priority="中" suggestions={suggestionsByPriority.medium} getPriorityColor={getPriorityColor} getPriorityBadgeColor={getPriorityBadgeColor} delay={0.5} />
          )}
          {suggestionsByPriority.low.length > 0 && (
            <SuggestionSection priority="低" suggestions={suggestionsByPriority.low} getPriorityColor={getPriorityColor} getPriorityBadgeColor={getPriorityBadgeColor} delay={0.6} />
          )}
          {analysis.suggestions?.length === 0 && (
            <div className="text-center py-8" style={{color: 'var(--color-muted)'}}>暂无改进建议</div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function SuggestionSection({
  priority,
  suggestions,
  getPriorityColor,
  getPriorityBadgeColor,
  delay
}: {
  priority: string;
  suggestions: any[];
  getPriorityColor: (p: string) => React.CSSProperties;
  getPriorityBadgeColor: (p: string) => React.CSSProperties;
  delay: number;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <span className="px-3 py-1 rounded-full text-sm font-semibold" style={getPriorityBadgeColor(priority)}>
          {priority}优先级 ({suggestions.length})
        </span>
        <div className="flex-1 h-px" style={{backgroundColor: 'var(--color-hairline)'}}></div>
      </div>
      <div className="space-y-3">
        {suggestions.map((s: any, i: number) => (
          <motion.div
            key={`${priority}-${i}`}
            className="p-4 rounded-lg border"
            style={{...getPriorityColor(priority), borderWidth: '1px', borderStyle: 'solid'}}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: delay + i * 0.1 }}
          >
            <div className="flex items-start gap-3 mb-2">
              <span className="px-2 py-0.5 rounded text-xs font-semibold" style={getPriorityBadgeColor(priority)}>
                {priority}
              </span>
              <span className="px-2 py-0.5 rounded text-xs font-medium" style={{backgroundColor: 'var(--color-surface-card)', color: 'var(--color-body-text)'}}>
                {s.category || '其他'}
              </span>
            </div>
            <div className="mb-2">
              <p className="font-semibold mb-1" style={{color: 'var(--color-ink)'}}>{s.issue || '问题描述'}</p>
              <p className="text-sm leading-relaxed" style={{color: 'var(--color-body-text)'}}>{s.recommendation || s}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
