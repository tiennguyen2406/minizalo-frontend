import React, { useState, useMemo, useCallback } from 'react';
import { CollapsibleSection, ActionButton, ActionButtonRow, ToggleSwitch } from './ChatInfoHelpers';
import { useGroupStore } from '@/shared/store/useGroupStore';
import { useChatStore } from '@/shared/store/useChatStore';
import { useFriendStore } from '@/shared/store/friendStore';
import { ChatRoom } from '@/shared/types';
import ConfirmModal from './ConfirmModal';
import { chatService } from '@/shared/services/chatService';

// ── Mute Duration Modal ─────────────────────────────────────────────────────
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
                                    name="mute-direct"
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

// ── Nickname Modal  ─────────────────────────────────────────────────────────
const NicknameModal: React.FC<{
    currentName: string;
    avatarSrc: string;
    onClose: () => void;
    onConfirm: (newName: string) => void;
}> = ({ currentName, avatarSrc, onClose, onConfirm }) => {
    const [name, setName] = useState(currentName);
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-80 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="px-5 pt-6 pb-2 flex flex-col items-center text-center">
                    <img src={avatarSrc} alt={currentName} className="w-16 h-16 rounded-full object-cover mb-3 shadow-sm" />
                    <h3 className="font-semibold text-gray-800 mb-1">Đặt tên gợi nhớ</h3>
                    <p className="text-sm text-gray-500 mb-1">
                        Hãy đặt cho <strong>{currentName}</strong> một cái tên dễ nhớ.
                    </p>
                    <p className="text-xs text-gray-400 mb-4">Lưu ý: Tên gợi nhớ sẽ chỉ hiển thị riêng với bạn.</p>
                    <input
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400 mb-2"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        maxLength={50}
                        autoFocus
                        onKeyDown={(e) => { if (e.key === 'Enter') { onConfirm(name.trim()); onClose(); } }}
                    />
                </div>
                <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100">
                    <button onClick={onClose} className="px-5 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors">Hủy</button>
                    <button
                        onClick={() => { onConfirm(name.trim()); onClose(); }}
                        disabled={!name.trim()}
                        className="px-5 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-medium transition-colors"
                    >Xác nhận</button>
                </div>
            </div>
        </div>
    );
};

// ─── Icon set ───────────────────────────────────────────────────────────────
const Icon = {
    Bell: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
    Pin: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>,
    GroupAdd: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>,
    Clock: () => <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    File: () => <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>,
    Link: () => <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>,
    Eye: () => <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>,
    Alert: () => <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>,
    Block: () => <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>,
    Trash: () => <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>,
};

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

interface DirectChatInfoPanelProps {
    room: ChatRoom;
    onClose: () => void;
    partner:
        | {
              id: string;
              username: string;
              fullName?: string;
              avatarUrl?: string;
              businessDescription?: string | null;
          }
        | undefined;
}

