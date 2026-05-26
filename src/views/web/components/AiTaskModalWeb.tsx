import React, { useState, useEffect } from 'react';
import { X, Languages, PenLine, Calendar, Loader2, AlertCircle, Copy, Check } from 'lucide-react';
import { chatService } from '@/shared/services/chatService';

export type AiTaskMode = "translate" | "improve" | "extract";

interface AiTaskModalWebProps {
  mode: AiTaskMode;
  roomId: string;
  onClose: () => void;
}

export default function AiTaskModalWeb({ mode, roomId, onClose }: AiTaskModalWebProps) {
  const [inputText, setInputText] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const getModeData = () => {
    switch (mode) {
      case "translate": return { title: "Dịch Thuật Tự Động", icon: Languages, color: "text-green-600 dark:text-green-400", bgLight: "bg-green-100 dark:bg-green-500/20", btnBg: "bg-green-600 hover:bg-green-700", desc: "Nhập văn bản cần dịch sang Tiếng Việt", btnText: "Dịch Ngay" };
      case "improve": return { title: "Cải Thiện Văn Phong", icon: PenLine, color: "text-orange-600 dark:text-orange-400", bgLight: "bg-orange-100 dark:bg-orange-500/20", btnBg: "bg-orange-600 hover:bg-orange-700", desc: "Nhập văn bản cần sửa lỗi và làm cho chuyên nghiệp hơn", btnText: "Cải Thiện" };
      case "extract": return { title: "Trích Xuất Lịch Hẹn", icon: Calendar, color: "text-red-600 dark:text-red-400", bgLight: "bg-red-100 dark:bg-red-500/20", btnBg: "bg-red-600 hover:bg-red-700", desc: "AI đang quét lịch sử trò chuyện để tìm lịch hẹn...", btnText: "Quét Lại" };
      default: return { title: "AI Task", icon: Languages, color: "text-blue-600", bgLight: "bg-blue-100", btnBg: "bg-blue-600", desc: "", btnText: "Thực Hiện" };
    }
  };

  const data = getModeData();
  const Icon = data.icon;

  useEffect(() => {
    if (mode === "extract") {
      handleTask();
    }
  }, [mode]);

  const handleTask = async () => {
    if (mode !== "extract" && !inputText.trim()) return;
    
    setLoading(true);
    setError(null);
    setResult("");
    setCopied(false);
    
    try {
      let res = "";
      if (mode === "translate") {
        res = await chatService.translateText(inputText);
      } else if (mode === "improve") {
        res = await chatService.improveText(inputText);
      } else if (mode === "extract") {
        const endTime = new Date().toISOString();
        const startTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        res = await chatService.extractEvents(roomId, startTime, endTime);
      }
      setResult(res);
    } catch (err: any) {
      console.error("AI Task Error:", err);
      setError("Có lỗi xảy ra khi kết nối với AI. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (result) {
      try {
        await navigator.clipboard.writeText(result);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy', err);
      }
    }
  };

  const renderFormattedText = (text: string) => {
    if (!text) return null;
    
    const lines = text.split('\n');
    return lines.map((line, index) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return <div key={index} className="h-2" />;
      
      const isBullet = trimmedLine.startsWith('-') || trimmedLine.startsWith('•') || trimmedLine.startsWith('*');
      const content = isBullet ? trimmedLine.replace(/^[-•*]\s*/, '') : trimmedLine;

      const parts = content.split(/(\*\*.*?\*\*)/g);
      const renderedContent = parts.map((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={pIdx} className="font-bold text-[color:var(--text-primary)] dark:text-white">{part.slice(2, -2)}</strong>;
        }
        return <span key={pIdx}>{part}</span>;
      });

      if (isBullet) {
        return (
          <div key={index} className="flex mb-1.5 pl-2">
            <span className={`${data.color} mr-2 text-lg leading-tight`}>•</span>
            <span className="text-[color:var(--text-primary)] dark:text-gray-200 flex-1 text-sm leading-relaxed">{renderedContent}</span>
          </div>
        );
      }
      
      return <p key={index} className="text-[color:var(--text-primary)] dark:text-gray-200 leading-relaxed text-sm mb-2">{renderedContent}</p>;
    });
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 px-4">
      <div className="bg-[color:var(--bg-primary)] dark:bg-gray-800 w-full max-w-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[color:var(--border-primary)] dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`${data.bgLight} p-2.5 rounded-xl`}>
              <Icon className={`w-6 h-6 ${data.color}`} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-[color:var(--text-primary)] dark:text-white">{data.title}</h3>
              <p className="text-sm text-[color:var(--text-secondary)] dark:text-gray-400">{data.desc}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-[color:var(--bg-secondary)] dark:hover:bg-gray-700 rounded-full transition-colors text-[color:var(--text-secondary)]"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto max-h-[70vh]">
          {/* Input Area */}
          {mode !== "extract" && !result && !loading && !error && (
            <div className="space-y-4">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Nhập hoặc dán đoạn văn bản vào đây..."
                className="w-full bg-[color:var(--bg-hover)] dark:bg-gray-900 border border-[color:var(--border-primary)] dark:border-gray-700 rounded-xl p-4 text-sm text-[color:var(--text-primary)] dark:text-white focus:ring-2 focus:ring-blue-500/50 outline-none resize-none min-h-[120px]"
              />
              <button
                onClick={handleTask}
                disabled={!inputText.trim()}
                className={`w-full py-3 rounded-xl font-bold text-white transition-all ${
                  inputText.trim() ? data.btnBg : "bg-gray-300 dark:bg-gray-700 text-[color:var(--text-secondary)] cursor-not-allowed"
                }`}
              >
                {data.btnText}
              </button>
            </div>
          )}

          {/* Result Area */}
          {(loading || result || error || mode === "extract") && (
            <div className="space-y-4">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className={`w-10 h-10 animate-spin ${data.color} mb-4`} />
                  <p className="text-[color:var(--text-secondary)] font-medium">AI đang xử lý yêu cầu của bạn...</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                  <p className="text-red-600 text-center">{error}</p>
                  <button 
                    onClick={() => { setError(null); if(mode === "extract") handleTask(); }}
                    className="mt-4 px-6 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 font-medium transition-colors"
                  >
                    Thử Lại
                  </button>
                </div>
              ) : result ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="bg-[color:var(--bg-hover)] dark:bg-gray-900/50 border border-[color:var(--border-primary)] dark:border-gray-700 p-4 rounded-xl max-h-[300px] overflow-y-auto custom-scrollbar">
                    {renderFormattedText(result)}
                  </div>
                  
                  <div className="flex gap-3">
                    {(mode === "translate" || mode === "improve") && (
                      <button
                        onClick={() => setResult("")}
                        className="flex-1 py-3 bg-[color:var(--bg-primary)] dark:bg-gray-800 border border-[color:var(--border-primary)] dark:border-gray-600 rounded-xl font-semibold text-[color:var(--text-secondary)] dark:text-gray-200 hover:bg-[color:var(--bg-hover)] dark:hover:bg-gray-700 transition-colors"
                      >
                        Thử Lại
                      </button>
                    )}
                    <button
                      onClick={handleCopy}
                      className={`flex-[2] py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-white transition-colors ${
                        copied ? "bg-emerald-500" : data.btnBg
                      }`}
                    >
                      {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                      {copied ? "Đã Sao Chép" : "Sao Chép Kết Quả"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
