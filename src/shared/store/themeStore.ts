import { create } from "zustand";
import { Platform } from "react-native";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeState {
    theme: ThemeMode;
    setTheme: (theme: ThemeMode) => void;
    toggleTheme: () => void;
}

const getInitialTheme = (): ThemeMode => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
        try {
            const saved = localStorage.getItem("minizalo-theme");
            if (saved === "dark" || saved === "light") return saved;
        } catch {
            // ignore
        }
        // Respect system preference
        if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
            return "dark";
        }
    }
    return "light";
};

const applyThemeToDOM = (theme: ThemeMode) => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
        const root = document.documentElement;
        if (theme === "dark") {
            root.classList.add("dark");
        } else {
            root.classList.remove("dark");
        }
        // Also set a data attribute for non-Tailwind CSS
        root.setAttribute("data-theme", theme);
    }
};

export const useThemeStore = create<ThemeState>((set, get) => {
    // Apply initial theme on creation
    const initial = getInitialTheme();
    // Defer DOM update to avoid SSR issues
    if (Platform.OS === "web" && typeof window !== "undefined") {
        queueMicrotask(() => applyThemeToDOM(initial));
    }

    return {
        theme: initial,

        setTheme: (theme: ThemeMode) => {
            set({ theme });
            applyThemeToDOM(theme);
            if (Platform.OS === "web" && typeof window !== "undefined") {
                try {
                    localStorage.setItem("minizalo-theme", theme);
                } catch {
                    // ignore
                }
            }
        },

        toggleTheme: () => {
            const next = get().theme === "light" ? "dark" : "light";
            get().setTheme(next);
        },
    };
});
