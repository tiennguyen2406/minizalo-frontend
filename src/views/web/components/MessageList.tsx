import React, { useEffect, useRef, useCallback, useState, useLayoutEffect, useMemo } from 'react';
import MessageBubble from './MessageBubble';
import ImageGroupBubble from './ImageGroupBubble';
import { Message, User } from '@/shared/types';

import { getImageAttachmentUrls } from '@/shared/utils/messageAttachments';
import { buildChatGalleryItems, findChatGalleryIndex, type ChatGalleryItem } from '@/shared/utils/chatGallery';
import { getImageUrl } from '@/shared/utils/mediaUtils';
import { dedupCallMessages } from '@/shared/utils/dedupCallMessages';
import LazyImage from './LazyImage';
import { chatService } from '@/shared/services/chatService';
import { ArrowUp, Sparkles } from 'lucide-react';
import { showToast as toast } from '@/shared/utils/toast';
import ReadReceiptModal from './ReadReceiptModal';

interface MessageListProps {
    messages: Message[];
    currentUserId: string;
    roomId?: string;
    participants?: User[];
    isGroup?: boolean;
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
    onShowUnreadAi?: (startDate: string, endDate: string) => void;
    externalFirstUnread?: any;
    externalUnreadCount?: number;
    onScrollStatusChange?: (atBottom: boolean) => void;
    jumpSignal?: number;
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
    readByIds,
    participants,
    isGroup,
    onShowDetail,
}: {
    isOptimistic: boolean;
    isFailed: boolean;
    isRead: boolean;
    readCount: number;
    readByIds?: string[];
    participants?: User[];
    isGroup?: boolean;
    onShowDetail?: () => void;
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

    // ── Nhóm chat: hiển thị avatar nhỏ stacked ──
    if (isGroup && isRead && readCount > 0 && readByIds && participants) {
        const MAX_SHOW = 3;
        const readers = readByIds
            .map(id => participants.find(p => p.id === id))
            .filter(Boolean) as User[];
        const shown = readers.slice(0, MAX_SHOW);
        const extra = readers.length - MAX_SHOW;

        return (
            <div
                style={{ display: 'flex', alignItems: 'center', gap: 2, cursor: onShowDetail ? 'pointer' : 'default' }}
                onClick={onShowDetail}
                title={`Đã xem bởi ${readers.map(r => r.fullName || r.username).join(', ')}`}
            >
                <div style={{ display: 'flex', flexDirection: 'row-reverse' }}>
                    {shown.map((reader, i) => (
                        <img
                            key={reader.id}
                            src={reader.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(reader.fullName || reader.username)}&size=20&background=random`}
                            alt={reader.fullName || reader.username}
                            style={{
                                width: 16,
                                height: 16,
                                borderRadius: '50%',
                                border: '1.5px solid #fff',
                                marginLeft: i > 0 ? -6 : 0,
                                objectFit: 'cover',
                            }}
                        />
                    ))}
                </div>
                {extra > 0 && (
                    <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 500 }}>+{extra}</span>
                )}
            </div>
        );
    }

    // ── Chat 1-1: tick xanh kép ──
    if (isRead && readCount > 0) {
        return (
            <span
                title="Đã xem"
                style={{ cursor: onShowDetail ? 'pointer' : 'default' }}
                onClick={onShowDetail}
            >
                <svg width="16" height="14" viewBox="0 0 24 24" fill="none" stroke="#0068ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="18 7 9.5 17 5 12.5" />
                    <polyline points="23 7 14.5 17 12 14.5" />
                </svg>
            </span>
        );
    }

    // ── Đã gửi (chưa đọc) ──
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
    | { type: 'imageGroup'; messages: Message[]; startIndex: number }
    | { type: 'date'; content: string; id: string }
    | { type: 'system'; content: string; id: string };

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
    
    for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        
        // Add date divider
        const prevMsg = i > 0 ? messages[i - 1] : null;
        const currDate = new Date(msg.createdAt).toLocaleDateString();
        const prevDate = prevMsg ? new Date(prevMsg.createdAt).toLocaleDateString() : null;
        
        if (currDate !== prevDate) {
            items.push({ type: 'date', content: currDate, id: `date-${msg.id}` });
        }

        // Handle system messages (PILL format)
        if (msg.type === 'SYSTEM' || msg.type === 'PIN_NOTIFICATION') {
            items.push({ type: 'system', content: msg.content || '', id: msg.id });
            continue;
        }

        // Handle image grouping
        const effectiveType = getEffectiveType(msg);
        if (effectiveType === 'IMAGE' && (msg.fileUrl || msg.attachments?.[0]?.url) && !msg.isRecall) {
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
                i = j - 1; // Subtract 1 because for loop will increment
                continue;
            }
        }

        items.push({ type: 'message', message: msg, index: i });
    }
    return items;
}

const MessageList: React.FC<MessageListProps> = ({
    messages: messagesRaw,
    currentUserId,
    roomId,
    participants = [],
    isGroup,
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
    onShowUnreadAi,
    externalFirstUnread,
    externalUnreadCount,
    onScrollStatusChange,
    jumpSignal,
}) => {
    // Dedup CALL message: khi session đã end → ẩn bubble STARTED, chỉ giữ bubble kết thúc.
    // Phải dedup TRƯỚC khi dùng bất kỳ index-based access (prevMsg/nextMsg/startIndex) để tránh lệch.
    const messages = useMemo(() => dedupCallMessages(messagesRaw), [messagesRaw]);
    const scrollRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const prevRoomId = useRef<string | undefined>(roomId);
    const prevCount = useRef<number>(0);
    const isNearBottom = useRef<boolean>(true);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [showScrollToBottom, setShowScrollToBottom] = useState(false);
    const [isJumping, setIsJumping] = useState(false);
    const jumpActive = useRef(false);
    const jumpingTimeout = useRef<any>(null);
    const scrollRestoreRef = useRef<{ prevSH: number; prevST: number } | null>(null);
    const loadOlderLock = useRef(false);
    const lastHandledJumpSignal = useRef<number>(0);
    const prevLastMsgId = useRef<string | number | undefined>(undefined);
    const [highlightMsgId, setHighlightMsgId] = useState<string | null>(null);
    const [selectedReceiptMsg, setSelectedReceiptMsg] = useState<Message | null>(null);
    // Track which room we've already done the initial scroll-to-bottom for
    const hasScrolledToBottomForRoom = useRef<string | null>(null);

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

    const handleGalleryPrev = useCallback(() => {
        setChatGalleryIndex((idx) => (idx !== null && idx > 0 ? idx - 1 : idx));
    }, []);

    const handleGalleryNext = useCallback(() => {
        setChatGalleryIndex((idx) => (idx !== null && idx < chatGalleryItems.length - 1 ? idx + 1 : idx));
    }, [chatGalleryItems.length]);

    useEffect(() => {
        if (chatGalleryIndex === null) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                setChatGalleryIndex(null);
            } else if (event.key === 'ArrowLeft') {
                event.preventDefault();
                handleGalleryPrev();
            } else if (event.key === 'ArrowRight') {
                event.preventDefault();
                handleGalleryNext();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [chatGalleryIndex, handleGalleryNext, handleGalleryPrev]);

    // Only use scrollTop — NEVER scrollIntoView, which can scroll parent containers
    const doScroll = useCallback(() => {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, []);

    const handleScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        
        const sh = el.scrollHeight;
        const st = el.scrollTop;
        const ch = el.clientHeight;
        const fromBottom = sh - st - ch;
        
        // Ultra-strict threshold for "at bottom" (10px)
        const atBottom = fromBottom < 10;
        isNearBottom.current = atBottom;
        
        setShowScrollToBottom(fromBottom > 200);

        if (onScrollStatusChange) {
            onScrollStatusChange(atBottom);
        }

        // Trigger loading older messages when near top (proactive 250px threshold)
        if (
            onLoadOlder &&
            hasMoreOlder &&
            !loadingOlder &&
            st < 250 && 
            !loadOlderLock.current
        ) {
            loadOlderLock.current = true;
            scrollRestoreRef.current = { prevSH: el.scrollHeight, prevST: el.scrollTop };
            onLoadOlder();
        }
    }, [onLoadOlder, hasMoreOlder, loadingOlder, onScrollStatusChange]);

    useLayoutEffect(() => {
        if (!loadingOlder) {
            // Restore scroll position so content doesn't jump when older messages are prepended
            if (scrollRestoreRef.current && scrollRef.current) {
                const el = scrollRef.current;
                const { prevSH, prevST } = scrollRestoreRef.current;
                const newSH = el.scrollHeight;
                // Add the difference in height to the previous scrollTop
                el.scrollTop = prevST + (newSH - prevSH);
                scrollRestoreRef.current = null;
            }
            loadOlderLock.current = false;
        }
    }, [loadingOlder, messages.length]);


    const jumpRetryCount = useRef(0);
    const lastJumpTargetId = useRef<string | null>(null);

    // ─── Jump to oldest unread (mirrors mobile: find by message ID, scroll by offsetTop) ──
    const handleJumpToUnread = useCallback((isRetry = false) => {
        if (!isRetry) {
            jumpRetryCount.current = 0;
            // Priority: use externalFirstUnread from server, then fall back to oldest local message
            lastJumpTargetId.current = externalFirstUnread?.id ?? null;
            jumpActive.current = true;
            setIsJumping(true);
        }
        
        const msgId = lastJumpTargetId.current;
        if (!msgId) {
            jumpActive.current = false;
            setIsJumping(false);
            return;
        }

        const el = document.getElementById(`msg-${msgId}`);

        if (el && scrollRef.current) {
            jumpRetryCount.current = 0;
            toast.dismiss('jump-unread');
            isNearBottom.current = false;
            jumpActive.current = false;
            setIsJumping(false);
            const container = scrollRef.current;
            
            const doLockScroll = () => {
                const elActual = document.getElementById(`msg-${msgId}`);
                if (!elActual || !container) return;
                const cRect = container.getBoundingClientRect();
                const eRect = elActual.getBoundingClientRect();
                const relTop = eRect.top - cRect.top;
                const targetTop = container.scrollTop + relTop - (container.clientHeight / 2) + (eRect.height / 2);
                container.scrollTop = Math.max(0, targetTop);
            };

            // Immediate scroll
            doLockScroll();
            
            // Lock-on scrolls to counter async image loading layout shifts
            setTimeout(doLockScroll, 100);
            setTimeout(doLockScroll, 300);
            setTimeout(doLockScroll, 600);

            // Highlight via React state (survives re-renders, not overridden by Tailwind)
            setHighlightMsgId(msgId);
            setTimeout(() => setHighlightMsgId(null), 3500);

            if (jumpingTimeout.current) clearTimeout(jumpingTimeout.current);
        } else {
            // Not in DOM yet — load older pages and retry (same as mobile "đang tải thêm")
            if (jumpRetryCount.current < 5) {
                jumpRetryCount.current++;
                if (!isRetry) toast.loading("Đang tìm tin nhắn cũ chưa đọc...", { id: 'jump-unread' });
                
                if (!loadingOlder && hasMoreOlder) {
                    onLoadOlder?.();
                }
                
                const delay = loadingOlder ? 1200 : 800;
                setTimeout(() => handleJumpToUnread(true), delay);
            } else {
                toast.dismiss('jump-unread');
                jumpActive.current = false;
                setIsJumping(false);
            }
        }
    }, [messages, externalFirstUnread, loadingOlder, hasMoreOlder, onLoadOlder]);

    const scrollToBottom = () => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({
                top: scrollRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    };


    useEffect(() => {
        if (jumpSignal && jumpSignal > lastHandledJumpSignal.current) {
            lastHandledJumpSignal.current = jumpSignal;
            handleJumpToUnread();
        }
    }, [jumpSignal, handleJumpToUnread]);

    useEffect(() => {
        if (messages.length === 0) {
            prevCount.current = 0;
            prevLastMsgId.current = undefined;
            return;
        }
        
        const currentRoomId = roomId || '';
        const roomChanged = currentRoomId !== '' && currentRoomId !== prevRoomId.current;
        const isNew = messages.length > prevCount.current;
        
        const lastMsg = messages[messages.length - 1];
        const lastMsgId = lastMsg?.id;
        const lastMessageIsNew = lastMsgId !== prevLastMsgId.current;
        const lastMessageIsMine = lastMsg?.senderId === currentUserId;

        if (roomChanged) {
            prevRoomId.current = currentRoomId;
            prevCount.current = messages.length;
            prevLastMsgId.current = lastMsgId;
            // DON'T scroll here — useLayoutEffect handles initial scroll-to-bottom.
            // Only update state so future messages auto-scroll correctly.
            isNearBottom.current = true;
            jumpActive.current = false;
            setIsInitialLoad(true);
            setTimeout(() => setIsInitialLoad(false), 100);
        } else if (isNew) {
            // ONLY auto-scroll if a NEW message arrived at the BOTTOM
            // and (user is near bottom OR user is the sender)
            const isJumpingActive = isJumping || jumpActive.current;

            if (lastMessageIsNew && !isJumpingActive && (isNearBottom.current || lastMessageIsMine)) {
                isNearBottom.current = true;
                doScroll();
            }
            prevCount.current = messages.length;
            prevLastMsgId.current = lastMsgId;
        } else {
            prevCount.current = messages.length;
            prevLastMsgId.current = lastMsgId;
        }
    }, [messages.length, roomId, doScroll, currentUserId, isJumping]);

    // THE SINGLE SOURCE OF TRUTH for initial scroll-to-bottom.
    // useLayoutEffect fires synchronously after DOM update, before browser paint.
    useLayoutEffect(() => {
        if (!roomId || messages.length === 0) return;
        if (hasScrolledToBottomForRoom.current === roomId) return;

        // Mark as done so we don't re-scroll when more messages arrive
        hasScrolledToBottomForRoom.current = roomId;
        jumpActive.current = false;
        isNearBottom.current = true;

        const el = scrollRef.current;
        if (!el) return;

        // Immediate synchronous scroll (before paint)
        el.scrollTop = el.scrollHeight;

        // Fallback scrolls: images/async content may increase scrollHeight after render.
        // Use multiple delays to catch any late layout changes.
        requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight; });
        setTimeout(() => { if (el) el.scrollTop = el.scrollHeight; }, 100);
        setTimeout(() => { if (el) el.scrollTop = el.scrollHeight; }, 300);
        setTimeout(() => { if (el) el.scrollTop = el.scrollHeight; }, 600);
    }, [roomId, messages.length]);

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

    const participantMap = participants.reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
    }, {} as Record<string, User>);
    return (
        <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto"
            onScroll={handleScroll}
            style={{ scrollBehavior: 'auto', minHeight: 0, position: 'relative', overflowAnchor: 'none' }}
        >
            <style>{animationCSS}</style>

            <div className="flex flex-col min-h-full px-4 pt-4 pb-2">
                <div className="flex-1" />
                {loadingOlder ? (
                    <div className="flex justify-center py-2 text-xs text-[color:var(--text-secondary)] shrink-0">
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
                            const isMine = firstMsg.senderId === currentUserId;
                            const sender = participantMap[firstMsg.senderId];
                            const nextAfterGroup = messages[item.startIndex + group.length];
                            const isLastInGroup = !nextAfterGroup || nextAfterGroup.senderId !== firstMsg.senderId;
                            
                            return (
                                <div key={`img-group-${firstMsg.id}`} className="relative">
                                    {group.map(m => (
                                        <div key={`anchor-${m.id}`} id={`msg-${m.id}`} className="absolute top-0 left-0 w-0 h-0 pointer-events-none" />
                                    ))}
                                    <div className={highlightMsgId && group.some(m => m.id === highlightMsgId) ? 'msg-highlight-wrapper' : ''}>
                                        <ImageGroupBubble
                                        messages={group}
                                        isMine={isMine}
                                        showAvatar={!isMine && isLastInGroup}
                                        senderName={!isMine ? (firstMsg.senderName || sender?.fullName || sender?.username) : undefined}
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
                                </div>
                            );
                        }

                        if (item.type === 'date') {
                             return (
                                <div key={item.id} className="flex justify-center my-4">
                                    <span className="px-3 py-1 rounded-full bg-[color:var(--bg-secondary)] dark:bg-gray-800 text-[11px] text-[color:var(--text-secondary)] font-medium">
                                        {item.content}
                                    </span>
                                </div>
                             );
                        }

                        if (item.type === 'system') {
                             return (
                                <div key={item.id} className="flex justify-center my-2">
                                    <span className="text-[11px] text-gray-400 italic text-center px-6">
                                        {item.content}
                                    </span>
                                </div>
                             );
                        }

                        if (item.type === 'message') {
                            const msg = item.message;
                            const index = item.index;
                            const isMine = msg.senderId === currentUserId;
                            const prevMsg = messages[index - 1];
                            const nextMsg = messages[index + 1];

                            const isFirstInGroup = !prevMsg || prevMsg.senderId !== msg.senderId;
                            const isLastInGroup = !nextMsg || nextMsg.senderId !== msg.senderId;
                            const sender = participantMap[msg.senderId];

                            const readCount = msg.readBy?.filter(id => id !== currentUserId).length ?? 0;
                            const isRead = readCount > 0;
                            const isOptimistic = typeof msg.id === 'string' && msg.id.startsWith('temp-');
                            const isFailed = typeof msg.id === 'string' && msg.id.startsWith('failed-');

                            return (
                                <div key={msg.id || `msg-${index}`} id={`msg-${msg.id}`}
                                    className={highlightMsgId === msg.id ? 'msg-highlight-wrapper' : ''}
                                >
                                    <MessageBubble
                                        message={msg}
                                        isMine={isMine}
                                        showAvatar={!isMine && isLastInGroup}
                                        isFirstInGroup={isFirstInGroup}
                                        isLastInGroup={isLastInGroup}
                                        senderName={!isMine && isFirstInGroup ? (msg.senderName || sender?.fullName || sender?.username) : undefined}
                                        senderAvatar={sender?.avatarUrl}
                                        onRecall={onRecall}
                                        onReact={onReact}
                                        onReply={onReply}
                                        onTogglePin={onTogglePin}
                                        onRemoveAllReactions={onRemoveAllReactions}
                                        onDeleteForMe={onDeleteForMe}
                                        onForward={onForward ? (m) => onForward(m as Message) : undefined}
                                        participants={participants}
                                        repliedMessage={msg.replyToId ? messages.find(m => m.id === msg.replyToId) : undefined}
                                        onOpenChatGallery={handleOpenChatGallery}
                                        onScrollToMessage={(mid) => {
                                            const el = document.getElementById(`msg-${mid}`);
                                            if (el) {
                                                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                el.classList.add('bg-blue-50/50');
                                                setTimeout(() => el.classList.remove('bg-blue-50/50'), 2000);
                                            }
                                        }}
                                    />
                                    {isMine && isLastInGroup && (
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingRight: 4, marginTop: -6, marginBottom: 4 }}>
                                            <MessageStatus
                                                isOptimistic={isOptimistic}
                                                isFailed={isFailed}
                                                isRead={isRead}
                                                readCount={readCount}
                                                readByIds={msg.readBy?.filter(id => id !== currentUserId)}
                                                participants={participants}
                                                isGroup={isGroup}
                                                onShowDetail={() => setSelectedReceiptMsg(msg)}
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        return null;
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
                    <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full bg-black/45 px-3 py-1 text-sm font-medium text-white">
                        {chatGalleryIndex + 1} / {chatGalleryItems.length}
                    </div>
                    <button
                        type="button"
                        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
                        onClick={(e) => {
                            e.stopPropagation();
                            setChatGalleryIndex(null);
                        }}
                    >
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    <button
                        type="button"
                        className="absolute right-16 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
                        title="Tải về"
                        onClick={async (e) => {
                            e.stopPropagation();
                            const url = activeGalleryItem.url;
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
                            } catch (error) {
                                window.open(url, '_blank');
                            }
                        }}
                    >
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                    </button>
                    {chatGalleryIndex > 0 && (
                        <button
                            type="button"
                            className="absolute left-5 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
                            title="Truoc"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleGalleryPrev();
                            }}
                        >
                            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                    )}
                    {chatGalleryIndex < chatGalleryItems.length - 1 && (
                        <button
                            type="button"
                            className="absolute right-5 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
                            title="Sau"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleGalleryNext();
                            }}
                        >
                            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    )}
                    <div className="mx-auto max-h-[90vh] max-w-[92vw]" onClick={(e) => e.stopPropagation()}>
                        {activeGalleryItem.kind === 'video' ? (
                            <video src={activeGalleryItem.url} controls playsInline preload="metadata" className="max-h-[88vh] max-w-[92vw] rounded-lg" />
                        ) : (
                            <img src={activeGalleryItem.url} alt="" className="max-h-[88vh] max-w-[92vw] rounded-lg object-contain shadow-2xl" />
                        )}
                    </div>
                </div>
            )}

            {showScrollToBottom && (
                <button
                    onClick={scrollToBottom}
                    className="fixed bottom-28 right-10 w-11 h-11 rounded-full bg-[color:var(--bg-primary)] dark:bg-gray-800 shadow-2xl border border-[color:var(--border-primary)] dark:border-gray-700 flex items-center justify-center text-blue-500 hover:bg-blue-50 dark:hover:bg-gray-700 transition-all z-[100] hover:scale-110 active:scale-95"
                    title="Cuộn xuống dưới cùng"
                    style={{
                      boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
                    }}
                >
                    <ArrowUp className="w-6 h-6 rotate-180" />
                </button>
            )}

            <ReadReceiptModal
                isOpen={!!selectedReceiptMsg}
                onClose={() => setSelectedReceiptMsg(null)}
                readByIds={selectedReceiptMsg?.readBy || []}
                participants={participants}
                currentUserId={currentUserId}
            />
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
@keyframes msgHighlight {
    0%   { background-color: #fef08a; box-shadow: 0 0 16px rgba(234,179,8,0.7); }
    70%  { background-color: #fef08a; box-shadow: 0 0 16px rgba(234,179,8,0.7); }
    100% { background-color: transparent; box-shadow: none; }
}
.msg-highlight-wrapper {
    animation: msgHighlight 3.5s ease forwards;
    border-radius: 8px;
}
`;

export default MessageList;
