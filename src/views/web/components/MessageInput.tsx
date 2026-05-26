import React, { useState, useRef, useCallback, useEffect } from 'react';
import RecordRTC, { StereoAudioRecorder } from 'recordrtc';
import { createPortal } from 'react-dom';
import { validateFileSize } from '@/shared/constants';

interface MessageInputProps {
    onSend: (text: string) => void;
    onSendFile?: (file: File) => void;
    onSendFiles?: (files: File[]) => void;
    onSendLike?: () => void;
    onTyping?: (isTyping: boolean) => void;
    replyingTo?: any;
    onCancelReply?: () => void;
    isSendingFile?: boolean;
    onCreatePoll?: () => void;
}

const EMOJI_LIST = [
    '😀','😂','🥹','😍','🥰','😎','🤩','😭','😡','🥺',
    '👍','👎','❤️','🔥','✅','🎉','💯','🙏','😴','🤔',
    '😅','😆','😋','🤗','😐','😑','🙄','😏','😬','🥲',
    '🤔','🤨','😐','😑','😶','🫥','😶‍🌫️','😏','😒','🙄',
    '😬','😮‍💨','🤥','🫨','😌','😔','😪','🤤','😴','😷',
    '🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','😵‍💫',
    '🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','🫤','😟',
    '🙁','☹️','😮','😯','😲','😳','🥺','🥹','😦','😧',
    '😨','😰','😥','😢','😭','😱','😖','😣','😞','😓',
    '😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀',
    '☠️','💩','🤡','👹','👺','👻','👽','👾','🤖','😺',
    '😸','😻','😼','😽','🙀','😿','😾','🙈','🙉','🙊'
];

