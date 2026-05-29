import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Platform, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { chatService, mapChatRoomResponseToFrontend } from "@/shared/services/chatService";
import { useChatStore } from "@/shared/store/useChatStore";
import { useThemeColors } from "@/shared/theme/colors";
export default function ZaloCloudScreen() {
    const isWeb = Platform.OS === "web";
    const router = useRouter();
    const rooms = useChatStore((s) => s.rooms);
    const mergeRooms = useChatStore((s) => s.mergeRooms);
    const [loading, setLoading] = useState(true);
    const colors = useThemeColors();

    const cloudRoom = useMemo(() => rooms.find((r) => r.type === "CLOUD"), [rooms]);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            try {
                // Ensure rooms are loaded (and Cloud is created server-side if missing)
                const apiRooms = await chatService.getChatRooms();
                if (cancelled) return;
                const mapped = apiRooms.map(mapChatRoomResponseToFrontend);
                mergeRooms(mapped as any);
            } catch {
                // ignore
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        void run();
        return () => {
            cancelled = true;
        };
    }, [mergeRooms]);

    useEffect(() => {
        if (!cloudRoom?.id) return;
        router.replace(`/chat/${cloudRoom.id}`);
    }, [cloudRoom?.id, router]);

    return (
        <View
            style={
                isWeb
                    ? { flex: 1, padding: 24, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }
                    : { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }
            }
        >
            <ActivityIndicator color={colors.primary} />
            <Text style={{ marginTop: 10, color: colors.textSecondary }}>
                {loading ? "Đang mở Cloud của tôi..." : "Không tìm thấy Cloud. Vui lòng thử lại."}
            </Text>
        </View>
    );
}
