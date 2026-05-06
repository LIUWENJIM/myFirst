import {useCallback, useEffect, useRef, useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {
  AlertCircle,
  Check,
  CheckCircle,
  ChevronDown,
  Clock,
  Database,
  Download,
  Edit3,
  Eye,
  FileText,
  HardDrive,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {knowledgeBaseApi, KnowledgeBaseItem, KnowledgeBaseStats, SortOption, VectorStatus,} from '../api/knowledgebase';
import DeleteConfirmDialog from '../components/DeleteConfirmDialog';

interface KnowledgeBaseManagePageProps {
  onUpload: () => void;
  onChat: () => void;
}

// 格式化文件大小
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// 格式化日期
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// 状态图标组件
function StatusIcon({ status }: { status: VectorStatus }) {
  switch (status) {
    case 'COMPLETED':
      return <CheckCircle className="w-4 h-4" style={{color: '#10b981'}} />;
    case 'PROCESSING':
      return <Loader2 className="w-4 h-4 animate-spin" style={{color: 'var(--color-primary)'}} />;
    case 'PENDING':
      return <Clock className="w-4 h-4" style={{color: '#f59e0b'}} />;
    case 'FAILED':
      return <AlertCircle className="w-4 h-4" style={{color: 'var(--color-error)'}} />;
    default:
      return <CheckCircle className="w-4 h-4" style={{color: '#10b981'}} />;
  }
}

// 状态文本
function getStatusText(status: VectorStatus): string {
  switch (status) {
    case 'COMPLETED':
      return '已完成';
    case 'PROCESSING':
      return '处理中';
    case 'PENDING':
      return '待处理';
    case 'FAILED':
      return '失败';
    default:
      return '未知';
  }
}

// 统计卡片组件
function StatCard({
  icon: Icon,
  label,
  value,
  iconBg,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  iconBg: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-container p-6"
    >
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-lg" style={{backgroundColor: iconBg}}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
          <p className="text-sm" style={{color: 'var(--color-muted)'}}>{label}</p>
          <p className="text-2xl font-bold" style={{color: 'var(--color-ink)'}}>{value.toLocaleString()}</p>
        </div>
      </div>
    </motion.div>
  );
}

export default function KnowledgeBaseManagePage({ onUpload, onChat }: KnowledgeBaseManagePageProps) {
  const [stats, setStats] = useState<KnowledgeBaseStats | null>(null);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('time');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [deleteItem, setDeleteItem] = useState<KnowledgeBaseItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 分类编辑状态
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editingCategoryValue, setEditingCategoryValue] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);
  const categoryInputRef = useRef<HTMLInputElement>(null);

  // 重新向量化状态
  const [revectorizing, setRevectorizing] = useState<number | null>(null);

  // 加载数据（不显示loading状态，用于轮询）
  const loadDataSilent = useCallback(async () => {
    try {
      const [statsData, kbList, categoryList] = await Promise.all([
        knowledgeBaseApi.getStatistics(),
        searchKeyword
          ? knowledgeBaseApi.search(searchKeyword)
          : selectedCategory
          ? knowledgeBaseApi.getByCategory(selectedCategory)
          : knowledgeBaseApi.getAllKnowledgeBases(sortBy),
        knowledgeBaseApi.getAllCategories(),
      ]);
      setStats(statsData);
      setKnowledgeBases(kbList);
      setCategories(categoryList);
    } catch (error) {
      console.error('加载数据失败:', error);
    }
  }, [searchKeyword, sortBy, selectedCategory]);

  // 加载数据
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [statsData, kbList, categoryList] = await Promise.all([
        knowledgeBaseApi.getStatistics(),
        searchKeyword
          ? knowledgeBaseApi.search(searchKeyword)
          : selectedCategory
          ? knowledgeBaseApi.getByCategory(selectedCategory)
          : knowledgeBaseApi.getAllKnowledgeBases(sortBy),
        knowledgeBaseApi.getAllCategories(),
      ]);
      setStats(statsData);
      setKnowledgeBases(kbList);
      setCategories(categoryList);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, [searchKeyword, sortBy, selectedCategory]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 轮询：当有 PENDING 或 PROCESSING 状态时，每5秒刷新一次
  useEffect(() => {
    const hasPendingItems = knowledgeBases.some(
      kb => kb.vectorStatus === 'PENDING' || kb.vectorStatus === 'PROCESSING'
    );

    if (hasPendingItems && !loading) {
      const timer = setInterval(() => {
        loadDataSilent();
      }, 5000);

      return () => clearInterval(timer);
    }
  }, [knowledgeBases, loading, loadDataSilent]);

  // 重新向量化
  const handleRevectorize = async (id: number) => {
    try {
      setRevectorizing(id);
      await knowledgeBaseApi.revectorize(id);
      await loadDataSilent();
    } catch (error) {
      console.error('重新向量化失败:', error);
    } finally {
      setRevectorizing(null);
    }
  };

  // 删除知识库
  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      setDeleting(true);
      await knowledgeBaseApi.deleteKnowledgeBase(deleteItem.id);
      setDeleteItem(null);
      await loadData();
    } catch (error) {
      console.error('删除失败:', error);
    } finally {
      setDeleting(false);
    }
  };

  // 下载知识库
    const handleDownload = async (kb: KnowledgeBaseItem) => {
        try {
            const blob = await knowledgeBaseApi.downloadKnowledgeBase(kb.id);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = kb.originalFilename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('下载失败:', error);
        }
  };

  // 开始编辑分类
  const handleStartEditCategory = (kb: KnowledgeBaseItem) => {
    setEditingCategoryId(kb.id);
    setEditingCategoryValue(kb.category || '');
    setTimeout(() => {
      categoryInputRef.current?.focus();
    }, 50);
  };

  // 取消编辑分类
  const handleCancelEditCategory = () => {
    setEditingCategoryId(null);
    setEditingCategoryValue('');
  };

  // 保存分类
  const handleSaveCategory = async (id: number) => {
    try {
      setSavingCategory(true);
      const categoryToSave = editingCategoryValue.trim() || null;
      await knowledgeBaseApi.updateCategory(id, categoryToSave);
      setEditingCategoryId(null);
      setEditingCategoryValue('');
      await loadData();
    } catch (error) {
      console.error('更新分类失败:', error);
    } finally {
      setSavingCategory(false);
    }
  };

  // 处理分类输入框按键
  const handleCategoryKeyDown = (e: React.KeyboardEvent, id: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveCategory(id);
    } else if (e.key === 'Escape') {
      handleCancelEditCategory();
    }
  };

  // 搜索处理
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const selectStyle: React.CSSProperties = {
    border: '1px solid var(--color-hairline)',
    backgroundColor: 'var(--color-surface-card)',
    color: 'var(--color-ink)',
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* 页面标题 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3" style={{color: 'var(--color-ink)'}}>
            <div className="page-title-icon">
              <Database className="w-5 h-5" />
            </div>
            知识库管理
          </h1>
          <p className="mt-1 ml-12" style={{color: 'var(--color-muted)'}}>管理您的知识库文件，查看使用统计</p>
        </div>
        <div className="flex gap-3">
          <motion.button
            onClick={onUpload}
            className="flex items-center gap-2 px-4 py-2.5 text-white rounded-lg transition-all"
            style={{backgroundColor: 'var(--color-primary)'}}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Upload className="w-4 h-4" />
            上传知识库
          </motion.button>
          <motion.button
            onClick={onChat}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all"
            style={{backgroundColor: 'var(--color-surface-card)', color: 'var(--color-body-text)', border: '1px solid var(--color-hairline)'}}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-soft)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-card)'; }}
          >
            <MessageSquare className="w-4 h-4" />
            问答助手
          </motion.button>
        </div>
      </div>
      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            icon={Database}
            label="知识库总数"
            value={stats.totalCount}
            iconBg="var(--color-primary)"
          />
          <StatCard
            icon={MessageSquare}
            label="总提问次数"
            value={stats.totalQuestionCount}
            iconBg="#6366f1"
          />
          <StatCard
            icon={Eye}
            label="总访问次数"
            value={stats.totalAccessCount}
            iconBg="#10b981"
          />
        </div>
      )}

      {/* 搜索和筛选栏 */}
      <div className="card-container p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* 搜索框 */}
          <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{color: 'var(--color-muted)'}} />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="搜索知识库名称..."
                className="w-full pl-10 pr-4 py-2 rounded-lg focus:outline-none"
                style={selectStyle}
              />
            </div>
          </form>

          {/* 排序选择 */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as SortOption);
                setSearchKeyword('');
                setSelectedCategory(null);
              }}
              className="appearance-none pl-4 pr-10 py-2 rounded-lg focus:outline-none cursor-pointer"
              style={selectStyle}
            >
              <option value="time">按时间排序</option>
              <option value="size">按大小排序</option>
              <option value="access">按访问排序</option>
              <option value="question">按提问排序</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{color: 'var(--color-muted)'}} />
          </div>

          {/* 分类筛选 */}
          <div className="relative">
            <select
              value={selectedCategory || ''}
              onChange={(e) => {
                setSelectedCategory(e.target.value || null);
                setSearchKeyword('');
              }}
              className="appearance-none pl-4 pr-10 py-2 rounded-lg focus:outline-none cursor-pointer"
              style={selectStyle}
            >
              <option value="">全部分类</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{color: 'var(--color-muted)'}} />
          </div>
        </div>
      </div>

      {/* 知识库列表 */}
      <div className="table-container">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin" style={{color: 'var(--color-primary)'}} />
          </div>
        ) : knowledgeBases.length === 0 ? (
          <div className="text-center py-20">
            <HardDrive className="w-16 h-16 mx-auto mb-4" style={{color: 'var(--color-hairline)'}} />
            <p style={{color: 'var(--color-muted)'}}>暂无知识库</p>
            <button
              onClick={onUpload}
              className="mt-4 font-medium"
              style={{color: 'var(--color-primary)'}}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.7'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
            >
              上传第一个知识库
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead style={{backgroundColor: 'var(--color-surface-soft)'}}>
              <tr>
                <th className="text-left px-6 py-4 text-sm font-medium" style={{color: 'var(--color-body-text)'}}>名称</th>
                <th className="text-left px-6 py-4 text-sm font-medium" style={{color: 'var(--color-body-text)'}}>分类</th>
                <th className="text-left px-6 py-4 text-sm font-medium" style={{color: 'var(--color-body-text)'}}>大小</th>
                <th className="text-left px-6 py-4 text-sm font-medium" style={{color: 'var(--color-body-text)'}}>状态</th>
                <th className="text-left px-6 py-4 text-sm font-medium" style={{color: 'var(--color-body-text)'}}>提问</th>
                <th className="text-left px-6 py-4 text-sm font-medium" style={{color: 'var(--color-body-text)'}}>上传时间</th>
                <th className="text-right px-6 py-4 text-sm font-medium" style={{color: 'var(--color-body-text)'}}>操作</th>
              </tr>
            </thead>
            <tbody>
              {knowledgeBases.map((kb, index) => (
                <motion.tr
                  key={kb.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="transition-colors"
                  style={{borderBottom: '1px solid var(--color-hairline)'}}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-soft)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5" style={{color: 'var(--color-muted)'}} />
                      <div>
                        <p className="font-medium" style={{color: 'var(--color-ink)'}}>{kb.name}</p>
                        <p className="text-xs" style={{color: 'var(--color-muted)'}}>{kb.originalFilename}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <AnimatePresence mode="wait">
                      {editingCategoryId === kb.id ? (
                        <motion.div
                          key="editing"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex items-center gap-2"
                        >
                          <input
                            ref={categoryInputRef}
                            type="text"
                            value={editingCategoryValue}
                            onChange={(e) => setEditingCategoryValue(e.target.value)}
                            onKeyDown={(e) => handleCategoryKeyDown(e, kb.id)}
                            placeholder="输入分类名称"
                            list="category-suggestions"
                            className="w-24 px-2 py-1 text-sm rounded focus:outline-none"
                            style={{border: '1px solid var(--color-primary)', backgroundColor: 'var(--color-surface-card)', color: 'var(--color-ink)'}}
                            disabled={savingCategory}
                          />
                          <datalist id="category-suggestions">
                            {categories.map((cat) => (
                              <option key={cat} value={cat} />
                            ))}
                          </datalist>
                          <button
                            onClick={() => handleSaveCategory(kb.id)}
                            disabled={savingCategory}
                            className="p-1 rounded transition-colors disabled:opacity-50"
                            style={{color: '#10b981'}}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(16,185,129,0.1)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                            title="保存"
                          >
                            {savingCategory ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={handleCancelEditCategory}
                            disabled={savingCategory}
                            className="p-1 rounded transition-colors disabled:opacity-50"
                            style={{color: 'var(--color-muted)'}}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-soft)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                            title="取消"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="display"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex items-center gap-2 group/category"
                        >
                          {kb.category ? (
                            <span className="px-2 py-1 rounded text-sm" style={{backgroundColor: 'var(--color-surface-soft)', color: 'var(--color-body-text)'}}>
                              {kb.category}
                            </span>
                          ) : (
                            <span className="text-sm" style={{color: 'var(--color-muted)'}}>未分类</span>
                          )}
                          <button
                            onClick={() => handleStartEditCategory(kb)}
                            className="p-1 rounded opacity-0 group-hover/category:opacity-100 transition-all"
                            style={{color: 'var(--color-muted)'}}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-primary)'; (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(204,120,92,0.08)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-muted)'; (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                            title="编辑分类"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </td>
                  <td className="px-6 py-4 text-sm" style={{color: 'var(--color-body-text)'}}>
                    {formatFileSize(kb.fileSize)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <StatusIcon status={kb.vectorStatus} />
                      <span className="text-sm" style={{color: 'var(--color-body-text)'}}>
                        {getStatusText(kb.vectorStatus)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm" style={{color: 'var(--color-body-text)'}}>
                    {kb.questionCount}
                  </td>
                  <td className="px-6 py-4 text-sm" style={{color: 'var(--color-muted)'}}>
                    {formatDate(kb.uploadedAt)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* 下载按钮 */}
                      <button
                        onClick={() => handleDownload(kb)}
                        className="p-2 rounded-lg transition-colors"
                        style={{color: 'var(--color-muted)'}}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-primary)'; (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(204,120,92,0.08)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-muted)'; (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                        title="下载"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      {/* 重新向量化按钮 */}
                      {kb.vectorStatus === 'FAILED' && (
                        <button
                          onClick={() => handleRevectorize(kb.id)}
                          disabled={revectorizing === kb.id}
                          className="p-2 rounded-lg transition-colors disabled:opacity-50"
                          style={{color: 'var(--color-muted)'}}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-primary)'; (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(204,120,92,0.08)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-muted)'; (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                          title="重新向量化"
                        >
                          <RefreshCw className={`w-4 h-4 ${revectorizing === kb.id ? 'animate-spin' : ''}`} />
                        </button>
                      )}
                      {/* 删除按钮 */}
                      <button
                        onClick={() => setDeleteItem(kb)}
                        className="p-2 rounded-lg transition-colors"
                        style={{color: 'var(--color-muted)'}}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-error)'; (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(198,69,69,0.08)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-muted)'; (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 删除确认对话框 */}
      <DeleteConfirmDialog
        open={deleteItem !== null}
        item={deleteItem}
        itemType="知识库"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteItem(null)}
      />
    </div>
  );
}
