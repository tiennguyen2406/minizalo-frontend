import React, { useState } from 'react';
import clsx from 'clsx';
import AttachmentLinkModal from './AttachmentLinkModal';

export type FileDocKind = 'pdf' | 'word' | 'excel' | 'ppt' | 'archive' | 'other';

export function inferFileDocKind(fileName: string, mime?: string): FileDocKind {
    const m = (mime || '').toLowerCase();
    const ext = (fileName.split('.').pop() || '').toLowerCase();
    if (m.includes('pdf') || ext === 'pdf') return 'pdf';
    if (
        m.includes('word') ||
        m.includes('msword') ||
        m.includes('officedocument.wordprocessing') ||
        ext === 'doc' ||
        ext === 'docx'
    )
        return 'word';
    if (
        m.includes('spreadsheet') ||
        m.includes('excel') ||
        m.includes('officedocument.spreadsheet') ||
        ['xls', 'xlsx', 'csv'].includes(ext)
    )
        return 'excel';
    if (
        m.includes('presentation') ||
        m.includes('officedocument.presentation') ||
        ext === 'ppt' ||
        ext === 'pptx'
    )
        return 'ppt';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';
    return 'other';
}

function formatSize(bytes?: number) {
    if (bytes == null || Number.isNaN(bytes)) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function FileTypeIcon({ kind, isMine }: { kind: FileDocKind; isMine: boolean }) {
    const base = 'p-2 rounded-lg shrink-0 flex items-center justify-center';
    const mineBg: Record<FileDocKind, string> = {
        pdf: 'bg-red-600 text-white',
        word: 'bg-[#2b579a] text-white',
        excel: 'bg-[#217346] text-white',
        ppt: 'bg-[#d24726] text-white',
        archive: 'bg-amber-600 text-white',
        other: 'bg-blue-500 text-white',
    };
    const theirsBg: Record<FileDocKind, string> = {
        pdf: 'bg-red-100 text-red-600',
        word: 'bg-blue-100 text-[#2b579a]',
        excel: 'bg-emerald-100 text-[#217346]',
        ppt: 'bg-orange-100 text-[#d24726]',
        archive: 'bg-amber-100 text-amber-700',
        other: 'bg-blue-100 text-blue-500',
    };
    return (
        <div className={clsx(base, isMine ? mineBg[kind] : theirsBg[kind])}>
            {kind === 'pdf' && <span className="text-xs font-black leading-none tracking-tighter">PDF</span>}
            {kind === 'word' && <span className="text-xs font-bold leading-none">W</span>}
            {kind === 'excel' && <span className="text-xs font-bold leading-none">X</span>}
            {kind === 'ppt' && <span className="text-xs font-bold leading-none">P</span>}
            {kind === 'archive' && (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
            )}
            {kind === 'other' && (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
            )}
        </div>
    );
}

/** Khung xem trước kiểu Zalo: tài liệu + chấm sáng */
function DocumentPreviewPlaceholder({ kind }: { kind: FileDocKind }) {
    const accent =
        kind === 'pdf'
            ? 'text-red-400/35'
            : kind === 'word'
              ? 'text-blue-400/35'
              : kind === 'excel'
                ? 'text-emerald-400/35'
                : 'text-gray-300';
    return (
        <div className="relative flex items-center justify-center w-full min-h-[148px] px-6 py-5">
            <svg
                className="w-[72px] h-[88px] text-gray-200"
                viewBox="0 0 72 88"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden
            >
                <path
                    d="M8 6C8 3.79086 9.79086 2 12 2H44L64 22V82C64 84.2091 62.2091 86 60 86H12C9.79086 86 8 84.2091 8 82V6Z"
                    fill="currentColor"
                    className="text-gray-100"
                />
                <path d="M44 2V18C44 20.2091 45.7909 22 48 22H64" stroke="#d1d5db" strokeWidth="1.5" />
                <rect x="16" y="34" width="40" height="3" rx="1" fill="#e5e7eb" />
                <rect x="16" y="44" width="32" height="3" rx="1" fill="#e5e7eb" />
                <rect x="16" y="54" width="36" height="3" rx="1" fill="#e5e7eb" />
            </svg>
            <span className={clsx('absolute top-5 right-7 flex gap-0.5', accent)}>
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
                <span className="w-1 h-1 rounded-full bg-current opacity-60 mt-0.5" />
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40" />
            </span>
        </div>
    );
}

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

interface FileAttachmentBubbleProps {
    fileUrl: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    isMine: boolean;
}

const outlineActionBtn = (isMine: boolean) =>
    clsx(
        'w-9 h-9 shrink-0 inline-flex items-center justify-center rounded-lg border bg-white/95 transition-colors',
        isMine
            ? 'border-blue-200 text-blue-600 hover:bg-blue-50'
            : 'border-blue-200/80 text-blue-600 hover:bg-blue-50/70',
    );

const FileAttachmentBubble: React.FC<FileAttachmentBubbleProps> = ({
    fileUrl,
    fileName,
    fileSize,
    mimeType,
    isMine,
}) => {
    const [locationOpen, setLocationOpen] = useState(false);
    const kind = inferFileDocKind(fileName || '', mimeType);

    return (
        <div
            className={clsx(
                'flex flex-col w-full max-w-[280px] rounded-2xl overflow-hidden shadow-sm border',
                isMine ? 'border-blue-200/90 bg-[#e3f2ff]' : 'border-gray-200/90 bg-[#eef6fc]',
            )}
        >
            <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Mở tệp trong tab mới"
                className="block bg-[color:var(--bg-primary)] hover:bg-gray-50/90 transition-colors border-b border-gray-100/80"
            >
                <DocumentPreviewPlaceholder kind={kind} />
            </a>

            <div
                className={clsx(
                    'flex items-stretch',
                    isMine ? 'bg-white/75 border-t border-blue-100/80' : 'bg-white/80 border-t border-[color:var(--border-primary)]',
                )}
            >
                <a
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Mở tệp trong tab mới"
                    className="flex flex-1 min-w-0 items-center gap-2.5 px-2.5 py-2.5 text-left no-underline text-inherit hover:bg-white/60 transition-colors"
                >
                    <FileTypeIcon kind={kind} isMine={isMine} />
                    <div className="flex flex-col flex-1 min-w-0 gap-0.5">
                        <span className="text-sm font-semibold text-[color:var(--text-primary)] truncate" title={fileName}>
                            {fileName || 'Tài liệu'}
                        </span>
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-[color:var(--text-secondary)]">
                            <span>{formatSize(fileSize)}</span>
                            <OnDeviceBadge />
                        </div>
                    </div>
                </a>
                <div
                    className="flex items-center gap-1.5 shrink-0 pr-2.5 py-2 pl-1"
                    role="group"
                    aria-label="Thao tác tệp"
                >
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
                    <a
                        href={fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={fileName}
                        className={clsx(outlineActionBtn(isMine), 'no-underline')}
                        title="Tải xuống"
                        aria-label="Tải xuống"
                    >
                        <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                    </a>
                </div>
            </div>

            <AttachmentLinkModal open={locationOpen} onClose={() => setLocationOpen(false)} fileUrl={fileUrl} />
        </div>
    );
};

export default FileAttachmentBubble;
