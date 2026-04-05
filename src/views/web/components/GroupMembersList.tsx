import React, { useState, useRef, useEffect } from 'react';
import { GroupMember, GroupRole } from '@/shared/types';
import { friendService } from '@/shared/services/friendService';

interface GroupMembersListProps {
    members: GroupMember[];
    ownerId: string;
    currentUserId?: string;
    onChangeRole?: (userId: string, newRole: GroupRole) => void;
    onRemoveMember?: (userId: string) => void;
    visible: boolean;
    onClose: () => void;
}

const GroupMembersList: React.FC<GroupMembersListProps> = ({
    members,
    ownerId,
    currentUserId,
    onChangeRole,
    onRemoveMember,
    visible,
    onClose,
}) => {
    const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
    const [menuPos, setMenuPos] = useState<{ top: number; left?: number; right?: number } | null>(null);
    const menuBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
    const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
    const [pendingSentIds, setPendingSentIds] = useState<Set<string>>(new Set());
    const [sendingFriendReq, setSendingFriendReq] = useState<string | null>(null);

    const sorted = [...members].sort((a, b) => {
        const aIsOwner = a.userId === ownerId;
        const bIsOwner = b.userId === ownerId;
        if (aIsOwner !== bIsOwner) return aIsOwner ? -1 : 1;
        if (a.role === 'ADMIN' && b.role !== 'ADMIN') return -1;
        if (a.role !== 'ADMIN' && b.role === 'ADMIN') return 1;
        const aName = a.fullName || a.username;
        const bName = b.fullName || b.username;
        return aName.localeCompare(bName);
    });

    const isOwner = currentUserId === ownerId;

    useEffect(() => {
        if (!visible) {
            setMenuOpenFor(null);
            setMenuPos(null);
            return;
        }
        Promise.all([
            friendService.getFriends(),
            friendService.getSentRequests(),
        ]).then(([friends, sent]) => {
            const fIds = new Set<string>();
            (friends as any[]).forEach((f) => {
                const id = f.friend?.id || f.id;
                if (id) fIds.add(id);
            });
            setFriendIds(fIds);

            const sIds = new Set<string>();
            (sent as any[]).forEach((s) => {
                const id = s.friend?.id || s.id;
                if (id) sIds.add(id);
            });
            setPendingSentIds(sIds);
        }).catch(console.error);
    }, [visible]);

    const handleToggleMenu = (userId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (menuOpenFor === userId) {
            setMenuOpenFor(null);
            setMenuPos(null);
            return;
        }
        const btn = menuBtnRefs.current[userId];
        if (!btn) return;
        const rect = btn.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const menuHeight = 120;
        const openUpward = spaceBelow < menuHeight;
        setMenuPos({
            top: openUpward ? rect.top - menuHeight : rect.bottom + 4,
            right: window.innerWidth - rect.right,
        });
        setMenuOpenFor(userId);
    };

    const handleSendFriendRequest = async (userId: string) => {
        setSendingFriendReq(userId);
        try {
            await friendService.sendFriendRequest({ friendId: userId });
            setPendingSentIds((prev) => new Set(prev).add(userId));
        } catch (err) {
            console.error('Failed to send friend request:', err);
        } finally {
            setSendingFriendReq(null);
        }
    };

    if (!visible) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl w-[420px] max-h-[80vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 shrink-0">
                    <span className="font-semibold text-base text-gray-800">
                        Thành viên nhóm ({members.length})
                    </span>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Member list */}
                <div className="flex-1 overflow-y-auto">
                    {sorted.map((member) => {
                        const displayName = member.fullName || member.username;
                        const avatarSrc =
                            member.avatarUrl ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=0068FF&color=fff&bold=true`;
                        const isOwnerMember = member.userId === ownerId;
                        const isAdminMember = member.role === 'ADMIN';
                        const isMe = member.userId === currentUserId;
                        const showOwnerMenu = isOwner && !isOwnerMember && !isMe;
                        const isFriend = friendIds.has(member.userId);
                        const isPendingSent = pendingSentIds.has(member.userId);
                        const showAddFriend = !isOwner && !isMe && !isFriend && !isOwnerMember;

                        return (
                            <div
                                key={member.userId}
                                className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors"
                            >
                                <img
                                    src={avatarSrc}
                                    alt={displayName}
                                    className="w-10 h-10 rounded-full object-cover shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-gray-800 truncate">
                                        {displayName}
                                        {isMe && <span className="text-xs text-gray-400 ml-1">(Bạn)</span>}
                                    </div>
                                </div>

                                {/* Badge */}
                                {(isOwnerMember || isAdminMember) && (
                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                                        isOwnerMember
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'bg-purple-100 text-purple-700'
                                    }`}>
                                        {isOwnerMember ? 'Trưởng nhóm' : 'Phó nhóm'}
                                    </span>
                                )}

                                {/* Owner: 3-dot menu */}
                                {showOwnerMenu && (
                                    <button
                                        ref={(el) => { menuBtnRefs.current[member.userId] = el; }}
                                        onClick={(e) => handleToggleMenu(member.userId, e)}
                                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-all shrink-0"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01" />
                                        </svg>
                                    </button>
                                )}

                                {/* Non-owner: Add friend button */}
                                {showAddFriend && (
                                    isPendingSent ? (
                                        <span className="text-xs text-gray-400 px-2 py-1 shrink-0">Đã gửi lời mời</span>
                                    ) : (
                                        <button
                                            onClick={() => handleSendFriendRequest(member.userId)}
                                            disabled={sendingFriendReq === member.userId}
                                            className="text-xs text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full font-medium transition-colors shrink-0 disabled:opacity-50"
                                        >
                                            {sendingFriendReq === member.userId ? '...' : 'Kết bạn'}
                                        </button>
                                    )
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Fixed-position dropdown menu for owner actions */}
                {menuOpenFor && menuPos && (
                    <>
                        <div
                            style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
                            onClick={() => { setMenuOpenFor(null); setMenuPos(null); }}
                        />
                        <div
                            style={{
                                position: 'fixed',
                                top: menuPos.top,
                                right: menuPos.right,
                                zIndex: 9999,
                                minWidth: 180,
                            }}
                            className="bg-white rounded-xl shadow-xl border border-gray-100 py-1"
                        >
                            {(() => {
                                const member = members.find((m) => m.userId === menuOpenFor);
                                if (!member) return null;
                                const isAdminMember = member.role === 'ADMIN';
                                return (
                                    <>
                                        {isAdminMember ? (
                                            <button
                                                className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors"
                                                onClick={() => {
                                                    onChangeRole?.(member.userId, 'MEMBER');
                                                    setMenuOpenFor(null);
                                                    setMenuPos(null);
                                                }}
                                            >
                                                <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                                </svg>
                                                Thu hồi phó nhóm
                                            </button>
                                        ) : (
                                            <button
                                                className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors"
                                                onClick={() => {
                                                    onChangeRole?.(member.userId, 'ADMIN');
                                                    setMenuOpenFor(null);
                                                    setMenuPos(null);
                                                }}
                                            >
                                                <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                                </svg>
                                                Phong làm phó nhóm
                                            </button>
                                        )}
                                        {onRemoveMember && (
                                            <>
                                                <div className="border-t border-gray-100 my-0.5" />
                                                <button
                                                    className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition-colors"
                                                    onClick={() => {
                                                        onRemoveMember(member.userId);
                                                        setMenuOpenFor(null);
                                                        setMenuPos(null);
                                                    }}
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
                                                    </svg>
                                                    Xóa khỏi nhóm
                                                </button>
                                            </>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default React.memo(GroupMembersList);
