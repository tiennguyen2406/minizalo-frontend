import React, { useState, useCallback, useRef, useEffect } from "react";
import { View, FlatList, ActivityIndicator, Text, RefreshControl, Animated, AppState } from "react-native";
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
import * as Notifications from "expo-notifications";
import { useAuthStore } from "@/shared/store/authStore";

export default function ChatListScreen() {
    const router = useRouter();
    const { rooms, setRooms, addMessage } = useChatStore();
    const colors = useThemeColors();
    const [refreshing, setRefreshing] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const subscribedRooms = useRef<Set<string>>(new Set());

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
                            roomId: r.id,
                            content: r.lastMessage.content,
                            type: (r.lastMessage.type as any) || 'TEXT',
                            createdAt: r.lastMessage.createdAt,
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

                        Notifications.scheduleNotificationAsync({
                            content: {
                                title: senderName,
                                body: bodyText,
                                data: { roomId: room.id, senderName: senderName },
                                sound: 'default',
                            },
                            trigger: null, // Show immediately
                        }).catch((err) => console.warn('Local notification error:', err));
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

            // Xóa currentRoomId khi ở màn hình danh sách (để store biết đang ở ngoài, tăng unreadCount bình thường)
            useChatStore.getState().setCurrentRoom(null);

            const interval = setInterval(() => {
                fetchChats(false);
            }, 10000);

            return () => clearInterval(interval);
        }, [])
    );

    const renderItem = ({ item, index }: { item: any; index: number }) => {
        const avatarUri = item.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name || "User")}&background=random&color=fff`;
        const lastMsg = item.lastMessage?.content
            ? (item.lastMessage.type === 'IMAGE' ? '[Hình ảnh]' : item.lastMessage.type === 'FILE' ? '[Tập tin]' : item.lastMessage.content)
            : "Chưa có tin nhắn";

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

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <ChatListHeader />
            {loading && rooms.length === 0 ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
                    <ActivityIndicator size="large" color="#0068FF" />
                    <Text style={{ color: '#7f8c8d', marginTop: 12, fontSize: 13 }}>Đang tải tin nhắn...</Text>
                </View>
            ) : error && rooms.length === 0 ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, paddingHorizontal: 32 }}>
                    <Ionicons name="cloud-offline-outline" size={48} color="#555" />
                    <Text style={{ color: '#e74c3c', marginTop: 12, fontSize: 15, fontWeight: '500' }}>Không thể tải danh sách tin nhắn</Text>
                    <Text style={{ color: '#7f8c8d', fontSize: 12, marginTop: 4 }}>{error}</Text>
                    <Text style={{ color: '#3498db', marginTop: 16, fontSize: 14, fontWeight: '500' }} onPress={onRefresh}>Thử lại</Text>
                </View>
            ) : rooms.length === 0 ? (
                <FlatList
                    contentContainerStyle={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor="#0068FF"
                            colors={['#0068FF']}
                        />
                    }
                    data={[]}
                    renderItem={null}
                    ListEmptyComponent={() => (
                        <View style={{ alignItems: 'center', paddingHorizontal: 32 }}>
                            <Ionicons name="chatbubbles-outline" size={56} color="#555" />
                            <Text style={{ color: '#7f8c8d', fontSize: 15, marginTop: 12 }}>Chưa có cuộc trò chuyện nào</Text>
                            <Text style={{ color: '#555', fontSize: 12, marginTop: 4 }}>Bắt đầu trò chuyện với bạn bè ngay!</Text>
                        </View>
                    )}
                />
            ) : (
                <FlatList
                    data={rooms}
                    keyExtractor={(item) => item.id}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor="#0068FF"
                            colors={['#0068FF']}
                        />
                    }
                    ListHeaderComponent={() => (
                        <View>
                            <PinnedCloudItem />
                        </View>
                    )}
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </View>
    );
}
