import axios from "axios";
import { useAuthStore } from "@/shared/store/authStore";
import type { UserProfile, UserProfileUpdateRequest } from "./types";

// Chuẩn hóa base URL giống authService: luôn có /api (backend phục vụ /api/users/me, ...)
const rawBase =
    typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL
        ? process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, "")
        : "http://localhost:8080/api";
const API_BASE_URL = rawBase.endsWith("/api") ? rawBase : `${rawBase}/api`;

function getAuthHeaders() {
    const token = useAuthStore.getState().accessToken;
    return token ? { Authorization: `Bearer ${token}` } : {};
}

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: { "Content-Type": "application/json" },
});

// Khi gặp 401: thử refresh token, retry request; nếu refresh thất bại thì clear token
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
                        originalRequest.headers = originalRequest.headers || {};
                        originalRequest.headers.Authorization = `Bearer ${token}`;
                        return api(originalRequest);
                    }
                }
            } catch {
                // ignore
            }
            useAuthStore.getState().clear();
        }
        return Promise.reject(error);
    }
);

export const userService = {
    getProfile: async (): Promise<UserProfile> => {
        const { data } = await api.get<UserProfile>("/users/me", {
            headers: getAuthHeaders(),
        });
        return data;
    },

    updateProfile: async (body: UserProfileUpdateRequest): Promise<UserProfile> => {
        const { data } = await api.put<UserProfile>("/users/profile", body, {
            headers: getAuthHeaders(),
        });
        return data;
    },

    uploadAvatar: async (file: File): Promise<UserProfile> => {
        const formData = new FormData();
        formData.append("file", file);
        const { data } = await api.put<UserProfile>("/users/avatar", formData, {
            headers: {
                ...getAuthHeaders(),
                "Content-Type": "multipart/form-data",
            },
        });
        return data;
    },

    uploadCoverPhoto: async (file: File): Promise<UserProfile> => {
        const formData = new FormData();
        formData.append("file", file);
        const { data } = await api.put<UserProfile>("/users/cover-photo", formData, {
            headers: {
                ...getAuthHeaders(),
                "Content-Type": "multipart/form-data",
            },
        });
        return data;
    },
};

export default userService;
