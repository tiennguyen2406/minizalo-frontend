import React, { useState } from "react";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/shared/store/authStore";
import { useThemeStore } from "@/shared/store/themeStore";
import ChangePasswordModal from "./ChangePasswordModal";
import SettingsModal from "./SettingsModal";
import { useUserStore } from "@/shared/store/userStore";
import { useChatStore } from "@/shared/store/useChatStore";
import { useGroupStore } from "@/shared/store/useGroupStore";
import { useFriendStore } from "@/shared/store/friendStore";

const SIDEBAR_WIDTH = 72;
const PANEL_WIDTH = 280;
const ICON_SIZE = 22;

const iconPerson = (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
    </svg>
);
const iconGear = (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
);
const iconDatabase = (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
    </svg>
);
const iconGlobe = (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
);
const iconSupport = (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        <path d="M9 10h.01M15 10h.01M9.5 15a3.5 3.5 0 0 0 5 0" />
    </svg>
);
const iconArrow = (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6" />
    </svg>
);
const iconLock = (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
);

const iconSun = (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
);

const iconMoon = (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
);

type MenuItem = {
    id: string;
    label: string;
    icon: React.ReactNode;
    showArrow?: boolean;
    highlighted?: boolean;
    danger?: boolean;
    rightElement?: React.ReactNode;
    onClick: () => void;
};

