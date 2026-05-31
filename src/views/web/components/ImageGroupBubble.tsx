import React, { useState, useRef } from 'react';
import { Message, User } from '@/shared/types';
import clsx from 'clsx';
import { getImageUrl } from '@/shared/utils/mediaUtils';

interface ImageGroupBubbleProps {
    messages: Message[];
    isMine: boolean;
    showAvatar?: boolean;
    senderName?: string;
    senderAvatar?: string;
    participants?: User[];
    onImageLoad?: () => void;
    /** Thu hồi cả nhóm: truyền mọi messageId ảnh trong lượt gửi */
    onRecall?: (messageIds: string | string[]) => void;
    onDeleteForMe?: (messageId: string) => void;
    onForward?: (message: Message | Message[]) => void;
    onReply?: (message: Message) => void;
    onTogglePin?: (messageId: string, currentPinStatus: boolean) => void;
    /** Cuộn xem toàn bộ ảnh/video trong chat */
    onOpenChatGallery?: (resolvedMediaUrl: string) => void;
}

const MAX_VISIBLE = 4;

const getAvatarUrl = (name: string, avatarUrl?: string) => {
    if (avatarUrl) return getImageUrl(avatarUrl);
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4A90D9&color=fff&size=64`;
};

const ImageGroupBubble: React.FC<ImageGroupBubbleProps> = ({
    messages,
    isMine,
    showAvatar = false,
    senderName,
    senderAvatar,
    participants = [],
    onImageLoad,
    onRecall,
    onDeleteForMe,
    onForward,
    onReply,
    onTogglePin,
    onOpenChatGallery,
}) => {
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const [menuPos, setMenuPos] = useState<{ top: number; left?: number; right?: number } | null>(null);
    const moreButtonRef = useRef<HTMLButtonElement>(null);
    const displayName = senderName || 'Unknown';
    const representativeMsg = messages[messages.length - 1];

    const imageUrls = messages.map((m) => {
        const attachment = m.attachments?.[0];
        return getImageUrl(m.fileUrl || attachment?.url || '');
    }).filter(Boolean);

    const count = imageUrls.length;
    const visibleCount = Math.min(count, MAX_VISIBLE);
    const extraCount = count - MAX_VISIBLE;

    // Grid layout strategy like Zalo
    const getGridStyle = (): React.CSSProperties => {
        if (count === 1) return { display: 'grid', gridTemplateColumns: '1fr', gap: 2 };
        if (count === 2) return { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 };
        if (count === 3) return { display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'auto auto', gap: 2 };
        return { display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'auto auto', gap: 2 };
    };

    const getImageStyle = (index: number): React.CSSProperties => {
        const base: React.CSSProperties = {
            width: '100%',
            objectFit: 'cover',
            cursor: 'pointer',
            borderRadius: 6,
        };
        if (count === 1) return { ...base, maxWidth: 280, maxHeight: 300 };
        if (count === 2) return { ...base, height: 140 };
        if (count === 3 && index === 0) return { ...base, height: 180, gridRow: '1 / 3' };
        if (count === 3) return { ...base, height: 88 };
        return { ...base, height: 120 };
    };

    const timestamp = messages[messages.length - 1]?.createdAt;

    return (
        <>
            <div className={clsx('flex flex-row items-end', isMine ? 'justify-end' : 'justify-start', 'mb-3')}>
                {/* Avatar */}
                {!isMine && (
                    <div className="mr-1.5 self-end flex-shrink-0" style={{ width: 32 }}>
                        {showAvatar ? (
                            <img
                                src={getAvatarUrl(displayName, senderAvatar)}
                                alt={displayName}
                                className="w-8 h-8 rounded-full object-cover"
                            />
                        ) : (
                            <div className="w-8 h-8" />
                        )}
                    </div>
                )}

                <div className={clsx('max-w-[70%] flex flex-col relative group/bubble', isMine ? 'items-end' : 'items-start')}>
                    {/* Sender name */}
                    {!isMine && senderName && (
                        <span className="text-xs text-[color:var(--text-secondary)] mb-0.5 ml-1 font-medium">{senderName}</span>
                    )}

                    {/* Image Grid */}
                    <div
                        className={clsx(
                            'rounded-2xl overflow-hidden p-1 relative message-bubble-content',
                            isMine ? 'bg-[#e5f1ff] border border-blue-100' : 'bg-[color:var(--bg-primary)] shadow-sm border border-[color:var(--border-primary)]'
                        )}
                        style={getGridStyle()}
                        onContextMenu={(e) => {
                            e.preventDefault();
                            setShowMoreMenu(true);
                        }}
                    >
                        {imageUrls.slice(0, visibleCount).map((url, index) => (
                            <div
                                key={messages[index]?.id || index}
                                className="relative overflow-hidden"
                                style={count === 3 && index === 0 ? { gridRow: '1 / 3' } : undefined}
                            >
                                <img
                                    src={url}
                                    alt={`Ảnh ${index + 1}`}
                                    style={getImageStyle(index)}
                                    onClick={() => {
                                        const raw = imageUrls[index];
                                        if (onOpenChatGallery && raw) {
                                            onOpenChatGallery(getImageUrl(raw) || raw);
                                        } else {
                                            setLightboxIndex(index);
                                        }
                                    }}
                                    onLoad={index === 0 ? onImageLoad : undefined}
                                    loading="lazy"
                                />
                                {/* +N overlay on last image */}
                                {index === visibleCount - 1 && extraCount > 0 && (
                                    <div
                                        className="absolute inset-0 bg-black/50 flex items-center justify-center cursor-pointer rounded-md"
                                        onClick={() => {
                                            const raw = imageUrls[index];
                                            if (onOpenChatGallery && raw) {
                                                onOpenChatGallery(getImageUrl(raw) || raw);
                                            } else {
                                                setLightboxIndex(index);
                                            }
                                        }}
                                    >
                                        <span className="text-white text-xl font-bold">+{extraCount}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Hover action buttons: Reply + More — outside grid to avoid overflow-hidden clipping */}
                    <div className={clsx(
                        "absolute top-1/2 -translate-y-1/2 opacity-0 group-hover/bubble:opacity-100 transition-opacity flex items-center gap-1 z-10",
                        isMine ? "right-full mr-2" : "left-full ml-2"
                    )}>
                        {onReply && (
                            <button
                                onClick={() => onReply(representativeMsg)}
                                className="bg-[color:var(--bg-primary)] text-[color:var(--text-secondary)] shadow-sm border border-[color:var(--border-primary)] rounded-full w-7 h-7 flex items-center justify-center hover:bg-[color:var(--bg-hover)] focus:outline-none"
                                title="Trả lời"
                            >
                                <svg className="w-3.5 h-3.5 transform -scale-x-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                </svg>
                            </button>
                        )}
                        <div className="relative">
                            <button
                                ref={moreButtonRef}
                                onClick={() => {
                                    const btn = moreButtonRef.current;
                                    if (!btn) return;
                                    const rect = btn.getBoundingClientRect();
                                    const spaceBelow = window.innerHeight - rect.bottom;
                                    const menuHeight = 260;
                                    const openUpward = spaceBelow < menuHeight;
                                    if (openUpward) {
                                        setMenuPos({
                                            top: rect.top - menuHeight,
                                            ...(isMine ? { right: window.innerWidth - rect.right } : { left: rect.left }),
                                        });
                                    } else {
                                        setMenuPos({
                                            top: rect.bottom + 4,
                                            ...(isMine ? { right: window.innerWidth - rect.right } : { left: rect.left }),
                                        });
                                    }
                                    setShowMoreMenu(true);
                                }}
                                className="bg-[color:var(--bg-primary)] text-[color:var(--text-secondary)] shadow-sm border border-[color:var(--border-primary)] rounded-full w-7 h-7 flex items-center justify-center hover:bg-[color:var(--bg-hover)] focus:outline-none"
                                title="Thêm"
                            >
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                    <circle cx="5" cy="12" r="2" />
                                    <circle cx="12" cy="12" r="2" />
                                    <circle cx="19" cy="12" r="2" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Fixed-position more menu */}
                    {showMoreMenu && menuPos && (
                        <>
                            <div
                                style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
                                onClick={() => { setShowMoreMenu(false); setMenuPos(null); }}
                            />
                            <div
                                style={{
                                    position: 'fixed',
                                    top: menuPos.top,
                                    left: menuPos.left,
                                    right: menuPos.right,
                                    zIndex: 9999,
                                    minWidth: 180,
                                }}
                                className="bg-[color:var(--bg-primary)] rounded-xl shadow-lg border border-[color:var(--border-primary)] py-1.5"
                            >
                                {onTogglePin && (
                                    <button
                                        onClick={() => { onTogglePin(representativeMsg.id, !!representativeMsg.pinned); setShowMoreMenu(false); setMenuPos(null); }}
                                        className="w-full flex items-center gap-3 px-3.5 py-2 text-sm text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-hover)] transition-colors"
                                    >
                                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                                        {representativeMsg.pinned ? 'Bỏ ghim' : 'Ghim tin nhắn'}
                                    </button>
                                )}
                                {onReply && (
                                    <button
                                        onClick={() => { onReply(representativeMsg); setShowMoreMenu(false); setMenuPos(null); }}
                                        className="w-full flex items-center gap-3 px-3.5 py-2 text-sm text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-hover)] transition-colors"
                                    >
                                        <svg className="w-4 h-4 text-gray-400 transform -scale-x-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                                        Trả lời
                                    </button>
                                )}
                                <button
                                    onClick={() => { onForward?.(messages); setShowMoreMenu(false); setMenuPos(null); }}
                                    className="w-full flex items-center gap-3 px-3.5 py-2 text-sm text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-hover)] transition-colors"
                                >
                                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                                    Chia sẻ
                                </button>
                                <div className="border-t border-[color:var(--border-primary)] my-1" />
                                {isMine && onRecall && (
                                    <button
                                        onClick={() => {
                                            const ids = messages.map((m) => m.id).filter(Boolean);
                                            onRecall(ids.length ? ids : representativeMsg.id);
                                            setShowMoreMenu(false);
                                            setMenuPos(null);
                                        }}
                                        className="w-full flex items-center gap-3 px-3.5 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                                        Thu hồi
                                    </button>
                                )}
                                <button
                                    onClick={() => { onDeleteForMe?.(representativeMsg.id); setShowMoreMenu(false); setMenuPos(null); }}
                                    className="w-full flex items-center gap-3 px-3.5 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    Xoá ở phía tôi
                                </button>
                            </div>
                        </>
                    )}

                    {/* Timestamp */}
                    {timestamp && (
                        <span className="text-[11px] text-gray-400 mt-1 px-1 leading-none">
                            {new Date(timestamp).toLocaleTimeString('vi-VN', {
                                hour: '2-digit',
                                minute: '2-digit',
                            })}
                        </span>
                    )}
                </div>
            </div>

            {/* Lightbox Viewer */}
            {lightboxIndex !== null && (
                <div
                    className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
                    onClick={() => setLightboxIndex(null)}
                >
                    <img
                        src={imageUrls[lightboxIndex]}
                        alt=""
                        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
                        onClick={(e) => e.stopPropagation()}
                    />

                    {/* Navigation arrows */}
                    {lightboxIndex > 0 && (
                        <button
                            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                            onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                    )}
                    {lightboxIndex < imageUrls.length - 1 && (
                        <button
                            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                            onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    )}

                    {/* Counter */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm px-3 py-1 rounded-full">
                        {lightboxIndex + 1} / {imageUrls.length}
                    </div>

                    {/* Close button */}
                    <button
                        className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                        onClick={() => setLightboxIndex(null)}
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            )}
        </>
    );
};

export default ImageGroupBubble;
