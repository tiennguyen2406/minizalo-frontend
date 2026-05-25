import React, { useCallback, useEffect } from 'react';

export type MediaGalleryItem = {
    url: string;
    kind: 'image' | 'video';
};

type MediaGalleryViewerProps = {
    items: MediaGalleryItem[];
    index: number | null;
    onIndexChange: (index: number) => void;
    onClose: () => void;
    zIndexClassName?: string;
};

const MediaGalleryViewer: React.FC<MediaGalleryViewerProps> = ({
    items,
    index,
    onIndexChange,
    onClose,
    zIndexClassName = 'z-[85]',
}) => {
    const activeItem = index !== null ? items[index] : null;
    const canPrev = index !== null && index > 0;
    const canNext = index !== null && index < items.length - 1;

    const goPrev = useCallback(() => {
        if (canPrev && index !== null) onIndexChange(index - 1);
    }, [canPrev, index, onIndexChange]);

    const goNext = useCallback(() => {
        if (canNext && index !== null) onIndexChange(index + 1);
    }, [canNext, index, onIndexChange]);

    useEffect(() => {
        if (!activeItem) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
            } else if (event.key === 'ArrowLeft') {
                event.preventDefault();
                goPrev();
            } else if (event.key === 'ArrowRight') {
                event.preventDefault();
                goNext();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [activeItem, goNext, goPrev, onClose]);

    if (!activeItem || index === null || items.length === 0) return null;

    const downloadActive = async (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        const url = activeItem.url;
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = url.split('/').pop()?.split('?')[0] || `file_${Date.now()}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(blobUrl);
        } catch {
            window.open(url, '_blank');
        }
    };

    return (
        <div
            className={`fixed inset-0 ${zIndexClassName} flex items-center justify-center bg-black/90`}
            onClick={onClose}
            role="presentation"
        >
            <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full bg-black/45 px-3 py-1 text-sm font-medium text-white">
                {index + 1} / {items.length}
            </div>

            <button
                type="button"
                className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
                onClick={(event) => {
                    event.stopPropagation();
                    onClose();
                }}
                title="Dong"
            >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>

            <button
                type="button"
                className="absolute right-16 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
                title="Tai ve"
                onClick={downloadActive}
            >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
            </button>

            {canPrev && (
                <button
                    type="button"
                    className="absolute left-5 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
                    title="Truoc"
                    onClick={(event) => {
                        event.stopPropagation();
                        goPrev();
                    }}
                >
                    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
            )}

            {canNext && (
                <button
                    type="button"
                    className="absolute right-5 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
                    title="Sau"
                    onClick={(event) => {
                        event.stopPropagation();
                        goNext();
                    }}
                >
                    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            )}

            <div className="mx-auto max-h-[90vh] max-w-[92vw]" onClick={(event) => event.stopPropagation()}>
                {activeItem.kind === 'video' ? (
                    <video
                        key={activeItem.url}
                        src={activeItem.url}
                        controls
                        playsInline
                        preload="metadata"
                        className="max-h-[88vh] max-w-[92vw] rounded-lg bg-black"
                    />
                ) : (
                    <img
                        src={activeItem.url}
                        alt=""
                        className="max-h-[88vh] max-w-[92vw] rounded-lg object-contain shadow-2xl"
                    />
                )}
            </div>
        </div>
    );
};

export default MediaGalleryViewer;
