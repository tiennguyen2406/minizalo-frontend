import React from 'react';
import { Avatar } from 'zmp-ui';
import { ChatRoom } from '@/shared/types';
import { useRouter } from 'expo-router';
import { useThemeStore } from '@/shared/store/themeStore';
import { useChatStore } from '@/shared/store/useChatStore';

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

    const onPress = () => {
        if (onSelect) {
            onSelect(room.id);
        } else {
            router.push(`/chat/${room.id}`);
        }
    };

    const getLastMessagePreview = (): string => {
        if (!room.lastMessage) return 'Chưa có tin nhắn';
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
                text = content;
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

        // Với nhóm chat: thêm tên người gửi làm tiền tố
        if (room.type === 'GROUP' && senderName) {
            // Rút gọn tên: lấy từ cuối cùng (tên)
            const shortName = senderName.split(' ').pop() || senderName;
            return `${shortName}: ${text}`;
        }

        return text;
    };

    const hasUnread = (room.unreadCount ?? 0) > 0;
    const activeBg = isDark ? 'rgba(137,180,250,0.12)' : '#eff6ff';
    const hoverBg = isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb';

    return (
        <div
            onClick={onPress}
            className="flex items-center p-3 cursor-pointer"
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
            <Avatar
                src={room.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(room.name)}&background=4A90D9&color=fff&size=64`}
                className="mr-3"
            />

            <div className="flex-1 min-w-0 pr-2">
                {/* Tên phòng / người dùng */}
                <div
                    className="truncate text-base"
                    style={{
                        fontWeight: hasUnread ? 700 : 400,
                        color: 'var(--text-primary)',
                    }}
                >
                    {room.name}
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
                            backgroundColor: '#ef4444',
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
        </div>
    );
});

ChatRoomItem.displayName = 'ChatRoomItem';

export default ChatRoomItem;
