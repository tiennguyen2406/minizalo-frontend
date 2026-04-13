import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { View, FlatList, ActivityIndicator, Text, RefreshControl, Animated, AppState, TouchableOpacity } from "react-native";
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
    const { rooms, setRooms, addMessage } = useChatStore();
    const colors = useThemeColors();
    const currentUserId = useAuthStore((s) => s.user?.id);
    const friends = useFriendStore((s) => s.friends);
    const fetchFriends = useFriendStore((s) => s.fetchFriends);
    const [friendsListReady, setFriendsListReady] = useState(false);
    const [inboxTab, setInboxTab] = useState<"main" | "strangers">("main");
    const [refreshing, setRefreshing] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const subscribedRooms = useRef<Set<string>>(new Set());

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

    // Helper function to process image URLs (similar to ChatScreen)
    const getImageUrl = (url: string) => {
        if (!url) return url;
        
        // Xử lý localhost
        if (url.includes("localhost") && process.env.EXPO_PUBLIC_API_URL) {
            const match = process.env.EXPO_PUBLIC_API_URL.match(/https?:\/\/([^:\/]+)/);
            if (match && match[1]) {
                return url.replace("localhost", match[1]);
            }
        }
        
        // Xử lý IP address local network (192.168.x.x, 10.x.x.x, 172.x.x.x)
        if (process.env.EXPO_PUBLIC_API_URL) {
            const apiMatch = process.env.EXPO_PUBLIC_API_URL.match(/https?:\/\/([^:\/]+)/);
            if (apiMatch && apiMatch[1]) {
                const apiHost = apiMatch[1];
                
                // Thay thế IP address trong URL ảnh bằng API host
                if (url.match(/https?:\/\/(192\.168\.|10\.|172\.)/)) {
                    const urlMatch = url.match(/https?:\/\/([^:\/]+)/);
                    if (urlMatch && urlMatch[1] !== apiHost) {
                        return url.replace(urlMatch[1], apiHost);
                    }
                }
                
                // Thay thế port 9000 (MinIO default) với API port nếu cần
                if (url.includes(":9000") && !apiHost.includes(":9000")) {
                    // Giữ nguyên port 9000 vì đây là MinIO server
                    // Chỉ thay thế hostname
                    const urlMatch = url.match(/https?:\/\/([^:]+):/);
                    if (urlMatch && urlMatch[1] !== apiHost.split(':')[0]) {
                        return url.replace(urlMatch[1], apiHost.split(':')[0]);
                    }
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
                    const dynamo = JSON.parse(stompMsg.body);
                    const incoming = {
                        id: dynamo.messageId,
                        senderId: dynamo.senderId,
                        senderName: dynamo.senderName || undefined,
                        roomId: room.id,
                        content: dynamo.recalled ? '[Tin nhắn đã thu hồi]' : dynamo.content,
                        type: (dynamo.type as any) || 'TEXT',
                        createdAt: dynamo.createdAt,
                        readBy: dynamo.readBy,
                    };

                    // addMessage trong store sẽ tự động cập nhật tin nhắn cuối, thời gian, VÀ unreadCount!
                    useChatStore.getState().addMessage(room.id, incoming);

                    // ── Local notification khi có tin nhắn mới từ người khác ──
                    const currentRoomId = useChatStore.getState().currentRoomId;
                    const currentUserId = useAuthStore.getState().user?.id;
                    const isMyMessage = currentUserId && dynamo.senderId === currentUserId;
                    const isInThisRoom = currentRoomId === room.id;

                    if (!isMyMessage && !isInThisRoom && !dynamo.recalled) {
                        const senderName = dynamo.senderName || 'Tin nhắn mới';
                        let bodyText = dynamo.content || '';
                        if (dynamo.type === 'IMAGE') bodyText = '[Đã gửi hình ảnh]';
                        else if (dynamo.type === 'FILE') bodyText = '[Đã gửi tập tin]';

                        showLocalNotification(senderName, bodyText, { roomId: room.id, senderName: senderName });
                    }
                } catch (err) {
                    console.error('Lỗi parse tin nhắn WS:', err);
                }
            });
            subscribedRooms.current.add(room.id);
        });

        return () => {
            // Không dọn dẹp subscription khi navigate qua ChatScreen, chỉ dọn khi unmount hẳn App
            // WebChatLayout cũng giữ subscription
        };
    }, [rooms.length]);

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

        return (
            <Animated.View style={{ opacity: fadeAnim }}>
                <ChatItem
                    avatar={{ uri: avatarUri }}
                    name={item.name || "Người dùng"}
                    message={lastMsg}
                    time={timeDisplay}
                    unreadCount={item.unreadCount}
                    isVerified={false}
                    onPress={() => router.push(`/chat/${item.id}?name=${encodeURIComponent(item.name || "")}&type=${item.type || "DIRECT"}`)}
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
        </View>
    );
}
