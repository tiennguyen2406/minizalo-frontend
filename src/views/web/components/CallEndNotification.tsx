import React, { useEffect } from 'react';
import { useCallStore, CallEndReason } from '@/shared/store/useCallStore';
import { PhoneOff, PhoneMissed, X } from 'lucide-react';

const REASON_MAP: Record<string, { icon: React.ReactNode; title: string; description: string }> = {
    NO_ANSWER: {
        icon: <PhoneMissed size={24} className="text-orange-500" />,
        title: 'Không có phản hồi',
        description: 'Người nhận không nhấc máy. Vui lòng thử lại sau.',
    },
    REJECTED: {
        icon: <PhoneOff size={24} className="text-red-500" />,
        title: 'Cuộc gọi bị từ chối',
        description: 'Người nhận đã từ chối cuộc gọi.',
    },
    CANCELLED: {
        icon: <PhoneOff size={24} className="text-zinc-500" />,
        title: 'Cuộc gọi đã hủy',
        description: 'Cuộc gọi đã được hủy.',
    },
    ENDED: {
        icon: <PhoneOff size={24} className="text-zinc-500" />,
        title: 'Cuộc gọi kết thúc',
        description: 'Cuộc gọi đã kết thúc.',
    },
    ERROR: {
        icon: <PhoneOff size={24} className="text-red-500" />,
        title: 'Lỗi cuộc gọi',
        description: 'Không thể thực hiện cuộc gọi. Vui lòng thử lại.',
    },
};

const CallEndNotification: React.FC = () => {
    const { callEndReason, dismissCallEndReason } = useCallStore();

    useEffect(() => {
        if (!callEndReason) return;
        const timer = setTimeout(() => {
            dismissCallEndReason();
        }, 4000);
        return () => clearTimeout(timer);
    }, [callEndReason]);

    if (!callEndReason) return null;

    const info = REASON_MAP[callEndReason] || REASON_MAP.ERROR;

    return (
        <div className="fixed top-6 right-6 z-[9999] animate-in slide-in-from-right duration-300">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-4 w-80">
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                        {info.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                            {info.title}
                        </h4>
                        <p className="text-sm text-zinc-500 mt-0.5">
                            {info.description}
                        </p>
                    </div>
                    <button
                        onClick={dismissCallEndReason}
                        className="flex-shrink-0 p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <X size={16} className="text-zinc-400" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CallEndNotification;
