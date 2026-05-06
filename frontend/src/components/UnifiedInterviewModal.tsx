import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X, Sparkles, FileText, Mic,
  FileStack, ChevronDown, ChevronUp, Loader2
} from 'lucide-react';
import { useInterviewConfig, CUSTOM_SKILL_ID, DIFFICULTY_OPTIONS, type InterviewMode, type Difficulty } from '../hooks/useInterviewConfig';
import { getSkillIcon } from '../utils/skillIcons';

export type { InterviewMode, Difficulty };
export { DIFFICULTY_OPTIONS };

export interface UnifiedInterviewConfig {
  mode: InterviewMode;
  skillId: string;
  skillName: string;
  difficulty: Difficulty;
  resumeId?: number;
  resumeText?: string;
  llmProvider: string;
  questionCount: number;
  techEnabled: boolean;
  projectEnabled: boolean;
  hrEnabled: boolean;
  plannedDuration: number;
  customJdText?: string;
  customCategories?: import('../api/skill').CategoryDTO[];
}

interface UnifiedInterviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (config: UnifiedInterviewConfig) => void;
  defaultMode?: InterviewMode;
  defaultResumeId?: number;
  hideModeSwitch?: boolean;
  title?: string;
  subtitle?: string;
  startButtonText?: string;
}

