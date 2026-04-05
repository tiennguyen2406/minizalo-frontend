import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { searchService } from "@/shared/services/searchService";
import { useThemeStore } from "@/shared/store/themeStore";
import { useChatStore } from "@/shared/store/useChatStore";
import { UserProfile } from "@/shared/services/types";
import { Message, ChatRoom } from "@/shared/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type SearchTab = "all" | "contacts" | "messages" | "files";

interface LocalSearchResults {
    rooms: ChatRoom[];       // khớp tên phòng / người dùng
    messages: Message[];     // khớp nội dung tin nhắn
    files: Message[];        // tin nhắn chứa file/hình ảnh
}

interface GlobalSearchBarProps {
    onSelectRoom: (roomId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Highlight từ khóa trong chuỗi */
function HighlightText({ text, query }: { text: string; query: string }) {
    if (!query.trim()) return <span>{text}</span>;

    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "gi");
    const parts = text.split(regex);
    return (
        <span>
            {parts.map((part, i) =>
                regex.test(part) ? (
                    <mark
                        key={i}
                        style={{
                            background: "rgba(0,104,255,0.15)",
                            color: "#0068ff",
                            fontWeight: 700,
                            borderRadius: 2,
                            padding: "0 1px",
                        }}
                    >
                        {part}
                    </mark>
                ) : (
                    <span key={i}>{part}</span>
                )
            )}
        </span>
    );
}

function formatTime(iso?: string) {
    if (!iso) return "";
    const d = new Date(iso);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
    if (diffDays === 0)
        return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false });
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

