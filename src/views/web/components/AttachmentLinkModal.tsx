import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface AttachmentLinkModalProps {
    open: boolean;
    onClose: () => void;
    fileUrl: string;
    /** Thêm dòng mô tả (ví dụ thư mục nhiều tệp) */
    subtitle?: string;
}

const AttachmentLinkModal: React.FC<AttachmentLinkModalProps> = ({ open, onClose, fileUrl, subtitle }) => {
    const [copiedUrl, setCopiedUrl] = useState(false);

    useEffect(() => {
        if (!open) setCopiedUrl(false);
    }, [open]);

    const copyFileUrl = async () => {
        try {
            await navigator.clipboard.writeText(fileUrl);
            setCopiedUrl(true);
            window.setTimeout(() => setCopiedUrl(false), 2000);
        } catch {
            /* ignore */
        }
    };

    if (!open) return null;

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="file-location-title"
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-3 sm:p-6"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-xl max-w-lg w-full shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center px-4 py-3 border-b border-gray-200">
                    <h2 id="file-location-title" className="text-sm font-semibold text-gray-900">
                        Nơi lưu trữ trên máy
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-gray-500 hover:bg-gray-100 rounded-lg p-1.5 text-sm"
                        aria-label="Đóng"
                    >
                        <span aria-hidden="true">×</span>
                    </button>
                </div>
                <div className="px-4 py-3 space-y-3">
                    <p className="text-xs text-gray-600 leading-relaxed">
                        Để xem tệp đã lưu <strong>trên máy bạn</strong>: nhấn nút <strong>Tải xuống</strong> (mũi tên) ngay trong khung tin nhắn, sau đó mở thư mục{' '}
                        <strong>Tải xuống</strong> (Downloads) trên Windows hoặc Mac — trình duyệt không thể bật File Explorer giúp bạn giống ứng dụng trên máy tính.
                    </p>
                    <p className="text-xs text-gray-500 leading-relaxed">
                        Liên kết dưới đây là địa chỉ tệp trên máy chủ (kho lưu trữ của ứng dụng), có thể sao chép hoặc mở trong tab mới.
                    </p>
                    {subtitle ? (
                        <p className="text-xs text-amber-900/90 leading-relaxed bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2">
                            {subtitle}
                        </p>
                    ) : null}
                    <div className="text-xs break-all font-mono bg-gray-50 border border-gray-200 rounded-lg p-2.5 max-h-28 overflow-y-auto text-gray-800">
                        {fileUrl || '(Không có liên kết)'}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => void copyFileUrl()}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
                        >
                            {copiedUrl ? 'Đã sao chép' : 'Sao chép liên kết'}
                        </button>
                        <button
                            type="button"
                            onClick={() => window.open(fileUrl, '_blank', 'noopener,noreferrer')}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                        >
                            Mở trong tab mới
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body,
    );
};

export default AttachmentLinkModal;
