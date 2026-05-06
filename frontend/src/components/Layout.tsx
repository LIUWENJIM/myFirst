import {Link, Outlet, useLocation, useNavigate} from 'react-router-dom';
import {motion} from 'framer-motion';
import {Moon, Settings, Sparkles, Sun} from 'lucide-react';
import {useTheme} from '../hooks/useTheme';
import {useState} from 'react';
import UnifiedInterviewModal, {UnifiedInterviewConfig} from './UnifiedInterviewModal';

interface NavItem {
  id: string;
  path: string;
  label: string;
}

const navItems: NavItem[] = [
  {id: 'resumes', path: '/history', label: '简历管理'},
  {id: 'interview-hub', path: '/interview-hub', label: '模拟面试'},
  {id: 'interviews', path: '/interviews', label: '面试记录'},
  {id: 'interview-schedule', path: '/interview-schedule', label: '面试日程'},
  {id: 'kb-manage', path: '/knowledgebase', label: '知识库'},
  {id: 'chat', path: '/knowledgebase/chat', label: '问答助手'},
];

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
    <div className="min-h-screen" style={{backgroundColor: 'var(--color-canvas)'}}>
      {/* 顶部导航栏 — Claude warm canvas style */}
      <header
        className="sticky top-0 z-50 h-[5.5rem] backdrop-blur-xl border-b"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--color-canvas) 80%, transparent)',
          borderColor: 'var(--color-hairline)',
        }}
      >
        <div className="max-w-6xl mx-auto h-full px-8 flex items-center justify-between">
          {/* Logo */}
          <Link to="/history" className="flex items-center gap-3 group flex-shrink-0">
            <div
              className="w-11 h-11 rounded-lg flex items-center justify-center"
              style={{backgroundColor: 'var(--color-primary)'}}
            >
              <Sparkles className="w-[22px] h-[22px]" style={{color: 'var(--color-on-primary)'}}/>
            </div>
            <span
              className="text-[20px] font-semibold tracking-tight"
              style={{color: 'var(--color-ink)', fontFamily: 'var(--font-display)', fontWeight: 600}}
            >
              AI Interview
            </span>
          </Link>

          {/* 导航项 — 均匀分布 */}
          <nav className="flex items-center flex-1 justify-around mx-10">
            {navItems.map((item) => {
              const active = isActive(item.path);
              return (
                <Link
                  key={item.id}
                  to={item.path}
                  className="relative px-4 py-2.5 text-[15px] font-medium rounded-lg transition-colors duration-150 whitespace-nowrap"
                  style={{
                    color: active ? 'var(--color-ink)' : 'var(--color-muted)',
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.color = 'var(--color-ink)';
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-soft)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.color = 'var(--color-muted)';
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  {item.label}
                  {active && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute -bottom-[17px] left-4 right-4 h-[2px] rounded-full"
                      style={{backgroundColor: 'var(--color-primary)'}}
                      transition={{type: 'spring', stiffness: 500, damping: 35}}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* 右侧操作 */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={toggleTheme}
              className="p-3 rounded-lg transition-colors duration-150"
              style={{color: 'var(--color-muted)'}}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.color = 'var(--color-ink)';
                (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-soft)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.color = 'var(--color-muted)';
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              }}
              title={theme === 'dark' ? '切换浅色模式' : '切换深色模式'}
            >
              {theme === 'dark' ? <Sun className="w-[22px] h-[22px]"/> : <Moon className="w-[22px] h-[22px]"/>}
            </button>
            <Link
              to="/settings"
              className="p-3 rounded-lg transition-colors duration-150"
              style={{
                color: isActive('/settings') ? 'var(--color-ink)' : 'var(--color-muted)',
                backgroundColor: isActive('/settings') ? 'var(--color-surface-soft)' : 'transparent',
              }}
            >
              <Settings className="w-[22px] h-[22px]"/>
            </Link>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="w-full px-6 lg:px-8 py-8">
        <div className="max-w-6xl mx-auto">
          <motion.div
            key={currentPath}
            initial={{opacity: 0, y: 8}}
            animate={{opacity: 1, y: 0}}
            exit={{opacity: 0, y: -8}}
            transition={{duration: 0.2, ease: 'easeOut'}}
          >
            <Outlet context={{openInterviewModalWithResume}}/>
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
