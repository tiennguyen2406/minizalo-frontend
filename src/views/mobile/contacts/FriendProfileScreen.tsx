import React from "react";
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    ScrollView,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { SafeView as SafeAreaView } from "@/shared/components/SafeView";
import { Ionicons } from "@expo/vector-icons";
import { useChatStore } from "@/shared/store/useChatStore";
import { useThemeColors } from "@/shared/theme/colors";

const COVER_HEIGHT = 240;
const AVATAR_SIZE = 100;

interface FriendProfileScreenProps {
    userId: string;
    displayName: string;
    avatarUrl?: string | null;
    coverUrl?: string | null;
    businessDescription?: string;
    statusMessage?: string;
    phone?: string;
}

export default function FriendProfileScreen({
    userId,
    displayName,
    avatarUrl,
    coverUrl,
    businessDescription,
    statusMessage,
    phone,
}: FriendProfileScreenProps) {
    const router = useRouter();
    const { rooms } = useChatStore();
    const colors = useThemeColors();
    const avatarInitial = (displayName || "?").charAt(0).toUpperCase();

    const handleMessage = async () => {
        let room = rooms.find(
            (r) => r.type === "PRIVATE" && r.participants?.some((p) => p.id === userId)
        );

        if (!room) {
            try {
                room = await useChatStore.getState().createPrivateRoom(userId);
            } catch (error) {
                console.error("Failed to create room:", error);
                return;
            }
        }

        if (room) {
            router.push(
                `/chat/${room.id}?name=${encodeURIComponent(displayName)}&type=DIRECT` as any
            );
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <StatusBar style={colors.statusBar} />

            <ScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                bounces={false}
            >
                {/* Cover + Avatar */}
                <View style={{ height: COVER_HEIGHT + AVATAR_SIZE / 2, position: "relative" }}>
                        {coverUrl ? (
                            <Image
                                source={{ uri: `${coverUrl}?t=${Date.now()}` }}
                                style={{
                                    height: COVER_HEIGHT,
                                    width: "100%",
                                }}
                                resizeMode="cover"
                            />
                        ) : (
                            <View
                                style={{
                                    height: COVER_HEIGHT,
                                    backgroundColor: "#1a2a3a",
                                    width: "100%",
                                }}
                            />
                        )}
                        <View
                            style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                right: 0,
                                height: 110,
                                backgroundColor: "rgba(0,0,0,0.4)",
                                zIndex: 1,
                            }}
                        />

                    {/* Top bar */}
                    <SafeAreaView
                        edges={["top"]}
                        style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            zIndex: 10,
                        }}
                    >
                        <View
                            style={{
                                height: 52,
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                                paddingHorizontal: 8,
                            }}
                        >
                            <TouchableOpacity
                                onPress={() => router.back()}
                                style={{ padding: 8 }}
                                activeOpacity={0.7}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name="chevron-back" size={26} color="#fff" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={{ padding: 8 }}
                                activeOpacity={0.7}
                                onPress={() => { }}
                            >
                                <Ionicons name="ellipsis-horizontal" size={22} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </SafeAreaView>

                    {/* Avatar */}
                    <View
                        style={{
                            position: "absolute",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            alignItems: "center",
                        }}
                    >
                        {avatarUrl ? (
                            <Image
                                source={{ uri: `${avatarUrl}?t=${Date.now()}` }}
                                style={{
                                    width: AVATAR_SIZE,
                                    height: AVATAR_SIZE,
                                    borderRadius: AVATAR_SIZE / 2,
                                    backgroundColor: colors.avatarBg,
                                }}
                            />
                        ) : (
                            <View
                                style={{
                                    width: AVATAR_SIZE,
                                    height: AVATAR_SIZE,
                                    borderRadius: AVATAR_SIZE / 2,
                                    backgroundColor: colors.avatarBg,
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <Text
                                    style={{
                                        color: colors.text,
                                        fontSize: 38,
                                        fontWeight: "600",
                                    }}
                                >
                                    {avatarInitial}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Name + Info */}
                <View style={{ alignItems: "center", paddingTop: 14, paddingHorizontal: 24 }}>
                    <Text
                        style={{
                            fontSize: 22,
                            fontWeight: "700",
                            color: colors.text,
                            textAlign: "center",
                        }}
                    >
                        {displayName}
                    </Text>

                    {businessDescription ? (
                        <Text
                            style={{
                                fontSize: 14,
                                color: colors.textSecondary,
                                marginTop: 6,
                                textAlign: "center",
                                lineHeight: 20,
                            }}
                        >
                            {businessDescription}
                        </Text>
                    ) : null}

                    {phone ? (
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                marginTop: 6,
                                gap: 4,
                            }}
                        >
                            <Ionicons name="call-outline" size={14} color={colors.textSecondary} />
                            <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                                {phone}
                            </Text>
                        </View>
                    ) : null}
                </View>

                {/* Separator */}
                <View style={{ height: 8, backgroundColor: colors.separator, marginTop: 20 }} />

                {/* Info section */}
                <View style={{ paddingHorizontal: 16, paddingVertical: 16 }}>
                    <Text
                        style={{
                            fontSize: 15,
                            fontWeight: "600",
                            color: colors.text,
                            marginBottom: 12,
                        }}
                    >
                        Thông tin
                    </Text>

                    {statusMessage ? (
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                paddingVertical: 8,
                                gap: 10,
                            }}
                        >
                            <Ionicons name="chatbubble-outline" size={16} color={colors.textSecondary} />
                            <Text style={{ color: colors.textSecondary, fontSize: 14, flex: 1 }}>
                                {statusMessage}
                            </Text>
                        </View>
                    ) : null}

                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: 8,
                            gap: 10,
                        }}
                    >
                        <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
                        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                            Đã kết bạn
                        </Text>
                    </View>

                    <TouchableOpacity
                        onPress={() => { }}
                        activeOpacity={0.7}
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: 8,
                            gap: 10,
                        }}
                    >
                        <Ionicons name="people-outline" size={16} color={colors.textSecondary} />
                        <Text style={{ flex: 1, color: colors.text, fontSize: 14 }}>
                            Xem nhóm chung (0)
                        </Text>
                        <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => { }}
                        activeOpacity={0.7}
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: 8,
                            gap: 10,
                        }}
                    >
                        <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                        <Text style={{ flex: 1, color: colors.text, fontSize: 14 }}>
                            Xem nhật ký chung
                        </Text>
                        <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                </View>

                <View style={{ height: 80 }} />
            </ScrollView>

            {/* Bottom: Nhắn tin button */}
            <SafeAreaView
                edges={["bottom"]}
                style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: colors.background,
                    borderTopWidth: 0.5,
                    borderTopColor: colors.border,
                }}
            >
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                    }}
                >
                    <TouchableOpacity
                        onPress={handleMessage}
                        activeOpacity={0.7}
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            backgroundColor: colors.searchBg,
                            borderRadius: 20,
                            paddingHorizontal: 18,
                            paddingVertical: 10,
                            gap: 8,
                        }}
                    >
                        <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.text} />
                        <Text
                            style={{
                                color: colors.text,
                                fontSize: 14,
                                fontWeight: "500",
                            }}
                        >
                            Nhắn tin
                        </Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </View>
    );
}
