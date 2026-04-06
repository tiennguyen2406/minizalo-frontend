import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const WEB_KEY = "minizalo_device_id_web";
const MOBILE_KEY = "minizalo_device_id_mobile";

function randomId(): string {
    // Short, unique enough for device-id in demo projects
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function getOrCreateDeviceId(): Promise<string> {
    if (Platform.OS === "web") {
        try {
            const existing = localStorage.getItem(WEB_KEY);
            if (existing) return existing;
            const id = randomId();
            localStorage.setItem(WEB_KEY, id);
            return id;
        } catch {
            return randomId();
        }
    }

    try {
        const existing = await AsyncStorage.getItem(MOBILE_KEY);
        if (existing) return existing;
        const id = randomId();
        await AsyncStorage.setItem(MOBILE_KEY, id);
        return id;
    } catch {
        return randomId();
    }
}

export function getDeviceType(): "WEB" | "MOBILE" {
    return Platform.OS === "web" ? "WEB" : "MOBILE";
}

