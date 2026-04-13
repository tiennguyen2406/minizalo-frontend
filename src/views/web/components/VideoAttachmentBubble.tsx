import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
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

function VideoTypeIcon({ isMine }: { isMine: boolean }) {
    return (
        <div
            className={clsx(
                'p-2 rounded-lg shrink-0 flex items-center justify-center',
                isMine ? 'bg-violet-600 text-white' : 'bg-violet-100 text-violet-700',
            )}
        >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
            </svg>
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

interface VideoAttachmentBubbleProps {
    fileUrl: string;
    fileName?: string;
    fileSize?: number;
    isMine: boolean;
    /** Mở menu tin nhắn (Copy, Ghim, Trả lời, Chia sẻ, …) — neo theo nút ⋮ trên video */
    onOpenMessageMenu?: (anchor: HTMLElement) => void;
}

const VideoAttachmentBubble: React.FC<VideoAttachmentBubbleProps> = ({
    fileUrl,
    fileName,
    fileSize,
    isMine,
    onOpenMessageMenu,
}) => {
    const previewVideoRef = useRef<HTMLVideoElement>(null);
    const theaterVideoRef = useRef<HTMLVideoElement>(null);
    const theaterShellRef = useRef<HTMLDivElement>(null);
    const moreMenuBtnRef = useRef<HTMLButtonElement>(null);

    const [locationOpen, setLocationOpen] = useState(false);
    const [theaterOpen, setTheaterOpen] = useState(false);

    useEffect(() => {
        if (!theaterOpen) return;
        const v = theaterVideoRef.current;
        if (v) {
            void v.play().catch(() => {
                /* autoplay có thể bị chặn */
            });
        }
    }, [theaterOpen]);

    useEffect(() => {
        if (!theaterOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                theaterVideoRef.current?.pause();
                setTheaterOpen(false);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [theaterOpen]);

    const closeTheater = () => {
        theaterVideoRef.current?.pause();
        setTheaterOpen(false);
    };

    const toggleTheaterFullscreen = async () => {
        const el = theaterShellRef.current;
        if (!el) return;
        try {
            if (!document.fullscreenElement) {
                await el.requestFullscreen();
            } else {
                await document.exitFullscreen();
            }
        } catch {
            /* ignore */
        }
    };

    const title = fileName || 'Video';

    return (
        <div
            className={clsx(
                'flex flex-col w-full max-w-[280px] rounded-2xl overflow-hidden shadow-sm border',
                isMine ? 'border-blue-200/90 bg-[#e3f2ff]' : 'border-gray-200/90 bg-[#eef6fc]',
            )}
        >
            <div className="relative bg-black min-h-[148px] max-h-[200px]">
                <video
                    ref={previewVideoRef}
                    src={fileUrl}
                    className="w-full h-[148px] object-cover block pointer-events-none select-none"
                    preload="metadata"
                    playsInline
                    muted
                />
                <button
                    type="button"
                    className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/50 transition-colors cursor-pointer border-0 p-0"
                    aria-label="Xem video màn hình lớn"
                    title="Xem video màn hình lớn"
                    onClick={() => setTheaterOpen(true)}
                >
                    <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-white/95 text-gray-900 shadow-lg">
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    </span>
                </button>
                {onOpenMessageMenu && (
                    <button
                        ref={moreMenuBtnRef}
                        type="button"
                        className="absolute top-1.5 right-1.5 z-20 flex h-8 w-8 items-center justify-center rounded-full border-0 bg-black/50 text-white shadow-sm backdrop-blur-[2px] transition-colors hover:bg-black/65"
                        title="Thêm"
                        aria-label="Thêm tùy chọn tin nhắn"
                        onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            if (moreMenuBtnRef.current) onOpenMessageMenu(moreMenuBtnRef.current);
                        }}
                    >
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <circle cx="12" cy="5" r="2" />
                            <circle cx="12" cy="12" r="2" />
                            <circle cx="12" cy="19" r="2" />
                        </svg>
                    </button>
                )}
            </div>

            <div
                className={clsx(
                    'flex items-stretch border-t',
                    isMine ? 'border-blue-100/80 bg-white/75' : 'border-gray-100 bg-white/80',
                )}
            >
                <a
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Mở video trong tab mới"
                    className="flex flex-1 min-w-0 items-center gap-2.5 px-2.5 py-2.5 text-left no-underline text-inherit hover:bg-white/60 transition-colors"
                >
                    <VideoTypeIcon isMine={isMine} />
                    <div className="flex flex-col flex-1 min-w-0 gap-0.5">
                        <span className="text-sm font-semibold text-gray-900 truncate" title={fileName}>
                            {fileName || 'Video'}
                        </span>
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-gray-500">
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

            {theaterOpen &&
                createPortal(
                    <div
                        ref={theaterShellRef}
                        className="fixed inset-0 z-[10050] flex flex-col bg-black"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Trình phát video"
                    >
                        <div className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-zinc-950 px-3 py-2.5 text-white">
                            <span className="min-w-0 flex-1 truncate text-center text-sm font-medium sm:text-left" title={title}>
                                {title}
                            </span>
                            <button
                                type="button"
                                onClick={() => void toggleTheaterFullscreen()}
                                className="shrink-0 rounded-lg p-2 text-white/90 hover:bg-white/10"
                                title="Toàn màn hình"
                                aria-label="Toàn màn hình"
                            >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                                    />
                                </svg>
                            </button>
                            <button
                                type="button"
                                onClick={closeTheater}
                                className="shrink-0 rounded-lg p-2 text-white/90 hover:bg-white/10"
                                title="Đóng"
                                aria-label="Đóng"
                            >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="flex min-h-0 flex-1 items-center justify-center bg-black p-3 sm:p-6">
                            <video
                                ref={theaterVideoRef}
                                src={fileUrl}
                                className="max-h-full max-w-full rounded-lg shadow-2xl outline-none"
                                controls
                                playsInline
                                autoPlay
                            />
                        </div>
                    </div>,
                    document.body,
                )}
        </div>
    );
};

export default VideoAttachmentBubble;
