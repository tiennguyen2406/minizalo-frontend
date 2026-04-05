import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface MessageInputProps {
    onSend: (text: string) => void;
    onSendFile?: (file: File) => void;
    onSendFiles?: (files: File[]) => void;
    onSendLike?: () => void;
    onTyping?: (isTyping: boolean) => void;
    replyingTo?: any;
    onCancelReply?: () => void;
    isSendingFile?: boolean;
}

const EMOJI_LIST = [
    '😀','😂','🥹','😍','🥰','😎','🤩','😭','😡','🥺',
    '👍','👎','❤️','🔥','✅','🎉','💯','🙏','😴','🤔',
    '😅','😆','😋','🤗','😐','😑','🙄','😏','😬','🥲',
    '🫡','🫠','🤣','😇','🥳','😤','😩','😫','😓','😒',
    '👋','🤝','👏','🙌','💪','👀','💀','🫶','❤️‍🔥','💔',
];

const MAX_ROWS = 5;
const LINE_HEIGHT = 22; // px

const MessageInput: React.FC<MessageInputProps> = ({
    onSend,
    onSendFile,
    onSendFiles,
    onSendLike,
    onTyping,
    replyingTo,
    onCancelReply,
    isSendingFile,
}) => {
    const [text, setText] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);
    const [showEmoji, setShowEmoji] = useState(false);
    const [emojiPos, setEmojiPos] = useState<{ bottom: number; left: number } | null>(null);
    const [failedSend, setFailedSend] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const emojiRef = useRef<HTMLDivElement>(null);
    const emojiBtnRef = useRef<HTMLButtonElement>(null);
    const emojiPopupRef = useRef<HTMLDivElement>(null);

    // ── Auto-resize textarea ───────────────────────────────────────────────────
    const resizeTextarea = useCallback(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        const maxH = MAX_ROWS * LINE_HEIGHT + 16; // padding
        el.style.height = Math.min(el.scrollHeight, maxH) + 'px';
        el.style.overflowY = el.scrollHeight > maxH ? 'auto' : 'hidden';
    }, []);

    useEffect(() => {
        resizeTextarea();
    }, [text, resizeTextarea]);

    // ── Close emoji picker on outside click ───────────────────────────────────
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            const inBtn = emojiRef.current?.contains(target);
            const inPopup = emojiPopupRef.current?.contains(target);
            if (!inBtn && !inPopup) {
                setShowEmoji(false);
            }
        };
        if (showEmoji) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showEmoji]);

    // ── Typing indicator with debounce ────────────────────────────────────────
    const notifyTyping = useCallback((val: string) => {
        if (!onTyping) return;
        onTyping(val.length > 0);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        if (val.length > 0) {
            typingTimeoutRef.current = setTimeout(() => onTyping(false), 3000);
        }
    }, [onTyping]);

    // ── Send ──────────────────────────────────────────────────────────────────
    const handleSend = useCallback(async () => {
        // Multi-file send
        if (selectedFiles.length > 0 && onSendFiles) {
            try {
                setFailedSend(false);
                onSendFiles(selectedFiles);
                clearFilePreview();
            } catch {
                setFailedSend(true);
            }
            return;
        }
        if (selectedFile && onSendFile) {
            try {
                setFailedSend(false);
                onSendFile(selectedFile);
                clearFilePreview();
            } catch {
                setFailedSend(true);
            }
            return;
        }
        const trimmed = text.trim();
        if (!trimmed) return;
        try {
            setFailedSend(false);
            onSend(trimmed);
            setText('');
            if (onTyping) onTyping(false);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            // reset height
            if (textareaRef.current) textareaRef.current.style.height = 'auto';
        } catch {
            setFailedSend(true);
        }
    }, [text, selectedFile, selectedFiles, onSend, onSendFile, onSendFiles, onTyping]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setText(val);
        notifyTyping(val);
        setFailedSend(false);
    };

    // ── Keyboard: Enter = send, Shift+Enter = newline ─────────────────────────
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // ── File select ───────────────────────────────────────────────────────────
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setSelectedFile(file);
        setSelectedFiles([]);
        previewUrls.forEach(u => URL.revokeObjectURL(u));
        setPreviewUrls([]);
        if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
            setPreviewUrl(URL.createObjectURL(file));
        } else {
            setPreviewUrl(null);
        }
        e.target.value = '';
    };

    // ── Multi-image select ───────────────────────────────────────────────────
    const handleMultiImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        const fileArr = Array.from(files);
        if (fileArr.length === 1) {
            // Single file: use normal flow
            handleFileSelect(e);
            return;
        }
        // Multi files
        clearFilePreview();
        setSelectedFiles(fileArr);
        const urls = fileArr
            .filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'))
            .map(f => URL.createObjectURL(f));
        setPreviewUrls(urls);
        e.target.value = '';
    };

    // ── Paste image from clipboard ────────────────────────────────────────────
    const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const items = Array.from(e.clipboardData.items);
        const imageItem = items.find(item => item.type.startsWith('image/'));
        if (!imageItem) return;
        e.preventDefault();
        const file = imageItem.getAsFile();
        if (!file) return;
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
    }, []);

    const clearFilePreview = () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrls.forEach(u => URL.revokeObjectURL(u));
        setSelectedFile(null);
        setSelectedFiles([]);
        setPreviewUrl(null);
        setPreviewUrls([]);
    };

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

    const hasContent = text.trim().length > 0 || !!selectedFile || selectedFiles.length > 0;

    return (
        <div style={{
            backgroundColor: 'var(--bg-primary)',
            borderTop: '1px solid var(--border-primary)',
            transition: 'background-color 0.3s ease',
            display: 'flex',
            flexDirection: 'column',
        }}>
            {/* ── Reply preview ── */}
            {replyingTo && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: 'var(--bg-secondary, #f8f9fa)',
                    borderBottom: '1px solid var(--border-primary)',
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', fontSize: 13, borderLeft: '3px solid #0068ff', paddingLeft: 8 }}>
                        <span style={{ fontWeight: 600, color: '#0068ff', marginBottom: 2 }}>
                            Trả lời {replyingTo.senderName || 'Người dùng'}
                        </span>
                        <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>
                            {replyingTo.type === 'IMAGE' ? '🖼️ Ảnh'
                                : replyingTo.type === 'VIDEO' ? '🎥 Video'
                                : (replyingTo.type === 'FILE' || replyingTo.type === 'DOCUMENT') ? `📎 ${replyingTo.fileName || 'Tệp đính kèm'}`
                                : replyingTo.content || '[Tin nhắn]'}
                        </span>
                    </div>
                    {onCancelReply && (
                        <button onClick={onCancelReply} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-muted)', display: 'flex' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    )}
                </div>
            )}

            {/* ── Multi-image preview ── */}
            {selectedFiles.length > 1 && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    background: '#eff6ff',
                    borderBottom: '1px solid #bfdbfe',
                    overflowX: 'auto',
                }}>
                    <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                        {selectedFiles.map((f, i) => (
                            <div key={i} style={{ position: 'relative', width: 56, height: 56, borderRadius: 8, overflow: 'hidden', flexShrink: 0, border: '1px solid #dbeafe' }}>
                                {f.type.startsWith('image/') ? (
                                    <img src={previewUrls[i] || ''} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ width: '100%', height: '100%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5">
                                            <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0, marginLeft: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#1e3a5f' }}>{selectedFiles.length} ảnh</span>
                        <button onClick={clearFilePreview} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#94a3b8', display: 'flex' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            {/* ── File / Image preview (single) ── */}
            {selectedFile && selectedFiles.length === 0 && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '8px 12px',
                    background: '#eff6ff',
                    borderBottom: '1px solid #bfdbfe',
                }}>
                    {previewUrl && selectedFile.type.startsWith('image/') && (
                        <img
                            src={previewUrl}
                            alt="preview"
                            style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid #dbeafe' }}
                        />
                    )}
                    {previewUrl && selectedFile.type.startsWith('video/') && (
                        <div style={{ position: 'relative', width: 64, height: 64, borderRadius: 8, overflow: 'hidden', background: '#000' }}>
                            <video src={previewUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)' }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
                            </div>
                        </div>
                    )}
                    {!previewUrl && (
                        <div style={{ width: 48, height: 48, background: '#dbeafe', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round">
                                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#1e3a5f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {selectedFile.name}
                        </p>
                        <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{formatFileSize(selectedFile.size)}</p>
                    </div>
                    <button onClick={clearFilePreview} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#94a3b8', display: 'flex' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
            )}

            {/* ── Hidden file inputs ── */}
            <input ref={imageInputRef} type="file" accept="image/*,video/*" multiple style={{ display: 'none' }} onChange={handleMultiImageSelect} />
            <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileSelect} />

            {/* ── Toolbar ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '6px 8px 2px' }}>
                {/* Emoji */}
                <div style={{ position: 'relative' }} ref={emojiRef}>
                    <button
                        ref={emojiBtnRef}
                        onClick={() => {
                            setShowEmoji(v => {
                                if (!v && emojiBtnRef.current) {
                                    const rect = emojiBtnRef.current.getBoundingClientRect();
                                    setEmojiPos({ bottom: window.innerHeight - rect.top + 6, left: rect.left });
                                }
                                return !v;
                            });
                        }}
                        title="Biểu cảm"
                        style={toolbarBtnStyle(showEmoji)}
                    >
                        <span style={{ fontSize: 20, lineHeight: 1 }}>😊</span>
                    </button>

                    {showEmoji && emojiPos && createPortal(
                        <div ref={emojiPopupRef} style={{
                            position: 'fixed',
                            bottom: emojiPos.bottom,
                            left: emojiPos.left,
                            zIndex: 9999,
                            background: '#fff',
                            border: '1px solid #e5e7eb',
                            borderRadius: 12,
                            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                            padding: 10,
                            display: 'grid',
                            gridTemplateColumns: 'repeat(10, 1fr)',
                            gap: 2,
                            width: 280,
                        }}>
                            {EMOJI_LIST.map(em => (
                                <button
                                    key={em}
                                    onClick={() => insertEmoji(em)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontSize: 20,
                                        padding: '3px 2px',
                                        borderRadius: 6,
                                        lineHeight: 1,
                                        transition: 'background 0.1s',
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                                >
                                    {em}
                                </button>
                            ))}
                        </div>,
                        document.body
                    )}
                </div>

                {/* Image / Video */}
                <button
                    onClick={() => imageInputRef.current?.click()}
                    disabled={isSendingFile}
                    title="Gửi ảnh / video"
                    style={toolbarBtnStyle(false)}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                </button>

                {/* File attach */}
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSendingFile}
                    title="Đính kèm tệp"
                    style={toolbarBtnStyle(false)}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                </button>
            </div>

            {/* ── Input row ── */}
            <div style={{ display: 'flex', alignItems: 'flex-end', padding: '2px 8px 10px', gap: 6 }}>
                <div style={{ flex: 1, position: 'relative' }}>
                    <textarea
                        ref={textareaRef}
                        value={text}
                        onChange={handleChange}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                        disabled={!!selectedFile}
                        placeholder={selectedFile ? 'Nhấn gửi để gửi tệp...' : 'Nhập tin nhắn... (Shift+Enter để xuống dòng)'}
                        rows={1}
                        style={{
                            width: '100%',
                            resize: 'none',
                            border: '1.5px solid #e5e7eb',
                            borderRadius: 20,
                            padding: '8px 14px',
                            fontSize: 14,
                            lineHeight: `${LINE_HEIGHT}px`,
                            background: 'var(--bg-secondary, #f3f4f6)',
                            color: 'var(--text-primary)',
                            outline: 'none',
                            transition: 'border-color 0.15s',
                            boxSizing: 'border-box',
                            fontFamily: 'inherit',
                            overflowY: 'hidden',
                        }}
                        onFocus={e => (e.target.style.borderColor = '#0068ff')}
                        onBlur={e => (e.target.style.borderColor = '#e5e7eb')}
                    />
                </div>

                {/* Send / Like / Error */}
                {failedSend ? (
                    <button
                        onClick={handleSend}
                        title="Gửi lại"
                        style={{
                            width: 38, height: 38, borderRadius: '50%',
                            background: '#fef2f2', border: '1px solid #fca5a5',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0, color: '#ef4444',
                        }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                    </button>
                ) : hasContent ? (
                    <button
                        onClick={handleSend}
                        disabled={isSendingFile}
                        title="Gửi"
                        style={{
                            width: 38, height: 38, borderRadius: '50%',
                            background: isSendingFile ? '#93c5fd' : '#0068ff',
                            border: 'none', cursor: isSendingFile ? 'wait' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0, transition: 'background 0.15s, transform 0.1s',
                        }}
                        onMouseEnter={e => !isSendingFile && (e.currentTarget.style.transform = 'scale(1.08)')}
                        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                    >
                        {isSendingFile ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="white" style={{ animation: 'spin 1s linear infinite' }}>
                                <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                            </svg>
                        ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                                <path d="M22 2L11 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                            </svg>
                        )}
                    </button>
                ) : (
                    <button
                        onClick={() => onSendLike?.()}
                        title="Gửi Like"
                        style={{
                            width: 38, height: 38, borderRadius: '50%', background: 'none', border: 'none',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0, fontSize: 22, lineHeight: 1,
                            transition: 'transform 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.2)')}
                        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                    >
                        👍
                    </button>
                )}
            </div>
        </div>
    );
};

function toolbarBtnStyle(active: boolean): React.CSSProperties {
    return {
        width: 34, height: 34, borderRadius: '50%', background: active ? '#eff6ff' : 'none',
        border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
        justifyContent: 'center', color: active ? '#0068ff' : '#6b7280',
        transition: 'background 0.12s, color 0.12s',
        flexShrink: 0,
    };
}

export default MessageInput;
