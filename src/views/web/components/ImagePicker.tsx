import React, { useRef } from "react";
import { useImagePicker } from "@/shared/hooks/useImagePicker";

type ImagePickerProps = {
    label?: string;
    folder?: string;
    onUploaded?: (url: string) => void;
};

export default function ImagePicker({ label = "Chọn ảnh", folder, onUploaded }: ImagePickerProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const { preview, uploading, error, selectFile, upload, clearPreview } = useImagePicker({
        folder,
    });

    const handleClick = () => {
        inputRef.current?.click();
    };

    const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null;
        if (!file) return;

        selectFile(file);
        
        const url = await upload(file);
        if (url && onUploaded) {
            onUploaded(url);
        }
        e.target.value = "";
    };

    return (
        <div className="flex flex-col gap-2">
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleChange}
            />
            <button
                type="button"
                onClick={handleClick}
                disabled={uploading}
                className={`px-4 py-2 rounded-full border border-dashed border-blue-300 bg-blue-50 text-blue-700 text-sm font-medium flex items-center gap-2 hover:bg-blue-100 transition-colors ${uploading ? 'cursor-wait' : 'cursor-pointer'}`}
            >
                <span className="w-5 h-5 rounded-full bg-blue-700 text-white flex items-center justify-center font-bold text-xs">
                    +
                </span>
                {uploading ? "Đang tải ảnh..." : label}
            </button>

            {preview && (
                <div className="relative w-32 h-32 rounded-xl overflow-hidden shadow-lg border-2 border-white">
                    <img
                        src={preview}
                        alt="Xem tiếp"
                        className="w-full h-full object-cover"
                    />
                    <button
                        type="button"
                        onClick={clearPreview}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center text-lg leading-none hover:bg-black transition-colors"
                    >
                        &times;
                    </button>
                </div>
            )}

            {error && (
                <div className="text-xs text-red-600 px-1">
                    {error}
                </div>
            )}
        </div>
    );
}

