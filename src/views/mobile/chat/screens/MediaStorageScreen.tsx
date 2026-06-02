import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Platform,
    StatusBar as RNStatusBar,
    FlatList,
    Image,
    Dimensions,
    ActivityIndicator,
    Alert,
    Modal,
    Linking
} from "react-native";
import { SafeView as SafeAreaView } from "@/shared/components/SafeView";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { ResizeMode, Video } from "expo-av";
import { chatService } from "@/shared/services/chatService";
import type { MessageDynamo, Attachment } from "@/shared/services/chatService";
import { MessageService } from "@/shared/services/MessageService";
import { useThemeColors } from "@/shared/theme/colors";
import { useChatStore } from "@/shared/store/useChatStore";

const SCREEN_WIDTH = Dimensions.get("window").width;
const COLUMN_COUNT = 3;
const IMAGE_SIZE = SCREEN_WIDTH / COLUMN_COUNT;

interface MediaStorageScreenProps {
    roomId: string;
    onClose: () => void;
}

// Lấy link thực tế của ảnh (fix lỗi localhost/IP address)
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

function isRemoteMediaUri(value?: string | null): value is string {
    return /^https?:\/\//i.test(String(value || ""));
}

// Hàm hỗ trợ format bytes
function formatBytes(bytes: number, decimals = 2) {
    if (!+bytes) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function isVideoAttachment(att: Attachment | null | undefined): boolean {
    if (!att) return false;
    const type = String(att.type || "").toLowerCase();
    const name = String(att.filename || att.name || "").toLowerCase();
    const url = String(att.url || "").toLowerCase();
    return (
        type.startsWith("video") ||
        type === "video" ||
        /\.(mp4|mov|m4v|webm|3gp|avi|mkv)(\?[^#]*)?(#|$)/i.test(url) ||
        /\.(mp4|mov|m4v|webm|3gp|avi|mkv)$/i.test(name)
    );
}

function normalizeCloudUrl(url: string | undefined): string {
    const raw = (url || "").trim();
    if (!raw) return "";
    const withoutQuery = raw.split("?")[0] || raw;
    try {
        return decodeURIComponent(withoutQuery);
    } catch {
        return withoutQuery;
    }
}

function cloudUrlMatches(a: string | undefined, b: string | undefined): boolean {
    const left = normalizeCloudUrl(a);
    const right = normalizeCloudUrl(b);
    if (!left || !right) return false;
    if (left === right || left.endsWith(right) || right.endsWith(left)) return true;
    const leftName = left.slice(left.lastIndexOf("/") + 1);
    const rightName = right.slice(right.lastIndexOf("/") + 1);
    return !!leftName && leftName === rightName;
}

export default function MediaStorageScreen({ roomId, onClose }: MediaStorageScreenProps) {
    const colors = useThemeColors();
    const [tab, setTab] = useState<"IMAGE" | "FILE" | "LINK">("IMAGE");
    const [messages, setMessages] = useState<MessageDynamo[]>([]);
    const [loading, setLoading] = useState(true);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewIndex, setPreviewIndex] = useState<number | null>(null);
    const [selected, setSelected] = useState<Set<string>>(() => new Set());
    const [selectionMode, setSelectionMode] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const fetchAllMessages = useCallback(async () => {
        setLoading(true);
        try {
            let allMessages: MessageDynamo[] = [];
            let lastKey: string | undefined = undefined;
            // Lấy tối đa khoảng 100 tin nhắn gần nhất
            for (let i = 0; i < 5; i++) {
                const res = await chatService.getChatHistory(roomId, 50, lastKey);
                allMessages = [...allMessages, ...(res.messages || [])];
                if (res.lastEvaluatedKey) {
                    lastKey = typeof res.lastEvaluatedKey === "string" ? res.lastEvaluatedKey : JSON.stringify(res.lastEvaluatedKey);
                } else {
                    break;
                }
            }
            setMessages(allMessages);
        } catch (error) {
            console.error("Error fetching chat history for media:", error);
        } finally {
            setLoading(false);
        }
    }, [roomId]);

    useEffect(() => {
        fetchAllMessages();
    }, [fetchAllMessages]);

    useEffect(() => {
        setSelected(new Set());
        setSelectionMode(false);
    }, [tab]);

    // Lọc ra danh sách attachments
    const { images, files, links } = useMemo(() => {
        const imgs: { att: Attachment; msg: MessageDynamo }[] = [];
        const fls: { att: Attachment; msg: MessageDynamo }[] = [];
        const lnks: { url: string; msg: MessageDynamo }[] = [];

        messages.forEach((msg) => {
            // Lọc link từ text content
            if (msg.content && !msg.content.trimStart().startsWith('{"type":"STORY_QUOTE"')) {
                const urlRegex = /(https?:\/\/[^\s]+)/g;
                const matches = msg.content.match(urlRegex);
                if (matches) {
                    matches.forEach((url) => lnks.push({ url, msg }));
                }
            }

            // Phân loại attachments
            if (msg.attachments && Array.isArray(msg.attachments)) {
                msg.attachments.forEach((att) => {
                    const type = (att.type || "").toLowerCase();
                    if (type.startsWith("image") || type === "image" || isVideoAttachment(att)) {
                        imgs.push({ att, msg });
                    } else {
                        fls.push({ att, msg });
                    }
                });
            }
        });

        const sortByTime = (a: any, b: any) => {
            return new Date(b.msg.createdAt).getTime() - new Date(a.msg.createdAt).getTime();
        };

        return {
            images: imgs.sort(sortByTime),
            files: fls.sort(sortByTime),
            links: lnks.sort(sortByTime),
        };
    }, [messages]);

    const mediaPreviewItems = useMemo(
        () =>
            images.map((item) => {
                const resolvedUrl = getImageUrl(item.att.url);
                return {
                    key: `${item.msg.messageId}-${item.att.url}`,
                    url: isRemoteMediaUri(resolvedUrl) ? resolvedUrl : "",
                    kind: isVideoAttachment(item.att) ? "video" as const : "image" as const,
                    name: item.att.filename || item.att.name || "",
                };
            }),
        [images],
    );

    const openPreview = useCallback((index: number) => {
        setPreviewIndex(index);
        setPreviewOpen(true);
    }, []);

    const closePreview = useCallback(() => {
        setPreviewOpen(false);
        setPreviewIndex(null);
    }, []);

    const selectableItems = useMemo(() => {
        const base = tab === "IMAGE" ? images : tab === "FILE" ? files : [];
        return base.map((item) => ({
            key: `${item.msg.messageId}-${item.att.url}`,
            messageId: item.msg.messageId,
            url: item.att.url,
        }));
    }, [files, images, tab]);

    const selectedItems = useMemo(
        () => selectableItems.filter((item) => selected.has(item.key)),
        [selectableItems, selected],
    );

    const patchDeletedItemsInChat = useCallback((items: { messageId: string; url: string }[]) => {
        if (!items.length) return;
        const store = useChatStore.getState();
        const currentMessages = store.messages[roomId] || [];
        if (!currentMessages.length) return;
        const nextMessages = currentMessages.map((message) => {
            const selectedForMessage = items.filter((item) => item.messageId === message.id);
            if (!selectedForMessage.length) return message;
            const nextAttachments = (message.attachments || []).filter(
                (attachment: any) => !selectedForMessage.some((item) => cloudUrlMatches(attachment?.url, item.url)),
            );
            if ((message.attachments || []).length > 0) {
                if (nextAttachments.length === 0) {
                    return { ...message, attachments: [], fileUrl: undefined, fileName: undefined, fileSize: undefined, isRecall: true, content: "[Tin nhắn đã thu hồi]" };
                }
                const first = nextAttachments[0] as any;
                return {
                    ...message,
                    attachments: nextAttachments,
                    fileUrl: first?.url,
                    fileName: first?.name || first?.filename,
                    fileSize: first?.size,
                };
            }
            const shouldRecallLegacy = selectedForMessage.some((item) => cloudUrlMatches(message.fileUrl || message.content, item.url));
            return shouldRecallLegacy
                ? { ...message, fileUrl: undefined, fileName: undefined, fileSize: undefined, isRecall: true, content: "[Tin nhắn đã thu hồi]" }
                : message;
        });
        store.setMessages(roomId, nextMessages);
    }, [roomId]);

    const toggleSelected = useCallback((key: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }, []);

    const enterSelectionMode = useCallback((key: string) => {
        setSelectionMode(true);
        setSelected((prev) => {
            const next = new Set(prev);
            next.add(key);
            return next;
        });
    }, []);

    const exitSelectionMode = useCallback(() => {
        setSelectionMode(false);
        setSelected(new Set());
    }, []);

    const deleteSelected = useCallback(() => {
        if (!selectedItems.length || deleting) return;
        Alert.alert(
            "Xóa nội dung",
            `Bạn có chắc chắn muốn xóa ${selectedItems.length} mục đã chọn khỏi My Documents?`,
            [
                { text: "Hủy", style: "cancel" },
                {
                    text: "Xóa",
                    style: "destructive",
                    onPress: async () => {
                        setDeleting(true);
                        try {
                            await MessageService.deleteCloudMediaItems(roomId, selectedItems);
                            patchDeletedItemsInChat(selectedItems);
                            setSelected(new Set());
                            setSelectionMode(false);
                            await fetchAllMessages();
                        } catch (error: any) {
                            const msg = error?.response?.data?.message || "Không thể xóa nội dung đã chọn.";
                            Alert.alert("Lỗi", msg);
                        } finally {
                            setDeleting(false);
                        }
                    },
                },
            ],
        );
    }, [deleting, fetchAllMessages, patchDeletedItemsInChat, roomId, selectedItems]);

    const renderTabHeader = () => (
        <View style={[s.tabContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            {(["IMAGE", "FILE", "LINK"] as const).map((t) => (
                <TouchableOpacity
                    key={t}
                    style={[s.tabBtn, tab === t && { borderBottomColor: colors.primary }]}
                    onPress={() => setTab(t)}
                >
                    <Text style={[s.tabText, { color: colors.textSecondary }, tab === t && { color: colors.text, fontWeight: "bold" }]}>
                        {t === "IMAGE" ? "Ảnh" : t === "FILE" ? "File" : "Link"}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );

    const renderImageTab = () => (
        <FlatList
            data={images}
            keyExtractor={(item, index) => `${item.msg.messageId}-${index}`}
            numColumns={COLUMN_COUNT}
            contentContainerStyle={{ padding: 8 }}
            renderItem={({ item, index }) => {
                const key = `${item.msg.messageId}-${item.att.url}`;
                const checked = selected.has(key);
                const resolvedUrl = getImageUrl(item.att.url);
                const safeUrl = isRemoteMediaUri(resolvedUrl) ? resolvedUrl : "";
                return (
                <TouchableOpacity
                    onPress={() => selectionMode ? toggleSelected(key) : openPreview(index)}
                    onLongPress={() => enterSelectionMode(key)}
                    delayLongPress={2000}
                    style={{ margin: 4, borderRadius: 12, overflow: "hidden", backgroundColor: colors.searchBg }}
                >
                    {isVideoAttachment(item.att) ? (
                        <View style={{ width: IMAGE_SIZE - 8, height: IMAGE_SIZE - 8, backgroundColor: "#000" }}>
                            {safeUrl ? (
                                <Video
                                    source={{ uri: safeUrl }}
                                    style={StyleSheet.absoluteFillObject}
                                    resizeMode={ResizeMode.COVER}
                                    shouldPlay={false}
                                    isMuted
                                    useNativeControls={false}
                                />
                            ) : null}
                            <View style={[StyleSheet.absoluteFillObject, s.videoOverlay]}>
                                <View style={s.playBadge}>
                                    <Ionicons name="play" size={18} color="#fff" style={{ marginLeft: 2 }} />
                                </View>
                                <View style={s.videoTypeBadge}>
                                    <Text style={s.videoTypeText}>MP4</Text>
                                </View>
                            </View>
                        </View>
                    ) : safeUrl ? (
                        <Image
                            source={{ uri: safeUrl }}
                            style={{ width: IMAGE_SIZE - 8, height: IMAGE_SIZE - 8 }}
                            resizeMode="cover"
                        />
                    ) : (
                        <View style={{ width: IMAGE_SIZE - 8, height: IMAGE_SIZE - 8, alignItems: "center", justifyContent: "center" }}>
                            <Ionicons name="image-outline" size={28} color={colors.textSecondary} />
                        </View>
                    )}
                    {selectionMode ? (
                        <TouchableOpacity
                            onPress={() => toggleSelected(key)}
                            style={[s.checkBadge, { backgroundColor: checked ? colors.primary : "rgba(0,0,0,0.38)" }]}
                        >
                            {checked ? <Ionicons name="checkmark" size={18} color="#fff" /> : null}
                        </TouchableOpacity>
                    ) : null}
                </TouchableOpacity>
            );
            }}
            ListEmptyComponent={
                <View style={s.emptyContainer}>
                    <Text style={[s.emptyText, { color: colors.textSecondary }]}>Chưa có ảnh nào được gửi</Text>
                </View>
            }
        />
    );

    const renderFileTab = () => (
        <FlatList
            data={files}
            keyExtractor={(item, index) => `${item.msg.messageId}-${index}`}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => {
                const key = `${item.msg.messageId}-${item.att.url}`;
                const checked = selected.has(key);
                return (
                <TouchableOpacity
                    style={[s.fileRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => selectionMode ? toggleSelected(key) : Linking.openURL(getImageUrl(item.att.url))}
                    onLongPress={() => enterSelectionMode(key)}
                    delayLongPress={2000}
                    activeOpacity={0.82}
                >
                    <View style={[s.fileIcon, { backgroundColor: colors.searchBg }]}>
                        <Ionicons name="document-text-outline" size={28} color={colors.primary} />
                    </View>
                    <View style={s.fileInfo}>
                        <Text style={[s.fileName, { color: colors.text }]} numberOfLines={2}>
                            {item.att.filename || item.att.name || "Tệp đính kèm"}
                        </Text>
                        <Text style={[s.fileSize, { color: colors.textSecondary }]}>{formatBytes(item.att.size)}</Text>
                    </View>
                    {selectionMode ? (
                        <TouchableOpacity
                            onPress={() => toggleSelected(key)}
                            style={[s.rowAction, { backgroundColor: checked ? colors.primary : colors.searchBg }]}
                        >
                            {checked ? <Ionicons name="checkmark" size={20} color="#fff" /> : null}
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            onPress={() => Linking.openURL(getImageUrl(item.att.url))}
                            style={[s.rowAction, { backgroundColor: colors.searchBg }]}
                        >
                            <Ionicons name="download-outline" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    )}
                </TouchableOpacity>
            );
            }}
            ListEmptyComponent={
                <View style={s.emptyContainer}>
                    <Text style={[s.emptyText, { color: colors.textSecondary }]}>Chưa có file nào được gửi</Text>
                </View>
            }
        />
    );

    const renderLinkTab = () => (
        <FlatList
            data={links}
            keyExtractor={(item, index) => `${item.msg.messageId}-${index}`}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => (
                <TouchableOpacity
                    style={[s.linkRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => Linking.openURL(item.url)}
                    activeOpacity={0.82}
                >
                    <View style={[s.linkIcon, { backgroundColor: colors.searchBg }]}>
                        <Ionicons name="link-outline" size={22} color={colors.primary} />
                    </View>
                    <View style={s.linkInfo}>
                        <Text style={[s.linkText, { color: colors.primary }]} numberOfLines={2}>
                            {item.url}
                        </Text>
                    </View>
                </TouchableOpacity>
            )}
            ListEmptyComponent={
                <View style={s.emptyContainer}>
                    <Text style={[s.emptyText, { color: colors.textSecondary }]}>Chưa có link nào được gửi</Text>
                </View>
            }
        />
    );

    return (
        <View style={[s.container, { backgroundColor: colors.background }]}>
            <StatusBar style={colors.statusBar} />
            {/* Header */}
            <View style={{ backgroundColor: colors.headerBg }}>
                <SafeAreaView edges={["top"]}>
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingHorizontal: 16,
                            height: 52,
                            backgroundColor: colors.headerBg,
                            borderBottomWidth: colors.headerBg === "#0068FF" ? 0 : 0.5,
                            borderBottomColor: colors.border,
                            gap: 12,
                        }}
                    >
                        <TouchableOpacity
                            onPress={onClose}
                            activeOpacity={0.7}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons name="chevron-back" size={26} color={colors.headerText} />
                        </TouchableOpacity>
                        <Text style={{ fontSize: 18, fontWeight: "600", color: colors.headerText, flex: 1 }}>
                            Ảnh, file, link
                        </Text>
                        {selectionMode ? (
                            <TouchableOpacity
                                onPress={exitSelectionMode}
                                activeOpacity={0.75}
                                style={{ paddingHorizontal: 8, paddingVertical: 6 }}
                            >
                                <Text style={{ color: colors.headerText, fontWeight: "700" }}>
                                    Hủy
                                </Text>
                            </TouchableOpacity>
                        ) : null}
                        {selectedItems.length > 0 ? (
                            <TouchableOpacity
                                onPress={deleteSelected}
                                disabled={deleting}
                                activeOpacity={0.75}
                                style={{ paddingHorizontal: 10, paddingVertical: 6 }}
                            >
                                <Text style={{ color: colors.headerText, fontWeight: "700" }}>
                                    {deleting ? "Đang xóa" : `Xóa (${selectedItems.length})`}
                                </Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>
                </SafeAreaView>
            </View>

            {renderTabHeader()}

            {loading ? (
                <View style={[s.emptyContainer, { flex: 1 }]}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <View style={{ flex: 1 }}>
                    {tab === "IMAGE" && renderImageTab()}
                    {tab === "FILE" && renderFileTab()}
                    {tab === "LINK" && renderLinkTab()}
                </View>
            )}

            <Modal visible={previewOpen} transparent animationType="fade" onRequestClose={closePreview}>
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.96)", justifyContent: "center", alignItems: "center" }}>
                    <TouchableOpacity
                        onPress={closePreview}
                        style={{ position: "absolute", top: 50, right: 20, zIndex: 10, padding: 8 }}
                    >
                        <Ionicons name="close" size={28} color="#fff" />
                    </TouchableOpacity>
                    <FlatList
                        data={mediaPreviewItems}
                        horizontal
                        pagingEnabled
                        initialScrollIndex={previewIndex ?? 0}
                        getItemLayout={(_, index) => ({
                            length: SCREEN_WIDTH,
                            offset: SCREEN_WIDTH * index,
                            index,
                        })}
                        keyExtractor={(item) => item.key}
                        showsHorizontalScrollIndicator={false}
                        onMomentumScrollEnd={(event) => {
                            if (!previewOpen) return;
                            const next = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                            setPreviewIndex(next);
                        }}
                        onScrollToIndexFailed={(info) => {
                            setTimeout(() => {
                                if (previewOpen) setPreviewIndex(info.index);
                            }, 80);
                        }}
                        renderItem={({ item, index }) => {
                            const isActive = previewIndex === index;
                            return (
                                <View style={s.previewPage}>
                                    {item.kind === "video" && item.url ? (
                                        <Video
                                            source={{ uri: item.url }}
                                            style={s.previewVideo}
                                            resizeMode={ResizeMode.CONTAIN}
                                            useNativeControls
                                            shouldPlay={false}
                                            isLooping={false}
                                            isMuted={!isActive}
                                        />
                                    ) : item.url ? (
                                        <Image
                                            source={{ uri: item.url }}
                                            style={s.previewImage}
                                            resizeMode="contain"
                                        />
                                    ) : (
                                        <View style={[s.previewImage, { alignItems: "center", justifyContent: "center" }]}>
                                            <Ionicons name="image-outline" size={44} color={colors.textSecondary} />
                                        </View>
                                    )}
                                </View>
                            );
                        }}
                    />
                    {mediaPreviewItems.length > 1 ? (
                        <View style={s.previewCounter}>
                            <Text style={s.previewCounterText}>
                                {(previewIndex ?? 0) + 1} / {mediaPreviewItems.length}
                            </Text>
                        </View>
                    ) : null}
                </View>
            </Modal>
        </View>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
    },
    tabContainer: {
        flexDirection: "row",
        borderBottomWidth: 1,
    },
    tabBtn: {
        flex: 1,
        paddingVertical: 14,
        alignItems: "center",
        borderBottomWidth: 2,
        borderBottomColor: "transparent",
    },
    tabText: {
        fontSize: 16,
        fontWeight: "500",
    },
    emptyContainer: {
        padding: 40,
        alignItems: "center",
        justifyContent: "center",
    },
    emptyText: {
        fontSize: 15,
    },
    fileRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 10,
    },
    fileIcon: {
        width: 48,
        height: 48,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    fileInfo: {
        flex: 1,
        marginRight: 12,
    },
    fileName: {
        fontSize: 16,
        marginBottom: 4,
    },
    fileSize: {
        fontSize: 13,
    },
    linkRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 10,
    },
    linkIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    linkInfo: {
        flex: 1,
    },
    linkText: {
        fontSize: 15,
        fontWeight: "600",
    },
    rowAction: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
    },
    checkBadge: {
        position: "absolute",
        top: 8,
        right: 8,
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: "#fff",
        alignItems: "center",
        justifyContent: "center",
    },
    videoOverlay: {
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.16)",
    },
    playBadge: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.48)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.35)",
    },
    videoTypeBadge: {
        position: "absolute",
        left: 8,
        bottom: 8,
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 8,
        backgroundColor: "rgba(0,0,0,0.58)",
    },
    videoTypeText: {
        color: "#fff",
        fontSize: 10,
        fontWeight: "800",
    },
    previewPage: {
        width: SCREEN_WIDTH,
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 70,
    },
    previewImage: {
        width: SCREEN_WIDTH,
        height: "100%",
    },
    previewVideo: {
        width: SCREEN_WIDTH,
        height: "100%",
        backgroundColor: "#000",
    },
    previewCounter: {
        position: "absolute",
        bottom: 38,
        alignSelf: "center",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: "rgba(0,0,0,0.55)",
    },
    previewCounterText: {
        color: "#fff",
        fontSize: 13,
        fontWeight: "700",
    },
});
