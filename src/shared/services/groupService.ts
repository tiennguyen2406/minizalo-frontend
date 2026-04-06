import { api } from "@/shared/services/apiClient";
import { GroupDetail } from "../types";

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
};
