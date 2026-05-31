import React, { useRef, useState } from 'react';
import { Avatar } from 'zmp-ui';
import { ChatRoom } from '@/shared/types';
import { useRouter } from 'expo-router';
import { useThemeStore } from '@/shared/store/themeStore';
import { useChatStore } from '@/shared/store/useChatStore';
import { useAuthStore } from '@/shared/store/authStore';

interface ChatRoomItemProps {
    room: ChatRoom;
    isActive?: boolean;
    onSelect?: (roomId: string) => void;
    isPinned?: boolean;
}

/**
 * Định dạng thời gian hiển thị trong danh sách chat.
 * - Hôm nay:          HH:mm
 * - Hôm qua:          "Hôm qua"
 * - Trong vòng 7 ngày: "x ngày trước" / "x giờ trước" / "x phút trước"
 * - Cũ hơn 7 ngày:    DD/MM
 */
function formatChatTime(isoString?: string): string {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();

    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60_000);
    const diffHours = Math.floor(diffMs / 3_600_000);
    const diffDays = Math.floor(diffMs / 86_400_000);

    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) {
        // Trả về HH:mm
        return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    if (isYesterday) {
        return 'Hôm qua';
    }
    if (diffDays < 7) {
        if (diffDays >= 2) return `${diffDays} ngày trước`;
        if (diffHours >= 1) return `${diffHours} giờ trước`;
        if (diffMins >= 1) return `${diffMins} phút trước`;
        return 'Vừa xong';
    }
    // Cũ hơn 7 ngày → DD/MM
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

const ChatRoomItem: React.FC<ChatRoomItemProps> = React.memo(({ room, isActive, onSelect, isPinned }) => {
    const router = useRouter();
    const isDark = useThemeStore((s) => s.theme === 'dark');
    const isMuted = useChatStore((s) => s.mutedRooms.has(room.id));
    const currentUserId = useAuthStore((s) => s.user?.id);
    const { togglePinRoom, toggleMuteRoom, markRoomAsUnread, deleteRoom } = useChatStore();

    const [showMenu, setShowMenu] = useState(false);
    const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
    const moreBtnRef = useRef<HTMLButtonElement>(null);

    const onPress = () => {
        if (onSelect) {
            onSelect(room.id);
        } else {
            router.push(`/chat/${room.id}`);
        }
    };

    const getLastMessagePreview = (): string => {
        if (!room.lastMessage) return 'Chưa có tin nhắn';

        // Kiểm tra xem tin nhắn đã bị xóa phía tôi (localStorage)
        if (currentUserId) {
            try {
                const raw = localStorage.getItem(`DELETED_MESSAGES_${currentUserId}`);
                if (raw) {
                    const deletedIds = JSON.parse(raw);
                    if (Array.isArray(deletedIds) && deletedIds.includes(room.lastMessage.id)) {
                        return 'Tin nhắn đã bị xóa';
                    }
                }
            } catch (e) {
                // ignore
            }
        }

        // Kiểm tra tin nhắn đã thu hồi
        const isRecalledMsg = 
            room.lastMessage.isRecall === true || 
            room.lastMessage.recalled === true || 
            String(room.lastMessage.content || '').trim() === '[Tin nhắn đã thu hồi]';
            
        if (isRecalledMsg) return '[Tin nhắn đã thu hồi]';

        const { content, type, senderName } = room.lastMessage;

        let text: string = 'Tin nhắn mới';

        // 1. AUTO-DETECT CALL JSON (Ưu tiên cao nhất cho tin nhắn cuộc gọi)
        if (content && content.trim().startsWith('{') && content.includes('"callType":')) {
            try {
                const parsed = JSON.parse(content);
                const isVideo = parsed.callType === 'VIDEO';
                const icon = isVideo ? '📹' : '📞';
                if (parsed.status === 'MISSED') text = `${icon} Cuộc gọi nhỡ`;
                else if (parsed.status === 'REJECTED' || parsed.status === 'CANCELLED') text = `${icon} Cuộc gọi bị hủy`;
                else text = `${icon} Cuộc gọi ${isVideo ? 'video' : 'thoại'}`;
                
                // Trả về luôn nếu là JSON cuộc gọi
                return room.type === 'GROUP' && senderName ? `${senderName.split(' ').pop()}: ${text}` : text;
            } catch (e) {
                // Parse fail, tiếp tục xử lý theo type thông thường
            }
        }

        // 2. Xử lý theo Type thông thường
        switch (type) {
            case 'TEXT':
                if (content && content.startsWith('{"type":"STORY_QUOTE"')) {
                    try {
                        const data = JSON.parse(content);
                        const txt = data.replyText ? `: ${data.replyText}` : "";
                        text = `[Khoảnh khắc]${txt}`;
                    } catch {
                        text = '[Khoảnh khắc]';
                    }
                } else {
                    text = content;
                }
                break;
            case 'IMAGE':
                text = '[Hình ảnh]';
                break;
            case 'VIDEO':
                text = '[Video]';
                break;
            case 'FILE':
            case 'DOCUMENT':
                text = '[Tập tin]';
                break;
            case 'STICKER':
                text = '[Sticker]';
                break;
            case 'CALL_VOICE':
            case 'CALL_VIDEO':
                try {
                    const parsed = JSON.parse(content);
                    const isVideo = type === 'CALL_VIDEO';
                    const icon = isVideo ? '📹' : '📞';
                    if (parsed.status === 'MISSED') text = `${icon} Cuộc gọi nhỡ`;
                    else if (parsed.status === 'REJECTED' || parsed.status === 'CANCELLED') text = `${icon} Cuộc gọi bị hủy`;
                    else text = `${icon} Cuộc gọi ${isVideo ? 'video' : 'thoại'}`;
                } catch (e) {
                    text = type === 'CALL_VIDEO' ? '📹 Cuộc gọi video' : '📞 Cuộc gọi thoại';
                }
                break;
        }

        // Cloud: không hiển thị tiền tố senderName (self chat)
        if (room.type === 'CLOUD') return text;

        // Với nhóm chat: thêm tên người gửi làm tiền tố
        if (room.type === 'GROUP' && senderName) {
            // Rút gọn tên: lấy từ cuối cùng (tên)
            const shortName = senderName.split(' ').pop() || senderName;
            return `${shortName}: ${text}`;
        }

        return text;
    };

    const isCloud = room.type === 'CLOUD';
    const resolvedName = isCloud ? 'Cloud của tôi' : room.name;
    const hasUnread = (room.unreadCount ?? 0) > 0;
    const activeBg = isDark ? 'rgba(137,180,250,0.12)' : '#eff6ff';
    const hoverBg = isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb';

    return (
        <div
            onClick={onPress}
            className="flex items-center p-3 cursor-pointer group"
            style={{
                backgroundColor: isActive ? activeBg : 'transparent',
                transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = hoverBg;
            }}
            onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
            }}
        >
            {isCloud ? (
                <div className="mr-3 w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                    <span className="text-xl">☁️</span>
                </div>
            ) : (
                <Avatar
                    src={room.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(resolvedName)}&background=4A90D9&color=fff&size=64`}
                    className="mr-3"
                />
            )}

            <div className="flex-1 min-w-0 pr-2">
                {/* Tên phòng / người dùng */}
                <div
                    className="truncate text-base"
                    style={{
                        fontWeight: hasUnread ? 700 : 400,
                        color: 'var(--text-primary)',
                    }}
                >
                    {resolvedName}
                </div>

                {/* Nội dung tin nhắn cuối */}
                <div
                    className="truncate text-sm mt-0.5"
                    style={{
                        fontWeight: hasUnread ? 700 : 400,
                        color: hasUnread ? 'var(--text-primary)' : 'var(--text-muted)',
                    }}
                >
                    {getLastMessagePreview()}
                </div>
            </div>

            {/* Timestamp + badge + pin + muted */}
            <div className="flex flex-col items-end whitespace-nowrap pl-2">
                <div className="flex items-center gap-1">
                    <button
                        ref={moreBtnRef}
                        onClick={(e) => {
                            e.stopPropagation();
                            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                            setMenuPos({ top: rect.bottom + 6, right: Math.max(8, window.innerWidth - rect.right) });
                            setShowMenu(true);
                        }}
                        className="w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-gray-200/60 transition-all"
                        title="Tùy chọn"
                    >
                        <svg className="w-4 h-4 text-[color:var(--text-secondary)]" fill="currentColor" viewBox="0 0 24 24">
                            <circle cx="5" cy="12" r="2" />
                            <circle cx="12" cy="12" r="2" />
                            <circle cx="19" cy="12" r="2" />
                        </svg>
                    </button>
                    {isPinned && (
                        <svg className="w-3 h-3 text-blue-400 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
                        </svg>
                    )}
                    {isMuted && (
                        <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                        </svg>
                    )}
                    <span
                        style={{
                            fontSize: 11,
                            fontWeight: hasUnread ? 700 : 400,
                            color: hasUnread ? 'var(--accent)' : 'var(--text-muted)',
                        }}
                    >
                        {formatChatTime(room.lastMessage?.createdAt || room.updatedAt)}
                    </span>
                </div>

                {hasUnread && (
                    <div
                        style={{
                            backgroundColor: isMuted ? '#9ca3af' : '#ef4444',
                            minWidth: 20,
                            height: 20,
                            borderRadius: 10,
                            padding: '0 4px',
                        }}
                        className="flex items-center justify-center mt-1 text-white text-[11px] font-bold leading-none"
                    >
                        {room.unreadCount > 99 ? '99+' : room.unreadCount}
                    </div>
                )}
            </div>

            {/* More menu */}
            {showMenu && menuPos && (
                <>
                    <div
                        style={{ position: 'fixed', inset: 0, zIndex: 60 }}
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowMenu(false);
                            setMenuPos(null);
                        }}
                    />
                    <div
                        style={{
                            position: 'fixed',
                            top: menuPos.top,
                            right: menuPos.right,
                            zIndex: 61,
                            minWidth: 220,
                        }}
                        className="bg-[color:var(--bg-primary)] rounded-xl shadow-lg border border-[color:var(--border-primary)] py-1.5"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            className="w-full text-left px-4 py-2 hover:bg-[color:var(--bg-hover)] text-sm text-[color:var(--text-secondary)]"
                            onClick={() => {
                                togglePinRoom(room.id);
                                setShowMenu(false);
                                setMenuPos(null);
                            }}
                        >
                            {isPinned ? 'Bỏ ghim hội thoại' : 'Ghim hội thoại'}
                        </button>
                        <button
                            className="w-full text-left px-4 py-2 hover:bg-[color:var(--bg-hover)] text-sm text-[color:var(--text-secondary)]"
                            onClick={() => {
                                markRoomAsUnread(room.id, 1);
                                setShowMenu(false);
                                setMenuPos(null);
                            }}
                        >
                            Đánh dấu chưa đọc
                        </button>
                        <button
                            className="w-full text-left px-4 py-2 hover:bg-[color:var(--bg-hover)] text-sm text-[color:var(--text-secondary)]"
                            onClick={() => {
                                toggleMuteRoom(room.id);
                                setShowMenu(false);
                                setMenuPos(null);
                            }}
                        >
                            {isMuted ? 'Bật thông báo' : 'Tắt thông báo'}
                        </button>
                        <div className="border-t border-[color:var(--border-primary)] my-1" />
                        <button
                            className="w-full text-left px-4 py-2 hover:bg-red-50 text-sm text-red-600"
                            onClick={() => {
                                deleteRoom(room.id);
                                setShowMenu(false);
                                setMenuPos(null);
                            }}
                        >
                            Xóa đoạn chat
                        </button>
                    </div>
                </>
            )}
        </div>
    );
});

ChatRoomItem.displayName = 'ChatRoomItem';

export default ChatRoomItem;
