import React, { useState, useRef, useCallback, useMemo } from "react";
import { View, Text, TouchableOpacity, Image, Modal, Dimensions, Linking, FlatList, Animated, Alert, Share, Platform, StatusBar, Pressable, useColorScheme, StyleSheet } from "react-native";
import type { Attachment, MessageDynamo } from "@/shared/services/chatService";
import { formatTime } from "@/shared/utils/dateUtils";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/shared/theme/colors";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system/legacy";
const { documentDirectory, cacheDirectory, downloadAsync, readAsStringAsync, EncodingType } = FileSystem;
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
import { Video, ResizeMode } from "expo-av";
import { useThemeStore } from "@/shared/store/themeStore";
import { isImageAttachment, isVideoAttachment } from "@/shared/utils/messageAttachments";
import PollBubbleMobile from "./PollBubbleMobile";
import AudioMessageItem from "./AudioMessageItem";
import { getImageUrl } from "@/shared/utils/mediaUtils";


const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;

function isGroupActionSystemText(text?: string | null): boolean {
    const t = String(text || "").trim();
    if (!t) return false;
    return (
        /đã phong .* làm phó nhóm/i.test(t) ||
        /đã xóa quyền phó nhóm/i.test(t) ||
        /đã chặn .* khỏi nhóm/i.test(t) ||
        /đã thay đổi .* thành (bật|tắt)/i.test(t) ||
        /đã cập nhật: quyền .* (được bật|đã tắt)/i.test(t)
    );
}

function isPhoneLikeName(value?: string | null): boolean {
    const text = String(value || "").trim();
    return !!text && /^[+\d\s().-]{8,}$/.test(text);
}

function getSystemDisplayContent(message: MessageDynamo): string {
    const content = String(message.content || "").trim();
    const actorName = !isPhoneLikeName(message.senderName) ? String(message.senderName || "").trim() : "";

    if (!content || !actorName) return content;

    const legacyUpdate = content.match(/^(.+?)\s+đã cập nhật:\s*(.+)$/i);
    if (legacyUpdate && isPhoneLikeName(legacyUpdate[1])) {
        const detail = legacyUpdate[2]
            .replace(/\s+được bật\.?$/i, " thành bật.")
            .replace(/\s+đã tắt\.?$/i, " thành tắt.");
        return `${actorName} đã thay đổi ${detail}`;
    }

    const changedByPhone = content.match(/^(.+?)\s+(đã thay đổi\s+.+)$/i);
    if (changedByPhone && isPhoneLikeName(changedByPhone[1])) {
        return `${actorName} ${changedByPhone[2]}`;
    }

    return content;
}

function isPollSystemMessageText(text?: string | null): boolean {
    const t = String(text || "").toLowerCase();
    if (!t) return false;
    return t.includes("cuộc bình chọn") || t.includes("khóa bình chọn") || t.includes("bình chọn");
}

function formatFileSize(bytes: number): string {
    if (!bytes || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

const LinkableText = ({ text, style }: { text: string, style: any }) => {
    const URL_REGEX = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(URL_REGEX);
    return (
        <Text style={style}>
            {parts.map((part, i) => {
                if (part.match(URL_REGEX)) {
                    return (
                        <Text
                            key={i}
                            style={[style, { color: (style.color === "#fff" || style.color === "#ffffff") ? "#add8e6" : "#0066cc", textDecorationLine: "underline" }]}
                            onPress={() => Linking.openURL(part)}
                        >
                            {part}
                        </Text>
                    );
                }
                return part;
            })}
        </Text>
    );
};

const LinkPreview = ({ url, isMe }: { url: string, isMe: boolean }) => {
    const colors = useThemeColors();
    const domain = url.replace(/https?:\/\//, "").split("/")[0];

    return (
        <TouchableOpacity
            onPress={() => Linking.openURL(url)}
            activeOpacity={0.9}
            style={{
                backgroundColor: isMe ? "rgba(255,255,255,0.15)" : (useThemeStore.getState().theme === 'dark' ? "#1c1c1e" : "#f0f0f0"),
                borderRadius: 8,
                marginHorizontal: 10,
                marginBottom: 8,
                padding: 10,
                borderLeftWidth: 3,
                borderLeftColor: isMe ? "#fff" : colors.primary,
            }}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="link-outline" size={16} color={isMe ? "#fff" : colors.primary} style={{ marginRight: 6 }} />
                <Text style={{ color: isMe ? "#fff" : colors.textSecondary, fontSize: 11, fontWeight: '600' }} numberOfLines={1}>
                    {domain}
                </Text>
            </View>
            <Text style={{ color: isMe ? "rgba(255,255,255,0.9)" : colors.text, fontSize: 13, marginTop: 4 }} numberOfLines={2}>
                {url}
            </Text>
        </TouchableOpacity>
    );
};

/** Story Reply Quote Card — hiển thị trong đoạn chat khi reply qua Khoảnh khắc */
function StoryReplyBubble({ content, isMe, time, colors, theme, onLongPress, onPressStory }: {
    content: string;
    isMe: boolean;
    time: string;
    colors: any;
    theme: string;
    onLongPress?: () => void;
    onPressStory?: (data: { storyId?: string; authorId?: string; payload?: string }) => void;
}) {
    const [imgError, setImgError] = React.useState(false);
    let data: {
        type?: string;
        mediaUrl?: string | null;
        thumbnailUri?: string | null;
        mediaType?: string;
        postedAt?: string;
        storyId?: string;
        authorId?: string;
        replyText?: string;
        imageUrl?: string | null;
        image?: string | null;
    } = {};
    try { data = JSON.parse(content); } catch { return null; }
    if (data.type !== "STORY_QUOTE") return null;

    // Try multiple possible fields for thumbnail/media
    let thumbSrc = data.thumbnailUri || data.mediaUrl || data.imageUrl || (data as any).image;
    if (thumbSrc === "null" || thumbSrc === "undefined") thumbSrc = null;

    const cardBg = isMe
        ? "rgba(255,255,255,0.14)"
        : (theme === 'dark' ? "rgba(255,255,255,0.07)" : "#e8f0fb");
    const bubbleBg = isMe
        ? colors.primary
        : (theme === 'dark' ? "#2c2c2e" : "#EBF3FE");
    const titleColor = isMe ? "#fff" : (theme === 'dark' ? colors.text : "#1a1a2e");
    const subColor = isMe ? "rgba(255,255,255,0.7)" : (theme === 'dark' ? colors.textSecondary : "#6b7280");
    const textColor = isMe ? "#fff" : (theme === 'dark' ? colors.text : "#1a1a2e");
    const dividerColor = isMe ? "rgba(255,255,255,0.18)" : (theme === 'dark' ? "rgba(255,255,255,0.08)" : "#d0dff5");
    const timeColor = isMe ? "rgba(255,255,255,0.6)" : colors.textSecondary;

    // Tiêu đề phân biệt: tôi gửi → "Bạn đã gửi...", người khác gửi cho tôi → "Tin nhắn gửi từ..."
    const cardTitle = isMe
        ? "Bạn đã gửi tin nhắn qua Khoảnh khắc"
        : "Tin nhắn gửi từ Khoảnh khắc của bạn";

    return (
        <View style={{ alignItems: isMe ? "flex-end" : "flex-start", paddingHorizontal: 12, paddingVertical: 2 }}>
            <TouchableOpacity
                activeOpacity={0.85}
                delayLongPress={250}
                onPress={() => onPressStory?.({ storyId: data.storyId || data.postedAt, authorId: data.authorId, payload: content })}
                onLongPress={onLongPress}
                style={{
                    width: SCREEN_WIDTH * 0.70,          // width cố định, không dùng maxWidth
                    backgroundColor: bubbleBg,
                    borderRadius: 16,
                    overflow: "hidden",
                    borderWidth: 1,
                    borderColor: isMe ? "transparent" : (theme === 'dark' ? "rgba(255,255,255,0.08)" : "#d0dff5"),
                    elevation: 1,
                    shadowColor: "#000",
                    shadowOpacity: 0.06,
                    shadowRadius: 4,
                }}
            >
                {/* Phần 1: Story quote card */}
                <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: cardBg,
                    margin: 8,
                    marginBottom: 0,
                    borderRadius: 10,
                    minHeight: 72,
                    overflow: "hidden",
                }}>
                    {/* Accent Line */}
                    <View style={{
                        width: 3.5,
                        alignSelf: 'stretch',
                        backgroundColor: isMe ? "rgba(255,255,255,0.8)" : "#0068FF",
                        borderRadius: 2,
                    }} />

                    {/* Thumbnail Area — numeric height for React Native compatibility */}
                    <View style={{ 
                        width: 72, 
                        height: 72, 
                        flexShrink: 0,
                        backgroundColor: isMe ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.03)",
                        borderRightWidth: 1,
                        borderRightColor: isMe ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
                        position: 'relative',
                        overflow: 'hidden' 
                    }}>
                        {(!!thumbSrc && !imgError) ? (
                            <Image
                                key={thumbSrc}
                                source={{ uri: getImageUrl(thumbSrc) }}
                                style={{ 
                                    width: 72, 
                                    height: 72, 
                                }}
                                resizeMode="cover"
                                onError={() => setImgError(true)}
                            />
                        ) : (
                            <View style={{
                                flex: 1,
                                alignItems: "center", justifyContent: "center",
                                backgroundColor: isMe ? "rgba(255,255,255,0.15)" : "#cde0ff",
                            }}>
                                <Ionicons name="image-outline" size={26} color={isMe ? "white" : "#0068FF"} />
                            </View>
                        )}
                        
                        {/* Play icon overlay for Video stories */}
                        {(data.mediaType === "VIDEO" || (thumbSrc && String(thumbSrc).toLowerCase().endsWith(".mp4"))) && (
                            <View style={{
                                ...StyleSheet.absoluteFillObject,
                                backgroundColor: 'rgba(0,0,0,0.2)',
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}>
                                <View style={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: 12,
                                    backgroundColor: 'rgba(0,0,0,0.4)',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    borderWidth: 1,
                                    borderColor: 'rgba(255,255,255,0.5)',
                                }}>
                                    <Ionicons name="play" size={14} color="#fff" style={{ marginLeft: 2 }} />
                                </View>
                            </View>
                        )}
                    </View>
                    {/* Text mô tả story — lấy toàn bộ diện tích còn lại */}
                    <View style={{ flexGrow: 1, flexShrink: 1, paddingHorizontal: 10, paddingVertical: 8 }}>
                        <Text style={{ fontWeight: "700", fontSize: 13, color: titleColor, lineHeight: 18 }} numberOfLines={2}>
                            {cardTitle}
                        </Text>
                        <Text style={{ fontSize: 12, color: subColor, marginTop: 3, lineHeight: 16 }} numberOfLines={2}>
                            Khoảnh khắc được đăng lúc {data.postedAt}
                        </Text>
                    </View>
                </View>

                {/* Phần 2: Nội dung tin nhắn người dùng */}
                {!!data.replyText && (
                    <>
                        <View style={{ height: 1, backgroundColor: dividerColor, marginHorizontal: 10, marginTop: 8 }} />
                        <Text style={{
                            fontSize: 14.5,
                            color: textColor,
                            lineHeight: 20,
                            paddingHorizontal: 12,
                            paddingTop: 8,
                            paddingBottom: 4,
                        }}>
                            {data.replyText}
                        </Text>
                    </>
                )}

                {/* Timestamp */}
                <Text style={{ fontSize: 10.5, color: timeColor, textAlign: "right", paddingRight: 10, paddingBottom: 7, paddingTop: data.replyText ? 2 : 6 }}>
                    {time}
                </Text>
            </TouchableOpacity>
        </View>
    );
}


