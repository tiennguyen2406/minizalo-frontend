import { Appearance } from "react-native";
import { useThemeStore } from "../store/themeStore";
import type { ThemeMode } from "../store/themeStore";

function resolve(mode: ThemeMode): "light" | "dark" {
    if (mode === "system") {
        return Appearance.getColorScheme() === "light" ? "light" : "dark";
    }
    return mode;
}

/**
 * Light & Dark color palettes for MiniZalo mobile.
 * Keys match the original PROFILE_COLORS so existing code keeps working.
 */

export const darkColors = {
    background: "#000000",
    card: "#1a1a1a",
    border: "#262626",
    text: "#ffffff",
    textSecondary: "#8e8e93",
    primary: "#0068FF",
    searchBg: "#1c1c1e",
    separator: "#000000",
    modalBg: "#1a1a1a",
    inputBg: "#1c1c1e",
    statusBar: "light" as const,
    // Header (dark matches Zalo's dark gray header)
    headerBg: "#1a1a1a",
    headerText: "#ffffff",
    headerSearchBg: "transparent",
    headerIcon: "#ffffff",
    // Tab bar
    tabBarBg: "#1a1a1a",
    tabBarBorder: "#262626",
    tabBarActive: "#0068FF",
    tabBarInactive: "#8e8e93",
    // Icons in menu lists
    iconColor: "#ffffff",
    listItemBg: "transparent",
    chatBg: "#000000",
};

export const lightColors = {
    background: "#f2f2f7",
    card: "#ffffff",
    border: "#d1d1d6",
    text: "#000000",
    textSecondary: "#6e6e73",
    primary: "#0068FF",
    searchBg: "#e3e3e8",
    separator: "#f2f2f7",
    modalBg: "#ffffff",
    inputBg: "#ffffff",
    statusBar: "light" as const, // always light because header is blue
    // Header (light = blue header like Zalo)
    headerBg: "#0068FF",
    headerText: "#ffffff",
    headerSearchBg: "rgba(255,255,255,0.25)",
    headerIcon: "#ffffff",
    // Tab bar
    tabBarBg: "#ffffff",
    tabBarBorder: "#d1d1d6",
    tabBarActive: "#0068FF",
    tabBarInactive: "#6e6e73",
    // Icons in menu lists
    iconColor: "#1c1c1e",
    listItemBg: "#ffffff",
    chatBg: "#ffffff",
};

export interface ThemeColors {
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
