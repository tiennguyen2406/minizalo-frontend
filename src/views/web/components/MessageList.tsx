import React, { useEffect, useRef, useCallback, useState } from 'react';
import MessageBubble from './MessageBubble';
import { Message, User } from '@/shared/types';

interface MessageListProps {
    messages: Message[];
    currentUserId: string;
    participants?: User[];
    onRecall?: (messageId: string) => void;
    onReact?: (messageId: string, emoji: string) => void;
    onReply?: (message: Message) => void;
    onTogglePin?: (messageId: string, currentPinStatus: boolean) => void;
    onRemoveAllReactions?: (messageId: string) => void;
    onDeleteForMe?: (messageId: string) => void;
    onForward?: (message: Message) => void;
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

// ── Image with blur/skeleton placeholder ─────────────────────────────────────
function LazyImage({ src, alt, style, onClick }: { src: string; alt: string; style?: React.CSSProperties; onClick?: () => void }) {
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
                onLoad={() => setLoaded(true)}
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

const MessageList: React.FC<MessageListProps> = ({
    messages,
    currentUserId,
    participants = [],
    onRecall,
    onReact,
    onReply,
    onTogglePin,
    onRemoveAllReactions,
    onDeleteForMe,
    onForward,
}) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const isNearBottom = useRef(true);
    const prevCount = useRef(0);
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    // ── Scroll to bottom ──────────────────────────────────────────────────────
    const scrollToBottom = useCallback((smooth = false) => {
        bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }, []);

    const handleScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        isNearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    }, []);

    // Initial load: instant scroll
    useEffect(() => {
        requestAnimationFrame(() => {
            scrollToBottom(false);
            setIsInitialLoad(false);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // New messages: smooth scroll only if near bottom
    useEffect(() => {
        if (isInitialLoad) return;
        const isNew = messages.length > prevCount.current;
        prevCount.current = messages.length;
        if (isNew && isNearBottom.current) {
            requestAnimationFrame(() => scrollToBottom(true));
        }
    }, [messages, isInitialLoad, scrollToBottom]);

    // Build participant lookup
    const participantMap = participants.reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
    }, {} as Record<string, User>);

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

    return (
        <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto bg-gray-50"
            onScroll={handleScroll}
            style={{ scrollBehavior: 'auto' }}
        >
            <style>{animationCSS}</style>
            <div className="flex flex-col justify-end min-h-full px-4 pt-4 pb-2">
                {messages.length === 0 ? (
                    <div className="flex items-center justify-center py-10 text-gray-400 text-sm">
                        Hãy gửi tin nhắn đầu tiên! 👋
                    </div>
                ) : (
                    messages.map((msg, index) => {
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

                        // Optimistic: temp- prefix = sending
                        const isOptimistic = msg.id.startsWith('temp-');
                        const isFailed = msg.id.startsWith('failed-');
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
                                    onScrollToMessage={(messageId) => {
                                        const el = document.getElementById(`msg-${messageId}`);
                                        if (el) {
                                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            el.classList.add('bg-yellow-100');
                                            setTimeout(() => el.classList.remove('bg-yellow-100'), 1500);
                                        }
                                    }}
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
                {/* Scroll anchor */}
                <div ref={bottomRef} />
            </div>
        </div>
    );
};

// Provide LazyImage as named export for use in MessageBubble
export { LazyImage };

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
