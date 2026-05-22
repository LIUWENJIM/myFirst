import React, { useState, useEffect, useCallback } from 'react';
import { directHireApi } from '../api/directHire';
import type {
  DirectHireCompany,
  ApplicationStatus,
  CreateDirectHireRequest,
} from '../types/directHire';
import { STATUS_LABELS, STATUS_COLORS } from '../types/directHire';
import ConfirmDialog from '../components/ConfirmDialog';

const DirectHirePage: React.FC = () => {
  const [companies, setCompanies] = useState<DirectHireCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingCompany, setEditingCompany] = useState<DirectHireCompany | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<number | null>(null);

  // 表单状态
  const [formData, setFormData] = useState<CreateDirectHireRequest>({
    companyName: '',
    applicationLink: '',
    referralCode: '',
    status: 'NOT_APPLIED',
    lastAccessDate: undefined,
  });

  // 加载公司列表
  const loadCompanies = useCallback(async (search?: string) => {
    setLoading(true);
    try {
      const data = await directHireApi.getCompanies(search);
      setCompanies(data);
    } catch (error) {
      console.error('加载公司列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  // 搜索
  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchKeyword(value);
    // 防抖搜索
    const timer = setTimeout(() => {
      loadCompanies(value || undefined);
    }, 300);
    return () => clearTimeout(timer);
  }, [loadCompanies]);

  // 打开添加弹窗
  const handleAddClick = useCallback(() => {
    setModalMode('create');
    setEditingCompany(null);
    setFormData({
      companyName: '',
      applicationLink: '',
      referralCode: '',
      status: 'NOT_APPLIED',
      lastAccessDate: undefined,
    });
    setIsModalOpen(true);
  }, []);

  // 打开编辑弹窗
  const handleEditClick = useCallback((company: DirectHireCompany) => {
    setModalMode('edit');
    setEditingCompany(company);
    setFormData({
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
      loadCompanies(searchKeyword || undefined);
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败，请重试');
    }
  }, [modalMode, editingCompany, formData, searchKeyword, loadCompanies]);

  // 更新状态
  const handleStatusChange = useCallback(async (id: number, status: ApplicationStatus) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      await directHireApi.updateStatus(id, { status, lastAccessDate: today });
      loadCompanies(searchKeyword || undefined);
    } catch (error) {
      console.error('更新状态失败:', error);
      alert('更新状态失败，请重试');
    }
  }, [searchKeyword, loadCompanies]);

  // 更新日期
  const handleDateChange = useCallback(async (id: number, date: string) => {
    try {
      await directHireApi.updateStatus(id, { status: companies.find(c => c.id === id)?.status || 'NOT_APPLIED', lastAccessDate: date });
      loadCompanies(searchKeyword || undefined);
    } catch (error) {
      console.error('更新日期失败:', error);
      alert('更新日期失败，请重试');
    }
  }, [companies, searchKeyword, loadCompanies]);

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
        loadCompanies(searchKeyword || undefined);
      } catch (error) {
        console.error('删除失败:', error);
        alert('删除失败，请重试');
      }
    }
    setDeleteConfirmOpen(false);
    setCompanyToDelete(null);
  }, [companyToDelete, searchKeyword, loadCompanies]);

  // 点击链接
  const handleLinkClick = useCallback((url: string) => {
    if (url) {
      window.open(url.startsWith('http') ? url : `https://${url}`, '_blank');
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div
          className="w-10 h-10 border-3 rounded-full animate-spin"
          style={{ borderColor: 'var(--color-hairline)', borderTopColor: 'var(--color-primary)' }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-ink)' }}>
          直达招聘
        </h1>
        <button
          onClick={handleAddClick}
          className="px-4 py-2 rounded-lg font-medium transition-colors"
          style={{
            backgroundColor: 'var(--color-primary)',
            color: 'white',
          }}
        >
          + 添加公司
        </button>
      </div>

      {/* 搜索框 */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="搜索公司名称..."
          value={searchKeyword}
          onChange={handleSearch}
          className="w-full max-w-md px-4 py-2 rounded-lg border"
          style={{
            borderColor: 'var(--color-hairline)',
            backgroundColor: 'var(--color-bg)',
            color: 'var(--color-ink)',
          }}
        />
      </div>

      {/* 表格 */}
      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--color-hairline)' }}>
        <table className="w-full">
          <thead>
            <tr style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
              <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--color-ink-secondary)' }}>
                序号
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--color-ink-secondary)' }}>
                公司名称
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--color-ink-secondary)' }}>
                投递链接
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--color-ink-secondary)' }}>
                内推码
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--color-ink-secondary)' }}>
                投递状态
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--color-ink-secondary)' }}>
                上次访问时间
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--color-ink-secondary)' }}>
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {companies.map((company, index) => (
              <tr
                key={company.id}
                className="border-t transition-colors hover:opacity-80"
                style={{ borderColor: 'var(--color-hairline)' }}
              >
                <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-ink)' }}>
                  {index + 1}
                </td>
                <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--color-ink)' }}>
                  {company.companyName}
                </td>
                <td className="px-4 py-3 text-sm">
                  {company.applicationLink ? (
                    <button
                      onClick={() => handleLinkClick(company.applicationLink!)}
                      className="underline transition-colors"
                      style={{ color: 'var(--color-primary)' }}
                    >
                      投递链接
                    </button>
                  ) : (
                    <span style={{ color: 'var(--color-ink-tertiary)' }}>-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-ink)' }}>
                  {company.referralCode || '-'}
                </td>
                <td className="px-4 py-3 text-sm">
                  <select
                    value={company.status}
                    onChange={(e) => handleStatusChange(company.id, e.target.value as ApplicationStatus)}
                    className="px-2 py-1 rounded border text-sm"
                    style={{
                      borderColor: STATUS_COLORS[company.status],
                      color: STATUS_COLORS[company.status],
                      backgroundColor: 'transparent',
                    }}
                  >
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-sm">
                  <input
                    type="date"
                    value={company.lastAccessDate || ''}
                    onChange={(e) => handleDateChange(company.id, e.target.value)}
                    className="px-2 py-1 rounded border text-sm"
                    style={{
                      borderColor: 'var(--color-hairline)',
                      color: 'var(--color-ink)',
                      backgroundColor: 'transparent',
                    }}
                  />
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditClick(company)}
                      className="px-2 py-1 rounded text-sm transition-colors"
                      style={{
                        color: 'var(--color-primary)',
                        backgroundColor: 'transparent',
                      }}
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => handleDeleteClick(company.id)}
                      className="px-2 py-1 rounded text-sm transition-colors"
                      style={{
                        color: 'var(--color-error)',
                        backgroundColor: 'transparent',
                      }}
                    >
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {companies.length === 0 && (
          <div className="text-center py-12" style={{ color: 'var(--color-ink-tertiary)' }}>
            {searchKeyword ? '没有找到匹配的公司' : '暂无公司数据，点击"添加公司"开始'}
          </div>
        )}
      </div>

      {/* 添加/编辑弹窗 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="w-full max-w-md p-6 rounded-xl shadow-xl"
            style={{ backgroundColor: 'var(--color-bg)' }}
          >
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--color-ink)' }}>
              {modalMode === 'create' ? '添加公司' : '编辑公司'}
            </h2>

            <div className="space-y-4">
              {/* 公司名称 */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-ink-secondary)' }}>
                  公司名称 *
                </label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border"
                  style={{
                    borderColor: 'var(--color-hairline)',
                    backgroundColor: 'var(--color-bg-secondary)',
                    color: 'var(--color-ink)',
                  }}
                  placeholder="请输入公司名称"
                />
              </div>

              {/* 投递链接 */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-ink-secondary)' }}>
                  投递链接
                </label>
                <input
                  type="text"
                  value={formData.applicationLink}
                  onChange={(e) => setFormData({ ...formData, applicationLink: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border"
                  style={{
                    borderColor: 'var(--color-hairline)',
                    backgroundColor: 'var(--color-bg-secondary)',
                    color: 'var(--color-ink)',
                  }}
                  placeholder="请输入投递链接"
                />
              </div>

              {/* 内推码 */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-ink-secondary)' }}>
                  内推码
                </label>
                <input
                  type="text"
                  value={formData.referralCode}
                  onChange={(e) => setFormData({ ...formData, referralCode: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border"
                  style={{
                    borderColor: 'var(--color-hairline)',
                    backgroundColor: 'var(--color-bg-secondary)',
                    color: 'var(--color-ink)',
                  }}
                  placeholder="请输入内推码（选填）"
                />
              </div>

              {/* 投递状态 */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-ink-secondary)' }}>
                  投递状态
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as ApplicationStatus })}
                  className="w-full px-3 py-2 rounded-lg border"
                  style={{
                    borderColor: 'var(--color-hairline)',
                    backgroundColor: 'var(--color-bg-secondary)',
                    color: 'var(--color-ink)',
                  }}
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
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-ink-secondary)' }}>
                  上次访问时间
                </label>
                <input
                  type="date"
                  value={formData.lastAccessDate || ''}
                  onChange={(e) => setFormData({ ...formData, lastAccessDate: e.target.value || undefined })}
                  className="w-full px-3 py-2 rounded-lg border"
                  style={{
                    borderColor: 'var(--color-hairline)',
                    backgroundColor: 'var(--color-bg-secondary)',
                    color: 'var(--color-ink)',
                  }}
                />
              </div>
            </div>

            {/* 按钮 */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-lg border transition-colors"
                style={{
                  borderColor: 'var(--color-hairline)',
                  color: 'var(--color-ink-secondary)',
                }}
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={!formData.companyName.trim()}
                className="px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: 'white',
                }}
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
    </div>
  );
};

export default DirectHirePage;
