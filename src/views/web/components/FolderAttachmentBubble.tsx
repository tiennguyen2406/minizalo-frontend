import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import type { Attachment } from '@/shared/types';
import AttachmentLinkModal from './AttachmentLinkModal';

function formatSize(bytes?: number) {
    if (bytes == null || Number.isNaN(bytes)) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const outlineActionBtn = (isMine: boolean) =>
    clsx(
        'w-9 h-9 shrink-0 inline-flex items-center justify-center rounded-lg border bg-white/95 transition-colors',
        isMine
            ? 'border-blue-200 text-blue-600 hover:bg-blue-50'
            : 'border-blue-200/80 text-blue-600 hover:bg-blue-50/70',
    );

function OnDeviceBadge() {
    return (
        <span className="inline-flex items-center gap-0.5 text-emerald-600 shrink-0">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
            </svg>
            <span className="whitespace-nowrap">Đã có trên máy</span>
        </span>
    );
}

function FolderPreviewArt() {
    return (
        <div className="relative flex items-center justify-center w-full min-h-[148px] px-6 py-5 bg-amber-50/90">
            <svg
                className="w-[88px] h-[72px] text-amber-400 drop-shadow-sm"
                viewBox="0 0 88 72"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden
            >
                <path
                    d="M8 28C8 25.7909 9.79086 24 12 24H32L38 18H76C78.2091 18 80 19.7909 80 22V60C80 62.2091 78.2091 64 76 64H12C9.79086 64 8 62.2091 8 60V28Z"
                    fill="currentColor"
                    className="text-amber-300"
                />
                <path
                    d="M8 28C8 25.7909 9.79086 24 12 24H34L40 18H76C78.2091 18 80 19.7909 80 22V32H8V28Z"
                    fill="currentColor"
                    className="text-amber-400"
                />
            </svg>
        </div>
    );
}

interface FolderAttachmentBubbleProps {
    folderName: string;
    totalSize: number;
    fileCount: number;
    attachments: Attachment[];
    isMine: boolean;
}

const FolderAttachmentBubble: React.FC<FolderAttachmentBubbleProps> = ({
    folderName,
    totalSize,
    fileCount,
    attachments,
    isMine,
}) => {
    const [filesModalOpen, setFilesModalOpen] = useState(false);
    const [locationOpen, setLocationOpen] = useState(false);

    const primaryUrl = attachments[0]?.url;

    return (
        <div
            className={clsx(
                'flex flex-col w-full max-w-[280px] rounded-2xl overflow-hidden shadow-sm border',
                isMine ? 'border-blue-200/90 bg-[#e3f2ff]' : 'border-gray-200/90 bg-[#eef6fc]',
            )}
        >
            <button
                type="button"
                onClick={() => setFilesModalOpen(true)}
                className="block w-full text-left border-0 p-0 cursor-pointer border-b border-amber-100/60 hover:opacity-95 transition-opacity"
                title="Xem danh sách tệp trong thư mục"
            >
                <FolderPreviewArt />
            </button>

            <div
                className={clsx(
                    'flex items-stretch',
                    isMine ? 'bg-white/75 border-t border-blue-100/80' : 'bg-white/80 border-t border-[color:var(--border-primary)]',
                )}
            >
                <button
                    type="button"
                    onClick={() => setFilesModalOpen(true)}
                    className="flex flex-1 min-w-0 items-center gap-2.5 px-2.5 py-2.5 text-left border-0 cursor-pointer bg-transparent hover:bg-white/60 transition-colors"
                >
                    <div
                        className={clsx(
                            'p-2 rounded-lg shrink-0 flex items-center justify-center',
                            isMine ? 'bg-amber-400 text-white' : 'bg-amber-100 text-amber-700',
                        )}
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                            <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                        </svg>
                    </div>
                    <div className="flex flex-col flex-1 min-w-0 gap-0.5">
                        <span className="text-sm font-semibold text-[color:var(--text-primary)] truncate" title={folderName}>
                            {folderName}
                        </span>
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-[color:var(--text-secondary)]">
                            <span>
                                {formatSize(totalSize)}
                                {fileCount > 0 ? ` · ${fileCount} tệp` : ''}
                            </span>
                            <OnDeviceBadge />
                        </div>
                    </div>
                </button>
                <div className="flex items-center gap-1.5 shrink-0 pr-2.5 py-2 pl-1" role="group" aria-label="Thao tác thư mục">
                    <button
                        type="button"
                        className={outlineActionBtn(isMine)}
                        title="Mở nơi lưu trữ trên máy"
                        aria-label="Mở nơi lưu trữ trên máy"
                        onClick={() => setLocationOpen(true)}
                    >
                        <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                            />
                        </svg>
                    </button>
                    <button
                        type="button"
                        className={outlineActionBtn(isMine)}
                        title="Tải xuống (mở danh sách tệp)"
                        aria-label="Tải xuống"
                        onClick={() => setFilesModalOpen(true)}
                    >
                        <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                    </button>
                </div>
            </div>

            <AttachmentLinkModal
                open={locationOpen}
                onClose={() => setLocationOpen(false)}
                fileUrl={primaryUrl || ''}
                subtitle={`Thư mục "${folderName}" — ${fileCount} tệp. Liên kết mẫu (tệp đầu tiên):`}
            />

            {filesModalOpen &&
                createPortal(
                    <div
                        role="dialog"
                        aria-modal="true"
                        className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-3"
                        onClick={() => setFilesModalOpen(false)}
                    >
                        <div
                            className="bg-[color:var(--bg-primary)] rounded-xl max-w-md w-full max-h-[80vh] flex flex-col shadow-xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex justify-between items-center px-4 py-3 border-b">
                                <h2 className="text-sm font-semibold text-[color:var(--text-primary)] truncate pr-2">{folderName}</h2>
                                <button
                                    type="button"
                                    onClick={() => setFilesModalOpen(false)}
                                    className="text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-secondary)] rounded-lg p-1.5 text-sm shrink-0"
                                    aria-label="Đóng"
                                >
                                    ×
                                </button>
                            </div>
                            <p className="text-xs text-[color:var(--text-secondary)] px-4 pt-2">
                                {fileCount} tệp — chọn từng liên kết để mở hoặc tải (trình duyệt có thể chặn tải hàng loạt).
                            </p>
                            <ul className="overflow-y-auto flex-1 min-h-0 px-2 py-2 space-y-1">
                                {attachments.map((a, i) => {
                                    const label = a.name || a.filename || `Tệp ${i + 1}`;
                                    return (
                                        <li key={`${a.url}-${i}`}>
                                            <a
                                                href={a.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                download={label.split('/').pop()}
                                                className="flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-[color:var(--bg-hover)] text-sm text-blue-600 break-all"
                                            >
                                                <span>{label}</span>
                                                <span className="text-xs text-gray-400 shrink-0">{formatSize(a.size)}</span>
                                            </a>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    </div>,
                    document.body,
                )}
        </div>
    );
};

export default FolderAttachmentBubble;
