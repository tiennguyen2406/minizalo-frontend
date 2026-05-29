/** Tên thư mục từ webkitRelativePath (chọn thư mục trên trình duyệt). */
export function deriveFolderNameFromFiles(files: File[]): string {
    if (!files.length) return 'Thư mục';
    const rel = files[0].webkitRelativePath;
    if (!rel) return 'Thư mục';
    const norm = rel.replace(/\\/g, '/');
    const i = norm.indexOf('/');
    if (i <= 0) return 'Thư mục';
    return norm.slice(0, i);
}

export type PickFolderResult =
    | { files: File[]; folderName: string }
    | 'aborted'
    | 'unsupported';

/** Tối thiểu cho File System Access (lib.dom cũ có thể chưa khai báo đủ). */
type FsDirHandle = {
    readonly name: string;
    values(): AsyncIterableIterator<FsHandle>;
};

type FsHandle = {
    readonly kind: string;
    readonly name: string;
};

async function getFileFromFsHandle(h: FsHandle): Promise<File> {
    const withFile = h as FsHandle & { getFile(): Promise<File> };
    return withFile.getFile();
}

/**
 * Đọc đệ quy file trong thư mục (File System Access API), gắn webkitRelativePath dạng `TênThưMục/...`
 * để deriveFolderNameFromFiles và metadata đính kèm hoạt động giống webkitdirectory.
 */
export async function collectFilesFromDirectoryHandle(
    dirHandle: FsDirHandle,
    rootFolderName: string,
    basePath = '',
): Promise<File[]> {
    const out: File[] = [];
    for await (const handle of dirHandle.values()) {
        const name = handle.name;
        const rel = basePath ? `${basePath}/${name}` : name;
        if (handle.kind === 'file') {
            const file = await getFileFromFsHandle(handle);
            const fullRel = `${rootFolderName}/${rel}`.replace(/\\/g, '/');
            try {
                Object.defineProperty(file, 'webkitRelativePath', {
                    value: fullRel,
                    enumerable: true,
                    configurable: true,
                });
            } catch {
                // Một số môi trường có thể không cho ghi; vẫn dùng folderName từ picker.
            }
            out.push(file);
        } else if (handle.kind === 'directory') {
            const nested = await collectFilesFromDirectoryHandle(
                handle as unknown as FsDirHandle,
                rootFolderName,
                rel,
            );
            out.push(...nested);
        }
    }
    return out;
}

/**
 * Chọn thư mục qua showDirectoryPicker — tránh hộp thoại Chromium “Tải N tệp lên trang web”
 * (khác với input webkitdirectory). Nếu API không có hoặc lỗi, trả 'unsupported' để fallback input.
 */
type WindowWithDirPicker = Window &
    typeof globalThis & {
        showDirectoryPicker?: () => Promise<FsDirHandle>;
    };

export async function pickFolderWithShowDirectoryPicker(): Promise<PickFolderResult> {
    if (typeof window === 'undefined') return 'unsupported';
    const picker = (window as WindowWithDirPicker).showDirectoryPicker;
    if (typeof picker !== 'function') return 'unsupported';
    try {
        const dirHandle = await picker.call(window);
        const folderName = dirHandle.name || 'Thư mục';
        const files = await collectFilesFromDirectoryHandle(dirHandle, folderName, '');
        return { files, folderName };
    } catch (e: unknown) {
        if (e instanceof DOMException && e.name === 'AbortError') return 'aborted';
        console.error('showDirectoryPicker failed', e);
        return 'unsupported';
    }
}

export function totalLocalFileBytes(files: File[]): number {
    return files.reduce((s, f) => s + f.size, 0);
}
