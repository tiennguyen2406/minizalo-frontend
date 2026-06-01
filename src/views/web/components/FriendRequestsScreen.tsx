import React, { useEffect, useState } from "react";
import { Platform } from "react-native";
import { useRouter } from "expo-router";
import { useFriendStore } from "@/shared/store/friendStore";
import type { FriendResponseDto } from "@/shared/services/types";

type FriendRequestsScreenProps = {
  currentUserId?: string | null;
};

/** Người gửi lời mời (đối với tab "đã nhận", current user là friend). */
function getSenderProfile(item: FriendResponseDto, currentUserId?: string | null) {
  if (!currentUserId) return item.user;
  return item.user.id === currentUserId ? item.friend : item.user;
}

function formatInviteTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "Vừa xong";
  if (m < 60) return `${m} phút`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} ngày`;
  return new Date(iso).toLocaleDateString("vi-VN");
}

function inviteSourceLabel(src: string | null | undefined): string {
  if (src === "CHAT_WINDOW") return "Từ cửa sổ trò chuyện";
  if (src === "PHONE_SEARCH") return "Từ tìm kiếm số điện thoại";
  return "Lời mời kết bạn";
}

export default function FriendRequestsScreen({
  currentUserId,
}: FriendRequestsScreenProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"received" | "sent">("received");
  const {
    requests,
    sentRequests,
    loading,
    error,
    fetchRequests,
    fetchSentRequests,
    acceptRequest,
    rejectRequest,
    cancelSentRequest,
    clearError,
  } = useFriendStore();

  useEffect(() => {
    fetchRequests();
    fetchSentRequests();
  }, [fetchRequests, fetchSentRequests]);

  const handleAccept = async (id: string) => {
    try {
      await acceptRequest(id);
      if (Platform.OS === "web") {
        router.push("/(tabs)" as never);
      }
    } catch {
      // lỗi đã lưu trong store
    }
  };

  const handleReject = async (id: string) => {
    try {
      await rejectRequest(id);
    } catch {
      // lỗi đã lưu trong store
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelSentRequest(id);
    } catch {
      // lỗi đã lưu trong store
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        backgroundColor: "var(--bg-secondary, #eef1f5)",
      }}
    >
      <div
        style={{
          padding: "16px 20px 12px",
          backgroundColor: "var(--bg-primary, #f7f9fb)",
          borderBottom: "1px solid #e3e6ea",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 4,
          }}
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#0068ff"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M19 8v6M22 11h-6" />
          </svg>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--text-primary, #1a1a1a)" }}>
            Lời mời kết bạn
          </h2>
        </div>
        {loading && (
          <span style={{ fontSize: 13, color: "var(--text-secondary, #888)" }}>Đang tải...</span>
        )}
      </div>

      <div
        style={{
          display: "flex",
          borderBottom: "1px solid #dde1e6",
          backgroundColor: "var(--bg-primary, #f7f9fb)",
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("received")}
          style={{
            flex: 1,
            padding: "12px 16px",
            fontSize: 15,
            fontWeight: 600,
            color: activeTab === "received" ? "#0068ff" : "var(--text-secondary, #666)",
            border: "none",
            backgroundColor: "transparent",
            borderBottom: activeTab === "received" ? "2px solid #0068ff" : "2px solid transparent",
            cursor: "pointer",
            textAlign: "center",
          }}
        >
          Lời mời đã nhận ({requests.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("sent")}
          style={{
            flex: 1,
            padding: "12px 16px",
            fontSize: 15,
            fontWeight: 600,
            color: activeTab === "sent" ? "#0068ff" : "var(--text-secondary, #666)",
            border: "none",
            backgroundColor: "transparent",
            borderBottom: activeTab === "sent" ? "2px solid #0068ff" : "2px solid transparent",
            cursor: "pointer",
            textAlign: "center",
          }}
        >
          Lời mời đã gửi ({sentRequests.length})
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: "8px 16px",
            backgroundColor: "#fdecea",
            color: "#c62828",
            fontSize: 13,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={clearError}
            style={{
              border: "none",
              background: "none",
              color: "#c62828",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Đóng
          </button>
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 24px" }}>
        {activeTab === "received" ? (
          <>
            {requests.length === 0 && !loading && (
              <div
                style={{
                  padding: 32,
                  textAlign: "center",
                  color: "var(--text-secondary, #666)",
                  fontSize: 14,
                }}
              >
                Hiện chưa có lời mời kết bạn nào.
              </div>
            )}
            {requests.map((item) => {
              const user = getSenderProfile(item, currentUserId);
              const initial =
                (user.displayName || user.username || "?").charAt(0).toUpperCase() ||
                "?";
              const displayName = user.displayName || user.username || "Người dùng";
              const intro =
                item.inviteMessage?.trim() ||
                "Xin chào! Mình muốn được kết bạn với bạn.";
              const meta = `${formatInviteTime(item.createdAt)} — ${inviteSourceLabel(item.inviteSource)}`;

              return (
                <div
                  key={item.id}
                  style={{
                    backgroundColor: "var(--bg-primary, #fff)",
                    borderRadius: 12,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                    padding: 16,
                    marginBottom: 14,
                  }}
                >
                  <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: "50%",
                        overflow: "hidden",
                        backgroundColor: "var(--bg-tertiary, #e3e7ed)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        color: "#344767",
                        flexShrink: 0,
                      }}
                    >
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt=""
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        initial
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 16,
                            fontWeight: 700,
                            color: "var(--text-primary, #111)",
                          }}
                        >
                          {displayName}
                        </div>
                        <span
                          title="Từ trò chuyện"
                          style={{
                            flexShrink: 0,
                            color: "var(--text-secondary, #9ca3af)",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <svg
                            width="22"
                            height="22"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                          >
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                            <path d="M12 8v4M10 10h4" />
                          </svg>
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: "var(--text-secondary, #6b7280)",
                          marginTop: 4,
                        }}
                      >
                        {meta}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      backgroundColor: "var(--bg-secondary, #f3f4f6)",
                      borderRadius: 8,
                      padding: "12px 14px",
                      fontSize: 14,
                      color: "var(--text-primary, #374151)",
                      lineHeight: 1.45,
                      marginBottom: 14,
                    }}
                  >
                    {intro}
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => handleReject(item.id)}
                      style={{
                        flex: 1,
                        padding: "11px 16px",
                        borderRadius: 8,
                        border: "none",
                        backgroundColor: "var(--bg-tertiary, #e5e7eb)",
                        color: "var(--text-primary, #374151)",
                        fontSize: 15,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Từ chối
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAccept(item.id)}
                      style={{
                        flex: 1,
                        padding: "11px 16px",
                        borderRadius: 8,
                        border: "1px solid #b3d4ff",
                        backgroundColor: "#e8f2ff",
                        color: "#0068ff",
                        fontSize: 15,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Đồng ý
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          <>
            {sentRequests.length === 0 && !loading && (
              <div
                style={{
                  padding: 32,
                  textAlign: "center",
                  color: "var(--text-secondary, #666)",
                  fontSize: 14,
                }}
              >
                Hiện chưa có lời mời kết bạn nào đã gửi.
              </div>
            )}
            {sentRequests.map((item) => {
              const user = getSenderProfile(item, currentUserId);
              const initial =
                (user.displayName || user.username || "?").charAt(0).toUpperCase() ||
                "?";
              const displayName = user.displayName || user.username || "Người dùng";
              const intro =
                item.inviteMessage?.trim() ||
                "Xin chào! Mình muốn được kết bạn với bạn.";
              const meta = `${formatInviteTime(item.createdAt)} — ${inviteSourceLabel(item.inviteSource)}`;

              return (
                <div
                  key={item.id}
                  style={{
                    backgroundColor: "var(--bg-primary, #fff)",
                    borderRadius: 12,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                    padding: 16,
                    marginBottom: 14,
                  }}
                >
                  <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: "50%",
                        overflow: "hidden",
                        backgroundColor: "var(--bg-tertiary, #e3e7ed)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        color: "#344767",
                        flexShrink: 0,
                      }}
                    >
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt=""
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        initial
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 16,
                            fontWeight: 700,
                            color: "var(--text-primary, #111)",
                          }}
                        >
                          {displayName}
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: "var(--text-secondary, #6b7280)",
                          marginTop: 4,
                        }}
                      >
                        {meta}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      backgroundColor: "var(--bg-secondary, #f3f4f6)",
                      borderRadius: 8,
                      padding: "12px 14px",
                      fontSize: 14,
                      color: "var(--text-primary, #374151)",
                      lineHeight: 1.45,
                      marginBottom: 14,
                    }}
                  >
                    {intro}
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => handleCancel(item.id)}
                      style={{
                        flex: 1,
                        padding: "11px 16px",
                        borderRadius: 8,
                        border: "1px solid #fecaca",
                        backgroundColor: "#fef2f2",
                        color: "#ef4444",
                        fontSize: 15,
                        fontWeight: 600,
                        cursor: "pointer",
                        textAlign: "center",
                      }}
                    >
                      Thu hồi lời mời
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
