import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Message, User } from '@/shared/types';
import clsx from 'clsx';
import LazyImage from './LazyImage';
import LinkPreviewCard from './LinkPreviewCard';
import PollBubble from './PollBubble';
import { extractFirstHttpUrl, linkifyText } from '@/shared/utils/linkify';
import { getImageAttachmentUrls, getVideoAttachmentUrls, getAudioAttachmentUrls } from '@/shared/utils/messageAttachments';
import { getImageUrl } from '@/shared/utils/mediaUtils';
import { useCallStore } from '@/shared/store/useCallStore';
import { Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed } from 'lucide-react';
interface MessageBubbleProps {
    message: Message;
    isMine: boolean;
    showAvatar?: boolean;
    isFirstInGroup?: boolean;
    isLastInGroup?: boolean;
    senderName?: string;
    senderAvatar?: string;
    marginBottom?: string;
    onRecall?: (messageId: string | string[]) => void;
    onReact?: (messageId: string, emoji: string) => void;
    onReply?: (message: Message) => void;
    onTogglePin?: (messageId: string, currentPinStatus: boolean) => void;
    onRemoveAllReactions?: (messageId: string) => void;
    onDeleteForMe?: (messageId: string) => void;
    onForward?: (message: Message) => void;
    onScrollToMessage?: (messageId: string) => void;
    onImageLoad?: () => void;
    repliedMessage?: Message;
    isLatestMessage?: boolean;
    participants?: User[];
    /** Mở gallery cuộn toàn cuộc trò chuyện (ảnh + video), truyền URL đã resolve host. */
    onOpenChatGallery?: (resolvedMediaUrl: string) => void;
}

/** Tải file về thư mục Tải xuống mặc định của trình duyệt (không chọn đường dẫn). */
async function downloadFileToDeviceCore(url: string, suggestedName: string): Promise<void> {
    const safe = suggestedName.replace(/[<>:"/\\|?*]/g, '_') || 'download';
    try {
        const res = await fetch(url, { mode: 'cors' });
        if (!res.ok) throw new Error('fetch failed');
        const blob = await res.blob();
        const href = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = href;
        a.download = safe;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(href);
    } catch {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.download = safe;
        document.body.appendChild(a);
        a.click();
        a.remove();
    }
}

const VoicePlayer: React.FC<{ url: string }> = ({ url }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        const setAudioData = () => {
            if (audio.duration && audio.duration !== Infinity) {
                setDuration(audio.duration);
            }
        };
        const setAudioTime = () => setCurrentTime(audio.currentTime);
        const onEnd = () => { setIsPlaying(false); setCurrentTime(0); };
        
        audio.addEventListener('loadedmetadata', setAudioData);
        audio.addEventListener('timeupdate', setAudioTime);
        audio.addEventListener('ended', onEnd);
        audio.addEventListener('pause', () => setIsPlaying(false));
        audio.addEventListener('play', () => setIsPlaying(true));

        return () => {
            audio.removeEventListener('loadedmetadata', setAudioData);
            audio.removeEventListener('timeupdate', setAudioTime);
            audio.removeEventListener('ended', onEnd);
            audio.removeEventListener('pause', () => setIsPlaying(false));
            audio.removeEventListener('play', () => setIsPlaying(true));
        };
    }, []);

    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) audioRef.current.pause();
            else audioRef.current.play();
        }
    };

    const formatTime = (time: number) => {
        if (!time || isNaN(time)) return "00:00";
        const m = Math.floor(time / 60);
        const s = Math.floor(time % 60);
        return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const displayTime = formatTime(isPlaying || currentTime > 0 ? currentTime : duration);

    return (
        <div className="flex items-center gap-2 min-w-[120px] py-0.5">
            <audio ref={audioRef} src={url} preload="metadata" />
            <button 
                onClick={togglePlay} 
                className="w-8 h-8 rounded-full bg-[#0068ff] text-white flex items-center justify-center shrink-0 hover:bg-[#0052cc] transition-colors"
                title={isPlaying ? "Tạm dừng" : "Phát"}
            >
                {isPlaying ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="4" width="4" height="16" />
                        <rect x="14" y="4" width="4" height="16" />
                    </svg>
                ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5">
                        <path d="M5 3l14 9-14 9V3z" />
                    </svg>
                )}
            </button>
            <div className="flex gap-0.5 items-end h-5 w-8 ml-1">
                {[...Array(4)].map((_, i) => (
                    <div 
                        key={i} 
                        className={clsx("w-[3px] rounded-full bg-[#0068ff]", isPlaying ? "animate-pulse" : "")} 
                        style={{ 
                            height: isPlaying ? `${30 + Math.random() * 70}%` : `${30 + (i % 2) * 20}%`, 
                            animationDelay: `${i * 0.15}s`,
                            transition: 'height 0.2s'
                        }} 
                    />
                ))}
            </div>
            <span className="text-sm font-medium text-[color:var(--text-secondary)] ml-1 min-w-[40px] tabular-nums">{displayTime}</span>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    let fileName = 'voice_message.mp3';
                    try {
                        const path = new URL(url).pathname;
                        const last = path.substring(path.lastIndexOf('/') + 1);
                        if (last && last.includes('.')) {
                            fileName = last;
                        }
                    } catch {}
                    downloadFileToDeviceCore(url, fileName);
                }}
                className="w-7 h-7 rounded-full bg-[color:var(--bg-hover)] text-[color:var(--text-secondary)] flex items-center justify-center shrink-0 hover:bg-gray-200 transition-colors ml-2"
                title="Tải tin nhắn thoại về máy"
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
            </button>
        </div>
    );
};

