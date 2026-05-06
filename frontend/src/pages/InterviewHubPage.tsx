import {useState, useEffect, useCallback} from 'react';
import {useNavigate, Link} from 'react-router-dom';
import {AnimatePresence, motion} from 'framer-motion';
import {
  ChevronDown, ChevronUp, FileStack, FileText, Loader2, Mic,
  MessageSquare, RefreshCw, Sparkles,
} from 'lucide-react';
import {type SkillDTO} from '../api/skill';
import {interviewApi, type TextSessionMeta} from '../api/interview';
import {voiceInterviewApi, type SessionMeta} from '../api/voiceInterview';
import {getSkillIcon} from '../utils/skillIcons';
import {getTemplateName} from '../utils/voiceInterview';
import {getScoreTextColor} from '../utils/score';
import {formatDateTime} from '../utils/date';
import {
  useInterviewConfig,
  CUSTOM_SKILL_ID,
  type InterviewMode,
  DIFFICULTY_OPTIONS,
} from '../hooks/useInterviewConfig';

interface RecentInterviewItem {
  id: string;
  type: 'text' | 'voice';
  title: string;
  status: string;
  evaluateStatus?: string | null;
  overallScore: number | null;
  createdAt: string;
  voiceSessionId?: number;
}

export default function InterviewHubPage() {
  const navigate = useNavigate();
  const config = useInterviewConfig({autoLoad: false});

  const [recentInterviews, setRecentInterviews] = useState<RecentInterviewItem[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  const loadRecentInterviews = useCallback(async (allSkills: SkillDTO[]) => {
    setLoadingRecent(true);
    try {
      const [textSessions, voiceSessions] = await Promise.all([
        interviewApi.listSessions().catch(() => [] as TextSessionMeta[]),
        voiceInterviewApi.getAllSessions().catch(() => [] as SessionMeta[]),
      ]);

      const items: RecentInterviewItem[] = [
        ...textSessions.map(s => ({
          id: s.sessionId,
          type: 'text' as const,
          title: getTemplateName(s.skillId, allSkills),
          status: s.status,
          evaluateStatus: s.evaluateStatus,
          overallScore: s.overallScore,
          createdAt: s.createdAt,
        })),
        ...voiceSessions.map(s => ({
          id: `voice-${s.sessionId}`,
          type: 'voice' as const,
          title: s.roleType || '语音面试',
          status: s.status,
          overallScore: null,
          createdAt: s.createdAt,
          voiceSessionId: s.sessionId,
        })),
      ];

      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRecentInterviews(items.slice(0, 5));
    } catch (err) {
      console.error('Failed to load recent interviews:', err);
    } finally {
      setLoadingRecent(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const [skills] = await Promise.all([config.loadSkills(), config.loadResumes()]);
      await loadRecentInterviews(skills);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStart = () => {
    const selectedSkill = config.selectedSkill;
    const skillName = selectedSkill?.name || '自定义';

    if (config.isCustomStartDisabled) return;

    if (config.mode === 'text') {
      navigate('/interview', {
        state: {
          resumeId: config.resumeId,
          interviewConfig: {
            skillId: config.skillId,
            skillName,
            difficulty: config.difficulty,
            questionCount: config.questionCount,
            llmProvider: config.llmProvider,
            jdText: config.isCustomSkill ? config.parsedCustomJdText : undefined,
            customCategories: config.isCustomSkill ? config.customCategories : undefined,
          },
        },
      });
    } else {
      const params = new URLSearchParams({skillId: config.skillId, difficulty: config.difficulty});
      navigate(`/voice-interview?${params.toString()}`, {
        state: {
          voiceConfig: {
            skillId: config.skillId,
            difficulty: config.difficulty,
            techEnabled: true,
            projectEnabled: true,
            hrEnabled: true,
            plannedDuration: config.plannedDuration,
            resumeId: config.resumeId,
            llmProvider: config.llmProvider,
          },
        },
      });
    }
  };

  const selectStyle = (selected: boolean): React.CSSProperties => ({
    borderColor: selected ? 'var(--color-primary)' : 'var(--color-hairline)',
    backgroundColor: selected ? 'var(--color-surface-soft)' : 'var(--color-surface-card)',
  });

  return (
    <div className="max-w-4xl mx-auto">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="page-title flex items-center gap-2.5">
          <Sparkles className="w-5 h-5" style={{color: 'var(--color-primary)'}}/>
          模拟面试
        </h1>
        <p className="page-subtitle">选择面试模式和方向，快速开始练习</p>
      </div>

      {/* 配置区域 — feature-card style */}
      <div className="card-container p-6 mb-6">
        <div className="space-y-6">
          {/* 面试模式 */}
          <div>
            <label className="block mb-2.5 text-sm font-medium" style={{color: 'var(--color-body-strong)'}}>
              面试模式
            </label>
            <div className="grid grid-cols-2 gap-3">
              {([
                {
                  value: 'text' as InterviewMode,
                  label: '文字面试',
                  icon: FileText,
                  desc: '更稳定，适合系统化刷题与复盘',
                  recommended: true,
                },
                {
                  value: 'voice' as InterviewMode,
                  label: '语音面试',
                  icon: Mic,
                  desc: '实时语音对话，偏临场模拟',
                  recommended: false,
                },
              ]).map(opt => {
                const Icon = opt.icon;
                const selected = config.mode === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => config.setMode(opt.value)}
                    className="flex items-center gap-3 p-3.5 rounded-lg border transition-colors text-left cursor-pointer"
                    style={selectStyle(selected)}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" style={{color: selected ? 'var(--color-primary)' : 'var(--color-muted)'}}/>
                    <div className="min-w-0">
                      <p className="text-sm font-medium flex items-center gap-2" style={{color: selected ? 'var(--color-primary)' : 'var(--color-ink)'}}>
                        <span>{opt.label}</span>
                        {opt.recommended && (
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                            style={{backgroundColor: 'var(--color-surface-card)', color: 'var(--color-success)'}}
                          >
                            推荐
                          </span>
                        )}
                      </p>
                      <p className="text-xs mt-0.5" style={{color: 'var(--color-muted)'}}>{opt.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 面试方向 */}
          <div>
            <label className="block mb-2.5 text-sm font-medium" style={{color: 'var(--color-body-strong)'}}>
              面试方向
            </label>
            {config.loadingSkills ? (
              <div className="flex items-center gap-2 py-3" style={{color: 'var(--color-muted-soft)'}}>
                <Loader2 className="w-4 h-4 animate-spin"/>
                <span className="text-sm">加载中...</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {config.skills.map(skill => {
                  const selected = config.skillId === skill.id;
                  const IconComponent = getSkillIcon(skill.id);
                  const fallbackEmoji = skill.display?.icon || '📋';
                  return (
                    <button
                      key={skill.id}
                      onClick={() => config.setSkillId(skill.id)}
                      className="flex items-center gap-2 p-2.5 rounded-lg border transition-colors text-left cursor-pointer"
                      style={selectStyle(selected)}
                    >
                      <div
                        className="w-7 h-7 rounded flex items-center justify-center text-sm flex-shrink-0"
                        style={{backgroundColor: selected ? 'var(--color-surface-card)' : 'var(--color-surface-soft)'}}
                      >
                        {IconComponent
                          ? <IconComponent className="w-3.5 h-3.5" style={{color: selected ? 'var(--color-primary)' : 'var(--color-muted)'}}/>
                          : <span>{fallbackEmoji}</span>
                        }
                      </div>
                      <span className="text-xs font-medium truncate" style={{color: selected ? 'var(--color-primary)' : 'var(--color-body-text)'}}>
                        {skill.name}
                      </span>
                    </button>
                  );
                })}
                {/* 自定义按钮 */}
                <button
                  onClick={() => config.setSkillId(CUSTOM_SKILL_ID)}
                  className="flex items-center gap-2 p-2.5 rounded-lg border border-dashed transition-colors text-left cursor-pointer"
                  style={{
                    borderColor: config.isCustomSkill ? 'var(--color-primary)' : 'var(--color-hairline)',
                    backgroundColor: config.isCustomSkill ? 'var(--color-surface-soft)' : 'transparent',
                  }}
                >
                  <div
                    className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
                    style={{backgroundColor: config.isCustomSkill ? 'var(--color-surface-card)' : 'var(--color-surface-soft)'}}
                  >
                    {(() => {
                      const CustomIcon = getSkillIcon(CUSTOM_SKILL_ID);
                      return CustomIcon
                        ? <CustomIcon className="w-3.5 h-3.5" style={{color: config.isCustomSkill ? 'var(--color-primary)' : 'var(--color-muted)'}}/>
                        : <span className="text-xs">✨</span>;
                    })()}
                  </div>
                  <span className="text-xs font-medium" style={{color: config.isCustomSkill ? 'var(--color-primary)' : 'var(--color-muted)'}}>
                    自定义 JD
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* 自定义 JD 输入 */}
          <AnimatePresence>
            {config.isCustomSkill && (
              <motion.div
                initial={{height: 0, opacity: 0}}
                animate={{height: 'auto', opacity: 1}}
                exit={{height: 0, opacity: 0}}
                className="overflow-hidden"
              >
                <div
                  className="space-y-3 rounded-lg p-4 border"
                  style={{backgroundColor: 'var(--color-surface-soft)', borderColor: 'var(--color-hairline)'}}
                >
                  <textarea
                    value={config.customJdText}
                    onChange={e => config.setCustomJdText(e.target.value)}
                    placeholder="粘贴目标岗位的职位描述（JD），至少 50 字..."
                    rows={4}
                    className="w-full px-3 py-2.5 rounded-lg border text-sm resize-none focus:outline-none transition-colors"
                    style={{
                      borderColor: 'var(--color-hairline)',
                      backgroundColor: 'var(--color-canvas)',
                      color: 'var(--color-ink)',
                    }}
                    onFocus={e => {
                      (e.target as HTMLElement).style.borderColor = 'var(--color-primary)';
                      (e.target as HTMLElement).style.boxShadow = '0 0 0 3px rgba(204,120,92,0.15)';
                    }}
                    onBlur={e => {
                      (e.target as HTMLElement).style.borderColor = 'var(--color-hairline)';
                      (e.target as HTMLElement).style.boxShadow = 'none';
                    }}
                  />
                  <button
                    onClick={config.handleParseJd}
                    disabled={config.parsingJd || !config.customJdText}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{backgroundColor: 'var(--color-primary)'}}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-primary-active)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-primary)'; }}
                  >
                    {config.parsingJd ? <Loader2 className="w-4 h-4 animate-spin"/> : <Sparkles className="w-4 h-4"/>}
                    解析面试方向
                  </button>
                  {config.customCategories.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {config.customCategories.map((cat, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 text-xs font-medium rounded"
                          style={{backgroundColor: 'var(--color-surface-card)', color: 'var(--color-primary)'}}
                        >
                          {cat.label}
                          <span className="ml-1 text-[10px]" style={{color: 'var(--color-primary)'}}>({cat.priority})</span>
                        </span>
                      ))}
                    </div>
                  )}
                  {config.jdNeedsReparse && (
                    <p className="text-xs" style={{color: 'var(--color-warning)'}}>
                      JD 已修改，请重新解析后再开始面试。
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 难度 */}
          <div>
            <label className="block mb-2.5 text-sm font-medium" style={{color: 'var(--color-body-strong)'}}>
              难度
            </label>
            <div className="grid grid-cols-3 gap-3">
              {DIFFICULTY_OPTIONS.map(opt => {
                const selected = config.difficulty === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => config.setDifficulty(opt.value)}
                    className="py-2.5 px-3 rounded-lg border transition-colors text-center cursor-pointer"
                    style={selectStyle(selected)}
                  >
                    <p className="text-sm font-medium" style={{color: selected ? 'var(--color-primary)' : 'var(--color-body-strong)'}}>
                      {opt.label}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{color: 'var(--color-muted-soft)'}}>{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 更多选项 */}
          <button
            onClick={() => config.setShowMore(!config.showMore)}
            className="w-full flex items-center gap-2 py-1.5 text-sm transition-colors"
            style={{color: 'var(--color-muted-soft)'}}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-muted)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-muted-soft)'; }}
          >
            {config.showMore ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
            <span>更多选项</span>
            <div className="flex-1 border-t" style={{borderColor: 'var(--color-hairline)'}}/>
          </button>

          <AnimatePresence>
            {config.showMore && (
              <motion.div
                initial={{height: 0, opacity: 0}}
                animate={{height: 'auto', opacity: 1}}
                exit={{height: 0, opacity: 0}}
                className="overflow-hidden space-y-4"
              >
                {/* 简历选择 */}
                <div
                  className="rounded-lg p-4 border"
                  style={{backgroundColor: 'var(--color-surface-soft)', borderColor: 'var(--color-hairline)'}}
                >
                  <div className="flex items-center gap-2 mb-2.5">
                    <FileStack className="w-4 h-4" style={{color: 'var(--color-primary)'}}/>
                    <p className="text-sm font-medium" style={{color: 'var(--color-body-strong)'}}>
                      基于简历面试（可选）
                    </p>
                  </div>
                  <select
                    value={config.resumeId || ''}
                    onChange={e => config.setResumeId(e.target.value ? parseInt(e.target.value) : undefined)}
                    className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none transition-colors"
                    style={{
                      borderColor: 'var(--color-hairline)',
                      backgroundColor: 'var(--color-canvas)',
                      color: 'var(--color-ink)',
                    }}
                  >
                    <option value="">不使用简历（通用提问）</option>
                    {config.resumes.map(r => (
                      <option key={r.id} value={r.id}>{r.filename}</option>
                    ))}
                  </select>
                </div>

                {/* 文字面试 - 题目数 */}
                {config.mode === 'text' && (
                  <div>
                    <label className="block mb-2.5 text-sm font-medium" style={{color: 'var(--color-body-strong)'}}>
                      题目数量
                    </label>
                    <div className="flex gap-2">
                      {[6, 8, 10, 12].map(n => (
                        <button
                          key={n}
                          onClick={() => config.setQuestionCount(n)}
                          className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                          style={{
                            backgroundColor: config.questionCount === n ? 'var(--color-primary)' : 'var(--color-surface-card)',
                            color: config.questionCount === n ? 'var(--color-on-primary)' : 'var(--color-body-text)',
                          }}
                        >
                          {n} 题
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 语音面试 - 时长 */}
                {config.mode === 'voice' && (
                  <div
                    className="rounded-lg p-4 border"
                    style={{backgroundColor: 'var(--color-surface-soft)', borderColor: 'var(--color-hairline)'}}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-medium" style={{color: 'var(--color-body-strong)'}}>计划面试时长</p>
                      <div className="text-xl font-semibold tabular-nums" style={{color: 'var(--color-primary)'}}>
                        {config.plannedDuration}
                        <span className="text-xs font-normal ml-0.5" style={{color: 'var(--color-muted-soft)'}}>min</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="15"
                      max="60"
                      step="5"
                      value={config.plannedDuration}
                      onChange={e => config.setPlannedDuration(parseInt(e.target.value))}
                      className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: 'var(--color-hairline)',
                        accentColor: 'var(--color-primary)',
                      }}
                    />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 开始面试按钮 */}
        <div className="mt-6 pt-5 border-t" style={{borderColor: 'var(--color-hairline)'}}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium" style={{color: 'var(--color-body-strong)'}}>准备好了吗？</p>
              <p className="text-xs mt-0.5" style={{color: 'var(--color-muted-soft)'}}>
                {config.mode === 'text' ? '文字面试将逐题作答，系统自动评分' : '语音面试模拟真实对话场景'}
              </p>
            </div>
            <button
              onClick={handleStart}
              disabled={config.isCustomStartDisabled}
              className="btn-cta !w-auto px-6"
            >
              开始{config.mode === 'text' ? '文字' : '语音'}面试
            </button>
          </div>
        </div>
      </div>

      {/* 最近面试记录 — feature-card */}
      <div className="card-container p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" style={{color: 'var(--color-primary)'}}/>
            <h2 className="text-sm font-semibold" style={{color: 'var(--color-ink)'}}>最近面试记录</h2>
          </div>
          {recentInterviews.length > 0 && (
            <Link
              to="/interviews"
              className="text-xs font-medium transition-colors"
              style={{color: 'var(--color-primary)'}}
            >
              查看全部 →
            </Link>
          )}
        </div>

        {loadingRecent ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin" style={{color: 'var(--color-primary)'}}/>
          </div>
        ) : recentInterviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10">
            <MessageSquare className="w-8 h-8 mb-2" style={{color: 'var(--color-muted-soft)'}}/>
            <p className="text-sm" style={{color: 'var(--color-muted)'}}>暂无面试记录，选择方向开始第一次面试吧</p>
          </div>
        ) : (
          <div className="space-y-1">
            {recentInterviews.map((item, index) => {
              const isCompleted = item.evaluateStatus === 'COMPLETED' || item.status === 'EVALUATED';
              const isEvaluating = item.evaluateStatus === 'PENDING' || item.evaluateStatus === 'PROCESSING';
              return (
                <motion.div
                  key={item.id}
                  initial={{opacity: 0, y: 6}}
                  animate={{opacity: 1, y: 0}}
                  transition={{delay: index * 0.03}}
                  onClick={() => {
                    if (item.type === 'text') {
                      navigate(`/interviews/${item.id}`);
                    } else if (item.voiceSessionId) {
                      navigate(`/voice-interview/${item.voiceSessionId}/evaluation`);
                    }
                  }}
                  className="flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer group"
                  style={{backgroundColor: 'transparent'}}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-soft)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                >
                  {/* 类型图标 */}
                  <div
                    className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: item.type === 'text' ? 'var(--color-surface-card)' : 'var(--color-surface-card)',
                      color: item.type === 'text' ? 'var(--color-primary)' : 'var(--color-accent-teal)',
                    }}
                  >
                    {item.type === 'text' ? <FileText className="w-4 h-4"/> : <Mic className="w-4 h-4"/>}
                  </div>

                  {/* 信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate" style={{color: 'var(--color-ink)'}}>{item.title}</span>
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                        style={{
                          backgroundColor: 'var(--color-surface-card)',
                          color: item.type === 'text' ? 'var(--color-primary)' : 'var(--color-accent-teal)',
                        }}
                      >
                        {item.type === 'text' ? '文字' : '语音'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs" style={{color: 'var(--color-muted-soft)'}}>
                        {formatDateTime(item.createdAt)}
                      </span>
                      {isEvaluating && (
                        <span className="flex items-center gap-1 text-xs" style={{color: 'var(--color-primary)'}}>
                          <RefreshCw className="w-3 h-3 animate-spin"/> 评估中
                        </span>
                      )}
                      {isCompleted && item.overallScore !== null && (
                        <span className="text-xs" style={{color: 'var(--color-muted)'}}>
                          得分 <span className={`font-semibold ${getScoreTextColor(item.overallScore!)}`}>{item.overallScore}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 箭头 */}
                  <svg className="w-4 h-4 flex-shrink-0 transition-colors" style={{color: 'var(--color-hairline)'}} viewBox="0 0 24 24" fill="none">
                    <polyline points="9,18 15,12 9,6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
