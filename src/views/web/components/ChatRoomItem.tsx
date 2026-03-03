import React from 'react';
import { Avatar } from 'zmp-ui';
import { ChatRoom } from '@/shared/types';
import { useRouter } from 'expo-router';
import { useThemeStore } from '@/shared/store/themeStore';

interface ChatRoomItemProps {
    room: ChatRoom;
    isActive?: boolean;
    onSelect?: (roomId: string) => void;
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

const ChatRoomItem: React.FC<ChatRoomItemProps> = React.memo(({ room, isActive, onSelect }) => {
    const router = useRouter();
    const isDark = useThemeStore((s) => s.theme === 'dark');

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

        let text: string;
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
            default:
                text = 'Tin nhắn mới';
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

            {/* Timestamp + badge */}
            <div className="flex flex-col items-end whitespace-nowrap pl-2">
                <span
                    style={{
                        fontSize: 11,
                        fontWeight: hasUnread ? 700 : 400,
                        color: hasUnread ? 'var(--accent)' : 'var(--text-muted)',
                    }}
                >
                    {formatChatTime(room.lastMessage?.createdAt || room.updatedAt)}
                </span>

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
