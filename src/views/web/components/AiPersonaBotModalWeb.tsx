import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, Loader2, AlertCircle } from 'lucide-react';
import { chatService } from '@/shared/services/chatService';

interface AiPersonaBotModalWebProps {
  onClose: () => void;
}

const PERSONAS = [
  { id: "the_thao", name: "Thể Thao", prompt: "Thể thao (Bóng đá, quần vợt, v.v.)", color: "bg-blue-500", text: "text-blue-500", border: "border-blue-500", bgLight: "bg-blue-50" },
  { id: "am_thuc", name: "Ẩm Thực", prompt: "Ẩm thực và gợi ý quán ăn", color: "bg-amber-500", text: "text-amber-500", border: "border-amber-500", bgLight: "bg-amber-50" },
  { id: "lap_trinh", name: "Lập Trình", prompt: "Lập trình và Công nghệ thông tin", color: "bg-emerald-500", text: "text-emerald-500", border: "border-emerald-500", bgLight: "bg-emerald-50" },
  { id: "suc_khoe", name: "Sức Khỏe", prompt: "Sức khỏe và Thể hình", color: "bg-red-500", text: "text-red-500", border: "border-red-500", bgLight: "bg-red-50" },
  { id: "tai_chinh", name: "Tài Chính", prompt: "Tài chính và Đầu tư", color: "bg-violet-500", text: "text-violet-500", border: "border-violet-500", bgLight: "bg-violet-50" },
];

interface ChatMessage {
  role: 'user' | 'bot';
  text: string;
}

