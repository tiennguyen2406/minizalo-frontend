import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { CollapsibleSection, ActionButton, ActionButtonRow, ToggleSwitch } from './ChatInfoHelpers';
import { useGroupStore } from '@/shared/store/useGroupStore';
import { useAuthStore } from '@/shared/store/authStore';
import { groupService } from '@/shared/services/groupService';
import { useChatStore } from '@/shared/store/useChatStore';
import { MessageService } from '@/shared/services/MessageService';
import GroupMembersList from './GroupMembersList';
import ConfirmModal from './ConfirmModal';
import ForwardMessageModal from './ForwardMessageModal';
import GroupManagementPanel from './GroupManagementPanel';
import { Message } from '@/shared/types';

// ── Mute Duration Modal ─────────────────────────────────────────────────
const MUTE_OPTIONS = [
    { id: '1h', label: 'Trong 1 giờ' },
    { id: '4h', label: 'Trong 4 giờ' },
    { id: '8am', label: 'Cho đến 8:00 AM' },
    { id: 'forever', label: 'Cho đến khi được mở lại' },
] as const;

const MuteModal: React.FC<{ onClose: () => void; onConfirm: (id: string) => void }> = ({ onClose, onConfirm }) => {
    const [selected, setSelected] = useState('1h');
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-80 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <span className="font-semibold text-gray-800">Xác nhận</span>
                    <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="px-5 py-4">
                    <p className="text-sm text-gray-600 mb-4">Bạn có chắc muốn tắt thông báo hội thoại này:</p>
                    <div className="flex flex-col gap-3">
                        {MUTE_OPTIONS.map((opt) => (
                            <label key={opt.id} className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="radio"
                                    name="mute"
                                    value={opt.id}
                                    checked={selected === opt.id}
                                    onChange={() => setSelected(opt.id)}
                                    className="w-4 h-4 accent-blue-600"
                                />
                                <span className="text-sm text-gray-700">{opt.label}</span>
                            </label>
                        ))}
                    </div>
                </div>
                <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100">
                    <button onClick={onClose} className="px-5 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors">Hủy</button>
                    <button onClick={() => { onConfirm(selected); onClose(); }} className="px-5 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors">Đồng ý</button>
                </div>
            </div>
        </div>
    );
};

