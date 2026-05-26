import React from 'react';
import { User } from '@/shared/types';
import { X, CheckCircle2 } from 'lucide-react';

interface ReadReceiptModalProps {
    isOpen: boolean;
    onClose: () => void;
    readByIds: string[];
    participants: User[];
    currentUserId: string;
}

const ReadReceiptModal: React.FC<ReadReceiptModalProps> = ({
    isOpen,
    onClose,
    readByIds,
    participants,
    currentUserId,
}) => {
    if (!isOpen) return null;

    // Lọc ra danh sách những người đã xem (trừ bản thân người gửi)
    const readers = participants.filter(
        p => p.id !== currentUserId && readByIds.includes(p.id)
    );

    // Lọc ra danh sách những người chưa xem
    const unreadUsers = participants.filter(
        p => p.id !== currentUserId && !readByIds.includes(p.id)
    );

    return (
        <div 
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={onClose}
        >
            <div 
                className="w-full max-w-sm bg-[color:var(--bg-primary)] dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[80vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--border-primary)] dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                    <h3 className="font-bold text-[color:var(--text-primary)] dark:text-gray-100 flex items-center gap-2">
                        Chi tiết tin nhắn
                    </h3>
                    <button 
                        onClick={onClose}
                        className="p-1.5 hover:bg-[color:var(--bg-tertiary)] dark:hover:bg-gray-700 rounded-full transition-colors text-[color:var(--text-secondary)]"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body - Scrollable */}
                <div className="flex-1 overflow-y-auto p-2">
                    {/* Mục: Đã xem */}
                    <div className="mb-4">
                        <div className="px-3 py-2 flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-400">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Đã xem ({readers.length})</span>
                        </div>
                        {readers.length === 0 ? (
                            <p className="text-sm text-[color:var(--text-secondary)] dark:text-gray-400 px-4 py-2 italic">Chưa ai xem tin nhắn này</p>
                        ) : (
                            <div className="flex flex-col">
                                {readers.map(user => (
                                    <div key={user.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[color:var(--bg-hover)] dark:hover:bg-gray-700/50 transition-colors rounded-xl">
                                        <img 
                                            src={user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || user.username)}&size=40&background=random`} 
                                            alt={user.fullName || user.username}
                                            className="w-10 h-10 rounded-full object-cover shadow-sm border border-[color:var(--border-primary)] dark:border-gray-600"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-[color:var(--text-primary)] dark:text-gray-100 truncate">
                                                {user.fullName || user.username}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Mục: Chưa xem (Chỉ hiển thị nếu có người chưa xem) */}
                    {unreadUsers.length > 0 && (
                        <div>
                            <div className="px-3 py-2 text-sm font-semibold text-[color:var(--text-secondary)] dark:text-gray-400">
                                Chưa xem ({unreadUsers.length})
                            </div>
                            <div className="flex flex-col opacity-60">
                                {unreadUsers.map(user => (
                                    <div key={user.id} className="flex items-center gap-3 px-4 py-2 hover:bg-[color:var(--bg-hover)] dark:hover:bg-gray-700/50 transition-colors rounded-xl">
                                        <img 
                                            src={user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || user.username)}&size=32&background=random`} 
                                            alt={user.fullName || user.username}
                                            className="w-8 h-8 rounded-full object-cover grayscale"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-[color:var(--text-secondary)] dark:text-gray-300 truncate">
                                                {user.fullName || user.username}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReadReceiptModal;
