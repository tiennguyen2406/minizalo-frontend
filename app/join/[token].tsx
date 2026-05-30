import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuthStore } from "@/shared/store/authStore";
import { groupService } from "@/shared/services/groupService";
import { useChatStore } from "@/shared/store/useChatStore";

export default function JoinRoute() {
    const { token } = useLocalSearchParams<{ token: string }>();
    const router = useRouter();
    const { accessToken, isHydrated } = useAuthStore();
    const { upsertRoom } = useChatStore();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isHydrated) return;

        if (!accessToken) {
            // Redirect to login, passing the redirectTo parameter so we return after logging in
            router.replace({
                pathname: "/(auth)/login",
                params: { redirectTo: `/join/${token}` }
            });
            return;
        }

        if (!token) {
            setError("Link tham gia nhóm không hợp lệ.");
            setLoading(false);
            return;
        }

        const joinGroup = async () => {
            try {
                const group = await groupService.joinByLink(token);
                
                // Add the joined group to the chat store so it appears in the sidebar/chat list
                upsertRoom({
                    id: group.id,
                    name: group.groupName,
                    type: "GROUP",
                    unreadCount: 0,
                    participants: group.members.map((m) => ({
                        id: m.userId,
                        username: m.username,
                        fullName: m.fullName || m.username,
                        avatarUrl: m.avatarUrl,
                    })),
                    updatedAt: group.createdAt,
                    avatarUrl: group.avatarUrl,
                    wallpaperUrl: group.wallpaperUrl,
                    description: group.description,
                });

                if (Platform.OS === "web") {
                    // On Web, use the main tabs layout with the sidebar, and set the active chat room in the store
                    useChatStore.getState().setPendingOpenRoomId(group.id);
                    router.replace("/(tabs)");
                } else {
                    // Redirect to the newly joined group chat
                    router.replace({
                        pathname: `/chat/${group.id}`,
                        params: {
                            name: group.groupName,
                            type: "GROUP"
                        }
                    });
                }
            } catch (err: any) {
                console.error("Failed to join group by link:", err);
                const message = err?.response?.data?.message || "Không thể tham gia nhóm. Link đã hết hạn hoặc không tồn tại.";
                setError(message);
                setLoading(false);
            }
        };

        void joinGroup();
    }, [isHydrated, accessToken, token]);

    if (loading) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#0068FF" />
                <Text style={styles.text}>Đang xử lý yêu cầu tham gia nhóm...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.container}>
                <Text style={styles.errorText}>⚠️ Lỗi tham gia nhóm</Text>
                <Text style={styles.errorSubText}>{error}</Text>
                <TouchableOpacity
                    style={styles.button}
                    onPress={() => router.replace("/(tabs)")}
                >
                    <Text style={styles.buttonText}>Quay về trang chủ</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return null;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#fff",
        padding: 24,
    },
    text: {
        marginTop: 16,
        fontSize: 16,
        color: "#333",
        fontWeight: "500",
    },
    errorText: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#dc2626",
        marginBottom: 8,
    },
    errorSubText: {
        fontSize: 15,
        color: "#666",
        textAlign: "center",
        marginBottom: 24,
        maxWidth: 320,
    },
    button: {
        backgroundColor: "#0068FF",
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 24,
    },
    buttonText: {
        color: "#fff",
        fontSize: 15,
        fontWeight: "600",
    },
});
