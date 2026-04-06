import axios from "axios";
import { api } from "@/shared/services/apiClient";

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

