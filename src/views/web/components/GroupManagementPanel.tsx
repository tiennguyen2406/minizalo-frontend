import React, { useEffect, useState } from 'react';
import { useGroupStore } from '@/shared/store/useGroupStore';
import { groupService } from '@/shared/services/groupService';
import { ToggleSwitch } from './ChatInfoHelpers';
import { BlockedMember, GroupSettings } from '@/shared/types';
import { useAuthStore } from '@/shared/store/authStore';
import ConfirmModal from './ConfirmModal';
import { useChatStore } from '@/shared/store/useChatStore';
import { webSocketService } from '@/shared/services/WebSocketService';

interface GroupManagementPanelProps {
    /** Đóng cả sidebar thông tin nhóm (giống nút X ở màn info) */
    onClosePanel?: () => void;
}

type GroupSettingToggleKey =
    | 'allowMemberChangeName'
    | 'allowMemberPin'
    | 'allowMemberCreatePoll'
    | 'allowMemberSendMessage'
    | 'requireApproval'
    | 'allowNewMemberReadHistory'
    | 'allowJoinByLink';

const GroupManagementPanel: React.FC<GroupManagementPanelProps> = ({ onClosePanel }) => {
    const { currentGroupDetail, closeGroupManagement, updateCurrentGroupDetail } = useGroupStore();
    const { user } = useAuthStore();
    const [settings, setSettings] = useState<GroupSettings | null>(currentGroupDetail?.settings ?? null);
    const [loading, setLoading] = useState(false);
    const [settingsError, setSettingsError] = useState<string | null>(null);

    type View = 'main' | 'roles' | 'blocked';
    const [view, setView] = useState<View>('main');

    const [blockedMembers, setBlockedMembers] = useState<BlockedMember[] | null>(null);
    const [blockedLoading, setBlockedLoading] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [pickerMode, setPickerMode] = useState<'ADD_ADMIN' | 'TRANSFER_OWNER' | 'BLOCK'>('ADD_ADMIN');
    const [pickerSelected, setPickerSelected] = useState<string | null>(null);
    const [pickerBusy, setPickerBusy] = useState(false);
    const [pickerQuery, setPickerQuery] = useState('');
    const [isDisbandModalOpen, setIsDisbandModalOpen] = useState(false);
    const [toast, setToast] = useState<string | null>(null);
    const [removeAdminTargetId, setRemoveAdminTargetId] = useState<string | null>(null);

    useEffect(() => {
        if (!currentGroupDetail?.id) return;

        if (currentGroupDetail?.settings) {
            setSettings(currentGroupDetail.settings);
            setSettingsError(null);
            return;
        }

        setLoading(true);
        setSettingsError(null);
        groupService
            .getGroupSettings(currentGroupDetail.id)
            .then(setSettings)
            .catch((err) => {
                console.error('Failed to load group settings:', err);
                setSettingsError('Không tải được cấu hình nhóm');
            })
            .finally(() => setLoading(false));
    }, [currentGroupDetail?.id, currentGroupDetail?.settings]);

    // Load blocked list when entering blocked view
    useEffect(() => {
        if (view !== 'blocked') return;
        if (!currentGroupDetail?.id) return;
        setBlockedLoading(true);
        groupService.getBlockedMembers(currentGroupDetail.id)
            .then(setBlockedMembers)
            .catch((err) => {
                console.error('Failed to load blocked members:', err);
                setBlockedMembers([]);
            })
            .finally(() => setBlockedLoading(false));
    }, [view, currentGroupDetail?.id]);

    if (!currentGroupDetail) return null;

    const isOwner = user?.id === currentGroupDetail.ownerId;
    const isOwnerOrAdmin = isOwner || currentGroupDetail.members.some((m) => m.userId === user?.id && m.role === 'ADMIN');

    const showToast = (msg: string) => {
        setToast(msg);
        window.setTimeout(() => setToast(null), 2200);
    };

    const isPhoneLikeName = (value?: string | null) => {
        const text = String(value || '').trim();
        return !!text && /^[+\d\s().-]{8,}$/.test(text);
    };

    const getActorName = () => {
        const me = currentGroupDetail.members.find((m) => m.userId === user?.id);
        const candidates = [
            me?.fullName,
            (user as any)?.displayName,
            user?.fullName,
        ];
        return candidates.find((name) => {
            const text = String(name || '').trim();
            return text && !isPhoneLikeName(text);
        })?.trim() || 'Một quản trị viên';
    };

    const settingLabels: Record<GroupSettingToggleKey, string> = {
        allowMemberChangeName: 'quyền sửa thông tin nhóm',
        allowMemberPin: 'quyền ghim tin nhắn',
        allowMemberCreatePoll: 'quyền tạo bình chọn',
        allowMemberSendMessage: 'quyền gửi tin nhắn',
        requireApproval: 'chế độ phê duyệt thành viên mới',
        allowNewMemberReadHistory: 'quyền xem lịch sử trò chuyện',
        allowJoinByLink: 'chế độ tham gia bằng link',
    };

    const addLocalSettingsNotice = (key: GroupSettingToggleKey, value: boolean) => {
        const roomId = currentGroupDetail.id;
        const tempId = `temp-settings-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        useChatStore.getState().addMessage(roomId, {
            id: tempId,
            senderId: user?.id || 'system',
            senderName: getActorName(),
            roomId,
            content: `${getActorName()} đã thay đổi ${settingLabels[key]} ${value ? 'thành bật' : 'thành tắt'}.`,
            type: 'SYSTEM',
            createdAt: new Date().toISOString(),
        });
        return tempId;
    };

    const removeLocalNotice = (tempId: string) => {
        const roomId = currentGroupDetail.id;
        const current = useChatStore.getState().messages[roomId] || [];
        useChatStore.getState().setMessages(
            roomId,
            current.filter((m) => m.id !== tempId),
        );
    };

    const pushSystemMessage = (text: string) => {
        const roomId = currentGroupDetail.id;
        const senderName = getActorName();
        const myId = user?.id || 'system';
        useChatStore.getState().addMessage(roomId, {
            id: `temp-sys-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            senderId: myId,
            senderName,
            roomId,
            content: text,
            type: 'SYSTEM',
            createdAt: new Date().toISOString(),
        });
        const sent = webSocketService.sendChatMessage(roomId, text, 'SYSTEM');
        if (!sent) {
            showToast('Chưa thể gửi thông báo (mất kết nối).');
        }
    };

    const handleToggle = async (key: GroupSettingToggleKey, value: boolean) => {
        if (!settings) return;
        if (key === 'requireApproval' && !isOwner) return;
        const tempNoticeId = addLocalSettingsNotice(key, value);
        setLoading(true);
        try {
            const newSettings = await groupService.updateGroupSettings({
                groupId: currentGroupDetail.id,
                [key]: value
            });
            setSettings(newSettings);
            updateCurrentGroupDetail({ ...currentGroupDetail, settings: newSettings });
        } catch (error) {
            console.error('Failed to update group settings:', error);
            removeLocalNotice(tempNoticeId);
        } finally {
            setLoading(false);
        }
    };

    const handleRefreshLink = async () => {
        if (!settings) return;
        setLoading(true);
        try {
            const newLink = await groupService.refreshJoinLink(currentGroupDetail.id);
            const updatedSettings: GroupSettings = { ...settings, joinLink: newLink };
            setSettings(updatedSettings);
            updateCurrentGroupDetail({ ...currentGroupDetail, settings: updatedSettings });
            showToast('Đã tạo link mới');
        } catch (error) {
            console.error('Failed to refresh join link:', error);
            showToast('Tạo link mới thất bại');
        } finally {
            setLoading(false);
        }
    };

    const handleUnblock = async (targetUserId: string) => {
        if (!currentGroupDetail?.id) return;
        try {
            await groupService.unblockMember(currentGroupDetail.id, targetUserId);
            setBlockedMembers((prev) => (prev || []).filter((m) => m.userId !== targetUserId));
            showToast('Đã bỏ chặn');
        } catch (err) {
            console.error('Failed to unblock member:', err);
            showToast('Bỏ chặn thất bại');
        }
    };

    const resetPicker = () => {
        setPickerSelected(null);
        setPickerQuery('');
        setPickerBusy(false);
    };

    const openPicker = (mode: typeof pickerMode) => {
        setPickerMode(mode);
        resetPicker();
        setPickerOpen(true);
    };

    const handlePickerConfirm = async () => {
        if (!pickerSelected || !currentGroupDetail?.id) return;
        setPickerBusy(true);
        try {
            if (pickerMode === 'ADD_ADMIN') {
                const targetMember = currentGroupDetail.members.find((m) => m.userId === pickerSelected);
                const targetName = targetMember?.fullName || targetMember?.username || 'Thành viên';
                const actorName = user?.fullName || user?.username || 'Một quản trị viên';

                await groupService.changeRole(currentGroupDetail.id, pickerSelected, 'ADMIN');
                const refreshed = await groupService.getGroupDetails(currentGroupDetail.id);
                updateCurrentGroupDetail(refreshed);
                pushSystemMessage(`${actorName} đã phong ${targetName} làm phó nhóm.`);
                showToast('Đã bổ nhiệm phó nhóm');
            } else if (pickerMode === 'TRANSFER_OWNER') {
                await groupService.transferOwnership(currentGroupDetail.id, pickerSelected);
                const refreshed = await groupService.getGroupDetails(currentGroupDetail.id);
                updateCurrentGroupDetail(refreshed);
                showToast('Đã chuyển quyền trưởng nhóm');
            } else if (pickerMode === 'BLOCK') {
                const targetMember = currentGroupDetail.members.find((m) => m.userId === pickerSelected);
                const targetName = targetMember?.fullName || targetMember?.username || 'Thành viên';
                const actorName = user?.fullName || user?.username || 'Một quản trị viên';

                await groupService.blockMember(currentGroupDetail.id, pickerSelected);
                // Refresh blocked list + group detail (backend may remove member)
                const [blocked, refreshed] = await Promise.all([
                    groupService.getBlockedMembers(currentGroupDetail.id),
                    groupService.getGroupDetails(currentGroupDetail.id),
                ]);
                setBlockedMembers(blocked);
                updateCurrentGroupDetail(refreshed);

                pushSystemMessage(`${actorName} đã chặn ${targetName} khỏi nhóm.`);
                showToast('Đã chặn khỏi nhóm');
            }
            setPickerOpen(false);
        } catch (err) {
            console.error('Picker action failed:', err);
            showToast('Thao tác thất bại');
        } finally {
            setPickerBusy(false);
        }
    };

    const executeRemoveAdmin = async (targetUserId: string) => {
        if (!currentGroupDetail?.id) return;
        const targetMember = currentGroupDetail.members.find((m) => m.userId === targetUserId);
        const targetName = targetMember?.fullName || targetMember?.username || 'Thành viên';
        const actorName = user?.fullName || user?.username || 'Một quản trị viên';
        setLoading(true);
        try {
            await groupService.changeRole(currentGroupDetail.id, targetUserId, 'MEMBER');
            const refreshed = await groupService.getGroupDetails(currentGroupDetail.id);
            updateCurrentGroupDetail(refreshed);
            // Tránh duplicate: backend đã broadcast SYSTEM message cho sự kiện đổi role
            showToast('Đã xóa phó nhóm');
        } catch (err) {
            console.error('Failed to remove admin role:', err);
            showToast('Xóa phó nhóm thất bại');
        } finally {
            setLoading(false);
        }
    };

    const executeDisband = async () => {
        if (!currentGroupDetail?.id) return;
        setLoading(true);
        try {
            await groupService.disbandGroup(currentGroupDetail.id);
            // Remove room + messages locally so the chat disappears immediately
            useChatStore.getState().deleteRoom(currentGroupDetail.id);
            useChatStore.getState().setCurrentRoom(null);
            closeGroupManagement();
            onClosePanel?.();
            showToast('Đã giải tán nhóm');
        } catch (err) {
            console.error('Failed to disband group:', err);
            showToast('Giải tán nhóm thất bại');
        } finally {
            setLoading(false);
        }
    };

    const headerTitle =
        view === 'roles' ? 'Trưởng và phó nhóm'
            : view === 'blocked' ? 'Chặn khỏi nhóm'
                : 'Quản lý nhóm';

    const showBackToMain = view !== 'main';

    const ownerMember = currentGroupDetail.members.find((m) => m.userId === currentGroupDetail.ownerId);
    // Backend đôi khi trả owner cũng là ADMIN → loại trừ để không hiện trùng ở "Phó nhóm"
    const adminMembers = currentGroupDetail.members.filter((m) => m.role === 'ADMIN' && m.userId !== currentGroupDetail.ownerId);

    const selectableMembers = currentGroupDetail.members.filter((m) => {
        if (m.userId === currentGroupDetail.ownerId) return false;
        if (pickerMode === 'ADD_ADMIN') return m.role !== 'ADMIN'; // exclude existing admins
        if (pickerMode === 'TRANSFER_OWNER') return true;
        if (pickerMode === 'BLOCK') return true;
        return true;
    }).filter((m) => {
        const name = (m.fullName || m.username || '').toLowerCase();
        return !pickerQuery.trim() || name.includes(pickerQuery.trim().toLowerCase());
    });

    return (
        <div className="flex flex-col h-full min-h-0 w-full bg-gray-50">
            {/* Toast notification */}
            {toast && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] bg-gray-800 text-white text-xs px-4 py-2 rounded-full shadow-lg pointer-events-none">
                    {toast}
                </div>
            )}
            {/* Header */}
            <div className="flex items-center justify-between px-2 py-3 bg-white border-b border-gray-200 shrink-0">
                <div className="flex items-center min-w-0">
                    <button
                        type="button"
                        onClick={() => {
                            if (showBackToMain) setView('main');
                            else closeGroupManagement();
                        }}
                        className="p-2 hover:bg-gray-100 rounded-full shrink-0"
                        title={showBackToMain ? 'Quay lại' : 'Về thông tin nhóm'}
                    >
                        <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <h2 className="font-semibold text-gray-800 text-base truncate pl-1">{headerTitle}</h2>
                </div>
                {onClosePanel && (
                    <button
                        type="button"
                        onClick={onClosePanel}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 shrink-0"
                        title="Đóng"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto w-full styled-scrollbar pb-6">
                {view === 'main' && loading && !settings && (
                    <div className="px-4 py-6 text-sm text-gray-500">Đang tải cấu hình nhóm...</div>
                )}

                {view === 'main' && settingsError && !settings && (
                    <div className="px-4 py-6 text-sm text-red-500">{settingsError}</div>
                )}

                {view === 'main' && settings && (
                    <>
                        {/* Permissions Section */}
                        <div className="mt-2 bg-white px-4 py-3">
                            <h3 className="text-sm font-semibold text-blue-600 mb-3 uppercase">Quyền của thành viên</h3>
                            <div className="flex justify-between items-center py-2">
                                <span className="text-sm">Sửa thông tin nhóm</span>
                                <ToggleSwitch checked={settings.allowMemberChangeName} onChange={() => handleToggle('allowMemberChangeName', !settings.allowMemberChangeName)} />
                            </div>
                            <div className="flex justify-between items-center py-2">
                                <span className="text-sm">Ghim tin nhắn</span>
                                <ToggleSwitch checked={settings.allowMemberPin} onChange={() => handleToggle('allowMemberPin', !settings.allowMemberPin)} />
                            </div>
                            <div className="flex justify-between items-center py-2">
                                <span className="text-sm">Tạo bình chọn</span>
                                <ToggleSwitch checked={settings.allowMemberCreatePoll} onChange={() => handleToggle('allowMemberCreatePoll', !settings.allowMemberCreatePoll)} />
                            </div>
                            <div className="flex justify-between items-center py-2">
                                <span className="text-sm">Gửi tin nhắn</span>
                                <ToggleSwitch checked={settings.allowMemberSendMessage} onChange={() => handleToggle('allowMemberSendMessage', !settings.allowMemberSendMessage)} />
                            </div>
                        </div>

                        {/* Admission Section */}
                        <div className="mt-2 bg-white px-4 py-3">
                            <h3 className="text-sm font-semibold text-blue-600 mb-3 uppercase">Quản lý thành viên mới</h3>
                            <div
                                className={`flex justify-between items-center py-2 gap-3 ${!isOwner ? 'opacity-55' : ''}`}
                                title={!isOwner ? 'Chỉ trưởng nhóm mới bật/tắt chế độ duyệt' : undefined}
                            >
                                <div className="min-w-0">
                                    <span className="text-sm">Phê duyệt thành viên mới</span>
                                    {!isOwner && (
                                        <div className="text-[11px] text-gray-400 mt-0.5">Chỉ trưởng nhóm</div>
                                    )}
                                </div>
                                <ToggleSwitch
                                    checked={settings.requireApproval}
                                    disabled={!isOwner}
                                    onChange={() => handleToggle('requireApproval', !settings.requireApproval)}
                                />
                            </div>
                            <div className="flex justify-between items-center py-2">
                                <div className="flex flex-col">
                                    <span className="text-sm">Xem lịch sử trò chuyện</span>
                                    <span className="text-xs text-gray-500">Cho phép thành viên mới xem tin nhắn cũ</span>
                                </div>
                                <ToggleSwitch checked={settings.allowNewMemberReadHistory} onChange={() => handleToggle('allowNewMemberReadHistory', !settings.allowNewMemberReadHistory)} />
                            </div>
                            <div className="flex justify-between items-center py-2">
                                <span className="text-sm">Tham gia bằng Link</span>
                                <ToggleSwitch checked={settings.allowJoinByLink} onChange={() => handleToggle('allowJoinByLink', !settings.allowJoinByLink)} />
                            </div>
                            
                            {settings.allowJoinByLink && (
                                <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                    <p className="text-xs text-gray-500 mb-1">Link tham gia nhóm:</p>
                                    <div className="bg-white px-3 py-2 border border-gray-300 rounded text-sm text-blue-600 font-mono break-all w-full">
                                        <span className="select-text">{settings.joinLink}</span>
                                    </div>
                                    <div className="flex gap-2 mt-2">
                                        <button className="flex-1 text-xs bg-gray-200 hover:bg-gray-300 py-1.5 rounded" onClick={() => navigator.clipboard.writeText(settings.joinLink)}>Copy Link</button>
                                        <button className="flex-1 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 py-1.5 rounded" onClick={handleRefreshLink} disabled={loading}>Đổi Link</button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Danger Zone — mỗi tính năng một nút full-width, không icon */}
                        <div className="mt-2 bg-white border-t border-gray-100">
                            <button
                                type="button"
                                className={`w-full text-left px-4 py-3 text-sm transition-colors border-b border-gray-100 ${
                                    isOwner ? 'text-gray-700 hover:bg-gray-50' : 'text-gray-400 cursor-not-allowed'
                                }`}
                                onClick={() => { if (isOwner) setView('roles'); }}
                                disabled={!isOwner}
                            >
                                Trưởng và phó nhóm
                            </button>
                            <button
                                type="button"
                                className={`w-full text-left px-4 py-3 text-sm transition-colors border-b border-gray-100 ${
                                    isOwnerOrAdmin ? 'text-gray-700 hover:bg-gray-50' : 'text-gray-400 cursor-not-allowed'
                                }`}
                                onClick={() => { if (isOwnerOrAdmin) setView('blocked'); }}
                                disabled={!isOwnerOrAdmin}
                            >
                                Chặn khỏi nhóm
                            </button>
                            <button
                                type="button"
                                className={`w-full text-left px-4 py-3 text-sm transition-colors font-medium border-t border-gray-100 ${
                                    isOwner
                                        ? 'text-red-600 hover:bg-red-50'
                                        : 'text-gray-400 cursor-not-allowed bg-gray-50/80'
                                }`}
                                onClick={() => {
                                    if (isOwner) setIsDisbandModalOpen(true);
                                }}
                                disabled={loading || !isOwner}
                                title={!isOwner ? 'Chỉ trưởng nhóm mới có thể giải tán nhóm' : undefined}
                            >
                                Giải tán nhóm
                            </button>
                        </div>
                    </>
                )}

                {view === 'roles' && (
                    <div className="mt-2 bg-white">
                        <div className="px-4 py-3 border-b border-gray-100">
                            <div className="text-xs text-gray-500 mb-2">Trưởng nhóm</div>
                            <div className="flex items-center gap-3">
                                <img
                                    src={
                                        ownerMember?.avatarUrl ||
                                        `https://ui-avatars.com/api/?name=${encodeURIComponent(ownerMember?.fullName || ownerMember?.username || 'T')}&background=0068FF&color=fff&bold=true`
                                    }
                                    alt={ownerMember?.fullName || ownerMember?.username || 'Trưởng nhóm'}
                                    className="w-9 h-9 rounded-full object-cover shrink-0"
                                />
                                <div className="min-w-0">
                                    <div className="text-sm font-medium text-gray-800 truncate">{ownerMember?.fullName || ownerMember?.username || '---'}</div>
                                    <div className="text-xs text-gray-400 truncate">Trưởng nhóm</div>
                                </div>
                            </div>
                        </div>

                        <div className="px-4 py-3 border-b border-gray-100">
                            <div className="text-xs text-gray-500 mb-2">Phó nhóm ({adminMembers.length})</div>
                            {adminMembers.length === 0 ? (
                                <div className="text-sm text-gray-500 py-2">Chưa có phó nhóm.</div>
                            ) : (
                                <div className="flex flex-col">
                                    {adminMembers.map((m) => (
                                        <div key={m.userId} className="flex items-center gap-3 py-2">
                                            <img
                                                src={
                                                    m.avatarUrl ||
                                                    `https://ui-avatars.com/api/?name=${encodeURIComponent(m.fullName || m.username || 'P')}&background=0068FF&color=fff&bold=true`
                                                }
                                                alt={m.fullName || m.username}
                                                className="w-9 h-9 rounded-full object-cover shrink-0"
                                            />
                                            <div className="min-w-0 flex-1">
                                                <div className="text-sm font-medium text-gray-800 truncate">{m.fullName || m.username}</div>
                                                <div className="text-xs text-gray-400 truncate">Phó nhóm</div>
                                            </div>
                                            {isOwner && (
                                                <button
                                                    type="button"
                                                    onClick={() => setRemoveAdminTargetId(m.userId)}
                                                    className="text-xs text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-full font-medium transition-colors shrink-0 disabled:opacity-50"
                                                    disabled={loading}
                                                >
                                                    Xóa
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="border-t border-gray-100">
                            <button
                                type="button"
                                className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors border-b border-gray-100"
                                onClick={() => openPicker('ADD_ADMIN')}
                            >
                                Thêm phó nhóm
                            </button>
                            <button
                                type="button"
                                className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                onClick={() => openPicker('TRANSFER_OWNER')}
                            >
                                Chuyển quyền trưởng nhóm
                            </button>
                        </div>
                    </div>
                )}

                {view === 'blocked' && (
                    <div className="mt-2 bg-white">
                        <div className="border-b border-gray-100">
                            <div className="px-4 py-3 flex justify-center">
                                <button
                                    type="button"
                                    className="px-4 py-2 text-sm text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg font-medium transition-colors"
                                    onClick={() => openPicker('BLOCK')}
                                >
                                    Thêm vào danh sách chặn
                                </button>
                            </div>
                        </div>

                        <div className="px-4 py-3 border-b border-gray-100">
                            <div className="text-xs text-gray-500">Danh sách bị chặn</div>
                        </div>

                        {blockedLoading && (
                            <div className="px-4 py-6 text-sm text-gray-500">Đang tải...</div>
                        )}
                        {!blockedLoading && (blockedMembers?.length ?? 0) === 0 && (
                            <div className="px-4 py-6 text-sm text-gray-500">Chưa có thành viên bị chặn.</div>
                        )}
                        {!blockedLoading && (blockedMembers || []).map((m) => {
                            const name = m.displayName || m.username;
                            const avatarSrc = m.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0068FF&color=fff&bold=true`;
                            return (
                                <div key={m.userId} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50">
                                    <img src={avatarSrc} alt={name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-gray-800 truncate">{name}</div>
                                        <div className="text-xs text-gray-400 truncate">@{m.username}</div>
                                    </div>
                                    <button
                                        onClick={() => handleUnblock(m.userId)}
                                        className="text-xs text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full font-medium transition-colors shrink-0"
                                    >
                                        Bỏ chặn
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Member picker modal (thêm phó nhóm / chuyển trưởng / chặn) */}
            {pickerOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { if (!pickerBusy) setPickerOpen(false); }}>
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-[420px] max-h-[80vh] flex flex-col overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 shrink-0">
                            <span className="font-semibold text-base text-gray-800">
                                {pickerMode === 'ADD_ADMIN'
                                    ? 'Chọn thành viên để bổ nhiệm phó nhóm'
                                    : pickerMode === 'TRANSFER_OWNER'
                                        ? 'Chọn thành viên để chuyển quyền trưởng nhóm'
                                        : 'Chọn thành viên để chặn khỏi nhóm'}
                            </span>
                            <button
                                onClick={() => { if (!pickerBusy) setPickerOpen(false); }}
                                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                                disabled={pickerBusy}
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="px-5 py-3 border-b border-gray-100">
                            <input
                                value={pickerQuery}
                                onChange={(e) => setPickerQuery(e.target.value)}
                                placeholder="Tìm theo tên..."
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                autoFocus
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            {selectableMembers.length === 0 ? (
                                <div className="px-5 py-6 text-sm text-gray-500">Không có thành viên phù hợp.</div>
                            ) : (
                                selectableMembers.map((m) => {
                                    const name = m.fullName || m.username;
                                    const avatarSrc = m.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0068FF&color=fff&bold=true`;
                                    const selected = pickerSelected === m.userId;
                                    return (
                                        <button
                                            key={m.userId}
                                            type="button"
                                            onClick={() => setPickerSelected(m.userId)}
                                            className={`w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-gray-50 transition-colors ${
                                                selected ? 'bg-blue-50' : ''
                                            }`}
                                        >
                                            <img src={avatarSrc} alt={name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium text-gray-800 truncate">{name}</div>
                                                <div className="text-xs text-gray-400 truncate">@{m.username}</div>
                                            </div>
                                            <input type="radio" readOnly checked={selected} className="w-4 h-4 accent-blue-600" />
                                        </button>
                                    );
                                })
                            )}
                        </div>

                        <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100 shrink-0">
                            <button
                                type="button"
                                onClick={() => { if (!pickerBusy) setPickerOpen(false); }}
                                className="px-5 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors disabled:opacity-50"
                                disabled={pickerBusy}
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                onClick={handlePickerConfirm}
                                disabled={pickerBusy || !pickerSelected}
                                className={`px-5 py-2 text-sm text-white rounded-lg font-medium transition-colors disabled:opacity-50 ${
                                    pickerMode === 'BLOCK' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                                }`}
                            >
                                {pickerBusy ? 'Đang xử lý...' : 'Xác nhận'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Disband confirm modal */}
            <ConfirmModal
                isOpen={isDisbandModalOpen}
                onClose={() => setIsDisbandModalOpen(false)}
                onConfirm={executeDisband}
                title="Giải tán nhóm"
                message={"Mời tất cả mọi người rời nhóm và xóa tin nhắn? Nhóm đã giải tán sẽ KHÔNG THỂ khôi phục."}
                confirmText="Giải tán nhóm"
                cancelText="Không"
                isDanger={true}
            />

            <ConfirmModal
                isOpen={!!removeAdminTargetId}
                onClose={() => setRemoveAdminTargetId(null)}
                onConfirm={() => {
                    const id = removeAdminTargetId;
                    setRemoveAdminTargetId(null);
                    if (id) executeRemoveAdmin(id);
                }}
                title="Xóa phó nhóm"
                message={"Bạn có chắc chắn muốn xóa quyền phó nhóm của thành viên này?"}
                confirmText="Xóa"
                cancelText="Không"
                isDanger={true}
            />
        </div>
    );
};

export default GroupManagementPanel;
