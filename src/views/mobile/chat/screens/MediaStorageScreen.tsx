import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    Platform,
    StatusBar,
    FlatList,
    Image,
    Dimensions,
    ActivityIndicator,
    Modal,
    Linking
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { chatService } from "@/shared/services/chatService";
import type { MessageDynamo, Attachment } from "@/shared/services/chatService";

const SCREEN_WIDTH = Dimensions.get("window").width;
const COLUMN_COUNT = 3;
const IMAGE_SIZE = SCREEN_WIDTH / COLUMN_COUNT;

const COLORS = {
    bg: "#1a1a1a",
    card: "#1a1a1a",
    text: "#fff",
    textSecondary: "#aaa",
    border: "#262626",
    blue: "#3b82f6",
    tabInactive: "#555",
};

interface MediaStorageScreenProps {
    roomId: string;
    onClose: () => void;
}

// Lấy link thực tế của ảnh (fix lỗi localhost)
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

// Hàm hỗ trợ format bytes
function formatBytes(bytes: number, decimals = 2) {
    if (!+bytes) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export default function MediaStorageScreen({ roomId, onClose }: MediaStorageScreenProps) {
    const [tab, setTab] = useState<"IMAGE" | "FILE" | "LINK">("IMAGE");
    const [messages, setMessages] = useState<MessageDynamo[]>([]);
    const [loading, setLoading] = useState(true);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    const fetchAllMessages = useCallback(async () => {
        setLoading(true);
        try {
            let allMessages: MessageDynamo[] = [];
            let lastKey: string | undefined = undefined;
            // Lấy tối đa khoảng 100 tin nhắn gần nhất để phòng trường hợp quá tải,
            // (Thực tế Zalo sẽ load dần hoặc load nhiều hơn)
            for (let i = 0; i < 5; i++) {
                const res = await chatService.getChatHistory(roomId, 50, lastKey);
                allMessages = [...allMessages, ...(res.messages || [])];

                // Cập nhật lastKey (phụ thuộc vào cấu trúc trả về, ở đây giả sử lastEvaluatedKey)
                // Nhưng API backend của bạn có vẻ không trả về lastKey rõ ràng trong response object dựa trên code.
                // Thường ta sẽ dùng messageId hoặc createdAt của tin nhắn cuối làm lastKey. 
                // Tạm thời để đơn giản: lấy tất cả những gì api trả về trong 1 lần nếu không phân trang.
                if (res.lastEvaluatedKey) {
                    // API backend thực tế serialize Object Map sang JSON, ta lấy toString hoặc stringified.
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

    // Lọc ra danh sách attachments
    const { images, files, links } = useMemo(() => {
        const imgs: { att: Attachment; msg: MessageDynamo }[] = [];
        const fls: { att: Attachment; msg: MessageDynamo }[] = [];
        const lnks: { url: string; msg: MessageDynamo }[] = [];

        messages.forEach((msg) => {
            // Lọc link từ text content
            if (msg.content) {
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
                    if (type.startsWith("image") || type === "image") {
                        imgs.push({ att, msg });
                    } else {
                        fls.push({ att, msg });
                    }
                });
            }
        });

        // Sắp xếp thời gian giảm dần (mới nhất lên đầu)
        const sortByTime = (a: any, b: any) => {
            return new Date(b.msg.createdAt).getTime() - new Date(a.msg.createdAt).getTime();
        };

        return {
            images: imgs.sort(sortByTime),
            files: fls.sort(sortByTime),
            links: lnks.sort(sortByTime),
        };
    }, [messages]);

    const renderTabHeader = () => (
        <View style={s.tabContainer}>
            {(["IMAGE", "FILE", "LINK"] as const).map((t) => (
                <TouchableOpacity
                    key={t}
                    style={[s.tabBtn, tab === t && s.tabBtnActive]}
                    onPress={() => setTab(t)}
                >
                    <Text style={[s.tabText, tab === t && s.tabTextActive]}>
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
            contentContainerStyle={{ padding: 2 }}
            renderItem={({ item }) => (
                <TouchableOpacity
                    onPress={() => setPreviewImage(getImageUrl(item.att.url))}
                    style={{ margin: 1 }}
                >
                    <Image
                        source={{ uri: getImageUrl(item.att.url) }}
                        style={{ width: IMAGE_SIZE - 2, height: IMAGE_SIZE - 2 }}
                        resizeMode="cover"
                    />
                </TouchableOpacity>
            )}
            ListEmptyComponent={
                <View style={s.emptyContainer}>
                    <Text style={s.emptyText}>Chưa có ảnh nào được gửi</Text>
                </View>
            }
        />
    );

    const renderFileTab = () => (
        <FlatList
            data={files}
            keyExtractor={(item, index) => `${item.msg.messageId}-${index}`}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => (
                <TouchableOpacity style={s.fileRow} onPress={() => Linking.openURL(getImageUrl(item.att.url))}>
                    <View style={s.fileIcon}>
                        <Ionicons name="document-text-outline" size={32} color={COLORS.text} />
                    </View>
                    <View style={s.fileInfo}>
                        <Text style={s.fileName} numberOfLines={2}>
                            {item.att.filename || item.att.name || "Tệp đính kèm"}
                        </Text>
                        <Text style={s.fileSize}>{formatBytes(item.att.size)}</Text>
                    </View>
                    <Ionicons name="download-outline" size={24} color={COLORS.textSecondary} />
                </TouchableOpacity>
            )}
            ListEmptyComponent={
                <View style={s.emptyContainer}>
                    <Text style={s.emptyText}>Chưa có file nào được gửi</Text>
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
                <TouchableOpacity style={s.linkRow} onPress={() => Linking.openURL(item.url)}>
                    <View style={s.linkIcon}>
                        <Ionicons name="link-outline" size={24} color={COLORS.text} />
                    </View>
                    <View style={s.linkInfo}>
                        <Text style={s.linkText} numberOfLines={2}>
                            {item.url}
                        </Text>
                    </View>
                </TouchableOpacity>
            )}
            ListEmptyComponent={
                <View style={s.emptyContainer}>
                    <Text style={s.emptyText}>Chưa có link nào được gửi</Text>
                </View>
            }
        />
    );

    return (
        <SafeAreaView style={s.container}>
            {/* Header */}
            <View style={s.header}>
                <TouchableOpacity onPress={onClose} style={s.backBtn}>
                    <Ionicons name="chevron-back" size={28} color="white" />
                </TouchableOpacity>
                <Text style={s.headerTitle}>Ảnh, file, link</Text>
                <View style={{ width: 40 }} />
            </View>

            {renderTabHeader()}

            {loading ? (
                <View style={[s.emptyContainer, { flex: 1 }]}>
                    <ActivityIndicator size="large" color={COLORS.blue} />
                </View>
            ) : (
                <View style={{ flex: 1 }}>
                    {tab === "IMAGE" && renderImageTab()}
                    {tab === "FILE" && renderFileTab()}
                    {tab === "LINK" && renderLinkTab()}
                </View>
            )}

            {/* Preview ảnh full màn hình (Tái sử dụng code của MessageBubble, đơn giản hóa) */}
            <Modal visible={!!previewImage} transparent animationType="fade" onRequestClose={() => setPreviewImage(null)}>
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center", alignItems: "center" }}>
                    <TouchableOpacity
                        onPress={() => setPreviewImage(null)}
                        style={{ position: "absolute", top: 50, right: 20, zIndex: 10, padding: 8 }}
                    >
                        <Ionicons name="close" size={28} color="#fff" />
                    </TouchableOpacity>
                    {previewImage && (
                        <Image
                            source={{ uri: previewImage }}
                            style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH }}
                            resizeMode="contain"
                        />
                    )}
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bg,
        paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        height: 50,
        paddingHorizontal: 8,
        backgroundColor: COLORS.card,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    backBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
    headerTitle: { color: "white", fontSize: 18, fontWeight: "600" },
    tabContainer: {
        flexDirection: "row",
        backgroundColor: COLORS.card,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    tabBtn: {
        flex: 1,
        paddingVertical: 14,
        alignItems: "center",
        borderBottomWidth: 2,
        borderBottomColor: "transparent",
    },
    tabBtnActive: {
        borderBottomColor: COLORS.blue,
    },
    tabText: {
        fontSize: 16,
        color: COLORS.tabInactive,
        fontWeight: "500",
    },
    tabTextActive: {
        color: COLORS.text,
        fontWeight: "bold",
    },
    emptyContainer: {
        padding: 40,
        alignItems: "center",
        justifyContent: "center",
    },
    emptyText: {
        color: COLORS.textSecondary,
        fontSize: 15,
    },
    fileRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    fileIcon: {
        width: 50,
        height: 50,
        borderRadius: 8,
        backgroundColor: "#2c2c2e",
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
        color: COLORS.text,
        marginBottom: 4,
    },
    fileSize: {
        fontSize: 13,
        color: COLORS.textSecondary,
    },
    linkRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    linkIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#2c2c2e",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    linkInfo: {
        flex: 1,
    },
    linkText: {
        fontSize: 15,
        color: COLORS.blue,
        textDecorationLine: "underline",
    },
});
