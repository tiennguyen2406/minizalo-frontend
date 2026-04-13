import React from "react";
import { View, FlatList, Text, TouchableOpacity, SafeAreaView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/shared/theme/colors";
import { useChatStore } from "@/shared/store/useChatStore";
import { useFriendStore } from "@/shared/store/friendStore";
import { useAuthStore } from "@/shared/store/authStore";
import { ChatItem } from "@/views/mobile/chat/components/ChatItem";
import { formatTime } from "@/shared/utils/dateUtils";
import { getChatPreviewText } from "@/shared/utils/chatPreview";

export default function StrangerChatsScreen() {
    const router = useRouter();
    const colors = useThemeColors();
    const { rooms } = useChatStore();
    const { friends } = useFriendStore();
    const currentUserId = useAuthStore.getState().user?.id;
    const getImageUrl = (url: string | undefined | null) => {
        if (!url) return null;

        // Handle MinIO relative paths (e.g., "minizalo-bucket/files/...")
        if (!url.startsWith('http') && !url.startsWith('data:') && !url.startsWith('file:')) {
            const baseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(':8080', ':9000') || '';
            const minioBase = baseUrl.includes(':9000') ? baseUrl : `${baseUrl.split(':')[0]}:${baseUrl.split(':')[1]}:9000`;
            return `${minioBase}/${url}`;
        }

        // Fix localhost/IP issues for external URLs
        if (process.env.EXPO_PUBLIC_API_URL) {
            const apiMatch = process.env.EXPO_PUBLIC_API_URL.match(/https?:\/\/([^:\/]+)/);
            if (apiMatch && apiMatch[1]) {
                const apiHost = apiMatch[1];
                if (url.includes("localhost")) {
                    return url.replace("localhost", apiHost);
                }
            }
        }

        return url;
    };

    const friendIdSet = new Set(friends.map(f => f.friend?.id || f.user?.id));

    const strangerRooms = rooms.filter(room => {
        if (room.type === 'PRIVATE' || (room.type as any) === 'DIRECT') {
            const partner = room.participants.find(p => p.id !== currentUserId);
            return partner && !friendIdSet.has(partner.id) && !room.hasInteracted;
        }
        return false;
    });

    const renderItem = ({ item }: { item: any }) => {
        let lastMsg = getChatPreviewText(item.lastMessage);

        // Ghi đè nếu là call message (getChatPreviewText chưa xử lý)
        if (item.lastMessage) {
            const lm = item.lastMessage;
            if (lm.content && lm.content.trim().startsWith('{') && lm.content.includes('"callType":')) {
                try {
                    const parsed = JSON.parse(lm.content);
                    const isVideo = parsed.callType === 'VIDEO';
                    const icon = isVideo ? '📹' : '📞';
                    if (parsed.status === 'MISSED') lastMsg = `${icon} Cuộc gọi nhỡ`;
                    else if (parsed.status === 'REJECTED' || parsed.status === 'CANCELLED') lastMsg = `${icon} Cuộc gọi bị hủy`;
                    else if (parsed.duration > 0) {
                        const m = Math.floor(parsed.duration / 60);
                        const s = parsed.duration % 60;
                        const dur = m > 0 ? `${m} phút ${s} giây` : `${s} giây`;
                        lastMsg = `${icon} Cuộc gọi ${isVideo ? 'video' : 'thoại'} - ${dur}`;
                    } else lastMsg = `${icon} Cuộc gọi ${isVideo ? 'video' : 'thoại'}`;
                } catch { lastMsg = lm.content; }
            } else if (lm.type === 'CALL_VOICE' || lm.type === 'CALL_VIDEO') {
                lastMsg = lm.type === 'CALL_VIDEO' ? '📹 Cuộc gọi video' : '📞 Cuộc gọi thoại';
            }
        }

        const avatarUri = getImageUrl(item.avatarUrl) || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name || "U")}`;

        return (
            <ChatItem
                avatar={{ uri: avatarUri }}
                name={item.name || "Người lạ"}
                message={lastMsg}
                time={item.lastMessage?.createdAt ? formatTime(item.lastMessage.createdAt) : ""}
                unreadCount={item.unreadCount}
                isVerified={false}
                onPress={() => {
                    const partner = item.participants.find((p: any) => p.id !== currentUserId);
                    router.push({
                        pathname: "/chat/[id]",
                        params: {
                            id: item.id,
                            name: item.name || "",
                            type: 'DIRECT',
                            isStranger: "true",
                            targetUserId: partner?.id || ""
                        }
                    } as any);
                }}
            />
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <SafeAreaView style={{ backgroundColor: colors.headerBg }}>
                <View style={{
                    height: 52,
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    borderBottomWidth: 0.5,
                    borderBottomColor: colors.border
                }}>
                    <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
                        <Ionicons name="chevron-back" size={28} color={colors.headerText} />
                    </TouchableOpacity>
                    <Text style={{ color: colors.headerText, fontSize: 18, fontWeight: 'bold' }}>
                        Tin nhắn từ người lạ
                    </Text>
                </View>
            </SafeAreaView>

            {strangerRooms.length === 0 ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
                    <Ionicons name="chatbubbles-outline" size={64} color={colors.textSecondary} />
                    <Text style={{ color: colors.textSecondary, fontSize: 16, marginTop: 16, textAlign: 'center' }}>
                        Không có tin nhắn nào từ người lạ
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={strangerRooms}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                />
            )}
        </View>
    );
}
