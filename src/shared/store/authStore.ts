import { create } from "zustand";
import { Platform } from "react-native";
import authService from "@/shared/services/authService";
import type { LoginRequest, JwtResponse } from "@/shared/services/types";
import { getDeviceType, getOrCreateDeviceId } from "@/shared/utils/deviceSession";

// ──── Web persistence helpers (localStorage) ────
const WEB_STORAGE_KEY = "minizalo_auth";

function saveToWebStorage(data: { accessToken: string | null; refreshToken: string | null; impersonatorToken?: string | null; impersonatorRefreshToken?: string | null; user: any }) {
    if (Platform.OS !== "web") return;
    try {
        localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(data));
    } catch { /* ignore */ }
}

function loadFromWebStorage(): { accessToken: string | null; refreshToken: string | null; impersonatorToken?: string | null; impersonatorRefreshToken?: string | null; user: any } | null {
    if (Platform.OS !== "web") return null;
    try {
        const raw = localStorage.getItem(WEB_STORAGE_KEY);
        if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return null;
}

function clearWebStorage() {
    if (Platform.OS !== "web") return;
    try {
        localStorage.removeItem(WEB_STORAGE_KEY);
    } catch { /* ignore */ }
}

// ──── Hydrate initial state from web storage ────
const persisted = loadFromWebStorage();

type AuthState = {
    accessToken: string | null;
    refreshToken: string | null;
    impersonatorToken: string | null;
    impersonatorRefreshToken: string | null;
    user: import('./../types').User | null;
    isHydrated: boolean;
    setTokens: (accessToken: string, refreshToken: string, keepImpersonator?: boolean) => void;
    setImpersonatorTokens: (token: string, refresh: string) => void;
    restoreImpersonator: () => void;
    setUser: (user: import('./../types').User) => void;
    login: (data: LoginRequest) => Promise<void>;
    logout: () => Promise<void>;
    refreshAuth: () => Promise<boolean>;
    setHydrated: () => void;
    clear: () => void;
};

export const useAuthStore = create<AuthState>()((set, get) => ({
    accessToken: persisted?.accessToken || null,
    refreshToken: persisted?.refreshToken || null,
    impersonatorToken: persisted?.impersonatorToken || null,
    impersonatorRefreshToken: persisted?.impersonatorRefreshToken || null,
    user: persisted?.user || null,
    isHydrated: true,

    setHydrated: () => set({ isHydrated: true }),

    setUser: (user) => {
        set({ user });
        const { accessToken, refreshToken, impersonatorToken, impersonatorRefreshToken } = get();
        saveToWebStorage({ accessToken, refreshToken, impersonatorToken, impersonatorRefreshToken, user } as any);
    },

    setTokens: (accessToken, refreshToken, keepImpersonator = false) => {
        if (!keepImpersonator) {
            set({ accessToken, refreshToken, impersonatorToken: null, impersonatorRefreshToken: null });
        } else {
            set({ accessToken, refreshToken });
        }
        const state = get();
        saveToWebStorage({ accessToken: state.accessToken, refreshToken: state.refreshToken, impersonatorToken: state.impersonatorToken, impersonatorRefreshToken: state.impersonatorRefreshToken, user: state.user } as any);
        scheduleProactiveRefresh();
    },

    setImpersonatorTokens: (token, refresh) => {
        set({ impersonatorToken: token, impersonatorRefreshToken: refresh });
        const state = get();
        saveToWebStorage({ accessToken: state.accessToken, refreshToken: state.refreshToken, impersonatorToken: state.impersonatorToken, impersonatorRefreshToken: state.impersonatorRefreshToken, user: state.user } as any);
    },

    restoreImpersonator: () => {
        const { impersonatorToken, impersonatorRefreshToken } = get();
        if (impersonatorToken && impersonatorRefreshToken) {
            set({ accessToken: impersonatorToken, refreshToken: impersonatorRefreshToken, impersonatorToken: null, impersonatorRefreshToken: null });
            const state = get();
            saveToWebStorage({ accessToken: state.accessToken, refreshToken: state.refreshToken, impersonatorToken: null, impersonatorRefreshToken: null, user: state.user } as any);
            scheduleProactiveRefresh();
        }
    },

    login: async (data: LoginRequest) => {
        const deviceId = data.deviceId || (await getOrCreateDeviceId());
        const deviceType = data.deviceType || getDeviceType();
        const res: JwtResponse = await authService.signin({ ...data, deviceId, deviceType });
        const newState = {
            accessToken: res.accessToken,
            refreshToken: res.refreshToken,
        };
        set(newState);
        // Persist to web storage immediately (user will be set later by profile fetch)
        saveToWebStorage({ ...newState, user: get().user });
        scheduleProactiveRefresh();
    },

    logout: async () => {
        const { accessToken, refreshToken } = get();
        if (accessToken) {
            try {
                await authService.logout(accessToken, refreshToken);
            } catch {
                // ignore network error on logout
            }
        }
        // Deactivate WebSocket
        const { webSocketService } = await import('@/shared/services/WebSocketService');
        webSocketService.deactivate();

        set({ accessToken: null, refreshToken: null, impersonatorToken: null, impersonatorRefreshToken: null, user: null });
        clearWebStorage();
        cancelProactiveRefresh();
    },

    refreshAuth: async (): Promise<boolean> => {
        const { refreshToken } = get();
        if (!refreshToken) return false;
        try {
            const res = await authService.refreshToken(refreshToken);
            const newState = {
                accessToken: res.accessToken,
                refreshToken: res.refreshToken,
            };
            set(newState);
            const state = get();
            saveToWebStorage({ ...newState, impersonatorToken: state.impersonatorToken, impersonatorRefreshToken: state.impersonatorRefreshToken, user: state.user } as any);
            scheduleProactiveRefresh();
            return true;
        } catch {
            set({ accessToken: null, refreshToken: null, impersonatorToken: null, impersonatorRefreshToken: null });
            clearWebStorage();
            cancelProactiveRefresh();
            return false;
        }
    },

    clear: () => {
        set({ accessToken: null, refreshToken: null, impersonatorToken: null, impersonatorRefreshToken: null, user: null });
        clearWebStorage();
        cancelProactiveRefresh();
    },
}));

export const isAuthenticated = (): boolean => {
    return !!useAuthStore.getState().accessToken;
};

// ─── Proactive refresh (keep user logged in while using app) ───
let refreshTimer: any = null;

function cancelProactiveRefresh() {
    if (refreshTimer) {
        clearTimeout(refreshTimer);
        refreshTimer = null;
    }
}

function decodeJwtExpMs(token: string): number | null {
    try {
        const parts = token.split(".");
        if (parts.length < 2) return null;
        const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        // pad base64
        const pad = payload.length % 4;
        const padded = pad ? payload + "=".repeat(4 - pad) : payload;
        const json = typeof atob !== "undefined" ? atob(padded) : Buffer.from(padded, "base64").toString("utf-8");
        const data = JSON.parse(json);
        if (typeof data.exp !== "number") return null;
        return data.exp * 1000;
    } catch {
        return null;
    }
}

function scheduleProactiveRefresh() {
    cancelProactiveRefresh();

    const { accessToken, refreshToken } = useAuthStore.getState();
    if (!accessToken || !refreshToken) return;

    const expMs = decodeJwtExpMs(accessToken);
    if (!expMs) return;

    // Refresh a bit before expiry (90 seconds)
    const refreshAt = expMs - 90_000;
    const delay = Math.max(5_000, refreshAt - Date.now());

    refreshTimer = setTimeout(async () => {
        const ok = await useAuthStore.getState().refreshAuth();
        if (!ok) {
            useAuthStore.getState().clear();
        }
        // refreshAuth() will reschedule on success
    }, delay);
}

