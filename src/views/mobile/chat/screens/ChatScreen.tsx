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
    TextInput,
    ActivityIndicator,
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
import { useThemeColors } from "@/shared/theme/colors";
import { useAuthStore } from "@/shared/store/authStore";
import { useLocalSearchParams } from "expo-router";

const SCREEN_WIDTH = Dimensions.get("window").width;

export default function ChatScreen() {
    const colors = useThemeColors();
    const route = useRoute<any>();
    const router = useRouter();
    const { id, name, type } = route.params || {};
    const roomId = typeof id === "string" ? id : "";
    const displayName = typeof name === "string" ? name : "Người dùng";
    // Chuẩn hóa: mọi loại không phải GROUP đều xem như chat 1-1 (DIRECT)
    const rawType = typeof type === "string" ? type : "DIRECT";
    const roomType = rawType === "GROUP" ? "GROUP" : "DIRECT";

    const [messages, setMessages] = useState<(MessageDynamo & { isError?: boolean })[]>([]);
    const [sending, setSending] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const galleryRef = useRef<FlatList>(null);
    const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
    const [galleryCurrentIndex, setGalleryCurrentIndex] = useState(0);

    const [selectedMessage, setSelectedMessage] = useState<MessageDynamo | null>(null);
    const [showActionSheet, setShowActionSheet] = useState(false);
    const [showPinnedList, setShowPinnedList] = useState(false);
    const [reactionListMessage, setReactionListMessage] = useState<MessageDynamo | null>(null);
    const [showForwardModal, setShowForwardModal] = useState(false);
    const [forwardingMessage, setForwardingMessage] = useState<MessageDynamo | null>(null);
    const [forwardLoading, setForwardLoading] = useState(false);
    const [forwardSearch, setForwardSearch] = useState("");
    const [selectedForwardRooms, setSelectedForwardRooms] = useState<Set<string>>(new Set());
    const [replyTo, setReplyTo] = useState<{
        messageId: string;
        senderName?: string;
        content: string;
    } | null>(null);

    const openGroupInfo = () => {
        router.push({
            pathname: "/group-info",
            params: {
                roomId,
            }
        });
    };

    const openChatOptions = () => {
        const avatarUrl = useChatStore.getState().rooms.find(r => r.id === roomId)?.avatarUrl || "";
        router.push({
            pathname: "/chat-options",
            params: {
                roomId,
                name: displayName,
                avatarUrl,
                partnerId: partnerId ?? "",
                type: roomType
            }
        });
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
                const imgMsgs = result.messages.filter(m => m.attachments && m.attachments.length > 0);
                if (imgMsgs.length > 0) {
                    console.log("🔗 Attachments payload from history:", JSON.stringify(imgMsgs[0].attachments, null, 2));
                }
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
                    // Xóa tin nhắn temp ĐẦU TIÊN của user này (nếu có) thay vì xóa tất cả temp
                    const tempIdx = prev.findIndex(
                        (m) => m.messageId.startsWith("temp-") && m.senderId === newMsg.senderId
                    );

                    if (tempIdx !== -1) {
                        const next = [...prev];
                        next.splice(tempIdx, 1);
                        return [newMsg, ...next];
                    }

                    return [newMsg, ...prev];
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
            Alert.alert("Lỗi", "Gửi tin nhắn thất bại, vui lòng thử lại.");
            setMessages((prev) =>
                prev.map(m => m.messageId === optimisticMsg.messageId ? { ...m, isError: true } : m)
            );
        } finally {
            setSending(false);
            setReplyTo(null);
        }
    };

    // ─── Send image(s) ───
    const handleSendImage = async (assets: ImagePicker.ImagePickerAsset[]) => {
        if (!roomId || sending || assets.length === 0) return;
        setSending(true);

        // Optimistic UI with local images (tạm thời để hiển thị ngay)
        const tempId = `temp-img-${Date.now()}`;
        const optimisticMsg: MessageDynamo = {
            messageId: tempId,
            chatRoomId: roomId,
            senderId: currentUserId || "",
            senderName: "Tôi",
            content: "",
            attachments: assets.map((a, i) => ({
                id: "",
                url: a.uri, // Tạm thời dùng local URI
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
                    id: "",
                    name: uploadData.fileName || filename,
                    url: uploadData.fileUrl,
                    type: uploadData.fileType || "image/jpeg",
                    filename: uploadData.fileName || filename,
                    size: uploadData.size || asset.fileSize || 0,
                };
            });

            const uploadedAttachments = await Promise.all(uploadPromises);

            // ✅ Cập nhật optimistic message với server URLs
            setMessages((prev) =>
                prev.map(m =>
                    m.messageId === tempId
                        ? { ...m, attachments: uploadedAttachments }
                        : m
                )
            );

            // Send message with all attachments via WebSocket
            const sentViaWs = webSocketService.sendChatMessage(
                roomId,
                "",
                "IMAGE",
                undefined,
                uploadedAttachments
            );
            if (!sentViaWs) {
                console.log("WS not connected for image, fallback to REST");
                await chatService.sendMessage(roomId, "", undefined, "IMAGE", uploadedAttachments);
                await fetchMessages();
            }
        } catch (err) {
            console.log("Error sending image:", err);
            Alert.alert("Lỗi", "Gửi ảnh thất bại, vui lòng thử lại.");
            setMessages((prev) =>
                prev.map(m => m.messageId === tempId ? { ...m, isError: true } : m)
            );
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
                url: file.uri, // Tạm thời dùng local URI
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
                id: "",
                name: uploadData.fileName || filename,
                url: uploadData.fileUrl,
                type: uploadData.fileType || type,
                filename: uploadData.fileName || filename,
                size: uploadData.size || file.size || 0,
            };

            // ✅ Cập nhật optimistic message với server URL
            setMessages((prev) =>
                prev.map(m =>
                    m.messageId === tempId
                        ? { ...m, attachments: [attachment] }
                        : m
                )
            );

            const sentViaWs = webSocketService.sendChatMessage(
                roomId,
                "",
                "FILE",
                undefined,
                [attachment]
            );
            if (!sentViaWs) {
                console.log("WS not connected for file, fallback to REST");
                await chatService.sendMessage(roomId, "", undefined, "FILE", [attachment]);
                await fetchMessages();
            }
        } catch (err) {
            console.log("Error sending file:", err);
            Alert.alert("Lỗi", "Gửi file thất bại, vui lòng thử lại.");
            setMessages((prev) =>
                prev.map(m => m.messageId === tempId ? { ...m, isError: true } : m)
            );
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

    const handleOpenForward = () => {
        if (!selectedMessage) return;
        setForwardingMessage(selectedMessage);
        setForwardSearch("");
        setSelectedForwardRooms(new Set());
        setShowActionSheet(false);
        setShowForwardModal(true);
    };

    const toggleForwardRoom = (targetRoomId: string) => {
        setSelectedForwardRooms((prev) => {
            const next = new Set(prev);
            if (next.has(targetRoomId)) {
                next.delete(targetRoomId);
            } else {
                next.add(targetRoomId);
            }
            return next;
        });
    };

    const handleConfirmForward = async () => {
        if (!forwardingMessage || !roomId || forwardLoading || selectedForwardRooms.size === 0) return;
        setForwardLoading(true);
        try {
            await Promise.all(
                Array.from(selectedForwardRooms).map((targetRoomId) =>
                    MessageService.forwardMessage(
                        roomId,
                        forwardingMessage.messageId,
                        targetRoomId
                    )
                )
            );
            setShowForwardModal(false);
            setForwardingMessage(null);
            setSelectedForwardRooms(new Set());
            const count = selectedForwardRooms.size;
            Alert.alert(
                "Thành công",
                count === 1
                    ? "Đã chuyển tiếp tin nhắn!"
                    : `Đã chuyển tiếp đến các cuộc trò chuyện!`
            );
        } catch (err) {
            console.log("Error forwarding message:", err);
            Alert.alert("Lỗi", "Chuyển tiếp thất bại. Vui lòng thử lại.");
        } finally {
            setForwardLoading(false);
        }
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

    // Xử lý URL ảnh cho cả localhost và IP address
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
        <View style={{ flex: 1, backgroundColor: colors.background }}>
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
                                paddingVertical: 8,
                                borderBottomWidth: 1,
                                borderBottomColor: colors.border,
                                backgroundColor: colors.card,
                            }}
                        >
                            <TouchableOpacity
                                activeOpacity={0.8}
                                style={{
                                    backgroundColor: colors.background,
                                    borderRadius: 10,
                                    paddingHorizontal: 12,
                                    paddingVertical: 8,
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                }}
                                onPress={() => {
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
                                            color: colors.text,
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
                                                color: colors.textSecondary,
                                                fontSize: 11,
                                                marginRight: 6,
                                            }}
                                        >
                                            +{pinned.length - 1}
                                        </Text>
                                    )}
                                    <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
                                </View>
                            </TouchableOpacity>
                        </View>
                    );
                })()
            )}

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
                style={{ flex: 1 }}
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
                        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", transform: [{ scaleY: -1 }] }}>
                            <Text style={{ color: colors.textSecondary }}>
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
                            borderTopWidth: 1,
                            borderTopColor: colors.border,
                            backgroundColor: colors.card,
                            alignItems: "center",
                        }}
                    >
                        <Text
                            style={{
                                color: colors.text,
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
                                    backgroundColor: colors.primary,
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
                        backgroundColor: "rgba(0,0,0,0.5)",
                        justifyContent: "flex-end",
                    }}
                    onPress={closeActionSheet}
                >
                    <View
                        style={{
                            backgroundColor: colors.background,
                            paddingBottom: 32,
                            paddingTop: 12,
                            borderTopLeftRadius: 20,
                            borderTopRightRadius: 20,
                            borderWidth: 1,
                            borderColor: colors.border,
                        }}
                    >
                        <View
                            style={{
                                alignSelf: "center",
                                width: 36,
                                height: 5,
                                borderRadius: 999,
                                backgroundColor: colors.border,
                                marginBottom: 20,
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
                                            width: 48,
                                            height: 48,
                                            borderRadius: 24,
                                            backgroundColor: colors.card,
                                            alignItems: "center",
                                            justifyContent: "center",
                                            borderWidth: 1,
                                            borderColor: colors.border,
                                        }}
                                    >
                                        <Text style={{ fontSize: 24 }}>{emoji}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        {selectedMessage?.senderId === currentUserId && !selectedMessage?.recalled && (
                            <TouchableOpacity
                                onPress={handleRecall}
                                style={{
                                    paddingVertical: 14,
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
                                    flexDirection: "row",
                                    alignItems: "center",
                                }}
                            >
                                <Ionicons name="arrow-redo-outline" size={20} color="#e5e7eb" style={{ marginRight: 12 }} />
                                <Text style={{ color: "#e5e7eb", fontSize: 16 }}>
                                    Trả lời
                                </Text>
                            </TouchableOpacity>
                        )}

                        {selectedMessage && !selectedMessage.recalled && (
                            <TouchableOpacity
                                onPress={handleOpenForward}
                                style={{
                                    paddingVertical: 12,
                                    paddingHorizontal: 20,
                                    flexDirection: "row",
                                    alignItems: "center",
                                }}
                            >
                                <Ionicons name="share-outline" size={20} color="#60a5fa" style={{ marginRight: 12 }} />
                                <Text style={{ color: "#60a5fa", fontSize: 16, fontWeight: "500" }}>
                                    Chuyển tiếp
                                </Text>
                            </TouchableOpacity>
                        )}

                        {selectedMessage && (
                            <TouchableOpacity
                                onPress={handleTogglePin}
                                style={{
                                    paddingVertical: 12,
                                    paddingHorizontal: 20,
                                    flexDirection: "row",
                                    alignItems: "center",
                                }}
                            >
                                <Ionicons name={selectedMessage.pinned ? "pin" : "pin-outline"} size={20} color="#e5e7eb" style={{ marginRight: 12 }} />
                                <Text style={{ color: "#e5e7eb", fontSize: 16 }}>
                                    {selectedMessage.pinned ? "Bỏ ghim" : "Ghim"}
                                </Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            onPress={closeActionSheet}
                            style={{
                                paddingVertical: 14,
                                paddingHorizontal: 20,
                                flexDirection: "row",
                                alignItems: "center",
                            }}
                        >
                            <Ionicons name="close-outline" size={20} color={colors.textSecondary} style={{ marginRight: 12 }} />
                            <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Đóng</Text>
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
                        backgroundColor: "rgba(0,0,0,0.5)",
                        justifyContent: "flex-end",
                    }}
                    onPress={() => setShowPinnedList(false)}
                >
                    <View
                        style={{
                            backgroundColor: colors.background,
                            paddingTop: 16,
                            paddingBottom: 32,
                            borderTopLeftRadius: 20,
                            borderTopRightRadius: 20,
                            maxHeight: "70%",
                            borderWidth: 1,
                            borderColor: colors.border,
                        }}
                    >
                        <Text
                            style={{
                                color: colors.text,
                                fontSize: 17,
                                fontWeight: "700",
                                textAlign: "center",
                                marginBottom: 12,
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
                                        color: colors.textSecondary,
                                        textAlign: "center",
                                        paddingVertical: 40,
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
                                                paddingVertical: 12,
                                                paddingHorizontal: 16,
                                                borderBottomWidth: 1,
                                                borderBottomColor: colors.border,
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
                                                        color: colors.text,
                                                        fontSize: 15,
                                                        marginBottom: 4,
                                                    }}
                                                    numberOfLines={2}
                                                >
                                                    {m.content || "[Tin nhắn]"}
                                                </Text>
                                                <Text
                                                    style={{
                                                        color: colors.textSecondary,
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
                                                <Ionicons name="close-circle" size={24} color={colors.textSecondary} />
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
                        backgroundColor: "rgba(0,0,0,0.5)",
                        justifyContent: "flex-end",
                    }}
                    onPress={() => setReactionListMessage(null)}
                >
                    <TouchableOpacity
                        activeOpacity={1}
                        onPress={() => { }}
                        style={{
                            backgroundColor: colors.background,
                            paddingTop: 16,
                            paddingBottom: 32,
                            borderTopLeftRadius: 20,
                            borderTopRightRadius: 20,
                            maxHeight: "70%",
                            borderWidth: 1,
                            borderColor: colors.border,
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
                                            paddingHorizontal: 20,
                                            marginBottom: 16,
                                        }}
                                    >
                                        <Text
                                            style={{
                                                color: colors.text,
                                                fontSize: 17,
                                                fontWeight: "700",
                                            }}
                                        >
                                            Tất cả {total}
                                        </Text>
                                        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                                            {Object.entries(byEmoji).map(([emoji, count]) => (
                                                <Text
                                                    key={emoji}
                                                    style={{ color: colors.text, fontSize: 14, marginLeft: 12 }}
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
                                                    paddingHorizontal: 20,
                                                    paddingVertical: 12,
                                                    borderBottomWidth: 1,
                                                    borderBottomColor: colors.border,
                                                }}
                                            >
                                                <View
                                                    style={{
                                                        width: 40,
                                                        height: 40,
                                                        borderRadius: 20,
                                                        backgroundColor: colors.card,
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        marginRight: 12,
                                                        borderWidth: 1,
                                                        borderColor: colors.border,
                                                    }}
                                                >
                                                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>
                                                        {(reactionUserNameMap[uid] || uid).charAt(0).toUpperCase()}
                                                    </Text>
                                                </View>
                                                <Text
                                                    style={{
                                                        flex: 1,
                                                        color: colors.text,
                                                        fontSize: 15,
                                                    }}
                                                    numberOfLines={1}
                                                >
                                                    {reactionUserNameMap[uid] || "Người dùng"}
                                                </Text>
                                                <View style={{ flexDirection: "row" }}>
                                                    {(Array.isArray(byUser[uid]) ? byUser[uid] : []).map((emoji) => (
                                                        <Text key={emoji} style={{ fontSize: 18, marginLeft: 8 }}>
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

            {/* ─── Modal chuyển tiếp tin nhắn (multi-select) ─── */}
            <Modal
                transparent
                animationType="slide"
                visible={showForwardModal}
                onRequestClose={() => {
                    if (!forwardLoading) {
                        setShowForwardModal(false);
                        setSelectedForwardRooms(new Set());
                    }
                }}
            >
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
                    <TouchableOpacity
                        activeOpacity={1}
                        style={{ flex: 1 }}
                        onPress={() => {
                            if (!forwardLoading) {
                                setShowForwardModal(false);
                                setSelectedForwardRooms(new Set());
                            }
                        }}
                    />
                    <View
                        style={{
                            backgroundColor: colors.background,
                            borderTopLeftRadius: 24,
                            borderTopRightRadius: 24,
                            paddingTop: 12,
                            maxHeight: "85%",
                            borderWidth: 1,
                            borderColor: colors.border,
                        }}
                    >
                        {/* Handle bar */}
                        <View
                            style={{
                                alignSelf: "center",
                                width: 40,
                                height: 4,
                                borderRadius: 999,
                                backgroundColor: colors.border,
                                marginBottom: 14,
                            }}
                        />

                        {/* Header */}
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                                paddingHorizontal: 20,
                                marginBottom: 10,
                            }}
                        >
                            <View>
                                <Text style={{ color: colors.text, fontSize: 17, fontWeight: "700" }}>
                                    Chuyển tiếp đến
                                </Text>
                                {selectedForwardRooms.size > 0 && (
                                    <Text style={{ color: "#60a5fa", fontSize: 12, marginTop: 2 }}>
                                        Đã chọn {selectedForwardRooms.size} cuộc trò chuyện
                                    </Text>
                                )}
                            </View>
                            <TouchableOpacity
                                onPress={() => {
                                    if (!forwardLoading) {
                                        setShowForwardModal(false);
                                        setSelectedForwardRooms(new Set());
                                    }
                                }}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name="close" size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        {/* Preview tin nhắn gốc */}
                        {forwardingMessage && (
                            <View
                                style={{
                                    marginHorizontal: 16,
                                    marginBottom: 10,
                                    padding: 10,
                                    backgroundColor: colors.card,
                                    borderRadius: 12,
                                    borderLeftWidth: 3,
                                    borderLeftColor: "#60a5fa",
                                    flexDirection: "row",
                                    alignItems: "center",
                                }}
                            >
                                <Ionicons
                                    name={
                                        forwardingMessage.type === "IMAGE"
                                            ? "image-outline"
                                            : forwardingMessage.attachments?.length > 0
                                                ? "document-outline"
                                                : "chatbubble-outline"
                                    }
                                    size={18}
                                    color="#60a5fa"
                                    style={{ marginRight: 8 }}
                                />
                                <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13, flex: 1 }}>
                                    {forwardingMessage.type === "IMAGE"
                                        ? `${forwardingMessage.attachments?.length ?? 1} hình ảnh`
                                        : forwardingMessage.attachments?.length > 0
                                            ? forwardingMessage.attachments[0].name || "Tệp đính kèm"
                                            : forwardingMessage.content || "[Tin nhắn]"}
                                </Text>
                            </View>
                        )}

                        {/* Ô tìm kiếm */}
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                marginHorizontal: 16,
                                marginBottom: 6,
                                backgroundColor: colors.card,
                                borderRadius: 12,
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                                borderWidth: 1,
                                borderColor: colors.border,
                            }}
                        >
                            <Ionicons name="search-outline" size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
                            <TextInput
                                placeholder="Tìm cuộc trò chuyện..."
                                placeholderTextColor={colors.textSecondary}
                                value={forwardSearch}
                                onChangeText={setForwardSearch}
                                style={{
                                    flex: 1,
                                    color: colors.text,
                                    fontSize: 14,
                                    padding: 0,
                                }}
                            />
                            {forwardSearch.length > 0 && (
                                <TouchableOpacity onPress={() => setForwardSearch("")}>
                                    <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Danh sách cuộc trò chuyện – multi-select */}
                        <FlatList
                            data={rooms.filter((r) =>
                                r.id !== roomId &&
                                (forwardSearch.trim() === "" ||
                                    r.name?.toLowerCase().includes(forwardSearch.toLowerCase()))
                            )}
                            keyExtractor={(item) => item.id}
                            style={{ maxHeight: 340 }}
                            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 4 }}
                            ListEmptyComponent={() => (
                                <View style={{ alignItems: "center", paddingVertical: 28 }}>
                                    <Ionicons name="chatbubbles-outline" size={36} color={colors.textSecondary} />
                                    <Text style={{ color: colors.textSecondary, marginTop: 8, fontSize: 14 }}>
                                        Không tìm thấy cuộc trò chuyện
                                    </Text>
                                </View>
                            )}
                            renderItem={({ item }) => {
                                const isSelected = selectedForwardRooms.has(item.id);
                                const avatarUri =
                                    item.avatarUrl ||
                                    `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name || "U")}&background=0068FF&color=fff`;
                                return (
                                    <TouchableOpacity
                                        onPress={() => toggleForwardRoom(item.id)}
                                        disabled={forwardLoading}
                                        activeOpacity={0.7}
                                        style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            paddingVertical: 10,
                                            borderBottomWidth: 1,
                                            borderBottomColor: colors.border,
                                            opacity: forwardLoading ? 0.5 : 1,
                                        }}
                                    >
                                        {/* Checkbox */}
                                        <View
                                            style={{
                                                width: 24,
                                                height: 24,
                                                borderRadius: 12,
                                                borderWidth: 2,
                                                borderColor: isSelected ? "#60a5fa" : colors.border,
                                                backgroundColor: isSelected ? "#60a5fa" : "transparent",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                marginRight: 12,
                                            }}
                                        >
                                            {isSelected && (
                                                <Ionicons name="checkmark" size={14} color="#fff" />
                                            )}
                                        </View>

                                        {/* Avatar */}
                                        <Image
                                            source={{ uri: avatarUri }}
                                            style={{
                                                width: 44,
                                                height: 44,
                                                borderRadius: 22,
                                                marginRight: 12,
                                                backgroundColor: colors.card,
                                                borderWidth: isSelected ? 2 : 0,
                                                borderColor: "#60a5fa",
                                            }}
                                        />

                                        {/* Thông tin */}
                                        <View style={{ flex: 1 }}>
                                            <Text
                                                numberOfLines={1}
                                                style={{
                                                    color: isSelected ? "#60a5fa" : colors.text,
                                                    fontSize: 15,
                                                    fontWeight: isSelected ? "600" : "400",
                                                }}
                                            >
                                                {item.name || "Người dùng"}
                                            </Text>
                                            <Text
                                                numberOfLines={1}
                                                style={{
                                                    color: colors.textSecondary,
                                                    fontSize: 12,
                                                    marginTop: 1,
                                                }}
                                            >
                                                {item.type === "GROUP" ? "👥 Nhóm" : "👤 Cá nhân"}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            }}
                        />

                        {/* Nút gửi – cố định dưới đáy modal */}
                        <View
                            style={{
                                paddingHorizontal: 16,
                                paddingTop: 12,
                                paddingBottom: 28,
                                borderTopWidth: 1,
                                borderTopColor: colors.border,
                            }}
                        >
                            <TouchableOpacity
                                onPress={handleConfirmForward}
                                disabled={selectedForwardRooms.size === 0 || forwardLoading}
                                style={{
                                    backgroundColor:
                                        selectedForwardRooms.size === 0 ? colors.border : "#60a5fa",
                                    borderRadius: 14,
                                    paddingVertical: 14,
                                    alignItems: "center",
                                    flexDirection: "row",
                                    justifyContent: "center",
                                }}
                            >
                                {forwardLoading ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <>
                                        <Ionicons
                                            name="send"
                                            size={18}
                                            color={selectedForwardRooms.size === 0 ? colors.textSecondary : "#fff"}
                                            style={{ marginRight: 8 }}
                                        />
                                        <Text
                                            style={{
                                                color: selectedForwardRooms.size === 0 ? colors.textSecondary : "#fff",
                                                fontSize: 16,
                                                fontWeight: "700",
                                            }}
                                        >
                                            {selectedForwardRooms.size === 0
                                                ? "Chọn để chuyển tiếp"
                                                : `Chuyển tiếp`}
                                        </Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ─── Chat-wide swipeable image gallery ─── */}
            <Modal
                visible={galleryIndex !== null}
                transparent
                animationType="fade"
                onRequestClose={() => setGalleryIndex(null)}
            >
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.98)" }}>
                    <TouchableOpacity
                        onPress={() => setGalleryIndex(null)}
                        style={{ position: "absolute", top: 52, right: 20, zIndex: 10, padding: 8 }}
                    >
                        <Ionicons name="close" size={32} color="#fff" />
                    </TouchableOpacity>

                    {allImages.length > 1 && (
                        <View style={{ position: "absolute", top: 56, left: 0, right: 0, zIndex: 10, alignItems: "center" }}>
                            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "600" }}>
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
