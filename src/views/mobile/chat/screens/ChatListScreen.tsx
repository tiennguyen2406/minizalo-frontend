import React, { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { View, FlatList, ActivityIndicator, Text, RefreshControl, Animated, AppState, Alert, TouchableOpacity, Modal, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { ChatListHeader } from "../components/ChatListHeader";
import { PinnedCloudItem } from "../components/PinnedCloudItem";
import { ChatItem } from "../components/ChatItem";
import { chatService, ChatRoomResponse } from "@/shared/services/chatService";
import { formatTime } from "@/shared/utils/dateUtils";
import { Ionicons } from "@expo/vector-icons";
import { useChatStore } from "@/shared/store/useChatStore";
import { useThemeColors } from "@/shared/theme/colors";
import { useAuthStore } from "@/shared/store/authStore";
import { useFriendStore } from "@/shared/store/friendStore";
import { splitRoomsMainAndStrangers } from "@/shared/utils/strangerChatRooms";
import { getChatPreviewText } from "@/shared/utils/chatPreview";
export default function ChatListScreen() {
    const router = useRouter();
    const { rooms, setRooms, mergeRooms, pinnedRooms, mutedRooms, togglePinRoom, toggleMuteRoom, deleteRoom } = useChatStore();
    const colors = useThemeColors();
    const currentUserId = useAuthStore((s) => s.user?.id);
    const friends = useFriendStore((s) => s.friends);
    const fetchFriends = useFriendStore((s) => s.fetchFriends);
    const [friendsListReady, setFriendsListReady] = useState(false);
    const [inboxTab, setInboxTab] = useState<"main" | "strangers">("main");
    const [refreshing, setRefreshing] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const [actionRoom, setActionRoom] = useState<(typeof rooms)[number] | null>(null);
    const [showMuteDuration, setShowMuteDuration] = useState(false);
    const [selectedMuteDuration, setSelectedMuteDuration] = useState<string>("1h");

    const displayRooms = useMemo(() => {
        let result: typeof rooms;
        if (!currentUserId || !friendsListReady) {
            if (inboxTab === "strangers") return [];
            result = rooms;
        } else {
            const { mainRooms, strangerRooms } = splitRoomsMainAndStrangers(
                rooms,
                currentUserId,
                friends,
            );
            result = inboxTab === "strangers" ? strangerRooms : mainRooms;
        }
        return [...result]
            // Cloud sẽ được hiển thị riêng ở item ghim trên đầu (PinnedCloudItem)
            .filter((r) => r.type !== "CLOUD")
            .filter((r) => !!r.lastMessage) // Chỉ hiện phòng đã có tin nhắn
            .sort((a, b) => {
                const aPinned = pinnedRooms.has(a.id);
                const bPinned = pinnedRooms.has(b.id);
                if (aPinned !== bPinned) return aPinned ? -1 : 1;
                // Sort by most recent message within each group
                return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
            });

    }, [rooms, currentUserId, friends, friendsListReady, inboxTab, pinnedRooms]);

    const friendIdSet = useMemo(() => {
        const ids = new Set<string>();
        for (const f of (friends || []) as any[]) {
            // f.id is the relationship ID — NOT a user ID, skip it
            if (f?.user?.id) ids.add(f.user.id);
            if (f?.friend?.id) ids.add(f.friend.id);
        }
        return ids;
    }, [friends]);

    // Helper function to process image URLs (similar to ChatScreen)
    const getImageUrl = (url: string) => {
        if (!url) return url;

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

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchChats().finally(() => setRefreshing(false));
    }, []);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const hasLoadedOnce = useRef(false);

    const fetchChats = async (showLoading = false) => {
        try {
            if (showLoading && !hasLoadedOnce.current) setLoading(true);
            setError(null);

            // Lấy danh sách từ API
            const data = await chatService.getChatRooms();
            const existingRooms = useChatStore.getState().rooms;

            // Deduplicate CLOUD rooms (keep first, ignore the rest)
            const seenCloud = { value: false };

            // Map sang ChatRoom interface của store (giống Web)
            const storeRooms = data.flatMap((r) => {
                let resolvedName = r.name;
                if (r.type === 'CLOUD') {
                    if (seenCloud.value) return [];
                    seenCloud.value = true;
                    resolvedName = 'Cloud của tôi';
                } else if (r.type === 'DIRECT' && (!resolvedName || resolvedName.trim() === '')) {
                    const partner = (r.members || []).find(
                        (m: any) => (m.user?.id || m.id) !== currentUserId
                    );
                    resolvedName = partner?.user?.displayName || partner?.user?.username || partner?.displayName || partner?.username || 'Người dùng';
                }
                return [{
                    id: r.id,
                    name: resolvedName || (r.type === 'CLOUD' ? 'Cloud của tôi' : 'Người dùng'),
                    avatarUrl: r.avatarUrl || undefined,
                    type: r.type === 'GROUP' ? ('GROUP' as const) : r.type === 'CLOUD' ? ('CLOUD' as const) : ('PRIVATE' as const),
                    lastMessage: r.lastMessage
                        ? {
                            id: r.lastMessage.messageId,
                            senderId: r.lastMessage.senderId,
                            senderName: r.lastMessage.senderName,
                            roomId: r.id,
                            content: r.lastMessage.recalled
                                ? '[Tin nhắn đã thu hồi]'
                                : r.lastMessage.content,
                            type: (r.lastMessage.type as any) || 'TEXT',
                            createdAt: r.lastMessage.createdAt,
                            recalled: r.lastMessage.recalled || false,
                        }
                        : undefined,
                    // unreadCount sẽ được merge an toàn bên trong mergeRooms (tránh race condition)
                    unreadCount: r.unreadCount || 0,
                    participants: (r.members || []).map((m: any) => ({
                        id: m.user?.id || m.id || '',
                        username: m.user?.username || m.username || '',
                        fullName: m.user?.displayName || m.user?.fullName || m.displayName || m.fullName || '',
                        avatarUrl: m.user?.avatarUrl || m.avatarUrl || undefined,
                    })),
                    updatedAt: r.lastMessage?.createdAt || r.createdAt || new Date().toISOString(),
                    hasInteracted: r.hasInteracted,
                }];
            });

            storeRooms.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
            // Dùng mergeRooms thay setRooms để giữ unreadCount cao nhất (tránh race condition WS)
            mergeRooms(storeRooms);

            hasLoadedOnce.current = true;
            // Fade in animation
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 350,
                useNativeDriver: true,
            }).start();
        } catch (err: any) {
            console.log("Error fetching chats:", err);
            if (rooms.length === 0) {
                setError(err.message || "Failed to fetch chats");
            }
        } finally {
            setLoading(false);
        }
    };
    // Fetch chats when screen is focused
    useFocusEffect(
        useCallback(() => {
            fetchChats(true);
            void fetchFriends().finally(() => setFriendsListReady(true));

            // Xóa currentRoomId khi ở màn hình danh sách
            useChatStore.getState().setCurrentRoom(null);

            const interval = setInterval(() => {
                fetchChats(false);
            }, 10000);

            return () => clearInterval(interval);
        }, [fetchFriends])
    );

    // Xử lý khi quay lại app từ nền (để xóa trễ push noti)
    useEffect(() => {
        const subscription = AppState.addEventListener("change", (nextAppState) => {
            if (nextAppState === "active") {
                fetchChats(false);
                fetchFriends();
            }
        });
        return () => subscription.remove();
    }, []);

    const renderItem = ({ item }: { item: (typeof rooms)[number] }) => {
        const processedAvatar = item.avatarUrl ? getImageUrl(item.avatarUrl) : "";
        const avatarUri = processedAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name || "User")}&background=random&color=fff`;
        let lastMsg = "Chưa có tin nhắn";
        if (item.lastMessage) {
            const lm = item.lastMessage;
            if (lm.recalled || lm.content === '[Tin nhắn đã thu hồi]') {
                lastMsg = '[Tin nhắn đã thu hồi]';
            } else if (lm.content && lm.content.trim().startsWith('{') && lm.content.includes('"callType":')) {
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
            } else {
                // Dùng hàm của develop cho các case còn lại
                lastMsg = getChatPreviewText(item.lastMessage as any);
            }
        }

        let timeDisplay = "";
        if (item.lastMessage?.createdAt) {
            timeDisplay = formatTime(item.lastMessage.createdAt);
        }

        const partner = item.type === 'PRIVATE' ? item.participants.find((p: any) => p.id !== currentUserId) : null;
        const isPartnerStranger = partner && !friendIdSet.has(partner.id);
        const receiverId = partner?.id || "";
        return (
            <Animated.View style={{ opacity: fadeAnim }}>
                <ChatItem
                    avatar={{ uri: avatarUri }}
                    name={item.name || "Người dùng"}
                    message={lastMsg}
                    time={timeDisplay}
                    unreadCount={item.unreadCount}
                    isVerified={false}
                    isPinned={pinnedRooms.has(item.id)}
                    isMuted={mutedRooms.has(String(item.id))}
                    onLongPress={() => setActionRoom(item)}
                    onPress={() => {
                        const t =
                            item.type === "GROUP"
                                ? "GROUP"
                                : item.type === "CLOUD"
                                  ? "CLOUD"
                                  : "DIRECT";
                        router.push(
                            `/chat/${item.id}?name=${encodeURIComponent(item.name || "")}&type=${t}&isStranger=${isPartnerStranger ? "true" : "false"}${partner?.id ? `&targetUserId=${partner.id}` : ""}&receiverId=${receiverId}`,
                        );
                    }}
                />
            </Animated.View>
        );
    };

    const inboxTabRow =
        !loading && !error && rooms.length > 0 ? (
            <View
                style={{
                    flexDirection: "row",
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    gap: 8,
                    borderBottomWidth: 0.5,
                    borderBottomColor: colors.border,
                    backgroundColor: colors.background,
                }}
            >
                <TouchableOpacity
                    onPress={() => setInboxTab("main")}
                    style={{
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                        borderRadius: 20,
                        backgroundColor:
                            inboxTab === "main" ? colors.primary + "22" : "transparent",
                    }}
                >
                    <Text
                        style={{
                            fontSize: 14,
                            fontWeight: inboxTab === "main" ? "700" : "500",
                            color: inboxTab === "main" ? colors.primary : colors.textSecondary,
                        }}
                    >
                        Tất cả
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setInboxTab("strangers")}
                    style={{
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                        borderRadius: 20,
                        backgroundColor:
                            inboxTab === "strangers" ? colors.primary + "22" : "transparent",
                    }}
                >
                    <Text
                        style={{
                            fontSize: 14,
                            fontWeight: inboxTab === "strangers" ? "700" : "500",
                            color:
                                inboxTab === "strangers" ? colors.primary : colors.textSecondary,
                        }}
                    >
                        Người lạ
                    </Text>
                </TouchableOpacity>
            </View>
        ) : null;

    const tabEmptyMessage = () => {
        if (!friendsListReady && inboxTab === "strangers") {
            return "Đang tải danh sách…";
        }
        if (inboxTab === "strangers") {
            return "Không có tin nhắn từ người lạ";
        }
        if (rooms.length > 0) {
            return "Không có cuộc trò chuyện ở mục này. Các chat 1-1 chưa kết bạn nằm ở tab Người lạ.";
        }
        return "Chưa có cuộc trò chuyện nào";
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <ChatListHeader />
            {inboxTabRow}
            {loading && rooms.length === 0 ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={{ color: colors.textSecondary, marginTop: 12, fontSize: 13 }}>Đang tải tin nhắn...</Text>
                </View>
            ) : error && rooms.length === 0 ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, paddingHorizontal: 32 }}>
                    <Ionicons name="cloud-offline-outline" size={48} color={colors.textSecondary} />
                    <Text style={{ color: "#ff4d4f", marginTop: 12, fontSize: 15, fontWeight: '500' }}>Không thể tải danh sách tin nhắn</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>{error}</Text>
                    <Text style={{ color: colors.primary, marginTop: 16, fontSize: 14, fontWeight: '500' }} onPress={onRefresh}>Thử lại</Text>
                </View>
            ) : rooms.length === 0 ? (
                <FlatList
                    contentContainerStyle={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={colors.primary}
                            colors={[colors.primary]}
                        />
                    }
                    data={[]}
                    renderItem={null}
                    ListEmptyComponent={() => (
                        <View style={{ alignItems: 'center', paddingHorizontal: 32 }}>
                            <Ionicons name="chatbubbles-outline" size={56} color={colors.textSecondary} />
                            <Text style={{ color: colors.textSecondary, fontSize: 15, marginTop: 12 }}>Chưa có cuộc trò chuyện nào</Text>
                            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4, opacity: 0.8 }}>Bắt đầu trò chuyện với bạn bè ngay!</Text>
                        </View>
                    )}
                />
            ) : (
                <FlatList
                    data={displayRooms}
                    keyExtractor={(item) => item.id}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={colors.primary}
                            colors={[colors.primary]}
                        />
                    }
                    ListHeaderComponent={() => (
                        <View>
                            <PinnedCloudItem />
                        </View>
                    )}
                    ListEmptyComponent={
                        rooms.length > 0 && displayRooms.length === 0
                            ? () => (
                                <View
                                    style={{
                                        alignItems: "center",
                                        paddingHorizontal: 32,
                                        paddingTop: 32,
                                    }}
                                >
                                    <Ionicons
                                        name="people-outline"
                                        size={48}
                                        color={colors.textSecondary}
                                    />
                                    <Text
                                        style={{
                                            color: colors.textSecondary,
                                            fontSize: 15,
                                            marginTop: 12,
                                            textAlign: "center",
                                        }}
                                    >
                                        {tabEmptyMessage()}
                                    </Text>
                                </View>
                            )
                            : undefined
                    }
                    renderItem={renderItem}
                    contentContainerStyle={{
                        paddingBottom: 100,
                        flexGrow: 1,
                    }}
                    showsVerticalScrollIndicator={false}
                />
            )}

            {/* Long-press actions */}
            <Modal
                transparent
                animationType="fade"
                visible={!!actionRoom && !showMuteDuration}
                onRequestClose={() => setActionRoom(null)}
            >
                <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }} onPress={() => setActionRoom(null)}>
                    <Pressable
                        style={{
                            backgroundColor: colors.card,
                            borderTopLeftRadius: 24,
                            borderTopRightRadius: 24,
                            paddingTop: 10,
                            paddingBottom: 26,
                            borderWidth: 1,
                            borderColor: colors.border,
                        }}
                        onPress={(e) => e.stopPropagation()}
                    >
                        <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 999, backgroundColor: colors.border, marginBottom: 12 }} />

                        {actionRoom && (
                            <>
                                <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800", paddingHorizontal: 18, marginBottom: 10 }} numberOfLines={1}>
                                    {actionRoom.name || "Hội thoại"}
                                </Text>

                                <TouchableOpacity
                                    onPress={() => {
                                        togglePinRoom(actionRoom.id);
                                        setActionRoom(null);
                                    }}
                                    style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 14, gap: 12 }}
                                >
                                    <Ionicons name={pinnedRooms.has(actionRoom.id) ? "pin-outline" : "pin"} size={20} color={colors.text} />
                                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>
                                        {pinnedRooms.has(actionRoom.id) ? "Bỏ ghim hội thoại" : "Ghim hội thoại"}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => {
                                        if (mutedRooms.has(String(actionRoom.id))) {
                                            toggleMuteRoom(actionRoom.id);
                                            setActionRoom(null);
                                        } else {
                                            setSelectedMuteDuration("1h");
                                            setShowMuteDuration(true);
                                        }
                                    }}
                                    style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 14, gap: 12 }}
                                >
                                    <Ionicons name={mutedRooms.has(String(actionRoom.id)) ? "volume-high" : "volume-mute"} size={20} color={colors.text} />
                                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>
                                        {mutedRooms.has(String(actionRoom.id)) ? "Bật thông báo" : "Tắt thông báo"}
                                    </Text>
                                </TouchableOpacity>

                                <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 18, marginVertical: 4 }} />

                                <TouchableOpacity
                                    onPress={() => {
                                        setActionRoom(null);
                                        const roomId = actionRoom.id;
                                        const roomName = actionRoom.name || 'đoạn chat này';
                                        Alert.alert(
                                            'Xóa đoạn chat',
                                            `Toàn bộ tin nhắn trong "${roomName}" sẽ bị xóa vĩnh viễn. Bạn có chắc không?`,
                                            [
                                                { text: 'Hủy', style: 'cancel' },
                                                {
                                                    text: 'Xóa',
                                                    style: 'destructive',
                                                    onPress: () => deleteRoom(roomId),
                                                },
                                            ]
                                        );
                                    }}
                                    style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 14, gap: 12 }}
                                >
                                    <Ionicons name="trash-outline" size={20} color="#ef4444" />
                                    <Text style={{ color: "#ef4444", fontSize: 15, fontWeight: "600" }}>
                                        Xóa đoạn chat
                                    </Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </Pressable>
                </Pressable>
            </Modal>

            {/* Mute duration picker */}
            <Modal
                transparent
                animationType="fade"
                visible={showMuteDuration && !!actionRoom}
                onRequestClose={() => { setShowMuteDuration(false); setActionRoom(null); }}
            >
                <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center" }} onPress={() => { setShowMuteDuration(false); setActionRoom(null); }}>
                    <Pressable
                        style={{
                            backgroundColor: colors.card,
                            borderRadius: 20,
                            paddingTop: 20,
                            paddingBottom: 14,
                            width: "82%",
                            borderWidth: 1,
                            borderColor: colors.border,
                        }}
                        onPress={(e) => e.stopPropagation()}
                    >
                        <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700", paddingHorizontal: 20, marginBottom: 6 }}>
                            Tắt thông báo
                        </Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 13, paddingHorizontal: 20, marginBottom: 14 }}>
                            Bạn sẽ không nhận thông báo từ hội thoại này trong:
                        </Text>

                        {([
                            { id: "1h", label: "Trong 1 giờ" },
                            { id: "4h", label: "Trong 4 giờ" },
                            { id: "8am", label: "Cho đến 8:00 AM" },
                            { id: "forever", label: "Cho đến khi được mở lại" },
                        ] as const).map((opt) => (
                            <TouchableOpacity
                                key={opt.id}
                                onPress={() => setSelectedMuteDuration(opt.id)}
                                style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12, gap: 12 }}
                            >
                                <View style={{
                                    width: 20, height: 20, borderRadius: 10,
                                    borderWidth: 2,
                                    borderColor: selectedMuteDuration === opt.id ? colors.primary : colors.border,
                                    alignItems: "center", justifyContent: "center",
                                }}>
                                    {selectedMuteDuration === opt.id && (
                                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} />
                                    )}
                                </View>
                                <Text style={{ color: colors.text, fontSize: 14, fontWeight: "500" }}>{opt.label}</Text>
                            </TouchableOpacity>
                        ))}

                        <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12, paddingHorizontal: 20, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 6 }}>
                            <TouchableOpacity
                                onPress={() => { setShowMuteDuration(false); setActionRoom(null); }}
                                style={{ paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.border }}
                            >
                                <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>Hủy</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => {
                                    if (actionRoom) {
                                        if (!mutedRooms.has(String(actionRoom.id))) toggleMuteRoom(actionRoom.id);
                                    }
                                    setShowMuteDuration(false);
                                    setActionRoom(null);
                                }}
                                style={{ paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.primary }}
                            >
                                <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>Đồng ý</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
}

