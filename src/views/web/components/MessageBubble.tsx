import React, { useState, useRef, useCallback } from 'react';
import { Message, User } from '@/shared/types';
import clsx from 'clsx';
import LazyImage from './LazyImage';
import FileAttachmentBubble from './FileAttachmentBubble';
import VideoAttachmentBubble from './VideoAttachmentBubble';
import FolderAttachmentBubble from './FolderAttachmentBubble';

interface MessageBubbleProps {
    message: Message;
    isMine: boolean;
    showAvatar?: boolean;
    isFirstInGroup?: boolean;
    isLastInGroup?: boolean;
    senderName?: string;
    senderAvatar?: string;
    marginBottom?: string;
    onRecall?: (messageId: string) => void;
    onReact?: (messageId: string, emoji: string) => void;
    onReply?: (message: Message) => void;
    onTogglePin?: (messageId: string, currentPinStatus: boolean) => void;
    onRemoveAllReactions?: (messageId: string) => void;
    onDeleteForMe?: (messageId: string) => void;
    onForward?: (message: Message) => void;
    onScrollToMessage?: (messageId: string) => void;
    onImageLoad?: () => void;
    repliedMessage?: Message;
    isLatestMessage?: boolean;
    participants?: User[];
}

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "😡"];

const getAvatarUrl = (name: string, avatarUrl?: string) => {
    if (avatarUrl) return avatarUrl;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4A90D9&color=fff&size=64`;
};

const MessageBubble: React.FC<MessageBubbleProps> = ({
    message,
    isMine,
    showAvatar = false,
    isFirstInGroup = true,
    isLastInGroup = true,
    senderName,
    senderAvatar,
    marginBottom = 'mb-1',
    onRecall,
    onReact,
    onReply,
    onTogglePin,
    onRemoveAllReactions,
    onDeleteForMe,
    onForward,
    onScrollToMessage,
    onImageLoad,
    repliedMessage,
    isLatestMessage,
    participants = [],
}) => {
    const [showReactPicker, setShowReactPicker] = useState(false);
    const [isHoveringReactions, setIsHoveringReactions] = useState(false);
    const [showReactionDetail, setShowReactionDetail] = useState(false);
    const [selectedEmojiTab, setSelectedEmojiTab] = useState<string | null>(null);
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const [menuPos, setMenuPos] = useState<{ top: number; left?: number; right?: number } | null>(null);
    const [showMessageDetail, setShowMessageDetail] = useState(false);
    const moreButtonRef = useRef<HTMLButtonElement>(null);

    const openMoreMenuFromAnchor = useCallback(
        (anchor: HTMLElement) => {
            const rect = anchor.getBoundingClientRect();
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
        },
        [isMine],
    );

    // Keep picker open if hovered over button OR the picker itself
    const isPickerVisible = showReactPicker || isHoveringReactions;

    const handleReact = (emoji: string) => {
        if (onReact) onReact(message.id, emoji);
    };

    // Calculate Reaction counts based on Array of {userId, emoji}
    const reactionCounts = Array.isArray(message.reactions) ? message.reactions.reduce((acc, curr) => {
        acc[curr.emoji] = (acc[curr.emoji] || 0) + 1;
        return acc;
    }, {} as Record<string, number>) : {};

    // Sort emojis by count descending for UI consistency, or just object keys
    const sortedEmojis = Object.keys(reactionCounts).sort((a, b) => reactionCounts[b] - reactionCounts[a]);
    const totalReactions = Array.isArray(message.reactions) ? message.reactions.length : 0;
    const latestEmoji = (totalReactions > 0 && Array.isArray(message.reactions)) ? message.reactions[totalReactions - 1].emoji : null;

    // Bo góc kiểu Zalo: góc liên kết với avatar phẳng, còn lại bo tròn
    const bubbleRadius = isMine
        ? clsx(
            'rounded-2xl',
            isFirstInGroup && 'rounded-tr-md',
            isLastInGroup && 'rounded-br-md',
        )
        : clsx(
            'rounded-2xl',
            isFirstInGroup && 'rounded-tl-md',
            isLastInGroup && 'rounded-bl-md',
        );

    const displayName = senderName || 'Unknown';

    // Resolve file info from attachments as fallback (raw WebSocket messages may not have fileUrl mapped)
    const attachment = message.attachments?.[0];
    const effectiveFileUrl = message.fileUrl || attachment?.url;
    const effectiveFileName = message.fileName || attachment?.name || attachment?.filename;
    const effectiveFileSize = message.fileSize || attachment?.size;

    // Detect effective type from attachment MIME type if message type is TEXT but has attachments
    let effectiveType = message.type;
    if ((effectiveType === 'TEXT' || !effectiveType) && effectiveFileUrl && attachment) {
        const mime = (attachment.type || '').toLowerCase();
        if (mime.startsWith('image')) effectiveType = 'IMAGE';
        else if (mime.startsWith('video')) effectiveType = 'VIDEO';
        else effectiveType = 'FILE';
    }

    // Handle System Message
    if (effectiveType === 'SYSTEM') {
        return (
            <div className="flex justify-center my-2">
                <div className="bg-white border border-gray-100 shadow-sm rounded-full px-4 py-2 flex items-center gap-2 text-sm text-gray-600">
                    <span className="text-orange-500 flex shrink-0">
                        {message.isRecall ? (
                            // Bỏ ghim icon
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4l16 16" /></svg>
                        ) : (
                            // Pin icon
                            <svg className="w-4 h-4 transform rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                        )}
                    </span>
                    <span>
                        {message.content}
                        {!message.isRecall && message.replyToId && (
                            <span
                                className="text-blue-500 font-medium ml-1 cursor-pointer hover:underline"
                                onClick={() => onScrollToMessage?.(message.replyToId!)}
                            >
                                Xem
                            </span>
                        )}
                    </span>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className={clsx('flex flex-row items-end', isMine ? 'justify-end' : 'justify-start', marginBottom)}>
                {/* Avatar bên trái (người khác) */}
                {!isMine && (
                    <div className="mr-1.5 self-end flex-shrink-0" style={{ width: 32 }}>
                        {showAvatar ? (
                            <img
                                src={getAvatarUrl(displayName, senderAvatar)}
                                alt={displayName}
                                className="w-8 h-8 rounded-full object-cover"
                            />
                        ) : (
                            <div className="w-8 h-8" /> /* placeholder để giữ alignment */
                        )}
                    </div>
                )}

                {/* Bubble content */}
                <div className={clsx(
                    'max-w-[70%] flex flex-col relative mb-4',
                    isMine ? 'items-end' : 'items-start'
                )}>
                    {/* Tên người gửi (hiện ở đầu nhóm) */}
                    {!isMine && senderName && (
                        <span className="text-xs text-gray-500 mb-0.5 ml-1 font-medium">{senderName}</span>
                    )}

                    {/* Nội dung tin nhắn */}
                    <div
                        className={clsx(
                            'px-3.5 py-2.5 break-words relative flex flex-col group/bubble',
                            bubbleRadius,
                            isMine
                                ? (message.isRecall ? 'bg-gray-100 text-gray-500 italic border border-transparent' : 'bg-[#e5f1ff] text-gray-900 border border-blue-100')
                                : (message.isRecall ? 'bg-gray-100 text-gray-500 italic border border-transparent' : 'bg-white text-gray-900 shadow-sm border border-gray-100')
                        )}
                        onContextMenu={(e) => {
                            if (!message.isRecall) {
                                e.preventDefault();
                                setShowMoreMenu(true);
                            }
                        }}
                    >
                        {/* Hành động tin nhắn (hiện khi hover): Reply + ⋯ */}
                        {!message.isRecall && (
                            <div className={clsx(
                                "absolute top-1/2 -translate-y-1/2 opacity-0 group-hover/bubble:opacity-100 transition-opacity flex items-center gap-1",
                                isMine ? "right-full mr-2" : "left-full ml-2"
                            )}>
                                {/* Nút Trả lời */}
                                {onReply && (
                                    <button
                                        onClick={() => onReply(message)}
                                        className="bg-white text-gray-500 shadow-sm border border-gray-100 rounded-full w-7 h-7 flex items-center justify-center hover:bg-gray-50 focus:outline-none"
                                        title="Trả lời"
                                    >
                                        <svg className="w-3.5 h-3.5 transform -scale-x-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                        </svg>
                                    </button>
                                )}

                                {/* Nút ⋯ (More) */}
                                <div className="relative">
                                    <button
                                        ref={moreButtonRef}
                                        onClick={() => {
                                            const btn = moreButtonRef.current;
                                            if (!btn) return;
                                            openMoreMenuFromAnchor(btn);
                                        }}
                                        className="bg-white text-gray-500 shadow-sm border border-gray-100 rounded-full w-7 h-7 flex items-center justify-center hover:bg-gray-50 focus:outline-none"
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
                        )}

                        {/* Fixed-position menu — position:fixed escapes any overflow:hidden ancestor */}
                        {showMoreMenu && menuPos && (
                            <>
                                {/* Backdrop */}
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
                                    className="bg-white rounded-xl shadow-lg border border-gray-200 py-1.5"
                                >
                                    {/* Copy */}
                                    <button
                                        onClick={() => { navigator.clipboard.writeText(message.content || ''); setShowMoreMenu(false); setMenuPos(null); }}
                                        className="w-full flex items-center gap-3 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                        Copy tin nhắn
                                    </button>
                                    {/* Pin */}
                                    {onTogglePin && (
                                        <button
                                            onClick={() => { onTogglePin(message.id, !!message.pinned); setShowMoreMenu(false); setMenuPos(null); }}
                                            className="w-full flex items-center gap-3 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                        >
                                            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                                            {message.pinned ? 'Bỏ ghim' : 'Ghim tin nhắn'}
                                        </button>
                                    )}
                                    {/* Reply */}
                                    {onReply && (
                                        <button
                                            onClick={() => { onReply(message); setShowMoreMenu(false); setMenuPos(null); }}
                                            className="w-full flex items-center gap-3 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                        >
                                            <svg className="w-4 h-4 text-gray-400 transform -scale-x-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                                            Trả lời
                                        </button>
                                    )}
                                    {/* Share / Forward */}
                                    <button
                                        onClick={() => { onForward?.(message); setShowMoreMenu(false); setMenuPos(null); }}
                                        className="w-full flex items-center gap-3 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                                        Chia sẻ
                                    </button>
                                    {/* View Detail */}
                                    <button
                                        onClick={() => { setShowMessageDetail(true); setShowMoreMenu(false); setMenuPos(null); }}
                                        className="w-full flex items-center gap-3 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        Xem chi tiết
                                    </button>
                                    <div className="border-t border-gray-100 my-1" />
                                    {/* Recall - own messages only */}
                                    {isMine && onRecall && (
                                        <button
                                            onClick={() => { onRecall(message.id); setShowMoreMenu(false); setMenuPos(null); }}
                                            className="w-full flex items-center gap-3 px-3.5 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                                            Thu hồi
                                        </button>
                                    )}
                                    {/* Delete for me */}
                                    <button
                                        onClick={() => { onDeleteForMe?.(message.id); setShowMoreMenu(false); setMenuPos(null); }}
                                        className="w-full flex items-center gap-3 px-3.5 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        Xoá ở phía tôi
                                    </button>
                                </div>
                            </>
                        )}

                        {/* Forward badge */}
                        {(message.type === 'FORWARD' || message.forwardedFromId) && !message.isRecall && (
                            <div className="flex items-center gap-1 mb-1 text-xs text-gray-400 italic">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                </svg>
                                Đã chuyển tiếp
                            </div>
                        )}

                        {repliedMessage && !message.isRecall && (
                            <div
                                className={clsx(
                                    "mb-1.5 p-1.5 bg-[#c7e0ff] rounded text-xs border-l-2 cursor-pointer hover:bg-[#b8d6f7] transition-colors",
                                    isMine ? "border-blue-300" : "border-blue-500"
                                )}
                                onClick={() => repliedMessage.id && onScrollToMessage?.(repliedMessage.id)}
                            >
                                <span className="font-medium block text-blue-700">
                                    {repliedMessage.senderName || participants.find(p => p.id === repliedMessage.senderId)?.fullName || participants.find(p => p.id === repliedMessage.senderId)?.username || 'Người dùng'}
                                </span>
                                <span className="line-clamp-1 truncate block pt-0.5 text-gray-700">
                                    {repliedMessage.isRecall ? '[Tin nhắn đã thu hồi]' : repliedMessage.content}
                                </span>
                            </div>
                        )}

                        {message.isRecall ? (
                            <span className="text-sm italic opacity-80">{message.content}</span>
                        ) : effectiveType === 'IMAGE' && effectiveFileUrl ? (
                            <div className="flex flex-col gap-1">
                                <LazyImage
                                    src={effectiveFileUrl}
                                    alt={effectiveFileName || 'Ảnh'}
                                    style={{
                                        maxWidth: 280, maxHeight: 300, borderRadius: 8,
                                        objectFit: 'cover', cursor: 'pointer',
                                    }}
                                    onClick={() => window.open(effectiveFileUrl, '_blank')}
                                    onLoad={onImageLoad}
                                />
                            </div>
                        ) : effectiveType === 'VIDEO' && effectiveFileUrl ? (
                            <VideoAttachmentBubble
                                fileUrl={effectiveFileUrl}
                                fileName={effectiveFileName}
                                fileSize={effectiveFileSize}
                                isMine={isMine}
                                onOpenMessageMenu={openMoreMenuFromAnchor}
                            />
                        ) : effectiveType === 'FOLDER' && message.attachments && message.attachments.length > 0 ? (
                            <FolderAttachmentBubble
                                folderName={message.content || effectiveFileName || 'Thư mục'}
                                totalSize={
                                    effectiveFileSize ??
                                    message.attachments.reduce((s, a) => s + (a.size ?? 0), 0)
                                }
                                fileCount={message.attachments.length}
                                attachments={message.attachments}
                                isMine={isMine}
                            />
                        ) : (effectiveType === 'FILE' || effectiveType === 'DOCUMENT') && effectiveFileUrl ? (
                            <FileAttachmentBubble
                                fileUrl={effectiveFileUrl}
                                fileName={effectiveFileName}
                                fileSize={effectiveFileSize}
                                mimeType={attachment?.type}
                                isMine={isMine}
                            />
                        ) : effectiveType === 'TEXT' || effectiveType === 'REPLY' || effectiveType === 'FORWARD' ? (
                            <span className="text-[15px] leading-relaxed pr-8">{message.content}</span>
                        ) : (
                            <span className="text-[15px] italic opacity-80 pr-8">{message.content || '[Loại tin nhắn không hỗ trợ]'}</span>
                        )}

                        {/* Thời gian hiển thị bên trong khung chữ, góc bên trái */}
                        <span className="text-[11px] text-gray-400 mt-1.5 self-start leading-none">
                            {new Date(message.createdAt).toLocaleTimeString('vi-VN', {
                                hour: '2-digit',
                                minute: '2-digit',
                            })}
                        </span>
                    </div>

                    {/* Reactions Pill and Inline Like - Nằm đè lên viền Đáy Phải (Bottom-Right) */}
                    <div className="absolute -bottom-3 right-0 translate-x-1 flex flex-row items-center z-10">
                        {/* Hiển thị Pill cảm xúc hợp nhất */}
                        {sortedEmojis.length > 0 && (
                            <div
                                className="flex items-center gap-1 bg-white border border-gray-200 rounded-full px-1.5 py-0.5 shadow-sm text-xs cursor-pointer hover:bg-gray-50 transition-colors mr-1"
                                onClick={(e) => { e.stopPropagation(); setShowReactionDetail(true); setSelectedEmojiTab(null); }}
                            >
                                <div className="flex -space-x-1">
                                    {sortedEmojis.slice(0, 3).map((emoji, idx) => (
                                        <span key={emoji} className="relative z-10 drop-shadow-sm text-[13px]" style={{ zIndex: 10 - idx }}>{emoji}</span>
                                    ))}
                                </div>
                                {totalReactions > 0 && (
                                    <span className="text-gray-600 font-medium pl-0.5 text-[11px]">{totalReactions}</span>
                                )}
                            </div>
                        )}

                        {/* Floating Inline Like Button */}
                        {!message.isRecall && onReact && (
                            <div
                                className={clsx(
                                    "relative flex items-center justify-center transition-opacity z-20",
                                    (totalReactions > 0 || isLastInGroup || isPickerVisible)
                                        ? "opacity-100"
                                        : "opacity-0 group-hover/bubble:opacity-100"
                                )}
                                onMouseEnter={() => setShowReactPicker(true)}
                                onMouseLeave={() => setShowReactPicker(false)}
                            >
                                <button
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleReact(latestEmoji || '👍'); }}
                                    className="w-[26px] h-[26px] bg-white border border-gray-200 outline-none text-gray-500 hover:text-blue-500 rounded-full shadow-sm flex items-center justify-center transition-colors"
                                    title="Thích"
                                >
                                    {latestEmoji ? (
                                        <span className="text-sm leading-none">{latestEmoji}</span>
                                    ) : (
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                                        </svg>
                                    )}
                                </button>

                                {/* Popup Reaction Picker dính ngay trên Nút Like Inline (có đệm pb-1 để ko mất hover) */}
                                {isPickerVisible && (
                                    <div className={clsx("absolute bottom-full pb-1 z-30", isMine ? "right-0" : "left-0")}>
                                        <div
                                            className={clsx(
                                                "bg-white rounded-[20px] shadow-[0_4px_12px_rgba(0,0,0,0.1)] border border-gray-100 p-1.5 flex items-center gap-1 transform hover:scale-100 transition-all",
                                                isMine ? "origin-bottom-right" : "origin-bottom-left"
                                            )}
                                            onMouseEnter={() => setIsHoveringReactions(true)}
                                            onMouseLeave={() => setIsHoveringReactions(false)}
                                        >
                                            {REACTIONS.map((emoji) => (
                                                <button
                                                    key={emoji}
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        handleReact(emoji);
                                                    }}
                                                    className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 rounded-full text-xl transition-all hover:-translate-y-1"
                                                >
                                                    {emoji}
                                                </button>
                                            ))}
                                            {/* Nút X xóa toàn bộ biểu cảm */}
                                            {totalReactions > 0 && onRemoveAllReactions && (
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        onRemoveAllReactions(message.id);
                                                        setShowReactPicker(false);
                                                        setIsHoveringReactions(false);
                                                    }}
                                                    className="w-9 h-9 flex items-center justify-center hover:bg-red-50 rounded-full text-gray-400 hover:text-red-500 transition-all text-lg font-bold border-l border-gray-200 ml-0.5 pl-0.5"
                                                    title="Xóa tất cả biểu cảm"
                                                >
                                                    ×
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Reaction Detail Popup Modal ── */}
            {showReactionDetail && totalReactions > 0 && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowReactionDetail(false)}>
                    <div
                        className="bg-white rounded-xl shadow-2xl w-[420px] max-h-[400px] flex flex-col overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                            <span className="font-semibold text-base text-gray-800">Biểu cảm</span>
                            <button
                                onClick={() => setShowReactionDetail(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Body: Left Tabs + Right User List */}
                        <div className="flex flex-1 overflow-hidden">
                            {/* Left: Emoji Tabs */}
                            <div className="w-[120px] border-r border-gray-100 overflow-y-auto bg-gray-50/50 shrink-0">
                                {/* Tất cả */}
                                <button
                                    onClick={() => setSelectedEmojiTab(null)}
                                    className={clsx(
                                        "w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors",
                                        selectedEmojiTab === null ? "bg-blue-50 text-blue-600 font-semibold border-r-2 border-blue-500" : "text-gray-600 hover:bg-gray-100"
                                    )}
                                >
                                    <span>Tất cả</span>
                                    <span className="text-xs font-medium">{totalReactions}</span>
                                </button>
                                {/* Each emoji tab */}
                                {sortedEmojis.map((emoji) => (
                                    <button
                                        key={emoji}
                                        onClick={() => setSelectedEmojiTab(emoji)}
                                        className={clsx(
                                            "w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors",
                                            selectedEmojiTab === emoji ? "bg-blue-50 text-blue-600 font-semibold border-r-2 border-blue-500" : "text-gray-600 hover:bg-gray-100"
                                        )}
                                    >
                                        <span className="text-base">{emoji}</span>
                                        <span className="text-xs font-medium">{reactionCounts[emoji]}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Right: User List */}
                            <div className="flex-1 overflow-y-auto">
                                {(() => {
                                    const reactions = Array.isArray(message.reactions) ? message.reactions : [];
                                    const filtered = selectedEmojiTab
                                        ? reactions.filter(r => r.emoji === selectedEmojiTab)
                                        : reactions;

                                    // Group by userId
                                    const userReactions: Record<string, string[]> = {};
                                    filtered.forEach(r => {
                                        if (!userReactions[r.userId]) userReactions[r.userId] = [];
                                        userReactions[r.userId].push(r.emoji);
                                    });

                                    return Object.entries(userReactions).map(([userId, emojis]) => {
                                        const participant = participants.find(p => p.id === userId);
                                        const name = participant?.fullName || participant?.username || userId.slice(0, 8);
                                        const avatar = participant?.avatarUrl;

                                        return (
                                            <div key={userId} className="flex items-center justify-between px-4 py-3 border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <img
                                                        src={getAvatarUrl(name, avatar)}
                                                        alt={name}
                                                        className="w-9 h-9 rounded-full object-cover shrink-0"
                                                    />
                                                    <span className="text-sm font-medium text-gray-800 truncate">{name}</span>
                                                </div>
                                                <div className="flex items-center gap-0.5 shrink-0 ml-2">
                                                    {/* Show unique emojis stacked */}
                                                    {[...new Set(emojis)].map((e) => (
                                                        <span key={e} className="text-base">{e}</span>
                                                    ))}
                                                    <span className="text-xs text-gray-500 font-medium ml-1">{emojis.length}</span>
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Message Detail Modal */}
            {showMessageDetail && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={() => setShowMessageDetail(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-[380px] max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
                            <h3 className="text-base font-semibold text-gray-800">Chi tiết tin nhắn</h3>
                            <button onClick={() => setShowMessageDetail(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="px-5 py-4 space-y-3 overflow-y-auto max-h-[60vh] text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Người gửi</span>
                                <span className="font-medium text-gray-800">{message.senderName || message.senderId.slice(0, 8)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Thời gian</span>
                                <span className="text-gray-800">{new Date(message.createdAt).toLocaleString('vi-VN')}</span>
                            </div>
                            {message.content && (
                                <div>
                                    <span className="text-gray-500 block mb-1">Nội dung</span>
                                    <p className="text-gray-800 bg-gray-50 rounded-lg p-2.5 break-words">{message.content}</p>
                                </div>
                            )}
                            {effectiveFileUrl && (
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500">Tệp đính kèm</span>
                                    <a href={effectiveFileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline truncate max-w-[180px] text-right">{effectiveFileName || 'Tải xuống'}</a>
                                </div>
                            )}
                            {effectiveFileSize && effectiveFileSize > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Kích thước</span>
                                    <span className="text-gray-800">{effectiveFileSize < 1024 * 1024 ? (effectiveFileSize / 1024).toFixed(1) + ' KB' : (effectiveFileSize / (1024 * 1024)).toFixed(1) + ' MB'}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-gray-500">Trạng thái</span>
                                <span className="text-gray-800">{message.pinned ? '📌 Đã ghim' : message.isRecall ? '🚫 Đã thu hồi' : '✓ Đã gửi'}</span>
                            </div>
                            {message.readBy && message.readBy.length > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Đã đọc</span>
                                    <span className="text-gray-800">{message.readBy.length} người</span>
                                </div>
                            )}
                            {totalReactions > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Biểu cảm</span>
                                    <span className="text-gray-800">{sortedEmojis.join(' ')} ({totalReactions})</span>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default MessageBubble;
