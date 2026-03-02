import React, { useState } from "react";
import { View, Text, Platform, ScrollView } from "react-native";
import { useUserStore } from "@/shared/store/userStore";
import { useThemeStore } from "@/shared/store/themeStore";
import FriendsListScreen from "@/views/web/components/FriendsListScreen";
import FriendRequestsScreen from "@/views/web/components/FriendRequestsScreen";
import SearchUsersScreen from "@/views/web/components/SearchUsersScreen";
import BlockedUsersScreen from "@/views/web/components/BlockedUsersScreen";
import ContactsMobileScreen from "@/views/mobile/contacts/ContactsMobileScreen";

export default function ContactsScreen() {
  const isWeb = Platform.OS === "web";
  const { profile } = useUserStore();
  const currentUserId = profile?.id ?? null;
  const theme = useThemeStore((s) => s.theme);
  const isDark = theme === "dark";

  const [activeNav, setActiveNav] = useState<
    "friends" | "groups" | "friendRequests" | "groupInvites" | "blocked"
  >("friends");
  const [globalSearch, setGlobalSearch] = useState("");

  if (isWeb) {
    return (
      <div
        style={{
          display: "flex",
          height: "100vh",
          maxHeight: "100%",
          backgroundColor: isDark ? "var(--bg-secondary)" : "#e5e7eb",
          transition: "background-color 0.3s ease",
        }}
      >
        {/* Sidebar trái: menu danh bạ giống Zalo */}
        <aside
          style={{
            width: 400,
            minWidth: 400,
            maxWidth: 500,
            backgroundColor: "var(--bg-primary)",
            borderRight: "1px solid var(--border-primary)",
            display: "flex",
            flexDirection: "column",
            padding: 12,
            gap: 12,
            transition: "background-color 0.3s ease, border-color 0.3s ease",
          }}
        >
          {/* Ô tìm kiếm bạn */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div
              style={{
                padding: 8,
                borderRadius: 999,
                backgroundColor: isDark ? "var(--bg-tertiary)" : "#fff",
                border: "1px solid var(--border-primary)",
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: "var(--text-tertiary)",
                flex: 1,
                transition: "background-color 0.3s ease, border-color 0.3s ease",
              }}
            >
              <span style={{ fontSize: 16, marginRight: 4 }}>🔍</span>
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Tìm kiếm"
                style={{
                  flex: 1,
                  border: "none",
                  outline: "none",
                  fontSize: 13,
                  backgroundColor: "transparent",
                  color: "var(--text-primary)",
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => setGlobalSearch("")}
              style={{
                border: "none",
                background: "none",
                color: "var(--text-primary)",
                fontSize: 13,
                cursor: "pointer",
                padding: "4px 6px",
              }}
            >
              Đóng
            </button>
          </div>

          {/* Danh sách mục điều hướng */}
          <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {[
              { id: "friends" as const, label: "Danh sách bạn bè", icon: "👥" },
              {
                id: "friendRequests" as const,
                label: "Lời mời kết bạn",
                icon: "💌",
              },
              {
                id: "blocked" as const,
                label: "Danh sách chặn tin nhắn",
                icon: "🚫",
              },
            ].map((item) => {
              const active = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveNav(item.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "none",
                    backgroundColor: active
                      ? (isDark ? "rgba(137,180,250,0.15)" : "#e0edff")
                      : "transparent",
                    color: active
                      ? "var(--accent)"
                      : "var(--text-secondary)",
                    cursor: "pointer",
                    fontSize: 14,
                    textAlign: "left" as const,
                    transition: "background-color 0.15s ease, color 0.15s ease",
                  }}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Nội dung chính bên phải */}
        <main
          style={{
            flex: 1,
            minWidth: 0,
            padding: 16,
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 1500,
              backgroundColor: "var(--bg-primary)",
              borderRadius: 16,
              boxShadow: "var(--shadow-lg)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              height: "100%",
              maxHeight: "calc(100vh - 32px)",
              transition: "background-color 0.3s ease",
            }}
          >
            {activeNav === "friends" &&
              (globalSearch.trim() === "" ? (
                <FriendsListScreen
                  currentUserId={currentUserId}
                  onOpenChat={() => { }}
                />
              ) : (
                <SearchUsersScreen
                  externalQuery={globalSearch}
                  hideSearchInput
                  onOpenChat={() => { }}
                />
              ))}
            {activeNav === "friendRequests" && (
              <FriendRequestsScreen currentUserId={currentUserId} />
            )}
            {activeNav === "groups" && (
              <div style={{ padding: 24, fontSize: 14, color: "var(--text-tertiary)" }}>
                Danh sách nhóm và cộng đồng sẽ được phát triển sau.
              </div>
            )}
            {activeNav === "groupInvites" && (
              <div style={{ padding: 24, fontSize: 14, color: "var(--text-tertiary)" }}>
                Lời mời vào nhóm và cộng đồng sẽ được phát triển sau.
              </div>
            )}
            {activeNav === "blocked" && (
              <BlockedUsersScreen currentUserId={currentUserId} />
            )}
          </div>
        </main>
      </div>
    );
  }

  // Bản mobile: dùng ContactsMobileScreen
  return <ContactsMobileScreen />;
}
