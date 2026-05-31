import React from "react";
import { View, FlatList, Text, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/shared/theme/colors";
import { useChatStore } from "@/shared/store/useChatStore";
import { useFriendStore } from "@/shared/store/friendStore";
import { useAuthStore } from "@/shared/store/authStore";
import type { FriendResponseDto } from "@/shared/services/types";
import { ChatItem } from "@/views/mobile/chat/components/ChatItem";
import { formatTime } from "@/shared/utils/dateUtils";
import { getChatPreviewText } from "@/shared/utils/chatPreview";
import { getImageUrl } from "@/shared/utils/mediaUtils";

/** Đối tượng là "bạn" trong một FriendResponseDto so với user đăng nhập */
function partnerUserId(f: FriendResponseDto, currentUserId: string | undefined): string {
    if (!currentUserId) return f.friend.id;
    return f.user.id === currentUserId ? f.friend.id : f.user.id;
}

export default function StrangerChatsScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const colors = useThemeColors();
    const { rooms } = useChatStore();
    const { friends } = useFriendStore();
    const currentUserId = useAuthStore.getState().user?.id;

    const friendIdSet = new Set(friends.map((f) => partnerUserId(f, currentUserId)));

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
            <View style={{ backgroundColor: colors.headerBg, paddingTop: insets.top }}>
                <View style={{
                    height: 52,
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 16,
                    borderBottomWidth: 0.5,
                    borderBottomColor: colors.border
                }}>
                    <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
                        <Ionicons name="chevron-back" size={28} color={colors.headerText} />
                    </TouchableOpacity>
                    <Text style={{ color: colors.headerText, fontSize: 18, fontWeight: "bold" }}>
                        Tin nhắn từ người lạ
                    </Text>
                </View>
            </View>

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
