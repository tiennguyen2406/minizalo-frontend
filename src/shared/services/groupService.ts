import axios from "axios";
import { useAuthStore } from "@/shared/store/authStore";
import { GroupDetail } from "../types";

const rawBase =
    typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL
        ? process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, "")
        : "http://localhost:8080/api";
const API_BASE_URL = rawBase.endsWith("/api") ? rawBase : `${rawBase}/api`;

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: { "Content-Type": "application/json" },
});

// Interceptor: thêm Bearer token tự động
api.interceptors.request.use((config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// Interceptor: tự refresh khi 401
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            try {
                const refreshed = await useAuthStore.getState().refreshAuth();
                if (refreshed) {
                    const token = useAuthStore.getState().accessToken;
                    if (token) {
                        originalRequest.headers.Authorization = `Bearer ${token}`;
                        return api(originalRequest);
                    }
                }
            } catch { /* ignore */ }
            useAuthStore.getState().clear();
        }
        return Promise.reject(error);
    }
);

/** Map GroupResponse (backend) → GroupDetail (frontend) */
function mapGroupResponse(data: any): GroupDetail {
    return {
        id: data.id,
        groupName: data.groupName,
        ownerId: data.ownerId,
        createdAt: data.createdAt || new Date().toISOString(),
        members: (data.members || []).map((m: any) => ({
            userId: m.userId,
            username: m.username || "",
            avatarUrl: m.avatarUrl || undefined,
            role: m.role || "MEMBER",
        })),
    };
}

export const groupService = {
    /** Lấy danh sách nhóm của user hiện tại */
    async getUsersGroups(): Promise<GroupDetail[]> {
        const { data } = await api.get("/group/my-groups");
        return (data || []).map(mapGroupResponse);
    },

    /** Tạo nhóm mới */
    async createGroup(groupName: string, initialMemberIds: string[]): Promise<GroupDetail> {
        const { data } = await api.post("/group", { groupName, initialMemberIds });
        return mapGroupResponse(data);
    },

    /** Lấy thông tin chi tiết nhóm (bao gồm danh sách thành viên) */
    async getGroupDetails(groupId: string): Promise<GroupDetail> {
        const { data } = await api.get(`/group/${groupId}`);
        return mapGroupResponse(data);
    },

    /** Thêm thành viên vào nhóm */
    async addMembersToGroup(groupId: string, memberIds: string[]): Promise<GroupDetail> {
        const { data } = await api.post("/group/members", { groupId, memberIds });
        return mapGroupResponse(data);
    },

    /** Xóa thành viên khỏi nhóm */
    async removeMembersFromGroup(groupId: string, memberIds: string[]): Promise<GroupDetail> {
        const { data } = await api.delete("/group/members", { data: { groupId, memberIds } });
        return mapGroupResponse(data);
    },

    /** Rời nhóm */
    async leaveGroup(groupId: string): Promise<void> {
        await api.post(`/group/leave/${groupId}`);
    },

    /** Giải tán nhóm */
    async disbandGroup(groupId: string): Promise<void> {
        await api.delete(`/group/${groupId}`);
    },
};
