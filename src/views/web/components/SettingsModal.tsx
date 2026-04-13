import React, { useMemo, useRef, useState, useEffect } from "react";
import { useUserStore } from "@/shared/store/userStore";
import {
    PRIVACY_AUDIENCE_OPTIONS,
    normalizePrivacyAudience,
} from "@/shared/constants/privacyAudience";
import type { PrivacyAudience } from "@/shared/services/types";
import { useChatStore } from "@/shared/store/useChatStore";

const iconClose = (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

const iconGear = (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
);

const iconShield = (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
    </svg>
);

const iconLock = (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
);

const iconSync = (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
        <path d="M16 21v-5h5" />
    </svg>
);

const iconDatabase = (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
    </svg>
);

const iconBrush = (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08" />
        <path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z" />
    </svg>
);

const iconBell = (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
);

const iconMessage = (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        <path d="M9 10h.01M15 10h.01M9.5 15a3.5 3.5 0 0 0 5 0" />
    </svg>
);

const iconPhone = (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
);

const iconSliders = (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="21" x2="4" y2="14" />
        <line x1="4" y1="10" x2="4" y2="3" />
        <line x1="12" y1="21" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12" y2="3" />
        <line x1="20" y1="21" x2="20" y2="16" />
        <line x1="20" y1="12" x2="20" y2="3" />
        <line x1="1" y1="14" x2="7" y2="14" />
        <line x1="9" y1="8" x2="15" y2="8" />
        <line x1="17" y1="16" x2="23" y2="16" />
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

    // ── Data storage (web) ────────────────────────────────────────────────────
    // Lưu DirectoryHandle trong memory (session). Trình duyệt chỉ cho persist nếu dùng IndexedDB + permission;
    // ở đây ưu tiên đơn giản & ổn định: nếu reload trang sẽ cần chọn lại thư mục.
    const downloadDirHandleRef = useRef<any | null>(null);
    const [downloadDirLabel, setDownloadDirLabel] = useState<string>("Chưa chọn");

    const canPickDirectory = useMemo(() => {
        if (typeof window === "undefined") return false;
        return typeof (window as any).showDirectoryPicker === "function";
    }, []);

    const pickDownloadDirectory = async () => {
        try {
            if (!canPickDirectory) return;
            const handle = await (window as any).showDirectoryPicker({
                id: "minizalo-download-dir",
                mode: "readwrite",
            });
            downloadDirHandleRef.current = handle;
            setDownloadDirLabel(handle?.name ? String(handle.name) : "Đã chọn thư mục");
        } catch (e) {
            // user cancelled or not supported
            console.warn("[SettingsModal] pick directory cancelled/failed", e);
        }
    };

    const clearDownloadDirectory = () => {
        downloadDirHandleRef.current = null;
        setDownloadDirLabel("Chưa chọn");
    };

    const saveBlob = async (filename: string, blob: Blob) => {
        const dir = downloadDirHandleRef.current;
        // Ưu tiên lưu thẳng vào thư mục đã chọn (File System Access API)
        if (dir && typeof dir.getFileHandle === "function") {
            const fileHandle = await dir.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            return;
        }
        // Fallback: tải xuống theo mặc định của trình duyệt (Save As/Downloads)
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    const handleDownloadData = async () => {
        try {
            const payload = {
                exportedAt: new Date().toISOString(),
                profile: profile ?? null,
                rooms,
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], {
                type: "application/json;charset=utf-8",
            });
            await saveBlob(`minizalo-data-${Date.now()}.json`, blob);
        } catch (e) {
            console.error("[SettingsModal] download data failed", e);
        }
    };

    const tabs = [
        { id: "general", label: "Cài đặt chung", icon: iconGear },
        { id: "account", label: "Tài khoản và bảo mật", icon: iconShield },
        { id: "privacy", label: "Quyền riêng tư", icon: iconLock },
        { id: "sync", label: "Đồng bộ tin nhắn", icon: iconSync },
        { id: "data", label: "Quản lý dữ liệu", icon: iconDatabase },
        { id: "theme", label: "Giao diện", icon: iconBrush },
        { id: "notifications", label: "Thông báo", icon: iconBell },
        { id: "messages", label: "Tin nhắn", icon: iconMessage },
        { id: "calls", label: "Cài đặt cuộc gọi", icon: iconPhone },
        { id: "utilities", label: "Tiện ích", icon: iconSliders },
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
                        {activeTab === "data" && (
                            <div>
                                <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-primary, #e5e7eb)", backgroundColor: "var(--bg-secondary, #f9fafb)" }}>
                                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--text-secondary, #4b5563)" }}>
                                        Quản lý dữ liệu
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
                                                Dữ liệu lưu trữ
                                            </div>
                                            <div style={{ fontSize: 13, color: "var(--text-muted, #6b7280)", marginTop: 4, lineHeight: 1.4 }}>
                                                {canPickDirectory
                                                    ? `Thư mục đã chọn: ${downloadDirLabel}`
                                                    : "Trình duyệt chưa hỗ trợ chọn thư mục. Dữ liệu sẽ tải về thư mục mặc định (Downloads/Save As)."}
                                            </div>
                                        </div>

                                        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                                            <button
                                                type="button"
                                                onClick={() => void pickDownloadDirectory()}
                                                disabled={updating || !canPickDirectory}
                                                style={{
                                                    padding: "8px 12px",
                                                    borderRadius: 8,
                                                    border: "1px solid var(--border-primary, #e5e7eb)",
                                                    backgroundColor: "var(--bg-primary, #ffffff)",
                                                    color: "var(--text-primary, #111)",
                                                    cursor: updating || !canPickDirectory ? "not-allowed" : "pointer",
                                                    fontSize: 13,
                                                    fontWeight: 600,
                                                }}
                                            >
                                                Chọn nơi lưu
                                            </button>
                                            <button
                                                type="button"
                                                onClick={clearDownloadDirectory}
                                                disabled={updating || !downloadDirHandleRef.current}
                                                style={{
                                                    padding: "8px 12px",
                                                    borderRadius: 8,
                                                    border: "1px solid var(--border-primary, #e5e7eb)",
                                                    backgroundColor: "transparent",
                                                    color: "var(--text-secondary, #4b5563)",
                                                    cursor: updating || !downloadDirHandleRef.current ? "not-allowed" : "pointer",
                                                    fontSize: 13,
                                                    fontWeight: 600,
                                                }}
                                            >
                                                Bỏ chọn
                                            </button>
                                        </div>
                                    </div>

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
                                                Tải dữ liệu
                                            </div>
                                            <div style={{ fontSize: 13, color: "var(--text-muted, #6b7280)", marginTop: 4, lineHeight: 1.4 }}>
                                                Xuất dữ liệu (JSON) và lưu vào nơi bạn đã chọn.
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => void handleDownloadData()}
                                            disabled={updating}
                                            style={{
                                                padding: "10px 14px",
                                                borderRadius: 8,
                                                border: "none",
                                                backgroundColor: "#0068FF",
                                                color: "#fff",
                                                cursor: updating ? "wait" : "pointer",
                                                fontSize: 13,
                                                fontWeight: 700,
                                                flexShrink: 0,
                                            }}
                                        >
                                            Tải dữ liệu
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                        {activeTab !== "privacy" && (
                            <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary, #6b7280)" }}>
                                Tính năng đang phát triển
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
