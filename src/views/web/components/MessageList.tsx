import React, { useEffect, useRef, useCallback, useState, useLayoutEffect, useMemo } from 'react';
import MessageBubble from './MessageBubble';
import ImageGroupBubble from './ImageGroupBubble';
import { Message, User } from '@/shared/types';
import { useChatStore } from '@/shared/store/useChatStore';
import { getImageAttachmentUrls } from '@/shared/utils/messageAttachments';
import { buildChatGalleryItems, findChatGalleryIndex, type ChatGalleryItem } from '@/shared/utils/chatGallery';
import { getImageUrl } from '@/shared/utils/mediaUtils';
import { dedupCallMessages } from '@/shared/utils/dedupCallMessages';
import LazyImage from './LazyImage';

interface MessageListProps {
    messages: Message[];
    currentUserId: string;
    roomId?: string;
    participants?: User[];
    onRecall?: (messageId: string | string[]) => void;
    onReact?: (messageId: string, emoji: string) => void;
    onReply?: (message: Message) => void;
    onTogglePin?: (messageId: string, currentPinStatus: boolean) => void;
    onRemoveAllReactions?: (messageId: string) => void;
    onDeleteForMe?: (messageId: string) => void;
    onForward?: (message: Message | Message[]) => void;
    /** Cuộn lên gần đầu danh sách để tải thêm tin cũ */
    onLoadOlder?: () => void;
    hasMoreOlder?: boolean;
    loadingOlder?: boolean;
}

// ── Skeleton row ──────────────────────────────────────────────────────────────
function SkeletonBubble({ align }: { align: 'left' | 'right' }) {
    const isRight = align === 'right';
    return (
        <div style={{
            display: 'flex',
            justifyContent: isRight ? 'flex-end' : 'flex-start',
            padding: '4px 16px',
            gap: 8,
            alignItems: 'flex-end',
        }}>
            {!isRight && (
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#e5e7eb', flexShrink: 0, animation: 'pulse 1.4s ease-in-out infinite' }} />
            )}
            <div style={{
                width: `${Math.random() * 120 + 80}px`,
                height: 38,
                borderRadius: isRight ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                background: isRight ? '#dbeafe' : '#e5e7eb',
                animation: 'pulse 1.4s ease-in-out infinite',
            }} />
        </div>
    );
}

function LocalLazyImage({ src, alt, style, onClick, onLoad }: { src: string; alt: string; style?: React.CSSProperties; onClick?: () => void; onLoad?: () => void }) {
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(false);
    return (
        <div style={{ position: 'relative', display: 'inline-block', ...style }}>
            {/* Skeleton background while loading */}
            {!loaded && !error && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 1.5s infinite',
                    borderRadius: 'inherit',
                }} />
            )}
            <img
                src={src}
                alt={alt}
                onLoad={() => { setLoaded(true); onLoad?.(); }}
                onError={() => setError(true)}
                onClick={onClick}
                style={{
                    ...style,
                    opacity: loaded ? 1 : 0,
                    transition: 'opacity 0.3s ease',
                    display: 'block',
                    filter: loaded ? 'none' : 'blur(8px)',
                    cursor: onClick ? 'pointer' : undefined,
                }}
            />
            {error && (
                <div style={{
                    ...style,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#f3f4f6',
                    color: '#9ca3af',
                    fontSize: 12,
                }}>
                    ❌ Không tải được ảnh
                </div>
            )}
        </div>
    );
}

