import React from "react";

type NewFriendWelcomeCardProps = {
    partnerName: string;
    onPickSticker: (emoji: string) => void;
};

const STICKERS = ["👋", "🤝", "🎉"];

export default function NewFriendWelcomeCard({ partnerName, onPickSticker }: NewFriendWelcomeCardProps) {
    return (
        <div
            style={{
                maxWidth: 420,
                margin: "16px auto 24px",
                padding: "20px 18px 18px",
                borderRadius: 16,
                backgroundColor: "var(--bg-primary)",
                boxShadow: "var(--shadow-md)",
                border: "1px solid var(--border-primary)",
                textAlign: "center",
            }}
        >
            <div style={{ fontSize: 28, lineHeight: 1.2, marginBottom: 8 }}>
                <span style={{ marginRight: 4 }}>✨</span>
                <span>💬</span>
                <span style={{ marginLeft: 4 }}>✅</span>
            </div>
            <div
                style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: "var(--accent)",
                    marginBottom: 8,
                    lineHeight: 1.4,
                }}
            >
                Bạn và {partnerName} đã trở thành bạn
            </div>
            <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 16 }}>
                Chọn một sticker dưới đây để bắt đầu trò chuyện
            </div>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 12,
                    flexWrap: "wrap",
                }}
            >
                {STICKERS.map((em) => (
                    <button
                        key={em}
                        type="button"
                        onClick={() => onPickSticker(em)}
                        style={{
                            width: 72,
                            height: 72,
                            borderRadius: 14,
                            border: "1px solid var(--border-primary)",
                            backgroundColor: "var(--bg-secondary)",
                            fontSize: 36,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "transform 0.12s ease",
                        }}
                        onMouseDown={(e) => {
                            e.currentTarget.style.transform = "scale(0.96)";
                        }}
                        onMouseUp={(e) => {
                            e.currentTarget.style.transform = "scale(1)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "scale(1)";
                        }}
                    >
                        {em}
                    </button>
                ))}
            </div>
        </div>
    );
}
