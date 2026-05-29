import { Appearance, Platform } from "react-native";
import { useThemeStore } from "../store/themeStore";
import type { ThemeMode } from "../store/themeStore";

function resolve(mode: ThemeMode): "light" | "dark" {
    return mode;
}

/**
 * Light & Dark color palettes for MiniZalo mobile.
 * Keys match the original PROFILE_COLORS so existing code keeps working.
 */

const isWeb = Platform.OS === "web";

export const darkColors = {
    isDark: true,
    background: isWeb ? "var(--bg-secondary)" : "#000000",
    card: isWeb ? "var(--bg-primary)" : "#121212",
    border: isWeb ? "var(--border-primary)" : "#262626",
    text: isWeb ? "var(--text-primary)" : "#ffffff",
    textSecondary: isWeb ? "var(--text-secondary)" : "#8e8e93",
    primary: isWeb ? "var(--accent)" : "#0068FF",
    searchBg: isWeb ? "var(--bg-hover)" : "#1c1c1e",
    separator: isWeb ? "var(--bg-secondary)" : "#000000",
    modalBg: isWeb ? "var(--bg-modal)" : "#1a1a1a",
    inputBg: isWeb ? "var(--bg-input)" : "#1c1c1e",
    statusBar: "light" as const,
    headerBg: isWeb ? "var(--bg-chat-header)" : "#1c1c1e",
    headerText: isWeb ? "var(--text-primary)" : "#ffffff",
    headerSearchBg: "transparent",
    headerIcon: isWeb ? "var(--text-primary)" : "#ffffff",
    tabBarBg: isWeb ? "var(--bg-primary)" : "#1a1a1a",
    tabBarBorder: isWeb ? "var(--border-primary)" : "#262626",
    tabBarActive: isWeb ? "var(--accent)" : "#0068FF",
    tabBarInactive: isWeb ? "var(--text-muted)" : "#8e8e93",
    iconColor: isWeb ? "var(--text-primary)" : "#ffffff",
    listItemBg: "transparent",
    avatarBg: isWeb ? "var(--bg-tertiary)" : "#4a4a4c",
    chatBg: isWeb ? "var(--bg-chat-messages)" : "#000000",
};

export const lightColors = {
    isDark: false,
    background: isWeb ? "var(--bg-secondary)" : "#f2f2f7",
    card: isWeb ? "var(--bg-primary)" : "#ffffff",
    border: isWeb ? "var(--border-primary)" : "#d1d1d6",
    text: isWeb ? "var(--text-primary)" : "#000000",
    textSecondary: isWeb ? "var(--text-secondary)" : "#6e6e73",
    primary: isWeb ? "var(--accent)" : "#0068FF",
    searchBg: isWeb ? "var(--bg-hover)" : "#e3e3e8",
    separator: isWeb ? "var(--bg-secondary)" : "#f2f2f7",
    modalBg: isWeb ? "var(--bg-modal)" : "#ffffff",
    inputBg: isWeb ? "var(--bg-input)" : "#ffffff",
    statusBar: "light" as const,
    headerBg: isWeb ? "var(--bg-chat-header)" : "#0084ff",
    headerText: isWeb ? "var(--text-primary)" : "#ffffff",
    headerSearchBg: "transparent",
    headerIcon: isWeb ? "var(--text-primary)" : "#ffffff",
    tabBarBg: isWeb ? "var(--bg-primary)" : "#ffffff",
    tabBarBorder: isWeb ? "var(--border-primary)" : "#d1d1d6",
    tabBarActive: isWeb ? "var(--accent)" : "#0068FF",
    tabBarInactive: isWeb ? "var(--text-muted)" : "#6e6e73",
    iconColor: isWeb ? "var(--text-primary)" : "#1c1c1e",
    listItemBg: isWeb ? "var(--bg-primary)" : "#ffffff",
    avatarBg: isWeb ? "var(--bg-tertiary)" : "#e3e3e8",
    chatBg: isWeb ? "var(--bg-chat-messages)" : "#ffffff",
};

export interface ThemeColors {
    isDark: boolean;
    background: string;
    card: string;
    border: string;
    text: string;
    textSecondary: string;
    primary: string;
    searchBg: string;
    separator: string;
    modalBg: string;
    inputBg: string;
    statusBar: "light" | "dark" | "auto" | "inverted";
    headerBg: string;
    headerText: string;
    headerSearchBg: string;
    headerIcon: string;
    tabBarBg: string;
    tabBarBorder: string;
    tabBarActive: string;
    tabBarInactive: string;
    iconColor: string;
    listItemBg: string;
    avatarBg: string;
    chatBg: string;
}

/**
 * React hook – returns the color palette for the current theme.
 */
export function useThemeColors(): ThemeColors {
    const theme = useThemeStore((s) => s.theme);
    return resolve(theme) === "dark" ? darkColors : lightColors;
}

/**
 * Non-reactive getter – use outside React (e.g. StyleSheet.create at module level).
 */
export function getThemeColors(): ThemeColors {
    const theme = useThemeStore.getState().theme;
    return resolve(theme) === "dark" ? darkColors : lightColors;
}
