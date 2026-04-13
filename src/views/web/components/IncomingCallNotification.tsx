import React, { useEffect, useRef } from 'react';
import { useCallStore } from '@/shared/store/useCallStore';
import { Phone, Video, X, PhoneOff, VideoOff } from 'lucide-react';

const IncomingCallNotification = () => {
    const { incomingCall, acceptCall, rejectCall } = useCallStore();
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (incomingCall) {
            timer = setTimeout(() => {
                rejectCall(incomingCall.callSessionId);
            }, 30000);
        }
        return () => clearTimeout(timer);
    }, [incomingCall]);

    useEffect(() => {
        if (incomingCall) {
            try {
                const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ==');
                audio.loop = true;
                audio.volume = 0.3;
                audio.play().catch(() => {});
                audioRef.current = audio;
            } catch {}
        }
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, [incomingCall]);

    if (!incomingCall) return null;

    const { caller, callType } = incomingCall;
    const callerName = caller?.name || 'Người dùng';
    const callerAvatar = caller?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(callerName)}&background=0068FF&color=fff&size=128`;

    return (
        <div className="fixed bottom-6 right-6 z-[9999]" style={{ animation: 'slideInRight 0.3s ease-out' }}>
            <div className="bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-800 overflow-hidden" style={{ width: 320 }}>
                {/* Header with close */}
                <div className="flex items-center justify-between px-4 pt-3 pb-0">
                    <span className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Cuộc gọi đến</span>
                    <button
                        onClick={() => rejectCall(incomingCall.callSessionId)}
                        className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                        <X size={14} />
                    </button>
                </div>

                {/* Caller info */}
                <div className="flex items-center gap-3 px-4 py-3">
                    <div className="relative flex-shrink-0">
                        <img
                            src={callerAvatar}
                            alt={callerName}
                            className="w-12 h-12 rounded-full object-cover ring-2 ring-blue-500/30"
                        />
                        <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                            {callType === 'VIDEO' ? <Video size={10} className="text-white" /> : <Phone size={10} className="text-white" />}
                        </div>
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-white font-semibold text-sm truncate">{callerName}</p>
                        <p className="text-zinc-400 text-xs">
                            MiniZalo: {callType === 'VIDEO' ? 'Cuộc gọi video đến' : 'Cuộc gọi thoại đến'}
                        </p>
                    </div>
                </div>

                {/* Action buttons */}
                <div className="px-4 pb-3 flex flex-col gap-2">
                    <div className="flex gap-2">
                        <button
                            onClick={() => rejectCall(incomingCall.callSessionId)}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors text-sm font-medium"
                        >
                            <PhoneOff size={16} />
                            Từ chối
                        </button>
                        <button
                            onClick={() => acceptCall(incomingCall.callSessionId)}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-500 text-white hover:bg-green-600 transition-colors text-sm font-medium"
                        >
                            {callType === 'VIDEO' ? <Video size={16} /> : <Phone size={16} />}
                            Trả lời
                        </button>
                    </div>

                    {callType === 'VIDEO' && (
                        <button
                            onClick={() => acceptCall(incomingCall.callSessionId)}
                            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors text-xs font-medium"
                        >
                            <VideoOff size={14} />
                            Trả lời không mở camera
                        </button>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes slideInRight {
                    from { opacity: 0; transform: translateX(100px); }
                    to { opacity: 1; transform: translateX(0); }
                }
            `}</style>
        </div>
    );
};

export default IncomingCallNotification;
