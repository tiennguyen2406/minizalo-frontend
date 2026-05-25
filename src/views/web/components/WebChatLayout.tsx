import React, { useState, useMemo, useEffect } from "react";
import { Box } from "zmp-ui";
import ChatRoomList from "./ChatRoomList";
import CreateGroupModal from "./CreateGroupModal";
import GlobalSearchBar from "./GlobalSearchBar";
import { useChatStore } from "@/shared/store/useChatStore";
import { useGroupStore } from "@/shared/store/useGroupStore";
import { useThemeStore } from "@/shared/store/themeStore";
import { useAuthStore } from "@/shared/store/authStore";
import { useFriendStore } from "@/shared/store/friendStore";
import { splitRoomsMainAndStrangers } from "@/shared/utils/strangerChatRooms";

type FilterTab = "all" | "strangers" | "unread";

interface WebChatLayoutProps {
  children: React.ReactNode;
  selectedRoomId?: string | null;
  onSelectRoom?: (roomId: string) => void;
}

const WebChatLayout: React.FC<WebChatLayoutProps> = ({
  children,
  selectedRoomId,
  onSelectRoom,
}) => {
  const rooms = useChatStore((s) => s.rooms);
  const { openCreateGroup } = useGroupStore();
  const theme = useThemeStore((s) => s.theme);
  const isDark = theme === "dark";
  const currentUserId = useAuthStore((s) => s.user?.id);
  const friends = useFriendStore((s) => s.friends);
  const fetchFriends = useFriendStore((s) => s.fetchFriends);

  /** Tránh coi mọi chat 1-1 là người lạ trước khi tải xong danh sách bạn bè. */
  const [friendsListReady, setFriendsListReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void fetchFriends().finally(() => {
      if (!cancelled) setFriendsListReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchFriends]);

  const [filterTab, setFilterTab] = useState<FilterTab>("all");

  const { mainRooms, strangerRooms } = useMemo(() => {
    if (!currentUserId || !friendsListReady) {
      return { mainRooms: rooms, strangerRooms: [] as typeof rooms };
    }
    return splitRoomsMainAndStrangers(rooms, currentUserId, friends);
  }, [rooms, currentUserId, friends, friendsListReady]);

  const filteredRooms = useMemo(() => {
    const base =
      filterTab === "strangers"
        ? strangerRooms
        : filterTab === "all"
          ? mainRooms
          : rooms;
    if (filterTab === "unread") {
      return base.filter((r) => (r.unreadCount ?? 0) > 0);
    }
    return base;
  }, [rooms, mainRooms, strangerRooms, filterTab]);

  const getTabStyle = (tab: FilterTab): React.CSSProperties => ({
    flex: 1,
    padding: "6px 0",
    fontSize: 13,
    fontWeight: filterTab === tab ? 600 : 400,
    color:
      filterTab === tab
        ? isDark
          ? "#60a5fa"
          : "#0068ff"
        : "var(--text-muted)",
    background: "transparent",
    border: "none",
    borderBottom:
      filterTab === tab
        ? `2px solid ${isDark ? "#60a5fa" : "#0068ff"}`
        : "2px solid transparent",
    cursor: "pointer",
    transition: "color 0.2s ease, border-color 0.2s ease",
  });

  // Handler cho search: chọn phòng và cũng gọi onSelectRoom nếu có
  const handleSelectRoom = (roomId: string) => {
    if (onSelectRoom) onSelectRoom(roomId);
  };

  return (
    <div
      className="flex h-screen"
      style={{
        backgroundColor: "var(--bg-primary)",
        color: "var(--text-primary)",
        transition: "background-color 0.3s ease, color 0.3s ease",
      }}
    >
      {/* Sidebar */}
      <div
        className="w-[350px] flex flex-col"
        style={{
          borderRight: `1px solid var(--border-primary)`,
          backgroundColor: "var(--bg-primary)",
          transition: "background-color 0.3s ease, border-color 0.3s ease",
        }}
      >
        {/* ── Header ── */}
        <div
          className="h-12 flex items-center justify-between px-4 shrink-0"
          style={{
            borderBottom: `1px solid var(--border-primary)`,
            backgroundColor: "var(--bg-primary)",
            boxShadow: "var(--shadow-sm)",
            transition: "background-color 0.3s ease",
          }}
        >
          <span
            className="font-bold text-lg"
            style={{ color: "var(--text-primary)" }}
          >
            Tin nhắn
          </span>

          <button
            onClick={() => openCreateGroup()}
            title="Tạo nhóm mới"
            className="w-8 h-8 flex items-center justify-center rounded-full transition-colors"
            style={{ color: "var(--text-tertiary)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = isDark
                ? "rgba(255,255,255,0.08)"
                : "rgba(0,0,0,0.06)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        </div>

        {/* ── Global Search Bar ── */}
        <div
          style={{
            padding: "8px 10px",
            borderBottom: `1px solid var(--border-primary)`,
            backgroundColor: "var(--bg-primary)",
            flexShrink: 0,
            position: "relative",
            zIndex: 10,
          }}
        >
          <GlobalSearchBar onSelectRoom={handleSelectRoom} />
        </div>

        {/* ── Filter Tabs: Tất cả / Người lạ / Chưa đọc ── */}
        <div
          style={{
            display: "flex",
            borderBottom: `1px solid var(--border-primary)`,
            backgroundColor: "var(--bg-primary)",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            title="Bạn bè, nhóm và chat 1-1 đã kết bạn"
            style={getTabStyle("all")}
            onClick={() => setFilterTab("all")}
          >
            Tất cả
          </button>
          <button
            type="button"
            title="Tin nhắn từ người lạ — chat 1-1 chưa kết bạn"
            style={getTabStyle("strangers")}
            onClick={() => setFilterTab("strangers")}
          >
            Người lạ
          </button>
          <button
            type="button"
            style={getTabStyle("unread")}
            onClick={() => setFilterTab("unread")}
          >
            Chưa đọc
          </button>
        </div>

        {/* ── Danh sách phòng chat ── */}
        <Box className="flex-1 overflow-hidden">
          <ChatRoomList
            rooms={filteredRooms}
            selectedRoomId={selectedRoomId}
            onSelectRoom={onSelectRoom}
            strangersClassifyLoading={!friendsListReady}
            filterTab={
              filterTab === "strangers"
                ? "strangers"
                : filterTab === "unread"
                  ? "unread"
                  : "all"
            }
          />
        </Box>
      </div>

      {/* Main Content */}
      <div
        className="flex-1 flex flex-col min-w-0"
        style={{
          backgroundColor: "var(--bg-secondary)",
          transition: "background-color 0.3s ease",
        }}
      >
        {children}
      </div>

      <CreateGroupModal />
    </div>
  );
};

export default WebChatLayout;
