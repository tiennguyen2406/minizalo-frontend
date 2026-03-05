import React, { useState, useRef, useCallback } from "react";
import { View, Text, TouchableOpacity, Image, Modal, Dimensions, Linking, FlatList } from "react-native";
import type { MessageDynamo } from "@/shared/services/chatService";
import { formatTime } from "@/shared/utils/dateUtils";
import { Ionicons } from "@expo/vector-icons";

const SCREEN_WIDTH = Dimensions.get("window").width;

function formatFileSize(bytes: number): string {
    if (!bytes || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

interface ReplyPreview {
    senderName?: string;
    content: string;
}

interface MessageBubbleProps {
    message: MessageDynamo;
    isMe: boolean;
    showSenderName?: boolean; // for group chats
    onLongPress?: (message: MessageDynamo) => void;
    onPress?: (message: MessageDynamo) => void;
    onPressReactions?: (message: MessageDynamo) => void;
    onImagePress?: (imageUrl: string) => void;
    replyPreview?: ReplyPreview | null;
}

// Tạo màu nhất quán cho mỗi tên (giống Zalo)
function getNameColor(name: string): string {
    const colors = [
        "#e74c3c", // đỏ
        "#3498db", // xanh dương
        "#2ecc71", // xanh lá
        "#e67e22", // cam
        "#9b59b6", // tím
        "#1abc9c", // xanh ngọc
        "#f39c12", // vàng
        "#e91e63", // hồng
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

export default function MessageBubble({
    message,
    isMe,
    showSenderName,
    onLongPress,
    onPress,
    onPressReactions,
    onImagePress,
    replyPreview,
}: MessageBubbleProps) {
    const senderName = message.senderName;
    const isRecalled = message.recalled;
    const time =
        message.createdAt && !isNaN(Date.parse(message.createdAt))
            ? formatTime(message.createdAt)
            : "";

    const [previewIndex, setPreviewIndex] = useState<number | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const galleryRef = useRef<FlatList>(null);

    // Xử lý lỗi URL localhost từ MinIO trên thiết bị thật/emulator
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

    const handlePress = () => {
        if (onPress) {
            onPress(message);
        }
    };

    const handleLongPress = () => {
        if (onLongPress) {
            onLongPress(message);
        }
    };

    const bubbleBackground = isMe ? "#0091FF" : "#2a2a2a";
    const textColor = isRecalled ? "#9ca3af" : "#ffffff";

    // Check for image attachments
    const imageAttachments = (message.attachments || []).filter(
        (a) => a.type?.startsWith("image") || a.type === "IMAGE"
    );
    // Check for file attachments (non-image)
    const fileAttachments = (message.attachments || []).filter(
        (a) => a.type && !a.type.startsWith("image") && a.type !== "IMAGE"
    );
    const hasImages = imageAttachments.length > 0 && !isRecalled;
    const hasFiles = fileAttachments.length > 0 && !isRecalled;
    const hasText = !!message.content && !isRecalled;

    return (
        <View
            style={{
                paddingHorizontal: 12,
                paddingVertical: 2,
                alignItems: isMe ? "flex-end" : "flex-start",
            }}
        >
            <TouchableOpacity
                activeOpacity={0.8}
                delayLongPress={250}
                onPress={handlePress}
                onLongPress={handleLongPress}
            >
                {/* Bubble */}
                <View
                    style={{
                        maxWidth: "75%",
                        backgroundColor: (hasImages && !hasText && !hasFiles) ? "transparent" : bubbleBackground,
                        borderRadius: 16,
                        ...(isMe
                            ? { borderBottomRightRadius: 4 }
                            : { borderBottomLeftRadius: 4 }),
                        opacity: isRecalled ? 0.8 : 1,
                        overflow: "hidden",
                    }}
                >
                    {/* Preview reply (nếu có) */}
                    {replyPreview && (
                        <View
                            style={{
                                marginBottom: 6,
                                marginHorizontal: 12,
                                marginTop: 8,
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                borderLeftWidth: 2,
                                borderLeftColor: "#6b7280",
                                backgroundColor: "#111827",
                                borderRadius: 6,
                            }}
                        >
                            {replyPreview.senderName && (
                                <Text
                                    style={{
                                        color: "#9ca3af",
                                        fontSize: 11,
                                        fontWeight: "600",
                                        marginBottom: 2,
                                    }}
                                >
                                    {replyPreview.senderName}
                                </Text>
                            )}
                            <Text
                                numberOfLines={2}
                                style={{
                                    color: "#e5e7eb",
                                    fontSize: 11,
                                }}
                            >
                                {replyPreview.content}
                            </Text>
                        </View>
                    )}

                    {/* Tên người gửi trong group */}
                    {showSenderName && !isMe && senderName && (
                        <Text
                            style={{
                                fontSize: 12,
                                color: getNameColor(senderName),
                                fontWeight: "700",
                                marginBottom: 2,
                                paddingHorizontal: 12,
                                paddingTop: hasImages ? 8 : 0,
                            }}
                        >
                            {senderName}
                        </Text>
                    )}

                    {/* Image attachments */}
                    {hasImages && (() => {
                        const count = imageAttachments.length;
                        const isSingle = count === 1;
                        // Choose columns: 2 imgs → 2 cols, 3 → 3 cols, 4+ → 4 cols
                        const GRID_COLS = isSingle ? 1 : count <= 2 ? 2 : count <= 3 ? 3 : 4;
                        const gap = 2;
                        const maxBubbleWidth = SCREEN_WIDTH * 0.65;
                        const thumbSize = isSingle
                            ? SCREEN_WIDTH * 0.55
                            : Math.floor((maxBubbleWidth - gap * (GRID_COLS - 1)) / GRID_COLS);
                        const gridWidth = isSingle
                            ? undefined
                            : thumbSize * GRID_COLS + gap * (GRID_COLS - 1) + 4; // +4 for padding

                        return (
                            <View style={isSingle ? undefined : {
                                flexDirection: "row",
                                flexWrap: "wrap",
                                width: gridWidth,
                                padding: 2,
                            }}>
                                {imageAttachments.map((att, idx) => (
                                    <TouchableOpacity
                                        key={idx}
                                        activeOpacity={0.9}
                                        onPress={() => {
                                            const url = getImageUrl(att.url);
                                            if (onImagePress) {
                                                onImagePress(url);
                                            } else {
                                                setPreviewIndex(idx);
                                                setCurrentIndex(idx);
                                            }
                                        }}
                                        style={isSingle ? undefined : {
                                            marginRight: (idx + 1) % GRID_COLS === 0 ? 0 : gap,
                                            marginBottom: gap,
                                        }}
                                    >
                                        <Image
                                            source={{ uri: getImageUrl(att.url) }}
                                            style={{
                                                width: thumbSize,
                                                height: thumbSize,
                                                borderRadius: isSingle ? (hasText ? 0 : 16) : 4,
                                                ...(isSingle && isMe && !hasText
                                                    ? { borderBottomRightRadius: 4 }
                                                    : isSingle && !isMe && !hasText
                                                        ? { borderBottomLeftRadius: 4 }
                                                        : {}),
                                            }}
                                            resizeMode="cover"
                                        />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        );
                    })()}

                    {/* File attachments */}
                    {hasFiles && (
                        <View>
                            {fileAttachments.map((att, idx) => {
                                const fileName = att.name || att.filename || "Tệp đính kèm";
                                const fileSize = att.size ? formatFileSize(att.size) : "";
                                return (
                                    <TouchableOpacity
                                        key={idx}
                                        activeOpacity={0.8}
                                        onPress={() => {
                                            const url = getImageUrl(att.url);
                                            if (url) Linking.openURL(url);
                                        }}
                                        style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            paddingHorizontal: 12,
                                            paddingVertical: 10,
                                        }}
                                    >
                                        <View
                                            style={{
                                                width: 40,
                                                height: 40,
                                                borderRadius: 8,
                                                backgroundColor: isMe ? "rgba(255,255,255,0.15)" : "#3a3a3a",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                marginRight: 10,
                                            }}
                                        >
                                            <Ionicons name="document-text-outline" size={22} color="#fff" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text
                                                numberOfLines={2}
                                                style={{
                                                    color: "#fff",
                                                    fontSize: 14,
                                                    fontWeight: "500",
                                                }}
                                            >
                                                {fileName}
                                            </Text>
                                            {fileSize ? (
                                                <Text style={{ color: isMe ? "#b3d9ff" : "#888", fontSize: 12, marginTop: 2 }}>
                                                    {fileSize}
                                                </Text>
                                            ) : null}
                                        </View>
                                        <Ionicons name="download-outline" size={20} color={isMe ? "#b3d9ff" : "#888"} />
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}

                    {/* Text content */}
                    {(hasText || isRecalled) && (
                        <View style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
                            <Text
                                style={{
                                    color: textColor,
                                    fontSize: 15,
                                    lineHeight: 20,
                                    fontStyle: isRecalled ? "italic" : "normal",
                                }}
                            >
                                {isRecalled ? "Tin nhắn đã được thu hồi" : message.content}
                            </Text>
                        </View>
                    )}

                    {/* Time */}
                    {time ? (
                        <Text
                            style={{
                                fontSize: 11,
                                paddingHorizontal: 12,
                                paddingBottom: 6,
                                marginTop: hasImages && !hasText ? 4 : 0,
                                color: isMe ? "#b3d9ff" : "#888",
                                textAlign: "right",
                            }}
                        >
                            {time}
                        </Text>
                    ) : null}
                </View>

                {/* Reactions */}
                {Array.isArray(message.reactions) && message.reactions.length > 0 && (
                    <TouchableOpacity
                        onPress={() => onPressReactions?.(message)}
                        activeOpacity={0.8}
                        style={{
                            flexDirection: "row",
                            alignSelf: isMe ? "flex-end" : "flex-start",
                            marginTop: 2,
                            marginRight: isMe ? 8 : 0,
                            marginLeft: !isMe ? 8 : 0,
                            backgroundColor: "#111827",
                            borderRadius: 999,
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                        }}
                    >
                        {Object.entries(
                            message.reactions.reduce<Record<string, number>>((acc, r) => {
                                if (!r?.emoji) return acc;
                                acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                                return acc;
                            }, {})
                        ).map(([emoji, count]) => (
                            <View
                                key={emoji}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    marginHorizontal: 2,
                                }}
                            >
                                <Text style={{ fontSize: 11, marginRight: 2 }}>{emoji}</Text>
                                <Text
                                    style={{
                                        color: "#e5e7eb",
                                        fontSize: 9,
                                        fontWeight: "600",
                                    }}
                                >
                                    {count}
                                </Text>
                            </View>
                        ))}
                    </TouchableOpacity>
                )}
            </TouchableOpacity>

            {/* Full-screen swipeable image gallery */}
            <Modal
                visible={previewIndex !== null}
                transparent
                animationType="fade"
                onRequestClose={() => setPreviewIndex(null)}
            >
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.95)" }}>
                    {/* Close button */}
                    <TouchableOpacity
                        onPress={() => setPreviewIndex(null)}
                        style={{ position: "absolute", top: 50, right: 20, zIndex: 10, padding: 8 }}
                    >
                        <Ionicons name="close" size={28} color="#fff" />
                    </TouchableOpacity>

                    {/* Counter */}
                    {imageAttachments.length > 1 && (
                        <View style={{ position: "absolute", top: 54, left: 0, right: 0, zIndex: 10, alignItems: "center" }}>
                            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
                                {currentIndex + 1} / {imageAttachments.length}
                            </Text>
                        </View>
                    )}

                    {/* Swipeable gallery */}
                    <FlatList
                        ref={galleryRef}
                        data={imageAttachments}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        keyExtractor={(_, i) => `gallery-${i}`}
                        initialScrollIndex={previewIndex ?? 0}
                        getItemLayout={(_, index) => ({
                            length: SCREEN_WIDTH,
                            offset: SCREEN_WIDTH * index,
                            index,
                        })}
                        onMomentumScrollEnd={(e) => {
                            const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                            setCurrentIndex(idx);
                        }}
                        renderItem={({ item: att }) => (
                            <View style={{
                                width: SCREEN_WIDTH,
                                flex: 1,
                                justifyContent: "center",
                                alignItems: "center",
                            }}>
                                <Image
                                    source={{ uri: getImageUrl(att.url) }}
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
