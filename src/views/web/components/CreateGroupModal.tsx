import React, { useState, useEffect, useRef } from 'react';
import { useGroupStore } from '@/shared/store/useGroupStore';
import { useChatStore } from '@/shared/store/useChatStore';
import { groupService } from '@/shared/services/groupService';
import { friendService } from '@/shared/services/friendService';

interface Friend {
    id: string;
    username: string;
    fullName: string;
    avatarUrl?: string;
}

const CreateGroupModal: React.FC = () => {
    const { isCreateGroupOpen, closeCreateGroup, onGroupCreated, createGroupPreselectedIds } = useGroupStore();
    const { upsertRoom } = useChatStore();

    const [groupName, setGroupName] = useState('');
    const [friends, setFriends] = useState<Friend[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isCreateGroupOpen) return;
        friendService.getFriends().then((data) => {
            const mapped: Friend[] = (data as any[]).map((f) => ({
                id: f.friend?.id || f.id || '',
                username: f.friend?.username || f.username || '',
                fullName: f.friend?.displayName || f.friend?.fullName || f.displayName || f.fullName || f.friend?.username || f.username || '',
                avatarUrl: f.friend?.avatarUrl || f.avatarUrl || undefined,
            })).filter((f) => !!f.id);
            setFriends(mapped);
        }).catch(console.error);
        setGroupName('');
        setSelectedIds(Array.isArray(createGroupPreselectedIds) ? [...new Set(createGroupPreselectedIds.filter(Boolean))] : []);
        setSearchQuery('');
        setError('');
        setTimeout(() => inputRef.current?.focus(), 100);
    }, [isCreateGroupOpen, createGroupPreselectedIds]);

    const filteredFriends = friends.filter((f) => {
        const q = searchQuery.toLowerCase();
        return f.fullName.toLowerCase().includes(q) || f.username.toLowerCase().includes(q);
    });

    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    };

    const buildDefaultGroupName = (ids: string[]) => {
        const picked = [...ids].sort(() => Math.random() - 0.5).slice(0, 3);
        const names = picked
            .map((id) => friends.find((f) => f.id === id))
            .filter(Boolean)
            .map((f) => (f as Friend).fullName || (f as Friend).username)
            .filter(Boolean);
        if (names.length === 0) return 'Nhóm mới';
        return names.join(', ');
    };

    const handleCreate = async () => {
        if (selectedIds.length < 3) { setError('Vui lòng chọn ít nhất 3 thành viên.'); return; }
        const finalName = groupName.trim() ? groupName.trim() : buildDefaultGroupName(selectedIds);
        setIsSubmitting(true);
        setError('');
        try {
            const newGroup = await groupService.createGroup(finalName, selectedIds);
            upsertRoom({
                id: newGroup.id,
                name: newGroup.groupName,
                type: 'GROUP',
                unreadCount: 0,
                participants: newGroup.members.map((m) => ({
                    id: m.userId, username: m.username, fullName: m.username, avatarUrl: m.avatarUrl,
                })),
                updatedAt: newGroup.createdAt,
            });
            closeCreateGroup();
            // Gọi callback của HomeWeb để chuyển phòng mà KHÔNG mất sidebar xanh
            onGroupCreated?.(newGroup.id);
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Tạo nhóm thất bại, vui lòng thử lại.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isCreateGroupOpen) return null;

    return (
        /* Backdrop */
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
            onClick={(e) => { if (e.target === e.currentTarget) closeCreateGroup(); }}
        >
            {/* Modal container */}
            <div
                className="bg-white rounded-xl flex flex-col overflow-hidden shadow-2xl"
                style={{ width: 480, maxHeight: '90vh' }}
            >
                {/* ── Header ── */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                    <span className="text-base font-semibold text-gray-900">Tạo nhóm</span>
                    <button onClick={closeCreateGroup} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* ── Tên nhóm row ── */}
                <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100">
                    {/* Camera / avatar nhóm placeholder */}
                    <div className="w-11 h-11 shrink-0 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 cursor-pointer hover:bg-gray-200 transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                        </svg>
                    </div>
                    {/* Input tên nhóm */}
                    <div className="flex-1 border-b-2 border-blue-500">
                        <input
                            ref={inputRef}
                            className="w-full text-sm outline-none py-1 placeholder-gray-400 bg-transparent"
                            placeholder="Nhập tên nhóm..."
                            value={groupName}
                            maxLength={50}
                            onChange={(e) => setGroupName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
                        />
                    </div>
                </div>

                {/* ── Search thanh tìm kiếm ── */}
                <div className="px-5 py-2 border-b border-gray-100">
                    <div className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-1.5">
                        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            className="flex-1 text-sm bg-transparent outline-none placeholder-gray-400"
                            placeholder="Nhập tên, số điện thoại, hoặc danh sách số điện thoại"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* ── Danh sách bạn bè ── */}
                <div className="flex-1 overflow-y-auto" style={{ minHeight: 280 }}>
                    {filteredFriends.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                            <svg className="w-12 h-12 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <p className="text-sm">{friends.length === 0 ? 'Chưa có bạn bè' : 'Không tìm thấy kết quả'}</p>
                        </div>
                    ) : (
                        <div>
                            <div className="px-5 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Trò chuyện gần đây
                            </div>
                            {filteredFriends.map((friend) => {
                                const isSelected = selectedIds.includes(friend.id);
                                const avatarSrc = friend.avatarUrl ||
                                    `https://ui-avatars.com/api/?name=${encodeURIComponent(friend.fullName || friend.username)}&background=0068FF&color=fff&bold=true`;
                                return (
                                    <div
                                        key={friend.id}
                                        onClick={() => toggleSelect(friend.id)}
                                        className="flex items-center gap-3 px-5 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors"
                                    >
                                        {/* Radio button Zalo style */}
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                                            isSelected ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                                        }`}>
                                            {isSelected && (
                                                <div className="w-2 h-2 rounded-full bg-white" />
                                            )}
                                        </div>
                                        {/* Avatar */}
                                        <img src={avatarSrc} alt={friend.fullName}
                                            className="w-10 h-10 rounded-full object-cover shrink-0" />
                                        {/* Name */}
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-gray-800 truncate">
                                                {friend.fullName || friend.username}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ── Selected chips (nếu có) ── */}
                {selectedIds.length > 0 && (
                    <div className="px-5 py-2 border-t border-gray-100 flex flex-wrap gap-1.5">
                        {selectedIds.map((id) => {
                            const f = friends.find((x) => x.id === id);
                            if (!f) return null;
                            return (
                                <span key={id} className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
                                    {f.fullName || f.username}
                                    <button onClick={(e) => { e.stopPropagation(); toggleSelect(id); }} className="hover:text-blue-900">×</button>
                                </span>
                            );
                        })}
                    </div>
                )}

                {/* Error */}
                {error && <p className="px-5 text-red-500 text-xs pb-1">{error}</p>}

                {/* ── Footer buttons ── */}
                <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200">
                    <button onClick={closeCreateGroup} disabled={isSubmitting}
                        className="px-5 py-2 text-sm rounded-lg text-gray-600 hover:bg-gray-100 transition-colors font-medium">
                        Hủy
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={isSubmitting || selectedIds.length < 3}
                        className="px-5 py-2 text-sm rounded-lg font-medium transition-colors"
                        style={{
                            backgroundColor: (isSubmitting || selectedIds.length < 3) ? '#93c5fd' : '#0068FF',
                            color: '#fff',
                            cursor: (isSubmitting || selectedIds.length < 3) ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {isSubmitting ? 'Đang tạo...' : 'Tạo nhóm'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateGroupModal;
