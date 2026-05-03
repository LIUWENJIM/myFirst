import {Link, Outlet, useLocation, useNavigate} from 'react-router-dom';
import {motion} from 'framer-motion';
import {Calendar, ChevronRight, Database, FileStack, MessageSquare, Moon, Settings, Sparkles, Sun, Users,} from 'lucide-react';
import {useTheme} from '../hooks/useTheme';
import {useState} from 'react';
import UnifiedInterviewModal, {UnifiedInterviewConfig} from './UnifiedInterviewModal';

interface NavItem {
  id: string;
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}

interface NavGroup {
  id: string;
  title: string;
  items: NavItem[];
}

export default function Layout() {
  const location = useLocation();
  const currentPath = location.pathname;
  const {theme, toggleTheme} = useTheme();
  const navigate = useNavigate();
  const [interviewModalPreset, setInterviewModalPreset] = useState<{
    defaultMode: 'text' | 'voice';
    defaultResumeId?: number;
    title: string;
    subtitle: string;
    startButtonText: string;
  } | null>(null);

  const openInterviewModalWithResume = (resumeId: number) => {
    setInterviewModalPreset({
      defaultMode: 'text',
      defaultResumeId: resumeId,
      title: '开始模拟面试',
      subtitle: '配置面试参数，开始练习',
      startButtonText: '开始面试',
    });
  };

  const handleInterviewStart = (config: UnifiedInterviewConfig) => {
    setInterviewModalPreset(null);
    if (config.mode === 'text') {
      navigate('/interview', {
        state: {
          resumeId: config.resumeId,
          interviewConfig: {
            skillId: config.skillId,
            difficulty: config.difficulty,
            questionCount: config.questionCount,
            llmProvider: config.llmProvider,
          },
        },
      });
      return;
    }

    const params = new URLSearchParams({
      skillId: config.skillId,
      difficulty: config.difficulty,
    });
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
  };

  // 按业务模块组织的导航项
  const navGroups: NavGroup[] = [
    {
      id: 'interview',
      title: '面试准备',
      items: [
        { id: 'resumes', path: '/history', label: '简历管理', icon: FileStack, description: '管理简历，AI 分析' },
        { id: 'interview-hub', path: '/interview-hub', label: '模拟面试', icon: Sparkles, description: '文字/语音面试练习' },
        { id: 'interviews', path: '/interviews', label: '面试记录', icon: Users, description: '查看面试历史' },
        { id: 'interview-schedule', path: '/interview-schedule', label: '面试日程', icon: Calendar, description: '管理面试安排' },
      ],
    },
    {
      id: 'knowledge',
      title: '知识库',
      items: [
        { id: 'kb-manage', path: '/knowledgebase', label: '知识库管理', icon: Database, description: '管理知识文档' },
        { id: 'chat', path: '/knowledgebase/chat', label: '问答助手', icon: MessageSquare, description: '基于知识库问答' },
      ],
    },
    {
      id: 'system',
      title: '系统',
      items: [
        { id: 'settings', path: '/settings', label: '设置', icon: Settings, description: '管理模型和语音服务' },
      ],
    },
  ];

  // 判断当前页面是否匹配导航项
  const isActive = (path: string) => {
    if (path.startsWith('#')) return false;
    if (path === '/history') {
      return currentPath === '/history'
        || currentPath === '/'
        || currentPath.startsWith('/history/')
        || currentPath === '/upload';
    }
    if (path === '/interview-hub') {
      return currentPath === '/interview-hub'
        || currentPath === '/interview'
        || currentPath.startsWith('/interview/')
        || currentPath.startsWith('/voice-interview');
    }
    if (path === '/knowledgebase') {
      return currentPath === '/knowledgebase' || currentPath === '/knowledgebase/upload';
    }
    return currentPath.startsWith(path);
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-teal-50/60 via-white to-emerald-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/40">
      {/* 左侧边栏 */}
      <aside className="w-64 bg-white/80 dark:bg-slate-900/90 backdrop-blur-xl border-r border-slate-200/50 dark:border-slate-700/50 fixed h-screen left-0 top-0 z-50 flex flex-col">
        {/* Logo */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-700/50">
          <Link to="/history" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 via-primary-600 to-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary-500/30 group-hover:shadow-primary-500/40 group-hover:scale-105 transition-all duration-300">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="text-lg font-bold text-slate-800 dark:text-white tracking-tight block leading-tight">AI Interview</span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">智能面试助手</span>
            </div>
          </Link>
        </div>

        {/* 主题切换按钮 */}
        <div className="px-3 pt-3 pb-1">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-slate-100/70 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 hover:text-slate-800 dark:hover:text-white transition-all duration-200 border border-transparent dark:border-slate-700/30"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-medium">浅色模式</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-primary-500" />
                <span className="text-sm font-medium">深色模式</span>
              </>
            )}
          </button>
        </div>

        {/* 导航菜单 */}
        <nav className="flex-1 px-2.5 py-3 overflow-y-auto scrollbar-thin">
          <div className="space-y-5">
            {navGroups.map((group) => (
              <div key={group.id}>
                <div className="px-3 mb-2">
                  <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.12em]">
                    {group.title}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = isActive(item.path);

                    return (
                      <Link
                        key={item.id}
                        to={item.path}
                        className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
                          ${active
                            ? 'bg-gradient-to-r from-primary-50 to-emerald-50/80 dark:from-primary-900/30 dark:to-emerald-900/20 text-primary-700 dark:text-primary-300 font-medium shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
                          }`}
                      >
                        {/* 激活指示器 */}
                        {active && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-gradient-to-b from-primary-500 to-emerald-500 rounded-full shadow-sm shadow-primary-500/30" />
                        )}
                        <div className={`icon-box ${active ? 'active' : 'inactive'} transition-all duration-200 ${
                          active ? '' : 'group-hover:bg-primary-50 dark:group-hover:bg-primary-900/20 group-hover:text-primary-600 dark:group-hover:text-primary-400'
                        }`}>
                          <item.icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm block leading-tight">
                            {item.label}
                          </span>
                          {item.description && (
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate block mt-0.5">
                              {item.description}
                            </span>
                          )}
                        </div>
                        {active && (
                          <ChevronRight className="w-3.5 h-3.5 text-primary-400 dark:text-primary-500" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        {/* 底部信息 */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-700/50">
          <div className="px-3 py-2.5 bg-gradient-to-r from-primary-50/80 to-emerald-50/80 dark:from-primary-900/20 dark:to-emerald-950/20 rounded-xl border border-primary-100/50 dark:border-primary-800/20">
            <div className="flex items-center gap-2 mb-0.5">
              <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-primary-500 to-emerald-500 flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-white" />
              </div>
              <p className="text-xs font-semibold text-primary-600 dark:text-primary-400">AI 面试助手 v1.0</p>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 ml-7">Powered by AI</p>
          </div>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 ml-64 p-8 xl:p-10 min-h-screen overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <motion.div
            key={currentPath}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <Outlet context={{ openInterviewModalWithResume }} />
          </motion.div>
        </div>
      </main>

      {/* 统一面试弹窗 */}
      <UnifiedInterviewModal
        isOpen={interviewModalPreset !== null}
        onClose={() => setInterviewModalPreset(null)}
        onStart={handleInterviewStart}
        defaultMode={interviewModalPreset?.defaultMode || 'text'}
        defaultResumeId={interviewModalPreset?.defaultResumeId}
        hideModeSwitch={interviewModalPreset?.defaultResumeId == null}
        title={interviewModalPreset?.title || '开始模拟面试'}
        subtitle={interviewModalPreset?.subtitle || '选择面试模式和主题，快速开始'}
        startButtonText={interviewModalPreset?.startButtonText || '开始面试'}
      />
    </div>
  );
}
