// 直达招聘相关类型定义

export type ApplicationStatus =
  | 'NOT_APPLIED'
  | 'SCREENING'
  | 'ASSESSED'
  | 'REJECTED'
  | 'NO_POSITION';

export interface DirectHireCompany {
  id: number;
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
