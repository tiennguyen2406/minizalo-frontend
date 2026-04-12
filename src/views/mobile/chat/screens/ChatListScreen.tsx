import React, { useState, useCallback, useRef, useEffect } from "react";
import { View, FlatList, ActivityIndicator, Text, RefreshControl, Animated, AppState, Alert, TouchableOpacity } from "react-native";
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

export default function ChatListScreen() {
    const router = useRouter();
    const { rooms, setRooms, addMessage } = useChatStore();
    const { friends } = useFriendStore();
    const colors = useThemeColors();
    const [refreshing, setRefreshing] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const subscribedRooms = useRef<Set<string>>(new Set());

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
            fetchChats(false);
            useFriendStore.getState().fetchFriends(); // Đảm bảo list friend mới nhất để phân loại stranger
            
            // Xóa currentRoomId khi ở màn hình danh sách (để store biết đang ở ngoài, tăng unreadCount bình thường)
            useChatStore.getState().setCurrentRoom(null);

            const interval = setInterval(() => {
                fetchChats(false);
            }, 10000);

            return () => clearInterval(interval);
        }, [])
    );

    // Fetch ngay khi user thay đổi (đăng nhập thành công)
    const user = useAuthStore(s => s.user);
    useEffect(() => {
        if (user) {
            fetchChats(true);
            useFriendStore.getState().fetchFriends();
        }
    }, [user]);
    
    // Khi danh sách bạn bè thay đổi (chấp nhận kết bạn), hãy fetch lại danh sách chat
    // để cập nhật phân loại (Stranger -> Friend)
    useEffect(() => {
        if (friends.length > 0) {
            fetchChats(false);
        }
    }, [friends.length]);

    // ─── Grouping rooms into Friend and Stranger ───
    const currentUserId = useAuthStore.getState().user?.id;
    const friendIdSet = new Set(
        friends.map(f => {
            if (!currentUserId) return f.friend.id;
            return f.user.id === currentUserId ? f.friend.id : f.user.id;
        })
    );

    const { friendRooms, strangerRooms } = rooms.reduce((acc, room) => {
        // Chat nhóm luôn ở Main list
        if (room.type === 'GROUP') {
            acc.friendRooms.push(room);
            return acc;
        }

        const otherParticipant = room.participants?.find((p: any) => p.id !== currentUserId);
        const otherUserId = otherParticipant?.id;
        const isFriend = otherUserId ? friendIdSet.has(otherUserId) : false;

        // Logic của USER: 
        // 1. Là bạn bè -> Main list
        // 2. Không là bạn bè nhưng ĐÃ TỪNG NHẮN TIN (WE sent at least one message) -> Main list
        // 3. Không là bạn bè và CHƯA TỪNG PHẢN HỒI (nhắn tin lần đầu) -> Stranger list
        const isStranger = !isFriend && !room.hasInteracted;

        if (isStranger) {
            acc.strangerRooms.push(room);
        } else {
            acc.friendRooms.push(room);
        }
        return acc;
    }, { friendRooms: [] as any[], strangerRooms: [] as any[] });

    // Aggregate stranger room data
    const totalStrangerUnread = strangerRooms.reduce((sum, r) => sum + (r.unreadCount || 0), 0);
    const lastStrangerRoom = strangerRooms.length > 0 ? strangerRooms[0] : null;

    const renderStrangerEntry = () => {
        if (strangerRooms.length === 0) return null;
        
        let lastMsg = "Chưa có tin nhắn";
        if (lastStrangerRoom?.lastMessage) {
            const lm = lastStrangerRoom.lastMessage;
            lastMsg = lm.content || (lm.type === 'IMAGE' ? '[Hình ảnh]' : '[Tin nhắn]');
        }

        return (
            <ChatItem
                avatarComponent={
                    <View style={{ 
                        width: 52, 
                        height: 52, 
                        borderRadius: 26, 
                        backgroundColor: '#0068FF',
                        justifyContent: 'center',
                        alignItems: 'center',
                        overflow: 'hidden'
                    }}>
                        <View style={{ position: 'relative' }}>
                            <Ionicons name="person" size={28} color="#fff" />
                            <View style={{ 
                                position: 'absolute', 
                                top: -2, 
                                right: -8,
                                backgroundColor: '#0068FF',
                                borderRadius: 10,
                                paddingHorizontal: 1
                            }}>
                                <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>?</Text>
                            </View>
                        </View>
                    </View>
                }
                name="Tin nhắn từ người lạ"
                message="Gửi từ những người chưa có trong danh bạ MiniZalo"
                time={lastStrangerRoom?.lastMessage?.createdAt ? formatTime(lastStrangerRoom.lastMessage.createdAt) : ""}
                unreadCount={totalStrangerUnread}
                isVerified={false}
                onPress={() => router.push("/chat/strangers")}
            />
        );
    };

    const renderItem = ({ item }: { item: any }) => {
        const processedAvatar = getImageUrl(item.avatarUrl);
        const avatarUri = processedAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name || "User")}&background=random&color=fff`;
        // Xử lý hiển thị tin nhắn cuối
        let lastMsg = "Chưa có tin nhắn";
        if (item.lastMessage) {
            const lm = item.lastMessage;
            if (lm.recalled) {
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

        return (
            <Animated.View style={{ opacity: fadeAnim }}>
                <ChatItem
                    avatar={{ uri: avatarUri }}
                    name={item.name || "Người dùng"}
                    message={lastMsg}
                    time={timeDisplay}
                    unreadCount={item.unreadCount}
                    isVerified={false}
                    onPress={() => router.push(`/chat/${item.id}?name=${encodeURIComponent(item.name || "")}&type=${item.type || "DIRECT"}&isStranger=${isPartnerStranger ? "true" : "false"}`)}
                />
            </Animated.View>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <ChatListHeader />
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
                    data={friendRooms}
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
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </View>
    );
}