interface ReplyPreview {
    senderName?: string;
    content: string;
}

interface MessageBubbleProps {
    message: MessageDynamo & { isError?: boolean };
    /** Nhiều tin IMAGE liên tiếp (web gửi từng ảnh một) — `message` là tin mới nhất trong nhóm */
    imageGroupMessages?: MessageDynamo[];
    isMe: boolean;
    showSenderName?: boolean; // for group chats
    onLongPress?: (message: MessageDynamo, attachment?: any) => void;
    onPress?: (message: MessageDynamo) => void;
    onPressReactions?: (message: MessageDynamo) => void;
    onImagePress?: (imageUrl: string) => void;
    onForward?: (message: MessageDynamo) => void;
    onRecall?: (message: MessageDynamo) => void;
    onDelete?: (message: MessageDynamo) => void;
    onReply?: (message: MessageDynamo) => void;
    onTogglePin?: (message: MessageDynamo) => void;
    replyPreview?: ReplyPreview | null;
    senderAvatarUrl?: string | null;
    partnerName?: string;
    onAddFriend?: () => void;
    /** Nhấn từ màn tìm kiếm tin nhắn — viền vàng quanh bubble */
    isSearchHighlight?: boolean;
    /** Làm nổi tin nhắn của trưởng/phó nhóm (user setting local). */
    isAdminHighlight?: boolean;
    /** SYSTEM: bấm "Xem" để cuộn tới tin nhắn liên quan (vd: poll). */
    onScrollToMessageId?: (messageId: string) => void;
    
