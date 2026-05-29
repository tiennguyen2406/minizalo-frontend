import axios, { AxiosError, AxiosInstance } from "axios";
import { useAuthStore } from "@/shared/store/authStore";

// Base URL: always ends with /api
const rawBase =
    process.env.EXPO_PUBLIC_API_URL
        ? process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, "")
        : "http://localhost:8080/api";
export const API_BASE_URL = rawBase.endsWith("/api") ? rawBase : `${rawBase}/api`;

type RetriableRequestConfig = {
    _retry?: boolean;
    headers?: any;
    url?: string;
};

// Single-flight refresh: all concurrent 401s share the same refresh promise
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

// Attach Authorization automatically on every request
api.interceptors.request.use((config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Auto refresh on 401 with single-flight refresh + retry.
//
// IMPORTANT: After a refresh, the old access-token's embedded session-token (st)
// is no longer valid in the database (backend rotates the refresh-token row).
// Therefore ALL concurrent requests that received 401 must:
//   1. Wait for the single-flight refresh to complete
//   2. Retry with the NEW access-token (read fresh from the store, not from the
//      original request config)
// If the refresh itself fails, we clear auth state ONCE (not per-request).
api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = (error.config || {}) as RetriableRequestConfig;
        const status = (error as any)?.response?.status;

        if (status === 401 && !originalRequest._retry && !shouldSkipAutoRefresh(originalRequest.url)) {
            originalRequest._retry = true;

            try {
                // All concurrent 401 handlers share the same refresh call
                if (!refreshInFlight) {
                    refreshInFlight = useAuthStore.getState().refreshAuth();
                }
                const ok = await refreshInFlight;
                // Don't clear refreshInFlight here — let the first awaiter clear it
                // after all concurrent awaiters have resolved.

                if (ok) {
                    // Read the FRESH token from the store (not the old one)
                    const newToken = useAuthStore.getState().accessToken;
                    if (newToken) {
                        // Update headers for the retry
                        originalRequest.headers = originalRequest.headers || {};
                        originalRequest.headers.Authorization = `Bearer ${newToken}`;
                        return api(originalRequest as any);
                    }
                }
            } catch {
                // refresh itself threw — fall through to clear
            } finally {
                // The first handler to reach finally clears the shared promise
                refreshInFlight = null;
            }

            // Refresh failed — clear auth state so the user is sent to login.
            // Guard: only clear if there's still a token (another concurrent handler
            // may have already cleared it).
            if (useAuthStore.getState().accessToken) {
                useAuthStore.getState().clear();
            }
        }

        return Promise.reject(error);
    }
);
