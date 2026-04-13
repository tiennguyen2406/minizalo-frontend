import React, { useEffect, useState } from "react";
import { useThemeStore } from "@/shared/store/themeStore";

const MAX_MESSAGE = 150;

export type FriendInviteTarget = {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  coverPhotoUrl?: string | null;
};

type SendFriendRequestModalWebProps = {
  open: boolean;
  target: FriendInviteTarget | null;
  currentDisplayName: string;
  /** chat_window: lời mặc định khi gửi từ cửa sổ chat; phone_search: tìm SĐT. */
  variant?: "phone_search" | "chat_window";
  onClose: () => void;
  /** Bật nút "Thông tin" — đóng modal và mở panel hồ sơ (tuỳ parent). */
  onOpenProfile?: () => void;
  onConfirmSend: (
    message: string,
    options: { hideMyTimelineFromFriend: boolean },
  ) => Promise<void>;
};

export default function SendFriendRequestModalWeb({
  open,
  target,
  currentDisplayName,
  variant = "phone_search",
  onClose,
  onOpenProfile,
  onConfirmSend,
}: SendFriendRequestModalWebProps) {
  const theme = useThemeStore((s) => s.theme);
  const isDark = theme === "dark";
  const [message, setMessage] = useState("");
  const [blockDiary, setBlockDiary] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open || !target) return;
    const me = currentDisplayName || "mình";
    if (variant === "chat_window") {
      setMessage(
        `Xin chào, mình là ${me}. Mình muốn kết bạn với bạn qua cửa sổ trò chuyện nhé!`,
      );
    } else {
      setMessage(
        `Xin chào, mình là ${me}. Mình tìm thấy bạn bằng số điện thoại. Kết bạn với mình nhé!`,
      );
    }
    setBlockDiary(false);
  }, [open, target?.id, currentDisplayName, target, variant]);

  if (!open || !target) return null;

  const name = target.displayName || "Người dùng";
  const initial = name.charAt(0).toUpperCase() || "?";
  const cover = target.coverPhotoUrl;
  const avatar = target.avatarUrl;

  const handleSend = async () => {
    setSending(true);
    try {
      await onConfirmSend(message.trim(), {
        hideMyTimelineFromFriend: blockDiary,
      });
      onClose();
    } catch {
      // lỗi đã xử lý ở caller
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="friend-req-modal-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        backgroundColor: "var(--bg-modal-overlay)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          maxHeight: "90vh",
          overflow: "auto",
          backgroundColor: "var(--bg-modal)",
          borderRadius: 12,
          boxShadow: "var(--shadow-lg)",
          color: "var(--text-primary)",
          transition: "background-color 0.3s ease",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px",
            borderBottom: "1px solid var(--border-primary)",
          }}
        >
          <h2
            id="friend-req-modal-title"
            style={{ margin: 0, fontSize: 17, fontWeight: 600 }}
          >
            Thông tin tài khoản
          </h2>
          <button
            type="button"
            aria-label="Đóng"
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              color: "var(--text-tertiary)",
              fontSize: 22,
              lineHeight: 1,
              cursor: "pointer",
              padding: 4,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ position: "relative" }}>
          <div
            style={{
              height: 120,
              background: cover
                ? `url(${cover}) center/cover no-repeat`
                : isDark
                  ? "linear-gradient(135deg, #313244 0%, #45475a 100%)"
                  : "linear-gradient(135deg, #93c5fd 0%, #60a5fa 50%, #fbbf24 100%)",
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 12,
              marginTop: -40,
              padding: "0 16px 12px",
            }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                border: "3px solid var(--bg-modal)",
                overflow: "hidden",
                backgroundColor: "var(--bg-tertiary)",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                fontWeight: 600,
                color: "var(--text-secondary)",
              }}
            >
              {avatar ? (
                <img
                  src={avatar}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                initial
              )}
            </div>
            <div
              style={{
                paddingBottom: 4,
                minWidth: 0,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 700 }}>{name}</div>
              <span
                title="Tên hiển thị của liên hệ"
                style={{
                  color: "var(--text-tertiary)",
                  fontSize: 16,
                  lineHeight: 1,
                  cursor: "default",
                }}
              >
                ✎
              </span>
            </div>
          </div>
        </div>

        <div style={{ padding: "12px 16px 16px" }}>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
            rows={4}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: 12,
              borderRadius: 8,
              border: "1px solid var(--border-primary)",
              backgroundColor: "var(--bg-input)",
              color: "var(--text-primary)",
              fontSize: 14,
              resize: "vertical",
              minHeight: 100,
              fontFamily: "inherit",
            }}
          />
          <div
            style={{
              textAlign: "right",
              fontSize: 12,
              color: "var(--text-tertiary)",
              marginTop: 4,
            }}
          >
            {message.length}/{MAX_MESSAGE} ký tự
          </div>

          <div
            style={{
              marginTop: 14,
              padding: "12px 14px",
              borderRadius: 8,
              backgroundColor: "var(--bg-tertiary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              Chặn người này xem nhật ký của tôi
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={blockDiary}
              onClick={() => setBlockDiary((v) => !v)}
              style={{
                width: 44,
                height: 24,
                borderRadius: 12,
                border: "none",
                backgroundColor: blockDiary
                  ? "var(--accent)"
                  : "var(--border-primary)",
                cursor: "pointer",
                position: "relative",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 2,
                  left: blockDiary ? 22 : 2,
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  backgroundColor: "#fff",
                  transition: "left 0.2s ease",
                }}
              />
            </button>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            padding: "12px 16px 16px",
            borderTop: "1px solid var(--border-primary)",
          }}
        >
          <button
            type="button"
            onClick={() => {
              if (onOpenProfile) {
                onOpenProfile();
              } else {
                onClose();
              }
            }}
            style={{
              flex: 1,
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid var(--border-primary)",
              backgroundColor: "var(--bg-tertiary)",
              color: "var(--text-primary)",
              fontSize: 15,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Thông tin
          </button>
          <button
            type="button"
            disabled={sending}
            onClick={() => void handleSend()}
            style={{
              flex: 1,
              padding: "10px 16px",
              borderRadius: 8,
              border: "none",
              backgroundColor: "var(--accent)",
              color: "#fff",
              fontSize: 15,
              fontWeight: 600,
              cursor: sending ? "wait" : "pointer",
              opacity: sending ? 0.85 : 1,
            }}
          >
            {sending ? "Đang gửi..." : "Kết bạn"}
          </button>
        </div>
      </div>
    </div>
  );
}
