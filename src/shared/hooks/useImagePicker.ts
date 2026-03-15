import { useState, useCallback } from "react";
import * as ImagePicker from "expo-image-picker";
import { Alert, Platform } from "react-native";
import mediaService from "@/shared/services/mediaService";

type UseImagePickerOptions = {
    /** Thư mục trên MinIO (VD: "avatars/", "messages/") */
    folder?: string;
    /** Tỷ lệ khung hình (chỉ mobile) */
    aspect?: [number, number];
    /** Cho phép chỉnh sửa (crop) */
    allowsEditing?: boolean;
};

export function useImagePicker(options?: UseImagePickerOptions) {
    const folder = options?.folder ?? "images/";
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const requestPermission = async (type: "camera" | "library") => {
        const { status } = type === "camera" 
            ? await ImagePicker.requestCameraPermissionsAsync()
            : await ImagePicker.requestMediaLibraryPermissionsAsync();
        
        if (status !== "granted") {
            const msg = type === "camera" 
                ? "Thao tác yêu cầu quyền truy cập Camera." 
                : "Thao tác yêu cầu quyền truy cập Thư viện ảnh.";
            if (Platform.OS === "web") {
                alert(msg);
            } else {
                Alert.alert("Cần quyền truy cập", msg);
            }
            return false;
        }
        return true;
    };

    /** Chọn ảnh từ thư viện */
    const pickImage = async (): Promise<ImagePicker.ImagePickerAsset | null> => {
        const hasPermission = await requestPermission("library");
        if (!hasPermission) return null;

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: options?.allowsEditing ?? true,
            aspect: options?.aspect,
            quality: 0.8,
        });

        if (!result.canceled && result.assets?.[0]) {
            return result.assets[0];
        }
        return null;
    };

    /** Chụp ảnh mới */
    const takePhoto = async (): Promise<ImagePicker.ImagePickerAsset | null> => {
        const hasPermission = await requestPermission("camera");
        if (!hasPermission) return null;

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            allowsEditing: options?.allowsEditing ?? true,
            aspect: options?.aspect,
            quality: 0.8,
        });

        if (!result.canceled && result.assets?.[0]) {
            return result.assets[0];
        }
        return null;
    };

    /** 
     * Upload asset lên MinIO qua Presigned URL.
     * Trả về URL sạch (không query) nếu thành công.
     */
    const upload = async (asset: ImagePicker.ImagePickerAsset): Promise<string | null> => {
        setUploading(true);
        setError(null);
        try {
            // 1. Fetch URI để lấy Blob thực sự
            const response = await fetch(asset.uri);
            const blob = await response.blob();
            
            // 2. Xác định contentType chính xác
            let contentType = blob.type;
            if (!contentType || contentType === "application/octet-stream") {
                const extension = asset.uri.split(".").pop()?.toLowerCase();
                const mimeMap: Record<string, string> = {
                    "png": "image/png",
                    "webp": "image/webp",
                    "jpg": "image/jpeg",
                    "jpeg": "image/jpeg",
                    "gif": "image/gif"
                };
                contentType = mimeMap[extension || ""] || "image/jpeg";
            }

            const cleanFileName = asset.fileName || `img_${Date.now()}.${contentType.split("/")[1] || "jpg"}`;
            
            // 3. Lấy link upload (có gắn signature cho PUT + Content-Type)
            const presignedUrl = await mediaService.getPresignedUrl(folder, cleanFileName, contentType);

            // 4. Thực hiện upload trực tiếp (QUAN TRỌNG: Phải dùng cùng contentType đã ký)
            await mediaService.uploadFile(presignedUrl, blob, contentType);

            // 5. Trả về link sạch (không có query) để lưu vào DB
            const publicUrl = presignedUrl.split("?")[0];
            console.log("Upload Success! Public URL:", publicUrl);
            return publicUrl;
        } catch (e: any) {
            console.error("Upload process error:", e);
            setError(e.message || "Tải ảnh lên thất bại.");
            return null;
        } finally {
            setUploading(false);
        }
    };

    return {
        uploading,
        error,
        pickImage,
        takePhoto,
        upload,
    };
}

export default useImagePicker;