const MessageInput: React.FC<MessageInputProps> = ({ 
    onSend, 
    onSendFile, 
    onSendFiles,
    onSendLike,
    onTyping,
    replyingTo,
    onCancelReply,
    isSendingFile,
    onCreatePoll
}) => {
    const [text, setText] = useState('');
    const [showEmoji, setShowEmoji] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);

    const mediaRecorderRef = useRef<RecordRTC | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const emojiPickerRef = useRef<HTMLDivElement>(null);

    const handleSend = () => {
        if (text.trim()) {
            onSend(text.trim());
            setText('');
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            if (onSendFiles) {
                onSendFiles(files);
            } else if (onSendFile) {
                onSendFile(files[0]);
            }
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const notifyTyping = useCallback((content: string) => {
        if (onTyping) {
            onTyping(content.length > 0);
        }
    }, [onTyping]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
                setShowEmoji(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const insertEmoji = (emoji: string) => {
        const el = textareaRef.current;
        if (!el) {
            setText(t => t + emoji);
            return;
        }
        const start = el.selectionStart ?? text.length;
        const end = el.selectionEnd ?? text.length;
        const newText = text.slice(0, start) + emoji + text.slice(end);
        setText(newText);
        notifyTyping(newText);
        // Restore cursor after emoji
        setTimeout(() => {
            el.focus();
            el.setSelectionRange(start + emoji.length, start + emoji.length);
        }, 0);
        setShowEmoji(false);
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            const recorder = new RecordRTC(stream, {
                type: 'audio',
                mimeType: 'audio/wav',
                recorderType: StereoAudioRecorder,
                numberOfAudioChannels: 1,
                desiredSampRate: 16000,
            });

            mediaRecorderRef.current = recorder;
            recorder.startRecording();
            
            setIsRecording(true);
            setRecordingTime(0);
            recordingIntervalRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("Không thể truy cập microphone. Vui lòng kiểm tra quyền truy cập.");
        }
    };

    const stopRecordingAndSend = () => {
        const recorder = mediaRecorderRef.current;
        if (recorder) {
            recorder.stopRecording(() => {
                const blob = recorder.getBlob();
                const audioFile = new File([blob], `voice_${Date.now()}.wav`, { type: 'audio/wav' });
                
                if (onSendFile) {
                    onSendFile(audioFile);
                }

                const internalRecorder = recorder.getInternalRecorder() as any;
                if (internalRecorder && internalRecorder.stream) {
                    internalRecorder.stream.getTracks().forEach((t: any) => t.stop());
                }
                
                setIsRecording(false);
                setRecordingTime(0);
                if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
            });
        }
    };

    const cancelRecording = () => {
        const recorder = mediaRecorderRef.current;
        if (recorder) {
            recorder.destroy();
            mediaRecorderRef.current = null;
        }
        setIsRecording(false);
        setRecordingTime(0);
        if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    };

    return (
        <div className="border-t p-4" style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-primary)" }}>
            {replyingTo && (
                <div className="mb-2 flex items-center justify-between rounded-lg p-2 border-l-4 border-blue-500" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                    <div className="flex flex-col">
                        <span className="text-xs font-bold text-blue-600">Trả lời: {replyingTo.senderName}</span>
                        <span className="text-sm text-gray-600 truncate max-w-md">
                            {replyingTo.type === 'VOICE' ? 'Tin nhắn thoại' : replyingTo.content || '[Tin nhắn]'}
                        </span>
                    </div>
                    <button onClick={onCancelReply} className="p-1 hover:bg-gray-200 rounded-full">
                        <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            )}

            <div className="flex items-end gap-2">
                {!isRecording && (
                    <div className="flex gap-1 mb-1">
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors"
                            title="Gửi file/ảnh"
                        >
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                        </button>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileSelect} 
                            className="hidden" 
                            multiple 
                        />
                        
                        <button 
                            onClick={onCreatePoll}
                            className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors"
                            title="Tạo bình chọn"
                        >
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        </button>
                    </div>
                )}

                <div className="relative flex-1">
                    {isRecording ? (
                        <div className="flex items-center justify-between bg-blue-50 rounded-2xl px-4 h-[42px] border border-blue-100">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                <span className="text-sm font-medium text-blue-700 tabular-nums">
                                    Đang ghi âm: {formatTime(recordingTime)}
                                </span>
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={cancelRecording}
                                    className="px-3 py-1 text-sm font-semibold text-gray-500 hover:text-red-500 transition-colors"
                                >
                                    Hủy
                                </button>
                                <button 
                                    onClick={stopRecordingAndSend}
                                    className="px-4 py-1 bg-blue-600 text-white text-sm font-bold rounded-full hover:bg-blue-700 transition-all shadow-sm"
                                >
                                    Gửi ngay
                                </button>
                            </div>
                        </div>
                    ) : (
                        <textarea
                            ref={textareaRef}
                            value={text}
                            onChange={(e) => {
                                setText(e.target.value);
                                notifyTyping(e.target.value);
                            }}
                            onKeyDown={handleKeyDown}
                            placeholder="Nhập tin nhắn..."
                            rows={1}
                            className="w-full resize-none rounded-2xl px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 min-h-[42px] max-h-32"
                            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                        />
                    )}
                </div>

                {!isRecording && (
                    <div className="flex gap-1 mb-1">
                        <div className="relative">
                            <button 
                                onClick={() => setShowEmoji(!showEmoji)}
                                className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors"
                            >
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </button>
                            
                            {showEmoji && (
                                <div 
                                    ref={emojiPickerRef}
                                    className="absolute bottom-full right-0 mb-2 grid grid-cols-8 gap-1 rounded-xl border p-2 shadow-2xl z-50 w-64 max-h-48 overflow-y-auto scrollbar-hide" style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-primary)" }}
                                >
                                    {EMOJI_LIST.map((emoji, i) => (
                                        <button 
                                            key={i} 
                                            onClick={() => insertEmoji(emoji)}
                                            className="p-1.5 hover:bg-gray-100 rounded text-xl transition-colors"
                                        >
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {!text.trim() ? (
                            <div className="flex gap-1">
                                <button 
                                    onClick={startRecording}
                                    className="p-2 hover:bg-red-50 rounded-full text-gray-600 hover:text-red-500 transition-colors"
                                    title="Ghi âm"
                                >
                                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                    </svg>
                                </button>
                                <button 
                                    onClick={onSendLike}
                                    className="p-2 hover:bg-gray-100 rounded-full transition-colors text-2xl leading-none"
                                    title="Gửi icon Like"
                                >
                                    👍
                                </button>
                            </div>
                        ) : (
                            <button 
                                onClick={handleSend}
                                disabled={!text.trim()}
                                className="p-2 rounded-full text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                            >
                                <svg className="h-6 w-6 fill-current" viewBox="0 0 24 24">
                                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                                </svg>
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MessageInput;
