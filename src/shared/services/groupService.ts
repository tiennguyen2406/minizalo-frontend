import { api } from "@/shared/services/apiClient";
import { GroupDetail, GroupSettings, BlockedMember } from "../types";

/** Map GroupResponse (backend) → GroupDetail (frontend) */
function mapGroupResponse(data: any): GroupDetail {
    return {
        id: data.id,
        groupName: data.groupName,
        avatarUrl: data.avatarUrl || undefined,
        ownerId: data.ownerId,
        createdAt: data.createdAt || new Date().toISOString(),
        members: (data.members || []).map((m: any) => ({
            userId: m.userId,
            username: m.username || "",
            fullName: m.displayName || m.fullName || undefined,
            avatarUrl: m.avatarUrl || undefined,
            role: m.role || "MEMBER",
        })),
        settings: data.settings,
        disbanded: !!data.disbanded,
        pendingJoinRequestCount: typeof data.pendingJoinRequestCount === "number" ? data.pendingJoinRequestCount : 0,
        pendingJoinRequests: Array.isArray(data.pendingJoinRequests)
            ? data.pendingJoinRequests.map((p: any) => ({
                  userId: String(p.userId ?? ""),
                  username: p.username || "",
                  fullName: p.displayName || p.fullName || undefined,
                  displayName: p.displayName || p.fullName || undefined,
                  avatarUrl: p.avatarUrl || undefined,
                  invitedByUserId: p.invitedByUserId ?? null,
                  invitedByDisplayName: p.invitedByDisplayName ?? null,
              }))
            : [],
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

    /** Phê duyệt yêu cầu tham gia nhóm */
    async approveJoinRequest(groupId: string, userId: string): Promise<GroupDetail> {
        const { data } = await api.post("/group/join-requests/approve", { groupId, userId });
        return mapGroupResponse(data);
    },

    /** Từ chối yêu cầu tham gia nhóm */
    async rejectJoinRequest(groupId: string, userId: string): Promise<GroupDetail> {
        const { data } = await api.post("/group/join-requests/reject", { groupId, userId });
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

    /** Đổi tên nhóm */
    async renameGroup(groupId: string, groupName: string): Promise<GroupDetail> {
        const { data } = await api.put(`/group`, { groupId, groupName });
        return mapGroupResponse(data);
    },

    /** Thay đổi quyền thành viên (ADMIN / MEMBER) */
    async changeRole(groupId: string, targetUserId: string, role: 'ADMIN' | 'MEMBER'): Promise<GroupDetail> {
        const { data } = await api.put('/group/members/role', { groupId, targetUserId, role });
        return mapGroupResponse(data);
    },

    /** Cập nhật avatar nhóm */
    async updateGroupAvatar(groupId: string, avatarUrl: string): Promise<GroupDetail> {
        const { data } = await api.put('/group', { groupId, avatarUrl });
        return mapGroupResponse(data);
    },

    /** Giải tán nhóm */
    async disbandGroup(groupId: string): Promise<void> {
        await api.delete(`/group/${groupId}`);
    },

    // ----------------------------------------------------------------------
    // Group Admin Features
    // ----------------------------------------------------------------------

    /** Lấy cấu hình nhóm */
    async getGroupSettings(groupId: string): Promise<GroupSettings> {
        const { data } = await api.get(`/group/${groupId}/settings`);
        return data;
    },

    /** Cập nhật cấu hình nhóm */
    async updateGroupSettings(settings: Partial<GroupSettings> & { groupId: string }): Promise<GroupSettings> {
        const { data } = await api.put(`/group/settings`, settings);
        return data;
    },

    /** Chuyển nhượng quyền trưởng nhóm */
    async transferOwnership(groupId: string, newOwnerId: string): Promise<GroupDetail> {
        const { data } = await api.post(`/group/transfer-ownership`, { groupId, newOwnerId });
        return mapGroupResponse(data);
    },

    /** Chặn người dùng khỏi nhóm */
    async blockMember(groupId: string, targetUserId: string): Promise<void> {
        await api.post(`/group/block-member`, { groupId, targetUserId });
    },

    /** Bỏ chặn người dùng */
    async unblockMember(groupId: string, targetUserId: string): Promise<void> {
        await api.delete(`/group/${groupId}/block-member/${targetUserId}`);
    },

    /** Lấy danh sách thành viên bị chặn */
    async getBlockedMembers(groupId: string): Promise<BlockedMember[]> {
        const { data } = await api.get(`/group/${groupId}/blocked`);
        return data;
    },

    /** Tham gia nhóm bằng link */
    async joinByLink(joinToken: string): Promise<GroupDetail> {
        const { data } = await api.post(`/group/join/${joinToken}`);
        return mapGroupResponse(data);
    },

    /** Làm mới link tham gia */
    async refreshJoinLink(groupId: string): Promise<string> {
        const { data } = await api.post(`/group/${groupId}/refresh-link`);
        return data.message; // MessageResponse from backend
    },
};
