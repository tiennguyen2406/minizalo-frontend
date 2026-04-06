import { api } from "@/shared/services/apiClient";

export type FriendCategory = {
    id: string;
    name: string;
    color: string;
};

export type FriendCategoryAssignment = {
    targetUserId: string;
    categoryId: string | null;
};

export const friendCategoryService = {
    async listCategories(): Promise<FriendCategory[]> {
        const { data } = await api.get<FriendCategory[]>("/friend-categories");
        return data;
    },

    async createCategory(payload: { name: string; color: string }): Promise<FriendCategory> {
        const { data } = await api.post<FriendCategory>("/friend-categories", payload);
        return data;
    },

    async updateCategory(id: string, payload: { name: string; color: string }): Promise<FriendCategory> {
        const { data } = await api.put<FriendCategory>(`/friend-categories/${id}`, payload);
        return data;
    },

    async deleteCategory(id: string): Promise<void> {
        await api.delete(`/friend-categories/${id}`);
    },

    async listAssignments(): Promise<FriendCategoryAssignment[]> {
        const { data } = await api.get<FriendCategoryAssignment[]>("/friend-categories/assignments");
        return data;
    },

    /**
     * categoryId = null => hủy phân loại
     */
    async assignCategory(targetUserId: string, categoryId: string | null): Promise<FriendCategoryAssignment> {
        const { data } = await api.post<FriendCategoryAssignment>("/friend-categories/assignments", { targetUserId, categoryId });
        return data;
    },
};

export default friendCategoryService;

