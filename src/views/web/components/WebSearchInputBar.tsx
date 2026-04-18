import React, { useState } from "react";
import { useThemeStore } from "@/shared/store/themeStore";

/** Placeholder thống nhất với thanh tìm ở Tin nhắn (GlobalSearchBar). */
export const WEB_SEARCH_PLACEHOLDER =
  "Tìm tin nhắn, tên hoặc số điện thoại...";

export interface WebSearchInputBarProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  /**
   * Nếu truyền: chỉ dùng giá trị này cho viền xanh (GlobalSearchBar: `isOpen`).
   * Nếu không: viền xanh khi đang focus hoặc có chữ (Danh bạ sidebar).
   */
  borderActive?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onInputFocus?: React.FocusEventHandler<HTMLInputElement>;
  onInputBlur?: React.FocusEventHandler<HTMLInputElement>;
  /** Gọi khi bấm nút X (mặc định: onValueChange('')) */
  onClear?: () => void;
  /** Vùng bên phải sau nút xóa (vd. nút « Đóng ») */
  trailingSlot?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Thanh tìm kiếm web thống nhất (nền xám, bo 8px, viền xanh khi nhập / emphasized).
 */
const WebSearchInputBar: React.FC<WebSearchInputBarProps> = ({
  value,
  onValueChange,
  placeholder = WEB_SEARCH_PLACEHOLDER,
  borderActive,
  inputRef,
  onInputFocus,
  onInputBlur,
  onClear,
  trailingSlot,
  style,
  className,
}) => {
  const isDark = useThemeStore((s) => s.theme === "dark");
  const [focused, setFocused] = useState(false);

  const inputBg = isDark ? "rgba(255,255,255,0.07)" : "#f1f3f4";
  const inputBgFocus = isDark ? "rgba(255,255,255,0.11)" : "#e8f0fe";
  const textPrimary = "var(--text-primary)";
  const textMuted = "var(--text-muted)";

  const highlight =
    borderActive !== undefined
      ? borderActive
      : focused || !!value.trim();

  return (
    <div
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: highlight ? inputBgFocus : inputBg,
        border: `1.5px solid ${highlight ? "#0068ff" : "transparent"}`,
        borderRadius: 8,
        padding: "0 10px",
        transition: "background 0.2s, border-color 0.2s",
        width: "100%",
        boxSizing: "border-box",
        ...style,
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke={highlight ? "#0068ff" : textMuted}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0, transition: "stroke 0.2s" }}
        aria-hidden
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>

      <input
        ref={inputRef}
        type="text"
        enterKeyHint="search"
        autoComplete="off"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onFocus={(e) => {
          setFocused(true);
          onInputFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onInputBlur?.(e);
        }}
        placeholder={placeholder}
        style={{
          flex: 1,
          minWidth: 0,
          background: "transparent",
          border: "none",
          outline: "none",
          fontSize: 13,
          color: textPrimary,
          padding: "7px 0",
        }}
      />

      {value ? (
        <button
          type="button"
          onClick={() => (onClear ? onClear() : onValueChange(""))}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 2,
            color: textMuted,
            display: "flex",
            alignItems: "center",
          }}
          aria-label="Xóa từ khóa"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      ) : null}

      {trailingSlot}
    </div>
  );
};

export default WebSearchInputBar;
