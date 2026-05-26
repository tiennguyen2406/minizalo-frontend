import React, { useState } from 'react';
import { pollService } from '@/shared/services/pollService';

interface CreatePollModalProps {
    roomId: string;
    onClose: () => void;
    onSuccess?: () => void;
}

const CreatePollModal: React.FC<CreatePollModalProps> = ({ roomId, onClose, onSuccess }) => {
    const [question, setQuestion] = useState('');
    const [options, setOptions] = useState<string[]>(['', '']);
    const [allowMultipleChoices, setAllowMultipleChoices] = useState(false);
    const [allowAddOptions, setAllowAddOptions] = useState(true);
    const [loading, setLoading] = useState(false);

    const handleAddOption = () => {
        setOptions([...options, '']);
    };

    const handleOptionChange = (idx: number, val: string) => {
        const newOptions = [...options];
        newOptions[idx] = val;
        setOptions(newOptions);
    };

    const handleRemoveOption = (idx: number) => {
        if (options.length <= 2) return;
        const newOptions = [...options];
        newOptions.splice(idx, 1);
        setOptions(newOptions);
    };

    const handleCreate = async () => {
        const cleanedQuestion = question.trim();
        const cleanedOptions = options.map(o => o.trim()).filter(Boolean);

        if (!cleanedQuestion) {
            alert('Vui lòng nhập câu hỏi khảo sát');
            return;
        }
        if (cleanedOptions.length < 2) {
            alert('Vui lòng nhập ít nhất 2 lựa chọn');
            return;
        }

        setLoading(true);
        try {
            await pollService.createPoll({
                roomId,
                question: cleanedQuestion,
                options: cleanedOptions,
                allowMultipleChoices,
                allowAddOptions,
            });
            onSuccess?.();
            onClose();
        } catch (error) {
            console.error('Lỗi khi tạo bình chọn:', error);
            alert('Đã xảy ra lỗi khi tạo bình chọn. Bạn có quyền tạo không?');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={onClose}>
            <div 
                className="bg-[color:var(--bg-primary)] rounded-xl shadow-xl w-[400px] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-4 py-3 border-b border-[color:var(--border-primary)] flex justify-between items-center bg-[#f5f5f5]">
                    <h3 className="font-semibold text-[color:var(--text-primary)]">Tạo bình chọn</h3>
                    <button onClick={onClose} className="p-1 text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-tertiary)] rounded-full transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                
                <div className="p-4 flex-1 overflow-y-auto max-h-[60vh] styled-scrollbar text-sm">
                    <div className="mb-4">
                        <input 
                            placeholder="Nhập câu hỏi khám sát" 
                            className="w-full text-base font-medium border-b border-[color:var(--border-secondary)] focus:border-blue-500 pb-2 focus:outline-none placeholder-gray-400 text-[color:var(--text-primary)]"
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            autoFocus
                        />
                    </div>
                    
                    <div className="space-y-3 mb-4">
                        {options.map((opt, idx) => (
                            <div key={idx} className="flex flex-col relative">
                                <div className="flex items-center group border border-[color:var(--border-primary)] rounded-lg focus-within:border-blue-500 bg-[color:var(--bg-primary)]">
                                    <input 
                                        placeholder={`Lựa chọn ${idx + 1}`}
                                        className="flex-1 w-full p-3 font-normal text-[color:var(--text-secondary)] outline-none rounded-lg bg-transparent"
                                        value={opt}
                                        onChange={(e) => handleOptionChange(idx, e.target.value)}
                                    />
                                    {options.length > 2 && (
                                        <button 
                                            className="px-3 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => handleRemoveOption(idx)}
                                        >
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                        
                        <button 
                            className="text-blue-500 font-medium py-1 px-1 hover:underline text-sm"
                            onClick={handleAddOption}
                        >
                            + Thêm lựa chọn
                        </button>
                    </div>

                    <div className="space-y-3 pt-3 border-t border-[color:var(--border-primary)] mt-2">
                        <h4 className="text-[color:var(--text-primary)] font-semibold mb-2">Cài đặt</h4>
                        <div className="flex items-center justify-between">
                            <span className="text-[color:var(--text-secondary)]">Chọn nhiều phương án</span>
                            <input 
                                type="checkbox" 
                                checked={allowMultipleChoices}
                                onChange={(e) => setAllowMultipleChoices(e.target.checked)}
                                className="w-4 h-4 accent-blue-600 cursor-pointer"
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[color:var(--text-secondary)]">Cho phép thêm phương án</span>
                            <input 
                                type="checkbox" 
                                checked={allowAddOptions}
                                onChange={(e) => setAllowAddOptions(e.target.checked)}
                                className="w-4 h-4 accent-blue-600 cursor-pointer"
                            />
                        </div>
                    </div>
                </div>

                <div className="px-4 py-3 bg-[color:var(--bg-primary)] border-t border-[color:var(--border-primary)] flex justify-end gap-3">
                    <button 
                        className="px-5 py-2 text-sm text-[color:var(--text-secondary)] bg-[color:var(--bg-secondary)] rounded-lg hover:bg-[color:var(--bg-tertiary)] transition-colors font-medium"
                        onClick={onClose}
                    >
                        Hủy
                    </button>
                    <button 
                        className={`px-5 py-2 text-sm text-white rounded-lg font-medium transition-colors ${
                            !question.trim() || options.filter(o => o.trim()).length < 2 || loading
                                ? 'bg-blue-300 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                        onClick={handleCreate}
                        disabled={!question.trim() || options.filter(o => o.trim()).length < 2 || loading}
                    >
                        {loading ? 'Đang tạo...' : 'Tạo bình chọn'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreatePollModal;
