import React, { useState, useEffect, useCallback } from 'react';
import { directHireApi } from '../api/directHire';
import type {
  DirectHireCompany,
  ApplicationStatus,
  CompanyCategory,
  CreateDirectHireRequest,
} from '../types/directHire';
import { STATUS_LABELS, STATUS_COLORS, STATUS_BG_COLORS, CATEGORY_LABELS } from '../types/directHire';
import ConfirmDialog from '../components/ConfirmDialog';
import { Search, Plus, Upload, ExternalLink, Edit3, Trash2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Building2, Briefcase } from 'lucide-react';

const PAGE_SIZE = 15;

const DirectHirePage: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<CompanyCategory>('BIG_TECH');
  const [companies, setCompanies] = useState<DirectHireCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingCompany, setEditingCompany] = useState<DirectHireCompany | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<number | null>(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // 表单状态
  const [formData, setFormData] = useState<CreateDirectHireRequest>({
    category: 'BIG_TECH',
    companyName: '',
    applicationLink: '',
    referralCode: '',
    status: 'NOT_APPLIED',
    lastAccessDate: undefined,
  });

  // 加载公司列表（分页）
  const loadCompanies = useCallback(async (category: CompanyCategory, search?: string, page = 0) => {
    setLoading(true);
    try {
      const result = await directHireApi.getCompaniesPaged(category, search, page, PAGE_SIZE);
      setCompanies(result.content);
      setTotalPages(result.totalPages);
      setTotalElements(result.totalElements);
      setCurrentPage(result.page);
    } catch (error) {
      console.error('加载公司列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCompanies(activeCategory, searchKeyword || undefined, currentPage);
  }, [activeCategory, currentPage, loadCompanies]);

  // 切换分类
  const handleCategoryChange = useCallback((category: CompanyCategory) => {
    setActiveCategory(category);
    setSearchKeyword('');
    setCurrentPage(0);
  }, []);

  // 搜索
  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchKeyword(value);
    setCurrentPage(0);
    // 防抖搜索
    const timer = setTimeout(() => {
      loadCompanies(activeCategory, value || undefined, 0);
    }, 300);
    return () => clearTimeout(timer);
  }, [activeCategory, loadCompanies]);

  // 翻页
  const handlePageChange = useCallback((newPage: number) => {
    if (newPage >= 0 && newPage < totalPages) {
      setCurrentPage(newPage);
    }
  }, [totalPages]);

  // 打开添加弹窗
  const handleAddClick = useCallback(() => {
    setModalMode('create');
    setEditingCompany(null);
    setFormData({
      category: activeCategory,
      companyName: '',
      applicationLink: '',
      referralCode: '',
      status: 'NOT_APPLIED',
      lastAccessDate: undefined,
    });
    setIsModalOpen(true);
  }, [activeCategory]);

  // 打开编辑弹窗
  const handleEditClick = useCallback((company: DirectHireCompany) => {
    setModalMode('edit');
    setEditingCompany(company);
    setFormData({
      category: company.category,
      companyName: company.companyName,
      applicationLink: company.applicationLink || '',
      referralCode: company.referralCode || '',
      status: company.status,
      lastAccessDate: company.lastAccessDate,
    });
    setIsModalOpen(true);
  }, []);

  // 提交表单
  const handleSubmit = useCallback(async () => {
    try {
      if (modalMode === 'create') {
        await directHireApi.createCompany(formData);
      } else if (editingCompany) {
        await directHireApi.updateCompany(editingCompany.id, formData);
      }
      setIsModalOpen(false);
      loadCompanies(activeCategory, searchKeyword || undefined, currentPage);
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败，请重试');
    }
  }, [modalMode, editingCompany, formData, activeCategory, searchKeyword, currentPage, loadCompanies]);

  // 更新状态
  const handleStatusChange = useCallback(async (id: number, status: ApplicationStatus) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      await directHireApi.updateStatus(id, { status, lastAccessDate: today });
      loadCompanies(activeCategory, searchKeyword || undefined, currentPage);
    } catch (error) {
      console.error('更新状态失败:', error);
      alert('更新状态失败，请重试');
    }
  }, [activeCategory, searchKeyword, currentPage, loadCompanies]);

  // 更新日期
  const handleDateChange = useCallback(async (id: number, date: string) => {
    try {
      await directHireApi.updateStatus(id, {
        status: companies.find(c => c.id === id)?.status || 'NOT_APPLIED',
        lastAccessDate: date
      });
      loadCompanies(activeCategory, searchKeyword || undefined, currentPage);
    } catch (error) {
      console.error('更新日期失败:', error);
      alert('更新日期失败，请重试');
    }
  }, [companies, activeCategory, searchKeyword, currentPage, loadCompanies]);

  // 删除确认
  const handleDeleteClick = useCallback((id: number) => {
    setCompanyToDelete(id);
    setDeleteConfirmOpen(true);
  }, []);

  // 执行删除
  const handleConfirmDelete = useCallback(async () => {
    if (companyToDelete) {
      try {
        await directHireApi.deleteCompany(companyToDelete);
        loadCompanies(activeCategory, searchKeyword || undefined, currentPage);
      } catch (error) {
        console.error('删除失败:', error);
        alert('删除失败，请重试');
      }
    }
    setDeleteConfirmOpen(false);
    setCompanyToDelete(null);
  }, [companyToDelete, activeCategory, searchKeyword, currentPage, loadCompanies]);

  // 点击链接
  const handleLinkClick = useCallback((url: string) => {
    if (url) {
      window.open(url.startsWith('http') ? url : `https://${url}`, '_blank');
    }
  }, []);

  // 清空当前分类
  const handleClearClick = useCallback(() => {
    setClearConfirmOpen(true);
  }, []);

  // 执行清空
  const handleConfirmClear = useCallback(async () => {
    try {
      const deleted = await directHireApi.clearCompanies(activeCategory);
      setClearConfirmOpen(false);
      setCurrentPage(0);
      loadCompanies(activeCategory, searchKeyword || undefined, 0);
      alert(`成功清空 ${deleted} 条数据`);
    } catch (error) {
      console.error('清空失败:', error);
      alert('清空失败，请重试');
    }
  }, [activeCategory, searchKeyword, loadCompanies]);

  // Excel导入
  const handleExcelImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      alert('请选择Excel文件（.xlsx或.xls格式）');
      return;
    }

    setImporting(true);
    try {
      const result = await directHireApi.importExcel(activeCategory, file);
      alert(`成功导入 ${result.length} 家公司`);
      loadCompanies(activeCategory, searchKeyword || undefined, 0);
      setCurrentPage(0);
    } catch (error) {
      console.error('导入失败:', error);
      alert('导入失败，请检查文件格式');
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [activeCategory, searchKeyword, loadCompanies]);

  // 触发文件选择
  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-10 h-10 border-3 rounded-full animate-spin"
            style={{ borderColor: 'var(--color-hairline)', borderTopColor: 'var(--color-primary)' }}
          />
          <span className="text-sm" style={{ color: 'var(--color-muted)' }}>加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container px-6 py-6" style={{ maxWidth: '80rem' }}>
      {/* 页面头部 */}
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="page-title-icon">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <h1 className="page-title">直达招聘</h1>
              <p className="page-subtitle">管理公司投递信息和状态</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelImport}
              className="hidden"
            />
            <button
              onClick={handleImportClick}
              disabled={importing}
              className="btn-secondary px-3 py-2 rounded-lg text-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              {importing ? '导入中...' : '导入Excel'}
            </button>
            <button
              onClick={handleClearClick}
              disabled={totalElements === 0}
              className="btn-secondary px-3 py-2 rounded-lg text-sm flex items-center gap-1.5 disabled:opacity-50"
              style={{ color: 'var(--color-error)' }}
            >
              <Trash2 className="w-4 h-4" />
              清空数据
            </button>
            <button
              onClick={handleAddClick}
              className="btn-primary px-3 py-2 rounded-lg text-sm flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              添加公司
            </button>
          </div>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="card-container p-4">
          <div className="label mb-1">总记录数</div>
          <div className="metric">{totalElements}</div>
        </div>
        <div className="card-container p-4">
          <div className="label mb-1">当前页</div>
          <div className="metric">{currentPage + 1} / {totalPages}</div>
        </div>
        <div className="card-container p-4">
          <div className="label mb-1">每页显示</div>
          <div className="metric">{PAGE_SIZE} 条</div>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="filter-bar">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {/* 分类标签页 */}
          <div className="flex gap-2">
            {(Object.entries(CATEGORY_LABELS) as [CompanyCategory, string][]).map(([value, label]) => (
              <button
                key={value}
                onClick={() => handleCategoryChange(value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeCategory === value ? 'btn-primary' : 'btn-ghost'
                }`}
              >
                {value === 'BIG_TECH' && <Building2 className="w-4 h-4 inline mr-1.5" />}
                {label}
              </button>
            ))}
          </div>

          {/* 搜索框 */}
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-muted)' }} />
            <input
              type="text"
              placeholder="搜索公司名称..."
              value={searchKeyword}
              onChange={handleSearch}
              className="dark-input w-full pl-9 pr-4 py-2"
            />
          </div>
        </div>
      </div>

      {/* 表格 */}
      <div className="table-container">
        <table className="w-full">
          <thead>
            <tr>
              <th className="rbc-header px-4 py-3 text-left" style={{ width: '60px' }}>
                序号
              </th>
              <th className="rbc-header px-4 py-3 text-left">
                公司名称
              </th>
              <th className="rbc-header px-4 py-3 text-center" style={{ width: '100px' }}>
                投递链接
              </th>
              <th className="rbc-header px-4 py-3 text-left" style={{ width: '120px' }}>
                内推码
              </th>
              <th className="rbc-header px-4 py-3 text-center" style={{ width: '120px' }}>
                投递状态
              </th>
              <th className="rbc-header px-4 py-3 text-center" style={{ width: '150px' }}>
                上次访问
              </th>
              <th className="rbc-header px-4 py-3 text-center" style={{ width: '120px' }}>
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {companies.map((company, index) => (
              <tr
                key={company.id}
                className="border-t transition-colors hover:bg-[var(--color-surface-soft)]"
                style={{ borderColor: 'var(--color-hairline)' }}
              >
                <td className="px-4 py-3 text-sm mono">
                  {currentPage * PAGE_SIZE + index + 1}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="icon-box"
                      style={{
                        width: '32px',
                        height: '32px',
                        backgroundColor: 'var(--color-surface-card)',
                        color: 'var(--color-primary)',
                      }}
                    >
                      <Building2 className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium" style={{ color: 'var(--color-ink)' }}>
                      {company.companyName}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  {company.applicationLink ? (
                    <button
                      onClick={() => handleLinkClick(company.applicationLink!)}
                      className="btn-ghost p-1.5 rounded-lg"
                      title="打开投递链接"
                    >
                      <ExternalLink className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                    </button>
                  ) : (
                    <span className="mono">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-body-text)' }}>
                  {company.referralCode || <span className="mono">-</span>}
                </td>
                <td className="px-4 py-3 text-center">
                  <select
                    value={company.status}
                    onChange={(e) => handleStatusChange(company.id, e.target.value as ApplicationStatus)}
                    className="text-xs px-2 py-1 rounded-lg border-0 cursor-pointer"
                    style={{
                      backgroundColor: STATUS_BG_COLORS[company.status],
                      color: STATUS_COLORS[company.status],
                      fontWeight: 500,
                    }}
                  >
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-center">
                  <input
                    type="date"
                    value={company.lastAccessDate || ''}
                    onChange={(e) => handleDateChange(company.id, e.target.value)}
                    className="dark-input text-xs px-2 py-1"
                    style={{ maxWidth: '130px' }}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => handleEditClick(company)}
                      className="btn-ghost p-1.5 rounded-lg"
                      title="编辑"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(company.id)}
                      className="btn-ghost p-1.5 rounded-lg"
                      title="删除"
                      style={{ color: 'var(--color-error)' }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 空状态 */}
        {companies.length === 0 && (
          <div className="empty-state">
            <Briefcase className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--color-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
              {searchKeyword ? '没有找到匹配的公司' : `暂无${CATEGORY_LABELS[activeCategory]}数据`}
            </p>
            {!searchKeyword && (
              <button
                onClick={handleAddClick}
                className="btn-primary px-4 py-2 rounded-lg text-sm mt-4"
              >
                添加第一家公司
              </button>
            )}
          </div>
        )}
      </div>

      {/* 分页控件 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-2">
          <div className="text-sm" style={{ color: 'var(--color-muted)' }}>
            共 {totalElements} 条记录，第 {currentPage + 1} / {totalPages} 页
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePageChange(0)}
              disabled={currentPage === 0}
              className="btn-ghost p-2 rounded-lg disabled:opacity-30"
              title="首页"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 0}
              className="btn-ghost p-2 rounded-lg disabled:opacity-30"
              title="上一页"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* 页码按钮 */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i;
              } else if (currentPage < 3) {
                pageNum = i;
              } else if (currentPage > totalPages - 4) {
                pageNum = totalPages - 5 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                    currentPage === pageNum ? 'btn-primary' : 'btn-ghost'
                  }`}
                >
                  {pageNum + 1}
                </button>
              );
            })}

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages - 1}
              className="btn-ghost p-2 rounded-lg disabled:opacity-30"
              title="下一页"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => handlePageChange(totalPages - 1)}
              disabled={currentPage === totalPages - 1}
              className="btn-ghost p-2 rounded-lg disabled:opacity-30"
              title="末页"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 添加/编辑弹窗 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="w-full max-w-md p-6 rounded-xl shadow-xl"
            style={{ backgroundColor: 'var(--color-canvas)' }}
          >
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--color-ink)' }}>
              {modalMode === 'create' ? '添加公司' : '编辑公司'}
            </h2>

            <div className="space-y-4">
              {/* 公司分类 */}
              <div>
                <label className="label block mb-1.5">
                  公司分类 *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as CompanyCategory })}
                  className="dark-input w-full px-3 py-2"
                  disabled={modalMode === 'edit'}
                >
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 公司名称 */}
              <div>
                <label className="label block mb-1.5">
                  公司名称 *
                </label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="dark-input w-full px-3 py-2"
                  placeholder="请输入公司名称"
                />
              </div>

              {/* 投递链接 */}
              <div>
                <label className="label block mb-1.5">
                  投递链接
                </label>
                <input
                  type="text"
                  value={formData.applicationLink}
                  onChange={(e) => setFormData({ ...formData, applicationLink: e.target.value })}
                  className="dark-input w-full px-3 py-2"
                  placeholder="请输入投递链接"
                />
              </div>

              {/* 内推码 */}
              <div>
                <label className="label block mb-1.5">
                  内推码
                </label>
                <input
                  type="text"
                  value={formData.referralCode}
                  onChange={(e) => setFormData({ ...formData, referralCode: e.target.value })}
                  className="dark-input w-full px-3 py-2"
                  placeholder="请输入内推码（选填）"
                />
              </div>

              {/* 投递状态 */}
              <div>
                <label className="label block mb-1.5">
                  投递状态
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as ApplicationStatus })}
                  className="dark-input w-full px-3 py-2"
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 上次访问时间 */}
              <div>
                <label className="label block mb-1.5">
                  上次访问时间
                </label>
                <input
                  type="date"
                  value={formData.lastAccessDate || ''}
                  onChange={(e) => setFormData({ ...formData, lastAccessDate: e.target.value || undefined })}
                  className="dark-input w-full px-3 py-2"
                />
              </div>
            </div>

            {/* 按钮 */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setIsModalOpen(false)}
                className="btn-secondary px-4 py-2 rounded-lg text-sm"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={!formData.companyName.trim()}
                className="btn-primary px-4 py-2 rounded-lg text-sm disabled:opacity-50"
              >
                {modalMode === 'create' ? '添加' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        title="确认删除"
        message="确定要删除这个公司吗？此操作无法撤销。"
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteConfirmOpen(false);
          setCompanyToDelete(null);
        }}
      />

      {/* 清空确认弹窗 */}
      <ConfirmDialog
        open={clearConfirmOpen}
        title="确认清空"
        message={`确定要清空「${CATEGORY_LABELS[activeCategory]}」分类下的所有数据吗？此操作无法撤销，将删除 ${totalElements} 条记录。`}
        onConfirm={handleConfirmClear}
        onCancel={() => setClearConfirmOpen(false)}
      />
    </div>
  );
};

export default DirectHirePage;
