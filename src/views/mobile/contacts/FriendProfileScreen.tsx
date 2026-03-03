import React from "react";
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    ScrollView,
    StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { PROFILE_COLORS } from "../profile/styles";
import { useChatStore } from "@/shared/store/useChatStore";

const COVER_HEIGHT = 240;
const AVATAR_SIZE = 100;

interface FriendProfileScreenProps {
    userId: string;
    displayName: string;
    avatarUrl?: string | null;
    businessDescription?: string;
    statusMessage?: string;
    phone?: string;
}

export default function FriendProfileScreen({
    userId,
    displayName,
    avatarUrl,
    businessDescription,
    statusMessage,
    phone,
}: FriendProfileScreenProps) {
    const router = useRouter();
    const { rooms } = useChatStore();
    const avatarInitial = (displayName || "?").charAt(0).toUpperCase();

    const handleMessage = () => {
        const room = rooms.find(
            (r) => r.type === "PRIVATE" && r.participants?.some((p) => p.id === userId)
        );
        if (room) {
            router.push(
                `/chat/${room.id}?name=${encodeURIComponent(displayName)}&type=DIRECT` as any
            );
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: PROFILE_COLORS.background }}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            <ScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                bounces={false}
            >
                {/* Cover + Avatar */}
                <View style={{ height: COVER_HEIGHT + AVATAR_SIZE / 2, position: "relative" }}>
                    <View
                        style={{
                            height: COVER_HEIGHT,
                            backgroundColor: "#1a2a3a",
                            width: "100%",
                            overflow: "hidden",
                        }}
                    >
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
                    </View>

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
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                                paddingHorizontal: 8,
                                paddingVertical: 6,
                            }}
                        >
                            <TouchableOpacity
                                onPress={() => router.navigate("/(tabs)/contacts" as any)}
                                style={{ padding: 8 }}
                                activeOpacity={0.7}
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
                                source={{ uri: avatarUrl }}
                                style={{
                                    width: AVATAR_SIZE,
                                    height: AVATAR_SIZE,
                                    borderRadius: AVATAR_SIZE / 2,
                                    borderWidth: 3,
                                    borderColor: PROFILE_COLORS.background,
                                    backgroundColor: PROFILE_COLORS.card,
                                }}
                            />
                        ) : (
                            <View
                                style={{
                                    width: AVATAR_SIZE,
                                    height: AVATAR_SIZE,
                                    borderRadius: AVATAR_SIZE / 2,
                                    borderWidth: 3,
                                    borderColor: PROFILE_COLORS.background,
                                    backgroundColor: PROFILE_COLORS.card,
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <Text
                                    style={{
                                        color: PROFILE_COLORS.text,
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
                            color: PROFILE_COLORS.text,
                            textAlign: "center",
                        }}
                    >
                        {displayName}
                    </Text>

                    {businessDescription ? (
                        <Text
                            style={{
                                fontSize: 14,
                                color: PROFILE_COLORS.textSecondary,
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
                            <Ionicons name="call-outline" size={14} color={PROFILE_COLORS.textSecondary} />
                            <Text style={{ fontSize: 13, color: PROFILE_COLORS.textSecondary }}>
                                {phone}
                            </Text>
                        </View>
                    ) : null}
                </View>

                {/* Separator */}
                <View style={{ height: 8, backgroundColor: "#1c1c1e", marginTop: 20 }} />

                {/* Info section */}
                <View style={{ paddingHorizontal: 16, paddingVertical: 16 }}>
                    <Text
                        style={{
                            fontSize: 15,
                            fontWeight: "600",
                            color: PROFILE_COLORS.text,
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
                            <Ionicons name="chatbubble-outline" size={16} color={PROFILE_COLORS.textSecondary} />
                            <Text style={{ color: PROFILE_COLORS.textSecondary, fontSize: 14, flex: 1 }}>
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
                        <Ionicons name="person-outline" size={16} color={PROFILE_COLORS.textSecondary} />
                        <Text style={{ color: PROFILE_COLORS.textSecondary, fontSize: 14 }}>
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
                        <Ionicons name="people-outline" size={16} color={PROFILE_COLORS.textSecondary} />
                        <Text style={{ flex: 1, color: PROFILE_COLORS.text, fontSize: 14 }}>
                            Xem nhóm chung (0)
                        </Text>
                        <Ionicons name="chevron-forward" size={16} color={PROFILE_COLORS.textSecondary} />
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
                        <Ionicons name="time-outline" size={16} color={PROFILE_COLORS.textSecondary} />
                        <Text style={{ flex: 1, color: PROFILE_COLORS.text, fontSize: 14 }}>
                            Xem nhật ký chung
                        </Text>
                        <Ionicons name="chevron-forward" size={16} color={PROFILE_COLORS.textSecondary} />
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
                    backgroundColor: PROFILE_COLORS.background,
                    borderTopWidth: 0.5,
                    borderTopColor: "#2a2a2a",
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
                            backgroundColor: "#27272a",
                            borderRadius: 20,
                            paddingHorizontal: 18,
                            paddingVertical: 10,
                            gap: 8,
                        }}
                    >
                        <Ionicons name="chatbubble-ellipses-outline" size={18} color={PROFILE_COLORS.text} />
                        <Text
                            style={{
                                color: PROFILE_COLORS.text,
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
