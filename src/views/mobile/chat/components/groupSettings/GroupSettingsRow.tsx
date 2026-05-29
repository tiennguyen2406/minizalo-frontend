import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/shared/theme/colors";

export function GroupSettingsSectionLabel({ title }: { title: string }) {
  const colors = useThemeColors();
  return (
    <Text
      style={{
        fontSize: 13,
        fontWeight: "600",
        color: colors.primary,
        // Align với text bên trong cell (card margin 12 + cell padding 16 = 28)
        paddingHorizontal: 28,
        paddingTop: 18,
        paddingBottom: 10,
        letterSpacing: 0.2,
      }}
    >
      {title}
    </Text>
  );
}

export function GroupSettingsRow({
  label,
  right,
  subtitle,
  onPress,
  first,
  last,
  danger,
  disabled,
  centerLabel,
  variant,
}: {
  label: string;
  right?: React.ReactNode;
  subtitle?: string;
  onPress?: () => void;
  first?: boolean;
  last?: boolean;
  danger?: boolean;
  disabled?: boolean;
  /** Dùng cho dòng action nguy hiểm như "Giải tán nhóm" */
  centerLabel?: boolean;
  /** Style preset cho row */
  variant?: "default" | "menu";
}) {
  const colors = useThemeColors();
  const pressedBg = colors.searchBg || colors.separator;
  const isMenu = variant === "menu";
  const rowMinHeight = centerLabel ? 60 : isMenu ? 56 : 52;
  const rowPaddingV = centerLabel ? 18 : isMenu ? 16 : 14;
  const labelFontSize = centerLabel ? 17 : isMenu ? 16 : 16;
  const labelLineHeight = centerLabel ? 24 : isMenu ? 22 : 22;
  const labelFontWeight = centerLabel ? "700" : danger ? "700" : "400";
  const rowPaddingH = 16;
  const baseStyle = {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingHorizontal: rowPaddingH,
    paddingVertical: rowPaddingV,
    backgroundColor: colors.card,
    minHeight: rowMinHeight,
    borderTopWidth: 0,
    borderBottomWidth: 0,
    opacity: disabled ? 0.55 : 1,
    overflow: "hidden" as const,
  };

  // Nếu row chỉ có Switch (không có onPress), dùng View để tránh pressed/ripple
  // gây cảm giác "nhấp nháy/rung" lan sang các dòng khác.
  const isInteractive = !!onPress && !disabled;

  const content = (
    <>
      <View
        style={{
          flex: 1,
          paddingRight: centerLabel ? 0 : 12,
          alignItems: centerLabel ? "center" : "flex-start",
        }}
      >
        <Text
          style={{
            fontSize: labelFontSize,
            color: danger ? "#ef4444" : colors.text,
            fontWeight: labelFontWeight as any,
            lineHeight: labelLineHeight,
            textAlign: centerLabel ? "center" : "left",
          }}
          numberOfLines={centerLabel ? 1 : subtitle ? 1 : 2}
          ellipsizeMode="tail"
        >
          {label}
        </Text>
        {subtitle ? (
          <Text
            style={{
              fontSize: 12.5,
              color: colors.textSecondary,
              marginTop: 4,
              lineHeight: 16,
              textAlign: centerLabel ? "center" : "left",
            }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {centerLabel ? null : (
        <View
          style={{
            flexShrink: 0,
            alignItems: "flex-end",
            justifyContent: "center",
            minWidth: isMenu ? 36 : 28,
            paddingLeft: isMenu ? 10 : 8,
            paddingRight: 0,
          }}
        >
          {right}
        </View>
      )}

      {!last ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: rowPaddingH,
            right: 0,
            bottom: 0,
            height: 0.5,
            backgroundColor: colors.border,
          }}
        />
      ) : null}
    </>
  );

  if (!isInteractive) {
    return <View style={baseStyle}>{content}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "rgba(0,0,0,0.06)", borderless: false }}
      style={({ pressed }) => [
        baseStyle,
        pressed ? { backgroundColor: pressedBg } : null,
      ]}
    >
      {content}
    </Pressable>
  );
}

export function ChevronRight() {
  const colors = useThemeColors();
  return <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />;
}