export default function UnifiedInterviewModal({
  isOpen,
  onClose,
  onStart,
  defaultMode = 'text',
  defaultResumeId,
  hideModeSwitch = false,
  title = '开始模拟面试',
  subtitle = '选择面试模式和主题，快速开始',
  startButtonText = '开始面试',
}: UnifiedInterviewModalProps) {
  const config = useInterviewConfig({ defaultMode, defaultResumeId, autoLoad: false });

  useEffect(() => {
    if (isOpen) {
      config.setMode(defaultMode);
      if (defaultResumeId != null) {
        config.setResumeId(defaultResumeId);
        config.setShowMore(true);
      }
      config.loadSkills();
      config.loadResumes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, defaultMode, defaultResumeId]);

  const handleStart = () => {
    const selectedSkill = config.selectedSkill;

    if (config.isCustomStartDisabled) {
      return;
    }

    onStart({
      mode: config.mode,
      skillId: config.skillId,
      skillName: selectedSkill?.name || '自定义',
      difficulty: config.difficulty,
      resumeId: config.resumeId,
      llmProvider: config.llmProvider,
      questionCount: config.questionCount,
      techEnabled: true,
      projectEnabled: true,
      hrEnabled: true,
      plannedDuration: config.plannedDuration,
      customJdText: config.isCustomSkill ? config.parsedCustomJdText : undefined,
      customCategories: config.isCustomSkill ? config.customCategories : undefined,
    });
  };

  const selectStyle = (selected: boolean): React.CSSProperties => ({
    borderColor: selected ? 'var(--color-primary)' : 'var(--color-hairline)',
    backgroundColor: selected ? 'rgba(204,120,92,0.08)' : 'var(--color-surface-card)',
  });

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50"
            style={{backgroundColor: 'rgba(20,20,19,0.5)'}}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              style={{backgroundColor: 'var(--color-surface-card)'}}
            >
              {/* Header */}
              <div className="px-6 py-5 border-b" style={{borderColor: 'var(--color-hairline)'}}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{backgroundColor: 'var(--color-primary)'}}>
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold" style={{color: 'var(--color-ink)', fontFamily: 'var(--font-display)'}}>
                        {title}
                      </h2>
                      <p className="text-xs" style={{color: 'var(--color-muted)'}}>
                        {subtitle}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-lg transition-colors"
                    style={{color: 'var(--color-muted)'}}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-soft)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="px-6 py-5 space-y-5">
                {!hideModeSwitch && (
                  <div>
                    <label className="flex items-center gap-2 mb-3 text-sm font-semibold" style={{color: 'var(--color-body-text)'}}>
                      面试模式
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        {
                          value: 'text' as InterviewMode,
                          label: '文字面试',
                          icon: FileText,
                          desc: '推荐：更稳定，更适合系统化练习',
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
                            className="flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 text-left"
                            style={selectStyle(selected)}
                          >
                            <Icon className="w-5 h-5 flex-shrink-0" style={{color: selected ? 'var(--color-primary)' : 'var(--color-muted)'}} />
                            <div className="min-w-0">
                              <p className="font-semibold text-sm flex items-center gap-2" style={{color: selected ? 'var(--color-primary)' : 'var(--color-ink)'}}>
                                <span>{opt.label}</span>
                                {opt.recommended && (
                                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold" style={{backgroundColor: 'rgba(16,185,129,0.1)', color: '#10b981'}}>
                                    推荐
                                  </span>
                                )}
                              </p>
                              <p className="text-[11px]" style={{color: 'var(--color-muted)'}}>{opt.desc}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Skills */}
                <div>
                  <label className="flex items-center gap-2 mb-3 text-sm font-semibold" style={{color: 'var(--color-body-text)'}}>
                    面试方向
                  </label>
                  {config.loadingSkills ? (
                    <div className="flex items-center gap-2 py-4" style={{color: 'var(--color-muted)'}}>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">加载中...</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {config.skills.map(skill => {
                        const selected = config.skillId === skill.id;
                        const IconComponent = getSkillIcon(skill.id);
                        const fallbackEmoji = skill.display?.icon || '📋';
                        return (
                          <button
                            key={skill.id}
                            onClick={() => config.setSkillId(skill.id)}
                            className="flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 text-left"
                            style={selectStyle(selected)}
                          >
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                              style={{backgroundColor: selected ? 'rgba(204,120,92,0.12)' : 'var(--color-surface-soft)'}}>
                              {IconComponent
                                ? <IconComponent className="w-5 h-5" style={{color: selected ? 'var(--color-primary)' : 'var(--color-muted)'}} />
                                : <span>{fallbackEmoji}</span>
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-medium block truncate" style={{color: selected ? 'var(--color-primary)' : 'var(--color-body-text)'}}>
                                {skill.name}
                              </span>
                              <span className="text-[10px] truncate block" style={{color: 'var(--color-muted-soft)'}}>
                                {skill.description}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                      <button
                        onClick={() => config.setSkillId(CUSTOM_SKILL_ID)}
                        className="flex items-center gap-3 p-3 rounded-lg border border-dashed transition-all duration-200 text-left"
                        style={selectStyle(config.isCustomSkill)}
                      >
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{backgroundColor: config.isCustomSkill ? 'rgba(204,120,92,0.12)' : 'var(--color-surface-soft)'}}>
                          {(() => {
                            const CustomIcon = getSkillIcon(CUSTOM_SKILL_ID);
                            return CustomIcon
                              ? <CustomIcon className="w-5 h-5" style={{color: config.isCustomSkill ? 'var(--color-primary)' : 'var(--color-muted)'}} />
                              : <span className="text-base">✨</span>;
                          })()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium block" style={{color: config.isCustomSkill ? 'var(--color-primary)' : 'var(--color-muted)'}}>
                            自定义 JD
                          </span>
                        </div>
                      </button>
                    </div>
                  )}
                </div>

                {/* Custom JD */}
                <AnimatePresence>
                  {config.isCustomSkill && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-3 rounded-lg p-4 border" style={{backgroundColor: 'rgba(204,120,92,0.04)', borderColor: 'rgba(204,120,92,0.15)'}}>
                        <textarea
                          value={config.customJdText}
                          onChange={e => config.setCustomJdText(e.target.value)}
                          placeholder="粘贴目标岗位的职位描述（JD），至少 50 字..."
                          rows={4}
                          className="w-full px-4 py-3 rounded-lg border text-sm resize-none focus:outline-none"
                          style={{borderColor: 'var(--color-hairline)', backgroundColor: 'var(--color-surface-card)', color: 'var(--color-ink)'}}
                        />
                        <button
                          onClick={config.handleParseJd}
                          disabled={config.parsingJd || !config.customJdText}
                          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          style={{backgroundColor: 'var(--color-primary)'}}
                        >
                          {config.parsingJd ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                          解析面试方向
                        </button>
                        {config.customCategories.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {config.customCategories.map((cat, i) => (
                              <span
                                key={i}
                                className="px-3 py-1 text-xs font-medium rounded-full"
                                style={{backgroundColor: 'rgba(204,120,92,0.1)', color: 'var(--color-primary)'}}
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

                {/* Difficulty */}
                <div>
                  <label className="flex items-center gap-2 mb-3 text-sm font-semibold" style={{color: 'var(--color-body-text)'}}>
                    难度
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {DIFFICULTY_OPTIONS.map(opt => {
                      const selected = config.difficulty === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => config.setDifficulty(opt.value)}
                          className="py-2.5 px-3 rounded-lg border transition-all duration-200 text-center"
                          style={selectStyle(selected)}
                        >
                          <p className="text-sm font-semibold" style={{color: selected ? 'var(--color-primary)' : 'var(--color-body-text)'}}>
                            {opt.label}
                          </p>
                          <p className="text-[11px]" style={{color: 'var(--color-muted)'}}>{opt.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* More options */}
                <button
                  onClick={() => config.setShowMore(!config.showMore)}
                  className="w-full flex items-center gap-2 py-2 text-sm transition-colors"
                  style={{color: 'var(--color-muted)'}}
                >
                  {config.showMore ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  <span>更多选项</span>
                  <div className="flex-1 h-px" style={{backgroundColor: 'var(--color-hairline)'}} />
                </button>

                <AnimatePresence>
                  {config.showMore && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden space-y-4"
                    >
                      {/* Resume select */}
                      <div className="rounded-lg p-4 border" style={{backgroundColor: 'rgba(204,120,92,0.04)', borderColor: 'rgba(204,120,92,0.15)'}}>
                        <div className="flex items-center gap-3 mb-3">
                          <FileStack className="w-5 h-5" style={{color: 'var(--color-primary)'}} />
                          <p className="font-semibold text-sm" style={{color: 'var(--color-ink)'}}>
                            基于简历面试（可选）
                          </p>
                        </div>
                        <select
                          value={config.resumeId || ''}
                          onChange={e => config.setResumeId(e.target.value ? parseInt(e.target.value) : undefined)}
                          className="w-full px-4 py-2.5 rounded-lg border text-sm focus:outline-none"
                          style={{borderColor: 'var(--color-hairline)', backgroundColor: 'var(--color-surface-card)', color: 'var(--color-ink)'}}
                        >
                          <option value="">不使用简历（通用提问）</option>
                          {config.resumes.map(r => (
                            <option key={r.id} value={r.id}>{r.filename}</option>
                          ))}
                        </select>
                      </div>

                      {/* Question count */}
                      {config.mode === 'text' && (
                        <div>
                          <label className="flex items-center gap-2 mb-3 text-sm font-semibold" style={{color: 'var(--color-body-text)'}}>
                            题目数量
                          </label>
                          <div className="flex gap-2">
                            {[6, 8, 10, 12].map(n => (
                              <button
                                key={n}
                                onClick={() => config.setQuestionCount(n)}
                                className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                                style={{
                                  backgroundColor: config.questionCount === n ? 'var(--color-primary)' : 'var(--color-surface-soft)',
                                  color: config.questionCount === n ? 'white' : 'var(--color-body-text)',
                                }}
                              >
                                {n} 题
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Duration */}
                      {config.mode === 'voice' && (
                        <div className="rounded-lg p-4 border" style={{backgroundColor: 'var(--color-surface-soft)', borderColor: 'var(--color-hairline)'}}>
                          <div className="flex items-center justify-between mb-3">
                            <p className="font-semibold text-sm" style={{color: 'var(--color-ink)'}}>计划面试时长</p>
                            <div className="text-2xl font-bold tabular-nums" style={{color: 'var(--color-primary)', fontFamily: 'var(--font-display)'}}>
                              {config.plannedDuration}
                              <span className="text-xs font-normal ml-0.5" style={{color: 'var(--color-muted)'}}>min</span>
                            </div>
                          </div>
                          <input
                            type="range"
                            min="15"
                            max="60"
                            step="5"
                            value={config.plannedDuration}
                            onChange={e => config.setPlannedDuration(parseInt(e.target.value))}
                            className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                            style={{backgroundColor: 'var(--color-hairline)'}}
                          />
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t rounded-b-lg" style={{backgroundColor: 'var(--color-surface-soft)', borderColor: 'var(--color-hairline)'}}>
                <div className="flex gap-3">
                  <motion.button
                    onClick={onClose}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 px-5 py-3 border rounded-lg font-medium text-sm transition-all"
                    style={{borderColor: 'var(--color-hairline)', color: 'var(--color-body-text)'}}
                  >
                    取消
                  </motion.button>
                  <motion.button
                    onClick={handleStart}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={config.isCustomStartDisabled}
                    className="flex-1 px-5 py-3 rounded-lg font-semibold text-sm transition-all text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{backgroundColor: 'var(--color-primary)'}}
                  >
                    {startButtonText}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
