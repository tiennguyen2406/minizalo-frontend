import React, { useState, useMemo } from 'react';
import { Message } from '@/shared/types';
import { useChatStore } from '@/shared/store/useChatStore';
import { MessageService } from '@/shared/services/MessageService';

interface ForwardMessageModalProps {
    messages: Message[];
    currentRoomId: string;
    onClose: () => void;
}

const MAX_FORWARD_TARGETS = 5;

const ForwardMessageModal: React.FC<ForwardMessageModalProps> = ({ messages, currentRoomId, onClose }) => {
    const rooms = useChatStore((s) => s.rooms);
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [sending, setSending] = useState(false);
    const [toast, setToast] = useState<string | null>(null);

    // Filter out current room and apply search
    const filteredRooms = useMemo(() => {
        const list = rooms
            .filter((r) => r.id !== currentRoomId)
            .filter((r) => {
                if (!search.trim()) return true;
                return r.name.toLowerCase().includes(search.toLowerCase());
            });
        // Cloud luôn nằm đầu danh sách
        list.sort((a, b) => {
            if (a.type === 'CLOUD' && b.type !== 'CLOUD') return -1;
            if (b.type === 'CLOUD' && a.type !== 'CLOUD') return 1;
            return 0;
        });
        return list;
    }, [rooms, currentRoomId, search]);

    const handleToggle = (roomId: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(roomId)) {
                next.delete(roomId);
            } else {
                if (next.size >= MAX_FORWARD_TARGETS) return prev;
                next.add(roomId);
            }
            return next;
        });
    };

    const handleForward = async () => {
        if (selected.size === 0 || sending) return;
        setSending(true);
        try {
            const targets = Array.from(selected);
            for (const targetRoomId of targets) {
                for (const msg of messages) {
                    await MessageService.forwardMessage(currentRoomId, msg.id, targetRoomId);
                }
            }
            setToast(`Đã chuyển tiếp đến ${targets.length} cuộc trò chuyện`);
            setTimeout(() => onClose(), 1200);
        } catch (err) {
            console.error('Forward failed:', err);
            setToast('Chuyển tiếp thất bại. Vui lòng thử lại.');
            setTimeout(() => setToast(null), 2000);
            setSending(false);
        }
    };

    const getAvatar = (name: string, avatarUrl?: string, type?: string) => {
        if (type === 'CLOUD') return '';
        if (avatarUrl) return avatarUrl;
        const bgColor = type === 'GROUP' ? '0068FF' : '4A90D9';
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${bgColor}&color=fff&bold=true&size=80`;
    };

    const previewContent = (() => {
        if (messages.length > 1) return `🖼️ ${messages.length} ảnh`;
        const message = messages[0];
        if (message.type === 'IMAGE') return '🖼️ Ảnh';
        if (message.type === 'VIDEO') return '🎥 Video';
        if (message.type === 'FILE' || message.type === 'DOCUMENT') return `📎 ${message.fileName || 'Tệp đính kèm'}`;
        return message.content?.slice(0, 80) || '[Tin nhắn]';
    })();

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40" onClick={onClose}>
            <div
                className="bg-[color:var(--bg-primary)] rounded-2xl shadow-2xl w-[420px] max-h-[85vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--border-primary)] shrink-0">
                    <h3 className="text-base font-semibold text-[color:var(--text-primary)]">Chia sẻ tin nhắn</h3>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[color:var(--bg-secondary)] text-gray-400 hover:text-[color:var(--text-secondary)] transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Message Preview */}
                <div className="px-5 py-3 bg-[color:var(--bg-hover)] border-b border-[color:var(--border-primary)] shrink-0">
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                            <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                            </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                            <span className="text-xs font-medium text-[color:var(--text-secondary)]">Tin nhắn chuyển tiếp</span>
                            <p className="text-sm text-[color:var(--text-secondary)] truncate mt-0.5">{previewContent}</p>
                        </div>
                    </div>
                </div>

                {/* Search */}
                <div className="px-5 py-3 shrink-0">
                    <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Tìm kiếm cuộc trò chuyện..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 text-sm border border-[color:var(--border-primary)] rounded-xl bg-[color:var(--bg-hover)] focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                            autoFocus
                        />
                    </div>
                    {selected.size > 0 && (
                        <div className="mt-2 text-xs text-[color:var(--text-secondary)]">
                            Đã chọn <span className="font-semibold text-blue-600">{selected.size}</span>/{MAX_FORWARD_TARGETS}
                        </div>
                    )}
                </div>

                {/* Room List */}
                <div className="flex-1 overflow-y-auto min-h-0">
                    {filteredRooms.length === 0 ? (
                        <div className="flex items-center justify-center py-10 text-sm text-gray-400">
                            Không tìm thấy cuộc trò chuyện
                        </div>
                    ) : (
                        filteredRooms.map((room) => {
                            const isChecked = selected.has(room.id);
                            const isDisabled = !isChecked && selected.size >= MAX_FORWARD_TARGETS;
                            return (
                                <button
                                    key={room.id}
                                    onClick={() => !isDisabled && handleToggle(room.id)}
                                    disabled={isDisabled}
                                    className={`w-full flex items-center gap-3 px-5 py-3 transition-colors text-left ${isChecked
                                        ? 'bg-blue-50 hover:bg-blue-100'
                                        : isDisabled
                                            ? 'opacity-40 cursor-not-allowed'
                                            : 'hover:bg-[color:var(--bg-hover)]'
                                        }`}
                                >
                                    {/* Checkbox */}
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${isChecked
                                        ? 'bg-blue-500 border-blue-500'
                                        : 'border-[color:var(--border-secondary)]'
                                        }`}>
                                        {isChecked && (
                                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </div>

                                    {/* Avatar */}
                                    {room.type === 'CLOUD' ? (
                                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                                            <span className="text-xl">☁️</span>
                                        </div>
                                    ) : (
                                        <img
                                            src={getAvatar(room.name, room.avatarUrl, room.type)}
                                            alt={room.name}
                                            className="w-10 h-10 rounded-full object-cover shrink-0"
                                        />
                                    )}

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-[color:var(--text-primary)] truncate">
                                            {room.type === 'CLOUD' ? 'Cloud của tôi' : room.name}
                                        </div>
                                        <div className="text-xs text-gray-400 mt-0.5">
                                            {room.type === 'CLOUD'
                                                ? 'Lưu trữ cá nhân'
                                                : room.type === 'GROUP'
                                                    ? `${room.participants?.length || 0} thành viên`
                                                    : 'Tin nhắn riêng'}
                                        </div>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-[color:var(--border-primary)] shrink-0">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-medium text-[color:var(--text-secondary)] bg-[color:var(--bg-secondary)] hover:bg-[color:var(--bg-tertiary)] rounded-xl transition-colors"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleForward}
                        disabled={selected.size === 0 || sending}
                        className="px-5 py-2.5 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center gap-2"
                    >
                        {sending && (
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                        )}
                        {sending ? 'Đang gửi...' : `Chia sẻ${selected.size > 0 ? ` (${selected.size})` : ''}`}
                    </button>
                </div>

                {/* Toast */}
                {toast && (
                    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-4 py-2 rounded-full shadow-lg z-50 pointer-events-none whitespace-nowrap">
                        {toast}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ForwardMessageModal;
