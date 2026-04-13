import React, { useState } from "react";

const STICKER_PRESETS = [
  { emoji: "👋", caption: "HI!" },
  { emoji: "❤️", caption: "HELLO!" },
  { emoji: "🐶", caption: "HELLO!!!" },
  { emoji: "😊", caption: "Chào!" },
  { emoji: "🎉", caption: "Yeah!" },
  { emoji: "🙌", caption: "Hi there!" },
];

type FriendshipWelcomeCardProps = {
  partnerName: string;
  partnerAvatarUrl?: string | null;
  myAvatarUrl?: string | null;
  /** Ký tự hiển thị khi chưa có ảnh đại diện của mình. */
  myFallbackInitial?: string;
  onPickSticker: (emoji: string) => void;
};

/** Thẻ chào mừng kết bạn (kiểu Zalo): ngày + avatar + sticker gợi ý. */
export default function FriendshipWelcomeCard({
  partnerName,
  partnerAvatarUrl,
  myAvatarUrl,
  myFallbackInitial = "?",
  onPickSticker,
}: FriendshipWelcomeCardProps) {
  const [carousel, setCarousel] = useState(0);
  const visible = 3;
  const maxStart = Math.max(0, STICKER_PRESETS.length - visible);
  const start = Math.min(carousel, maxStart);
  const slice = STICKER_PRESETS.slice(start, start + visible);

  const partnerInitial =
    (partnerName || "?").charAt(0).toUpperCase() || "?";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "12px 8px 20px",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: "inline-block",
          padding: "5px 16px",
          borderRadius: 999,
          backgroundColor: "#cbd5e1",
          fontSize: 12,
          fontWeight: 600,
          marginBottom: 14,
          color: "#fff",
        }}
      >
        Hôm nay
      </div>

      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 360,
          borderRadius: 16,
          backgroundColor: "#fff",
          boxShadow: "0 4px 24px rgba(0, 104, 255, 0.12), 0 2px 8px rgba(0,0,0,0.06)",
          overflow: "hidden",
        }}
      >
        {/* Trang trí confetti */}
        <div
          style={{
            position: "relative",
            height: 100,
            background:
              "linear-gradient(180deg, #e0f0ff 0%, #f8fbff 55%, #fff 100%)",
            overflow: "hidden",
          }}
        >
          {["⭐", "💬", "✨", "🎊", "💛", "🔵", "🟣"].map((ch, i) => (
            <span
              key={i}
              style={{
                position: "absolute",
                left: `${8 + (i * 47) % 88}%`,
                top: `${12 + (i * 23) % 55}px`,
                fontSize: 12 + (i % 4) * 3,
                opacity: 0.55 + (i % 3) * 0.12,
                transform: `rotate(${i * 17}deg)`,
              }}
            >
              {ch}
            </span>
          ))}
          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: -28,
              transform: "translateX(-50%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                border: "3px solid #fff",
                overflow: "hidden",
                background: "#e5e7eb",
                marginRight: -18,
                zIndex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                fontWeight: 700,
                color: "#4b5563",
              }}
            >
              {myAvatarUrl ? (
                <img
                  src={myAvatarUrl}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                myFallbackInitial.charAt(0).toUpperCase() || "?"
              )}
            </div>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                border: "3px solid #fff",
                overflow: "hidden",
                background: "#dbeafe",
                zIndex: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                fontWeight: 700,
                color: "#1d4ed8",
              }}
            >
              {partnerAvatarUrl ? (
                <img
                  src={partnerAvatarUrl}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                partnerInitial
              )}
            </div>
          </div>
        </div>

        <div style={{ padding: "36px 20px 18px", textAlign: "center" }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#0f3d91",
              lineHeight: 1.35,
              marginBottom: 8,
            }}
          >
            Bạn và {partnerName} đã trở thành bạn
          </div>
          <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.4 }}>
            Chọn một sticker dưới đây để bắt đầu trò chuyện
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "0 10px 18px",
          }}
        >
          <button
            type="button"
            aria-label="Trước"
            disabled={start <= 0}
            onClick={() => setCarousel((c) => Math.max(0, c - 1))}
            style={{
              flexShrink: 0,
              width: 28,
              height: 36,
              border: "none",
              borderRadius: 8,
              background: start <= 0 ? "#f3f4f6" : "#eef2ff",
              color: start <= 0 ? "#d1d5db" : "#0068ff",
              cursor: start <= 0 ? "default" : "pointer",
              fontSize: 18,
            }}
          >
            ‹
          </button>
          <div
            style={{
              flex: 1,
              display: "flex",
              gap: 8,
              justifyContent: "center",
            }}
          >
            {slice.map((s, idx) => (
              <button
                key={`${start}-${idx}`}
                type="button"
                onClick={() => onPickSticker(s.emoji)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  maxWidth: 96,
                  padding: "10px 6px",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  background: "#fafafa",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  transition: "transform 0.15s, box-shadow 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.04)";
                  e.currentTarget.style.boxShadow =
                    "0 4px 12px rgba(0,104,255,0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "none";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <span style={{ fontSize: 40, lineHeight: 1 }}>{s.emoji}</span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#6b7280",
                    letterSpacing: "0.02em",
                  }}
                >
                  {s.caption}
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-label="Sau"
            disabled={start >= maxStart}
            onClick={() => setCarousel((c) => Math.min(maxStart, c + 1))}
            style={{
              flexShrink: 0,
              width: 28,
              height: 36,
              border: "none",
              borderRadius: 8,
              background: start >= maxStart ? "#f3f4f6" : "#eef2ff",
              color: start >= maxStart ? "#d1d5db" : "#0068ff",
              cursor: start >= maxStart ? "default" : "pointer",
              fontSize: 18,
            }}
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}
