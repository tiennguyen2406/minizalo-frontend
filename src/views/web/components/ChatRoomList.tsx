import React from 'react';
import { List } from 'zmp-ui';
import { ChatRoom } from '@/shared/types';
import ChatRoomItem from './ChatRoomItem';
import { useChatStore } from '@/shared/store/useChatStore';

interface ChatRoomListProps {
    rooms: ChatRoom[];
    selectedRoomId?: string | null;
    onSelectRoom?: (roomId: string) => void;
    filterTab?: 'all' | 'unread' | 'strangers';
    /** Đang tải danh sách bạn bè để phân loại chat người lạ (chỉ dùng với tab strangers). */
    strangersClassifyLoading?: boolean;
}

const ChatRoomList: React.FC<ChatRoomListProps> = React.memo(({ rooms, selectedRoomId, onSelectRoom, filterTab, strangersClassifyLoading }) => {
    const pinnedRooms = useChatStore((s) => s.pinnedRooms);
    const emptyMessage =
        strangersClassifyLoading && filterTab === 'strangers'
            ? 'Đang tải danh sách…'
            : filterTab === 'unread'
              ? 'Không có cuộc trò chuyện chưa đọc'
              : filterTab === 'strangers'
                ? 'Không có tin nhắn từ người lạ'
                : 'Chưa có cuộc trò chuyện nào';

    // Sort: Cloud luôn ở trên cùng, sau đó pinned rooms
    const sorted = [...rooms].sort((a, b) => {
        if (a.type === 'CLOUD' && b.type !== 'CLOUD') return -1;
        if (b.type === 'CLOUD' && a.type !== 'CLOUD') return 1;
        const aPinned = pinnedRooms.has(a.id);
        const bPinned = pinnedRooms.has(b.id);
        if (aPinned !== bPinned) return aPinned ? -1 : 1;
        return 0; // keep original order within each group
    });

    return (
        <List
            className="h-full overflow-y-auto"
            style={{
                backgroundColor: 'var(--bg-primary)',
                transition: 'background-color 0.3s ease',
            }}
        >
            {sorted.length === 0 ? (
                <div className="p-4 text-center" style={{ color: 'var(--text-muted)' }}>
                    {emptyMessage}
                </div>
            ) : (
                sorted.map((room) => (
                    <ChatRoomItem
                        key={room.id}
                        room={room}
                        isActive={selectedRoomId === room.id}
                        onSelect={onSelectRoom}
                        isPinned={pinnedRooms.has(room.id)}
                    />
                ))
            )}
        </List>
    );
});

ChatRoomList.displayName = 'ChatRoomList';

export default ChatRoomList;
