import axios from "axios";
import {
    SignupRequest,
    LoginRequest,
    JwtResponse,
    MessageResponse,
} from "./types";

// Luôn có /api ở cuối: backend phục vụ tại /api/auth/signup, /api/auth/signin, ...
const rawBase =
    typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL
        ? process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, "")
        : "http://localhost:8080/api";
const API_BASE_URL = rawBase.endsWith("/api") ? rawBase : `${rawBase}/api`;

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

// Đảm bảo path không có slash thừa (tránh 401 do path không khớp permitAll)
const authPath = (path: string) => path.startsWith("/") ? path : `/${path}`;

export const authService = {
    signup: async (data: SignupRequest): Promise<MessageResponse> => {
        const path = authPath("auth/signup");
        if (__DEV__) {
            console.log("[authService] signup URL:", API_BASE_URL + path);
        }
        const response = await api.post<MessageResponse>(path, data);
        return response.data;
    },

    signin: async (data: LoginRequest): Promise<JwtResponse> => {
        const response = await api.post<JwtResponse>(authPath("auth/signin"), data);
        return response.data;
    },

    refreshToken: async (refreshToken: string): Promise<JwtResponse> => {
        const response = await api.post<JwtResponse>(authPath("auth/refreshtoken"), {
            refreshToken,
        });
        return response.data;
    },

    logout: async (accessToken: string, refreshToken?: string | null): Promise<MessageResponse> => {
        const response = await api.post<MessageResponse>(
            authPath("auth/logout"),
            refreshToken ? { refreshToken } : {},
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            }
        );
        return response.data;
    },

    /** Đăng ký: luôn gửi kèm email để backend kiểm tra trùng SĐT/email. */
    sendOtp: async (
        phone: string,
        channel: "SMS" | "EMAIL" = "SMS",
        email: string = "",
    ): Promise<void> => {
        await api.post(authPath("auth/send-otp"), { phone, channel, email: email.trim() });
    },

    verifyOtp: async (phone: string, otp: string): Promise<{ verificationToken: string }> => {
        const response = await api.post<{ verificationToken: string }>(authPath("auth/verify-otp"), { phone, otp });
        return response.data;
    },

    forgotPasswordSendOtp: async (phone: string): Promise<void> => {
        await api.post(authPath("auth/forgot-password/send-otp"), { phone });
    },

    resetPassword: async (phone: string, otp: string, newPassword: string, confirmPassword: string): Promise<void> => {
        await api.post(authPath("auth/reset-password"), { phone, otp, newPassword, confirmPassword });
    },

    generateQrSession: async (): Promise<{ sessionId: string; expiresAt: string }> => {
        const response = await api.get<{ sessionId: string; expiresAt: string }>(authPath("auth/qr-login/generate"));
        return response.data;
    },

    confirmQrLogin: async (sessionId: string, accessToken: string): Promise<void> => {
        await api.post(
            authPath("auth/qr-login/confirm"),
            { sessionId },
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );
    },
};

export default authService;
