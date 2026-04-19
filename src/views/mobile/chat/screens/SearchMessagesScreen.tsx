import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    StyleSheet,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Image,
} from "react-native";
import { SafeView as SafeAreaView } from "@/shared/components/SafeView";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/shared/theme/colors";
import { chatService, MessageDynamo } from "@/shared/services/chatService";
import { ChatItem } from "../components/ChatItem";
import { useRouter } from "expo-router";
import { useChatStore } from "@/shared/store/useChatStore";

interface SearchMessagesScreenProps {
    roomId: string;
    name: string;
    avatarUrl?: string;
    /** DIRECT | GROUP — truyền vào khi replace về màn chat */
    roomType?: string;
    onClose: () => void;
}

export default function SearchMessagesScreen({ roomId, name, avatarUrl, roomType = "DIRECT", onClose }: SearchMessagesScreenProps) {
    const router = useRouter();
    const setHighlightedMessageId = useChatStore((s) => s.setHighlightedMessageId);
    const colors = useThemeColors();

    const [query, setQuery] = useState("");
    const [messages, setMessages] = useState<MessageDynamo[]>([]);
    const [loading, setLoading] = useState(false);
    const [fetchingMore, setFetchingMore] = useState(false);
    const [lastKey, setLastKey] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [totalResults, setTotalResults] = useState(0);
    const [initialSearchDone, setInitialSearchDone] = useState(false);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (query.trim().length > 0) {
                performSearch(query.trim(), true);
            } else {
                setMessages([]);
                setTotalResults(0);
                setHasMore(false);
                setLastKey(null);
                setInitialSearchDone(false);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [query, roomId]);

    const performSearch = async (searchQuery: string, reset: boolean = false) => {
        if (!reset && (!hasMore || fetchingMore)) return;

        if (reset) {
            setLoading(true);
            setMessages([]);
        } else {
            setFetchingMore(true);
        }

        try {
            const currentLastKey = reset ? undefined : (lastKey || undefined);
            const response = await chatService.searchMessages(roomId, searchQuery, 20, currentLastKey);

            if (reset) {
                setMessages(response.messages || []);
            } else {
                setMessages((prev) => [...prev, ...(response.messages || [])]);
            }

            setLastKey(response.lastKey || null);
            setHasMore(response.hasMore || false);
            setTotalResults(response.totalResults || 0);
            setInitialSearchDone(true);
        } catch (error) {
            console.error("Error searching messages:", error);
        } finally {
            setLoading(false);
            setFetchingMore(false);
        }
    };

    const loadMore = () => {
        if (!loading && !fetchingMore && hasMore && query.trim().length > 0) {
            performSearch(query.trim(), false);
        }
    };

    const formatTime = (isoString?: string) => {
        if (!isoString) return "";
        try {
            const date = new Date(isoString);
            return date.toLocaleDateString("vi-VN", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
            }) + " " + date.toLocaleTimeString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit"
            });
        } catch {
            return "";
        }
    };

    const openMessageInChat = (item: MessageDynamo) => {
        setHighlightedMessageId(item.messageId);
        const q = [
            `name=${encodeURIComponent(name)}`,
            `type=${encodeURIComponent(roomType)}`,
            avatarUrl ? `avatarUrl=${encodeURIComponent(avatarUrl)}` : "",
        ]
            .filter(Boolean)
            .join("&");
        router.replace(`/chat/${roomId}?${q}` as any);
    };

    const renderItem = ({ item }: { item: MessageDynamo }) => {
        const avatarUri = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.senderName || "User")}&background=random&color=fff`;
        let messageText = item.content;
        if (!messageText && item.attachments && item.attachments.length > 0) {
            messageText = `[Đính kèm ${item.attachments.length} tệp/ảnh]`;
        }

        return (
            <ChatItem
                avatar={{ uri: avatarUri }}
                name={item.senderName || "Unknown"}
                message={messageText}
                time={formatTime(item.createdAt)}
                highlightQuery={query.trim()}
                onPress={() => openMessageInChat(item)}
            />
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <StatusBar style={colors.statusBar} />

            {/* Header */}
            <View style={{ backgroundColor: colors.headerBg }}>
                <SafeAreaView edges={["top"]}>
                    <View
                        style={{
                            height: 52,
                            flexDirection: "row",
                            alignItems: "center",
                            paddingHorizontal: 16,
                            backgroundColor: colors.headerBg,
                            borderBottomWidth: colors.headerBg === "#0068FF" ? 0 : 0.5,
                            borderBottomColor: colors.border,
                            gap: 12,
                        }}
                    >
                        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Ionicons name="chevron-back" size={26} color={colors.headerText} />
                        </TouchableOpacity>

                        <View
                            style={{
                                flex: 1,
                                flexDirection: "row",
                                alignItems: "center",
                                borderRadius: 10,
                                backgroundColor: colors.headerSearchBg || "rgba(255,255,255,0.2)",
                                paddingHorizontal: 10,
                                height: 36,
                            }}
                        >
                            <Ionicons name="search" size={18} color={colors.headerIcon || colors.headerText} style={{ marginRight: 6 }} />
                            <TextInput
                                style={{
                                    flex: 1,
                                    color: colors.headerText,
                                    fontSize: 15,
                                    paddingVertical: 0,
                                }}
                                placeholder={`Tìm kiếm trong ${name}`}
                                placeholderTextColor={(colors.headerIcon || colors.headerText) + "80"}
                                value={query}
                                onChangeText={setQuery}
                                autoFocus
                            />
                            {query ? (
                                <TouchableOpacity onPress={() => setQuery("")} style={{ paddingLeft: 6 }}>
                                    <Ionicons name="close-circle" size={18} color={colors.headerIcon || colors.headerText} />
                                </TouchableOpacity>
                            ) : null}
                        </View>
                    </View>
                </SafeAreaView>
            </View>

            {/* Helper Text / Results Count */}
            {initialSearchDone && !loading && (
                <View style={[styles.resultsInfo, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                    <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: "center" }}>
                        {totalResults > 0
                            ? `Tìm thấy ${totalResults} kết quả cho "${query.trim()}"`
                            : `Không tìm thấy kết quả nào cho "${query.trim()}"`}
                    </Text>
                </View>
            )}

            {/* Main Content */}
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                {loading ? (
                    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                ) : (
                    <FlatList
                        data={messages}
                        keyExtractor={(item) => item.messageId}
                        renderItem={renderItem}
                        contentContainerStyle={messages.length === 0 ? styles.emptyContainer : styles.listContent}
                        onEndReached={loadMore}
                        onEndReachedThreshold={0.5}
                        ListFooterComponent={
                            fetchingMore ? (
                                <View style={{ paddingVertical: 16, alignItems: "center" }}>
                                    <ActivityIndicator size="small" color={colors.primary} />
                                </View>
                            ) : null
                        }
                        ListEmptyComponent={
                            initialSearchDone && query.trim().length > 0 && totalResults === 0 ? (
                                <View style={styles.centerContainer}>
                                    <Ionicons name="search-outline" size={60} color={colors.separator} />
                                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                        Không tìm thấy kết quả nào cho "{query.trim()}"
                                    </Text>
                                </View>
                            ) : (
                                <View style={styles.centerContainer}>
                                    <Ionicons name="search-outline" size={60} color={colors.separator} />
                                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                        Nhập từ khóa để tìm kiếm tin nhắn
                                    </Text>
                                </View>
                            )
                        }
                    />
                )}
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    resultsInfo: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 0.5,
    },
    listContent: {
        paddingBottom: 20,
    },
    emptyContainer: {
        flexGrow: 1,
    },
    centerContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 15,
        textAlign: "center",
    },
});
