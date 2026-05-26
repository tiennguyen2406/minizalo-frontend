import React, { useEffect, useState } from "react";
import { chatService, MessageDynamo } from "@/shared/services/chatService";
import { User } from "@/shared/types";
import { useChatStore } from "@/shared/store/useChatStore";

function startOfDayIso(dateStr: string): string {
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return "";
    return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
}

function endOfDayIso(dateStr: string): string {
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return "";
    return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
}

interface SearchMessagePanelProps {
    roomId: string;
    roomName: string;
    participants: User[];
    onClose: () => void;
}

const SearchMessagePanel: React.FC<SearchMessagePanelProps> = ({
    roomId,
    roomName,
    participants,
    onClose,
}) => {
    const setHighlightedMessageId = useChatStore((s) => s.setHighlightedMessageId);

    const [query, setQuery] = useState("");
    const [senderId, setSenderId] = useState("");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [messages, setMessages] = useState<MessageDynamo[]>([]);
    const [loading, setLoading] = useState(false);
    const [fetchingMore, setFetchingMore] = useState(false);
    const [lastKey, setLastKey] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);

    const hasAnyFilter =
        !!(query.trim() || senderId || fromDate || toDate);

    useEffect(() => {
        const t = setTimeout(async () => {
            if (!roomId) return;
            if (!query.trim() && !senderId && !fromDate && !toDate) {
                setMessages([]);
                setLastKey(null);
                setHasMore(false);
                return;
            }
            setLoading(true);
            setMessages([]);
            setLastKey(null);
            setHasMore(false);
            try {
                const filters: { senderId?: string; fromDate?: string; toDate?: string } = {};
                if (senderId) filters.senderId = senderId;
                if (fromDate) filters.fromDate = startOfDayIso(fromDate);
                if (toDate) filters.toDate = endOfDayIso(toDate);
                const response = await chatService.searchMessages(
                    roomId,
                    query.trim(),
                    20,
                    undefined,
                    Object.keys(filters).length ? filters : undefined
                );
                setMessages(response.messages || []);
                setLastKey(response.lastKey || null);
                setHasMore(response.hasMore || false);
            } catch (e) {
                console.error("Search messages failed", e);
            } finally {
                setLoading(false);
            }
        }, 450);
        return () => clearTimeout(t);
    }, [query, senderId, fromDate, toDate, roomId]);

    const loadMore = async () => {
        if (!hasAnyFilter || !hasMore || fetchingMore || !lastKey) return;
        setFetchingMore(true);
        try {
            const filters: { senderId?: string; fromDate?: string; toDate?: string } = {};
            if (senderId) filters.senderId = senderId;
            if (fromDate) filters.fromDate = startOfDayIso(fromDate);
            if (toDate) filters.toDate = endOfDayIso(toDate);
            const response = await chatService.searchMessages(
                roomId,
                query.trim(),
                20,
                lastKey,
                Object.keys(filters).length ? filters : undefined
            );
            setMessages((prev) => [...prev, ...(response.messages || [])]);
            setLastKey(response.lastKey || null);
            setHasMore(response.hasMore || false);
        } catch (e) {
            console.error("Search load more failed", e);
        } finally {
            setFetchingMore(false);
        }
    };

    const formatTime = (iso?: string) => {
        if (!iso) return "";
        try {
            const d = new Date(iso);
            return (
                d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) +
                " " +
                d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
            );
        } catch {
            return "";
        }
    };

    const snippet = (item: MessageDynamo) => {
        if (item.content?.trim()) return item.content;
        if (item.attachments?.length) {
            const a = item.attachments[0];
            const mime = (a.type || "").toLowerCase();
            if (mime.startsWith("image/")) return "[Ảnh]";
            if (mime.startsWith("video/")) return "[Video]";
            return `[Tệp: ${a.name || a.filename || "đính kèm"}]`;
        }
        return "[Tin nhắn]";
    };

    return (
        <div
            className="flex h-full w-[320px] shrink-0 flex-col border-l border-[color:var(--border-primary)] bg-[color:var(--bg-primary)] shadow-sm"
            style={{ backgroundColor: "var(--bg-primary, #fff)" }}
        >
            <div
                className="flex h-14 shrink-0 items-center justify-between border-b px-3"
                style={{ borderColor: "var(--border-primary, #e5e7eb)" }}
            >
                <span className="truncate pr-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    Tìm kiếm trong trò chuyện
                </span>
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-full p-1.5 text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-secondary)]"
                    title="Đóng"
                >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="shrink-0 space-y-3 border-b p-3" style={{ borderColor: "var(--border-primary, #e5e7eb)" }}>
                <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Nhập từ khóa để tìm kiếm"
                    className="w-full rounded-lg border border-[color:var(--border-primary)] px-3 py-2 text-sm outline-none focus:border-blue-400"
                />
                <div className="text-xs font-medium text-[color:var(--text-secondary)]">Lọc theo</div>
                <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-xs text-[color:var(--text-secondary)]">
                        <span className="w-20 shrink-0">Người gửi</span>
                        <select
                            value={senderId}
                            onChange={(e) => setSenderId(e.target.value)}
                            className="min-w-0 flex-1 rounded border border-[color:var(--border-primary)] px-2 py-1.5 text-sm"
                        >
                            <option value="">Tất cả</option>
                            {participants.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.fullName || p.username || p.id.slice(0, 8)}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-[color:var(--text-secondary)]">
                        <span className="w-20 shrink-0">Từ ngày</span>
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            className="min-w-0 flex-1 rounded border border-[color:var(--border-primary)] px-2 py-1.5 text-sm"
                        />
                    </label>
                    <label className="flex items-center gap-2 text-xs text-[color:var(--text-secondary)]">
                        <span className="w-20 shrink-0">Đến ngày</span>
                        <input
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            className="min-w-0 flex-1 rounded border border-[color:var(--border-primary)] px-2 py-1.5 text-sm"
                        />
                    </label>
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {loading ? (
                    <div className="flex justify-center py-8 text-sm text-[color:var(--text-secondary)]">Đang tìm…</div>
                ) : !hasAnyFilter ? (
                    <div className="flex flex-col items-center justify-center px-4 py-10 text-center text-sm text-[color:var(--text-secondary)]">
                        <svg className="mb-3 h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                        </svg>
                        Hãy nhập từ khóa hoặc chọn bộ lọc để tìm tin nhắn trong {roomName}.
                    </div>
                ) : messages.length === 0 ? (
                    <div className="py-8 text-center text-sm text-[color:var(--text-secondary)]">Không có kết quả.</div>
                ) : (
                    <ul className="space-y-1">
                        {messages.map((item) => (
                            <li key={item.messageId}>
                                <button
                                    type="button"
                                    className="w-full rounded-lg border border-transparent px-2 py-2 text-left text-sm hover:border-blue-100 hover:bg-blue-50/80"
                                    onClick={() => {
                                        setHighlightedMessageId(item.messageId);
                                        onClose();
                                    }}
                                >
                                    <div className="font-medium text-blue-700">{item.senderName || "Người dùng"}</div>
                                    <div className="line-clamp-2 text-[color:var(--text-primary)]">{snippet(item)}</div>
                                    <div className="mt-0.5 text-xs text-gray-400">{formatTime(item.createdAt)}</div>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
                {hasMore && !loading && hasAnyFilter ? (
                    <button
                        type="button"
                        className="mt-2 w-full rounded-lg py-2 text-sm text-blue-600 hover:bg-blue-50"
                        disabled={fetchingMore}
                        onClick={() => loadMore()}
                    >
                        {fetchingMore ? "Đang tải…" : "Tải thêm"}
                    </button>
                ) : null}
            </div>
        </div>
    );
};

export default SearchMessagePanel;
