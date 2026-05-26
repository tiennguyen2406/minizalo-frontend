import React from 'react';
import { Sparkles, Bot, Languages, PenLine, Calendar, X } from 'lucide-react';

interface AiOptionsModalProps {
  onClose: () => void;
  onSelectSummarize: () => void;
  onSelectPersona: () => void;
  onSelectTask: (mode: "translate" | "improve" | "extract") => void;
}

export default function AiOptionsModal({
  onClose,
  onSelectSummarize,
  onSelectPersona,
  onSelectTask
}: AiOptionsModalProps) {
  
  const handleSelect = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className="bg-yellow-100 dark:bg-yellow-500/20 p-2 rounded-lg">
              <Sparkles className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white">AI Gemini</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Trợ lý thông minh</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Đóng"
            title="Đóng"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3">
          {/* Option 1: Summarize */}
          <button
            onClick={() => handleSelect(onSelectSummarize)}
            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors group text-left"
          >
            <div className="bg-blue-100 dark:bg-blue-500/20 p-2 rounded-lg group-hover:bg-blue-500 transition-colors">
              <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400 group-hover:text-white transition-colors" />
            </div>
            <div>
              <div className="font-semibold text-gray-900 dark:text-white text-sm">Tóm tắt cuộc trò chuyện</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Nắm bắt nội dung nhanh chóng</div>
            </div>
          </button>

          {/* Option 2: Persona Bot */}
          <button
            onClick={() => handleSelect(onSelectPersona)}
            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors group text-left mt-1"
          >
            <div className="bg-purple-100 dark:bg-purple-500/20 p-2 rounded-lg group-hover:bg-purple-500 transition-colors">
              <Bot className="w-5 h-5 text-purple-600 dark:text-purple-400 group-hover:text-white transition-colors" />
            </div>
            <div>
              <div className="font-semibold text-gray-900 dark:text-white text-sm">Gọi Bot chuyên gia</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Hỏi đáp theo chủ đề riêng biệt</div>
            </div>
          </button>

          {/* Option 3: Translate */}
          <button
            onClick={() => handleSelect(() => onSelectTask("translate"))}
            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors group text-left mt-1"
          >
            <div className="bg-green-100 dark:bg-green-500/20 p-2 rounded-lg group-hover:bg-green-500 transition-colors">
              <Languages className="w-5 h-5 text-green-600 dark:text-green-400 group-hover:text-white transition-colors" />
            </div>
            <div>
              <div className="font-semibold text-gray-900 dark:text-white text-sm">Dịch thuật tự động</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Dịch tin nhắn sang ngôn ngữ của bạn</div>
            </div>
          </button>

          {/* Option 4: Improve */}
          <button
            onClick={() => handleSelect(() => onSelectTask("improve"))}
            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-orange-50 dark:hover:bg-orange-900/30 transition-colors group text-left mt-1"
          >
            <div className="bg-orange-100 dark:bg-orange-500/20 p-2 rounded-lg group-hover:bg-orange-500 transition-colors">
              <PenLine className="w-5 h-5 text-orange-600 dark:text-orange-400 group-hover:text-white transition-colors" />
            </div>
            <div>
              <div className="font-semibold text-gray-900 dark:text-white text-sm">Cải thiện văn phong</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Sửa lỗi chính tả, làm câu từ chuyên nghiệp</div>
            </div>
          </button>

          {/* Option 5: Extract */}
          <button
            onClick={() => handleSelect(() => onSelectTask("extract"))}
            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors group text-left mt-1"
          >
            <div className="bg-red-100 dark:bg-red-500/20 p-2 rounded-lg group-hover:bg-red-500 transition-colors">
              <Calendar className="w-5 h-5 text-red-600 dark:text-red-400 group-hover:text-white transition-colors" />
            </div>
            <div>
              <div className="font-semibold text-gray-900 dark:text-white text-sm">Trích xuất lịch hẹn</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Tìm kiếm sự kiện, ngày tháng trong chat</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
