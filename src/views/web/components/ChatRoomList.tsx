import React from 'react';
import { List } from 'zmp-ui';
import { ChatRoom } from '@/shared/types';
import ChatRoomItem from './ChatRoomItem';
import { useChatStore } from '@/shared/store/useChatStore';

interface ChatRoomListProps {
    rooms: ChatRoom[];
    selectedRoomId?: string | null;
    onSelectRoom?: (roomId: string) => void;
    filterTab?: 'all' | 'unread';
}

const ChatRoomList: React.FC<ChatRoomListProps> = React.memo(({ rooms, selectedRoomId, onSelectRoom, filterTab }) => {
    const pinnedRooms = useChatStore((s) => s.pinnedRooms);
    const emptyMessage = filterTab === 'unread'
        ? 'Không có cuộc trò chuyện chưa đọc'
        : 'Chưa có cuộc trò chuyện nào';

    // Sort: pinned rooms first (preserve relative order), then rest by updatedAt
    const sorted = [...rooms].sort((a, b) => {
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
