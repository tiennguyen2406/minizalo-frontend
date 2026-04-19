import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '@/shared/store/authStore';

function keyForRoom(roomId: string): string {
    const uid = useAuthStore.getState().user?.id || 'anonymous';
    return `minizalo:${uid}:chatWallpaper:${roomId}`;
}

export async function getChatWallpaperUri(roomId: string | undefined | null): Promise<string | null> {
    if (!roomId) return null;
    try {
        const v = await AsyncStorage.getItem(keyForRoom(String(roomId)));
        return v && v.length > 0 ? v : null;
    } catch {
        return null;
    }
}

export async function setChatWallpaperUri(
    roomId: string,
    uri: string | null,
): Promise<void> {
    const k = keyForRoom(String(roomId));
    if (uri == null || uri === '') {
        await AsyncStorage.removeItem(k);
    } else {
        await AsyncStorage.setItem(k, uri);
    }
}
