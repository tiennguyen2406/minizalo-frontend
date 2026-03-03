import React, { useCallback } from "react";
import { useThemeStore } from "@/shared/store/themeStore";
import { GlobalSearchResult } from "@/shared/services/searchService";
import { UserProfile } from "@/shared/services/types";
import { Message } from "@/shared/types";

interface SearchResultsDropdownProps {
    query: string;
    results: GlobalSearchResult | null;
    isLoading: boolean;
    onSelectContact: (contact: UserProfile) => void;
    onSelectMessage: (message: Message) => void;
    onClose: () => void;
}

// ─── Keyword highlighter ──────────────────────────────────────────────────────

function HighlightedText({
    text,
    query,
    style,
}: {
    text: string;
    query: string;
    style?: React.CSSProperties;
}) {
    if (!query.trim()) return <span style={style}>{text}</span>;

    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    const parts = text.split(regex);

    return (
        <span style={style}>
            {parts.map((part, i) =>
                regex.test(part) ? (
                    <mark
                        key={i}
                        style={{
                            background: "rgba(0,104,255,0.18)",
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

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow({ isDark }: { isDark: boolean }) {
    const bg = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: bg, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
                <div style={{ height: 12, background: bg, borderRadius: 6, marginBottom: 6, width: "60%" }} />
                <div style={{ height: 10, background: bg, borderRadius: 6, width: "85%" }} />
            </div>
        </div>
    );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
    return (
        <div
            style={{
                padding: "6px 12px 4px",
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--text-muted)",
            }}
        >
            {label}
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

const SearchResultsDropdown: React.FC<SearchResultsDropdownProps> = React.memo(({
    query,
    results,
    isLoading,
    onSelectContact,
    onSelectMessage,
    onClose,
}) => {
    const isDark = useThemeStore((s) => s.theme === "dark");

    const dropdownBg = isDark ? "var(--bg-secondary)" : "#fff";
    const borderColor = isDark ? "rgba(255,255,255,0.1)" : "#e5e7eb";
    const hoverBg = isDark ? "rgba(255,255,255,0.06)" : "#f3f4f6";
    const textPrimary = "var(--text-primary)";
    const textMuted = "var(--text-muted)";

    const hasContacts = (results?.contacts.length ?? 0) > 0;
    const hasMessages = (results?.messages.length ?? 0) > 0;
    const isEmpty = !isLoading && results && !hasContacts && !hasMessages;

    const formatTime = useCallback((iso: string) => {
        const d = new Date(iso);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
        if (diffDays === 0) return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false });
        if (diffDays < 7) return `${diffDays} ngày trước`;
        return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
    }, []);

    return (
        <>
            {/* Overlay bắt click bên ngoài */}
            <div
                style={{ position: "fixed", inset: 0, zIndex: 40 }}
                onClick={onClose}
            />

            {/* Dropdown panel */}
            <div
                style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    left: 0,
                    right: 0,
                    zIndex: 50,
                    background: dropdownBg,
                    border: `1px solid ${borderColor}`,
                    borderRadius: 10,
                    boxShadow: isDark
                        ? "0 8px 32px rgba(0,0,0,0.6)"
                        : "0 8px 32px rgba(0,0,0,0.12)",
                    maxHeight: 480,
                    overflowY: "auto",
                    transition: "opacity 0.15s ease",
                }}
            >
                {/* Loading skeletons */}
                {isLoading && (
                    <div style={{ padding: "8px 0" }}>
                        {[1, 2, 3].map((i) => (
                            <SkeletonRow key={i} isDark={isDark} />
                        ))}
                    </div>
                )}

                {/* Empty state */}
                {isEmpty && (
                    <div
                        style={{
                            padding: "28px 16px",
                            textAlign: "center",
                            color: textMuted,
                        }}
                    >
                        <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
                        <div style={{ fontSize: 14 }}>
                            Không tìm thấy kết quả cho <strong>"{query}"</strong>
                        </div>
                    </div>
                )}

                {/* Contact results */}
                {!isLoading && hasContacts && (
                    <>
                        <SectionHeader label="Liên hệ" />
                        {results!.contacts.map((contact) => (
                            <div
                                key={contact.id}
                                onClick={() => onSelectContact(contact)}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                    padding: "9px 12px",
                                    cursor: "pointer",
                                    transition: "background 0.12s ease",
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = hoverBg;
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = "transparent";
                                }}
                            >
                                <img
                                    src={
                                        contact.avatarUrl ||
                                        `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                            contact.displayName || contact.username
                                        )}&background=4A90D9&color=fff&size=64`
                                    }
                                    alt=""
                                    style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: "50%",
                                        objectFit: "cover",
                                        flexShrink: 0,
                                    }}
                                />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <HighlightedText
                                        text={contact.displayName || contact.username}
                                        query={query}
                                        style={{ fontSize: 14, fontWeight: 500, color: textPrimary }}
                                    />
                                    {contact.phone && (
                                        <div style={{ fontSize: 12, color: textMuted, marginTop: 1 }}>
                                            {contact.phone}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </>
                )}

                {/* Divider between sections */}
                {!isLoading && hasContacts && hasMessages && (
                    <div style={{ height: 1, background: borderColor, margin: "4px 0" }} />
                )}

                {/* Message results */}
                {!isLoading && hasMessages && (
                    <>
                        <SectionHeader label="Tin nhắn" />
                        {results!.messages.map((msg) => (
                            <div
                                key={msg.id}
                                onClick={() => onSelectMessage(msg)}
                                style={{
                                    display: "flex",
                                    alignItems: "flex-start",
                                    gap: 10,
                                    padding: "9px 12px",
                                    cursor: "pointer",
                                    transition: "background 0.12s ease",
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = hoverBg;
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = "transparent";
                                }}
                            >
                                <div
                                    style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: "50%",
                                        background: "#4A90D9",
                                        flexShrink: 0,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: "#fff",
                                        fontSize: 16,
                                    }}
                                >
                                    💬
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            gap: 8,
                                        }}
                                    >
                                        <span style={{ fontSize: 13, fontWeight: 500, color: textPrimary }}>
                                            {msg.senderName || msg.senderId}
                                        </span>
                                        <span style={{ fontSize: 11, color: textMuted, flexShrink: 0 }}>
                                            {formatTime(msg.createdAt)}
                                        </span>
                                    </div>
                                    <HighlightedText
                                        text={msg.content}
                                        query={query}
                                        style={{
                                            fontSize: 13,
                                            color: textMuted,
                                            display: "block",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                            maxWidth: "100%",
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                    </>
                )}

                {/* Bottom padding */}
                {!isEmpty && !isLoading && <div style={{ height: 6 }} />}
            </div>
        </>
    );
});

SearchResultsDropdown.displayName = "SearchResultsDropdown";

export default SearchResultsDropdown;
