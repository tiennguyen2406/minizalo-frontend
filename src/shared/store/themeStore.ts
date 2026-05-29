import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemeMode = "light" | "dark";

interface ThemeState {
    theme: ThemeMode;
    setTheme: (theme: ThemeMode) => void;
    toggleTheme: () => void;
}

const applyThemeToDOM = (theme: ThemeMode) => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
        const root = document.documentElement;
        if (theme === "dark") {
            root.classList.add("dark");
        } else {
            root.classList.remove("dark");
        }
        root.setAttribute("data-theme", theme);
    }
};

export const useThemeStore = create<ThemeState>()(
    persist(
        (set, get) => ({
            theme: "light", // Mặc định là sáng, sẽ bị ghi đè bởi giá trị lưu trong máy

            setTheme: (theme: ThemeMode) => {
                set({ theme });
                applyThemeToDOM(theme);
            },

            toggleTheme: () => {
                const next = get().theme === "light" ? "dark" : "light";
                get().setTheme(next);
            },
        }),
        {
            name: "minizalo-theme",
            storage: createJSONStorage(() => (Platform.OS === "web" ? localStorage : AsyncStorage)),
            onRehydrateStorage: () => (state) => {
                // Sau khi load dữ liệu từ máy lên, áp dụng ngay cho giao diện
                if (state) {
                    applyThemeToDOM(state.theme);
                }
            },
        }
    )
);
