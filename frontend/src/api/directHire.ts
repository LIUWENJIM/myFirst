import { request } from './request';
import type {
  DirectHireCompany,
  PageResponse,
  CompanyCategory,
  CreateDirectHireRequest,
  UpdateDirectHireRequest,
  UpdateStatusRequest,
  UpdateSortOrderRequest,
} from '../types/directHire';

export const directHireApi = {
  /**
   * 按分类获取公司列表
   */
  async getCompanies(category: CompanyCategory, search?: string): Promise<DirectHireCompany[]> {
    const params = new URLSearchParams({ category });
    if (search) {
      params.append('search', search);
    }
    return request.get<DirectHireCompany[]>(`/api/direct-hire/companies?${params.toString()}`);
  },

  /**
   * 分页获取公司列表
   */
  async getCompaniesPaged(category: CompanyCategory, search?: string, page = 0, size = 15): Promise<PageResponse<DirectHireCompany>> {
    const params = new URLSearchParams({
      category,
      page: page.toString(),
      size: size.toString(),
    });
    if (search) {
      params.append('search', search);
    }
    return request.get<PageResponse<DirectHireCompany>>(`/api/direct-hire/companies/paged?${params.toString()}`);
  },

  /**
   * 获取公司详情
   */
  async getCompany(id: number): Promise<DirectHireCompany> {
    return request.get<DirectHireCompany>(`/api/direct-hire/companies/${id}`);
  },

  /**
   * 创建公司
   */
  async createCompany(req: CreateDirectHireRequest): Promise<DirectHireCompany> {
    return request.post<DirectHireCompany>('/api/direct-hire/companies', req);
  },

  /**
   * 批量创建公司
   */
  async createBatch(category: CompanyCategory, req: CreateDirectHireRequest[]): Promise<DirectHireCompany[]> {
    return request.post<DirectHireCompany[]>(`/api/direct-hire/companies/batch?category=${category}`, req);
  },

  /**
   * 更新公司信息
   */
  async updateCompany(id: number, req: UpdateDirectHireRequest): Promise<DirectHireCompany> {
    return request.put<DirectHireCompany>(`/api/direct-hire/companies/${id}`, req);
  },

  /**
   * 更新投递状态
   */
  async updateStatus(id: number, req: UpdateStatusRequest): Promise<DirectHireCompany> {
    return request.patch<DirectHireCompany>(`/api/direct-hire/companies/${id}/status`, req);
  },

  /**
   * 更新排序
   */
  async updateSortOrder(req: UpdateSortOrderRequest): Promise<void> {
    return request.put<void>('/api/direct-hire/companies/sort-order', req);
  },

  /**
   * 删除公司
   */
  async deleteCompany(id: number): Promise<void> {
    return request.delete<void>(`/api/direct-hire/companies/${id}`);
  },

  /**
   * 清空指定分类的所有公司
   */
  async clearCompanies(category: CompanyCategory): Promise<number> {
    return request.delete<number>(`/api/direct-hire/companies/clear?category=${category}`);
  },

  /**
   * Excel导入公司
   */
  async importExcel(category: CompanyCategory, file: File): Promise<DirectHireCompany[]> {
    const formData = new FormData();
    formData.append('file', file);
    return request.upload<DirectHireCompany[]>(
      `/api/direct-hire/companies/import-excel?category=${category}`,
      formData
    );
  },
};
