import React, { useState, useEffect } from 'react';
import { Modal } from 'zmp-ui';
import { useGroupStore } from '@/shared/store/useGroupStore';
import { groupService } from '@/shared/services/groupService';
import { friendService } from '@/shared/services/friendService';

interface Friend {
    id: string;
    username: string;
    fullName?: string;
    avatarUrl?: string;
}

interface AddMembersModalProps {
    roomId: string;
}

const AddMembersModal: React.FC<AddMembersModalProps> = ({ roomId }) => {
    const {
        isAddMembersOpen,
        closeAddMembers,
        currentGroupDetail,
        updateCurrentGroupDetail,
    } = useGroupStore();

    const [friends, setFriends] = useState<Friend[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    // Load bạn bè, lọc những người đã là thành viên
    useEffect(() => {
        if (!isAddMembersOpen) return;
        const existingMemberIds = new Set(currentGroupDetail?.members.map((m) => m.userId) || []);

        friendService.getFriends().then((data) => {
            const mapped: Friend[] = (data as any[]).map((f) => ({
                id: f.friend?.id || f.id || '',
                username: f.friend?.username || f.username || '',
                fullName: f.friend?.displayName || f.friend?.fullName || f.displayName || '',
                avatarUrl: f.friend?.avatarUrl || f.avatarUrl || undefined,
            }));
            // Chỉ hiển thị bạn bè chưa trong nhóm
            setFriends(mapped.filter((f) => !!f.id && !existingMemberIds.has(f.id)));
        }).catch(console.error);

        setSelectedIds([]);
        setSearchQuery('');
        setError('');
    }, [isAddMembersOpen, currentGroupDetail]);

    const filteredFriends = friends.filter((f) => {
        const q = searchQuery.toLowerCase();
        return (
            f.username.toLowerCase().includes(q) ||
            (f.fullName || '').toLowerCase().includes(q)
        );
    });

    const toggleSelect = (id: string) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    const handleAdd = async () => {
        if (selectedIds.length === 0) {
            setError('Vui lòng chọn ít nhất 1 người.');
            return;
        }
        setIsSubmitting(true);
        setError('');
        try {
            const updatedGroup = await groupService.addMembersToGroup(roomId, selectedIds);
            updateCurrentGroupDetail(updatedGroup);
            closeAddMembers();
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Thêm thành viên thất bại.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            visible={isAddMembersOpen}
            onClose={closeAddMembers}
            title="Thêm thành viên"
        >
            <div className="p-4 flex flex-col gap-4" style={{ minWidth: 340, maxWidth: 460 }}>
                {/* Tìm kiếm */}
                <input
                    className="w-full border border-[color:var(--border-secondary)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Tìm bạn bè..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />

                {/* Danh sách */}
                <div
                    className="border border-[color:var(--border-primary)] rounded-lg overflow-y-auto"
                    style={{ maxHeight: 280 }}
                >
                    {filteredFriends.length === 0 ? (
                        <div className="p-4 text-center text-gray-400 text-sm">
                            {friends.length === 0
                                ? 'Tất cả bạn bè đã là thành viên của nhóm'
                                : 'Không tìm thấy'}
                        </div>
                    ) : (
                        filteredFriends.map((friend) => {
                            const isSelected = selectedIds.includes(friend.id);
                            const avatarSrc =
                                friend.avatarUrl ||
                                `https://ui-avatars.com/api/?name=${encodeURIComponent(friend.username)}&background=0068FF&color=fff`;
                            return (
                                <div
                                    key={friend.id}
                                    onClick={() => toggleSelect(friend.id)}
                                    className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[color:var(--bg-hover)] transition-colors ${
                                        isSelected ? 'bg-blue-50' : ''
                                    }`}
                                >
                                    <img
                                        src={avatarSrc}
                                        alt={friend.username}
                                        className="w-9 h-9 rounded-full object-cover shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-[color:var(--text-primary)] truncate">
                                            {friend.fullName || friend.username}
                                        </div>
                                        <div className="text-xs text-[color:var(--text-secondary)] truncate">@{friend.username}</div>
                                    </div>
                                    <div
                                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                            isSelected ? 'bg-blue-600 border-blue-600' : 'border-[color:var(--border-secondary)]'
                                        }`}
                                    >
                                        {isSelected && (
                                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Label đã chọn */}
                {selectedIds.length > 0 && (
                    <p className="text-sm text-blue-600 font-medium">
                        Đã chọn {selectedIds.length} người
                    </p>
                )}

                {error && <p className="text-red-500 text-sm">{error}</p>}

                {/* Buttons */}
                <div className="flex gap-2 justify-end">
                    <button
                        onClick={closeAddMembers}
                        disabled={isSubmitting}
                        className="px-4 py-2 text-sm rounded-lg border border-[color:var(--border-secondary)] text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-hover)]"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleAdd}
                        disabled={isSubmitting || selectedIds.length === 0}
                        className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {isSubmitting ? 'Đang thêm...' : 'Xác nhận'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default AddMembersModal;
