import { api } from "@/shared/services/apiClient";
import type { UserProfile, UserProfileUpdateRequest } from "./types";

export const userService = {
    getProfile: async (): Promise<UserProfile> => {
        const { data } = await api.get<UserProfile>("/users/me");
        return data;
    },

    updateProfile: async (body: UserProfileUpdateRequest): Promise<UserProfile> => {
        const { data } = await api.put<UserProfile>("/users/profile", body);
        return data;
    },

    getUserProfile: async (userId: string): Promise<UserProfile> => {
        const { data } = await api.get<UserProfile>(`/users/profile/${userId}`);
        return data;
    },

    uploadAvatar: async (file: File): Promise<UserProfile> => {
        const formData = new FormData();
        formData.append("file", file);
        const { data } = await api.put<UserProfile>("/users/avatar", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
        return data;
    },

    uploadCoverPhoto: async (file: File): Promise<UserProfile> => {
        const formData = new FormData();
        formData.append("file", file);
        const { data } = await api.put<UserProfile>("/users/cover-photo", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
        return data;
    },

    lockAccount: async (password: string): Promise<void> => {
        await api.post("/users/lock-account", { password });
    },
};

export default userService;