export default function AiPersonaBotModalWeb({ onClose }: AiPersonaBotModalWebProps) {
  const [selectedPersona, setSelectedPersona] = useState(PERSONAS[0]);
  const [inputValue, setInputValue] = useState("");
  const [history, setHistory] = useState<Record<string, ChatMessage[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, loading, error, selectedPersona]);

  const handleAsk = async () => {
    if (!inputValue.trim()) return;
    const currentQ = inputValue.trim();
    setInputValue("");
    setError(null);
    
    const currentPersonaId = selectedPersona.id;
    const userMsg: ChatMessage = { role: 'user', text: currentQ };
    
    setHistory(prev => ({
      ...prev,
      [currentPersonaId]: [...(prev[currentPersonaId] || []), userMsg]
    }));
    
    setLoading(true);
    
    try {
      const res = await chatService.askPersona(selectedPersona.prompt, currentQ);
      
      const botMsg: ChatMessage = { role: 'bot', text: res };
      setHistory(prev => ({
        ...prev,
        [currentPersonaId]: [...(prev[currentPersonaId] || []), botMsg]
      }));
      
    } catch (err: any) {
      console.error("Persona Bot Error:", err);
      setError("Có lỗi xảy ra khi kết nối với AI. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
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
            <span className={`${selectedPersona.text} mr-2 text-lg leading-tight`}>•</span>
            <span className="text-[color:var(--text-primary)] dark:text-gray-200 flex-1 text-sm leading-relaxed">{renderedContent}</span>
          </div>
        );
      }
      
      return <p key={index} className="text-[color:var(--text-primary)] dark:text-gray-200 leading-relaxed text-sm mb-2">{renderedContent}</p>;
    });
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 px-4">
      <div className="bg-[color:var(--bg-primary)] dark:bg-gray-800 w-full max-w-2xl h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[color:var(--border-primary)] dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`${selectedPersona.bgLight} dark:bg-gray-700 p-2.5 rounded-xl`}>
              <Bot className={`w-6 h-6 ${selectedPersona.text}`} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-[color:var(--text-primary)] dark:text-white">Bot Chuyên Gia</h3>
              <p className="text-sm text-[color:var(--text-secondary)] dark:text-gray-400">Hỏi đáp theo chủ đề chuyên biệt</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Đóng"
            title="Đóng"
            onClick={onClose}
            className="p-2 hover:bg-[color:var(--bg-secondary)] dark:hover:bg-gray-700 rounded-full transition-colors text-[color:var(--text-secondary)]"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Persona Selector */}
        <div className="p-3 border-b border-[color:var(--border-primary)] dark:border-gray-700 shrink-0 overflow-x-auto no-scrollbar">
          <div className="flex gap-2 min-w-max px-1">
            {PERSONAS.map(p => {
              const isSelected = selectedPersona.id === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedPersona(p);
                    setError(null);
                  }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full border transition-all ${
                    isSelected 
                      ? `${p.color} ${p.border} text-white shadow-md shadow-${p.color.split('-')[1]}-500/30` 
                      : `bg-[color:var(--bg-primary)] dark:bg-gray-800 border-[color:var(--border-primary)] dark:border-gray-600 text-[color:var(--text-secondary)] dark:text-gray-300 hover:bg-[color:var(--bg-hover)] dark:hover:bg-gray-700`
                  }`}
                >
                  <Bot className="w-4 h-4" />
                  <span className={`text-sm ${isSelected ? 'font-bold' : 'font-medium'}`}>{p.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Chat Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 dark:bg-gray-900/50">
          {/* Intro Message */}
          <div className="flex gap-3 max-w-[85%]">
            <div className={`${selectedPersona.color} w-8 h-8 rounded-full flex items-center justify-center shrink-0`}>
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="bg-[color:var(--bg-primary)] dark:bg-gray-800 p-3 rounded-2xl rounded-tl-sm border border-[color:var(--border-primary)] dark:border-gray-700 shadow-sm">
              <p className="text-[color:var(--text-primary)] dark:text-gray-200 text-sm leading-relaxed">
                Xin chào! Tôi là Bot chuyên gia về <strong className={selectedPersona.text}>{selectedPersona.name}</strong>. Hãy đặt câu hỏi cho tôi!
              </p>
            </div>
          </div>

          {/* History Messages */}
          {(history[selectedPersona.id] || []).map((msg, index) => {
            if (msg.role === 'user') {
              return (
                <div key={index} className="flex justify-end">
                  <div className="bg-blue-600 text-white p-3 rounded-2xl rounded-tr-sm max-w-[85%] shadow-sm">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  </div>
                </div>
              );
            } else {
              return (
                <div key={index} className="flex gap-3 max-w-[85%]">
                  <div className={`${selectedPersona.color} w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1`}>
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div className="bg-[color:var(--bg-primary)] dark:bg-gray-800 p-4 rounded-2xl rounded-tl-sm border border-[color:var(--border-primary)] dark:border-gray-700 shadow-sm">
                    {renderFormattedText(msg.text)}
                  </div>
                </div>
              );
            }
          })}

          {/* Loading Indicator */}
          {loading && (
            <div className="flex gap-3 max-w-[85%]">
              <div className={`${selectedPersona.color} w-8 h-8 rounded-full flex items-center justify-center shrink-0`}>
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="bg-[color:var(--bg-primary)] dark:bg-gray-800 px-4 py-3 rounded-2xl rounded-tl-sm border border-[color:var(--border-primary)] dark:border-gray-700 shadow-sm flex items-center">
                <Loader2 className={`w-5 h-5 animate-spin ${selectedPersona.text}`} />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex gap-3 max-w-[85%]">
              <div className="bg-red-500 w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1">
                <AlertCircle className="w-5 h-5 text-white" />
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-2xl rounded-tl-sm border border-red-100 dark:border-red-800">
                <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-[color:var(--bg-primary)] dark:bg-gray-800 border-t border-[color:var(--border-primary)] dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-2 bg-[color:var(--bg-hover)] dark:bg-gray-900 border border-[color:var(--border-primary)] dark:border-gray-700 rounded-full pl-4 pr-1.5 py-1.5 focus-within:ring-2 focus-within:ring-blue-500/50 transition-all">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Hỏi chuyên gia ${selectedPersona.name}...`}
              className="flex-1 bg-transparent text-[color:var(--text-primary)] dark:text-white text-sm outline-none resize-none py-2 max-h-32 min-h-[40px]"
              rows={1}
            />
            <button
              onClick={handleAsk}
              disabled={loading || !inputValue.trim()}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shrink-0 ${
                !inputValue.trim() || loading
                  ? "bg-[color:var(--bg-tertiary)] dark:bg-gray-700 text-gray-400"
                  : `${selectedPersona.color} text-white hover:opacity-90 shadow-sm`
              }`}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 -ml-0.5" />}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
