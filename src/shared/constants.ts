/** Giới hạn upload đồng bộ web + mobile (bytes). Server multipart max ≈ 220MB. */
export const FILE_SIZE_LIMITS = {
    IMAGE: 20 * 1024 * 1024,
    VIDEO: 200 * 1024 * 1024,
    FILE: 100 * 1024 * 1024,
} as const;

export function getMaxBytesForMime(mime: string): number {
    const m = (mime || "").toLowerCase();
    if (m.startsWith("image/")) return FILE_SIZE_LIMITS.IMAGE;
    if (m.startsWith("video/")) return FILE_SIZE_LIMITS.VIDEO;
    return FILE_SIZE_LIMITS.FILE;
}

/** Trả về thông báo lỗi tiếng Việt nếu vượt quá, ngược lại null. */
export function validateFileSize(file: { size: number; type?: string; name?: string }): string | null {
    const max = getMaxBytesForMime(file.type || "");
    if (file.size > max) {
        const mb = (max / (1024 * 1024)).toFixed(0);
        return `Tệp vượt quá giới hạn ${mb} MB cho loại này.`;
    }
    return null;
}
