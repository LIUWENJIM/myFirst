import { request } from './request';
import type {
  DirectHireCompany,
  CreateDirectHireRequest,
  UpdateDirectHireRequest,
  UpdateStatusRequest,
  UpdateSortOrderRequest,
} from '../types/directHire';

export const directHireApi = {
  /**
   * 获取公司列表
   */
  async getCompanies(search?: string): Promise<DirectHireCompany[]> {
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    return request.get<DirectHireCompany[]>(`/api/direct-hire/companies${params}`);
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
};