    // --- Read Receipt Props ---
    isLastMyMessage?: boolean;
    readByIds?: string[];
    participants?: any[];
    isGroup?: boolean;
    onShowReadReceipts?: (message: MessageDynamo) => void;
    onStoryPress?: (story: { storyId?: string; authorId?: string; payload?: string }) => void;
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
    imageGroupMessages,
    isMe,
    showSenderName,
    onLongPress,
    onPress,
    onPressReactions,
    onImagePress,
    onForward,
    onRecall,
    onDelete,
    onReply,
    onTogglePin,
    replyPreview,
    senderAvatarUrl,
    partnerName,
    onAddFriend,
    isSearchHighlight,
    isAdminHighlight,
    onScrollToMessageId,
    isLastMyMessage,
    readByIds,
    participants,
    isGroup,
    onShowReadReceipts,
    onStoryPress,
}: MessageBubbleProps) {
    const colors = useThemeColors();
    const theme = useThemeStore(s => s.theme);
    const senderName = message.senderName;
    const isRecalled = message.recalled;
    const isError = message.isError;
    const time =
        message.createdAt && !isNaN(Date.parse(message.createdAt))
            ? formatTime(message.createdAt)
            : "";

    const [previewIndex, setPreviewIndex] = useState<number | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const galleryRef = useRef<FlatList>(null);
    const [pressedImageIndex, setPressedImageIndex] = useState<number | null>(null);
    const [showControls, setShowControls] = useState(true);
    const controlsOpacity = useRef(new Animated.Value(1)).current;
    const [imgOptionsVisible, setImgOptionsVisible] = useState(false);

    // Video states
    const [previewVideoIndex, setPreviewVideoIndex] = useState<number | null>(null);
    const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
    const videoGalleryRef = useRef<FlatList>(null);
    const [pressedVideoIndex, setPressedVideoIndex] = useState<number | null>(null);
    const [videoOptionsVisible, setVideoOptionsVisible] = useState(false);

    // File states
    const [selectedFile, setSelectedFile] = useState<any>(null);
    const [filePreviewVisible, setFilePreviewVisible] = useState(false);

    // Đóng chế độ xem nếu tin nhắn bị thu hồi từ bên ngoài (realtime)
    React.useEffect(() => {
        if (message.recalled) {
            if (previewIndex !== null) {
                setPreviewIndex(null);
                setImgOptionsVisible(false);
            }
            if (previewVideoIndex !== null) {
                setPreviewVideoIndex(null);
                setVideoOptionsVisible(false);
            }
        }
    }, [message.recalled, previewIndex, previewVideoIndex]);

    const toggleControls = useCallback(() => {
        const toValue = showControls ? 0 : 1;
        Animated.timing(controlsOpacity, { toValue, duration: 200, useNativeDriver: true }).start();
        setShowControls(v => !v);
    }, [showControls, controlsOpacity]);

    const getTimeAgo = (dateStr: string): string => {
        if (!dateStr) return "";
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        const hours = Math.floor(mins / 60);
        const days = Math.floor(hours / 24);
        if (days > 0) return `${days} ngày trước`;
        if (hours > 0) return `${hours} giờ trước`;
        if (mins > 0) return `${mins} phút trước`;
        return "Vừa xong";
    };

    const [toastMsg, setToastMsg] = useState<string | null>(null);
    const toastOpacity = useRef(new Animated.Value(0)).current;

    const showToast = useCallback((msg: string) => {
        setToastMsg(msg);
        Animated.sequence([
            Animated.timing(toastOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.delay(1800),
            Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start(() => setToastMsg(null));
    }, [toastOpacity]);

    const handleDownload = async (url: string | undefined, originalFileName?: string) => {
        if (!url) {
            Alert.alert("Lỗi", "Đường dẫn không hợp lệ.");
            return;
        }
        try {
            const finalUrl = getImageUrl(url);
            const extension = finalUrl.split(".").pop()?.split("?")[0]?.toLowerCase() || "";
            const isMedia = ["jpg", "jpeg", "png", "gif", "mp4", "mov"].includes(extension);

            const filename = originalFileName || `file_${Date.now()}.${extension}`;
            const localUri = `${cacheDirectory}${filename}`;

            showToast("Đang tải xuống...");
            const downloadRes = await downloadAsync(finalUrl, localUri);
            if (!downloadRes) throw new Error("Download failed: No response");
            console.log("Download success:", downloadRes.uri);

            if (isMedia) {
                const { status } = await MediaLibrary.requestPermissionsAsync();
                if (status === "granted") {
                    await MediaLibrary.saveToLibraryAsync(downloadRes.uri);
                    showToast("Đã lưu vào bộ sưu tập!");
                } else {
                    await Sharing.shareAsync(downloadRes.uri);
                }
            } else {
                // IMPORTANT: For files like .docx, .pdf, we open the share sheet.
                // The user MUST select "Save to Files" (Lưu vào tệp) for it to appear in the Files app.
                showToast("Chọn 'Lưu vào Tệp' từ menu hiện ra");
                await Sharing.shareAsync(downloadRes.uri, {
                    dialogTitle: "Tải file về máy"
                });
            }
        } catch (e) {
            console.error("Error downloading:", e);
            Alert.alert("Lỗi", "Không thể tải file. Thử lại sau.");
        }
    };

    const handleShare = async (url: string, originalFileName?: string) => {
        try {
            const isAvailable = await Sharing.isAvailableAsync();
            const extension = url.split(".").pop()?.split("?")[0] || "jpg";
            const filename = originalFileName || `share_${Date.now()}.${extension}`;
            const localUri = `${documentDirectory}${filename}`;
            const downloadRes = await downloadAsync(url, localUri);
            if (!downloadRes) throw new Error("Download for share failed");
            if (isAvailable) {
                await Sharing.shareAsync(localUri);
            } else {
                await Share.share({ url });
            }
        } catch {
            showToast("Không thể chia sẻ ảnh.");
        }
    };

    const handleCopyImage = async (url: string, originalFileName?: string) => {
        // Close options immediately
        setImgOptionsVisible(false);

        try {
            const finalUrl = getImageUrl(url);
            // Create a stable filename for better caching (use ID or part of URL)
            const urlHash = url.split('/').pop()?.split('?')[0] || `img_temp`;
            const extension = finalUrl.split(".").pop()?.split("?")[0]?.toLowerCase() || "jpg";
            const filename = originalFileName || `cache_${urlHash}.${extension}`;
            const localUri = `${cacheDirectory}${filename}`;

            showToast("Đang chuẩn bị ảnh...");

            // ─── OPTIMIZE CACHE: Check if file already exists ───
            const info = await FileSystem.getInfoAsync(localUri);
            let targetUri = localUri;

            if (!info.exists) {
                const downloadRes = await downloadAsync(finalUrl, localUri);
                if (!downloadRes) throw new Error("Download for copy failed");
                targetUri = downloadRes.uri;
            }

            const base64 = await readAsStringAsync(targetUri, { encoding: EncodingType.Base64 });
            await Clipboard.setImageAsync(base64);
            showToast("Đã sao chép hình ảnh!");
        } catch (e) {
            console.error("Copy image failed:", e);
            await Clipboard.setStringAsync(getImageUrl(url));
            showToast("Đã sao chép liên kết ảnh!");
        }
    };

    const handleFileView = async (url: string | undefined, originalFileName?: string) => {
        if (!url) return;
        try {
            const finalUrl = getImageUrl(url);
            showToast("Đang chuẩn bị mở...");

            const extension = finalUrl.split(".").pop()?.split("?")[0]?.toLowerCase() || "";
            const filename = originalFileName || `view_${Date.now()}.${extension}`;
            const localUri = `${cacheDirectory}${filename}`;

            const downloadRes = await downloadAsync(finalUrl, localUri);
            if (!downloadRes) throw new Error("View download failed: No response");
            console.log("View Download success:", downloadRes.uri);

            await Sharing.shareAsync(downloadRes.uri, {
                dialogTitle: "Xem nội dung file"
            });
        } catch (e) {
            console.error("View error:", e);
            Alert.alert("Lỗi", "Không thể mở file. Vui lòng kiểm tra lại kết nối mạng hoặc ứng dụng đọc file.");
            // Linking.openURL(getImageUrl(url)); // Optional: fallback to browser
        }
    };

    const handlePress = () => {
        if (onPress) {
            onPress(message);
        }
    };

    const getFileIconInfo = (filename: string) => {
        const ext = filename.split(".").pop()?.toLowerCase() || "";
        switch (ext) {
            case "pdf":
                return { icon: "document-text-outline" as const, color: "#ff453a", label: "PDF" };
            case "doc":
            case "docx":
                return { icon: "document-outline" as const, color: "#007aff", label: "WORD" };
            case "xls":
            case "xlsx":
                return { icon: "grid-outline" as const, color: "#34c759", label: "EXCEL" };
            case "ppt":
            case "pptx":
                return { icon: "easel-outline" as const, color: "#ff9500", label: "POWERPOINT" };
            case "zip":
            case "rar":
            case "7z":
                return { icon: "archive-outline" as const, color: "#af52de", label: "COMPRESS" };
            case "mp3":
            case "wav":
            case "m4a":
                return { icon: "musical-notes-outline" as const, color: "#5856d6", label: "AUDIO" };
            case "txt":
                return { icon: "document-text-outline" as const, color: "#8e8e93", label: "TEXT" };
            default:
                return { icon: "document-outline" as const, color: colors.primary, label: "FILE" };
        }
    };



    const imageAttachments = (message.attachments || []).filter((a) => isImageAttachment(a));
    const videoAttachments = (message.attachments || []).filter((a) => isVideoAttachment(a));
    const allFiles = (message.attachments || []).filter(
        (a) => !isImageAttachment(a) && !isVideoAttachment(a),
    );
    const audioAttachments = allFiles.filter((a) => {
        const ext = (a.filename || a.name || "").split('.').pop()?.toLowerCase() || "";
        return ["m4a", "mp3", "wav", "webm", "ogg", "aac"].includes(ext) || (a.type || "").startsWith("audio/");
    });
    const fileAttachments = allFiles.filter((a) => !audioAttachments.includes(a));


    const burstImagePairs = useMemo(() => {
        if (!imageGroupMessages || imageGroupMessages.length < 2) return null;
        const chronological = [...imageGroupMessages].reverse();
        const pairs: { msg: MessageDynamo; att: Attachment }[] = [];
        for (const m of chronological) {
            const imgs = (m.attachments || []).filter((a) => isImageAttachment(a));
            if (imgs[0]) pairs.push({ msg: m, att: imgs[0] });
        }
        return pairs.length >= 2 ? pairs : null;
    }, [imageGroupMessages]);

    const imageCells = useMemo((): { msg: MessageDynamo; att: Attachment }[] => {
        if (burstImagePairs && burstImagePairs.length >= 2) return burstImagePairs;
        return imageAttachments.map((att) => ({ msg: message, att }));
    }, [burstImagePairs, imageAttachments, message]);

    const hasImages = imageCells.length > 0 && !isRecalled;
    const hasVideos = videoAttachments.length > 0 && !isRecalled;
    const hasFiles = fileAttachments.length > 0 && !isRecalled;
    const hasAudioFiles = audioAttachments.length > 0 && !isRecalled;
    const hasText = !!message.content && !isRecalled;
    const hideFilenameCaption =
        !!imageGroupMessages && imageGroupMessages.length >= 2;
    /** Gộp nhóm ảnh từ web: ẩn chuỗi tên file xuống dưới — coi như chỉ ảnh để bo bubble đúng */
    const layoutHasText = hasText && !hideFilenameCaption;

    let isCallMessage = false;
    let callData: {
        status?: string;
        duration?: number;
        callType?: string;
        callerId?: string;
        receiverId?: string;
        callSessionId?: string;
        conversationId?: string;
        isGroupCall?: boolean;
    } = {};
    if (hasText && message.content && message.content.trim().startsWith('{') && message.content.includes('"callType":')) {
        try {
            const parsed = JSON.parse(message.content);
            if (parsed.status && parsed.callType) {
                isCallMessage = true;
                callData = parsed;
            }
        } catch { }
    }
    if (message.type === "CALL_VOICE" || message.type === "CALL_VIDEO") {
        isCallMessage = true;
    }

    const isMediaOnly = (hasImages || hasVideos || hasFiles || hasAudioFiles) && !layoutHasText && !isRecalled && !isCallMessage;
    const bubbleBackground = isRecalled
        ? (theme === 'dark' ? "#1c1c1e" : "#e5e5ea")
        : (isMediaOnly
            ? "transparent"
            : (isMe ? colors.primary : (theme === 'dark' ? "#2c2c2e" : "#ffffff")));

    const partnerTextColor = theme === 'dark' ? colors.text : "#000000";
    const myTextColor = "#ffffff";
    const textColor = isMe ? myTextColor : partnerTextColor;
    const recalledTextColor = theme === 'dark' ? "#8e8e93" : "#6e6e73";

    const handleLongPress = (attachment?: any) => {
        // Tin nhắn cuộc gọi: không cho thao tác ghim/chia sẻ/trả lời/copy/thu hồi/xóa phía tôi
        if (isCallMessage) return;
        if (onLongPress) {
            onLongPress(message, attachment);
        }
    };
    const effectiveType = (message.type === "TEXT" && isGroupActionSystemText(message.content))
        ? "SYSTEM"
        : message.type;

    const hl = !!isSearchHighlight;

    if (effectiveType === "POLL") {
        const pid = String(message.content || "").trim();
        const rid = String(message.chatRoomId || "").trim();
        return (
            <View style={{ paddingHorizontal: 10, paddingVertical: 6, width: "100%", alignItems: "center" }}>
                <Pressable
                    onLongPress={() => handleLongPress()}
                    delayLongPress={250}
                    style={{ width: "100%", alignItems: "center" }}
                >
                    <PollBubbleMobile pollId={pid} roomId={rid} />
                </Pressable>
            </View>
        );
    }

    // STORY_QUOTE — render bubble đặc biệt
    if (
        !isRecalled &&
        (message.type === "TEXT" || message.type === "STORY_REPLY") &&
        message.content &&
        message.content.trimStart().startsWith('{"type":"STORY_QUOTE"')
    ) {
        return (
            <StoryReplyBubble
                content={message.content}
                isMe={isMe}
                time={time}
                colors={colors}
                theme={theme}
                onLongPress={() => onLongPress?.(message)}
                onPressStory={onStoryPress}
            />
        );
    }

    return (
        <View
            style={{
                paddingHorizontal: 12,
                paddingVertical: 2,
                alignItems: isMe ? "flex-end" : "flex-start",
                ...(hl
                    ? {
                        borderWidth: 3,
                        borderColor: "#facc15",
                        borderRadius: 20,
                        marginVertical: 4,
                        backgroundColor: "rgba(254, 240, 138, 0.35)",
                    }
                    : {}),
            }}
        >
            {effectiveType === "SYSTEM" ? (
                (() => {
                    const raw = getSystemDisplayContent(message);
                    const canView =
                        !!message.replyToMessageId &&
                        isPollSystemMessageText(raw) &&
                        typeof onScrollToMessageId === "function";

                    return (
                        <View
                            style={{
                                alignSelf: "center",
                                backgroundColor: "rgba(16, 185, 129, 0.10)",
                                paddingHorizontal: 12,
                                paddingVertical: 7,
                                borderRadius: 999,
                                marginVertical: 4,
                                flexDirection: "row",
                                alignItems: "center",
                                maxWidth: "92%",
                            }}
                        >
                            <Ionicons
                                name="stats-chart-outline"
                                size={14}
                                color="#10b981"
                                style={{ marginRight: 6 }}
                            />
                            <Text
                                style={{
                                    fontSize: 12.8,
                                    color: colors.textSecondary,
                                    flexShrink: 1,
                                    fontWeight: "600",
                                }}
                                numberOfLines={2}
                            >
                                {raw}
                            </Text>
                            {canView ? (
                                <TouchableOpacity
                                    onPress={() => onScrollToMessageId?.(message.replyToMessageId)}
                                    style={{ marginLeft: 8 }}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Text
                                        style={{
                                            color: colors.primary,
                                            fontWeight: "800",
                                            fontSize: 12.8,
                                        }}
                                    >
                                        Xem
                                    </Text>
                                </TouchableOpacity>
                            ) : null}
                        </View>
                    );
                })()
            ) : (
                <TouchableOpacity
                    activeOpacity={0.8}
                    delayLongPress={250}
                    onPress={handlePress}
                    onLongPress={handleLongPress}
                >
                    {/* Bubble */}
                    <View
                        style={{
                            maxWidth: SCREEN_WIDTH * 0.75,
                            backgroundColor: bubbleBackground,
                            borderRadius: 16,
                            padding: ((hasImages || hasVideos) && !layoutHasText) ? 0 : 12, // Ensure padding for recalled messages
                            borderWidth: 1,
                            borderColor: isRecalled ? (theme === 'dark' ? "#3a3a3c" : "#d1d1d6") : (isMe ? "transparent" : colors.border),
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
                                    borderLeftColor: isMe ? "rgba(255,255,255,0.6)" : colors.primary,
                                    backgroundColor: isMe ? "rgba(255,255,255,0.1)" : colors.background,
                                    borderRadius: 6,
                                }}
                            >
                                {replyPreview.senderName && (
                                    <Text
                                        style={{
                                            color: isMe ? "rgba(255,255,255,0.7)" : colors.textSecondary,
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
                                        color: isMe ? "rgba(255,255,255,0.9)" : colors.text,
                                        fontSize: 11,
                                    }}
                                >
                                    {replyPreview.content}
                                </Text>
                            </View>
                        )}

                        {/* Tên người gửi trong group */}
                        {showSenderName && !isMe && senderName && (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 2, paddingHorizontal: 12, paddingTop: hasImages ? 8 : 0 }}>
                                <Text
                                    style={{
                                        fontSize: 12,
                                        color: getNameColor(senderName),
                                        fontWeight: "700",
                                    }}
                                >
                                    {senderName}
                                </Text>
                                {isAdminHighlight ? (
                                    <View style={{ paddingHorizontal: 5, paddingVertical: 1, borderRadius: 8, backgroundColor: "rgba(250, 204, 21, 0.18)" }}>
                                        <Ionicons name="sparkles" size={10} color="#f59e0b" />
                                    </View>
                                ) : null}
                            </View>
                        )}

                        {/* Image attachments */}
                        {hasImages && (() => {
                            const count = imageCells.length;
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
                                    {imageCells.map(({ msg: srcMsg, att }, idx) => {
                                        const isPressed = pressedImageIndex === idx;
                                        const borderRadius = isSingle ? (layoutHasText ? 0 : 16) : 4;
                                        const extraRadius = isSingle && isMe && !layoutHasText
                                            ? { borderBottomRightRadius: 4 }
                                            : isSingle && !isMe && !layoutHasText
                                                ? { borderBottomLeftRadius: 4 }
                                                : {};
                                        return (
                                            <TouchableOpacity
                                                key={`${srcMsg.messageId}-${idx}`}
                                                activeOpacity={1}
                                                delayLongPress={250}
                                                onPressIn={() => setPressedImageIndex(idx)}
                                                onPressOut={() => setPressedImageIndex(null)}
                                                onLongPress={() => {
                                                    onLongPress?.(srcMsg, att);
                                                    setTimeout(() => setPressedImageIndex(null), 500);
                                                }}
                                                onPress={() => {
                                                    setPressedImageIndex(null);
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
                                                {/* Image + overlay khi nhấn giữ */}
                                                <View style={{
                                                    width: thumbSize,
                                                    height: thumbSize,
                                                    borderRadius,
                                                    overflow: "hidden",
                                                    backgroundColor: "rgba(0,0,0,0.05)",
                                                    ...extraRadius,
                                                }}>
                                                    <Image
                                                        source={{ uri: getImageUrl(att.url) }}
                                                        style={{
                                                            width: thumbSize,
                                                            height: thumbSize,
                                                        }}
                                                        resizeMode="cover"
                                                    // Image load error
                                                    />
                                                    {/* Overlay khi đang nhấn giữ */}
                                                    {isPressed && (
                                                        <View
                                                            style={{
                                                                position: "absolute",
                                                                top: 0,
                                                                left: 0,
                                                                width: thumbSize,
                                                                height: thumbSize,
                                                                borderRadius,
                                                                ...extraRadius,
                                                                backgroundColor: "rgba(0, 0, 0, 0.35)",
                                                                justifyContent: "center",
                                                                alignItems: "center",
                                                            }}
                                                        >
                                                            <Ionicons name="checkmark-circle" size={28} color="rgba(255,255,255,0.9)" />
                                                        </View>
                                                    )}
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            );
                        })()}

                        {/* Video attachments */}
                        {hasVideos && (() => {
                            const count = videoAttachments.length;
                            const isSingle = count === 1;
                            const GRID_COLS = isSingle ? 1 : count <= 2 ? 2 : count <= 3 ? 3 : 4;
                            const gap = 2;
                            const maxBubbleWidth = SCREEN_WIDTH * 0.65;
                            const thumbSize = isSingle
                                ? SCREEN_WIDTH * 0.55
                                : Math.floor((maxBubbleWidth - gap * (GRID_COLS - 1)) / GRID_COLS);
                            const gridWidth = isSingle
                                ? undefined
                                : thumbSize * GRID_COLS + gap * (GRID_COLS - 1) + 4;

                            return (
                                <View style={isSingle ? {
                                    width: SCREEN_WIDTH * 0.7,
                                    backgroundColor: "transparent",
                                    borderRadius: 16,
                                    overflow: "hidden",
                                    marginBottom: layoutHasText ? 8 : 0,
                                } : {
                                    flexDirection: "row",
                                    flexWrap: "wrap",
                                    width: gridWidth,
                                    padding: 2,
                                }}>
                                    {videoAttachments.map((att, idx) => {
                                        const isPressed = pressedVideoIndex === idx;
                                        const borderRadius = isSingle ? 0 : 4;
                                        const vSize = isSingle ? SCREEN_WIDTH * 0.7 : thumbSize;
                                        const vHeight = isSingle ? 180 : thumbSize;

                                        return (
                                            <View key={`vid-${idx}`} style={{ marginBottom: isSingle ? 0 : gap }}>
                                                <TouchableOpacity
                                                    activeOpacity={1}
                                                    delayLongPress={250}
                                                    onPressIn={() => setPressedVideoIndex(idx)}
                                                    onPressOut={() => setPressedVideoIndex(null)}
                                                    onLongPress={() => {
                                                        handleLongPress(att);
                                                        setTimeout(() => setPressedVideoIndex(null), 500);
                                                    }}
                                                    onPress={() => {
                                                        setPressedVideoIndex(null);
                                                        const resolved = getImageUrl(att.url);
                                                        if (onImagePress) {
                                                            onImagePress(resolved);
                                                        } else {
                                                            setPreviewVideoIndex(idx);
                                                            setCurrentVideoIndex(idx);
                                                        }
                                                    }}
                                                    style={isSingle ? undefined : {
                                                        marginRight: (idx + 1) % GRID_COLS === 0 ? 0 : gap,
                                                    }}
                                                >
                                                    <View style={{ position: "relative" }}>
                                                        <Video
                                                            source={{ uri: getImageUrl(att.url) }}
                                                            style={{
                                                                width: vSize,
                                                                height: vHeight,
                                                                borderRadius: borderRadius,
                                                            }}
                                                            resizeMode={ResizeMode.COVER}
                                                            shouldPlay={false}
                                                            isMuted={true}
                                                            isLooping={false}
                                                        />
                                                        {/* Central Play Icon */}
                                                        <View style={{
                                                            position: "absolute",
                                                            top: 0, left: 0, right: 0, bottom: 0,
                                                            justifyContent: "center",
                                                            alignItems: "center",
                                                        }}>
                                                            <View style={{
                                                                width: 44, height: 44, borderRadius: 22,
                                                                backgroundColor: "rgba(0,0,0,0.4)",
                                                                justifyContent: "center", alignItems: "center",
                                                                borderWidth: 1, borderColor: "rgba(255,255,255,0.3)",
                                                            }}>
                                                                <Ionicons name="play" size={24} color="#fff" style={{ marginLeft: 3 }} />
                                                            </View>
                                                        </View>

                                                        {/* Overlay when pressed */}
                                                        {isPressed && (
                                                            <View
                                                                style={{
                                                                    position: "absolute",
                                                                    top: 0, left: 0, right: 0, bottom: 0,
                                                                    backgroundColor: "rgba(0,0,0,0.35)",
                                                                    justifyContent: "center",
                                                                    alignItems: "center",
                                                                    borderRadius: borderRadius,
                                                                }}
                                                            >
                                                                <Ionicons name="checkmark-circle" size={28} color="rgba(255,255,255,0.9)" />
                                                            </View>
                                                        )}
                                                    </View>
                                                </TouchableOpacity>

                                                {/* Single Video Footer (Style matching File Bubble) */}
                                                {isSingle && (
                                                    <View style={{
                                                        flexDirection: "row",
                                                        alignItems: "center",
                                                        padding: 12,
                                                        backgroundColor: "rgba(0,0,0,0.8)", // Darker like the image
                                                    }}>
                                                        <View style={{
                                                            width: 36,
                                                            height: 36,
                                                            backgroundColor: "#5856d6",
                                                            borderRadius: 8,
                                                            justifyContent: "center",
                                                            alignItems: "center",
                                                            marginRight: 12,
                                                        }}>
                                                            <Ionicons name="videocam" size={20} color="#fff" />
                                                        </View>
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={{
                                                                color: "#fff",
                                                                fontSize: 14,
                                                                fontWeight: "600",
                                                            }} numberOfLines={1}>
                                                                Video
                                                            </Text>
                                                            <Text style={{
                                                                color: "rgba(255,255,255,0.6)",
                                                                fontSize: 12,
                                                            }}>
                                                                Chạm để xem chi tiết
                                                            </Text>
                                                        </View>
                                                    </View>
                                                )}
                                            </View>
                                        );
                                    })}
                                </View>
                            );
                        })()}

                        {/* Audio attachments */}
                        {hasAudioFiles && (
                            <View style={{ marginTop: (hasImages || hasVideos) ? 8 : 0 }}>
                                {audioAttachments.map((att, idx) => (
                                    <View key={`audio-${idx}`} style={{ marginBottom: idx === audioAttachments.length - 1 ? 0 : 8 }}>
                                        <AudioMessageItem url={getImageUrl(att.url)} isMe={isMe} />
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* File attachments */}
                        {hasFiles && (
                            <View style={{ marginTop: (hasImages || hasVideos) ? 8 : 0 }}>
                                {fileAttachments.map((att, idx) => {
                                    const rawName = att.name || att.filename || "Tệp đính kèm";
                                    const fileName = decodeURIComponent(rawName);
                                    const fileSize = att.size ? formatFileSize(att.size) : "";
                                    const { icon, color, label } = getFileIconInfo(fileName);
                                    const isPDF = label === "PDF";

                                    return (
                                        <TouchableOpacity
                                            key={idx}
                                            activeOpacity={0.9}
                                            delayLongPress={250}
                                            onLongPress={handleLongPress}
                                            onPress={() => {
                                                setSelectedFile({ ...att, fileName, icon, color, label });
                                                setFilePreviewVisible(true);
                                            }}
                                            style={{
                                                width: SCREEN_WIDTH * 0.7,
                                                backgroundColor: "transparent",
                                                borderRadius: 16,
                                                overflow: "hidden",
                                                marginBottom: idx === fileAttachments.length - 1 ? 0 : 8,
                                            }}
                                        >
                                            {/* Top Preview Area (Thumbnail) */}
                                            <View style={{
                                                height: 120,
                                                backgroundColor: theme === 'dark' ? "#1c1c1e" : "#f8f9fa",
                                                justifyContent: "center",
                                                alignItems: "center",
                                                padding: 10,
                                            }}>
                                                {/* Giả lập trang tài liệu với nội dung mờ */}
                                                <View style={{
                                                    width: "80%",
                                                    height: "90%",
                                                    backgroundColor: theme === 'dark' ? "#2c2c2e" : "#fff",
                                                    borderRadius: 2,
                                                    padding: 10,
                                                    borderWidth: theme === 'dark' ? 0.5 : 0,
                                                    borderColor: "rgba(255,255,255,0.1)",
                                                    shadowColor: "#000",
                                                    shadowOffset: { width: 0, height: 2 },
                                                    shadowOpacity: 0.1,
                                                    shadowRadius: 3,
                                                    elevation: 2,
                                                }}>
                                                    <View style={{ width: "40%", height: 3, backgroundColor: theme === 'dark' ? "#3a3a3c" : "#eee", marginBottom: 6 }} />
                                                    <View style={{ width: "90%", height: 2, backgroundColor: theme === 'dark' ? "#3a3a3c" : "#f5f5f5", marginBottom: 4 }} />
                                                    <View style={{ width: "85%", height: 2, backgroundColor: theme === 'dark' ? "#3a3a3c" : "#f5f5f5", marginBottom: 4 }} />
                                                    <View style={{ width: "95%", height: 2, backgroundColor: theme === 'dark' ? "#3a3a3c" : "#f5f5f5", marginBottom: 4 }} />
                                                    <View style={{ position: "absolute", bottom: 10, right: 10 }}>
                                                        <Ionicons name={icon} size={20} color={color + "30"} />
                                                    </View>
                                                </View>
                                            </View>

                                            {/* Bottom Info Bar */}
                                            <View style={{
                                                flexDirection: "row",
                                                alignItems: "center",
                                                padding: 12,
                                                backgroundColor: "rgba(0,0,0,0.8)", // Darker like the image
                                            }}>
                                                <View style={{
                                                    width: 40,
                                                    height: 48,
                                                    backgroundColor: color,
                                                    borderRadius: 6,
                                                    justifyContent: "center",
                                                    alignItems: "center",
                                                    marginRight: 12,
                                                }}>
                                                    <Ionicons name={icon} size={20} color="#fff" />
                                                    <Text style={{ color: "#fff", fontSize: 8, fontWeight: "bold", marginTop: 2 }}>{label}</Text>
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text
                                                        numberOfLines={1}
                                                        ellipsizeMode="middle"
                                                        style={{
                                                            color: "#fff",
                                                            fontSize: 14,
                                                            fontWeight: "600",
                                                        }}
                                                    >
                                                        {fileName}
                                                    </Text>
                                                    <Text style={{
                                                        color: "rgba(255,255,255,0.6)",
                                                        fontSize: 12,
                                                        marginTop: 2,
                                                    }}>
                                                        {label} · {fileSize || "Không rõ"}
                                                    </Text>
                                                </View>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}

                        {/* Call message bubble */}
                        {isCallMessage && !isRecalled && (
                            <View style={{ paddingHorizontal: 8, paddingVertical: 1 }}>
                                {(() => {
                                    const isVideo = callData.callType === 'VIDEO';
                                    const status = String(callData.status || '').toUpperCase();
                                    const dur = callData.duration || 0;
                                    const isGroup = !!callData.isGroupCall;
                                    // GROUP CALL đã kết thúc → ẩn nút "Tham gia", chỉ hiện duration + "Đã kết thúc"
                                    // (1 bubble duy nhất, state STARTED → ENDED update tại chỗ).
                                    const isFinalStatus =
                                        status === 'ENDED' ||
                                        status === 'MISSED' ||
                                        status === 'CANCELLED' ||
                                        status === 'REJECTED';
                                    const groupEnded = isGroup && isFinalStatus;

                                    let detailText = '';
                                    let iconName: any = isVideo ? 'videocam' : 'call';
                                    let iconColor = '#007AFF';

                                    if (status === 'ENDED') {
                                        if (dur > 0) {
                                            const m = Math.floor(dur / 60);
                                            const s = dur % 60;
                                            detailText = m > 0 ? `${m} phút ${s} giây` : `${s} giây`;
                                        } else {
                                            detailText = '';
                                        }
                                        iconName = isMe ? 'call-outline' : 'call';
                                        iconColor = '#34C759';
                                    } else if (status === 'MISSED') {
                                        detailText = isGroup ? 'Không có ai tham gia' : (isMe ? 'Không trả lời' : 'Cuộc gọi nhỡ');
                                        iconName = 'call';
                                        iconColor = '#FF3B30';
                                    } else if (status === 'REJECTED' || status === 'CANCELLED') {
                                        detailText = isGroup ? 'Không có ai tham gia' : (isMe ? 'Đã hủy' : 'Cuộc gọi nhỡ');
                                        iconName = 'call';
                                        iconColor = '#FF3B30';
                                    }

                                    const titleText = isGroup
                                        ? (isVideo ? 'Cuộc gọi nhóm video' : 'Cuộc gọi nhóm thoại')
                                        : (isVideo ? 'Cuộc gọi video' : 'Cuộc gọi thoại');

                                    return (
                                        <>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                                                <View style={{
                                                    width: 30, height: 30, borderRadius: 15,
                                                    backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : '#F2F2F7',
                                                    justifyContent: 'center', alignItems: 'center',
                                                }}>
                                                    <Ionicons name={iconName} size={15} color={iconColor} />
                                                </View>
                                                <View>
                                                    <Text style={{ fontWeight: '700', fontSize: 13, color: textColor }}>{titleText}</Text>
                                                    {status === 'ENDED' && !!detailText && (
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                                            <Ionicons name={isMe ? 'arrow-up' : 'arrow-down'} size={12} color={iconColor} />
                                                            <Text style={{ fontSize: 12, color: isMe ? 'rgba(255,255,255,0.7)' : '#8E8E93' }}>{detailText}</Text>
                                                        </View>
                                                    )}
                                                    {(status === 'MISSED' || status === 'REJECTED' || status === 'CANCELLED') && !!detailText && (
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                                            <Ionicons name="close-circle" size={12} color="#FF3B30" />
                                                            <Text style={{ fontSize: 12, color: isMe ? 'rgba(255,255,255,0.7)' : '#8E8E93' }}>{detailText}</Text>
                                                        </View>
                                                    )}
                                                    {groupEnded && (
                                                        <Text style={{ fontSize: 12, color: isMe ? 'rgba(231, 9, 9, 0.9)' : '#8E8E93', marginTop: 2 }}>
                                                            Đã kết thúc
                                                        </Text>
                                                    )}
                                                </View>
                                            </View>
                                            {/*
                                              - GROUP đã kết thúc: không render nút (đúng mockup Zalo).
                                              - GROUP đang gọi: "Tham gia".
                                              - 1-1: giữ nguyên "Gọi lại".
                                            */}
                                            {!groupEnded && (
                                                <>
                                                    <View style={{ height: 1, backgroundColor: isMe ? 'rgba(255,255,255,0.15)' : '#E5E5EA', marginBottom: 4 }} />
                                                    <TouchableOpacity
                                                        style={{ alignItems: 'center', paddingVertical: 2 }}
                                                        onPress={() => {
                                                            const { useCallStore } = require('@/shared/store/useCallStore');
                                                            if (isGroup) {
                                                                const callSessionId = callData.callSessionId;
                                                                if (!callSessionId) return;
                                                                useCallStore.getState().joinGroupCall(callSessionId);
                                                                return;
                                                            }

                                                            const receiverId = isMe ? callData.receiverId : callData.callerId;
                                                            if (receiverId) {
                                                                useCallStore.getState().initiateCall(
                                                                    message.chatRoomId,
                                                                    receiverId,
                                                                    callData.callType || 'VOICE'
                                                                );
                                                            }
                                                        }}
                                                    >
                                                        <Text style={{ color: isMe ? '#fff' : '#007AFF', fontWeight: '600', fontSize: 12 }}>
                                                            {isGroup ? 'Tham gia' : 'Gọi lại'}
                                                        </Text>
                                                    </TouchableOpacity>
                                                </>
                                            )}
                                        </>
                                    );
                                })()}
                            </View>
                        )}

                        {/* Text content with Link Detection */}
                        {(hasText && !isCallMessage || isRecalled) && !hideFilenameCaption && (
                            <View style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
                                {isRecalled ? (
                                    <Text
                                        style={{
                                            color: recalledTextColor,
                                            fontSize: 15,
                                            lineHeight: 20,
                                            fontStyle: "italic",
                                        }}
                                    >
                                        Tin nhắn đã được thu hồi
                                    </Text>
                                ) : (
                                    <LinkableText
                                        text={message.content || ""}
                                        style={{
                                            color: textColor,
                                            fontSize: 15,
                                            lineHeight: 22,
                                        }}
                                    />
                                )}
                            </View>
                        )
                        }

                        {/* Link Preview (Simple implementation) */}
                        {
                            !hideFilenameCaption && !isRecalled && hasText && message.content?.match(/https?:\/\/[^\s]+/) && (
                                <LinkPreview url={message.content.match(/https?:\/\/[^\s]+/)?.[0] || ""} isMe={isMe} />
                            )
                        }

                        {/* Time */}
                        {
                            time && !isError ? (
                                <View
                                    style={{
                                        alignSelf: "flex-end",
                                        paddingHorizontal: isMediaOnly ? 6 : 12,
                                        paddingVertical: isMediaOnly ? 2 : 0,
                                        paddingBottom: isMediaOnly ? 4 : 6,
                                        marginRight: isMediaOnly ? 8 : 0,
                                        marginBottom: isMediaOnly ? 8 : 0,
                                        backgroundColor: isMediaOnly ? "rgba(0,0,0,0.4)" : "transparent",
                                        borderRadius: 10,
                                        marginTop: (hasImages || hasVideos) && !layoutHasText ? (isMediaOnly ? -24 : 4) : 0,
                                        zIndex: 5,
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontSize: 10,
                                            color: isRecalled
                                                ? colors.textSecondary
                                                : (isMediaOnly
                                                    ? "#ffffff"
                                                    : (isMe ? "rgba(255,255,255,0.7)" : colors.textSecondary)),
                                            textAlign: "right",
                                        }}
                                    >
                                        {time}
                                    </Text>
                                </View>
                            ) : null
                        }
                    </View >

                    {/* Error message */}
                    {
                        isError && (
                            <Text
                                style={{
                                    color: "#e74c3c", // Red color
                                    fontSize: 11,
                                    marginTop: 4,
                                    alignSelf: isMe ? "flex-end" : "flex-start",
                                }}
                            >
                                Không gửi được
                            </Text>
                        )
                    }

                    {/* Reactions */}
                    {
                        Array.isArray(message.reactions) && message.reactions.length > 0 && !isRecalled && (
                            <TouchableOpacity
                                onPress={() => onPressReactions?.(message)}
                                activeOpacity={0.8}
                                style={{
                                    flexDirection: "row",
                                    flexWrap: "wrap",
                                    alignSelf: isMe ? "flex-end" : "flex-start",
                                    marginTop: -10, // Overlap slightly with bubble for premium look
                                    marginRight: isMe ? 12 : 0,
                                    marginLeft: !isMe ? 12 : 0,
                                    backgroundColor: theme === 'dark' ? "#2c2c2e" : "#ffffff",
                                    borderRadius: 14,
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    maxWidth: '80%',
                                    shadowColor: "#000",
                                    shadowOffset: { width: 0, height: 1 },
                                    shadowOpacity: 0.15,
                                    shadowRadius: 2,
                                    elevation: 3,
                                    zIndex: 10,
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
                                                color: colors.text,
                                                fontSize: 9,
                                                fontWeight: "600",
                                            }}
                                        >
                                            {count}
                                        </Text>
                                    </View>
                                ))}
                            </TouchableOpacity>
                        )
                    }
                </TouchableOpacity>
            )
            }

            {/* ─── Read Receipts (Mobile) ─── */}
            {isMe && isLastMyMessage && !isRecalled && !isError && (
                <View style={{ alignSelf: "flex-end", marginRight: 12, marginTop: 2, marginBottom: 4 }}>
                    {(() => {
                        const count = readByIds ? readByIds.length : 0;
                        const isRead = count > 0;
                        const isOptimistic = String(message.messageId).startsWith("temp-");

                        if (isOptimistic) {
                            return (
                                <View style={{ flexDirection: "row", alignItems: "center" }}>
                                    <Text style={{ fontSize: 10, color: colors.textSecondary, marginRight: 2 }}>Đang gửi...</Text>
                                </View>
                            );
                        }

                        if (isGroup && isRead && readByIds && participants) {
                            const MAX_SHOW = 3;
                            const readers = readByIds
                                .map(id => participants.find(p => p.id === id))
                                .filter(Boolean);
                            const shown = readers.slice(0, MAX_SHOW);
                            const extra = readers.length - MAX_SHOW;

                            return (
                                <TouchableOpacity 
                                    activeOpacity={0.7} 
                                    onPress={() => onShowReadReceipts?.(message)}
                                    style={{ flexDirection: "row", alignItems: "center" }}
                                >
                                    <View style={{ flexDirection: "row-reverse" }}>
                                        {shown.map((reader, i) => (
                                            <Image
                                                key={reader.id}
                                                source={{ uri: reader.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(reader.fullName || reader.username)}&size=30&background=random` }}
                                                style={{
                                                    width: 14,
                                                    height: 14,
                                                    borderRadius: 7,
                                                    borderWidth: 1,
                                                    borderColor: theme === 'dark' ? "#1c1c1e" : "#fff",
                                                    marginLeft: i > 0 ? -5 : 0,
                                                }}
                                            />
                                        ))}
                                    </View>
                                    {extra > 0 && (
                                        <Text style={{ fontSize: 9, color: colors.textSecondary, fontWeight: '500', marginLeft: 2 }}>
                                            +{extra}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            );
                        }

                        if (isRead) {
                            return (
                                <TouchableOpacity 
                                    activeOpacity={0.7}
                                    onPress={() => onShowReadReceipts?.(message)}
                                    style={{ flexDirection: "row", alignItems: "center" }}
                                >
                                    <Ionicons name="checkmark-done" size={14} color="#0068ff" />
                                </TouchableOpacity>
                            );
                        }

                        return (
                            <View style={{ flexDirection: "row", alignItems: "center" }}>
                                <Ionicons name="checkmark" size={14} color={colors.textSecondary} />
                            </View>
                        );
                    })()}
                </View>
            )}

            {/* ─── Privacy blocked notice (Zalo-style) ─── */}
            {
                isMe && message.privacyBlocked && (
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "flex-start",
                            alignSelf: "flex-start",
                            marginTop: 4,
                            maxWidth: "75%",
                        }}
                    >
                        <View
                            style={{
                                width: 30,
                                height: 30,
                                borderRadius: 15,
                                backgroundColor: theme === 'dark' ? "#3a3a3c" : "#e0e0e0",
                                alignItems: "center",
                                justifyContent: "center",
                                marginRight: 6,
                                marginTop: 2,
                            }}
                        >
                            {senderAvatarUrl ? (
                                <Image
                                    source={{ uri: senderAvatarUrl }}
                                    style={{ width: 30, height: 30, borderRadius: 15 }}
                                />
                            ) : (
                                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textSecondary }}>
                                    {(partnerName || "?").charAt(0).toUpperCase()}
                                </Text>
                            )}
                        </View>
                        <View
                            style={{
                                backgroundColor: theme === 'dark' ? "#2c2c2e" : "#ffffff",
                                borderRadius: 12,
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                                flex: 1,
                                borderWidth: 0.5,
                                borderColor: theme === 'dark' ? "#3a3a3c" : "#e0e0e0",
                            }}
                        >
                            <Text style={{ color: colors.text, fontSize: 13, lineHeight: 18 }}>
                                {partnerName || "Người này"} không nhận tin nhắn từ người lạ.{"\n"}
                                <Text
                                    style={{ color: colors.primary, fontWeight: "600" }}
                                    onPress={onAddFriend}
                                >
                                    Kết bạn ngay
                                </Text>
                                {" để gửi tin nhắn."}
                            </Text>
                        </View>
                    </View>
                )
            }

            {/* ─── Full-screen image gallery with header/footer ─── */}
            <Modal
                visible={previewIndex !== null}
                transparent
                animationType="fade"
                statusBarTranslucent
                onRequestClose={() => {
                    setPreviewIndex(null);
                    setShowControls(true);
                    controlsOpacity.setValue(1);
                }}
            >
                <View style={{ flex: 1, backgroundColor: "#000" }}>

                    {/* Swipeable gallery — tap to toggle controls */}
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
                            <TouchableOpacity
                                activeOpacity={1}
                                onPress={toggleControls}
                                style={{
                                    width: SCREEN_WIDTH,
                                    height: SCREEN_HEIGHT,
                                    justifyContent: "center",
                                    alignItems: "center",
                                    backgroundColor: 'black'
                                }}
                            >
                                <Image
                                    source={{ uri: getImageUrl(att.url) }}
                                    style={{
                                        width: SCREEN_WIDTH,
                                        height: '100%',
                                    }}
                                    resizeMode="contain"
                                />
                            </TouchableOpacity>
                        )}
                    />

                    {/* ─── Animated Header ─── */}
                    <Animated.View
                        pointerEvents={showControls ? "auto" : "none"}
                        style={{
                            position: "absolute", top: 0, left: 0, right: 0,
                            opacity: controlsOpacity,
                            backgroundColor: "rgba(0,0,0,0.6)",
                            paddingTop: Platform.OS === "ios" ? 52 : (StatusBar.currentHeight ?? 24) + 12,
                            paddingBottom: 15, paddingHorizontal: 15,
                            flexDirection: "row", alignItems: "center",
                            zIndex: 1000,
                        }}
                    >
                        {/* Back */}
                        <TouchableOpacity
                            onPress={() => { setPreviewIndex(null); setShowControls(true); controlsOpacity.setValue(1); }}
                            style={{ padding: 4, marginRight: 10 }}
                        >
                            <Ionicons name="chevron-back" size={26} color="#fff" />
                        </TouchableOpacity>

                        {/* Avatar */}
                        {senderAvatarUrl ? (
                            <Image source={{ uri: senderAvatarUrl }} style={{ width: 36, height: 36, borderRadius: 18, marginRight: 10 }} />
                        ) : (
                            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#666", justifyContent: "center", alignItems: "center", marginRight: 10 }}>
                                <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>
                                    {(message.senderName || "?").charAt(0).toUpperCase()}
                                </Text>
                            </View>
                        )}

                        {/* Name + time */}
                        <View style={{ flex: 1 }}>
                            <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600" }} numberOfLines={1}>
                                {message.senderName || "Nguoi dung"}
                            </Text>
                            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 1 }}>
                                {message.createdAt
                                    ? `${new Date(message.createdAt).toLocaleDateString("vi-VN")} · ${getTimeAgo(message.createdAt)}`
                                    : ""}
                            </Text>
                        </View>

                        {/* Download */}
                        <TouchableOpacity
                            onPress={() => {
                                const att = imageAttachments[currentIndex];
                                const url = getImageUrl(att?.url || "");
                                if (url) handleDownload(url, att?.name);
                            }}
                            style={{ padding: 8, marginLeft: 4 }}
                        >
                            <Ionicons name="download-outline" size={24} color="#fff" />
                        </TouchableOpacity>

                        {/* 3-dot */}
                        <TouchableOpacity onPress={() => setImgOptionsVisible(true)} style={{ padding: 8, marginLeft: 4 }}>
                            <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
                        </TouchableOpacity>
                    </Animated.View>

                    {/* ─── Animated Footer ─── */}
                    <Animated.View
                        pointerEvents={showControls ? "auto" : "none"}
                        style={{
                            position: "absolute", bottom: 0, left: 0, right: 0,
                            opacity: controlsOpacity,
                            backgroundColor: "rgba(0,0,0,0.55)",
                            paddingBottom: Platform.OS === "ios" ? 36 : 16,
                            paddingTop: 12, paddingHorizontal: 20,
                            flexDirection: "row", alignItems: "center", justifyContent: "flex-end",
                            zIndex: 1000,
                        }}
                    >
                        {imageAttachments.length > 1 && (
                            <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, flex: 1 }}>
                                {currentIndex + 1} / {imageAttachments.length}
                            </Text>
                        )}
                        <TouchableOpacity
                            onPress={() => {
                                const att = imageAttachments[currentIndex];
                                const url = getImageUrl(att?.url || "");
                                if (url) handleShare(url, att?.name);
                            }}
                            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.18)", justifyContent: "center", alignItems: "center" }}
                        >
                            <Ionicons name="share-outline" size={22} color="#fff" />
                        </TouchableOpacity>
                    </Animated.View>

                    {/* ─── Options Bottom Sheet ─── */}
                    {imgOptionsVisible && (
                        <TouchableOpacity
                            activeOpacity={1}
                            onPress={() => setImgOptionsVisible(false)}
                            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end", zIndex: 2000 }}
                        >
                            <View style={{ backgroundColor: "#1c1c1e", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: Platform.OS === "ios" ? 40 : 25, overflow: "hidden" }}>
                                {[
                                    { icon: "image-outline" as const, label: "Lưu hình ảnh", color: "#fff", action: async () => { setImgOptionsVisible(false); const att = imageAttachments[currentIndex]; const url = getImageUrl(att?.url || ""); if (url) await handleDownload(url, att?.name); } },
                                    { icon: "chatbubble-outline" as const, label: "Trả lời", color: "#fff", action: () => { setImgOptionsVisible(false); setPreviewIndex(null); setTimeout(() => onReply?.(message), 100); } },
                                    { icon: "pin-outline" as const, label: message.pinned ? "Bỏ ghim" : "Ghim", color: "#fff", action: () => { setImgOptionsVisible(false); onTogglePin?.(message); } },
                                    { icon: "arrow-redo-outline" as const, label: "Chuyển tiếp", color: "#fff", action: () => { setImgOptionsVisible(false); setPreviewIndex(null); setTimeout(() => onForward?.(message), 250); } },
                                    { icon: "copy-outline" as const, label: "Sao chép", color: "#fff", action: async () => { setImgOptionsVisible(false); const att = imageAttachments[currentIndex]; const url = getImageUrl(att?.url || ""); if (url) await handleCopyImage(url, att?.name); } },
                                    ...(isMe ? [{ icon: "refresh-outline" as const, label: "Thu hồi", color: "#ff9f0a", action: () => { setImgOptionsVisible(false); onRecall?.(message); } }] : []),
                                    { icon: "trash-outline" as const, label: "Xóa", color: "#ff453a", action: () => { setImgOptionsVisible(false); setPreviewIndex(null); setTimeout(() => onDelete?.(message), 100); } },
                                    { icon: "close-circle-outline" as const, label: "Hủy", color: "#ccc", action: () => setImgOptionsVisible(false) },
                                ].map((item, i, arr) => (
                                    <TouchableOpacity
                                        key={item.label}
                                        onPress={item.action}
                                        activeOpacity={0.6}
                                        style={{
                                            paddingVertical: 14,
                                            paddingHorizontal: 20,
                                            flexDirection: "row",
                                            alignItems: "center",
                                            borderBottomWidth: i === arr.length - 1 ? 0 : 0.5,
                                            borderBottomColor: "rgba(255,255,255,0.1)",
                                        }}
                                    >
                                        <Ionicons name={item.icon} size={22} color={item.color} style={{ marginRight: 14 }} />
                                        <Text style={{ color: item.color, fontSize: 16, fontWeight: "500" }}>{item.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </TouchableOpacity>
                    )}
                    {toastMsg && (
                        <View pointerEvents="none" style={{ position: "absolute", bottom: 150, left: 0, right: 0, alignItems: "center", zIndex: 9999999 }}>
                            <Animated.View style={{ backgroundColor: "rgba(0,0,0,0.9)", paddingHorizontal: 22, paddingVertical: 14, borderRadius: 30, opacity: toastOpacity, elevation: 20 }}>
                                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>{toastMsg}</Text>
                            </Animated.View>
                        </View>
                    )}
                </View>
            </Modal>

            {/* ─── Full-screen video gallery with header/footer ─── */}
            <Modal
                visible={previewVideoIndex !== null}
                transparent
                animationType="fade"
                statusBarTranslucent
                onRequestClose={() => {
                    setPreviewVideoIndex(null);
                    setShowControls(true);
                    controlsOpacity.setValue(1);
                }}
            >
                <View style={{ flex: 1, backgroundColor: "#000" }}>
                    <FlatList
                        data={videoAttachments}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        keyExtractor={(_, i) => `vid-gallery-${i}`}
                        initialScrollIndex={previewVideoIndex ?? 0}
                        getItemLayout={(_, index) => ({
                            length: SCREEN_WIDTH,
                            offset: SCREEN_WIDTH * index,
                            index,
                        })}
                        onMomentumScrollEnd={(e) => {
                            const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                            setCurrentVideoIndex(idx);
                        }}
                        renderItem={({ item: att, index }) => (
                            <TouchableOpacity
                                activeOpacity={1}
                                onPress={toggleControls}
                                style={{
                                    width: SCREEN_WIDTH,
                                    height: SCREEN_HEIGHT,
                                    justifyContent: "center",
                                    alignItems: "center",
                                    backgroundColor: 'black'
                                }}
                            >
                                <Video
                                    source={{ uri: getImageUrl(att.url) }}
                                    style={{
                                        width: SCREEN_WIDTH,
                                        height: '100%',
                                    }}
                                    resizeMode={ResizeMode.CONTAIN}
                                    useNativeControls
                                    shouldPlay={false}
                                    isLooping={false}
                                />
                            </TouchableOpacity>
                        )}
                    />

                    {/* ─── Animated Header ─── */}
                    <Animated.View
                        pointerEvents={showControls ? "auto" : "none"}
                        style={{
                            position: "absolute", top: 0, left: 0, right: 0,
                            opacity: controlsOpacity,
                            backgroundColor: "rgba(0,0,0,0.6)",
                            paddingTop: Platform.OS === "ios" ? 52 : (StatusBar.currentHeight ?? 24) + 12,
                            paddingBottom: 15, paddingHorizontal: 15,
                            flexDirection: "row", alignItems: "center",
                            zIndex: 1000,
                        }}
                    >
                        {/* Back */}
                        <TouchableOpacity
                            onPress={() => { setPreviewVideoIndex(null); setShowControls(true); controlsOpacity.setValue(1); }}
                            style={{ padding: 4, marginRight: 10 }}
                        >
                            <Ionicons name="chevron-back" size={26} color="#fff" />
                        </TouchableOpacity>

                        {/* Avatar */}
                        {senderAvatarUrl ? (
                            <Image source={{ uri: senderAvatarUrl }} style={{ width: 36, height: 36, borderRadius: 18, marginRight: 10 }} />
                        ) : (
                            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#666", justifyContent: "center", alignItems: "center", marginRight: 10 }}>
                                <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>
                                    {(message.senderName || "?").charAt(0).toUpperCase()}
                                </Text>
                            </View>
                        )}

                        {/* Name + time */}
                        <View style={{ flex: 1 }}>
                            <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600" }} numberOfLines={1}>
                                {message.senderName || "Nguoi dung"}
                            </Text>
                            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 1 }}>
                                {message.createdAt
                                    ? `${new Date(message.createdAt).toLocaleDateString("vi-VN")} · ${getTimeAgo(message.createdAt)}`
                                    : ""}
                            </Text>
                        </View>

                        {/* Download */}
                        <TouchableOpacity
                            onPress={() => {
                                const att = videoAttachments[currentVideoIndex];
                                const url = getImageUrl(att?.url || "");
                                if (url) handleDownload(url, att?.name);
                            }}
                            style={{ padding: 8, marginLeft: 4 }}
                        >
                            <Ionicons name="download-outline" size={24} color="#fff" />
                        </TouchableOpacity>

                        {/* 3-dot */}
                        <TouchableOpacity onPress={() => setVideoOptionsVisible(true)} style={{ padding: 8, marginLeft: 4 }}>
                            <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
                        </TouchableOpacity>
                    </Animated.View>

                    {/* ─── Animated Footer ─── */}
                    <Animated.View
                        pointerEvents={showControls ? "auto" : "none"}
                        style={{
                            position: "absolute", bottom: 0, left: 0, right: 0,
                            opacity: controlsOpacity,
                            backgroundColor: "rgba(0,0,0,0.55)",
                            paddingBottom: Platform.OS === "ios" ? 36 : 16,
                            paddingTop: 12, paddingHorizontal: 20,
                            flexDirection: "row", alignItems: "center", justifyContent: "flex-end",
                            zIndex: 1000,
                        }}
                    >
                        {videoAttachments.length > 1 && (
                            <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, flex: 1 }}>
                                {currentVideoIndex + 1} / {videoAttachments.length}
                            </Text>
                        )}
                        <TouchableOpacity
                            onPress={() => {
                                const att = videoAttachments[currentVideoIndex];
                                const url = getImageUrl(att?.url || "");
                                if (url) handleShare(url, att?.name);
                            }}
                            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.18)", justifyContent: "center", alignItems: "center" }}
                        >
                            <Ionicons name="share-outline" size={22} color="#fff" />
                        </TouchableOpacity>
                    </Animated.View>

                    {/* ─── Options Bottom Sheet ─── */}
                    {videoOptionsVisible && (
                        <TouchableOpacity
                            activeOpacity={1}
                            onPress={() => setVideoOptionsVisible(false)}
                            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end", zIndex: 2000 }}
                        >
                            <View style={{ backgroundColor: "#1c1c1e", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: Platform.OS === "ios" ? 40 : 25, overflow: "hidden" }}>
                                {[
                                    { icon: "download-outline" as const, label: "Lưu video", color: "#fff", action: async () => { setVideoOptionsVisible(false); const att = videoAttachments[currentVideoIndex]; const url = getImageUrl(att?.url || ""); if (url) await handleDownload(url, att?.name); } },
                                    { icon: "arrow-redo-outline" as const, label: "Chuyển tiếp", color: "#fff", action: () => { setVideoOptionsVisible(false); setPreviewVideoIndex(null); setTimeout(() => onForward?.(message), 250); } },
                                    { icon: "close-circle-outline" as const, label: "Hủy", color: "#ccc", action: () => setVideoOptionsVisible(false) },
                                ].map((item, i, arr) => (
                                    <TouchableOpacity
                                        key={item.label}
                                        onPress={item.action}
                                        activeOpacity={0.6}
                                        style={{
                                            paddingVertical: 14,
                                            paddingHorizontal: 20,
                                            flexDirection: "row",
                                            alignItems: "center",
                                            borderBottomWidth: i === arr.length - 1 ? 0 : 0.5,
                                            borderBottomColor: "rgba(255,255,255,0.1)",
                                        }}
                                    >
                                        <Ionicons name={item.icon} size={22} color={item.color} style={{ marginRight: 14 }} />
                                        <Text style={{ color: item.color, fontSize: 16, fontWeight: "500" }}>{item.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </TouchableOpacity>
                    )}
                    {toastMsg && (
                        <View pointerEvents="none" style={{ position: "absolute", bottom: 150, left: 0, right: 0, alignItems: "center", zIndex: 9999999 }}>
                            <Animated.View style={{ backgroundColor: "rgba(0,0,0,0.9)", paddingHorizontal: 22, paddingVertical: 14, borderRadius: 30, opacity: toastOpacity, elevation: 20 }}>
                                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>{toastMsg}</Text>
                            </Animated.View>
                        </View>
                    )}
                </View>
            </Modal>

            {/* ─── File Preview / Quick Action Modal ─── */}
            <Modal
                visible={filePreviewVisible}
                transparent
                animationType="fade"
                statusBarTranslucent
                onRequestClose={() => setFilePreviewVisible(false)}
            >
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => setFilePreviewVisible(false)}
                    style={{
                        flex: 1,
                        backgroundColor: "rgba(0,0,0,0.6)",
                        justifyContent: "center",
                        alignItems: "center",
                        padding: 20,
                    }}
                >
                    <TouchableOpacity
                        activeOpacity={1}
                        style={{
                            width: "100%",
                            backgroundColor: colors.card,
                            borderRadius: 20,
                            padding: 24,
                            alignItems: "center",
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 8,
                            elevation: 10,
                        }}
                    >
                        {/* File Icon */}
                        <View style={{
                            width: 80,
                            height: 80,
                            borderRadius: 20,
                            backgroundColor: selectedFile?.color + "20" || "#eee",
                            alignItems: "center",
                            justifyContent: "center",
                            marginBottom: 20,
                        }}>
                            <Ionicons name={selectedFile?.icon || "document-outline"} size={48} color={selectedFile?.color || colors.primary} />
                        </View>

                        {/* File Name */}
                        <Text style={{
                            color: colors.text,
                            fontSize: 18,
                            fontWeight: "700",
                            textAlign: "center",
                            marginBottom: 8,
                        }} numberOfLines={2}>
                            {selectedFile?.fileName}
                        </Text>

                        {/* File Meta */}
                        <Text style={{
                            color: colors.textSecondary,
                            fontSize: 14,
                            marginBottom: 24,
                        }}>
                            {formatFileSize(selectedFile?.size || 0)} · {selectedFile?.label || "FILE"}
                        </Text>

                        {/* Divider */}
                        <View style={{ width: "100%", height: 1, backgroundColor: colors.border, marginBottom: 20 }} />

                        {/* Actions */}
                        <View style={{ width: "100%" }}>
                            <TouchableOpacity
                                onPress={() => {
                                    const url = getImageUrl(selectedFile?.url || "");
                                    // 1. Close modal immediately to avoid native conflict
                                    setFilePreviewVisible(false);
                                    // 2. Wait for modal to be fully dismissed before starting native share
                                    setTimeout(() => {
                                        handleFileView(url, selectedFile?.fileName);
                                    }, 500);
                                }}
                                style={{
                                    width: "100%",
                                    height: 50,
                                    backgroundColor: colors.primary,
                                    borderRadius: 12,
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    marginBottom: 12,
                                }}
                            >
                                <Ionicons name="eye-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Xem nội dung</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => {
                                    const url = getImageUrl(selectedFile?.url || "");
                                    setFilePreviewVisible(false);
                                    setTimeout(() => {
                                        handleDownload(url, selectedFile?.fileName);
                                    }, 500);
                                }}
                                style={{
                                    width: "100%",
                                    height: 50,
                                    backgroundColor: theme === 'dark' ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
                                    borderRadius: 12,
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                }}
                            >
                                <Ionicons name="download-outline" size={20} color={colors.text} style={{ marginRight: 8 }} />
                                <Text style={{ color: colors.text, fontWeight: "600", fontSize: 16 }}>Tải về</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Close button at bottom */}
                        <TouchableOpacity
                            onPress={() => setFilePreviewVisible(false)}
                            style={{ marginTop: 20, padding: 10 }}
                        >
                            <Text style={{ color: colors.textSecondary, fontWeight: "500" }}>Đóng</Text>
                        </TouchableOpacity>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            {/* ─── Global Toast Notification (Restored Animation) ─── */}
            {
                toastMsg && (
                    <View
                        pointerEvents="none"
                        style={{
                            position: "absolute",
                            bottom: 120,
                            left: 0,
                            right: 0,
                            alignItems: "center",
                            zIndex: 9999999
                        }}
                    >
                        <Animated.View style={{
                            backgroundColor: "rgba(0, 0, 0, 0.9)",
                            paddingHorizontal: 22,
                            paddingVertical: 14,
                            borderRadius: 30,
                            opacity: toastOpacity,
                            elevation: 20,
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.25,
                            shadowRadius: 3.84,
                        }}>
                            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>{toastMsg}</Text>
                        </Animated.View>
                    </View>
                )}
        </View>
    );
}