// ── Status icon for sent messages ────────────────────────────────────────────
function MessageStatus({
    isOptimistic,
    isFailed,
    isRead,
    readCount,
}: {
    isOptimistic: boolean;
    isFailed: boolean;
    isRead: boolean;
    readCount: number;
}) {
    if (isFailed) {
        return (
            <span style={{ color: '#ef4444', fontSize: 12 }} title="Gửi thất bại — nhấp để thử lại">
                ⚠️
            </span>
        );
    }
    if (isOptimistic) {
        return (
            <span title="Đang gửi...">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="2.5" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="10" style={{ animation: 'spin 1s linear infinite', transformOrigin: 'center' }} />
                </svg>
            </span>
        );
    }
    if (isRead && readCount > 0) {
        return (
            <span title={`Đã xem (${readCount})`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0068ff" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12" />
                    <polyline points="20 6 9 17" style={{ opacity: 0.5, transform: 'translateX(-4px)' }} />
                </svg>
            </span>
        );
    }
    return (
        <span title="Đã gửi">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12" />
            </svg>
        </span>
    );
}

// ── Virtual scrolling: window only visible items ──────────────────────────────
const OVERSCAN = 10; // items above/below viewport to render

// ── Image grouping utility ───────────────────────────────────────
// Consecutive IMAGE messages from the SAME sender within 60 seconds
// are grouped into an image cluster
const IMAGE_GROUP_THRESHOLD_MS = 60_000;

type RenderItem =
    | { type: 'message'; message: Message; index: number }
    | { type: 'imageGroup'; messages: Message[]; startIndex: number };

function getEffectiveType(msg: Message): string {
    if (getImageAttachmentUrls(msg).length > 0) return 'IMAGE';
    let type: string = msg.type;
    if ((type === 'TEXT' || !type) && msg.fileUrl && msg.attachments?.[0]) {
        const mime = (msg.attachments[0].type || '').toLowerCase();
        if (mime.startsWith('image')) type = 'IMAGE';
        else if (mime.startsWith('video')) type = 'VIDEO';
        else type = 'FILE';
    }
    return type;
}

function buildRenderItems(messages: Message[]): RenderItem[] {
    const items: RenderItem[] = [];
    let i = 0;
    while (i < messages.length) {
        const msg = messages[i];
        const effectiveType = getEffectiveType(msg);

        if (effectiveType === 'IMAGE' && (msg.fileUrl || msg.attachments?.[0]?.url) && !msg.isRecall) {
            // Try to build an image group
            const group: Message[] = [msg];
            let j = i + 1;
            while (j < messages.length) {
                const next = messages[j];
                const nextType = getEffectiveType(next);
                if (
                    nextType === 'IMAGE' &&
                    (next.fileUrl || next.attachments?.[0]?.url) &&
                    next.senderId === msg.senderId &&
                    !next.isRecall &&
                    Math.abs(new Date(next.createdAt).getTime() - new Date(group[group.length - 1].createdAt).getTime()) <= IMAGE_GROUP_THRESHOLD_MS
                ) {
                    group.push(next);
                    j++;
                } else {
                    break;
                }
            }
            if (group.length >= 2) {
                items.push({ type: 'imageGroup', messages: group, startIndex: i });
                i = j;
            } else {
                items.push({ type: 'message', message: msg, index: i });
                i++;
            }
        } else {
            items.push({ type: 'message', message: msg, index: i });
            i++;
        }
    }
    return items;
}

const MessageList: React.FC<MessageListProps> = ({
    messages: messagesRaw,
    currentUserId,
    roomId,
    participants = [],
    onRecall,
    onReact,
    onReply,
    onTogglePin,
    onRemoveAllReactions,
    onDeleteForMe,
    onForward,
    onLoadOlder,
    hasMoreOlder = false,
    loadingOlder = false,
}) => {
    // Dedup CALL message: khi session đã end → ẩn bubble STARTED, chỉ giữ bubble kết thúc.
    // Phải dedup TRƯỚC khi dùng bất kỳ index-based access (prevMsg/nextMsg/startIndex) để tránh lệch.
    const messages = useMemo(() => dedupCallMessages(messagesRaw), [messagesRaw]);
    const scrollRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const isNearBottom = useRef(true);
    const prevCount = useRef(0);
    const prevRoomId = useRef<string | undefined>(undefined);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const scheduledScroll = useRef(false);
    const scrollRestoreRef = useRef<{ prevSH: number; prevST: number } | null>(null);
    const loadOlderLock = useRef(false);

    const highlightedMessageId = useChatStore((s) => s.highlightedMessageId);
    const setHighlightedMessageId = useChatStore((s) => s.setHighlightedMessageId);

    const chatGalleryItems = useMemo(
        () => buildChatGalleryItems(messages, getImageUrl),
        [messages],
    );
    const [chatGalleryIndex, setChatGalleryIndex] = useState<number | null>(null);

    useEffect(() => {
        setChatGalleryIndex(null);
    }, [roomId]);

    const handleOpenChatGallery = useCallback(
        (resolvedUrl: string) => {
            const idx = findChatGalleryIndex(resolvedUrl, chatGalleryItems);
            setChatGalleryIndex(idx >= 0 ? idx : 0);
        },
        [chatGalleryItems],
    );

    const activeGalleryItem: ChatGalleryItem | null =
        chatGalleryIndex !== null && chatGalleryItems[chatGalleryIndex]
            ? chatGalleryItems[chatGalleryIndex]
            : null;

    // Scroll to highlighted message
    useEffect(() => {
        if (!highlightedMessageId) return;
        // Wait for render
        const timer = setTimeout(() => {
            const el = document.getElementById(`msg-${highlightedMessageId}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Flash effect
                el.style.transition = 'background-color 0.5s ease';
                el.style.backgroundColor = 'rgba(253, 224, 71, 0.4)'; // yellow-300 light
                setTimeout(() => {
                    el.style.backgroundColor = 'transparent';
                    setHighlightedMessageId(null);
                }, 2000);
            }
        }, 100);
        return () => clearTimeout(timer);
    }, [highlightedMessageId, messages, setHighlightedMessageId]);

    // Reliable scroll: both scrollTop (for container) and scrollIntoView (fallback)
    const doScroll = useCallback(() => {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
        messagesEndRef.current?.scrollIntoView({ block: 'end' });
        scheduledScroll.current = false;
    }, []);

    const scheduleScroll = useCallback(() => {
        if (scheduledScroll.current) return;
        scheduledScroll.current = true;
        // Double RAF: first ensures layout is committed, second ensures paint
        requestAnimationFrame(() => requestAnimationFrame(doScroll));
    }, [doScroll]);

    const handleScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        isNearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
        if (
            onLoadOlder &&
            hasMoreOlder &&
            !loadingOlder &&
            el.scrollTop < 100 &&
            !loadOlderLock.current
        ) {
            loadOlderLock.current = true;
            scrollRestoreRef.current = { prevSH: el.scrollHeight, prevST: el.scrollTop };
            onLoadOlder();
        }
    }, [onLoadOlder, hasMoreOlder, loadingOlder]);

    useEffect(() => {
        if (!loadingOlder) {
            loadOlderLock.current = false;
        }
    }, [loadingOlder]);

    useLayoutEffect(() => {
        if (!loadingOlder && scrollRestoreRef.current) {
            const el = scrollRef.current;
            const saved = scrollRestoreRef.current;
            scrollRestoreRef.current = null;
            if (el && saved) {
                const newSh = el.scrollHeight;
                el.scrollTop = newSh - saved.prevSH + saved.prevST;
            }
        }
    }, [loadingOlder, messages.length]);

    // Main scroll effect - fires on roomId change OR new messages
    useEffect(() => {
        if (messages.length === 0) return;
        const roomChanged = roomId !== prevRoomId.current;
        const isNew = messages.length > prevCount.current;

        if (roomChanged) {
            // New room: always scroll, reset tracking
            prevRoomId.current = roomId;
            prevCount.current = messages.length;
            isNearBottom.current = true;
            setIsInitialLoad(true);
            scheduleScroll();
            // Extra scroll after images might load
            setTimeout(doScroll, 300);
            setTimeout(() => setIsInitialLoad(false), 100);
        } else if (isNew) {
            // New message: only scroll if near bottom
            prevCount.current = messages.length;
            const last = messages[messages.length - 1];
            const lastType = last ? getEffectiveType(last) : '';
            const isMyMedia = !!last && last.senderId === currentUserId && (lastType === 'IMAGE' || lastType === 'VIDEO');
            if (isMyMedia) {
                scheduleScroll();
                setTimeout(doScroll, 300);
            } else if (isNearBottom.current) {
                scheduleScroll();
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [messages, roomId]);

    // Show skeleton on first load (no messages yet)
    if (isInitialLoad && messages.length === 0) {
        return (
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
                <style>{animationCSS}</style>
                {[...Array(6)].map((_, i) => (
                    <SkeletonBubble key={i} align={i % 3 === 0 ? 'right' : 'left'} />
                ))}
            </div>
        );
    }

    // Build participant lookup
    const participantMap = participants.reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
    }, {} as Record<string, User>);

    return (
        <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto bg-[var(--bg-chat-messages)]"
            onScroll={handleScroll}
            style={{ scrollBehavior: 'auto', minHeight: 0 }}
        >
            <style>{animationCSS}</style>
            <div className="flex flex-col justify-end min-h-full px-4 pt-4 pb-2">
                {loadingOlder ? (
                    <div className="flex justify-center py-2 text-xs text-gray-500 shrink-0">
                        Đang tải tin nhắn cũ…
                    </div>
                ) : null}
                {messages.length === 0 ? (
                    <div className="flex items-center justify-center py-10 text-gray-400 text-sm">
                        Hãy gửi tin nhắn đầu tiên! 👋
                    </div>
                ) : (
                    buildRenderItems(messages).map((item) => {
                        if (item.type === 'imageGroup') {
                            const group = item.messages;
                            const firstMsg = group[0];
                            const lastMsg = group[group.length - 1];
                            const isMine = firstMsg.senderId === currentUserId;
                            const sender = participantMap[firstMsg.senderId];
                            const isFirstInGroup = !messages[item.startIndex - 1] || messages[item.startIndex - 1].senderId !== firstMsg.senderId;
                            const nextAfterGroup = messages[item.startIndex + group.length];
                            const isLastInGroup = !nextAfterGroup || nextAfterGroup.senderId !== firstMsg.senderId;
                            const showAvatar = !isMine && isLastInGroup;
                            const senderName = !isMine && isFirstInGroup
                                ? (firstMsg.senderName || sender?.fullName || sender?.username || firstMsg.senderId?.slice(0, 8))
                                : undefined;

                            return (
                                <div key={`img-group-${firstMsg.id}`} id={`msg-${firstMsg.id}`}>
                                    <ImageGroupBubble
                                        messages={group}
                                        isMine={isMine}
                                        showAvatar={showAvatar}
                                        senderName={senderName}
                                        senderAvatar={sender?.avatarUrl}
                                        participants={participants}
                                        onRecall={onRecall}
                                        onDeleteForMe={onDeleteForMe}
                                        onForward={onForward}
                                        onReply={onReply}
                                        onTogglePin={onTogglePin}
                                        onOpenChatGallery={handleOpenChatGallery}
                                    />
                                </div>
                            );
                        }

                        const msg = item.message;
                        const index = item.index;
                        const isMine = msg.senderId === currentUserId;

                        const prevMsg = messages[index - 1];
                        const nextMsg = messages[index + 1];

                        const isFirstInGroup = !prevMsg || prevMsg.senderId !== msg.senderId;
                        const isLastInGroup = !nextMsg || nextMsg.senderId !== msg.senderId;
                        const showAvatar = !isMine && isLastInGroup;

                        const sender = participantMap[msg.senderId];
                        const senderName = !isMine && isFirstInGroup
                            ? (msg.senderName || sender?.fullName || sender?.username || msg.senderId?.slice(0, 8))
                            : undefined;
                        const senderAvatar = sender?.avatarUrl || undefined;

                        const marginBottom = isLastInGroup ? 'mb-3' : 'mb-0.5';
                        const repliedMessage = msg.replyToId
                            ? messages.find(m => m.id === msg.replyToId)
                            : undefined;
                        const isLatestMessage = index === messages.length - 1;

                        // Optimistic: temp- prefix = sending (id có thể thiếu với payload WS lệch)
                        const msgId = msg.id;
                        const isOptimistic =
                            typeof msgId === 'string' && msgId.startsWith('temp-');
                        const isFailed =
                            typeof msgId === 'string' && msgId.startsWith('failed-');
                        const readCount = msg.readBy?.filter(id => id !== currentUserId).length ?? 0;
                        const isRead = readCount > 0;

                        return (
                            <div key={msg.id || `msg-${index}`} id={`msg-${msg.id}`}>
                                <MessageBubble
                                    message={msg}
                                    isMine={isMine}
                                    showAvatar={showAvatar}
                                    isFirstInGroup={isFirstInGroup}
                                    isLastInGroup={isLastInGroup}
                                    senderName={senderName}
                                    senderAvatar={senderAvatar}
                                    marginBottom={marginBottom}
                                    onRecall={onRecall}
                                    onReact={onReact}
                                    onReply={onReply}
                                    onTogglePin={onTogglePin}
                                    onRemoveAllReactions={onRemoveAllReactions}
                                    onDeleteForMe={onDeleteForMe}
                                    onForward={onForward}
                                    participants={participants}
                                    repliedMessage={repliedMessage}
                                    isLatestMessage={isLatestMessage}
                                    onImageLoad={() => {
                                        if (isLatestMessage && msg.senderId === currentUserId) {
                                            scheduleScroll();
                                            setTimeout(doScroll, 150);
                                        }
                                    }}
                                    onScrollToMessage={(messageId) => {
                                        const el = document.getElementById(`msg-${messageId}`);
                                        if (el) {
                                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            el.classList.add('bg-yellow-100');
                                            setTimeout(() => el.classList.remove('bg-yellow-100'), 1500);
                                        }
                                    }}
                                    onOpenChatGallery={handleOpenChatGallery}
                                />
                                {/* Status icon below LAST message in a sent group */}
                                {isMine && isLastInGroup && (
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'flex-end',
                                        paddingRight: 4,
                                        marginTop: -6,
                                        marginBottom: 4,
                                    }}>
                                        <MessageStatus
                                            isOptimistic={isOptimistic}
                                            isFailed={isFailed}
                                            isRead={isRead}
                                            readCount={readCount}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} style={{ height: 1, flexShrink: 0 }} />
            </div>

            {chatGalleryIndex !== null && activeGalleryItem && chatGalleryItems.length > 0 && (
                <div
                    className="fixed inset-0 z-[85] flex items-center justify-center bg-black/90"
                    onClick={() => setChatGalleryIndex(null)}
                    role="presentation"
                >
                    {chatGalleryItems.length > 1 && (
                        <>
                            <button
                                type="button"
                                className="absolute left-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-xl text-white hover:bg-white/30"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setChatGalleryIndex((prev) =>
                                        prev === null
                                            ? null
                                            : (prev - 1 + chatGalleryItems.length) %
                                              chatGalleryItems.length,
                                    );
                                }}
                                aria-label="Ảnh trước"
                            >
                                ‹
                            </button>
                            <button
                                type="button"
                                className="absolute right-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-xl text-white hover:bg-white/30"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setChatGalleryIndex((prev) =>
                                        prev === null ? null : (prev + 1) % chatGalleryItems.length,
                                    );
                                }}
                                aria-label="Ảnh sau"
                            >
                                ›
                            </button>
                            <span className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-sm text-white">
                                {(chatGalleryIndex ?? 0) + 1} / {chatGalleryItems.length}
                            </span>
                        </>
                    )}
                    <button
                        type="button"
                        className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
                        onClick={(e) => {
                            e.stopPropagation();
                            setChatGalleryIndex(null);
                        }}
                        aria-label="Đóng"
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    <div className="mx-auto max-h-[90vh] max-w-[92vw]" onClick={(e) => e.stopPropagation()}>
                        {activeGalleryItem.kind === 'video' ? (
                            <video
                                src={activeGalleryItem.url}
                                controls
                                playsInline
                                preload="metadata"
                                className="max-h-[88vh] max-w-[92vw] rounded-lg"
                            />
                        ) : (
                            <img
                                src={activeGalleryItem.url}
                                alt=""
                                className="max-h-[88vh] max-w-[92vw] rounded-lg object-contain shadow-2xl"
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const animationCSS = `
@keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
}
@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}
@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}
`;

export default MessageList;
