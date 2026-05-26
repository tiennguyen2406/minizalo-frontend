import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface NotificationSettingsState {
    enabled: boolean;
    setEnabled: (enabled: boolean) => void;
    toggle: () => void;
}

export const useNotificationSettingsStore = create<NotificationSettingsState>()(
    persist(
        (set, get) => ({
            enabled: true,
            setEnabled: (enabled) => set({ enabled }),
            toggle: () => set({ enabled: !get().enabled }),
        }),
        {
            name: "minizalo-notification-settings",
            storage: createJSONStorage(() => (Platform.OS === "web" ? localStorage : AsyncStorage)),
        },
    ),
);
