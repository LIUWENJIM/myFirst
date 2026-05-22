// 直达招聘相关类型定义

export type ApplicationStatus =
  | 'NOT_APPLIED'
  | 'SCREENING'
  | 'ASSESSED'
  | 'REJECTED'
  | 'NO_POSITION';

export type CompanyCategory = 'BIG_TECH' | 'DAILY_UPDATE';

export interface DirectHireCompany {
  id: number;
  category: CompanyCategory;
  sortOrder: number;
  companyName: string;
  applicationLink: string;
  referralCode?: string;
  status: ApplicationStatus;
  lastAccessDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDirectHireRequest {
  category: CompanyCategory;
  companyName: string;
  applicationLink?: string;
  referralCode?: string;
  status?: ApplicationStatus;
  lastAccessDate?: string;
}

export interface UpdateDirectHireRequest {
  companyName?: string;
  applicationLink?: string;
  referralCode?: string;
  status?: ApplicationStatus;
  lastAccessDate?: string;
}

export interface UpdateStatusRequest {
  status: ApplicationStatus;
  lastAccessDate?: string;
}

export interface UpdateSortOrderRequest {
  items: Array<{
    id: number;
    sortOrder: number;
  }>;
}

export const CATEGORY_LABELS: Record<CompanyCategory, string> = {
  BIG_TECH: '互联网大厂',
  DAILY_UPDATE: '每日更新大厂',
};

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  NOT_APPLIED: '未投递',
  SCREENING: '筛选中',
  ASSESSED: '已测评',
  REJECTED: '已拒绝',
  NO_POSITION: '无对应岗位',
};

export const STATUS_COLORS: Record<ApplicationStatus, string> = {
  NOT_APPLIED: '#9ca3af',
  SCREENING: '#3b82f6',
  ASSESSED: '#22c55e',
  REJECTED: '#ef4444',
  NO_POSITION: '#f97316',
};
