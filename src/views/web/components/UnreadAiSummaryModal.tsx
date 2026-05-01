import React, { useState, useEffect } from 'react';
import { chatService } from '@/shared/services/chatService';
import { Sparkles, X, Copy, RotateCcw, Loader2, Flashlight } from 'lucide-react';
import toast from 'react-hot-toast';
import * as Clipboard from 'expo-clipboard';

interface UnreadAiSummaryModalProps {
    roomId: string;
    onClose: () => void;
    unreadCount: number;
    initialStartDate?: string;
    initialEndDate?: string;
}

const UnreadAiSummaryModal: React.FC<UnreadAiSummaryModalProps> = ({ 
    roomId, 
    onClose, 
    unreadCount,
    initialStartDate,
    initialEndDate
}) => {
    const [loading, setLoading] = useState(false);
    const [summary, setSummary] = useState("");

    useEffect(() => {
        handleSummarize();
    }, [roomId]);

    const handleSummarize = async () => {
        setLoading(true);
        setSummary("");
        try {
            // Use provided dates or fallback to last hour
            const startIso = initialStartDate || new Date(Date.now() - 3600000).toISOString();
            const endIso = initialEndDate || new Date().toISOString();
            
            const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            
            // isUnreadOnly = true for the focused prompt
            const result = await chatService.summarizeChat(roomId, startIso, endIso, true, timezone);
            setSummary(result);
        } catch (error: any) {
            console.error('Unread summary error:', error);
            const msg = error?.message || "";
            if (msg.includes("503") || msg.includes("UNAVAILABLE")) {
                setSummary("Hệ thống AI đang bận (503). Bạn vui lòng đợi khoảng 30 giây rồi thử lại nhé.");
            } else if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
                setSummary("Hạn mức sử dụng AI đã hết (429). Vui lòng thử lại sau.");
            } else {
                setSummary("Có lỗi xảy ra khi tóm tắt tin mới. Vui lòng thử lại sau.");
            }
        } finally {
            setLoading(false);
        }
    };

    const copyText = async (text: string) => {
        if (!text) return;
        try {
            await Clipboard.setStringAsync(text);
            toast.success("Đã sao chép tóm tắt");
        } catch (error) {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            toast.success("Đã sao chép tóm tắt");
        }
    };

    const renderFormattedText = (text: string) => {
        if (!text) return null;
        const lines = text.split('\n');
        return lines.map((line, index) => {
            const trimmedLine = line.trim();
            if (!trimmedLine) return <div key={index} className="h-2" />;
            
            const isBullet = trimmedLine.startsWith('-') || trimmedLine.startsWith('•') || trimmedLine.startsWith('*');
            const content = isBullet ? trimmedLine.substring(1).trim() : trimmedLine;

            const parts = content.split(/(\*\*.*?\*\*)/g);
            const renderedContent = parts.map((part, pIdx) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={pIdx} className="text-blue-600 font-bold">{part.slice(2, -2)}</strong>;
                }
                return <span key={pIdx}>{part}</span>;
            });

            if (isBullet) {
                return (
                    <div key={index} className="flex gap-2 pl-2 mb-2 items-start">
                        <span className="text-blue-500 mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                        <p className="text-gray-700 text-[15px] leading-relaxed flex-1">{renderedContent}</p>
                    </div>
                );
            }
            return (
                <p key={index} className="text-gray-700 text-[15px] leading-relaxed mb-3 font-medium">{renderedContent}</p>
            );
        });
    };

    return (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[520px] max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-7 py-6 shrink-0 bg-white border-b border-gray-50">
                    <div className="flex items-center gap-4">
                        <div className="bg-red-50 p-3 rounded-2xl">
                            <Flashlight className="w-6 h-6 text-red-500" />
                        </div>
                        <div>
                            <h3 className="text-xl font-extrabold text-gray-900 tracking-tight">Điểm tin nhanh</h3>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{unreadCount} tin nhắn mới được tóm lược</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-all"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-7 min-h-[200px]">
                    {loading ? (
                        <div className="h-full flex flex-col items-center justify-center py-12">
                            <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
                            <p className="text-gray-500 font-bold animate-pulse">Gemini đang đọc tin nhắn...</p>
                        </div>
                    ) : (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                            {renderFormattedText(summary)}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-7 pt-0 shrink-0">
                    <div className="flex gap-3">
                        <button
                            onClick={() => {
                                copyText(summary);
                                onClose();
                            }}
                            disabled={loading || !summary}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                        >
                            <Sparkles className="w-5 h-5" />
                            Đã hiểu
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UnreadAiSummaryModal;