function ThemeToggleSwitch() {
    const { theme, toggleTheme } = useThemeStore();
    const isDark = theme === "dark";

    return (
        <div
            role="switch"
            aria-checked={isDark}
            tabIndex={0}
            onClick={(e) => {
                e.stopPropagation();
                toggleTheme();
            }}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleTheme();
                }
            }}
            title={isDark ? "Chuyển sang sáng" : "Chuyển sang tối"}
            style={{
                width: 44,
                height: 24,
                borderRadius: 12,
                border: "none",
                padding: 2,
                cursor: "pointer",
                position: "relative",
                backgroundColor: isDark ? "var(--accent)" : "#d1d5db",
                transition: "background-color 0.3s ease",
                display: "flex",
                alignItems: "center",
                flexShrink: 0,
            }}
        >
            <div
                style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    backgroundColor: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transform: isDark ? "translateX(20px)" : "translateX(0px)",
                    transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }}
            >
                {isDark ? (
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                ) : (
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5">
                        <circle cx="12" cy="12" r="5" />
                        <line x1="12" y1="1" x2="12" y2="3" />
                        <line x1="12" y1="21" x2="12" y2="23" />
                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                        <line x1="1" y1="12" x2="3" y2="12" />
                        <line x1="21" y1="12" x2="23" y2="12" />
                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                    </svg>
                )}
            </div>
        </div>
    );
}

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
    const router = useRouter();
    const logout = useAuthStore((s) => s.logout);
    const theme = useThemeStore((s) => s.theme);
    const isDark = theme === "dark";
    const [showChangePassword, setShowChangePassword] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);

    const handleLogout = async () => {
        await logout();
        useUserStore.getState().clear();
        useChatStore.getState().clear();
        useGroupStore.getState().clear();
        useFriendStore.getState().clear();
        
        onClose();
        router.replace("/(auth)/login");
    };

    const menuItems: MenuItem[] = [
        {
            id: "account",
            label: "Thông tin tài khoản",
            icon: iconPerson,
            highlighted: true,
            onClick: () => {
                router.push("/(tabs)/account");
                onClose();
            },
        },
        {
            id: "change-password",
            label: "Đổi mật khẩu",
            icon: iconLock,
            onClick: () => setShowChangePassword(true),
        },
        {
            id: "settings",
            label: "Cài đặt",
            icon: iconGear,
            onClick: () => setShowSettingsModal(true),
        },
        {
            id: "theme",
            label: isDark ? "Chế độ tối" : "Chế độ sáng",
            icon: isDark ? iconMoon : iconSun,
            rightElement: <ThemeToggleSwitch />,
            onClick: () => { }, // toggle handled by switch
        },
        {
            id: "data",
            label: "Dữ liệu",
            icon: iconDatabase,
            showArrow: true,
            onClick: () => {
                router.push("/(tabs)/data");
                onClose();
            },
        },
        {
            id: "language",
            label: "Ngôn ngữ",
            icon: iconGlobe,
            showArrow: true,
            onClick: () => {
                router.push("/(tabs)/language");
                onClose();
            },
        },
        {
            id: "support",
            label: "Hỗ trợ",
            icon: iconSupport,
            showArrow: true,
            onClick: () => {
                router.push("/(tabs)/support");
                onClose();
            },
        },
    ];

    return (
        <>
            {/* Click ra ngoài để đóng panel */}
            <div
                style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 999,
                    background: "transparent",
                }}
                aria-hidden
                onClick={onClose}
            />
            <div
                style={{
                    position: "fixed",
                    left: SIDEBAR_WIDTH,
                    bottom: 16,
                    zIndex: 1000,
                    width: PANEL_WIDTH,
                    maxWidth: "33vw",
                    maxHeight: "50vh",
                    overflowY: "auto",
                }}
            >
                <div
                    style={{
                        position: "relative",
                        width: "100%",
                        backgroundColor: "var(--bg-primary)",
                        boxShadow: "var(--shadow-lg)",
                        borderRadius: 12,
                        overflow: "hidden",
                        border: `1px solid var(--border-primary)`,
                    }}
                >
                    {/* Thanh xanh dọc bên trái */}
                    <div
                        style={{
                            position: "absolute",
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: 4,
                            backgroundColor: "var(--accent)",
                        }}
                    />
                    <div style={{ paddingLeft: 12, paddingTop: 12, paddingBottom: 12 }}>
                        {menuItems.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={item.onClick}
                                style={{
                                    width: "100%",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 12,
                                    padding: "10px 12px",
                                    marginBottom: 2,
                                    border: "none",
                                    borderRadius: 8,
                                    background: item.highlighted
                                        ? (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)")
                                        : "transparent",
                                    color: item.danger ? "var(--danger)" : "var(--text-primary)",
                                    fontSize: 15,
                                    cursor: "pointer",
                                    textAlign: "left",
                                }}
                                onMouseEnter={(e) => {
                                    if (!item.highlighted && !item.danger) {
                                        e.currentTarget.style.background = isDark
                                            ? "rgba(255,255,255,0.04)"
                                            : "rgba(0,0,0,0.04)";
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!item.highlighted) e.currentTarget.style.background = "transparent";
                                }}
                            >
                                <span style={{ color: item.danger ? "var(--danger)" : "var(--text-tertiary)", display: "flex" }}>{item.icon}</span>
                                <span style={{ flex: 1 }}>{item.label}</span>
                                {item.rightElement}
                                {item.showArrow && (
                                    <span style={{ color: "var(--text-muted)", display: "flex" }}>{iconArrow}</span>
                                )}
                            </button>
                        ))}

                        <div
                            style={{
                                height: 1,
                                backgroundColor: "var(--border-primary)",
                                margin: "8px 0",
                            }}
                        />

                        <button
                            type="button"
                            onClick={handleLogout}
                            style={{
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                gap: 12,
                                padding: "10px 12px",
                                marginBottom: 2,
                                border: "none",
                                borderRadius: 8,
                                background: "transparent",
                                color: "var(--danger)",
                                fontSize: 15,
                                cursor: "pointer",
                                textAlign: "left",
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = isDark
                                    ? "rgba(243,139,168,0.1)"
                                    : "rgba(229,57,53,0.08)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = "transparent";
                            }}
                        >
                            <span style={{ flex: 1 }}>Đăng xuất</span>
                        </button>

                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                padding: "10px 12px",
                                border: "none",
                                borderRadius: 8,
                                background: "transparent",
                                color: "var(--text-tertiary)",
                                fontSize: 15,
                                cursor: "pointer",
                                textAlign: "left",
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = isDark
                                    ? "rgba(255,255,255,0.04)"
                                    : "rgba(0,0,0,0.04)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = "transparent";
                            }}
                        >
                            Thoát
                        </button>
                    </div>
                </div>
            </div>

            {showChangePassword && (
                <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
            )}
            
            {showSettingsModal && (
                <SettingsModal onClose={() => setShowSettingsModal(false)} />
            )}
        </>
    );
}
