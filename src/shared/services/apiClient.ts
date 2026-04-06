import axios, { AxiosError, AxiosInstance } from "axios";
import { useAuthStore } from "@/shared/store/authStore";

// Base URL: always ends with /api
const rawBase =
    typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL
        ? process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, "")
        : "http://localhost:8080/api";
export const API_BASE_URL = rawBase.endsWith("/api") ? rawBase : `${rawBase}/api`;

type RetriableRequestConfig = {
    _retry?: boolean;
    headers?: any;
    url?: string;
};

let refreshInFlight: Promise<boolean> | null = null;

function shouldSkipAutoRefresh(url?: string): boolean {
    if (!url) return false;
    // Prevent refresh loop on auth endpoints
    return (
        url.includes("/auth/signin") ||
        url.includes("/auth/signup") ||
        url.includes("/auth/refreshtoken") ||
        url.includes("/auth/send-otp") ||
        url.includes("/auth/verify-otp") ||
        url.includes("/auth/forgot-password") ||
        url.includes("/auth/reset-password")
    );
}

export const api: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    headers: { "Content-Type": "application/json" },
});

// Attach Authorization automatically
api.interceptors.request.use((config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Auto refresh on 401 with single-flight refresh + retry
api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = (error.config || {}) as RetriableRequestConfig;
        const status = (error as any)?.response?.status;

        if (status === 401 && !originalRequest._retry && !shouldSkipAutoRefresh(originalRequest.url)) {
            originalRequest._retry = true;

            try {
                if (!refreshInFlight) {
                    refreshInFlight = useAuthStore.getState().refreshAuth();
                }
                const ok = await refreshInFlight;
                refreshInFlight = null;

                if (ok) {
                    const token = useAuthStore.getState().accessToken;
                    if (token) {
                        originalRequest.headers = originalRequest.headers || {};
                        originalRequest.headers.Authorization = `Bearer ${token}`;
                        return api(originalRequest as any);
                    }
                }
            } catch {
                refreshInFlight = null;
            }

            useAuthStore.getState().clear();
        }

        return Promise.reject(error);
    }
);

