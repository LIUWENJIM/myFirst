import { useState, lazy, Suspense } from 'react';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Check, Copy } from 'lucide-react';

const SyntaxHighlighter = lazy(() =>
  import('react-syntax-highlighter/dist/esm/prism').then(module => ({ default: module.default }))
);

interface CodeBlockProps {
  language?: string;
  children: string;
}

export default function CodeBlock({ language, children }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  const code = children?.trim() || '';

  return (
    <div className="relative group my-3">
      <div className="flex items-center justify-between px-4 py-2 rounded-t-xl border-b" style={{backgroundColor: 'var(--color-surface-dark)', borderColor: 'rgba(255,255,255,0.1)'}}>
        <span className="text-xs font-mono" style={{color: 'var(--color-muted)'}}>
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors"
          style={{color: 'var(--color-muted)'}}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'white'; (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.1)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-muted)'; (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          title="复制代码"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-green-400" />
              <span className="text-green-400">已复制</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>复制</span>
            </>
          )}
        </button>
      </div>

      <div className="rounded-b-xl text-sm leading-6" style={{backgroundColor: '#282c34'}}>
        <Suspense fallback={
          <div className="p-4 font-mono text-xs" style={{color: 'var(--color-muted)'}}>Loading code...</div>
        }>
          <SyntaxHighlighter
            language={language || 'text'}
            style={oneDark}
            customStyle={{
              margin: 0,
              borderTopLeftRadius: 0,
              borderTopRightRadius: 0,
              borderBottomLeftRadius: '0.75rem',
              borderBottomRightRadius: '0.75rem',
              fontSize: '0.875rem',
              lineHeight: '1.5',
            }}
            showLineNumbers={code.split('\n').length > 3}
            wrapLines
          >
            {code}
          </SyntaxHighlighter>
        </Suspense>
      </div>
    </div>
  );
}