function getFileIcon(type: string) {
    if (type === "IMAGE") return "🖼️";
    if (type === "VIDEO") return "🎬";
    return "📄";
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow({ isDark }: { isDark: boolean }) {
    const bg = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: bg, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
                <div style={{ height: 12, background: bg, borderRadius: 6, marginBottom: 6, width: "55%" }} />
                <div style={{ height: 10, background: bg, borderRadius: 6, width: "80%" }} />
            </div>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

const GlobalSearchBar: React.FC<GlobalSearchBarProps> = ({ onSelectRoom }) => {
    const isDark = useThemeStore((s) => s.theme === "dark");

    // Lấy rooms và messages từ store (local data — instant search)
    const rooms = useChatStore((s) => s.rooms);
    const messagesMap = useChatStore((s) => s.messages);

    // Flatten tất cả tin nhắn đã load trong store
    const allMessages = useMemo(
        () => Object.values(messagesMap).flat(),
        [messagesMap]
    );

    const [query, setQuery] = useState("");
    const [activeTab, setActiveTab] = useState<SearchTab>("all");
    const [isOpen, setIsOpen] = useState(false);
    const [isApiLoading, setIsApiLoading] = useState(false);
    const [apiContacts, setApiContacts] = useState<UserProfile[]>([]);
    const [apiMessages, setApiMessages] = useState<Message[]>([]);

    const inputRef = useRef<HTMLInputElement>(null);
    const debouncedQuery = useDebounce(query, 350);

    // ── Tìm kiếm LOCAL ngay lập tức (không cần API) ──────────────────────────
    const localResults = useMemo((): LocalSearchResults => {
        const q = query.trim().toLowerCase();
        if (!q) return { rooms: [], messages: [], files: [] };

        // Tìm phòng/liên hệ theo tên
        const matchedRooms = rooms.filter((r) =>
            r.name.toLowerCase().includes(q)
        );

        // Tìm trong tin nhắn đã load
        const matchedMessages = allMessages.filter(
            (m) =>
                m.type === "TEXT" &&
                !m.isDeleted &&
                !m.isRecall &&
                m.content.toLowerCase().includes(q)
        );

        // Tìm file (IMAGE, VIDEO, FILE, DOCUMENT)
        const matchedFiles = allMessages.filter(
            (m) =>
                ["IMAGE", "VIDEO", "FILE", "DOCUMENT"].includes(m.type) &&
                !m.isDeleted
        );

        return { rooms: matchedRooms, messages: matchedMessages, files: matchedFiles };
    }, [query, rooms, allMessages]);

    // ── Gọi API backend sau debounce để tìm sâu hơn ─────────────────────────
    useEffect(() => {
        if (!debouncedQuery.trim()) {
            setApiContacts([]);
            setApiMessages([]);
            return;
        }
        setIsApiLoading(true);
        searchService
            .searchGlobal(debouncedQuery, "ALL")
            .then((res) => {
                setApiContacts(res.contacts ?? []);
                // Merge API messages, loại trùng với local
                const localIds = new Set(localResults.messages.map((m) => m.id));
                const newMsgs = (res.messages ?? []).filter((m) => !localIds.has(m.id));
                setApiMessages(newMsgs);
            })
            .catch(() => {})
            .finally(() => setIsApiLoading(false));
    }, [debouncedQuery]);

    // ── Merge kết quả local + API ─────────────────────────────────────────────
    const mergedContacts = useMemo(() => {
        // Rooms từ local + API contacts (loại trùng)
        return { rooms: localResults.rooms, profiles: apiContacts };
    }, [localResults.rooms, apiContacts]);

    const mergedMessages = useMemo(
        () => [...localResults.messages, ...apiMessages],
        [localResults.messages, apiMessages]
    );

    const mergedFiles = localResults.files;

    // Tổng số để hiện nhãn tabs
    const totalContacts = mergedContacts.rooms.length + mergedContacts.profiles.length;
    const totalMessages = mergedMessages.length;
    const totalFiles = mergedFiles.length;
    const hasAny = totalContacts + totalMessages + totalFiles > 0;
    const isLoading = query.trim() !== debouncedQuery.trim() || isApiLoading;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setQuery(val);
        setIsOpen(val.trim().length > 0);
        if (!val.trim()) {
            setApiContacts([]);
            setApiMessages([]);
        }
    };

    const handleClose = useCallback(() => {
        setIsOpen(false);
        setQuery("");
        setApiContacts([]);
        setApiMessages([]);
        setActiveTab("all");
    }, []);

    const handleSelectRoom = useCallback(
        (roomId: string, messageId?: string) => {
            if (messageId) {
                useChatStore.getState().setHighlightedMessageId(messageId);
            }
            onSelectRoom(roomId);
            handleClose();
        },
        [onSelectRoom, handleClose]
    );

    const handleSelectContact = useCallback(
        (contact: UserProfile) => {
            const room = rooms.find(
                (r) => r.type === "PRIVATE" && r.participants?.some((p) => p.id === contact.id)
            );
            if (room) handleSelectRoom(room.id);
            else handleClose();
        },
        [rooms, handleSelectRoom, handleClose]
    );

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") handleClose();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [handleClose]);

    // ── Styles ─────────────────────────────────────────────────────────────────
    const inputBg = isDark ? "rgba(255,255,255,0.07)" : "#f1f3f4";
    const inputBgFocus = isDark ? "rgba(255,255,255,0.11)" : "#e8f0fe";
    const dropBg = isDark ? "#1e2130" : "#ffffff";
    const border = isDark ? "rgba(255,255,255,0.1)" : "#e2e6ea";
    const hoverBg = isDark ? "rgba(255,255,255,0.06)" : "#f5f6f7";
    const textPrimary = "var(--text-primary)";
    const textMuted = "var(--text-muted)";

    const tabStyle = (tab: SearchTab): React.CSSProperties => ({
        padding: "6px 12px",
        fontSize: 13,
        fontWeight: activeTab === tab ? 600 : 400,
        color: activeTab === tab ? "#0068ff" : textMuted,
        background: "transparent",
        border: "none",
        borderBottom: activeTab === tab ? "2px solid #0068ff" : "2px solid transparent",
        cursor: "pointer",
        transition: "color 0.15s, border-color 0.15s",
        whiteSpace: "nowrap" as const,
    });

    const rowStyle: React.CSSProperties = {
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        cursor: "pointer",
        transition: "background 0.12s",
    };

    // ── Render sections ────────────────────────────────────────────────────────
    const showContacts = activeTab === "all" || activeTab === "contacts";
    const showMessages = activeTab === "all" || activeTab === "messages";
    const showFiles = activeTab === "all" || activeTab === "files";

    return (
        <div style={{ position: "relative", width: "100%" }}>
            {/* Input */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: isOpen ? inputBgFocus : inputBg,
                    border: `1.5px solid ${isOpen ? "#0068ff" : "transparent"}`,
                    borderRadius: 8,
                    padding: "0 10px",
                    transition: "background 0.2s, border-color 0.2s",
                }}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke={isOpen ? "#0068ff" : textMuted}
                    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{ flexShrink: 0, transition: "stroke 0.2s" }}>
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>

                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={handleChange}
                    onFocus={() => { if (query.trim()) setIsOpen(true); }}
                    placeholder="Tìm kiếm..."
                    style={{
                        flex: 1, background: "transparent", border: "none",
                        outline: "none", fontSize: 13,
                        color: textPrimary, padding: "7px 0",
                    }}
                />

                {query && (
                    <button onClick={handleClose} style={{
                        background: "none", border: "none", cursor: "pointer",
                        padding: 2, color: textMuted, display: "flex", alignItems: "center",
                    }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                )}

                {isOpen && (
                    <button onClick={handleClose} style={{
                        background: "none", border: "none", cursor: "pointer",
                        padding: "4px 6px", color: "#0068ff", fontSize: 12, fontWeight: 500,
                        whiteSpace: "nowrap",
                    }}>
                        Đóng
                    </button>
                )}
            </div>

            {/* Dropdown */}
            {isOpen && (
                <>
                    {/* Overlay */}
                    <div
                        style={{ position: "fixed", inset: 0, zIndex: 40 }}
                        onClick={handleClose}
                    />

                    <div style={{
                        position: "absolute",
                        top: "calc(100% + 6px)",
                        left: 0, right: 0,
                        zIndex: 50,
                        background: dropBg,
                        border: `1px solid ${border}`,
                        borderRadius: 10,
                        boxShadow: isDark
                            ? "0 8px 32px rgba(0,0,0,0.55)"
                            : "0 8px 32px rgba(0,0,0,0.13)",
                        maxHeight: 500,
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                    }}>
                        {/* ── Tabs ── */}
                        <div style={{
                            display: "flex",
                            borderBottom: `1px solid ${border}`,
                            overflowX: "auto",
                            flexShrink: 0,
                            padding: "0 4px",
                        }}>
                            {([
                                ["all", "Tất cả"],
                                ["contacts", `Liên hệ${totalContacts ? ` (${totalContacts})` : ""}`],
                                ["messages", `Tin nhắn${totalMessages ? ` (${totalMessages})` : ""}`],
                                ["files", `File${totalFiles ? ` (${totalFiles})` : ""}`],
                            ] as [SearchTab, string][]).map(([tab, label]) => (
                                <button
                                    key={tab}
                                    onClick={(e) => { e.stopPropagation(); setActiveTab(tab); }}
                                    style={tabStyle(tab)}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        {/* ── Body ── */}
                        <div style={{ overflowY: "auto", flex: 1 }}>
                            {/* Loading */}
                            {isLoading && !hasAny && (
                                <div style={{ padding: "8px 0" }}>
                                    {[1, 2, 3].map((i) => <SkeletonRow key={i} isDark={isDark} />)}
                                </div>
                            )}

                            {/* Empty */}
                            {!isLoading && !hasAny && (
                                <div style={{ padding: "28px 16px", textAlign: "center", color: textMuted }}>
                                    <div style={{ fontSize: 30, marginBottom: 8 }}>🔍</div>
                                    <div style={{ fontSize: 13 }}>
                                        Không tìm thấy kết quả cho <strong>"{query}"</strong>
                                    </div>
                                </div>
                            )}

                            {/* ── CONTACTS section ── */}
                            {showContacts && totalContacts > 0 && (
                                <>
                                    <div style={{
                                        padding: "8px 12px 4px", fontSize: 11, fontWeight: 700,
                                        textTransform: "uppercase", letterSpacing: "0.06em",
                                        color: textMuted,
                                    }}>
                                        Liên hệ & nhóm ({totalContacts})
                                    </div>

                                    {/* Rooms từ store */}
                                    {mergedContacts.rooms.slice(0, 5).map((room) => (
                                        <div key={room.id}
                                            onClick={() => handleSelectRoom(room.id)}
                                            style={rowStyle}
                                            onMouseEnter={(e) => { e.currentTarget.style.background = hoverBg; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                                        >
                                            <img
                                                src={room.avatarUrl ||
                                                    `https://ui-avatars.com/api/?name=${encodeURIComponent(room.name)}&background=4A90D9&color=fff&size=64`}
                                                alt=""
                                                style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                                            />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 14, fontWeight: 500, color: textPrimary }}>
                                                    <HighlightText text={room.name} query={query} />
                                                </div>
                                                <div style={{ fontSize: 12, color: textMuted }}>
                                                    {room.type === "GROUP" ? "Nhóm" : "Liên hệ"}
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {/* API contacts */}
                                    {mergedContacts.profiles.slice(0, 5).map((c) => (
                                        <div key={c.id}
                                            onClick={() => handleSelectContact(c)}
                                            style={rowStyle}
                                            onMouseEnter={(e) => { e.currentTarget.style.background = hoverBg; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                                        >
                                            <img
                                                src={c.avatarUrl ||
                                                    `https://ui-avatars.com/api/?name=${encodeURIComponent(c.displayName || c.username)}&background=0068ff&color=fff&size=64`}
                                                alt=""
                                                style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                                            />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 14, fontWeight: 500, color: textPrimary }}>
                                                    <HighlightText text={c.displayName || c.username} query={query} />
                                                </div>
                                                {c.phone && (
                                                    <div style={{ fontSize: 12, color: textMuted }}>{c.phone}</div>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    {/* Divider */}
                                    {(showMessages && totalMessages > 0) || (showFiles && totalFiles > 0) ? (
                                        <div style={{ height: 1, background: border, margin: "4px 0" }} />
                                    ) : null}
                                </>
                            )}

                            {/* ── MESSAGES section ── */}
                            {showMessages && totalMessages > 0 && (
                                <>
                                    <div style={{
                                        padding: "8px 12px 4px", fontSize: 11, fontWeight: 700,
                                        textTransform: "uppercase", letterSpacing: "0.06em",
                                        color: textMuted,
                                    }}>
                                        Tin nhắn ({totalMessages > 16 ? "16+" : totalMessages})
                                    </div>

                                    {mergedMessages.slice(0, 8).map((msg) => {
                                        // Tìm tên phòng để hiện context
                                        const room = rooms.find((r) => r.id === msg.roomId);
                                        return (
                                            <div key={msg.id}
                                                onClick={() => handleSelectRoom(msg.roomId, msg.id)}
                                                style={rowStyle}
                                                onMouseEnter={(e) => { e.currentTarget.style.background = hoverBg; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                                            >
                                                <img
                                                    src={room?.avatarUrl ||
                                                        `https://ui-avatars.com/api/?name=${encodeURIComponent(room?.name || "?")}&background=4A90D9&color=fff&size=64`}
                                                    alt=""
                                                    style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                                                />
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{
                                                        display: "flex", justifyContent: "space-between",
                                                        alignItems: "center", gap: 8,
                                                    }}>
                                                        <span style={{ fontSize: 13, fontWeight: 500, color: textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                            {room?.name || msg.senderId}
                                                        </span>
                                                        <span style={{ fontSize: 11, color: textMuted, flexShrink: 0 }}>
                                                            {formatTime(msg.createdAt)}
                                                        </span>
                                                    </div>
                                                    <div style={{ fontSize: 12, color: textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                        {msg.senderName ? `${msg.senderName}: ` : ""}
                                                        <HighlightText text={msg.content} query={query} />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {totalMessages > 8 && (
                                        <div style={{
                                            padding: "8px 12px 10px",
                                            textAlign: "center", fontSize: 13,
                                            color: "#0068ff", cursor: "pointer", fontWeight: 500,
                                        }}
                                            onClick={() => setActiveTab("messages")}
                                        >
                                            Xem tất cả tin nhắn ({totalMessages})
                                        </div>
                                    )}

                                    {showFiles && totalFiles > 0 && (
                                        <div style={{ height: 1, background: border, margin: "4px 0" }} />
                                    )}
                                </>
                            )}

                            {/* ── FILES section ── */}
                            {showFiles && totalFiles > 0 && (
                                <>
                                    <div style={{
                                        padding: "8px 12px 4px", fontSize: 11, fontWeight: 700,
                                        textTransform: "uppercase", letterSpacing: "0.06em",
                                        color: textMuted,
                                    }}>
                                        File ({totalFiles})
                                    </div>

                                    {mergedFiles.slice(0, 5).map((msg) => {
                                        const room = rooms.find((r) => r.id === msg.roomId);
                                        const name = msg.fileName || msg.attachments?.[0]?.name || "File";
                                        const senderShort = msg.senderName?.split(" ").pop() || "";
                                        return (
                                            <div key={msg.id}
                                                onClick={() => handleSelectRoom(msg.roomId, msg.id)}
                                                style={rowStyle}
                                                onMouseEnter={(e) => { e.currentTarget.style.background = hoverBg; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                                            >
                                                <div style={{
                                                    width: 36, height: 36, borderRadius: 8,
                                                    background: isDark ? "rgba(255,255,255,0.1)" : "#e8f0fe",
                                                    display: "flex", alignItems: "center",
                                                    justifyContent: "center", fontSize: 18, flexShrink: 0,
                                                }}>
                                                    {getFileIcon(msg.type)}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: 13, fontWeight: 500, color: textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                        {name}
                                                    </div>
                                                    <div style={{ fontSize: 12, color: textMuted }}>
                                                        {senderShort && `${senderShort} · `}
                                                        {room?.name || ""}
                                                        {" · "}
                                                        <span>{formatTime(msg.createdAt)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </>
                            )}

                            <div style={{ height: 6 }} />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default GlobalSearchBar;