// ── Rename Group Modal ─────────────────────────────────────────────────
/** Trưởng nhóm rời nhóm: phải chọn một thành viên còn lại làm trưởng nhóm mới */
const PickSuccessorLeaveModal: React.FC<{
    members: { userId: string; username: string; fullName?: string; avatarUrl?: string }[];
    currentUserId: string;
    selectedUserId: string | null;
    onSelectUserId: (id: string | null) => void;
    onClose: () => void;
    onConfirm: () => void;
    loading: boolean;
}> = ({
    members,
    currentUserId,
    selectedUserId,
    onSelectUserId,
    onClose,
    onConfirm,
    loading,
}) => {
    const candidates = members.filter((m) => m.userId !== currentUserId);
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-xl w-[400px] max-h-[85vh] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
                    <span className="font-semibold text-gray-800">Chọn trưởng nhóm mới</span>
                    <button onClick={onClose} type="button" className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="px-5 py-3 border-b border-gray-50">
                    <p className="text-sm text-gray-600">
                        Bạn đang là trưởng nhóm. Chọn một thành viên để nhường quyền trước khi rời nhóm.
                    </p>
                </div>
                <div className="flex-1 overflow-y-auto min-h-[120px] max-h-[320px] styled-scrollbar">
                    {candidates.length === 0 ? (
                        <div className="px-5 py-8 text-sm text-gray-500 text-center">Không có thành viên khác trong nhóm.</div>
                    ) : (
                        candidates.map((m) => {
                            const label = m.fullName?.trim() || m.username;
                            const avatar =
                                m.avatarUrl ||
                                `https://ui-avatars.com/api/?name=${encodeURIComponent(label)}&background=0068FF&color=fff&bold=true`;
                            const sel = selectedUserId === m.userId;
                            return (
                                <button
                                    key={m.userId}
                                    type="button"
                                    onClick={() => onSelectUserId(m.userId)}
                                    className={`w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 ${sel ? 'bg-blue-50' : ''}`}
                                >
                                    <img src={avatar} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-gray-800 truncate">{label}</div>
                                        <div className="text-xs text-gray-400 truncate">@{m.username}</div>
                                    </div>
                                    <input type="radio" readOnly checked={sel} className="w-4 h-4 accent-blue-600 shrink-0" />
                                </button>
                            );
                        })
                    )}
                </div>
                <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100 shrink-0">
                    <button type="button" onClick={onClose} className="px-5 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors">
                        Hủy
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={loading || !selectedUserId || candidates.length === 0}
                        className="px-5 py-2 text-sm text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg font-medium transition-colors"
                    >
                        {loading ? 'Đang xử lý...' : 'Nhường quyền và rời nhóm'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const RenameGroupModal: React.FC<{
    currentName: string;
    onClose: () => void;
    onConfirm: (newName: string) => Promise<void>;
}> = ({ currentName, onClose, onConfirm }) => {
    // Tên group có thể bị null/undefined
    const [name, setName] = useState(currentName || '');
    const [saving, setSaving] = useState(false);
    
    const handleConfirm = async () => {
        const trimmed = (name || '').trim();
        if (!trimmed || trimmed === (currentName || '').trim()) { onClose(); return; }
        setSaving(true);
        try { await onConfirm(trimmed); onClose(); } finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-80 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="px-5 pt-6 pb-2 flex flex-col items-center text-center">
                    <div className="text-4xl mb-3">📅</div>
                    <h3 className="font-semibold text-gray-800 mb-1">Đổi tên nhóm</h3>
                    <p className="text-sm text-gray-500 mb-4">Bạn có chắc chắn muốn đổi tên nhóm, khi xác nhận tên nhóm mới sẽ hiển thị với tất cả thành viên.</p>
                    <input
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400 mb-4"
                        value={name || ''}
                        onChange={(e) => setName(e.target.value)}
                        maxLength={50}
                        autoFocus
                        onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
                    />
                </div>
                <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100">
                    <button onClick={onClose} className="px-5 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors">Hủy</button>
                    <button onClick={handleConfirm} disabled={saving || !(name || '').trim()} className="px-5 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-medium transition-colors">{saving ? 'Đang lưu...' : 'Xác nhận'}</button>
                </div>
            </div>
        </div>
    );
};

interface GroupInfoPanelProps {
    roomId: string;
    onClose: () => void;
}

// ─── SVG Icon set ────────────────────────────────────────────────────────────
const Icon = {
    Bell: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
    Pin: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>,
    AddMember: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>,
    Settings: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    Users: () => <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>,
    Clock: () => <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Link: () => <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>,
    Copy: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
    File: () => <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>,
    Eye: () => <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>,
    Alert: () => <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>,
    Trash: () => <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>,
    Leave: () => <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg>,
    Share: () => <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>,
};

// Helpers
function formatBytes(bytes?: number): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const URL_REGEX = /(https?:\/\/[^\s]+)/g;
function extractUrls(text: string): string[] {
    return [...(text.match(URL_REGEX) || [])];
}

const GroupInfoPanel: React.FC<GroupInfoPanelProps> = ({ roomId, onClose }) => {
    const { currentGroupDetail, setCurrentGroupDetail, openAddMembers, openGroupManagement, isGroupManagementOpen } = useGroupStore();
    const { user } = useAuthStore();
    const { rooms, setRooms, pinnedRooms, togglePinRoom, mutedRooms, toggleMuteRoom, upsertRoom } = useChatStore();

    const [isLeaving, setIsLeaving] = useState(false);
    const [hideConversation, setHideConversation] = useState(false);
    const [muteLabel, setMuteLabel] = useState<string | null>(null); // null = not muted
    const [autoDeleteMsg] = useState('Không bao giờ');
    const [showMembersModal, setShowMembersModal] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const [mediaMenu, setMediaMenu] = useState<{ open: boolean; message?: Message; top?: number; left?: number } | null>(null);
    const [forwardingMessages, setForwardingMessages] = useState<Message[] | null>(null);

    // Modal states
    const [showMuteModal, setShowMuteModal] = useState(false);
    const [showRenameModal, setShowRenameModal] = useState(false);
    const [isClearHistoryModalOpen, setIsClearHistoryModalOpen] = useState(false);
    const [isLeaveGroupModalOpen, setIsLeaveGroupModalOpen] = useState(false);
    const [pickSuccessorLeaveOpen, setPickSuccessorLeaveOpen] = useState(false);
    const [leaveSuccessorUserId, setLeaveSuccessorUserId] = useState<string | null>(null);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const avatarInputRef = useRef<HTMLInputElement>(null);

    const isPinned = pinnedRooms.has(roomId);

    const showToast = useCallback((msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 2200);
    }, []);

    const handleMuteConfirm = useCallback((optionId: string) => {
        const labels: Record<string, string> = {
            '1h': '1 giờ', '4h': '4 giờ', '8am': 'đến 8:00 AM', 'forever': 'mãi mãi',
        };
        setMuteLabel(labels[optionId] || optionId);
        if (!mutedRooms.has(roomId)) toggleMuteRoom(roomId);
        showToast(`Đã tắt thông báo ${labels[optionId]}`);
    }, [showToast, mutedRooms, toggleMuteRoom, roomId]);

    const handleUnmute = useCallback(() => {
        setMuteLabel(null);
        if (mutedRooms.has(roomId)) toggleMuteRoom(roomId);
        showToast('Đã bật thông báo');
    }, [showToast, mutedRooms, toggleMuteRoom, roomId]);

    const handleRenameGroup = useCallback(async (newName: string) => {
        try {
            await groupService.renameGroup(roomId, newName);
            // Update local group detail panel
            if (currentGroupDetail) {
                setCurrentGroupDetail({ ...currentGroupDetail, groupName: newName });
            }
            // Update sidebar rooms list immediately
            const room = rooms.find((r) => r.id === roomId);
            if (room) upsertRoom({ ...room, name: newName });
            showToast('Đã đổi tên nhóm');
        } catch {
            showToast('Không thể đổi tên nhóm');
            throw new Error('rename failed');
        }
    }, [roomId, currentGroupDetail, setCurrentGroupDetail, rooms, upsertRoom, showToast]);

    const handleChangeRole = useCallback(async (userId: string, newRole: 'ADMIN' | 'MEMBER') => {
        if (!roomId || !currentGroupDetail) return;
        try {
            const updatedGroup = await groupService.changeRole(roomId, userId, newRole);
            setCurrentGroupDetail(updatedGroup);
            showToast(newRole === 'ADMIN' ? 'Đã phong phó nhóm' : 'Đã thu hồi quyền phó nhóm');
        } catch (err: any) {
            console.error('Failed to change role:', err);
            showToast('Thay đổi quyền thất bại');
        }
    }, [roomId, currentGroupDetail, setCurrentGroupDetail, showToast]);

    const handleRemoveMember = useCallback(async (userId: string) => {
        if (!roomId || !currentGroupDetail) return;
        if (!confirm('Bạn có chắc chắn muốn xóa thành viên này khỏi nhóm?')) return;
        try {
            const updatedGroup = await groupService.removeMembersFromGroup(roomId, [userId]);
            setCurrentGroupDetail(updatedGroup);
            showToast('Đã xóa thành viên khỏi nhóm');
        } catch (err: any) {
            console.error('Failed to remove member:', err);
            showToast('Xóa thành viên thất bại');
        }
    }, [roomId, currentGroupDetail, setCurrentGroupDetail, showToast]);

    const handleTransferOwnership = useCallback(async (userId: string) => {
        if (!roomId || !currentGroupDetail) return;
        try {
            const updatedGroup = await groupService.transferOwnership(roomId, userId);
            setCurrentGroupDetail(updatedGroup);
            showToast('Đã chuyển quyền trưởng nhóm');
        } catch (err: any) {
            console.error('Failed to transfer ownership:', err);
            showToast('Chuyển quyền thất bại');
        }
    }, [roomId, currentGroupDetail, setCurrentGroupDetail, showToast]);

    const handleBlockMember = useCallback(async (userId: string) => {
        if (!roomId || !currentGroupDetail) return;
        try {
            await groupService.blockMember(roomId, userId);
            const refreshed = await groupService.getGroupDetails(roomId);
            setCurrentGroupDetail(refreshed);
            showToast('Đã chặn thành viên khỏi nhóm');
        } catch (err: any) {
            console.error('Failed to block member:', err);
            showToast('Chặn thành viên thất bại');
        }
    }, [roomId, currentGroupDetail, setCurrentGroupDetail, showToast]);

    useEffect(() => {
        if (!roomId) return;
        groupService.getGroupDetails(roomId)
            .then((detail) => setCurrentGroupDetail(detail))
            .catch(console.error);
    }, [roomId]);

    // Subscribe to messages for live media/file/link data
    const allMessages = useChatStore((s) => s.messages[roomId] || []);

    const imageMessages = useMemo(() =>
        allMessages.filter((m) => {
            const url = m.fileUrl || m.attachments?.[0]?.url;
            if (!url || m.isRecall) return false;
            let type = m.type;
            if ((type === 'TEXT' || !type) && url && m.attachments?.[0]) {
                const mime = (m.attachments[0].type || '').toLowerCase();
                if (mime.startsWith('image')) type = 'IMAGE';
            }
            return type === 'IMAGE';
        }).slice(-9).reverse(),
        [allMessages]);

    // File: any message with fileUrl that is NOT image or video
    const fileMessages = useMemo(() =>
        allMessages.filter((m) => m.fileUrl && m.type !== 'IMAGE' && m.type !== 'VIDEO').slice(-5),
        [allMessages]);

    const linkMessages = useMemo(() => {
        const seen = new Set<string>();
        const links: { url: string; content: string }[] = [];
        for (const m of [...allMessages].reverse()) {
            if (m.type === 'TEXT' && m.content) {
                for (const url of extractUrls(m.content)) {
                    if (!seen.has(url)) { seen.add(url); links.push({ url, content: m.content }); }
                    if (links.length >= 5) break;
                }
            }
            if (links.length >= 5) break;
        }
        return links;
    }, [allMessages]);

    const group = currentGroupDetail;

    const isOwner = useMemo(() => user?.id === group?.ownerId, [group, user]);

    const isOwnerOrAdmin = useMemo(() =>
        isOwner ||
        group?.members.some((m) => m.userId === user?.id && m.role === 'ADMIN'),
        [group, user, isOwner]);

    const handleChangeAvatar = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !roomId || !currentGroupDetail) return;
        if (!file.type.startsWith('image/')) {
            showToast('Vui lòng chọn file ảnh');
            return;
        }
        setIsUploadingAvatar(true);
        try {
            const uploadResult = await MessageService.uploadFile(file);
            const newAvatarUrl = uploadResult.fileUrl;
            const updated = await groupService.updateGroupAvatar(roomId, newAvatarUrl);
            setCurrentGroupDetail(updated);
            const { rooms: latestRooms, upsertRoom: patchRoom } = useChatStore.getState();
            const room = latestRooms.find((r) => r.id === roomId);
            if (room && updated.avatarUrl) {
                patchRoom({ ...room, avatarUrl: updated.avatarUrl });
            }
            showToast('Đã cập nhật ảnh nhóm');
        } catch {
            showToast('Cập nhật ảnh nhóm thất bại');
        } finally {
            setIsUploadingAvatar(false);
            if (avatarInputRef.current) avatarInputRef.current.value = '';
        }
    }, [roomId, currentGroupDetail, setCurrentGroupDetail, showToast]);

    const joinLink = `${window.location.origin}/join/${roomId}`;

    const handleCopyLink = useCallback(() => {
        navigator.clipboard.writeText(joinLink);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
    }, [joinLink]);

    const getApiErrorMessage = (err: unknown, fallback: string) => {
        const e = err as { response?: { data?: { message?: string } }; message?: string };
        const msg = e?.response?.data?.message || e?.message;
        return typeof msg === 'string' && msg.trim() ? msg.trim() : fallback;
    };

    const executeLeaveGroup = async () => {
        setIsLeaving(true);
        try {
            await groupService.leaveGroup(roomId);
            setRooms(rooms.filter((r) => r.id !== roomId));
            setIsLeaveGroupModalOpen(false);
            onClose();
        } catch (err: unknown) {
            showToast(getApiErrorMessage(err, 'Rời nhóm thất bại.'));
        } finally {
            setIsLeaving(false);
        }
    };

    /** Trưởng nhóm có thành viên khác: nhường quyền rồi rời */
    const executeTransferAndLeave = async () => {
        if (!leaveSuccessorUserId || !currentGroupDetail) return;
        setIsLeaving(true);
        try {
            await groupService.transferOwnership(roomId, leaveSuccessorUserId);
            await groupService.leaveGroup(roomId);
            setRooms(rooms.filter((r) => r.id !== roomId));
            setPickSuccessorLeaveOpen(false);
            setLeaveSuccessorUserId(null);
            setIsLeaveGroupModalOpen(false);
            showToast('Đã nhường quyền và rời nhóm');
            onClose();
        } catch (err: unknown) {
            showToast(getApiErrorMessage(err, 'Không thể rời nhóm. Vui lòng thử lại.'));
        } finally {
            setIsLeaving(false);
        }
    };

    const handleOpenLeaveFlow = () => {
        if (!group || !user?.id) return;
        const others = group.members.filter((m) => m.userId !== user.id);
        const ownerLeavingNeedsSuccessor = user.id === group.ownerId && others.length > 0;
        if (ownerLeavingNeedsSuccessor) {
            setLeaveSuccessorUserId(null);
            setPickSuccessorLeaveOpen(true);
            return;
        }
        setIsLeaveGroupModalOpen(true);
    };

    const executeClearHistory = () => {
        useChatStore.getState().clearConversation(roomId);
    };

    if (!group) return (
        <div className="flex items-center justify-center h-40 text-gray-400 text-sm" style={{ width: 300 }}>
            <div className="flex flex-col items-center gap-2">
                <svg className="w-6 h-6 animate-spin text-gray-300" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Đang tải...
            </div>
        </div>
    );

    const avatarSrc = group.avatarUrl ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(group.groupName)}&background=0068FF&color=fff&bold=true&size=128`;

    return (
        <div
            className={`flex flex-col h-full bg-white border-l border-gray-200 ${
                isGroupManagementOpen || showMembersModal ? 'overflow-hidden min-h-0' : 'overflow-y-auto'
            }`}
            style={{ width: 300, minWidth: 300 }}
        >
            {/* Toast notification */}
            {toast && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] bg-gray-800 text-white text-xs px-4 py-2 rounded-full shadow-lg pointer-events-none">
                    {toast}
                </div>
            )}

            {isGroupManagementOpen ? (
                <GroupManagementPanel onClosePanel={onClose} />
            ) : showMembersModal ? (
                <GroupMembersList
                    embedded
                    members={group.members}
                    ownerId={group.ownerId}
                    currentUserId={user?.id}
                    onChangeRole={handleChangeRole}
                    onRemoveMember={handleRemoveMember}
                    onTransferOwnership={isOwner ? handleTransferOwnership : undefined}
                    onBlockMember={isOwnerOrAdmin ? handleBlockMember : undefined}
                    pendingJoinRequests={group.pendingJoinRequests}
                    canApproveJoinRequests={isOwnerOrAdmin}
                    groupId={roomId}
                    onPendingChanged={async () => {
                        const refreshed = await groupService.getGroupDetails(roomId);
                        setCurrentGroupDetail(refreshed);
                    }}
                    visible={showMembersModal}
                    onClose={() => setShowMembersModal(false)}
                />
            ) : (
            <>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0 sticky top-0 bg-white z-10">
                <span className="font-semibold text-gray-800 text-sm">Thông tin nhóm</span>
                <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Avatar + Group Name */}
            <div className="flex flex-col items-center py-5 px-4 border-b border-gray-100">
                <div className="relative mb-2">
                    <img
                        key={avatarSrc}
                        src={avatarSrc}
                        alt={group.groupName}
                        className="w-16 h-16 rounded-full object-cover shadow-sm"
                    />
                    <>
                        <input
                            ref={avatarInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleChangeAvatar}
                            disabled={!isOwnerOrAdmin}
                        />
                        <button
                            type="button"
                            onClick={() => avatarInputRef.current?.click()}
                            disabled={isUploadingAvatar || !isOwnerOrAdmin}
                            className={`absolute -bottom-1 -right-1 w-6 h-6 flex items-center justify-center rounded-full bg-white border border-gray-200 shadow-sm text-gray-600 transition-colors disabled:opacity-35 ${
                                isOwnerOrAdmin ? 'hover:bg-gray-50' : 'cursor-not-allowed opacity-45'
                            }`}
                            title={isOwnerOrAdmin ? 'Đổi ảnh nhóm' : 'Chỉ trưởng/phó nhóm đổi ảnh nhóm'}
                        >
                                {isUploadingAvatar ? (
                                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                ) : (
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                )}
                            </button>
                    </>
                </div>
                <div className="flex items-center gap-2 mt-1">
                    <span className="font-semibold text-gray-900 text-lg">
                        {group.groupName || 'Nhóm chưa đặt tên'}
                    </span>
                    {/* Edit pencil — opens rename modal */}
                    <button
                        type="button"
                        onClick={() => isOwnerOrAdmin && setShowRenameModal(true)}
                        disabled={!isOwnerOrAdmin}
                        className={`w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 transition-colors ${
                            isOwnerOrAdmin ? 'hover:bg-gray-200' : 'opacity-40 cursor-not-allowed'
                        }`}
                        title={isOwnerOrAdmin ? 'Sửa tên nhóm' : 'Chỉ trưởng/phó nhóm đổi tên nhóm'}
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                    </button>
                </div>
                <span className="text-xs text-gray-400 mt-0.5">{group.members.length} thành viên</span>
            </div>

            {/* Action Buttons — all 4 always shown */}
            <ActionButtonRow>
                <ActionButton
                    icon={<Icon.Bell />}
                    label={muteLabel ? 'Bật thông báo' : 'Tắt thông báo'}
                    active={!!muteLabel}
                    onClick={() => muteLabel ? handleUnmute() : setShowMuteModal(true)}
                />
                <ActionButton
                    icon={<Icon.Pin />}
                    label={isPinned ? 'Bỏ ghim' : 'Ghim hội thoại'}
                    active={isPinned}
                    onClick={() => { togglePinRoom(roomId); showToast(isPinned ? 'Đã bỏ ghim' : 'Đã ghim hội thoại'); }}
                />
                <ActionButton
                    icon={<Icon.AddMember />}
                    label={<span>Thêm<br />thành viên</span>}
                    onClick={openAddMembers}
                />
                {isOwnerOrAdmin && (
                    <ActionButton
                        icon={<Icon.Settings />}
                        label={<span>Quản lý<br />nhóm</span>}
                        onClick={() => openGroupManagement()}
                    />
                )}
            </ActionButtonRow>

            {/* Thành viên nhóm */}
            <div className="border-t border-gray-100">
                {/* Group join link */}
                <div className="mx-3 mb-1 mt-3 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 flex items-center gap-2">
                    <Icon.Link />
                    <span className="flex-1 text-xs text-blue-700 truncate font-medium">Link tham gia nhóm</span>
                    <button
                        onClick={handleCopyLink}
                        className="shrink-0 text-blue-500 hover:text-blue-700 transition-colors"
                        title="Sao chép link"
                    >
                        {copiedLink
                            ? <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            : <Icon.Copy />
                        }
                    </button>
                    <button className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors" title="Chia sẻ">
                        <Icon.Share />
                    </button>
                </div>

                {/* Member count button -> opens modal */}
                <button
                    onClick={() => setShowMembersModal(true)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                >
                    <Icon.Users />
                    <div className="flex-1 min-w-0 text-left">
                        <span className="text-sm text-gray-700 font-medium">Thành viên nhóm</span>
                        <p className="text-xs text-gray-400 mt-0.5">{group.members.length} thành viên</p>
                    </div>
                    <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                </button>
                {isOwnerOrAdmin && (group.pendingJoinRequestCount ?? 0) > 0 && (
                    <button
                        type="button"
                        onClick={() => setShowMembersModal(true)}
                        className="w-full flex items-start gap-2 pl-12 pr-4 py-2 hover:bg-gray-50 text-left"
                    >
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                        <span className="text-sm text-blue-600 font-medium">
                            Có {group.pendingJoinRequestCount} yêu cầu tham gia nhóm
                        </span>
                    </button>
                )}
            </div>

            {/* Ảnh/Video */}
            <CollapsibleSection title="Ảnh/Video" badge={imageMessages.length || undefined}>
                {imageMessages.length > 0 ? (
                    <div className="px-3">
                        <div className="grid grid-cols-3 gap-1 mb-2">
                            {imageMessages.map((m) => {
                                const imgUrl = m.fileUrl || m.attachments?.[0]?.url;
                                return (
                                    <div
                                        key={m.id}
                                        onClick={() => setLightboxUrl(imgUrl!)}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') setLightboxUrl(imgUrl!);
                                        }}
                                        className="relative aspect-square w-full overflow-hidden rounded hover:opacity-90 transition-opacity group"
                                    >
                                        <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                                        <button
                                            type="button"
                                            className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/40 hover:bg-black/55 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Tùy chọn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                e.preventDefault();
                                                const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                                setMediaMenu({ open: true, message: m, top: rect.bottom + 6, left: Math.max(8, rect.left - 120) });
                                            }}
                                        >
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                                <circle cx="5" cy="12" r="2" />
                                                <circle cx="12" cy="12" r="2" />
                                                <circle cx="19" cy="12" r="2" />
                                            </svg>
                                        </button>
                                    </div>
                            );
                            })}
                        </div>
                        <button className="w-full text-sm text-center py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-500 font-medium transition-colors">
                            Xem tất cả
                        </button>
                    </div>
                ) : (
                    <div className="px-4 py-4 text-center text-sm text-gray-400">
                        Chưa có ảnh/video nào được chia sẻ
                    </div>
                )}
            </CollapsibleSection>

            {/* File */}
            <CollapsibleSection title="File" defaultOpen={false} badge={fileMessages.length || undefined}>
                {fileMessages.length > 0 ? (
                    <div className="flex flex-col">
                        {fileMessages.map((m) => (
                            <div
                                key={m.id}
                                className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors cursor-pointer group"
                                onClick={() => {
                                    useChatStore.getState().setHighlightedMessageId(m.id);
                                    // Optional: You might want onClose() here if you want to close sidebar on jump
                                }}
                            >
                                <Icon.File />
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm text-gray-800 truncate font-medium">{m.fileName || 'File'}</div>
                                    <div className="text-xs text-gray-400">{formatBytes(m.fileSize)}</div>
                                </div>
                                <button
                                    className="p-1 rounded hover:bg-gray-200 shrink-0 transition-colors opacity-0 group-hover:opacity-100"
                                    title="Tùy chọn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                        setMediaMenu({ open: true, message: m, top: rect.bottom + 6, left: Math.max(8, rect.left - 120) });
                                    }}
                                >
                                    <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                                        <circle cx="5" cy="12" r="2" />
                                        <circle cx="12" cy="12" r="2" />
                                        <circle cx="19" cy="12" r="2" />
                                    </svg>
                                </button>
                                <a
                                    href={m.fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="p-1 hover:bg-gray-200 rounded shrink-0 transition-colors"
                                    title="Tải xuống"
                                >
                                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                </a>
                            </div>
                        ))}
                        <div className="px-3 pt-1 pb-2">
                            <button className="w-full text-sm text-center py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-500 font-medium transition-colors">
                                Xem tất cả
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="px-4 py-4 text-center text-sm text-gray-400">
                        Chưa có File được chia sẻ trong hội thoại này
                    </div>
                )}
            </CollapsibleSection>

            {/* Link */}
            <CollapsibleSection title="Link" defaultOpen={false} badge={linkMessages.length || undefined}>
                {linkMessages.length > 0 ? (
                    <div className="flex flex-col">
                        {linkMessages.map(({ url }, i) => (
                            <a
                                key={i}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors"
                            >
                                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                                    <Icon.Link />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm text-blue-600 truncate">{url}</div>
                                </div>
                            </a>
                        ))}
                        <div className="px-3 pt-1 pb-2">
                            <button className="w-full text-sm text-center py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-500 font-medium transition-colors">
                                Xem tất cả
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="px-4 py-4 text-center text-sm text-gray-400">
                        Chưa có Link được chia sẻ trong hội thoại này
                    </div>
                )}
            </CollapsibleSection>

            {/* Thiết lập bảo mật */}
            <CollapsibleSection title="Thiết lập bảo mật" defaultOpen={false}>
                <div className="px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 cursor-pointer">
                    <Icon.Clock />
                    <div className="flex-1">
                        <div className="text-sm text-gray-700">Tin nhắn tự xóa</div>
                        <div className="text-xs text-gray-400">{autoDeleteMsg}</div>
                    </div>
                    <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                </div>
                <div className="px-4 py-2.5 flex items-center gap-3">
                    <Icon.Eye />
                    <span className="flex-1 text-sm text-gray-700">Ẩn trò chuyện</span>
                    <ToggleSwitch checked={hideConversation} onChange={() => setHideConversation((v) => !v)} />
                </div>
            </CollapsibleSection>

            {/* Danger zone */}
            <div className="py-2 border-t border-gray-100 mt-1">
                <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left">
                    <Icon.Alert />
                    <span className="text-sm text-gray-600">Báo xấu</span>
                </button>
                <button
                    onClick={() => setIsClearHistoryModalOpen(true)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 transition-colors text-left"
                >
                    <Icon.Trash />
                    <span className="text-sm text-red-500">Xóa lịch sử trò chuyện</span>
                </button>
                <button
                    type="button"
                    onClick={handleOpenLeaveFlow}
                    disabled={isLeaving}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 transition-colors disabled:opacity-50 text-left"
                >
                    <Icon.Leave />
                    <span className="text-sm text-red-500">{isLeaving ? 'Đang rời...' : 'Rời nhóm'}</span>
                </button>
            </div>

            {/* Modals */}
            <ConfirmModal
                isOpen={isClearHistoryModalOpen}
                onClose={() => setIsClearHistoryModalOpen(false)}
                onConfirm={executeClearHistory}
                title="Xác nhận"
                message={"Toàn bộ nội dung trò chuyện sẽ bị xóa vĩnh viễn.\nBạn có chắc chắn muốn xóa?"}
                confirmText="Xóa"
                isDanger={true}
            />
            <ConfirmModal
                isOpen={isLeaveGroupModalOpen}
                onClose={() => setIsLeaveGroupModalOpen(false)}
                onConfirm={executeLeaveGroup}
                title="Xác nhận rời nhóm"
                message={"Bạn có chắc chắn muốn rời nhóm này?\nToàn bộ lịch sử trò chuyện sẽ bị xóa đối với bạn."}
                confirmText="Rời nhóm"
                isDanger={true}
            />

            {pickSuccessorLeaveOpen && group && user?.id && (
                <PickSuccessorLeaveModal
                    members={group.members}
                    currentUserId={user.id}
                    selectedUserId={leaveSuccessorUserId}
                    onSelectUserId={setLeaveSuccessorUserId}
                    onClose={() => {
                        if (!isLeaving) {
                            setPickSuccessorLeaveOpen(false);
                            setLeaveSuccessorUserId(null);
                        }
                    }}
                    onConfirm={executeTransferAndLeave}
                    loading={isLeaving}
                />
            )}

            {/* Mute Duration Modal */}
            {showMuteModal && (
                <MuteModal
                    onClose={() => setShowMuteModal(false)}
                    onConfirm={handleMuteConfirm}
                />
            )}

            {/* Rename Group Modal */}
            {showRenameModal && group && (
                <RenameGroupModal
                    currentName={group.groupName}
                    onClose={() => setShowRenameModal(false)}
                    onConfirm={handleRenameGroup}
                />
            )}

            {/* Lightbox */}
            {lightboxUrl && (
                <div
                    className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
                    onClick={() => setLightboxUrl(null)}
                >
                    <img
                        src={lightboxUrl}
                        alt=""
                        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                    <button
                        className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                        onClick={() => setLightboxUrl(null)}
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            )}

            {/* Media menu (ellipsis) */}
            {mediaMenu?.open && mediaMenu.message && (
                <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 60 }} onClick={() => setMediaMenu(null)} />
                    <div
                        style={{ position: 'fixed', top: mediaMenu.top, left: mediaMenu.left, zIndex: 61, minWidth: 190 }}
                        className="bg-white rounded-xl shadow-lg border border-gray-200 py-1.5"
                    >
                        <button
                            onClick={() => {
                                if (mediaMenu.message) {
                                    setForwardingMessages([mediaMenu.message]);
                                }
                                setMediaMenu(null);
                            }}
                            className="w-full flex items-center gap-3 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                            Chia sẻ
                        </button>
                        <button
                            onClick={() => {
                                const id = mediaMenu.message?.id;
                                if (id) useChatStore.getState().setHighlightedMessageId(id);
                                setMediaMenu(null);
                            }}
                            className="w-full flex items-center gap-3 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Xem tin nhắn gốc
                        </button>
                    </div>
                </>
            )}

            {/* Forward modal */}
            {forwardingMessages && (
                <ForwardMessageModal
                    messages={forwardingMessages}
                    currentRoomId={roomId}
                    onClose={() => setForwardingMessages(null)}
                />
            )}
            </>
            )}
        </div>
    );
};

export default React.memo(GroupInfoPanel);
