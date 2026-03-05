import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
    View,
    FlatList,
    Text,
    KeyboardAvoidingView,
    Platform,
    Animated,
    Dimensions,
    Modal,
    TouchableOpacity,
    Alert,
    Image,
} from "react-native";
import { useRoute } from "@react-navigation/native";
import { useRouter } from "expo-router";
import ChatHeader from "../components/ChatHeader";
import ChatFooter from "../components/ChatFooter";
import MessageBubble from "../components/MessageBubble";
import { chatService, MessageDynamo, MessageReaction } from "@/shared/services/chatService";
import { MessageService } from "@/shared/services/MessageService";
import { webSocketService } from "@/shared/services/WebSocketService";
import { useUserStore } from "@/shared/store/userStore";
import { formatTime } from "@/shared/utils/dateUtils";
import GroupInfoScreen from "../components/GroupInfoScreen";
import ChatOptionsScreen from "./ChatOptionsScreen";
import { useChatStore } from "@/shared/store/useChatStore";
import { useFriendStore } from "@/shared/store/friendStore";
import friendService from "@/shared/services/friendService";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";

const SCREEN_WIDTH = Dimensions.get("window").width;

export default function ChatScreen() {
    const route = useRoute<any>();
    const router = useRouter();
    const { id, name, type } = route.params || {};
    const roomId = typeof id === "string" ? id : "";
    const displayName = typeof name === "string" ? name : "Người dùng";
    // Chuẩn hóa: mọi loại không phải GROUP đều xem như chat 1-1 (DIRECT)
    const rawType = typeof type === "string" ? type : "DIRECT";
    const roomType = rawType === "GROUP" ? "GROUP" : "DIRECT";

    const [messages, setMessages] = useState<MessageDynamo[]>([]);
    const [sending, setSending] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const galleryRef = useRef<FlatList>(null);
    const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
    const [galleryCurrentIndex, setGalleryCurrentIndex] = useState(0);
    const [showGroupInfo, setShowGroupInfo] = useState(false);
    const [showChatOptions, setShowChatOptions] = useState(false);
    const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
    const slideOptionsAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;

    const [selectedMessage, setSelectedMessage] = useState<MessageDynamo | null>(null);
    const [showActionSheet, setShowActionSheet] = useState(false);
    const [showPinnedList, setShowPinnedList] = useState(false);
    const [reactionListMessage, setReactionListMessage] = useState<MessageDynamo | null>(null);
    const [replyTo, setReplyTo] = useState<{
        messageId: string;
        senderName?: string;
        content: string;
    } | null>(null);

    const openGroupInfo = () => {
        setShowGroupInfo(true);
        Animated.timing(slideAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
        }).start();
    };

    const closeGroupInfo = () => {
        Animated.timing(slideAnim, {
            toValue: SCREEN_WIDTH,
            duration: 250,
            useNativeDriver: true,
        }).start(() => setShowGroupInfo(false));
    };

    const openChatOptions = () => {
        setShowChatOptions(true);
        Animated.spring(slideOptionsAnim, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
        }).start();
    };

    const closeChatOptions = () => {
        Animated.timing(slideOptionsAnim, {
            toValue: SCREEN_WIDTH,
            duration: 250,
            useNativeDriver: true,
        }).start(() => setShowChatOptions(false));
    };

    const currentUserId = useUserStore((s) => s.profile?.id);
    const rooms = useChatStore((s) => s.rooms);
    const unblockUser = useFriendStore((s) => s.unblockUser);
    const blockedUsers = useFriendStore((s) => s.blockedUsers);

    const [blockStatus, setBlockStatus] = useState<{
        blockedByYou: boolean;
        blockedByOther: boolean;
        blockerName: string | null;
    } | null>(null);

    const partnerId = useMemo(() => {
        if (roomType !== "DIRECT" || !roomId) return null;
        const room = rooms.find((r) => r.id === roomId);
        const participants = room?.participants || [];
        const partner = participants.find((p: any) => p.id !== currentUserId);
        return partner?.id ?? null;
    }, [rooms, roomId, roomType, currentUserId]);

    // ─── Load chat history ───
    const fetchMessages = useCallback(async () => {
        if (!roomId) return;
        try {
            const result = await chatService.getChatHistory(roomId);
            console.log("📜 History result:", result?.messages?.length ?? 0, "messages");
            if (result?.messages && result.messages.length > 0) {
                // Keep newest-first order for inverted FlatList
                setMessages(result.messages);
            }
        } catch (err) {
            console.log("Error fetching messages:", err);
        } finally {
            setLoaded(true);
        }
    }, [roomId]);

    // ─── Check block status for DIRECT chats ───
    useEffect(() => {
        if (!roomId || roomType !== "DIRECT" || !partnerId) {
            setBlockStatus(null);
            return;
        }
        let cancelled = false;
        const load = async () => {
            try {
                const status = await friendService.checkBlockStatus(partnerId);
                if (!cancelled) {
                    setBlockStatus({
                        blockedByYou: !!status.blockedByYou,
                        blockedByOther: !!status.blockedByOther,
                        blockerName: status.blockerName ?? null,
                    });
                }
            } catch (err) {
                console.log("Failed to check block status:", err);
            }
        };
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        load();
        return () => {
            cancelled = true;
        };
    }, [roomId, roomType, partnerId]);

    // Re-check when global blockedUsers list changes (chặn/bỏ chặn từ nơi khác)
    useEffect(() => {
        if (!roomId || roomType !== "DIRECT" || !partnerId) return;
        let cancelled = false;
        const load = async () => {
            try {
                const status = await friendService.checkBlockStatus(partnerId);
                if (!cancelled) {
                    setBlockStatus({
                        blockedByYou: !!status.blockedByYou,
                        blockedByOther: !!status.blockedByOther,
                        blockerName: status.blockerName ?? null,
                    });
                }
            } catch (err) {
                console.log("Failed to re-check block status:", err);
            }
        };
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        load();
        return () => {
            cancelled = true;
        };
    }, [blockedUsers, roomId, roomType, partnerId]);

    // ─── Reset Unread Count via Store ───
    useEffect(() => {
        if (roomId) {
            useChatStore.getState().setCurrentRoom(roomId as string);
        }
        return () => {
            useChatStore.getState().setCurrentRoom(null);
        };
    }, [roomId]);

    // ─── WebSocket: subscribe to room for realtime ───
    useEffect(() => {
        if (!roomId) return;

        // Fetch history
        fetchMessages();

        // Activate WebSocket
        webSocketService.activate();

        // Subscribe to room topic (tin nhắn mới)
        const topic = `/topic/chat/${roomId}`;
        webSocketService.subscribe(topic, (stompMessage) => {
            try {
                const newMsg: MessageDynamo = JSON.parse(stompMessage.body);
                console.log("📨 WS message received:", newMsg.messageId);

                setMessages((prev) => {
                    // Don't add duplicates
                    if (prev.some((m) => m.messageId === newMsg.messageId)) {
                        return prev;
                    }
                    // Remove optimistic temp messages, add new msg at beginning (newest-first)
                    const filtered = prev.filter(
                        (m) => !m.messageId.startsWith("temp-")
                    );
                    return [newMsg, ...filtered];
                });

                setTimeout(() => {
                    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
                }, 150);
            } catch (err) {
                console.log("Error parsing WS message:", err);
            }
        });

        // Subscribe recall events
        const recallTopic = `/topic/chat/${roomId}/recall`;
        webSocketService.subscribe(recallTopic, (stompMessage) => {
            try {
                const payload = JSON.parse(stompMessage.body) as {
                    messageId?: string;
                    recalledAt?: string;
                };
                if (!payload?.messageId) return;
                setMessages((prev) =>
                    prev.map((m) =>
                        m.messageId === payload.messageId
                            ? {
                                ...m,
                                recalled: true,
                                recalledAt: payload.recalledAt || new Date().toISOString(),
                            }
                            : m
                    )
                );
            } catch (err) {
                console.log("Error parsing recall WS message:", err);
            }
        });

        // Subscribe reaction events
        const reactionTopic = `/topic/chat/${roomId}/reaction`;
        webSocketService.subscribe(reactionTopic, (stompMessage) => {
            try {
                const payload = JSON.parse(stompMessage.body) as {
                    messageId?: string;
                    userId?: string;
                    emoji?: string | null;
                    action?: "add" | "remove" | "removeAll";
                };
                if (!payload?.messageId || !payload.userId) return;
                const action = payload.action ?? (payload.emoji ? "add" : "removeAll");
                setMessages((prev) =>
                    prev.map((m) => {
                        if (m.messageId !== payload.messageId) return m;
                        const reactions = Array.isArray(m.reactions) ? [...m.reactions] : [];
                        if (action === "removeAll") {
                            const next = reactions.filter((r) => r.userId !== payload.userId);
                            return { ...m, reactions: next };
                        }
                        if (action === "remove" && payload.emoji) {
                            const next = reactions.filter(
                                (r) => !(r.userId === payload.userId && r.emoji === payload.emoji)
                            );
                            return { ...m, reactions: next };
                        }
                        if (action === "add" && payload.emoji) {
                            return {
                                ...m,
                                reactions: [...reactions, { userId: payload.userId!, emoji: payload.emoji } as MessageReaction],
                            };
                        }
                        return m;
                    })
                );
            } catch (err) {
                console.log("Error parsing reaction WS message:", err);
            }
        });

        // Subscribe pin events
        const pinTopic = `/topic/chat/${roomId}/pin`;
        webSocketService.subscribe(pinTopic, (stompMessage) => {
            try {
                const payload = JSON.parse(stompMessage.body) as {
                    messageId?: string;
                    isPinned?: boolean;
                };
                if (!payload?.messageId) return;
                setMessages((prev) =>
                    prev.map((m) =>
                        m.messageId === payload.messageId
                            ? { ...m, pinned: !!payload.isPinned }
                            : m
                    )
                );
            } catch (err) {
                console.log("Error parsing pin WS message:", err);
            }
        });

        return () => {
            webSocketService.unsubscribe(topic);
            webSocketService.unsubscribe(recallTopic);
            webSocketService.unsubscribe(reactionTopic);
            webSocketService.unsubscribe(pinTopic);
        };
    }, [roomId, fetchMessages]);

    // ─── Send message ───
    const handleSend = async (content: string) => {
        if (!roomId || sending || !content.trim()) return;
        if (
            roomType === "DIRECT" &&
            blockStatus &&
            (blockStatus.blockedByYou || blockStatus.blockedByOther)
        ) {
            Alert.alert(
                "Không thể gửi tin nhắn",
                blockStatus.blockedByYou
                    ? "Bạn đang chặn tin nhắn với người này. Hãy bỏ chặn để tiếp tục nhắn tin."
                    : "Bạn đã bị chặn tin nhắn trong cuộc trò chuyện này."
            );
            return;
        }
        setSending(true);

        // Optimistic UI
        const optimisticMsg: MessageDynamo = {
            messageId: `temp-${Date.now()}`,
            chatRoomId: roomId,
            senderId: currentUserId || "",
            senderName: "Tôi",
            content,
            attachments: [],
            type: "TEXT",
            createdAt: new Date().toISOString(),
            replyToMessageId: replyTo?.messageId ?? "",
            read: false,
            readBy: [],
            reactions: [],
            recalled: false,
            recalledAt: "",
            pinned: false,
        };

        setMessages((prev) => [optimisticMsg, ...prev]);
        setTimeout(() => {
            flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        }, 100);

        try {
            // Gửi qua WebSocket trước; nếu không được thì fallback sang REST
            const sentViaWs = webSocketService.sendChatMessage(
                roomId,
                content,
                "TEXT",
                replyTo?.messageId
            );
            if (!sentViaWs) {
                console.log("WS not connected, falling back to REST");
                await chatService.sendMessage(roomId, content, replyTo?.messageId);
                await fetchMessages();
            }
        } catch (err) {
            console.log("Error sending message:", err);
        } finally {
            setSending(false);
            setReplyTo(null);
        }
    };

    // ─── Send image(s) ───
    const handleSendImage = async (assets: ImagePicker.ImagePickerAsset[]) => {
        if (!roomId || sending || assets.length === 0) return;
        setSending(true);

        // Optimistic UI with local images
        const tempId = `temp-img-${Date.now()}`;
        const optimisticMsg: MessageDynamo = {
            messageId: tempId,
            chatRoomId: roomId,
            senderId: currentUserId || "",
            senderName: "Tôi",
            content: "",
            attachments: assets.map((a, i) => ({
                id: "",
                url: a.uri,
                type: "IMAGE",
                name: a.fileName || `image_${i}.jpg`,
                size: a.fileSize || 0,
            })),
            type: "IMAGE",
            createdAt: new Date().toISOString(),
            replyToMessageId: "",
            read: false,
            readBy: [],
            reactions: [],
            recalled: false,
            recalledAt: "",
            pinned: false,
        };
        setMessages((prev) => [optimisticMsg, ...prev]);
        setTimeout(() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true }), 100);

        try {
            const token = (await import("@/shared/store/authStore")).useAuthStore.getState().accessToken;
            const rawBase = process.env?.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8080/api";
            const apiBase = rawBase.endsWith("/api") ? rawBase : `${rawBase}/api`;

            // Upload all images in parallel
            const uploadPromises = assets.map(async (asset, i) => {
                const uri = asset.uri;
                const filename = asset.fileName || `photo_${Date.now()}_${i}.jpg`;
                const type = asset.mimeType || "image/jpeg";

                const formData = new FormData();
                formData.append("file", { uri, name: filename, type } as any);

                const uploadRes = await fetch(`${apiBase}/files/upload`, {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${token}` },
                    body: formData,
                });

                if (!uploadRes.ok) throw new Error(`Upload failed for image ${i}`);
                const uploadData = await uploadRes.json();

                return {
                    url: uploadData.fileUrl,
                    type: uploadData.fileType || "image/jpeg",
                    filename: uploadData.fileName || filename,
                    size: uploadData.size || asset.fileSize || 0,
                };
            });

            const uploadedAttachments = await Promise.all(uploadPromises);

            // Send message with all attachments via WebSocket
            const sentViaWs = webSocketService.sendChatMessage(
                roomId,
                "",
                "IMAGE",
                undefined,
                uploadedAttachments
            );
            if (!sentViaWs) {
                console.log("WS not connected for image, fallback needed");
                await fetchMessages();
            }
        } catch (err) {
            console.log("Error sending image:", err);
            Alert.alert("Lỗi", "Gửi ảnh thất bại, vui lòng thử lại.");
            setMessages((prev) => prev.filter((m) => m.messageId !== tempId));
        } finally {
            setSending(false);
        }
    };

    // ─── Send file ───
    const handleSendFile = async (file: DocumentPicker.DocumentPickerAsset) => {
        if (!roomId || sending) return;
        setSending(true);

        const tempId = `temp-file-${Date.now()}`;
        const optimisticMsg: MessageDynamo = {
            messageId: tempId,
            chatRoomId: roomId,
            senderId: currentUserId || "",
            senderName: "Tôi",
            content: "",
            attachments: [{
                id: "",
                url: file.uri,
                type: file.mimeType || "application/octet-stream",
                name: file.name || "file",
                size: file.size || 0,
            }],
            type: "FILE",
            createdAt: new Date().toISOString(),
            replyToMessageId: "",
            read: false,
            readBy: [],
            reactions: [],
            recalled: false,
            recalledAt: "",
            pinned: false,
        };
        setMessages((prev) => [optimisticMsg, ...prev]);
        setTimeout(() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true }), 100);

        try {
            const uri = file.uri;
            const filename = file.name || `file_${Date.now()}`;
            const type = file.mimeType || "application/octet-stream";

            const formData = new FormData();
            formData.append("file", { uri, name: filename, type } as any);

            const token = (await import("@/shared/store/authStore")).useAuthStore.getState().accessToken;
            const rawBase = process.env?.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8080/api";
            const apiBase = rawBase.endsWith("/api") ? rawBase : `${rawBase}/api`;

            const uploadRes = await fetch(`${apiBase}/files/upload`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                },
                body: formData,
            });

            if (!uploadRes.ok) throw new Error("Upload failed");
            const uploadData = await uploadRes.json();

            const attachment = {
                url: uploadData.fileUrl,
                type: uploadData.fileType || type,
                filename: uploadData.fileName || filename,
                size: uploadData.size || file.size || 0,
            };

            const sentViaWs = webSocketService.sendChatMessage(
                roomId,
                "",
                "FILE",
                undefined,
                [attachment]
            );
            if (!sentViaWs) {
                console.log("WS not connected for file, fallback needed");
                await fetchMessages();
            }
        } catch (err) {
            console.log("Error sending file:", err);
            Alert.alert("Lỗi", "Gửi file thất bại, vui lòng thử lại.");
            setMessages((prev) => prev.filter((m) => m.messageId !== tempId));
        } finally {
            setSending(false);
        }
    };

    const handleMessagePress = (message: MessageDynamo) => {
        // Sẽ dùng cho reply / xem chi tiết sau
        console.log("Pressed message:", message.messageId);
    };

    const handleMessageLongPress = (message: MessageDynamo) => {
        setSelectedMessage(message);
        setShowActionSheet(true);
    };

    const closeActionSheet = () => {
        setShowActionSheet(false);
        setSelectedMessage(null);
    };

    const handleRecall = () => {
        if (!selectedMessage || !roomId) return;
        if (selectedMessage.senderId !== currentUserId) {
            // Không cho thu hồi tin nhắn không phải của mình
            return;
        }

        Alert.alert(
            "Thu hồi tin nhắn",
            "Bạn có chắc muốn thu hồi tin nhắn này?",
            [
                { text: "Hủy", style: "cancel" },
                {
                    text: "Thu hồi",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await MessageService.recallMessage(roomId, selectedMessage.messageId);
                            setMessages((prev) =>
                                prev.map((m) =>
                                    m.messageId === selectedMessage.messageId
                                        ? {
                                            ...m,
                                            recalled: true,
                                            recalledAt: new Date().toISOString(),
                                        }
                                        : m
                                )
                            );
                        } catch (err: any) {
                            console.log("Error recalling message:", err);
                            const status = err?.response?.status;
                            if (status === 400) {
                                Alert.alert(
                                    "Không thể thu hồi",
                                    "Tin nhắn đã gửi quá 5 phút nên không thể thu hồi nữa."
                                );
                            } else {
                                Alert.alert(
                                    "Lỗi",
                                    "Không thu hồi được tin nhắn. Vui lòng thử lại."
                                );
                            }
                        } finally {
                            closeActionSheet();
                        }
                    },
                },
            ]
        );
    };

    const handleStartReply = () => {
        if (!selectedMessage) return;
        setReplyTo({
            messageId: selectedMessage.messageId,
            senderName: selectedMessage.senderName,
            content: selectedMessage.content || "[Tin nhắn]",
        });
        setShowActionSheet(false);
    };

    const handleTogglePin = () => {
        if (!selectedMessage || !roomId) return;
        const nextPin = !selectedMessage.pinned;
        webSocketService.sendPin({
            roomId,
            messageId: selectedMessage.messageId,
            pin: nextPin,
        });
        closeActionSheet();
    };

    // Map userId -> tên hiển thị (từ tin nhắn trong phòng hoặc "Tôi")
    const reactionUserNameMap = useMemo(() => {
        const map: Record<string, string> = {};
        if (currentUserId) map[currentUserId] = "Tôi";
        messages.forEach((m) => {
            if (m.senderId && m.senderName) map[m.senderId] = m.senderName;
        });
        return map;
    }, [messages, currentUserId]);

    // Collect all image URLs across all messages for the gallery
    const getImageUrl = (url: string) => {
        if (!url) return url;
        if (url.includes("localhost") && process.env.EXPO_PUBLIC_API_URL) {
            const match = process.env.EXPO_PUBLIC_API_URL.match(/https?:\/\/([^:\/]+)/);
            if (match && match[1]) {
                return url.replace("localhost", match[1]);
            }
        }
        return url;
    };

    const allImages = useMemo(() => {
        const imgs: string[] = [];
        // messages are newest-first (inverted), reverse to get chronological
        const chronological = [...messages].reverse();
        chronological.forEach((m) => {
            if (m.recalled) return;
            (m.attachments || []).forEach((a) => {
                if (a.type?.startsWith("image") || a.type === "IMAGE") {
                    imgs.push(getImageUrl(a.url));
                }
            });
        });
        return imgs;
    }, [messages]);

    const handleGalleryOpen = useCallback((imageUrl: string) => {
        const idx = allImages.indexOf(imageUrl);
        const safeIdx = idx >= 0 ? idx : 0;
        setGalleryIndex(safeIdx);
        setGalleryCurrentIndex(safeIdx);
    }, [allImages]);

    // ─── Render ───
    const renderMessage = ({ item }: { item: MessageDynamo }) => {
        const isMe = item.senderId === currentUserId;
        let timeDisplay = "";
        if (item.createdAt) {
            timeDisplay = formatTime(item.createdAt);
        }
        const replySource =
            item.replyToMessageId &&
            messages.find((m) => m.messageId === item.replyToMessageId);

        return (
            <MessageBubble
                message={item}
                isMe={isMe}
                showSenderName={roomType === "GROUP"}
                onPress={handleMessagePress}
                onLongPress={handleMessageLongPress}
                onPressReactions={(msg) => setReactionListMessage(msg)}
                onImagePress={handleGalleryOpen}
                replyPreview={
                    replySource
                        ? {
                            senderName: replySource.senderName,
                            content: replySource.content || "[Tin nhắn]",
                        }
                        : null
                }
            />
        );
    };

    return (
        <View className="flex-1 bg-[#0e0e0e]">
            <ChatHeader
                name={displayName}
                roomType={roomType}
                onMenuPress={() => {
                    if (roomType === "GROUP") {
                        openGroupInfo();
                    } else {
                        openChatOptions();
                    }
                }}
            />

            {/* Group Info - Slide from right */}
            {showGroupInfo && (
                <Animated.View
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 100,
                        transform: [{ translateX: slideAnim }],
                    }}
                >
                    <GroupInfoScreen
                        roomId={roomId}
                        onClose={closeGroupInfo}
                    />
                </Animated.View>
            )}

            {/* Chat Options (Personal) - Slide from right */}
            {showChatOptions && (
                <Animated.View
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 100,
                        transform: [{ translateX: slideOptionsAnim }],
                    }}
                >
                    <ChatOptionsScreen
                        roomId={roomId}
                        name={displayName}
                        avatarUrl={useChatStore.getState().rooms.find(r => r.id === roomId)?.avatarUrl || undefined}
                        partnerId={partnerId ?? undefined}
                        onClose={closeChatOptions}
                    />
                </Animated.View>
            )}

            {/* Header pinned messages */}
            {messages.some((m) => m.pinned) && (
                (() => {
                    const pinned = messages.filter((m) => m.pinned);
                    const latest = pinned[pinned.length - 1];
                    if (!latest) return null;
                    return (
                        <View
                            style={{
                                paddingHorizontal: 12,
                                paddingTop: 4,
                            }}
                        >
                            <TouchableOpacity
                                activeOpacity={0.8}
                                style={{
                                    backgroundColor: "#111827",
                                    borderRadius: 10,
                                    paddingHorizontal: 12,
                                    paddingVertical: 8,
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                }}
                                onPress={() => {
                                    // Mở danh sách tin nhắn đã ghim dạng overlay (Modal)
                                    setShowPinnedList(true);
                                }}
                            >
                                <View
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        flex: 1,
                                    }}
                                >
                                    <Text style={{ color: "#facc15", marginRight: 6 }}>📌</Text>
                                    <Text
                                        numberOfLines={1}
                                        style={{
                                            color: "#e5e7eb",
                                            fontSize: 12,
                                            flex: 1,
                                        }}
                                    >
                                        {latest.content || "[Tin nhắn đã ghim]"}
                                    </Text>
                                </View>

                                {/* Số lượng + icon mở rộng danh sách */}
                                <View
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        marginLeft: 8,
                                    }}
                                >
                                    {pinned.length > 1 && (
                                        <Text
                                            style={{
                                                color: "#9ca3af",
                                                fontSize: 11,
                                                marginRight: 6,
                                            }}
                                        >
                                            +{pinned.length - 1}
                                        </Text>
                                    )}
                                    <Text style={{ color: "#9ca3af", fontSize: 14 }}>▾</Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    );
                })()
            )}

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
                className="flex-1"
            >
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    inverted
                    keyExtractor={(item) => item.messageId}
                    renderItem={renderMessage}
                    contentContainerStyle={{ paddingVertical: 8, flexGrow: 1 }}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={() => (
                        <View className="flex-1 justify-center items-center" style={{ transform: [{ scaleY: -1 }] }}>
                            <Text className="text-gray-500">
                                {loaded ? "Hãy gửi tin nhắn đầu tiên! 👋" : "Đang tải tin nhắn..."}
                            </Text>
                        </View>
                    )}
                />
                {roomType === "DIRECT" &&
                    blockStatus &&
                    (blockStatus.blockedByYou || blockStatus.blockedByOther) ? (
                    <View
                        style={{
                            paddingHorizontal: 16,
                            paddingVertical: 16,
                            borderTopWidth: 0.5,
                            borderTopColor: "#1f2933",
                            backgroundColor: "#111827",
                            alignItems: "center",
                        }}
                    >
                        <Text
                            style={{
                                color: "#e5e7eb",
                                fontSize: 13,
                                marginBottom: blockStatus.blockedByYou ? 10 : 0,
                                textAlign: "center",
                            }}
                        >
                            {blockStatus.blockedByYou
                                ? "Bạn đã chặn tin nhắn"
                                : "Bạn đã bị chặn tin nhắn"}
                        </Text>
                        {blockStatus.blockedByYou && partnerId && (
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={async () => {
                                    try {
                                        await unblockUser(partnerId);
                                        setBlockStatus({
                                            blockedByYou: false,
                                            blockedByOther: false,
                                            blockerName: null,
                                        });
                                    } catch {
                                        Alert.alert(
                                            "Lỗi",
                                            "Không bỏ chặn được người này. Vui lòng thử lại."
                                        );
                                    }
                                }}
                                style={{
                                    marginTop: 8,
                                    alignSelf: "center",
                                    paddingHorizontal: 16,
                                    paddingVertical: 8,
                                    borderRadius: 999,
                                    backgroundColor: "#2563eb",
                                }}
                            >
                                <Text
                                    style={{
                                        color: "#ffffff",
                                        fontSize: 14,
                                        fontWeight: "600",
                                    }}
                                >
                                    Bỏ chặn
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ) : (
                    <ChatFooter
                        onSend={handleSend}
                        onSendImage={handleSendImage}
                        onSendFile={handleSendFile}
                        replyTo={replyTo}
                        onCancelReply={() => setReplyTo(null)}
                    />
                )}
            </KeyboardAvoidingView>

            {/* Action sheet khi nhấn giữ tin nhắn */}
            <Modal
                transparent
                animationType="fade"
                visible={showActionSheet && !!selectedMessage}
                onRequestClose={closeActionSheet}
            >
                <TouchableOpacity
                    activeOpacity={1}
                    style={{
                        flex: 1,
                        backgroundColor: "rgba(0,0,0,0.4)",
                        justifyContent: "flex-end",
                    }}
                    onPress={closeActionSheet}
                >
                    <View
                        style={{
                            backgroundColor: "#1f2933",
                            paddingBottom: 24,
                            paddingTop: 8,
                            borderTopLeftRadius: 16,
                            borderTopRightRadius: 16,
                        }}
                    >
                        <View
                            style={{
                                alignSelf: "center",
                                width: 40,
                                height: 4,
                                borderRadius: 999,
                                backgroundColor: "#4b5563",
                                marginBottom: 12,
                            }}
                        />

                        {/* Hàng reaction giống Zalo */}
                        {selectedMessage && !selectedMessage.recalled && (
                            <View
                                style={{
                                    flexDirection: "row",
                                    justifyContent: "space-around",
                                    marginBottom: 16,
                                    paddingHorizontal: 24,
                                }}
                            >
                                {["❤️", "👍", "😂", "😮", "😢", "😡"].map((emoji) => (
                                    <TouchableOpacity
                                        key={emoji}
                                        onPress={async () => {
                                            if (!selectedMessage || !roomId || !currentUserId) return;
                                            try {
                                                await MessageService.setReaction(
                                                    roomId,
                                                    selectedMessage.messageId,
                                                    emoji
                                                );
                                            } catch (err) {
                                                console.log("Error sending reaction:", err);
                                            } finally {
                                                closeActionSheet();
                                            }
                                        }}
                                        style={{
                                            width: 44,
                                            height: 44,
                                            borderRadius: 22,
                                            backgroundColor: "#111827",
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}
                                    >
                                        <Text style={{ fontSize: 24 }}>{emoji}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        {selectedMessage?.senderId === currentUserId && !selectedMessage.recalled && (
                            <TouchableOpacity
                                onPress={handleRecall}
                                style={{
                                    paddingVertical: 12,
                                    paddingHorizontal: 20,
                                }}
                            >
                                <Text style={{ color: "#f97373", fontSize: 16, fontWeight: "600" }}>
                                    Thu hồi tin nhắn
                                </Text>
                            </TouchableOpacity>
                        )}

                        {selectedMessage && !selectedMessage.recalled && (
                            <TouchableOpacity
                                onPress={handleStartReply}
                                style={{
                                    paddingVertical: 12,
                                    paddingHorizontal: 20,
                                }}
                            >
                                <Text style={{ color: "#e5e7eb", fontSize: 16 }}>
                                    Trả lời
                                </Text>
                            </TouchableOpacity>
                        )}

                        {selectedMessage && (
                            <TouchableOpacity
                                onPress={handleTogglePin}
                                style={{
                                    paddingVertical: 12,
                                    paddingHorizontal: 20,
                                }}
                            >
                                <Text style={{ color: "#e5e7eb", fontSize: 16 }}>
                                    {selectedMessage.pinned ? "Bỏ ghim" : "Ghim"}
                                </Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            onPress={closeActionSheet}
                            style={{
                                paddingVertical: 12,
                                paddingHorizontal: 20,
                            }}
                        >
                            <Text style={{ color: "#e5e7eb", fontSize: 16 }}>Đóng</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Danh sách tin nhắn đã ghim - overlay dạng bottom sheet */}
            <Modal
                transparent
                animationType="slide"
                visible={showPinnedList}
                onRequestClose={() => setShowPinnedList(false)}
            >
                <TouchableOpacity
                    activeOpacity={1}
                    style={{
                        flex: 1,
                        backgroundColor: "rgba(0,0,0,0.4)",
                        justifyContent: "flex-end",
                    }}
                    onPress={() => setShowPinnedList(false)}
                >
                    <View
                        style={{
                            backgroundColor: "#111827",
                            paddingTop: 12,
                            paddingBottom: 24,
                            borderTopLeftRadius: 16,
                            borderTopRightRadius: 16,
                            maxHeight: "60%",
                        }}
                    >
                        <Text
                            style={{
                                color: "#e5e7eb",
                                fontSize: 16,
                                fontWeight: "600",
                                textAlign: "center",
                                marginBottom: 8,
                            }}
                        >
                            Tin nhắn đã ghim
                        </Text>

                        <View
                            style={{
                                maxHeight: "100%",
                            }}
                        >
                            {messages.filter((m) => m.pinned).length === 0 ? (
                                <Text
                                    style={{
                                        color: "#9ca3af",
                                        textAlign: "center",
                                        paddingVertical: 12,
                                    }}
                                >
                                    Chưa có tin nhắn nào được ghim.
                                </Text>
                            ) : (
                                messages
                                    .filter((m) => m.pinned)
                                    .map((m) => (
                                        <View
                                            key={m.messageId}
                                            style={{
                                                flexDirection: "row",
                                                alignItems: "center",
                                                paddingVertical: 10,
                                                paddingHorizontal: 16,
                                                borderBottomWidth: 0.5,
                                                borderBottomColor: "#374151",
                                            }}
                                        >
                                            <TouchableOpacity
                                                style={{ flex: 1 }}
                                                onPress={() => {
                                                    const index = messages.findIndex(
                                                        (x) => x.messageId === m.messageId
                                                    );
                                                    if (index >= 0) {
                                                        flatListRef.current?.scrollToIndex({
                                                            index,
                                                            animated: true,
                                                        });
                                                    }
                                                    setShowPinnedList(false);
                                                }}
                                            >
                                                <Text
                                                    style={{
                                                        color: "#e5e7eb",
                                                        fontSize: 14,
                                                        marginBottom: 4,
                                                    }}
                                                    numberOfLines={2}
                                                >
                                                    {m.content || "[Tin nhắn]"}
                                                </Text>
                                                <Text
                                                    style={{
                                                        color: "#9ca3af",
                                                        fontSize: 12,
                                                    }}
                                                >
                                                    {formatTime(m.createdAt)}
                                                </Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={(e) => {
                                                    e?.stopPropagation?.();
                                                    if (!roomId) return;
                                                    webSocketService.sendPin({
                                                        roomId,
                                                        messageId: m.messageId,
                                                        pin: false,
                                                    });
                                                }}
                                                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                                                style={{
                                                    padding: 8,
                                                    marginLeft: 8,
                                                }}
                                            >
                                                <Text style={{ color: "#9ca3af", fontSize: 18 }}>×</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ))
                            )}
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Danh sách reaction – bấm vào dải reaction dưới tin nhắn */}
            <Modal
                transparent
                animationType="slide"
                visible={!!reactionListMessage}
                onRequestClose={() => setReactionListMessage(null)}
            >
                <TouchableOpacity
                    activeOpacity={1}
                    style={{
                        flex: 1,
                        backgroundColor: "rgba(0,0,0,0.4)",
                        justifyContent: "flex-end",
                    }}
                    onPress={() => setReactionListMessage(null)}
                >
                    <TouchableOpacity
                        activeOpacity={1}
                        onPress={() => { }}
                        style={{
                            backgroundColor: "#111827",
                            paddingTop: 12,
                            paddingBottom: 24,
                            borderTopLeftRadius: 16,
                            borderTopRightRadius: 16,
                            maxHeight: "60%",
                        }}
                    >
                        {reactionListMessage && (() => {
                            const raw = reactionListMessage.reactions;
                            const reactions = Array.isArray(raw) ? raw : [];
                            const total = reactions.length;
                            const byEmoji = reactions.reduce<Record<string, number>>((acc, r) => {
                                if (!r?.emoji) return acc;
                                acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                                return acc;
                            }, {});
                            const byUser = reactions.reduce<Record<string, string[]>>((acc, r) => {
                                if (!r?.userId || !r?.emoji) return acc;
                                if (!Array.isArray(acc[r.userId])) acc[r.userId] = [];
                                if (!acc[r.userId].includes(r.emoji)) acc[r.userId].push(r.emoji);
                                return acc;
                            }, {});
                            const userIds = Object.keys(byUser);
                            return (
                                <>
                                    <View
                                        style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            paddingHorizontal: 16,
                                            marginBottom: 12,
                                        }}
                                    >
                                        <Text
                                            style={{
                                                color: "#e5e7eb",
                                                fontSize: 16,
                                                fontWeight: "600",
                                            }}
                                        >
                                            Tất cả {total}
                                        </Text>
                                        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                                            {Object.entries(byEmoji).map(([emoji, count]) => (
                                                <Text
                                                    key={emoji}
                                                    style={{ color: "#e5e7eb", fontSize: 14, marginLeft: 12 }}
                                                >
                                                    {emoji} {count}
                                                </Text>
                                            ))}
                                        </View>
                                    </View>
                                    <View style={{ maxHeight: "100%" }}>
                                        {userIds.map((uid) => (
                                            <View
                                                key={uid}
                                                style={{
                                                    flexDirection: "row",
                                                    alignItems: "center",
                                                    paddingHorizontal: 16,
                                                    paddingVertical: 10,
                                                    borderBottomWidth: 0.5,
                                                    borderBottomColor: "#374151",
                                                }}
                                            >
                                                <View
                                                    style={{
                                                        width: 36,
                                                        height: 36,
                                                        borderRadius: 18,
                                                        backgroundColor: "#374151",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        marginRight: 10,
                                                    }}
                                                >
                                                    <Text style={{ color: "#e5e7eb", fontSize: 14 }}>
                                                        {(reactionUserNameMap[uid] || uid).charAt(0)}
                                                    </Text>
                                                </View>
                                                <Text
                                                    style={{
                                                        flex: 1,
                                                        color: "#e5e7eb",
                                                        fontSize: 14,
                                                    }}
                                                    numberOfLines={1}
                                                >
                                                    {reactionUserNameMap[uid] || "Người dùng"}
                                                </Text>
                                                <View style={{ flexDirection: "row" }}>
                                                    {(Array.isArray(byUser[uid]) ? byUser[uid] : []).map((emoji) => (
                                                        <Text key={emoji} style={{ fontSize: 16, marginLeft: 4 }}>
                                                            {emoji}
                                                        </Text>
                                                    ))}
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                </>
                            );
                        })()}
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            {/* ─── Chat-wide swipeable image gallery ─── */}
            <Modal
                visible={galleryIndex !== null}
                transparent
                animationType="fade"
                onRequestClose={() => setGalleryIndex(null)}
            >
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.95)" }}>
                    <TouchableOpacity
                        onPress={() => setGalleryIndex(null)}
                        style={{ position: "absolute", top: 50, right: 20, zIndex: 10, padding: 8 }}
                    >
                        <Ionicons name="close" size={28} color="#fff" />
                    </TouchableOpacity>

                    {allImages.length > 1 && (
                        <View style={{ position: "absolute", top: 54, left: 0, right: 0, zIndex: 10, alignItems: "center" }}>
                            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
                                {galleryCurrentIndex + 1} / {allImages.length}
                            </Text>
                        </View>
                    )}

                    <FlatList
                        ref={galleryRef}
                        data={allImages}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        keyExtractor={(_, i) => `chat-gallery-${i}`}
                        initialScrollIndex={galleryIndex ?? 0}
                        getItemLayout={(_, index) => ({
                            length: SCREEN_WIDTH,
                            offset: SCREEN_WIDTH * index,
                            index,
                        })}
                        onMomentumScrollEnd={(e) => {
                            const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                            setGalleryCurrentIndex(idx);
                        }}
                        renderItem={({ item: url }) => (
                            <View style={{
                                width: SCREEN_WIDTH,
                                flex: 1,
                                justifyContent: "center",
                                alignItems: "center",
                            }}>
                                <Image
                                    source={{ uri: url }}
                                    style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH }}
                                    resizeMode="contain"
                                />
                            </View>
                        )}
                    />
                </View>
            </Modal>
        </View>
    );
}
