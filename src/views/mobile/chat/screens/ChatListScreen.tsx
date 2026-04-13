import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { View, FlatList, ActivityIndicator, Text, RefreshControl, Animated, AppState, Alert, TouchableOpacity, Modal, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { ChatListHeader } from "../components/ChatListHeader";
import { PinnedCloudItem } from "../components/PinnedCloudItem";
import { ChatItem } from "../components/ChatItem";
import { chatService, ChatRoomResponse } from "@/shared/services/chatService";
import { formatTime } from "@/shared/utils/dateUtils";
import { Ionicons } from "@expo/vector-icons";
import { webSocketService } from "@/shared/services/WebSocketService";
import { useChatStore } from "@/shared/store/useChatStore";
import { useThemeColors } from "@/shared/theme/colors";
import { showLocalNotification } from "@/services/notificationService";
import { useAuthStore } from "@/shared/store/authStore";
import { useFriendStore } from "@/shared/store/friendStore";
import { splitRoomsMainAndStrangers } from "@/shared/utils/strangerChatRooms";

export default function ChatListScreen() {
    const router = useRouter();
    const { rooms, setRooms, addMessage, pinnedRooms, mutedRooms, togglePinRoom, toggleMuteRoom, clearConversation } = useChatStore();
    const colors = useThemeColors();
    const currentUserId = useAuthStore((s) => s.user?.id);
    const friends = useFriendStore((s) => s.friends);
    const fetchFriends = useFriendStore((s) => s.fetchFriends);
    const [friendsListReady, setFriendsListReady] = useState(false);
    const [inboxTab, setInboxTab] = useState<"main" | "strangers">("main");
    const [refreshing, setRefreshing] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const subscribedRooms = useRef<Set<string>>(new Set());
    const [actionRoom, setActionRoom] = useState<(typeof rooms)[number] | null>(null);

    const displayRooms = useMemo(() => {
        if (!currentUserId || !friendsListReady) {
            if (inboxTab === "strangers") return [];
            return rooms;
        }
        const { mainRooms, strangerRooms } = splitRoomsMainAndStrangers(
            rooms,
            currentUserId,
            friends,
        );
        return inboxTab === "strangers" ? strangerRooms : mainRooms;
    }, [rooms, currentUserId, friends, friendsListReady, inboxTab]);

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

            // Map sang ChatRoom interface của store (giống Web)
            const storeRooms = data.map((r) => {
                const existing = existingRooms.find(er => er.id === r.id);
                return {
                    id: r.id,
                    name: r.name || 'Người dùng',
                    avatarUrl: r.avatarUrl || undefined,
                    type: r.type === 'DIRECT' ? 'PRIVATE' as const : 'GROUP' as const,
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
                    unreadCount: Math.max(existing ? existing.unreadCount : 0, r.unreadCount || 0),
                    participants: (r.members || []).map((m: any) => ({
                        id: m.user?.id || m.id || '',
                        username: m.user?.username || m.username || '',
                        fullName: m.user?.displayName || m.user?.fullName || m.displayName || m.fullName || '',
                        avatarUrl: m.user?.avatarUrl || m.avatarUrl || undefined,
                    })),
                    updatedAt: r.lastMessage?.createdAt || r.createdAt || new Date().toISOString(),
                    hasInteracted: r.hasInteracted,
                };
            });

            storeRooms.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
            setRooms(storeRooms);

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

    // Subscribe to WebSocket for each chat room to get real-time updates & unread counts
    useEffect(() => {
        if (rooms.length === 0) return;

        // Activate WebSocket if not active
        webSocketService.activate();

        rooms.forEach((room) => {
            if (subscribedRooms.current.has(room.id)) return;

            const topic = `/topic/chat/${room.id}`;
            webSocketService.subscribe(topic, (stompMsg) => {
                try {
                    const msg = JSON.parse(stompMsg.body);
                    // Thêm tin nhắn mới vào store room
                    addMessage(room.id, {
                        id: msg.messageId,
                        senderId: msg.senderId,
                        senderName: msg.senderName,
                        roomId: room.id,
                        content: msg.content,
                        type: (msg.type as any) || 'TEXT',
                        createdAt: msg.createdAt,
                        recalled: msg.recalled || false,
                    });
                    
                    // Hiển thị thông báo local nếu tin nhắn từ người khác
                    if (msg.senderId !== useAuthStore.getState().user?.id) {
                        showLocalNotification(
                            msg.senderName || 'Tin nhắn mới',
                            msg.content || (msg.type === 'IMAGE' ? '[Hình ảnh]' : 'Đã gửi một tin nhắn')
                        );
                    }
                } catch (err) {
                    console.error('Lỗi parse tin nhắn WS:', err);
                }
            });
            subscribedRooms.current.add(room.id);
        });

        return () => {
            // Unsubscribe logic if needed
        };
    }, [rooms]);

    // Auto-fetch when screen is focused + poll every 10s as fallback
    useFocusEffect(
        useCallback(() => {
            fetchChats(true);
            void fetchFriends().finally(() => setFriendsListReady(true));

            // Xóa currentRoomId khi ở màn hình danh sách (để store biết đang ở ngoài, tăng unreadCount bình thường)
            useChatStore.getState().setCurrentRoom(null);

            const interval = setInterval(() => {
                fetchChats(false);
            }, 10000);

            return () => clearInterval(interval);
        }, [fetchFriends])
    );

    const renderItem = ({ item }: { item: (typeof rooms)[number] }) => {
        const processedAvatar = item.avatarUrl ? getImageUrl(item.avatarUrl) : "";
        const avatarUri = processedAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name || "User")}&background=random&color=fff`;
        // Xử lý hiển thị tin nhắn cuối
        let lastMsg = "Chưa có tin nhắn";
        if (item.lastMessage) {
            const lm = item.lastMessage;
            const recalled =
                lm.isRecall === true ||
                Boolean((lm as { recalled?: boolean }).recalled);
            if (recalled) {
                lastMsg = '[Tin nhắn đã thu hồi]';
            } else if (lm.content === '[Tin nhắn đã thu hồi]') {
                lastMsg = '[Tin nhắn đã thu hồi]';
            } else if (lm.type === 'IMAGE') {
                lastMsg = '[Hình ảnh]';
            } else if (lm.type === 'FILE') {
                lastMsg = '[Tập tin]';
            } else if (lm.type === 'VIDEO') {
                lastMsg = '[Video]';
            } else {
                lastMsg = lm.content || 'Chưa có tin nhắn';
            }
        }

        let timeDisplay = "";
        if (item.lastMessage?.createdAt) {
            timeDisplay = formatTime(item.lastMessage.createdAt);
        }

        const partner = item.type === 'PRIVATE' ? item.participants.find((p: any) => p.id !== currentUserId) : null;
        const isPartnerStranger = partner && !friendIdSet.has(partner.id);
        const isPinned = pinnedRooms.has(item.id);
        const isMuted = mutedRooms.has(item.id);

        return (
            <Animated.View style={{ opacity: fadeAnim }}>
                <Pressable
                    onLongPress={() => setActionRoom(item)}
                    delayLongPress={250}
                >
                    <ChatItem
                        avatar={{ uri: avatarUri }}
                        name={item.name || "Người dùng"}
                        message={lastMsg}
                        time={timeDisplay}
                        unreadCount={item.unreadCount}
                        isVerified={false}
                        onPress={() => router.push(`/chat/${item.id}?name=${encodeURIComponent(item.name || "")}&type=${item.type || "DIRECT"}&isStranger=${isPartnerStranger ? "true" : "false"}${partner?.id ? `&targetUserId=${partner.id}` : ""}`)}
                    />
                </Pressable>
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

            {/* Long-press actions like web (mute/pin/delete) */}
            <Modal
                transparent
                animationType="fade"
                visible={!!actionRoom}
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
                                    style={{ paddingHorizontal: 18, paddingVertical: 14 }}
                                >
                                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>
                                        {pinnedRooms.has(actionRoom.id) ? "Bỏ ghim hội thoại" : "Ghim hội thoại"}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => {
                                        toggleMuteRoom(actionRoom.id);
                                        setActionRoom(null);
                                    }}
                                    style={{ paddingHorizontal: 18, paddingVertical: 14 }}
                                >
                                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>
                                        {mutedRooms.has(actionRoom.id) ? "Bật thông báo" : "Tắt thông báo"}
                                    </Text>
                                </TouchableOpacity>

                                <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 6, marginHorizontal: 18 }} />

                                <TouchableOpacity
                                    onPress={() => {
                                        clearConversation(actionRoom.id);
                                        setActionRoom(null);
                                    }}
                                    style={{ paddingHorizontal: 18, paddingVertical: 14 }}
                                >
                                    <Text style={{ color: "#ef4444", fontSize: 15, fontWeight: "700" }}>Xóa hội thoại</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
}

