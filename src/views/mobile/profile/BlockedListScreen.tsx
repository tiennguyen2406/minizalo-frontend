import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, FlatList, Alert } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import friendService from "@/shared/services/friendService";
import type { FriendResponseDto } from "@/shared/services/types";
import { useThemeColors } from "@/shared/theme/colors";

export default function BlockedListScreen() {
    const router = useRouter();
    const colors = useThemeColors();
    const [blocked, setBlocked] = useState<FriendResponseDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadBlocked = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await friendService.getBlockedUsers();
            setBlocked(data);
        } catch (e: any) {
            const msg =
                e?.response?.data?.message ||
                e?.response?.data ||
                "Không tải được danh sách chặn.";
            setError(String(msg));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        loadBlocked();
    }, []);

    const handleUnblock = (userId: string, name: string) => {
        Alert.alert(
            "Bỏ chặn",
            `Bạn có chắc muốn bỏ chặn "${name}"?`,
            [
                { text: "Hủy", style: "cancel" },
                {
                    text: "Bỏ chặn",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await friendService.unblockUser(userId);
                            setBlocked((prev) =>
                                prev.filter((f) => f.friend.id !== userId)
                            );
                        } catch (e: any) {
                            const msg =
                                e?.response?.data?.message ||
                                e?.response?.data ||
                                "Không thể bỏ chặn.";
                            Alert.alert("Lỗi", String(msg));
                        }
                    },
                },
            ]
        );
    };

    const renderItem = ({ item }: { item: FriendResponseDto }) => {
        const u = item.friend; // user = người chặn, friend = người bị chặn
        const name = u.displayName || u.username || "Người dùng";
        const initial = name.charAt(0).toUpperCase() || "?";

        return (
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderBottomWidth: 0.5,
                    borderBottomColor: colors.border,
                }}
            >
                <View
                    style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: colors.searchBg,
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 12,
                    }}
                >
                    <Text
                        style={{
                            color: colors.text,
                            fontSize: 16,
                            fontWeight: "600",
                        }}
                    >
                        {initial}
                    </Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text
                        style={{
                            color: colors.text,
                            fontSize: 15,
                            fontWeight: "500",
                        }}
                        numberOfLines={1}
                    >
                        {name}
                    </Text>
                </View>
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => handleUnblock(u.id, name)}
                    style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: colors.primary,
                    }}
                >
                    <Text
                        style={{
                            color: colors.primary,
                            fontSize: 12,
                            fontWeight: "500",
                        }}
                    >
                        Bỏ chặn
                    </Text>
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <StatusBar style={colors.statusBar} />
            <SafeAreaView style={{ backgroundColor: colors.headerBg }} edges={["top"]}>
                {/* Header */}
                <View
                    style={{
                        height: 52,
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 16,
                        borderBottomWidth: colors.headerBg === "#0068FF" ? 0 : 0.5,
                        borderBottomColor: colors.border,
                        backgroundColor: colors.headerBg,
                        gap: 12,
                    }}
                >
                    <TouchableOpacity
                        onPress={() => {
                            if (router.canGoBack()) {
                                router.back();
                            } else {
                                router.replace("/(tabs)/settings");
                            }
                        }}
                        style={{ paddingRight: 8, paddingVertical: 4 }}
                        activeOpacity={0.8}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons
                            name="chevron-back"
                            size={26}
                            color={colors.headerText}
                        />
                    </TouchableOpacity>
                    <Text
                        style={{
                            color: colors.headerText,
                            fontSize: 18,
                            fontWeight: "600",
                        }}
                    >
                        Danh sách chặn tin nhắn
                    </Text>
                </View>
            </SafeAreaView>

            {error && (
                <View
                    style={{
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        backgroundColor: "#7f1d1d",
                    }}
                >
                    <Text
                        style={{
                            color: "#fee2e2",
                            fontSize: 12,
                        }}
                    >
                        {error}
                    </Text>
                </View>
            )}

            {loading && !blocked.length ? (
                <View
                    style={{
                        flex: 1,
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <Text
                        style={{
                            color: colors.textSecondary,
                            fontSize: 13,
                        }}
                    >
                        Đang tải danh sách chặn tin nhắn...
                    </Text>
                </View>
            ) : !blocked.length ? (
                <View
                    style={{
                        flex: 1,
                        alignItems: "center",
                        justifyContent: "center",
                        paddingHorizontal: 32,
                    }}
                >
                    <Text
                        style={{
                            color: colors.textSecondary,
                            fontSize: 14,
                            textAlign: "center",
                        }}
                    >
                        Bạn chưa chặn tin nhắn với ai.
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={blocked}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                />
            )}
        </View>
    );
}

