import { api } from "./apiClient";

export type PaginatedResponse<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export const adminService = {
  getDashboardSummary: () => api.get("/admin/dashboard/summary"),
  getDashboardStorage: () => api.get("/admin/dashboard/storage"),

  getUsers: (params?: { q?: string; role?: string; locked?: boolean; page?: number; size?: number }) =>
    api.get<PaginatedResponse<any>>("/admin/users", { params }),

  getUser: (userId: string) => api.get(`/admin/users/${userId}`),
  getUserActivities: (userId: string, limit = 50) =>
    api.get(`/admin/users/${userId}/activities`, { params: { limit } }),
  lockUser: (userId: string) => api.patch(`/admin/users/${userId}/lock`),
  unlockUser: (userId: string) => api.patch(`/admin/users/${userId}/unlock`),
  updateUserRoles: (userId: string, roles: string[]) =>
    api.patch(`/admin/users/${userId}/roles`, { roles }),

  getRooms: (params?: { type?: string; page?: number; size?: number }) =>
    api.get<PaginatedResponse<any>>("/admin/rooms", { params }),
  getRoom: (roomId: string) => api.get(`/admin/rooms/${roomId}`),
  getRoomMembers: (roomId: string) => api.get(`/admin/rooms/${roomId}/members`),
  getRoomStats: (roomId: string) => api.get(`/admin/rooms/${roomId}/stats`),

  getMessages: (roomId: string, limit = 100) =>
    api.get(`/admin/messages/${roomId}`, { params: { limit } }),
  searchMessages: (params: { roomId: string; q?: string; senderId?: string; limit?: number }) =>
    api.get("/admin/messages", { params }),
  hideMessage: (roomId: string, messageId: string) =>
    api.patch(`/admin/messages/${roomId}/${messageId}/hide`),
  deleteMessage: (roomId: string, messageId: string) =>
    api.delete(`/admin/messages/${roomId}/${messageId}`),

  getGroups: (params?: { page?: number; size?: number }) =>
    api.get<PaginatedResponse<any>>("/admin/groups", { params }),
  disbandGroup: (groupId: string) => api.delete(`/admin/groups/${groupId}`),

  getMediaStats: () => api.get("/admin/media/stats"),

  getReports: (params?: { status?: string; page?: number; size?: number }) =>
    api.get<PaginatedResponse<any>>("/admin/moderation/reports", { params }),
  resolveReport: (reportId: string, note?: string) =>
    api.patch(`/admin/moderation/reports/${reportId}/resolve`, { note }),

  getAuditLogs: (params?: { page?: number; size?: number }) =>
    api.get<PaginatedResponse<any>>("/admin/audit-logs", { params }),

  getAdmins: () => api.get<any[]>("/admin/admins"),
  getRoles: () => api.get<any[]>("/admin/roles"),
  grantRole: (phone: string, role: string) => api.post("/admin/grant-role", { phone, role }),
  revokeAdmin: (userId: string) => api.delete(`/admin/admins/${userId}`),

  getAnalyticsUserGrowth: (days = 30) =>
    api.get("/admin/analytics/users/growth", { params: { days } }),
  getAnalyticsGroups: () => api.get("/admin/analytics/groups"),
  getAnalyticsTopRooms: (limit = 10) =>
    api.get("/admin/analytics/messages/top-rooms", { params: { limit } }),
};
