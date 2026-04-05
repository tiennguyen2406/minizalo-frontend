import axios from "axios";
import { useAuthStore } from "@/shared/store/authStore";

const rawBase =
    typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL
        ? process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, "")
        : "http://localhost:8080/api";

// Đảm bảo BASE_URL luôn trỏ đến /api để khớp với security config backend
const API_BASE_URL = rawBase.endsWith("/api") ? rawBase : `${rawBase}/api`;

function getAuthHeaders() {
    const token = useAuthStore.getState().accessToken;
    return token ? { Authorization: `Bearer ${token}` } : {};
}

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

// Interceptor xử lý refresh token khi gặp lỗi 401
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

export const mediaService = {
    /**
     * Lấy presigned URL để upload file (PUT) trực tiếp lên MinIO.
     * Trả về chính URL BE trả về (có query ký số).
     */
    async getPresignedUrl(folder: string, fileName: string, contentType: string): Promise<string> {
        const { data } = await api.post<{ url: string }>("/media/presigned-url", {
            folder,
            fileName,
            contentType,
        }, {
            headers: getAuthHeaders()
        });
        return data.url;
    },
    /**
     * Upload file (Blob/File) trực tiếp lên một pre-signed URL bằng method PUT.
     */
    async uploadFile(presignedUrl: string, blob: Blob | File, contentType?: string): Promise<void> {
        // Sử dụng axios.put trực tiếp để tránh các interceptors của instance 'api'
        await axios.put(presignedUrl, blob, {
            headers: {
                "Content-Type": contentType,
            },
            // Quan trọng: Ngăn axios tự thêm charset hoặc transform dữ liệu
            transformRequest: [(data) => data],
        });
    },
};

export default mediaService;

