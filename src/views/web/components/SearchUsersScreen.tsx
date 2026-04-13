import React, { useEffect, useMemo, useState } from "react";
import searchService from "@/shared/services/searchService";
import { useFriendStore } from "@/shared/store/friendStore";
import { useUserStore } from "@/shared/store/userStore";
import type { UserProfile } from "@/shared/services/types";

type SearchUsersScreenProps = {
  onOpenChat?: (userId: string) => void;
  /** Query lấy từ bên ngoài (ví dụ ô tìm kiếm sidebar). */
  externalQuery?: string;
  /** Ẩn ô nhập tìm kiếm bên trong component (dùng khi đã có ô nhập bên ngoài). */
  hideSearchInput?: boolean;
};

export default function SearchUsersScreen({
  onOpenChat,
  externalQuery,
  hideSearchInput,
}: SearchUsersScreenProps) {
  const [query, setQuery] = useState(externalQuery ?? "");
  const [results, setResults] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { sendRequest, friends } = useFriendStore();
  const { profile } = useUserStore();

  // Lưu danh sách userId đã gửi lời mời trong phiên hiện tại
  const [requestedIds, setRequestedIds] = useState<string[]>([]);

  // Tập id những user đã là bạn để ẩn nút Kết bạn
  const currentUserId = profile?.id ?? null;
  const friendIdSet = useMemo(() => {
    const set = new Set<string>();
    if (!currentUserId) return set;
    friends.forEach((f) => {
      if (f.user.id === currentUserId) {
        set.add(f.friend.id);
      } else if (f.friend.id === currentUserId) {
        set.add(f.user.id);
      }
    });
    return set;
  }, [friends, currentUserId]);

  // Hàm thực hiện search với chuỗi cụ thể (tránh lệch 1 ký tự do setState async)
  const runSearch = async (value: string) => {
    const q = value.trim();
    if (!q) {
      setResults([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const users = await searchService.searchUsers(q);
      setResults(users);
    } catch (err: unknown) {
      const anyErr = err as {
        response?: { data?: { message?: string } | string };
      };
      const data = anyErr?.response?.data;
      if (typeof data === "string") {
        setError(data);
      } else if (data && typeof (data as any).message === "string") {
        setError((data as any).message);
      } else {
        setError("Không tìm kiếm được người dùng.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await runSearch(query);
  };

  const handleSendRequest = async (userId: string) => {
    if (requestedIds.includes(userId) || friendIdSet.has(userId)) return;
    try {
      await sendRequest(userId);
      setRequestedIds((prev) =>
        prev.includes(userId) ? prev : [...prev, userId],
      );
    } catch {
      // lỗi đã được lưu trong store, ở đây chỉ thông báo đơn giản
      alert("Gửi lời mời kết bạn thất bại.");
    }
  };

  // Tự động tìm kiếm khi externalQuery thay đổi (tìm bạn theo số ĐT ở sidebar)
  useEffect(() => {
    if (externalQuery !== undefined) {
      setQuery(externalQuery);
      if (externalQuery.trim()) {
        // Gọi trực tiếp với externalQuery để không bị lệch 1 ký tự
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        runSearch(externalQuery);
      } else {
        setResults([]);
        setError(null);
      }
    }
  }, [externalQuery]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        backgroundColor: "#f7f9fb",
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid #e3e6ea",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#222" }}>
          Tìm kiếm người dùng
        </h2>
        {!hideSearchInput && (
          <form
            onSubmit={handleSearch}
            style={{ display: "flex", gap: 8, flex: 1, maxWidth: 420 }}
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nhập tên, số điện thoại hoặc email..."
              style={{
                flex: 1,
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid #cbd5e1",
                fontSize: 14,
                outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "6px 14px",
                borderRadius: 999,
                border: "none",
                backgroundColor: "#0068FF",
                color: "#fff",
                fontSize: 14,
                cursor: loading ? "wait" : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {loading ? "Đang tìm..." : "Tìm kiếm"}
            </button>
          </form>
        )}
      </div>

      {error && (
        <div
          style={{
            padding: "8px 16px",
            backgroundColor: "#fdecea",
            color: "#c62828",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto" }}>
        {results.length === 0 && !loading && !error && (
          <div
            style={{
              padding: 24,
              textAlign: "center",
              color: "#666",
              fontSize: 14,
            }}
          >
            Nhập thông tin và bấm "Tìm kiếm" để bắt đầu.
          </div>
        )}
        {results.map((user) => {
          const initial =
            (user.displayName || user.username || "?")
              .charAt(0)
              .toUpperCase() || "?";
          const isRequested = requestedIds.includes(user.id);
          const alreadyFriend = friendIdSet.has(user.id);
          const disabled = isRequested || alreadyFriend;
          const label = alreadyFriend
            ? "Đã là bạn"
            : isRequested
              ? "Đã gửi lời mời"
              : "Kết bạn";
          return (
            <div
              key={user.id}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "10px 16px",
                borderBottom: "1px solid #eef1f5",
                backgroundColor: "#fff",
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  overflow: "hidden",
                  marginRight: 12,
                  backgroundColor: "#e3e7ed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 600,
                  color: "#344767",
                  flexShrink: 0,
                }}
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.displayName || user.username}
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
                    fontSize: 15,
                    fontWeight: 500,
                    color: "#1f2933",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {user.displayName || user.username}
                </div>
                {user.statusMessage && (
                  <div
                    style={{
                      fontSize: 13,
                      color: "#6b7280",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {user.statusMessage}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => handleSendRequest(user.id)}
                  disabled={disabled}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: disabled
                      ? "1px solid #9ca3af"
                      : "1px solid #0068FF",
                    backgroundColor: disabled ? "#e5e7eb" : "transparent",
                    color: disabled ? "#6b7280" : "#0068FF",
                    fontSize: 13,
                    cursor: disabled ? "default" : "pointer",
                  }}
                >
                  {label}
                </button>
                {onOpenChat && (
                  <button
                    type="button"
                    onClick={() => onOpenChat(user.id)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      border: "none",
                      backgroundColor: "#10b981",
                      color: "#fff",
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    Nhắn tin
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
