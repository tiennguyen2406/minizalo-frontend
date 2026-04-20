import React, { useState, useEffect } from 'react';
import { chatService } from '@/shared/services/chatService';
import { Sparkles, X, Calendar, Flashlight, Copy, RotateCcw, MessageSquare, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import * as Clipboard from 'expo-clipboard';

interface AiSummaryModalProps {
    roomId: string;
    onClose: () => void;
}

const AiSummaryModal: React.FC<AiSummaryModalProps> = ({ roomId, onClose }) => {
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        d.setHours(0, 0, 0, 0);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => {
        const d = new Date();
        d.setHours(23, 59, 59, 999);
        return d.toISOString().split('T')[0];
    });

    const [loading, setLoading] = useState(false);
    const [summary, setSummary] = useState("");

    const handleSummarize = async () => {
        setLoading(true);
        setSummary("");
        try {
            // Adjust to full ISO for the service
            const startIso = new Date(startDate).toISOString();
            const endIso = new Date(endDate);
            endIso.setHours(23, 59, 59, 999);
            
            const result = await chatService.summarizeChat(roomId, startIso, endIso.toISOString());
            setSummary(result);
        } catch (error: any) {
            console.error('Summary error:', error);
            const msg = error?.message || "";
            if (msg.includes("503") || msg.includes("UNAVAILABLE")) {
                setSummary("Hệ thống AI đang bận (503). Bạn vui lòng đợi khoảng 30 giây rồi thử lại nhé.");
            } else if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
                setSummary("Bạn đã hết hạn mức sử dụng AI cho model này (429). Vui lòng thử lại vào ngày mai hoặc kiểm tra lại gói dịch vụ.");
            } else {
                setSummary("Có lỗi xảy ra khi tóm tắt. Vui lòng thử lại sau.");
            }
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = async () => {
        if (!summary) return;
        try {
            await Clipboard.setStringAsync(summary);
            toast.success("Đã sao chép nội dung tóm tắt", {
                id: 'copy-summary-success',
                duration: 2000,
            });
        } catch (error) {
            console.error('Failed to copy:', error);
            // Fallback
            const textArea = document.createElement("textarea");
            textArea.value = summary;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            toast.success("Đã sao chép nội dung tóm tắt");
        }
    };

    const renderFormattedText = (text: string) => {
        if (!text) return null;
        
        const lines = text.split('\n');
        return lines.map((line, index) => {
            const trimmedLine = line.trim();
            if (!trimmedLine) return <div key={index} className="h-3" />;
            
            // Render Heading (starts with [0-9]. or emoji)
            const isMainHeading = trimmedLine.match(/^[0-9]\./) || trimmedLine.match(/^[📌💬✅🚀💡]/);
            
            // Check if bullet point
            const isBullet = trimmedLine.startsWith('-') || trimmedLine.startsWith('•') || trimmedLine.startsWith('*');
            
            const content = isBullet ? trimmedLine.substring(1).trim() : trimmedLine;

            // Simple parser for bold text within a line
            const parts = content.split(/(\*\*.*?\*\*)/g);
            const renderedContent = parts.map((part, pIdx) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return (
                        <strong key={pIdx} className={isMainHeading ? "text-blue-600" : ""}>
                            {part.slice(2, -2)}
                        </strong>
                    );
                }
                return <span key={pIdx}>{part}</span>;
            });

            if (isMainHeading) {
                return (
                    <div key={index} className="mt-6 mb-3 border-l-4 border-blue-500 pl-4">
                        <h4 className="text-blue-600 font-bold text-lg leading-7">
                            {renderedContent}
                        </h4>
                    </div>
                );
            }
            
            if (isBullet) {
                return (
                    <div key={index} className="flex gap-3 pl-3 mb-2 items-start">
                        <span className="text-blue-500 mt-1 select-none">•</span>
                        <p className="text-gray-700 text-sm leading-relaxed flex-1">
                            {renderedContent}
                        </p>
                    </div>
                );
            }
            
            return (
                <p key={index} className="text-gray-700 text-sm leading-relaxed mb-2 pl-1">
                    {renderedContent}
                </p>
            );
        });
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-[600px] max-h-[85vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0 bg-white">
                    <div className="flex items-center gap-4">
                        <div className="bg-yellow-50 p-2.5 rounded-xl">
                            <Sparkles className="w-6 h-6 text-yellow-500 fill-yellow-500/20" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">AI Tóm Tắt Chat</h3>
                            <p className="text-xs text-gray-500">Hỗ trợ bởi Google Gemini</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Date Controls */}
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 shrink-0">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Từ ngày</label>
                            <div className="relative group">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 group-hover:text-blue-600 transition-colors" />
                                <input 
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full pl-10 pr-3 py-2.5 text-sm font-medium bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-blue-500 transition-all cursor-pointer"
                                />
                            </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Đến hết</label>
                            <div className="relative group">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 group-hover:text-blue-600 transition-colors" />
                                <input 
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full pl-10 pr-3 py-2.5 text-sm font-medium bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-blue-500 transition-all cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>

                    {!summary && (
                        <button
                            onClick={handleSummarize}
                            disabled={loading}
                            className="w-full mt-5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 disabled:cursor-not-allowed transform active:scale-95"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Flashlight className="w-5 h-5" />
                            )}
                            {loading ? 'Đang phân tích dữ liệu...' : 'Bắt đầu tóm tắt bằng AI'}
                        </button>
                    )}
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto bg-white p-6 relative">
                    {summary ? (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {renderFormattedText(summary)}
                            <div className="h-10" /> {/* Spacer */}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-70 py-12">
                            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                                <MessageSquare className="w-10 h-10 text-gray-300" />
                            </div>
                            <h4 className="text-gray-900 font-bold mb-2">Chưa có bản tóm tắt nào</h4>
                            <p className="text-gray-500 text-sm max-w-[280px] leading-relaxed">
                                Hãy chọn khoảng thời gian bạn muốn AI phân tích và bấm nút bắt đầu nhé!
                            </p>
                        </div>
                    )}

                    {/* Quick Actions Floating Bar */}
                    {summary && !loading && (
                        <div className="sticky bottom-0 left-0 right-0 flex justify-end gap-3 mt-4 pt-4 border-t border-gray-50 bg-white/80 backdrop-blur-md">
                            <button
                                onClick={() => setSummary("")}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all"
                                title="Làm mới"
                            >
                                <RotateCcw className="w-4 h-4" />
                                <span>Thử lại</span>
                            </button>
                            <button
                                onClick={copyToClipboard}
                                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-all shadow-md shadow-blue-600/10"
                            >
                                <Copy className="w-4 h-4" />
                                <span>Sao chép kết quả</span>
                            </button>
                        </div>
                    )}

                    {loading && (
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex flex-col items-center justify-center animate-pulse">
                            <div className="w-16 h-1 bg-blue-100 rounded-full overflow-hidden mb-4">
                                <div className="w-1/2 h-full bg-blue-500 animate-[loading_1.5s_infinite_ease-in-out]" />
                            </div>
                            <p className="text-blue-600 font-medium text-sm">Gemini đang đọc tin nhắn...</p>
                        </div>
                    )}
                </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes loading {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(200%); }
                }
            `}} />
        </div>
    );
};

export default AiSummaryModal;
