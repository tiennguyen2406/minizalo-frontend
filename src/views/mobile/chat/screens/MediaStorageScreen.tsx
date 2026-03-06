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
    Modal,
    Linking
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { chatService } from "@/shared/services/chatService";
import type { MessageDynamo, Attachment } from "@/shared/services/chatService";
import { useThemeColors } from "@/shared/theme/colors";

const SCREEN_WIDTH = Dimensions.get("window").width;
const COLUMN_COUNT = 3;
const IMAGE_SIZE = SCREEN_WIDTH / COLUMN_COUNT;

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
    const colors = useThemeColors();
    const [tab, setTab] = useState<"IMAGE" | "FILE" | "LINK">("IMAGE");
    const [messages, setMessages] = useState<MessageDynamo[]>([]);
    const [loading, setLoading] = useState(true);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

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
            renderItem={({ item }) => (
                <TouchableOpacity style={s.fileRow} onPress={() => Linking.openURL(getImageUrl(item.att.url))}>
                    <View style={[s.fileIcon, { backgroundColor: colors.searchBg }]}>
                        <Ionicons name="document-text-outline" size={32} color={colors.text} />
                    </View>
                    <View style={s.fileInfo}>
                        <Text style={[s.fileName, { color: colors.text }]} numberOfLines={2}>
                            {item.att.filename || item.att.name || "Tệp đính kèm"}
                        </Text>
                        <Text style={[s.fileSize, { color: colors.textSecondary }]}>{formatBytes(item.att.size)}</Text>
                    </View>
                    <Ionicons name="download-outline" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
            )}
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
                <TouchableOpacity style={s.linkRow} onPress={() => Linking.openURL(item.url)}>
                    <View style={[s.linkIcon, { backgroundColor: colors.searchBg }]}>
                        <Ionicons name="link-outline" size={24} color={colors.text} />
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
        <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={["top"]}>
            <StatusBar style={colors.statusBar} />
            {/* Header */}
            <View style={[s.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
                <TouchableOpacity
                    onPress={onClose}
                    style={s.backBtn}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="chevron-back" size={26} color={colors.headerText} />
                </TouchableOpacity>
                <Text style={[s.headerTitle, { color: colors.headerText }]}>Ảnh, file, link</Text>
                <View style={{ width: 40 }} />
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
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        height: 52,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
    },
    backBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
    headerTitle: { fontSize: 18, fontWeight: "600" },
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
    },
    fileIcon: {
        width: 50,
        height: 50,
        borderRadius: 8,
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
        textDecorationLine: "underline",
    },
});