const StoryReplyCard: React.FC<{
    content: string;
    isMine: boolean;
    time: string;
}> = ({ content, isMine, time }) => {
    let data: {
        type?: string;
        mediaUrl?: string | null;
        thumbnailUri?: string | null;
        mediaType?: string;
        postedAt?: string;
        storyId?: string;
        authorId?: string;
        replyText?: string;
        imageUrl?: string | null;
        image?: string | null;
    } = {};
    try { data = JSON.parse(content); } catch { return null; }
    if (data.type !== "STORY_QUOTE") return null;

    const thumbSrcRaw = data.thumbnailUri || data.mediaUrl || data.imageUrl || (data as any).image;
    const thumbSrc = getImageUrl(thumbSrcRaw || '');
    const isVideo = data.mediaType === "VIDEO" || (thumbSrcRaw && String(thumbSrcRaw).toLowerCase().endsWith(".mp4"));
    const cardTitle = isMine
        ? "Bạn đã gửi tin nhắn qua Khoảnh khắc"
        : "Tin nhắn gửi từ Khoảnh khắc của bạn";

    return (
        <div className={clsx(
            "flex flex-col w-[300px] max-w-full overflow-hidden rounded-xl border shadow-sm select-none",
            isMine ? "bg-[#0068ff] border-blue-400" : "bg-[color:var(--bg-primary)] border-[color:var(--border-primary)]"
        )}>
            {/* Story Card Header */}
            <div className={clsx(
                "flex items-center gap-3 m-2 mb-0 rounded-lg overflow-hidden relative",
                isMine ? "bg-[color:var(--bg-primary)]/10" : "bg-[color:var(--bg-tertiary)]"
            )}>
                {/* Accent Line */}
                <div className={clsx("w-[3.5px] self-stretch shrink-0 rounded-full", isMine ? "bg-[color:var(--bg-primary)]/80" : "bg-[#0068ff]")} />
                
                <div className="flex items-center gap-3 p-2 pl-0 flex-1 min-w-0">
                    <div className="w-16 h-16 shrink-0 overflow-hidden rounded bg-[color:var(--bg-tertiary)] relative">
                        {thumbSrcRaw ? (
                            <img src={thumbSrc} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-[color:var(--bg-secondary)] text-gray-400">
                               <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                               </svg>
                            </div>
                        )}
                        {isVideo && (
                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                <div className="w-7 h-7 rounded-full bg-black/40 flex items-center justify-center border border-white/50">
                                    <svg className="w-4 h-4 text-white fill-current ml-0.5" viewBox="0 0 24 24">
                                        <path d="M8 5v14l11-7z" />
                                    </svg>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className={clsx("text-[13px] font-bold leading-tight line-clamp-2", isMine ? "text-white" : "text-[color:var(--text-primary)]")}>
                            {cardTitle}
                        </p>
                        <p className={clsx("text-[11px] mt-1 line-clamp-1", isMine ? "text-white/70" : "text-[color:var(--text-secondary)]")}>
                            Khoảnh khắc đăng lúc {data.postedAt}
                        </p>
                    </div>
                </div>
            </div>

            {/* Divider & User Reply Text */}
            {data.replyText && (
                <div className="px-3 pt-2 pb-1">
                    <div className={clsx("h-[1px] mb-2", isMine ? "bg-[color:var(--bg-primary)]/10" : "bg-[color:var(--bg-secondary)]")} />
                    <p className={clsx("text-sm leading-relaxed break-words", isMine ? "text-white" : "text-[color:var(--text-primary)]")}>
                        {data.replyText}
                    </p>
                </div>
            )}

            {/* Time */}
            <div className="px-3 pb-2 pt-1 flex justify-end">
                <span className={clsx("text-[10px]", isMine ? "text-white/60" : "text-gray-400")}>
                    {time}
                </span>
            </div>
        </div>
    );
};

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "😡"];

function effectiveTypeForMessage(msg: Message): string {
    const imgs = getImageAttachmentUrls(msg);
    const vids = getVideoAttachmentUrls(msg);
    const audios = getAudioAttachmentUrls(msg);
    
    if (audios.length > 0 && imgs.length === 0 && vids.length === 0) return 'VOICE';
    if (imgs.length > 0 && vids.length === 0) return 'IMAGE';
    if (vids.length > 0 && imgs.length === 0) return 'VIDEO';
    if (imgs.length > 0 && vids.length > 0) return 'MEDIA';
    
    const attachment = msg.attachments?.[0];
    const fileUrl = msg.fileUrl || attachment?.url;
    let t: string = msg.type as string;
    
    if ((t === 'TEXT' || !t || t === 'VIDEO') && fileUrl && attachment) {
        const mime = (attachment.type || '').toLowerCase();
        if (mime.startsWith('audio')) t = 'VOICE';
        else if (mime.startsWith('image')) t = 'IMAGE';
        else if (mime.startsWith('video')) t = 'VIDEO';
        else t = 'FILE';
    }
    
    // Explicit check for VOICE and STORY_REPLY type
    if (msg.type === 'VOICE') return 'VOICE';
    if (msg.type === 'STORY_REPLY') return 'STORY_REPLY';
    
    return t;
}

function isGroupActionSystemText(text?: string | null): boolean {
    const t = String(text || '').trim();
    if (!t) return false;
    // Heuristic: các câu thông báo thao tác quản lý nhóm (để render như SYSTEM)
    return (
        /đã phong .* làm phó nhóm/i.test(t) ||
        /đã xóa quyền phó nhóm/i.test(t) ||
        /đã chặn .* khỏi nhóm/i.test(t) ||
        /đã thay đổi .* thành (bật|tắt)/i.test(t) ||
        /đã cập nhật: quyền .* (được bật|đã tắt)/i.test(t)
    );
}

function isPhoneLikeName(value?: string | null): boolean {
    const text = String(value || '').trim();
    return !!text && /^[+\d\s().-]{8,}$/.test(text);
}

function getSystemDisplayContent(message: Message): string {
    const content = String(message.content || '').trim();
    const actorName = !isPhoneLikeName(message.senderName) ? String(message.senderName || '').trim() : '';

    if (!content || !actorName) return content;

    const legacyUpdate = content.match(/^(.+?)\s+đã cập nhật:\s*(.+)$/i);
    if (legacyUpdate && isPhoneLikeName(legacyUpdate[1])) {
        const detail = legacyUpdate[2]
            .replace(/\s+được bật\.?$/i, ' thành bật.')
            .replace(/\s+đã tắt\.?$/i, ' thành tắt.');
        return `${actorName} đã thay đổi ${detail}`;
    }

    const changedByPhone = content.match(/^(.+?)\s+(đã thay đổi\s+.+)$/i);
    if (changedByPhone && isPhoneLikeName(changedByPhone[1])) {
        return `${actorName} ${changedByPhone[2]}`;
    }

    return content;
}

const MULTI_IMG_MAX = 4;

function multiImageGridStyle(count: number): React.CSSProperties {
    if (count === 1) return { display: 'grid', gridTemplateColumns: '1fr', gap: 2 };
    if (count === 2) return { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 };
    if (count === 3) return { display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'auto auto', gap: 2 };
    return { display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'auto auto', gap: 2 };
}

function multiImageCellStyle(count: number, index: number): React.CSSProperties {
    const base: React.CSSProperties = {
        width: '100%',
        objectFit: 'cover',
        cursor: 'pointer',
        borderRadius: 8,
    };
    if (count === 1) return { ...base, maxWidth: 280, maxHeight: 300 };
    if (count === 2) return { ...base, height: 140 };
    if (count === 3 && index === 0) return { ...base, height: 180, gridRow: '1 / 3' };
    if (count === 3) return { ...base, height: 88 };
    return { ...base, height: 120 };
}

/** Hiển thị thẻ file: màu preview + nhãn loại (PDF, Word, …) */
function getFilePresentation(fileName: string, mime?: string): {
    label: string;
    gradient: string;
    badgeClass: string;
    iconTint: string;
} {
    const ext = (fileName.split('.').pop() || '').toLowerCase();
    const m = (mime || '').toLowerCase();
    if (m.includes('pdf') || ext === 'pdf') {
        return {
            label: 'PDF',
            gradient: 'from-rose-50 via-red-50 to-orange-50',
            badgeClass: 'bg-[#ff453a] shadow-sm',
            iconTint: 'text-red-300/90',
        };
    }
    if (m.includes('word') || ext === 'doc' || ext === 'docx') {
        return {
            label: 'WORD',
            gradient: 'from-blue-50 via-indigo-50 to-slate-50',
            badgeClass: 'bg-[#007aff]',
            iconTint: 'text-blue-300/90',
        };
    }
    if (m.includes('sheet') || ext === 'xls' || ext === 'xlsx' || ext === 'csv') {
        return {
            label: 'XLS',
            gradient: 'from-emerald-50 via-green-50 to-teal-50',
            badgeClass: 'bg-[#34c759]',
            iconTint: 'text-emerald-300/90',
        };
    }
    if (m.includes('presentation') || ext === 'ppt' || ext === 'pptx') {
        return {
            label: 'PPTX',
            gradient: 'from-amber-50 via-orange-50 to-yellow-50',
            badgeClass: 'bg-[#ff9500]',
            iconTint: 'text-amber-300/90',
        };
    }
    if (m.includes('zip') || ext === 'zip' || ext === 'rar' || ext === '7z') {
        return {
            label: 'ZIP',
            gradient: 'from-violet-50 via-purple-50 to-fuchsia-50',
            badgeClass: 'bg-[#af52de]',
            iconTint: 'text-violet-300/90',
        };
    }
    if (m.startsWith('text/') || ext === 'txt' || ext === 'md' || ext === 'json') {
        return {
            label: 'TXT',
            gradient: 'from-gray-50 to-slate-100',
            badgeClass: 'bg-[color:var(--bg-hover)]0',
            iconTint: 'text-gray-400',
        };
    }
    if (m.startsWith('audio/') || ['mp3', 'wav', 'm4a', 'aac', 'flac'].includes(ext)) {
        return {
            label: 'AUDIO',
            gradient: 'from-indigo-50 to-violet-100',
            badgeClass: 'bg-[#5856d6]',
            iconTint: 'text-indigo-300/90',
        };
    }
    if (ext) {
        return {
            label: ext.slice(0, 5).toUpperCase(),
            gradient: 'from-slate-50 to-gray-100',
            badgeClass: 'bg-slate-600',
            iconTint: 'text-slate-400',
        };
    }
    return {
        label: 'FILE',
        gradient: 'from-slate-50 to-gray-100',
        badgeClass: 'bg-slate-600',
        iconTint: 'text-slate-400',
    };
}

function formatFileSizeBytes(n?: number): string {
    if (n == null || n <= 0) return '';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(2)} KB`;
    return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}



async function downloadFileToDevice(url: string, suggestedName: string, ev: React.MouseEvent) {
    ev.preventDefault();
    ev.stopPropagation();
    await downloadFileToDeviceCore(url, suggestedName);
}

/** Hộp thoại Lưu thành… (Chrome/Edge): chọn đường dẫn trước → fetch blob → ghi ngay. Không API / lỗi → tải về thư mục mặc định. */
async function saveFileWithPickerDialog(
    url: string,
    suggestedName: string,
    ev: React.MouseEvent,
    onSaved?: () => void,
) {
    ev.preventDefault();
    ev.stopPropagation();
    const safe = suggestedName.replace(/[<>:"/\\|?*]/g, '_') || 'download';

    const extWithDot =
        safe.includes('.') && safe.lastIndexOf('.') > 0 ? safe.slice(safe.lastIndexOf('.')) : '';

    const w = window as Window & {
        showSaveFilePicker?: (options?: {
            suggestedName?: string;
            types?: Array<{ description: string; accept: Record<string, string[]> }>;
        }) => Promise<FileSystemFileHandle>;
    };

    let fileHandle: FileSystemFileHandle | undefined;
    if (typeof w.showSaveFilePicker === 'function') {
        try {
            fileHandle = await w.showSaveFilePicker({
                suggestedName: safe,
                types: extWithDot
                    ? [
                        {
                            description: 'Tệp',
                            accept: {
                                'application/octet-stream': [extWithDot],
                            },
                        },
                    ]
                    : undefined,
            });
        } catch (err: unknown) {
            const name = err && typeof err === 'object' && 'name' in err ? (err as { name: string }).name : '';
            if (name === 'AbortError') return;
        }
    }

    let blob: Blob;
    try {
        const res = await fetch(url, { mode: 'cors' });
        if (!res.ok) throw new Error('fetch failed');
        blob = await res.blob();
    } catch {
        await downloadFileToDeviceCore(url, suggestedName);
        onSaved?.();
        return;
    }

    if (fileHandle) {
        try {
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            onSaved?.();
            return;
        } catch {
            await downloadFileToDeviceCore(url, suggestedName);
            onSaved?.();
            return;
        }
    }

    await downloadFileToDeviceCore(url, suggestedName);
    onSaved?.();
}

function isPdfAttachment(url: string, fileName?: string, mime?: string): boolean {
    const m = (mime || '').toLowerCase();
    if (m.includes('pdf') || m === 'application/pdf') return true;
    const name = (fileName || '').trim().toLowerCase();
    if (name.endsWith('.pdf')) return true;
    try {
        const path = new URL(url, typeof window !== 'undefined' ? window.location.href : undefined).pathname;
        return /\.pdf$/i.test(path);
    } catch {
        const base = url.split(/[?#]/)[0];
        return /\.pdf$/i.test(base);
    }
}

/** Windows: trình khác Edge có thể mở PDF trong Edge qua URI microsoft-edge: */
function isWindowsOs(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /Windows/i.test(navigator.userAgent);
}

function isMicrosoftEdgeBrowser(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /\bEdg\//i.test(navigator.userAgent);
}

function openFileFromCard(
    url: string,
    ev: React.MouseEvent | React.KeyboardEvent,
    opts?: { fileName?: string; mime?: string },
) {
    ev.preventDefault();
    ev.stopPropagation();

    let abs: string;
    try {
        abs = new URL(url, window.location.href).href;
    } catch {
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
    }

    const pdf = isPdfAttachment(url, opts?.fileName, opts?.mime);
    const httpsLike = abs.startsWith('http://') || abs.startsWith('https://');

    if (
        pdf &&
        httpsLike &&
        isWindowsOs() &&
        !isMicrosoftEdgeBrowser()
    ) {
        const edgeUri = `microsoft-edge:${abs}`;
        const opened = window.open(edgeUri, '_blank', 'noopener,noreferrer');
        if (opened) return;
        try {
            const a = document.createElement('a');
            a.href = edgeUri;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            document.body.appendChild(a);
            a.click();
            a.remove();
            return;
        } catch {
            /* fallback */
        }
    }

    window.open(abs, '_blank', 'noopener,noreferrer');
}

const FileAttachmentCard: React.FC<{
    attachment?: any;
    url: string;
    fileName: string;
    size?: number;
    createdAt: string;
    setDownloadsHelpOpen: (open: boolean) => void;
    setDownloadsHelpJustFetched: (just: boolean) => void;
}> = ({ attachment, url, fileName, size, createdAt, setDownloadsHelpOpen, setDownloadsHelpJustFetched }) => {
    const [fileSavedOnDevice, setFileSavedOnDevice] = useState(false);
    const [downloadsHelpBusy, setDownloadsHelpBusy] = useState(false);
    const filePresentation = getFilePresentation(fileName, attachment?.type);

    if (!filePresentation) return null;

    return (
        <div
            className="box-border w-[300px] max-w-full shrink-0 rounded-xl border border-sky-300/90 bg-sky-50/95 shadow-sm select-none"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="flex items-center gap-1 pl-2 pr-1 py-2">
                <div
                    role="button"
                    tabIndex={0}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg py-0.5 text-left hover:bg-[color:var(--bg-primary)]/55 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0068ff]/25"
                    title="Mở file — PDF trên Windows sẽ ưu tiên Microsoft Edge (khi đang dùng trình duyệt khác)"
                    onClick={(e) =>
                        openFileFromCard(url, e, {
                            fileName: fileName,
                            mime: attachment?.type,
                        })
                    }
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            openFileFromCard(url, e, {
                                fileName: fileName,
                                mime: attachment?.type,
                            });
                        }
                    }}
                >
                    <div className="flex shrink-0 flex-col items-center gap-1">
                        <div
                            className={clsx(
                                'flex h-11 w-10 shrink-0 items-center justify-center rounded-lg px-1 text-[10px] font-bold leading-tight text-white',
                                filePresentation.badgeClass,
                            )}
                            title={filePresentation.label}
                        >
                            {filePresentation.label}
                        </div>
                        <span className="text-[10px] leading-none text-gray-400 tabular-nums">
                            {new Date(createdAt).toLocaleTimeString('vi-VN', {
                                hour: '2-digit',
                                minute: '2-digit',
                            })}
                        </span>
                    </div>
                    <div className="min-w-0 flex-1">
                        <div
                            className="truncate text-sm font-semibold text-[color:var(--text-primary)]"
                            title={fileName}
                        >
                            {fileName}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                            <span className="text-[color:var(--text-secondary)]">
                                {formatFileSizeBytes(size) || 'Không rõ dung lượng'}
                            </span>
                            {fileSavedOnDevice && (
                                <span className="inline-flex items-center gap-0.5 font-medium text-emerald-600">
                                    <svg
                                        className="h-3.5 w-3.5 shrink-0"
                                        viewBox="0 0 20 20"
                                        fill="currentColor"
                                        aria-hidden
                                    >
                                        <path
                                            fillRule="evenodd"
                                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                    Đã có trên máy
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                    <button
                        type="button"
                        className="box-border inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[color:var(--border-primary)] bg-[color:var(--bg-primary)] p-0 text-[color:var(--text-secondary)] shadow-sm hover:bg-[color:var(--bg-hover)] disabled:pointer-events-none disabled:opacity-60"
                        title="Xem nơi tải xuống — nếu chưa tải sẽ tải vào thư mục mặc định rồi hướng dẫn (Ctrl+J)"
                        aria-label={
                            downloadsHelpBusy
                                ? 'Đang chuẩn bị hướng dẫn nơi tải'
                                : 'Nơi tải xuống và hướng dẫn'
                        }
                        disabled={downloadsHelpBusy}
                        aria-busy={downloadsHelpBusy}
                        onClick={async (e) => {
                            e.stopPropagation();
                            if (!url) {
                                setDownloadsHelpJustFetched(false);
                                setDownloadsHelpOpen(true);
                                return;
                            }
                            let justFetched = false;
                            if (!fileSavedOnDevice) {
                                setDownloadsHelpBusy(true);
                                try {
                                    await downloadFileToDeviceCore(
                                        url,
                                        fileName,
                                    );
                                    setFileSavedOnDevice(true);
                                    justFetched = true;
                                } finally {
                                    setDownloadsHelpBusy(false);
                                }
                            }
                            setDownloadsHelpJustFetched(justFetched);
                            setDownloadsHelpOpen(true);
                        }}
                    >
                        {downloadsHelpBusy ? (
                            <svg
                                className="h-5 w-5 animate-spin text-[color:var(--text-secondary)]"
                                viewBox="0 0 24 24"
                                fill="none"
                                aria-hidden
                            >
                                <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                />
                                <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                />
                            </svg>
                        ) : (
                            <svg
                                className="h-5 w-5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                aria-hidden
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                                />
                            </svg>
                        )}
                    </button>
                    <button
                        type="button"
                        className="box-border inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[color:var(--border-primary)] bg-[color:var(--bg-primary)] p-0 text-[#0068ff] shadow-sm hover:bg-sky-50"
                        title="Chọn nơi lưu (Chrome / Edge). Trình khác: tải về Tải xuống mặc định."
                        aria-label="Tải xuống — chọn nơi lưu"
                        onClick={(e) =>
                            saveFileWithPickerDialog(
                                url,
                                fileName,
                                e,
                                () => setFileSavedOnDevice(true),
                            )
                        }
                    >
                        <svg
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                            aria-hidden
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75v-2.25M12 4.5v15m0 0l-4.5-4.5M12 19.5l4.5-4.5"
                            />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

const getAvatarUrl = (name: string, avatarUrl?: string) => {
    if (avatarUrl) return getImageUrl(avatarUrl);
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4A90D9&color=fff&size=64`;
};

