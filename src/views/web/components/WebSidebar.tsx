import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "expo-router";
import { useUserStore } from "@/shared/store/userStore";
import { useAuthStore } from "@/shared/store/authStore";
import { useChatStore } from "@/shared/store/useChatStore";
import { useFriendStore } from "@/shared/store/friendStore";
import { useThemeStore } from "@/shared/store/themeStore";
import SettingsPanel from "./SettingsPanel";

const ICON_SIZE = 24;

const iconMessage = (
  <svg
    width={ICON_SIZE}
    height={ICON_SIZE}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);
const iconContacts = (
  <svg
    width={ICON_SIZE}
    height={ICON_SIZE}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const iconHome = (
  <svg
    width={ICON_SIZE}
    height={ICON_SIZE}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);
const iconSettings = (
  <svg
    width={ICON_SIZE}
    height={ICON_SIZE}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);
const iconAdmin = (
  <svg
    width={ICON_SIZE}
    height={ICON_SIZE}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 13c0 5-3.5 7.5-7.7 8.9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.6-1.2 6.2-2.5a1.3 1.3 0 0 1 1.6 0C14.4 3.8 17 5 19 5a1 1 0 0 1 1 1z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

const navItems: { href: string; label: string; icon: React.ReactNode }[] = [
  { href: "/(tabs)", label: "Tin nhắn", icon: iconMessage },
  { href: "/(tabs)/contacts", label: "Danh bạ", icon: iconContacts },
  { href: "/(tabs)/work", label: "Tường nhà", icon: iconHome },
];

export default function WebSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const hasToken = !!useAuthStore((s) => s.accessToken);
  const { profile, fetchProfile } = useUserStore();
  const totalUnread = useChatStore((s) =>
    s.rooms.reduce((acc, r) => acc + (r.unreadCount || 0), 0),
  );
  const pendingFriendRequests = useFriendStore((s) => s.requests.length);
  const fetchRequests = useFriendStore((s) => s.fetchRequests);
  const theme = useThemeStore((s) => s.theme);
  const isDark = theme === "dark";

  const SIDEBAR_BG = isDark ? "var(--bg-sidebar)" : "#004A99";
  const ACTIVE_BG = "var(--bg-sidebar-active)";

  useEffect(() => {
    if (hasToken && !profile) fetchProfile();
  }, [hasToken, profile, fetchProfile]);

  // Lời mời kết bạn đến: làm mới định kỳ để hiển thị chấm đỏ trên Danh bạ (web).
  useEffect(() => {
    if (!hasToken) return;
    void fetchRequests({ silent: true });
    const id = window.setInterval(() => {
      void fetchRequests({ silent: true });
    }, 5000);
    return () => window.clearInterval(id);
  }, [hasToken, fetchRequests]);

  const avatarUrl = profile?.avatarUrl || null;
  const displayName = profile?.displayName || profile?.username || "";
  const initial = (displayName && displayName.charAt(0).toUpperCase()) || "U";

  const isActive = (href: string) => {
    if (href === "/(tabs)")
      return pathname === "/(tabs)" || pathname === "/(tabs)/";
    return pathname.startsWith(href);
  };

  return (
    <div style={{ display: "flex", flexShrink: 0, height: "100vh", alignSelf: "stretch" }}>
      <aside
        style={{
          width: 72,
          minWidth: 72,
          height: "100vh",
          backgroundColor: SIDEBAR_BG,
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          alignSelf: "stretch",
          alignItems: "center",
          overflow: "hidden",
          paddingTop: 16,
          paddingBottom: 16,
          gap: 4,
          boxShadow: isDark
            ? "2px 0 16px rgba(0,0,0,0.35)"
            : "2px 0 12px rgba(0, 74, 153, 0.08)",
          transition: "background-color 0.3s ease, box-shadow 0.3s ease",
        }}
      >
        {/* Avatar người dùng */}
        <button
          type="button"
          onClick={() => router.push("/(tabs)/account")}
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            marginBottom: 12,
            overflow: "hidden",
            border: "none",
            padding: 0,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: avatarUrl
              ? "transparent"
              : "rgba(255,255,255,0.25)",
            color: "#fff",
            fontSize: 18,
            fontWeight: 600,
          }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Avatar"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            initial
          )}
        </button>

        {/* Tin nhắn - luôn đầu, active khi đang ở tabs */}
        <NavItem
          label="Tin nhắn"
          icon={iconMessage}
          active={isActive("/(tabs)")}
          activeBg={ACTIVE_BG}
          onClick={() => router.push("/(tabs)")}
          badge={totalUnread}
        />

        {/* Danh bạ */}
        <NavItem
          label="Danh bạ"
          icon={iconContacts}
          active={isActive("/(tabs)/contacts")}
          activeBg={ACTIVE_BG}
          onClick={() => router.push("/(tabs)/contacts")}
          dot={pendingFriendRequests > 0}
          dotRing={
            isDark
              ? "0 0 0 2px rgba(24, 28, 42, 0.95)"
              : "0 0 0 2px rgba(255, 255, 255, 0.5)"
          }
        />

        {/* Khoảng trống giữa */}
        <div style={{ flex: 1, minHeight: 24 }} />

        {/* Các mục khác */}
        {navItems.slice(2).map((item) => (
          <NavItem
            key={item.href}
            label={item.label}
            icon={item.icon}
            active={isActive(item.href)}
            activeBg={ACTIVE_BG}
            onClick={() => router.push(item.href as any)}
          />
        ))}

        <NavItem
          label="Admin"
          icon={iconAdmin}
          active={pathname.startsWith("/admin")}
          activeBg={ACTIVE_BG}
          onClick={() => router.push("/admin" as any)}
        />

        <NavItem
          label="Cài đặt"
          icon={iconSettings}
          active={showSettingsPanel}
          activeBg={ACTIVE_BG}
          onClick={() => setShowSettingsPanel((v) => !v)}
        />
      </aside>

      {showSettingsPanel && (
        <SettingsPanel onClose={() => setShowSettingsPanel(false)} />
      )}
    </div>
  );
}

function NavItem({
  label,
  icon,
  active,
  activeBg,
  onClick,
  badge,
  dot,
  dotRing,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  activeBg: string;
  onClick: () => void;
  badge?: number;
  /** Chấm đỏ (ví dụ có lời mời kết bạn). */
  dot?: boolean;
  dotRing?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      style={{
        width: 44,
        height: 44,
        borderRadius: 12,
        border: "none",
        background: active ? activeBg : "transparent",
        color: "#fff",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        transition: "background 0.2s ease",
      }}
      onMouseEnter={(e) => {
        if (!active)
          e.currentTarget.style.background = "var(--bg-sidebar-hover)";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = "transparent";
      }}
    >
      {icon}
      {dot && (
        <span
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: "#ef4444",
            pointerEvents: "none",
            boxShadow: dotRing ?? "0 0 0 2px rgba(255, 255, 255, 0.45)",
          }}
        />
      )}
      {badge !== undefined && badge > 0 && (
        <div
          style={{
            position: "absolute",
            top: 4,
            right: 4,
            backgroundColor: "#ef4444",
            color: "#fff",
            borderRadius: "10px",
            minWidth: 16,
            height: 16,
            fontSize: 10,
            fontWeight: "bold",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 4px",
            pointerEvents: "none",
          }}
        >
          {badge > 99 ? "99+" : badge}
        </div>
      )}
    </button>
  );
}
