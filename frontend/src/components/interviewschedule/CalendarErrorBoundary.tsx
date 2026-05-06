// frontend/src/components/interviewschedule/CalendarErrorBoundary.tsx

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class CalendarErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Calendar Error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="card-container p-6">
          <div className="text-center py-12">
            <div className="text-6xl mb-4" style={{color: 'var(--color-error)'}}>📅</div>
            <h3 className="text-xl font-semibold mb-2" style={{color: 'var(--color-ink)', fontFamily: 'var(--font-display)'}}>
              日历渲染出错
            </h3>
            <p className="mb-4" style={{color: 'var(--color-muted)'}}>
              {this.state.error?.message || '未知错误'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-4 py-2 rounded-lg text-white transition-colors"
              style={{backgroundColor: 'var(--color-primary)'}}
            >
              刷新页面
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