const MessageBubble: React.FC<MessageBubbleProps> = ({
    message,
    isMine,
    showAvatar = false,
    isFirstInGroup = true,
    isLastInGroup = true,
    senderName,
    senderAvatar,
    marginBottom = 'mb-1',
    onRecall,
    onReact,
    onReply,
    onTogglePin,
    onRemoveAllReactions,
    onDeleteForMe,
    onForward,
    onScrollToMessage,
    onImageLoad,
    repliedMessage,
    isLatestMessage,
    participants = [],
    onOpenChatGallery,
}) => {
    const [showReactPicker, setShowReactPicker] = useState(false);
    const [isHoveringReactions, setIsHoveringReactions] = useState(false);
    const [showReactionDetail, setShowReactionDetail] = useState(false);
    const [selectedEmojiTab, setSelectedEmojiTab] = useState<string | null>(null);
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const [menuPos, setMenuPos] = useState<{ top: number; left?: number; right?: number } | null>(null);
    const [showMessageDetail, setShowMessageDetail] = useState(false);
    const [imageLightbox, setImageLightbox] = useState<{ urls: string[]; index: number } | null>(
        null,
    );
    /** Hướng dẫn xem danh sách / vị trí file đã tải (web không mở được Explorer trực tiếp) */
    const [downloadsHelpOpen, setDownloadsHelpOpen] = useState(false);
    /** Vừa tự tải về thư mục mặc định trước khi mở modal (để hiển thị gợi ý phù hợp) */
    const [downloadsHelpJustFetched, setDownloadsHelpJustFetched] = useState(false);
    const moreButtonRef = useRef<HTMLButtonElement>(null);

    const closeDownloadsHelp = () => {
        setDownloadsHelpOpen(false);
        setDownloadsHelpJustFetched(false);
    };

    const isStoryReply = useMemo(() => {
        return !message.isRecall && 
               (message.type === 'TEXT' || message.type === 'STORY_REPLY') && 
               message.content?.trim().startsWith('{"type":"STORY_QUOTE"');
    }, [message]);

    const openInChatGallery = (rawUrl: string) => {
        if (!onOpenChatGallery || !rawUrl) return false;
        onOpenChatGallery(getImageUrl(rawUrl) || rawUrl);
        return true;
    };

    // Keep picker open if hovered over button OR the picker itself
    const isPickerVisible = showReactPicker || isHoveringReactions;

    const handleReact = (emoji: string) => {
        if (onReact) onReact(message.id, emoji);
    };

    // Calculate Reaction counts based on Array of {userId, emoji}
    const reactionCounts = Array.isArray(message.reactions) ? message.reactions.reduce((acc, curr) => {
        acc[curr.emoji] = (acc[curr.emoji] || 0) + 1;
        return acc;
    }, {} as Record<string, number>) : {};

    // Sort emojis by count descending for UI consistency, or just object keys
    const sortedEmojis = Object.keys(reactionCounts).sort((a, b) => reactionCounts[b] - reactionCounts[a]);
    const totalReactions = Array.isArray(message.reactions) ? message.reactions.length : 0;
    const latestEmoji = (totalReactions > 0 && Array.isArray(message.reactions)) ? message.reactions[totalReactions - 1].emoji : null;

    // Bo góc kiểu Zalo: góc liên kết với avatar phẳng, còn lại bo tròn
    const bubbleRadius = isMine
        ? clsx(
            'rounded-2xl',
            isFirstInGroup && 'rounded-tr-md',
            isLastInGroup && 'rounded-br-md',
        )
        : clsx(
            'rounded-2xl',
            isFirstInGroup && 'rounded-tl-md',
            isLastInGroup && 'rounded-bl-md',
        );

    const displayName = senderName || 'Unknown';

    const imageUrls = useMemo(() => getImageAttachmentUrls(message), [message]);
    const videoUrls = useMemo(() => getVideoAttachmentUrls(message), [message]);
    const audioUrls = useMemo(() => getAudioAttachmentUrls(message), [message]);

    const attachment = message.attachments?.[0];
    const effectiveFileUrl = getImageUrl(message.fileUrl || attachment?.url);
    const effectiveFileName = message.fileName || attachment?.name || attachment?.filename;
    const effectiveFileSize = message.fileSize || attachment?.size;
    let effectiveType = message.type as string;
    /** Thông báo ghim (backend: PIN_NOTIFICATION) dùng cùng pill với SYSTEM */
    if (
        message.type === 'PIN_NOTIFICATION' ||
        (message.senderId === 'system' && message.type !== 'SYSTEM')
    ) {
        effectiveType = 'SYSTEM';
    }
    // Không ép IMAGE khi trong cùng tin còn video — nếu không nhánh VIDEO/mixed không bao giờ chạy.
    if (imageUrls.length > 0 && videoUrls.length === 0) {
        effectiveType = 'IMAGE';
    } else if (videoUrls.length > 0 && imageUrls.length === 0) {
        effectiveType = 'VIDEO';
    } else if (imageUrls.length > 0 && videoUrls.length > 0) {
        effectiveType = 'MEDIA';
    }

    // AUTO-DETECT CALL JSON: Thử parse JSON để xác định chính xác loại tin nhắn cuộc gọi
    let isCallJson = false;
    if (!message.isRecall && message.content && message.content.trim().startsWith('{')) {
        try {
            const parsed = JSON.parse(message.content);
            if (parsed.status && parsed.callType) {
                isCallJson = true;
                effectiveType = (parsed.callType === 'VIDEO' ? 'CALL_VIDEO' : 'CALL_VOICE') as any;
            }
        } catch (e) {
            // Không phải JSON cuộc gọi, bỏ qua
        }
    }

    const isCallMessage = effectiveType === 'CALL_VOICE' || effectiveType === 'CALL_VIDEO';

    if ((effectiveType === 'TEXT' || !effectiveType) && !isCallJson && effectiveFileUrl && attachment) {
        const mime = (attachment.type || '').toLowerCase();
        if (mime.startsWith('image')) effectiveType = 'IMAGE';
        else if (mime.startsWith('video')) effectiveType = 'VIDEO';
        else if (mime.startsWith('audio')) effectiveType = 'VOICE';
        else effectiveType = 'FILE';
    }

    // Một số thông báo quản lý nhóm được backend lưu như TEXT → hiển thị như SYSTEM (pill)
    if ((effectiveType === 'TEXT' || !effectiveType) && isGroupActionSystemText(message.content)) {
        effectiveType = 'SYSTEM';
    }

    const fileDisplayName =
        effectiveFileName || message.content?.trim() || 'Tệp đính kèm';
    const filePresentation =
        (effectiveType === 'FILE' || effectiveType === 'DOCUMENT') && effectiveFileUrl
            ? getFilePresentation(fileDisplayName, attachment?.type)
            : null;

    // Handle System Message
    if (effectiveType === 'SYSTEM') {
        const isPollSystemMessage =
            !!message.replyToId &&
            (
                (message.content || '').includes('cuộc bình chọn') ||
                (message.content || '').includes('khóa bình chọn')
            );

        return (
            <div className="flex justify-center my-2">
                <div className="bg-[color:var(--bg-primary)] border border-[color:var(--border-primary)] shadow-sm rounded-full px-4 py-2 flex items-center gap-2 text-sm text-[color:var(--text-secondary)] max-w-[90%]">
                    <span className={clsx("flex shrink-0", isPollSystemMessage ? "text-emerald-500" : "text-orange-500")}>
                        {isPollSystemMessage ? (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 17V7m4 10V4m4 13v-6" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 20h16" />
                            </svg>
                        ) : message.isRecall ? (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4l16 16" /></svg>
                        ) : (
                            <svg className="w-4 h-4 transform rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                        )}
                    </span>
                    <span className="truncate">
                        {getSystemDisplayContent(message)}
                        {!message.isRecall && message.replyToId && (
                            <span
                                className="text-blue-500 font-medium ml-1 cursor-pointer hover:underline"
                                onClick={() => onScrollToMessage?.(message.replyToId!)}
                            >
                                Xem
                            </span>
                        )}
                    </span>
                </div>
            </div>
        );
    }
    // Handle Poll Message
    if (effectiveType === 'POLL') {
        return (
            <div className="flex justify-center my-2">
                <PollBubble
                    pollId={message.content || ''}
                    roomId={message.roomId}
                    messageId={message.id}
                    mode="preview"
                />
            </div>
        );
    }

    const renderCallContent = () => {
        try {
            const data = JSON.parse(message.content || '{}');
            const { status, duration, callType } = data;
            const isGroupCall = !!data.isGroupCall;
            const callSessionId: string | undefined = data.callSessionId;
            const isCallFromMe = isMine;
            const isVideo = callType === 'VIDEO';

            const statusUpper = String(status || '').toUpperCase();
            // GROUP CALL đã kết thúc: ẩn nút "Tham gia", chỉ hiện duration + "Đã kết thúc"
            // (giống Zalo: 1 bubble duy nhất, state chuyển từ STARTED → ENDED tại chỗ).
            const isFinalStatus =
                statusUpper === 'ENDED' ||
                statusUpper === 'MISSED' ||
                statusUpper === 'CANCELLED' ||
                statusUpper === 'REJECTED';
            const groupEnded = isGroupCall && isFinalStatus;

            let statusText = '';
            let Icon = isVideo ? Video : Phone;
            let iconColor = 'text-blue-500';

            if (statusUpper === 'ENDED') {
                statusText =
                    duration > 0
                        ? `${Math.floor(duration / 60)} phút ${duration % 60} giây`
                        : 'Cuộc gọi đi';
                Icon = isCallFromMe ? PhoneOutgoing : PhoneIncoming;
                iconColor = 'text-green-500';
            } else if (statusUpper === 'REJECTED' || statusUpper === 'CANCELLED') {
                statusText = isGroupCall
                    ? 'Không có ai tham gia'
                    : isCallFromMe
                    ? 'Bạn đã hủy'
                    : 'Cuộc gọi nhỡ';
                Icon = PhoneMissed;
                iconColor = 'text-red-500';
            } else if (statusUpper === 'MISSED') {
                statusText = isGroupCall ? 'Không có ai tham gia' : 'Cuộc gọi nhỡ';
                Icon = PhoneMissed;
                iconColor = 'text-red-500';
            } else {
                statusText = isGroupCall
                    ? isVideo
                        ? 'Cuộc gọi nhóm video'
                        : 'Cuộc gọi nhóm thoại'
                    : isVideo
                    ? 'Cuộc gọi video'
                    : 'Cuộc gọi thoại';
            }

            const title = isGroupCall
                ? isVideo
                    ? 'Cuộc gọi nhóm video'
                    : 'Cuộc gọi nhóm thoại'
                : isVideo
                ? 'Cuộc gọi video'
                : 'Cuộc gọi thoại';

            const handlePrimaryAction = () => {
                if (isGroupCall) {
                    if (callSessionId) {
                        useCallStore.getState().joinGroupCall(callSessionId);
                    }
                    return;
                }

                const receiverId = isMine ? data.receiverId : data.callerId;
                if (receiverId) {
                    useCallStore.getState().initiateCall(
                        message.roomId, // Sử dụng roomId làm conversationId
                        receiverId,
                        callType || 'VOICE',
                        isMine ? undefined : senderName,
                        isMine ? undefined : senderAvatar
                    );
                }
            };

            return (
                <div className="flex flex-col py-0">
                    <div className="flex items-center gap-2 mb-1.5">
                        <div className={clsx("p-1.5 rounded-full bg-[color:var(--bg-hover)] flex items-center justify-center", iconColor)}>
                            <Icon size={15} />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold text-zinc-800 text-[13px]">{title}</span>
                            {statusUpper === 'ENDED' && (
                                <div className="flex items-center gap-1 text-zinc-500 text-[11px] mt-0.5">
                                    <Icon size={10} className={iconColor} />
                                    <span>{statusText}</span>
                                </div>
                            )}
                            {(statusUpper === 'REJECTED' || statusUpper === 'CANCELLED' || statusUpper === 'MISSED') && (
                                <div className="flex items-center gap-1 text-zinc-500 text-[11px] mt-0.5">
                                    <PhoneMissed size={10} className="text-red-500" />
                                    <span>{statusText}</span>
                                </div>
                            )}
                            {groupEnded && (
                                <span className="text-red-500 text-[11px] mt-0.5 ">Đã kết thúc</span>
                            )}
                        </div>
                    </div>

                    {/*
                      - GROUP đã kết thúc: không render nút (đúng mockup Zalo).
                      - GROUP đang gọi: "Nhấn để tham gia".
                      - 1-1: giữ nguyên "Gọi lại".
                    */}
                    {!groupEnded && (
                        <>
                            <div className="h-[1px] bg-[color:var(--bg-secondary)] w-full mb-1" />
                            <button
                                onClick={handlePrimaryAction}
                                className="w-full py-0.5 text-blue-600 font-semibold text-[12px] hover:bg-blue-50 rounded-lg transition-colors flex items-center justify-center gap-1"
                            >
                                {isGroupCall ? 'Nhấn để tham gia' : 'Gọi lại'}
                            </button>
                        </>
                    )}
                </div>
            );
        } catch (e) {
            return <span className="text-[15px] italic opacity-80 pr-8">{message.content}</span>;
        }
    };
    return (
        <>
            <div className={clsx('flex flex-row items-end', isMine ? 'justify-end' : 'justify-start', marginBottom)}>
                {/* Avatar bên trái (người khác) */}
                {!isMine && (
                    <div className="mr-1.5 self-end flex-shrink-0" style={{ width: 32 }}>
                        {showAvatar ? (
                            <img
                                src={getAvatarUrl(displayName, senderAvatar)}
                                alt={displayName}
                                className="w-8 h-8 rounded-full object-cover"
                            />
                        ) : (
                            <div className="w-8 h-8" /> /* placeholder để giữ alignment */
                        )}
                    </div>
                )}

                {/* Bubble content */}
                <div className={clsx(
                    'max-w-[70%] min-w-0 flex flex-col relative mb-4',
                    isMine ? 'items-end' : 'items-start'
                )}>
                    {/* Tên người gửi (hiện ở đầu nhóm) */}
                    {!isMine && senderName && (
                        <span className="text-xs text-[color:var(--text-secondary)] mb-0.5 ml-1 font-medium">{senderName}</span>
                    )}

                    {/* Nội dung tin nhắn */}
                    <div
                        className={clsx(
                            'px-3.5 py-2.5 max-w-full min-w-0 overflow-hidden break-words [overflow-wrap:anywhere] relative flex flex-col group/bubble message-bubble-content',
                            bubbleRadius,
                            isMine
                                ? (message.isRecall ? 'italic border border-transparent' : 'border')
                                : (message.isRecall ? 'italic border border-transparent' : 'shadow-sm border')
                        )}
                        style={{
                            backgroundColor: message.isRecall ? 'var(--bg-secondary)' : (isMine ? 'var(--bg-message-own)' : 'var(--bg-message-other)'),
                            color: message.isRecall ? 'var(--text-secondary)' : 'var(--text-primary)',
                            borderColor: 'var(--border-primary)'
                        }}
                        onContextMenu={(e) => {
                            if (!message.isRecall && !isCallMessage) {
                                e.preventDefault();
                                setShowMoreMenu(true);
                            }
                        }}
                    >
                        {/* Hành động tin nhắn (hiện khi hover): Reply + ⋯ */}
                        {!message.isRecall && !isCallMessage && (
                            <div className={clsx(
                                "absolute top-1/2 -translate-y-1/2 opacity-0 group-hover/bubble:opacity-100 transition-opacity flex items-center gap-1",
                                isMine ? "right-full mr-2" : "left-full ml-2"
                            )}>
                                {/* Nút Trả lời */}
                                {onReply && (
                                    <button
                                        onClick={() => onReply(message)}
                                        className="bg-[color:var(--bg-primary)] text-[color:var(--text-secondary)] shadow-sm border border-[color:var(--border-primary)] rounded-full w-7 h-7 flex items-center justify-center hover:bg-[color:var(--bg-hover)] focus:outline-none"
                                        title="Trả lời"
                                    >
                                        <svg className="w-3.5 h-3.5 transform -scale-x-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                        </svg>
                                    </button>
                                )}

                                {/* Nút ⋯ (More) */}
                                <div className="relative">
                                    <button
                                        ref={moreButtonRef}
                                        onClick={() => {
                                            const btn = moreButtonRef.current;
                                            if (!btn) return;
                                            const rect = btn.getBoundingClientRect();
                                            const spaceBelow = window.innerHeight - rect.bottom;
                                            const menuHeight = 260; // approx
                                            const openUpward = spaceBelow < menuHeight;
                                            if (openUpward) {
                                                setMenuPos({
                                                    top: rect.top - menuHeight,
                                                    ...(isMine ? { right: window.innerWidth - rect.right } : { left: rect.left }),
                                                });
                                            } else {
                                                setMenuPos({
                                                    top: rect.bottom + 4,
                                                    ...(isMine ? { right: window.innerWidth - rect.right } : { left: rect.left }),
                                                });
                                            }
                                            setShowMoreMenu(true);
                                        }}
                                        className="bg-[color:var(--bg-primary)] text-[color:var(--text-secondary)] shadow-sm border border-[color:var(--border-primary)] rounded-full w-7 h-7 flex items-center justify-center hover:bg-[color:var(--bg-hover)] focus:outline-none"
                                        title="Thêm"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                            <circle cx="5" cy="12" r="2" />
                                            <circle cx="12" cy="12" r="2" />
                                            <circle cx="19" cy="12" r="2" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Fixed-position menu — position:fixed escapes any overflow:hidden ancestor */}
                        {showMoreMenu && menuPos && !isCallMessage && (
                            <>
                                {/* Backdrop */}
                                <div
                                    style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
                                    onClick={() => { setShowMoreMenu(false); setMenuPos(null); }}
                                />
                                <div
                                    style={{
                                        position: 'fixed',
                                        top: menuPos.top,
                                        left: menuPos.left,
                                        right: menuPos.right,
                                        zIndex: 9999,
                                        minWidth: 180,
                                    }}
                                    className="bg-[color:var(--bg-primary)] rounded-xl shadow-lg border border-[color:var(--border-primary)] py-1.5"
                                >
                                    {/* Copy */}
                                    <button
                                        onClick={() => { navigator.clipboard.writeText(message.content || ''); setShowMoreMenu(false); setMenuPos(null); }}
                                        className="w-full flex items-center gap-3 px-3.5 py-2 text-sm text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-hover)] transition-colors"
                                    >
                                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                        Copy tin nhắn
                                    </button>
                                    {/* Pin */}
                                    {onTogglePin && !isCallMessage && (
                                        <button
                                            onClick={() => { onTogglePin(message.id, !!message.pinned); setShowMoreMenu(false); setMenuPos(null); }}
                                            className="w-full flex items-center gap-3 px-3.5 py-2 text-sm text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-hover)] transition-colors"
                                        >
                                            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                                            {message.pinned ? 'Bỏ ghim' : 'Ghim tin nhắn'}
                                        </button>
                                    )}
                                    {/* Reply */}
                                    {onReply && !isCallMessage && (
                                        <button
                                            onClick={() => { onReply(message); setShowMoreMenu(false); setMenuPos(null); }}
                                            className="w-full flex items-center gap-3 px-3.5 py-2 text-sm text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-hover)] transition-colors"
                                        >
                                            <svg className="w-4 h-4 text-gray-400 transform -scale-x-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                                            Trả lời
                                        </button>
                                    )}
                                    {/* Share / Forward */}
                                    {!isCallMessage && (
                                        <button
                                            onClick={() => { onForward?.(message); setShowMoreMenu(false); setMenuPos(null); }}
                                            className="w-full flex items-center gap-3 px-3.5 py-2 text-sm text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-hover)] transition-colors"
                                        >
                                            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                                            Chia sẻ
                                        </button>
                                    )}
                                    {/* View Detail */}
                                    <button
                                        onClick={() => { setShowMessageDetail(true); setShowMoreMenu(false); setMenuPos(null); }}
                                        className="w-full flex items-center gap-3 px-3.5 py-2 text-sm text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-hover)] transition-colors"
                                    >
                                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        Xem chi tiết
                                    </button>
                                    <div className="border-t border-[color:var(--border-primary)] my-1" />
                                    {/* Recall - own messages only */}
                                    {isMine && onRecall && !isCallMessage && (
                                        <button
                                            onClick={() => { onRecall(message.id); setShowMoreMenu(false); setMenuPos(null); }}
                                            className="w-full flex items-center gap-3 px-3.5 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                                            Thu hồi
                                        </button>
                                    )}
                                    {/* Delete for me */}
                                    {!isCallMessage && (
                                        <button
                                            onClick={() => { onDeleteForMe?.(message.id); setShowMoreMenu(false); setMenuPos(null); }}
                                            className="w-full flex items-center gap-3 px-3.5 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            Xoá ở phía tôi
                                        </button>
                                    )}
                                </div>
                            </>
                        )}

                        {/* Forward badge */}
                        {(message.type === 'FORWARD' || message.forwardedFromId) && !message.isRecall && (
                            <div className="flex items-center gap-1 mb-1 text-xs text-gray-400 italic">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                </svg>
                                Đã chuyển tiếp
                            </div>
                        )}

                        {repliedMessage && !message.isRecall && (() => {
                            const rt = effectiveTypeForMessage(repliedMessage);
                            const rAtt = repliedMessage.attachments?.[0];
                            const rUrl = repliedMessage.fileUrl || rAtt?.url;
                            const rName = repliedMessage.fileName || rAtt?.name || rAtt?.filename;
                            const thumb = rt === 'IMAGE' && rUrl ? rUrl : (rAtt?.thumbnailUrl || undefined);
                            return (
                                <div
                                    className={clsx(
                                        "mb-1.5 p-1.5 rounded text-xs border-l-2 cursor-pointer transition-colors",
                                        isMine ? "border-blue-300" : "border-blue-500"
                                    )}
                                    style={{ backgroundColor: 'var(--bg-tertiary)' }}
                                    onClick={() => repliedMessage.id && onScrollToMessage?.(repliedMessage.id)}
                                >
                                    <span className="font-medium block text-blue-700">
                                        {repliedMessage.senderName || participants.find(p => p.id === repliedMessage.senderId)?.fullName || participants.find(p => p.id === repliedMessage.senderId)?.username || 'Người dùng'}
                                    </span>
                                    <div className="flex items-center gap-2 pt-0.5 min-w-0">
                                        {repliedMessage.isRecall ? (
                                            <span className="line-clamp-2 text-[color:var(--text-secondary)]">[Tin nhắn đã thu hồi]</span>
                                        ) : rt === 'IMAGE' && rUrl ? (
                                            <>
                                                <img src={thumb || rUrl} alt="" className="h-10 w-10 shrink-0 rounded object-cover bg-[color:var(--bg-tertiary)]" />
                                                <span className="line-clamp-2 text-[color:var(--text-secondary)]">Ảnh</span>
                                            </>
                                        ) : rt === 'VIDEO' && rUrl ? (
                                            <>
                                                <div className="h-10 w-10 shrink-0 rounded bg-gray-800 flex items-center justify-center text-white text-[10px]">▶</div>
                                                <span className="line-clamp-2 text-[color:var(--text-secondary)]">Video{rName ? ` · ${rName}` : ''}</span>
                                            </>
                                        ) : rt === 'VOICE' && rUrl ? (
                                            <>
                                                <div className="h-9 w-9 shrink-0 rounded bg-[#eff6ff] flex items-center justify-center text-blue-500">
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                                                </div>
                                                <span className="line-clamp-2 text-[color:var(--text-secondary)]">Tin nhắn thoại</span>
                                            </>
                                        ) : (rt === 'FILE' || rt === 'DOCUMENT') ? (
                                            <>
                                                <div className="h-9 w-9 shrink-0 rounded bg-blue-100 flex items-center justify-center text-blue-600">
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                                </div>
                                                <span className="line-clamp-2 text-[color:var(--text-secondary)] truncate">{rName || 'Tệp đính kèm'}</span>
                                            </>
                                        ) : (
                                            <span className="line-clamp-2 text-[color:var(--text-secondary)]">{repliedMessage.content || '[Tin nhắn]'}</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}

                        {message.isRecall ? (
                            <span className="text-sm italic opacity-80">{message.content}</span>
                        ) : (
                            <div className="flex flex-col gap-2.5">
                                {/* 1. Text Content / Link Preview */}
                                {message.content && !isCallMessage && !isStoryReply && (
                                    <span className="block max-w-full min-w-0 text-[15px] leading-relaxed pr-8 whitespace-pre-wrap break-words [overflow-wrap:anywhere] [word-break:break-word]">
                                        {linkifyText(message.content || '')}
                                        {(() => {
                                            const u = extractFirstHttpUrl(message.content || '');
                                            return u ? <LinkPreviewCard url={u} /> : null;
                                        })()}
                                    </span>
                                )}

                                {/* 2. Media Content (Images + Videos) */}
                                {(imageUrls.length > 0 || videoUrls.length > 0) && (
                                    <div className="flex flex-col gap-2">
                                        {imageUrls.length > 1 ? (
                                            (() => {
                                                const visibleCount = Math.min(imageUrls.length, MULTI_IMG_MAX);
                                                const show = imageUrls.slice(0, visibleCount);
                                                const extra = imageUrls.length - visibleCount;
                                                return (
                                                    <div
                                                        className="max-w-[300px]"
                                                        style={multiImageGridStyle(visibleCount)}
                                                    >
                                                        {show.map((url, index) => (
                                                            <div
                                                                key={`${message.id}-img-${index}`}
                                                                className="relative overflow-hidden"
                                                                style={
                                                                    visibleCount === 3 && index === 0
                                                                        ? { gridRow: '1 / 3' }
                                                                        : undefined
                                                                }
                                                            >
                                                                <LazyImage
                                                                    src={url}
                                                                    alt={`${effectiveFileName || 'Ảnh'} ${index + 1}`}
                                                                    style={multiImageCellStyle(visibleCount, index)}
                                                                    onClick={() => {
                                                                        if (openInChatGallery(url)) return;
                                                                        setImageLightbox({ urls: imageUrls, index });
                                                                    }}
                                                                    onLoad={index === 0 ? onImageLoad : undefined}
                                                                />
                                                                {index === visibleCount - 1 && extra > 0 && (
                                                                    <button
                                                                        type="button"
                                                                        className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-md cursor-pointer border-0 p-0"
                                                                        aria-label={`Thêm ${extra} ảnh`}
                                                                        onClick={() => {
                                                                            if (openInChatGallery(imageUrls[visibleCount - 1] || url)) return;
                                                                            setImageLightbox({
                                                                                urls: imageUrls,
                                                                                index: visibleCount - 1,
                                                                            });
                                                                        }}
                                                                    >
                                                                        <span className="text-white text-xl font-bold">
                                                                            +{extra}
                                                                        </span>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                );
                                            })()
                                        ) : null}
                                        {imageUrls.length === 1 ? (
                                            <div className="flex flex-col gap-1">
                                                <LazyImage
                                                    src={imageUrls[0]}
                                                    alt={effectiveFileName || 'Ảnh'}
                                                    style={{
                                                        maxWidth: 280,
                                                        maxHeight: 300,
                                                        borderRadius: 8,
                                                        objectFit: 'cover',
                                                        cursor: 'pointer',
                                                    }}
                                                    onClick={() => {
                                                        if (openInChatGallery(imageUrls[0])) return;
                                                        setImageLightbox({
                                                            urls: imageUrls,
                                                            index: 0,
                                                        });
                                                    }}
                                                    onLoad={onImageLoad}
                                                />
                                            </div>
                                        ) : null}
                                        {videoUrls.length > 0 ? (
                                            <div className="flex flex-col gap-2">
                                                {videoUrls.map((vurl, vi) => (
                                                    <div key={`${message.id}-vid-${vi}`} className="relative inline-block max-w-[300px]">
                                                        <video
                                                            src={vurl}
                                                            controls
                                                            preload="metadata"
                                                            className="max-w-[300px] max-h-[240px] rounded-lg bg-black"
                                                        />
                                                        {onOpenChatGallery && (
                                                            <button
                                                                type="button"
                                                                title="Xem trong toàn bộ cuộc trò chuyện"
                                                                className="absolute top-1 right-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-sm text-white hover:bg-black/70"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    openInChatGallery(vurl);
                                                                }}
                                                            >
                                                                ⤢
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : null}
                                    </div>
                                )}

                                {/* 3. Standalone Fallback Media/Voice (Older messages with fileUrl but no attachments array) */}
                                {imageUrls.length === 0 && videoUrls.length === 0 && effectiveFileUrl && (() => {
                                    if (effectiveType === 'IMAGE') {
                                        return (
                                            <div className="flex flex-col gap-1">
                                                <LazyImage
                                                    src={effectiveFileUrl}
                                                    alt={effectiveFileName || 'Ảnh'}
                                                    style={{
                                                        maxWidth: 280,
                                                        maxHeight: 300,
                                                        borderRadius: 8,
                                                        objectFit: 'cover',
                                                        cursor: 'pointer',
                                                    }}
                                                    onClick={() => {
                                                        if (openInChatGallery(effectiveFileUrl)) return;
                                                        setImageLightbox({
                                                            urls: [effectiveFileUrl],
                                                            index: 0,
                                                        });
                                                    }}
                                                    onLoad={onImageLoad}
                                                />
                                            </div>
                                        );
                                    }
                                    if (effectiveType === 'VIDEO') {
                                        return (
                                            <div className="relative inline-block max-w-[300px]">
                                                <video
                                                    src={effectiveFileUrl}
                                                    controls
                                                    preload="metadata"
                                                    className="max-w-[300px] max-h-[240px] rounded-lg bg-black"
                                                />
                                                {onOpenChatGallery && (
                                                    <button
                                                        type="button"
                                                        title="Xem trong toàn bộ cuộc trò chuyện"
                                                        className="absolute top-1 right-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-sm text-white hover:bg-black/70"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openInChatGallery(effectiveFileUrl);
                                                        }}
                                                    >
                                                        ⤢
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    }
                                    if (effectiveType === 'VOICE') {
                                        return <VoicePlayer url={effectiveFileUrl} />;
                                    }
                                    return null;
                                })()}



                                {/* 5. File/Document attachments */}
                                {(() => {
                                    const filesToRender = (message.attachments || []).filter(
                                        (att: any) => !imageUrls.includes(getImageUrl(att.url)) && 
                                                      !videoUrls.includes(getImageUrl(att.url)) &&
                                                      !audioUrls.includes(getImageUrl(att.url))
                                    );
                                    
                                    const showFallbackFile = filesToRender.length === 0 && 
                                                             effectiveFileUrl && 
                                                             (effectiveType === 'FILE' || effectiveType === 'DOCUMENT') &&
                                                             effectiveType !== 'VOICE';

                                    if (filesToRender.length > 0 || showFallbackFile) {
                                        return (
                                            <div className="flex flex-col gap-2">
                                                {filesToRender.map((att: any, idx: number) => (
                                                    <FileAttachmentCard
                                                        key={idx}
                                                        attachment={att}
                                                        url={att.url}
                                                        fileName={att.name || att.filename || 'Tệp đính kèm'}
                                                        size={att.size}
                                                        createdAt={message.createdAt}
                                                        setDownloadsHelpOpen={setDownloadsHelpOpen}
                                                        setDownloadsHelpJustFetched={setDownloadsHelpJustFetched}
                                                    />
                                                ))}
                                                {showFallbackFile && (
                                                    <FileAttachmentCard
                                                        url={effectiveFileUrl}
                                                        fileName={fileDisplayName}
                                                        size={effectiveFileSize}
                                                        createdAt={message.createdAt}
                                                        setDownloadsHelpOpen={setDownloadsHelpOpen}
                                                        setDownloadsHelpJustFetched={setDownloadsHelpJustFetched}
                                                    />
                                                )}
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}

                                {/* 6. Story Reply */}
                                {isStoryReply && (
                                    <StoryReplyCard
                                        content={message.content!}
                                        isMine={isMine}
                                        time={new Date(message.createdAt).toLocaleTimeString('vi-VN', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    />
                                )}

                                {/* 7. Call message */}
                                {isCallMessage && renderCallContent()}
                            </div>
                        )}

                        {/* Thời gian (tin file/story đã có giờ trong thẻ) */}
                        {(() => {
                            const isPureFile = !message.content && imageUrls.length === 0 && videoUrls.length === 0 &&
                                ((message.attachments && message.attachments.length === 1) || (effectiveFileUrl && (effectiveType === 'FILE' || effectiveType === 'DOCUMENT')));
                            return !isPureFile && !isStoryReply && (
                                <span className="text-[11px] text-gray-400 mt-1.5 self-start leading-none">
                                    {new Date(message.createdAt).toLocaleTimeString('vi-VN', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}
                                </span>
                            );
                        })()}
                    </div>

                    {/* Reactions Pill and Inline Like - Nằm đè lên viền Đáy Phải (Bottom-Right) */}
                    <div className="absolute -bottom-3 right-0 translate-x-1 flex flex-row items-center z-10">
                        {/* Hiển thị Pill cảm xúc hợp nhất */}
                        {sortedEmojis.length > 0 && (
                            <div
                                className="flex items-center gap-1 bg-[color:var(--bg-primary)] border border-[color:var(--border-primary)] rounded-full px-1.5 py-0.5 shadow-sm text-xs cursor-pointer hover:bg-[color:var(--bg-hover)] transition-colors mr-1"
                                onClick={(e) => { e.stopPropagation(); setShowReactionDetail(true); setSelectedEmojiTab(null); }}
                            >
                                <div className="flex -space-x-1">
                                    {sortedEmojis.slice(0, 3).map((emoji, idx) => (
                                        <span key={emoji} className="relative z-10 drop-shadow-sm text-[13px]" style={{ zIndex: 10 - idx }}>{emoji}</span>
                                    ))}
                                </div>
                                {totalReactions > 0 && (
                                    <span className="text-[color:var(--text-secondary)] font-medium pl-0.5 text-[11px]">{totalReactions}</span>
                                )}
                            </div>
                        )}

                        {/* Floating Inline Like Button */}
                        {!message.isRecall && onReact && (
                            <div
                                className={clsx(
                                    "relative flex items-center justify-center transition-opacity z-20",
                                    (totalReactions > 0 || isLastInGroup || isPickerVisible)
                                        ? "opacity-100"
                                        : "opacity-0 group-hover/bubble:opacity-100"
                                )}
                                onMouseEnter={() => setShowReactPicker(true)}
                                onMouseLeave={() => setShowReactPicker(false)}
                            >
                                <button
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleReact(latestEmoji || '👍'); }}
                                    className="w-[26px] h-[26px] bg-[color:var(--bg-primary)] border border-[color:var(--border-primary)] outline-none text-[color:var(--text-secondary)] hover:text-blue-500 rounded-full shadow-sm flex items-center justify-center transition-colors"
                                    title="Thích"
                                >
                                    {latestEmoji ? (
                                        <span className="text-sm leading-none">{latestEmoji}</span>
                                    ) : (
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                                        </svg>
                                    )}
                                </button>

                                {/* Popup Reaction Picker dính ngay trên Nút Like Inline (có đệm pb-1 để ko mất hover) */}
                                {isPickerVisible && (
                                    <div className={clsx("absolute bottom-full pb-1 z-30", isMine ? "right-0" : "left-0")}>
                                        <div
                                            className={clsx(
                                                "bg-[color:var(--bg-primary)] rounded-[20px] shadow-[0_4px_12px_rgba(0,0,0,0.1)] border border-[color:var(--border-primary)] p-1.5 flex items-center gap-1 transform hover:scale-100 transition-all",
                                                isMine ? "origin-bottom-right" : "origin-bottom-left"
                                            )}
                                            onMouseEnter={() => setIsHoveringReactions(true)}
                                            onMouseLeave={() => setIsHoveringReactions(false)}
                                        >
                                            {REACTIONS.map((emoji) => (
                                                <button
                                                    key={emoji}
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        handleReact(emoji);
                                                    }}
                                                    className="w-9 h-9 flex items-center justify-center hover:bg-[color:var(--bg-secondary)] rounded-full text-xl transition-all hover:-translate-y-1"
                                                >
                                                    {emoji}
                                                </button>
                                            ))}
                                            {/* Nút X xóa toàn bộ biểu cảm */}
                                            {totalReactions > 0 && onRemoveAllReactions && (
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        onRemoveAllReactions(message.id);
                                                        setShowReactPicker(false);
                                                        setIsHoveringReactions(false);
                                                    }}
                                                    className="w-9 h-9 flex items-center justify-center hover:bg-red-50 rounded-full text-gray-400 hover:text-red-500 transition-all text-lg font-bold border-l border-[color:var(--border-primary)] ml-0.5 pl-0.5"
                                                    title="Xóa tất cả biểu cảm"
                                                >
                                                    ×
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Reaction Detail Popup Modal ── */}
            {showReactionDetail && totalReactions > 0 && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowReactionDetail(false)}>
                    <div
                        className="bg-[color:var(--bg-primary)] rounded-xl shadow-2xl w-[420px] max-h-[400px] flex flex-col overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--border-primary)]">
                            <span className="font-semibold text-base text-[color:var(--text-primary)]">Biểu cảm</span>
                            <button
                                onClick={() => setShowReactionDetail(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[color:var(--bg-secondary)] text-gray-400 hover:text-[color:var(--text-secondary)] transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Body: Left Tabs + Right User List */}
                        <div className="flex flex-1 overflow-hidden">
                            {/* Left: Emoji Tabs */}
                            <div className="w-[120px] border-r border-[color:var(--border-primary)] overflow-y-auto bg-[color:var(--bg-hover)]/50 shrink-0">
                                {/* Tất cả */}
                                <button
                                    onClick={() => setSelectedEmojiTab(null)}
                                    className={clsx(
                                        "w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors",
                                        selectedEmojiTab === null ? "bg-blue-50 text-blue-600 font-semibold border-r-2 border-blue-500" : "text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-secondary)]"
                                    )}
                                >
                                    <span>Tất cả</span>
                                    <span className="text-xs font-medium">{totalReactions}</span>
                                </button>
                                {/* Each emoji tab */}
                                {sortedEmojis.map((emoji) => (
                                    <button
                                        key={emoji}
                                        onClick={() => setSelectedEmojiTab(emoji)}
                                        className={clsx(
                                            "w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors",
                                            selectedEmojiTab === emoji ? "bg-blue-50 text-blue-600 font-semibold border-r-2 border-blue-500" : "text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-secondary)]"
                                        )}
                                    >
                                        <span className="text-base">{emoji}</span>
                                        <span className="text-xs font-medium">{reactionCounts[emoji]}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Right: User List */}
                            <div className="flex-1 overflow-y-auto">
                                {(() => {
                                    const reactions = Array.isArray(message.reactions) ? message.reactions : [];
                                    const filtered = selectedEmojiTab
                                        ? reactions.filter(r => r.emoji === selectedEmojiTab)
                                        : reactions;

                                    // Group by userId
                                    const userReactions: Record<string, string[]> = {};
                                    filtered.forEach(r => {
                                        if (!userReactions[r.userId]) userReactions[r.userId] = [];
                                        userReactions[r.userId].push(r.emoji);
                                    });

                                    return Object.entries(userReactions).map(([userId, emojis]) => {
                                        const participant = participants.find(p => p.id === userId);
                                        const name = participant?.fullName || participant?.username || userId.slice(0, 8);
                                        const avatar = participant?.avatarUrl;

                                        return (
                                            <div key={userId} className="flex items-center justify-between px-4 py-3 border-b border-gray-50 hover:bg-[color:var(--bg-hover)]/50 transition-colors">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <img
                                                        src={getAvatarUrl(name, avatar)}
                                                        alt={name}
                                                        className="w-9 h-9 rounded-full object-cover shrink-0"
                                                    />
                                                    <span className="text-sm font-medium text-[color:var(--text-primary)] truncate">{name}</span>
                                                </div>
                                                <div className="flex items-center gap-0.5 shrink-0 ml-2">
                                                    {/* Show unique emojis stacked */}
                                                    {[...new Set(emojis)].map((e) => (
                                                        <span key={e} className="text-base">{e}</span>
                                                    ))}
                                                    <span className="text-xs text-[color:var(--text-secondary)] font-medium ml-1">{emojis.length}</span>
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Message Detail Modal */}
            {showMessageDetail && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={() => setShowMessageDetail(false)}>
                    <div className="bg-[color:var(--bg-primary)] rounded-2xl shadow-2xl w-[380px] max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[color:var(--border-primary)]">
                            <h3 className="text-base font-semibold text-[color:var(--text-primary)]">Chi tiết tin nhắn</h3>
                            <button onClick={() => setShowMessageDetail(false)} className="text-gray-400 hover:text-[color:var(--text-secondary)] p-1 rounded-full hover:bg-[color:var(--bg-secondary)]">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="px-5 py-4 space-y-3 overflow-y-auto max-h-[60vh] text-sm">
                            <div className="flex justify-between">
                                <span className="text-[color:var(--text-secondary)]">Người gửi</span>
                                <span className="font-medium text-[color:var(--text-primary)]">{message.senderName || message.senderId.slice(0, 8)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[color:var(--text-secondary)]">Thời gian</span>
                                <span className="text-[color:var(--text-primary)]">{new Date(message.createdAt).toLocaleString('vi-VN')}</span>
                            </div>
                            {message.content && (
                                <div>
                                    <span className="text-[color:var(--text-secondary)] block mb-1">Nội dung</span>
                                    <p className="text-[color:var(--text-primary)] bg-[color:var(--bg-hover)] rounded-lg p-2.5 break-words [overflow-wrap:anywhere] [word-break:break-word]">{message.content}</p>
                                </div>
                            )}
                            {effectiveFileUrl && (
                                <div className="flex justify-between items-center">
                                    <span className="text-[color:var(--text-secondary)]">Tệp đính kèm</span>
                                    <a href={effectiveFileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline truncate max-w-[180px] text-right">{effectiveFileName || 'Tải xuống'}</a>
                                </div>
                            )}
                            {effectiveFileSize && effectiveFileSize > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-[color:var(--text-secondary)]">Kích thước</span>
                                    <span className="text-[color:var(--text-primary)]">{effectiveFileSize < 1024 * 1024 ? (effectiveFileSize / 1024).toFixed(1) + ' KB' : (effectiveFileSize / (1024 * 1024)).toFixed(1) + ' MB'}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-[color:var(--text-secondary)]">Trạng thái</span>
                                <span className="text-[color:var(--text-primary)]">{message.pinned ? '📌 Đã ghim' : message.isRecall ? '🚫 Đã thu hồi' : '✓ Đã gửi'}</span>
                            </div>
                            {message.readBy && message.readBy.length > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-[color:var(--text-secondary)]">Đã đọc</span>
                                    <span className="text-[color:var(--text-primary)]">{message.readBy.length} người</span>
                                </div>
                            )}
                            {totalReactions > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-[color:var(--text-secondary)]">Biểu cảm</span>
                                    <span className="text-[color:var(--text-primary)]">{sortedEmojis.join(' ')} ({totalReactions})</span>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            )}

            {/* Lightbox (image — hỗ trợ nhiều ảnh trong một tin) */}
            {imageLightbox && imageLightbox.urls.length > 0 && (
                <div
                    className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center"
                    onClick={() => setImageLightbox(null)}
                    role="presentation"
                >
                    <img
                        src={imageLightbox.urls[imageLightbox.index]}
                        alt=""
                        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                    {imageLightbox.urls.length > 1 && (
                        <>
                            <button
                                type="button"
                                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-[color:var(--bg-primary)]/20 hover:bg-[color:var(--bg-primary)]/30 text-white"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setImageLightbox((prev) =>
                                        prev
                                            ? {
                                                ...prev,
                                                index:
                                                    (prev.index - 1 + prev.urls.length) %
                                                    prev.urls.length,
                                            }
                                            : null,
                                    );
                                }}
                                aria-label="Ảnh trước"
                            >
                                ‹
                            </button>
                            <button
                                type="button"
                                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-[color:var(--bg-primary)]/20 hover:bg-[color:var(--bg-primary)]/30 text-white"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setImageLightbox((prev) =>
                                        prev
                                            ? {
                                                ...prev,
                                                index: (prev.index + 1) % prev.urls.length,
                                            }
                                            : null,
                                    );
                                }}
                                aria-label="Ảnh sau"
                            >
                                ›
                            </button>
                            <span className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white text-sm bg-black/40 px-3 py-1 rounded-full">
                                {imageLightbox.index + 1} / {imageLightbox.urls.length}
                            </span>
                        </>
                    )}
                    <button
                        type="button"
                        className="absolute top-4 right-16 w-9 h-9 flex items-center justify-center rounded-full bg-[color:var(--bg-primary)]/20 hover:bg-[color:var(--bg-primary)]/30 text-white transition-colors"
                        onClick={async (e) => {
                            e.stopPropagation();
                            const url = imageLightbox.urls[imageLightbox.index];
                            try {
                                const response = await fetch(url);
                                const blob = await response.blob();
                                const blobUrl = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = blobUrl;
                                a.download = url.split('/').pop()?.split('?')[0] || `image_${Date.now()}.png`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                window.URL.revokeObjectURL(blobUrl);
                            } catch (error) {
                                window.open(url, '_blank');
                            }
                        }}
                        title="Tải về"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                    </button>
                    <button
                        type="button"
                        className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-[color:var(--bg-primary)]/20 hover:bg-[color:var(--bg-primary)]/30 text-white transition-colors"
                        onClick={(e) => {
                            e.stopPropagation();
                            setImageLightbox(null);
                        }}
                        aria-label="Đóng"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            )}

            {/* Hướng dẫn xem thư mục / danh sách tải xuống (web không mở được Explorer) */}
            {downloadsHelpOpen && (
                <div
                    className="fixed inset-0 z-[75] flex items-center justify-center bg-black/45 px-4"
                    onClick={closeDownloadsHelp}
                    role="presentation"
                >
                    <div
                        className="bg-[color:var(--bg-primary)] rounded-xl shadow-xl max-w-md w-full p-5 border border-[color:var(--border-primary)]"
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-labelledby="downloads-help-title"
                    >
                        <h3 id="downloads-help-title" className="text-base font-semibold text-[color:var(--text-primary)] mb-2">
                            Xem file đã tải ở đâu?
                        </h3>
                        {downloadsHelpJustFetched ? (
                            <p className="text-sm text-[color:var(--text-secondary)] leading-relaxed mb-3">
                                File vừa được tải xuống vào thư mục <strong>Tải xuống</strong> mặc định (đúng theo nơi lưu bạn đã cấu hình trong trình duyệt).
                                Trang web không thể mở sẵn File Explorer; dùng phím tắt bên dưới để mở danh sách tải và thấy đường dẫn file.
                            </p>
                        ) : (
                            <p className="text-sm text-[color:var(--text-secondary)] leading-relaxed mb-3">
                                Trình duyệt không cho phép trang web mở trực tiếp thư mục <strong>Tải xuống</strong> trên máy (giống File Explorer).
                                Bạn có thể xem danh sách và đường dẫn như sau:
                            </p>
                        )}
                        <ul className="text-sm text-[color:var(--text-secondary)] list-disc pl-5 space-y-1.5 mb-4">
                            <li>
                                <strong>Chrome / Edge:</strong> nhấn <kbd className="px-1 py-0.5 rounded bg-[color:var(--bg-secondary)] text-xs font-mono">Ctrl</kbd>{' '}
                                + <kbd className="px-1 py-0.5 rounded bg-[color:var(--bg-secondary)] text-xs font-mono">J</kbd>
                            </li>
                            <li>
                                <strong>Firefox:</strong>{' '}
                                <kbd className="px-1 py-0.5 rounded bg-[color:var(--bg-secondary)] text-xs font-mono">Ctrl</kbd> +{' '}
                                <kbd className="px-1 py-0.5 rounded bg-[color:var(--bg-secondary)] text-xs font-mono">Shift</kbd> +{' '}
                                <kbd className="px-1 py-0.5 rounded bg-[color:var(--bg-secondary)] text-xs font-mono">Y</kbd>
                            </li>
                            <li>
                                <strong>Safari (Mac):</strong> menu Window → Downloads
                            </li>
                        </ul>
                        <p className="text-xs text-[color:var(--text-secondary)] mb-4">
                            Sau khi file đã có trên máy, double-click trong thư mục để mở bằng Word, WPS hoặc phần mềm mặc định của hệ điều hành.
                        </p>
                        <button
                            type="button"
                            className="w-full py-2.5 rounded-lg bg-[#0068ff] text-white text-sm font-semibold hover:bg-[#0056d6]"
                            onClick={closeDownloadsHelp}
                        >
                            Đã hiểu
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default MessageBubble;