const DirectChatInfoPanel: React.FC<DirectChatInfoPanelProps> = ({ room, onClose, partner }) => {
    const { openCreateGroup } = useGroupStore();
    const { blockUser } = useFriendStore();
    const { pinnedRooms, togglePinRoom, mutedRooms, toggleMuteRoom, upsertRoom } = useChatStore();

    const [autoDeleteMsg] = useState('Không bao giờ');
    const [hideConversation, setHideConversation] = useState(false);
    const [muteLabel, setMuteLabel] = useState<string | null>(null);
    const [nickname, setNickname] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

    // Modal states
    const [showMuteModal, setShowMuteModal] = useState(false);
    const [showNicknameModal, setShowNicknameModal] = useState(false);
    const [isClearHistoryModalOpen, setIsClearHistoryModalOpen] = useState(false);
    const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
    const [businessDescExpanded, setBusinessDescExpanded] = useState(false);

    const isPinned = pinnedRooms.has(room.id);
    const displayName = nickname || partner?.fullName || partner?.username || room.name || 'Người dùng';
    const realName = partner?.fullName || partner?.username || room.name || 'Người dùng';
    const avatarSrc = partner?.avatarUrl ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(realName)}&background=4f46e5&color=fff&bold=true&size=128`;

    const businessDesc = partner?.businessDescription?.trim() || '';
    const businessDescPreviewLen = 160;
    const businessDescNeedsMore =
        businessDesc.length > businessDescPreviewLen && !businessDescExpanded;
    const businessDescShown = businessDescNeedsMore
        ? `${businessDesc.slice(0, businessDescPreviewLen)}…`
        : businessDesc;

    const showToast = useCallback((msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 2200);
    }, []);

    const handleMuteConfirm = useCallback((optionId: string) => {
        const labels: Record<string, string> = {
            '1h': '1 giờ', '4h': '4 giờ', '8am': 'đến 8:00 AM', 'forever': 'mãi mãi',
        };
        setMuteLabel(labels[optionId] || optionId);
        if (!mutedRooms.has(room.id)) toggleMuteRoom(room.id);
        showToast(`Đã tắt thông báo ${labels[optionId]}`);
    }, [showToast, mutedRooms, toggleMuteRoom, room.id]);

    const handleUnmute = useCallback(() => {
        setMuteLabel(null);
        if (mutedRooms.has(room.id)) toggleMuteRoom(room.id);
        showToast('Đã bật thông báo');
    }, [showToast, mutedRooms, toggleMuteRoom, room.id]);

    // Reactive message subscriptions
    const allMessages = useChatStore((s) => s.messages[room.id] || []);

    const handleNicknameConfirm = useCallback(async (newName: string) => {
        // Optimistic update
        setNickname(newName || null);
        // Update sidebar room name in store immediately
        upsertRoom({ ...room, name: newName || (partner?.fullName || partner?.username || room.name || '') });
        showToast(newName ? `Đã đặt tên gợi nhớ: ${newName}` : 'Đã xóa tên gợi nhớ');
        // Persist to backend
        try {
            const updated = await chatService.saveNickname(room.id, newName);
            // Re-sync with server name
            upsertRoom({ ...room, name: updated.name });
        } catch {
            showToast('Không thể lưu tên gợi nhớ lên server');
        }
    }, [room, partner, upsertRoom, showToast]);

    const imageMessages = useMemo(() =>
        allMessages.filter((m) => m.type === 'IMAGE' && m.fileUrl).slice(-9),
        [allMessages]);

    // File: any message with fileUrl that is NOT image or video
    const fileMessages = useMemo(() =>
        allMessages.filter((m) => m.fileUrl && m.type !== 'IMAGE' && m.type !== 'VIDEO').slice(-5),
        [allMessages]);

    const linkMessages = useMemo(() => {
        const seen = new Set<string>();
        const links: string[] = [];
        for (const m of [...allMessages].reverse()) {
            if (m.type === 'TEXT' && m.content) {
                for (const url of extractUrls(m.content)) {
                    if (!seen.has(url)) { seen.add(url); links.push(url); }
                    if (links.length >= 5) break;
                }
            }
            if (links.length >= 5) break;
        }
        return links;
    }, [allMessages]);

    const executeClearHistory = () => {
        useChatStore.getState().setMessages(room.id, []);
    };

    return (
        <div
            className="flex flex-col h-full bg-white border-l border-gray-200 overflow-y-auto"
            style={{ width: 300, minWidth: 300 }}
        >
            {/* Toast */}
            {toast && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] bg-gray-800 text-white text-xs px-4 py-2 rounded-full shadow-lg pointer-events-none">
                    {toast}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0 sticky top-0 bg-white z-10">
                <span className="font-semibold text-gray-800 text-sm">Thông tin hội thoại</span>
                <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Avatar + Name */}
            <div className="flex flex-col items-center py-5 px-4 border-b border-gray-100">
                <div className="relative mb-2">
                    <img
                        src={avatarSrc}
                        alt={displayName}
                        className="w-16 h-16 rounded-full object-cover shadow-sm"
                    />
                    {/* Muted badge on avatar */}
                    {muteLabel && (
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 border-2 border-white">
                            <svg className="w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                            </svg>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-gray-900 text-base">{displayName}</span>
                    {/* Pencil — opens Nickname Modal */}
                    <button
                        onClick={() => setShowNicknameModal(true)}
                        className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                        title="Đặt tên gợi nhớ"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                    </button>
                </div>
                {partner?.username && (
                    <span className="text-xs text-gray-400 mt-0.5">@{partner.username}</span>
                )}
                {!!businessDesc && (
                    <span className="mt-2 inline-flex items-center rounded-full bg-[#0068ff]/10 px-2.5 py-0.5 text-xs font-medium text-[#0068ff]">
                        Business
                    </span>
                )}
                {/* Muted label */}
                {muteLabel && (
                    <span className="mt-1 text-xs text-gray-400 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                        </svg>
                        Đang tắt thông báo ({muteLabel})
                    </span>
                )}
            </div>

            {!!businessDesc && (
                <div className="mx-3 mb-3 rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                        Thông tin kinh doanh
                    </div>
                    <div className="space-y-2 text-sm">
                        <div>
                            <div className="text-xs text-gray-400 mb-0.5">Mô tả</div>
                            <p className="text-gray-800 whitespace-pre-wrap break-words leading-snug">
                                {businessDescShown}
                            </p>
                        </div>
                        {businessDesc.length > businessDescPreviewLen && (
                            <button
                                type="button"
                                onClick={() => setBusinessDescExpanded((e) => !e)}
                                className="text-sm font-medium text-[#0068ff] hover:underline"
                            >
                                {businessDescExpanded ? 'Thu gọn' : 'Xem thêm'}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Action Buttons */}
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
                    onClick={() => { togglePinRoom(room.id); showToast(isPinned ? 'Đã bỏ ghim' : 'Đã ghim hội thoại'); }}
                />
                <ActionButton
                    icon={<Icon.GroupAdd />}
                    label={<span>Tạo nhóm<br />trò chuyện</span>}
                    onClick={() => { onClose(); openCreateGroup(); }}
                />
            </ActionButtonRow>

            {/* Ảnh/Video */}
            <CollapsibleSection title="Ảnh/Video" badge={imageMessages.length || undefined}>
                {imageMessages.length > 0 ? (
                    <div className="px-3">
                        <div className="grid grid-cols-3 gap-1 mb-2">
                            {imageMessages.map((m) => (
                                <button
                                    key={m.id}
                                    onClick={() => setLightboxUrl(m.fileUrl!)}
                                    className="relative aspect-square w-full overflow-hidden rounded hover:opacity-90 transition-opacity"
                                >
                                    <img src={m.fileUrl} alt="" className="w-full h-full object-cover" />
                                </button>
                            ))}
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
                                className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors cursor-pointer"
                                onClick={() => {
                                    useChatStore.getState().setHighlightedMessageId(m.id);
                                }}
                            >
                                <Icon.File />
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm text-gray-800 truncate font-medium">{m.fileName || 'File'}</div>
                                    <div className="text-xs text-gray-400">{formatBytes(m.fileSize)}</div>
                                </div>
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
                        {linkMessages.map((url, i) => (
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
                    onClick={() => setIsBlockModalOpen(true)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 transition-colors text-left"
                >
                    <Icon.Block />
                    <span className="text-sm text-red-500">Chặn người này</span>
                </button>
                <button
                    onClick={() => setIsClearHistoryModalOpen(true)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 transition-colors text-left"
                >
                    <Icon.Trash />
                    <span className="text-sm text-red-500">Xóa lịch sử trò chuyện</span>
                </button>
            </div>

            {/* Modals */}
            {showMuteModal && (
                <MuteModal
                    onClose={() => setShowMuteModal(false)}
                    onConfirm={handleMuteConfirm}
                />
            )}

            {showNicknameModal && (
                <NicknameModal
                    currentName={nickname || realName}
                    avatarSrc={avatarSrc}
                    onClose={() => setShowNicknameModal(false)}
                    onConfirm={handleNicknameConfirm}
                />
            )}

            <ConfirmModal
                isOpen={isBlockModalOpen}
                onClose={() => setIsBlockModalOpen(false)}
                onConfirm={async () => {
                    if (partner) {
                        try { await blockUser(partner.id); } catch {}
                    }
                }}
                title="Xác nhận chặn"
                message={`Bạn có chắc chắn muốn chặn "${displayName}"? Người này sẽ không thể nhắn tin cho bạn.`}
                confirmText="Chặn"
                isDanger={true}
            />
            <ConfirmModal
                isOpen={isClearHistoryModalOpen}
                onClose={() => setIsClearHistoryModalOpen(false)}
                onConfirm={executeClearHistory}
                title="Xác nhận"
                message="Toàn bộ nội dung trò chuyện sẽ bị xóa vĩnh viễn. Bạn có chắc chắn muốn xóa?"
                confirmText="Xóa"
                isDanger={true}
            />

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
        </div>
    );
};

export default React.memo(DirectChatInfoPanel);
