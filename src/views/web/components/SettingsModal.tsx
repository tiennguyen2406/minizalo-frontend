import React, { useMemo, useRef, useState, useEffect } from "react";
import { useUserStore } from "@/shared/store/userStore";
import {
    PRIVACY_AUDIENCE_OPTIONS,
    normalizePrivacyAudience,
} from "@/shared/constants/privacyAudience";
import type { PrivacyAudience } from "@/shared/services/types";
import { useChatStore } from "@/shared/store/useChatStore";
import { showToast as toast } from '@/shared/utils/toast';

const iconClose = (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);



export default function SettingsModal({ onClose }: { onClose: () => void }) {
    const [activeTab, setActiveTab] = useState("privacy");
    const { profile, updateProfile, fetchProfile } = useUserStore();
    const rooms = useChatStore((s) => s.rooms);

    useEffect(() => {
        void fetchProfile();
    }, [fetchProfile]);
    const [updating, setUpdating] = useState(false);

    const handleSyncData = async () => {
        setUpdating(true);
        try {
            const { chatService, mapChatRoomResponseToFrontend } = await import("@/shared/services/chatService");
            const data = await chatService.getChatRooms();
            const mapped = data.map((r) => {
                const base = mapChatRoomResponseToFrontend(r);
                const ridStr = String(r.id);
                const currentOpen = useChatStore.getState().currentRoomId;
                const unreadCount =
                    currentOpen && String(currentOpen) === ridStr ? 0 : (r.unreadCount || 0);
                return { ...base, unreadCount };
            });
            useChatStore.getState().mergeRooms(mapped);
            toast.success("Đồng bộ tin nhắn thành công!");
        } catch (e) {
            console.error("[SettingsModal] sync messages failed", e);
            toast.error("Đồng bộ thất bại, vui lòng thử lại sau.");
        } finally {
            setUpdating(false);
        }
    };

    const tabs = [
        { id: "privacy", label: "Quyền riêng tư", icon: (
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
        )},
        { id: "sync", label: "Đồng bộ tin nhắn", icon: (
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                <path d="M16 21v-5h5" />
            </svg>
        )},
    ];

    const handleTogglePhoneSearch = async () => {
        if (!profile) return;
        setUpdating(true);
        try {
            const currentVal = profile.allowPhoneSearch ?? false;
            await updateProfile({ allowPhoneSearch: !currentVal });
        } catch (e) {
            console.error(e);
        } finally {
            setUpdating(false);
        }
    };

    /** State cục bộ: tránh <select> controlled bị kẹt EVERYONE khi đang gọi API (re-render trước khi profile cập nhật). */
    const [messagePrivacyUi, setMessagePrivacyUi] = useState<PrivacyAudience>(() =>
        normalizePrivacyAudience(undefined),
    );
    const [callPrivacyUi, setCallPrivacyUi] = useState<PrivacyAudience>(() =>
        normalizePrivacyAudience(undefined),
    );

    useEffect(() => {
        if (!profile) return;
        setMessagePrivacyUi(normalizePrivacyAudience(profile.allowMessagesFrom));
        setCallPrivacyUi(normalizePrivacyAudience(profile.allowCallsFrom));
    }, [profile?.id, profile?.allowMessagesFrom, profile?.allowCallsFrom]);

    const setMessagePrivacy = async (value: PrivacyAudience) => {
        if (!profile) return;
        setMessagePrivacyUi(value);
        setUpdating(true);
        try {
            await updateProfile({ allowMessagesFrom: value });
        } catch (e) {
            console.error(e);
            setMessagePrivacyUi(
                normalizePrivacyAudience(useUserStore.getState().profile?.allowMessagesFrom),
            );
        } finally {
            setUpdating(false);
        }
    };

    const setCallPrivacy = async (value: PrivacyAudience) => {
        if (!profile) return;
        setCallPrivacyUi(value);
        setUpdating(true);
        try {
            await updateProfile({ allowCallsFrom: value });
        } catch (e) {
            console.error(e);
            setCallPrivacyUi(
                normalizePrivacyAudience(useUserStore.getState().profile?.allowCallsFrom),
            );
        } finally {
            setUpdating(false);
        }
    };

    const allowPhoneSearch = profile?.allowPhoneSearch ?? false;

    const selectStyle: React.CSSProperties = {
        fontSize: 14,
        padding: "8px 32px 8px 12px",
        borderRadius: 8,
        border: "1px solid var(--border-primary, #e5e7eb)",
        backgroundColor: "var(--bg-primary, #ffffff)",
        color: "var(--text-primary, #111)",
        minWidth: 188,
        cursor: "pointer",
        appearance: "none" as const,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 10px center",
    };

    return (
        <div
            role="dialog"
            style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1200,
            }}
            onClick={onClose}
        >
            <div
                style={{
                    width: 800,
                    height: 600,
                    backgroundColor: "var(--bg-primary, #ffffff)",
                    borderRadius: 8,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    boxShadow: "0 8px 30px rgba(0,0,0,0.2)",
                    color: "var(--text-primary, #111)",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    style={{
                        padding: "16px 24px",
                        borderBottom: "1px solid var(--border-primary, #e5e7eb)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        backgroundColor: "var(--bg-secondary, #f9fafb)",
                    }}
                >
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Cài đặt</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            color: "var(--text-tertiary, #6b7280)",
                        }}
                    >
                        {iconClose}
                    </button>
                </div>

                {/* Body */}
                <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
                    {/* Sidebar */}
                    <div
                        style={{
                            width: 250,
                            borderRight: "1px solid var(--border-primary, #e5e7eb)",
                            overflowY: "auto",
                            backgroundColor: "var(--bg-secondary, #f9fafb)",
                            padding: "12px 8px",
                        }}
                    >
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    width: "100%",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 12,
                                    padding: "12px 16px",
                                    border: "none",
                                    borderRadius: 6,
                                    backgroundColor: activeTab === tab.id ? "rgba(0,104,255,0.1)" : "transparent",
                                    color: activeTab === tab.id ? "#0068FF" : "var(--text-secondary, #4b5563)",
                                    fontSize: 15,
                                    fontWeight: activeTab === tab.id ? 600 : 400,
                                    cursor: "pointer",
                                    textAlign: "left",
                                    marginBottom: 4,
                                }}
                            >
                                <span style={{ display: "flex", opacity: activeTab === tab.id ? 1 : 0.7 }}>
                                    {tab.icon}
                                </span>
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, backgroundColor: "var(--bg-primary, #ffffff)", overflowY: "auto" }}>
                        {activeTab === "privacy" && (
                            <div>
                                <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-primary, #e5e7eb)", backgroundColor: "var(--bg-secondary, #f9fafb)" }}>
                                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--text-secondary, #4b5563)" }}>
                                        Nguồn tìm kiếm
                                    </h3>
                                </div>
                                <div style={{ padding: 24 }}>
                                    <div
                                        style={{
                                            border: "1px solid var(--border-primary, #e5e7eb)",
                                            borderRadius: 8,
                                            padding: 16,
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontSize: 15, color: "var(--text-primary, #111)", marginBottom: 6 }}>
                                                Cho phép người lạ tìm thấy và kết bạn qua số điện thoại
                                            </div>
                                            {profile?.phone && (
                                                <div style={{ fontSize: 14, color: "var(--text-primary, #111)", fontWeight: 500 }}>
                                                    {profile.phone.startsWith("+84")
                                                        ? profile.phone.replace("+84", "+(84) ")
                                                        : profile.phone.startsWith("84") && profile.phone.length >= 11
                                                            ? `+(84) ${profile.phone.substring(2)}`
                                                            : profile.phone}
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleTogglePhoneSearch}
                                            disabled={updating}
                                            style={{
                                                width: 44,
                                                height: 24,
                                                borderRadius: 12,
                                                backgroundColor: allowPhoneSearch ? "#0068FF" : "#d1d5db",
                                                border: "none",
                                                padding: 2,
                                                cursor: updating ? "wait" : "pointer",
                                                position: "relative",
                                                transition: "background-color 0.2s",
                                                flexShrink: 0,
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: 20,
                                                    height: 20,
                                                    borderRadius: 10,
                                                    backgroundColor: "#fff",
                                                    transform: allowPhoneSearch ? "translateX(20px)" : "translateX(0)",
                                                    transition: "transform 0.2s",
                                                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                                                }}
                                            />
                                        </button>
                                    </div>

                                    <h3
                                        style={{
                                            margin: "24px 0 12px",
                                            fontSize: 16,
                                            fontWeight: 700,
                                            color: "var(--text-primary, #111827)",
                                        }}
                                    >
                                        Tin nhắn và cuộc gọi
                                    </h3>
                                    <div
                                        style={{
                                            border: "1px solid var(--border-primary, #e5e7eb)",
                                            borderRadius: 8,
                                            overflow: "hidden",
                                        }}
                                    >
                                        <div
                                            style={{
                                                padding: 16,
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "flex-start",
                                                gap: 16,
                                            }}
                                        >
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div
                                                    style={{
                                                        fontSize: 15,
                                                        fontWeight: 500,
                                                        color: "var(--text-primary, #111)",
                                                    }}
                                                >
                                                    Cho phép nhắn tin
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: 13,
                                                        color: "var(--text-muted, #6b7280)",
                                                        marginTop: 4,
                                                        lineHeight: 1.4,
                                                    }}
                                                >
                                                    Ai được nhắn tin cho bạn
                                                </div>
                                            </div>
                                            <select
                                                aria-label="Ai được nhắn tin cho bạn"
                                                value={messagePrivacyUi}
                                                onChange={(e) =>
                                                    void setMessagePrivacy(
                                                        e.target.value as PrivacyAudience,
                                                    )
                                                }
                                                style={selectStyle}
                                            >
                                                {PRIVACY_AUDIENCE_OPTIONS.map((o) => (
                                                    <option key={o.value} value={o.value}>
                                                        {o.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div
                                            style={{
                                                borderTop: "1px solid var(--border-primary, #e5e7eb)",
                                            }}
                                        />
                                        <div
                                            style={{
                                                padding: 16,
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "flex-start",
                                                gap: 16,
                                            }}
                                        >
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div
                                                    style={{
                                                        fontSize: 15,
                                                        fontWeight: 500,
                                                        color: "var(--text-primary, #111)",
                                                    }}
                                                >
                                                    Cho phép gọi điện
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: 13,
                                                        color: "var(--text-muted, #6b7280)",
                                                        marginTop: 4,
                                                        lineHeight: 1.4,
                                                    }}
                                                >
                                                    Ai được gọi điện cho bạn
                                                </div>
                                            </div>
                                            <select
                                                aria-label="Ai được gọi điện cho bạn"
                                                value={callPrivacyUi}
                                                onChange={(e) =>
                                                    void setCallPrivacy(
                                                        e.target.value as PrivacyAudience,
                                                    )
                                                }
                                                style={selectStyle}
                                            >
                                                {PRIVACY_AUDIENCE_OPTIONS.map((o) => (
                                                    <option key={o.value} value={o.value}>
                                                        {o.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        {activeTab === "sync" && (
                            <div>
                                <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-primary, #e5e7eb)", backgroundColor: "var(--bg-secondary, #f9fafb)" }}>
                                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--text-secondary, #4b5563)" }}>
                                        Đồng bộ tin nhắn
                                    </h3>
                                </div>

                                <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
                                    <div
                                        style={{
                                            border: "1px solid var(--border-primary, #e5e7eb)",
                                            borderRadius: 8,
                                            padding: 16,
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            gap: 16,
                                        }}
                                    >
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary, #111)" }}>
                                                Đồng bộ từ điện thoại
                                            </div>
                                            <div style={{ fontSize: 13, color: "var(--text-muted, #6b7280)", marginTop: 4, lineHeight: 1.4 }}>
                                                Cập nhật dữ liệu trò chuyện mới nhất từ máy chủ để đảm bảo web và mobile đang hiển thị đồng nhất.
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => void handleSyncData()}
                                            disabled={updating}
                                            style={{
                                                padding: "10px 14px",
                                                borderRadius: 8,
                                                border: "none",
                                                backgroundColor: updating ? "#d1d5db" : "#0068FF",
                                                color: updating ? "#4b5563" : "#fff",
                                                cursor: updating ? "wait" : "pointer",
                                                fontSize: 13,
                                                fontWeight: 700,
                                                flexShrink: 0,
                                                transition: "background-color 0.2s"
                                            }}
                                        >
                                            {updating ? "Đang đồng bộ..." : "Đồng bộ ngay"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
}
