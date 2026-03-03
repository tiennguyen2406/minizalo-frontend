import React, { useState } from "react";
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    ScrollView,
    StatusBar,
    Dimensions,
    Modal,
    TextInput,
    Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { PROFILE_COLORS } from "./styles";
import type { UserProfile } from "@/shared/services/types";
import { useUserStore } from "@/shared/store/userStore";

const COVER_HEIGHT = 240;
const AVATAR_SIZE = 100;

interface PersonalProfileScreenProps {
    user?: UserProfile | null;
}

export default function PersonalProfileScreen({ user }: PersonalProfileScreenProps) {
    const router = useRouter();
    const { updateProfile } = useUserStore();

    const displayName =
        (user?.displayName?.trim() || user?.username?.trim() || "").trim() || "Người dùng";
    const avatarUrl = user?.avatarUrl ?? null;
    const avatarInitial = displayName.charAt(0).toUpperCase() || "U";
    const statusMessage = user?.statusMessage?.trim() || "";
    const businessDescription = user?.businessDescription?.trim() || "";

    const [introModalVisible, setIntroModalVisible] = useState(false);
    const [introText, setIntroText] = useState(businessDescription);
    const [saving, setSaving] = useState(false);

    const handleOpenIntroModal = () => {
        setIntroText(businessDescription);
        setIntroModalVisible(true);
    };

    const handleSaveIntro = async () => {
        setSaving(true);
        try {
            await updateProfile({ businessDescription: introText.trim() || undefined });
            setIntroModalVisible(false);
        } catch {
            Alert.alert("Lỗi", "Không thể cập nhật lời giới thiệu.");
        } finally {
            setSaving(false);
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
                {/* Cover + Avatar area */}
                <View style={{ height: COVER_HEIGHT + AVATAR_SIZE / 2, position: "relative" }}>
                    {/* Cover background */}
                    <View
                        style={{
                            height: COVER_HEIGHT,
                            backgroundColor: "#1a2a3a",
                            width: "100%",
                            overflow: "hidden",
                        }}
                    >
                        {/* Dark gradient overlay for top buttons visibility */}
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

                    {/* Top bar overlay */}
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
                            {/* Left: Back button */}
                            <TouchableOpacity
                                onPress={() => router.replace("/(tabs)/account")}
                                style={{ padding: 8 }}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="chevron-back" size={26} color="#fff" />
                            </TouchableOpacity>

                            {/* Right: Search person + 3-dot menu */}
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                <TouchableOpacity
                                    onPress={() => router.push("/(tabs)/profile-settings")}
                                    style={{ padding: 8 }}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="ellipsis-horizontal" size={22} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </SafeAreaView>

                    {/* "Trạng thái hiện tại" label */}
                    {statusMessage ? (
                        <View
                            style={{
                                position: "absolute",
                                bottom: AVATAR_SIZE / 2 + 10,
                                right: Dimensions.get("window").width / 2 - AVATAR_SIZE / 2 - 100,
                                backgroundColor: "rgba(0,0,0,0.55)",
                                borderRadius: 8,
                                paddingHorizontal: 10,
                                paddingVertical: 5,
                                zIndex: 5,
                            }}
                        >
                            <Text style={{ color: "#ddd", fontSize: 11 }}>
                                Trạng thái hiện tại
                            </Text>
                        </View>
                    ) : null}

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

                {/* Name */}
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
                    {statusMessage ? (
                        <Text
                            style={{
                                fontSize: 14,
                                color: PROFILE_COLORS.textSecondary,
                                marginTop: 6,
                                textAlign: "center",
                            }}
                        >
                            {statusMessage}
                        </Text>
                    ) : null}

                    {/* Lời giới thiệu hoặc link "Chỉnh sửa lời giới thiệu" */}
                    {businessDescription ? (
                        <TouchableOpacity
                            onPress={handleOpenIntroModal}
                            activeOpacity={0.7}
                            style={{ marginTop: 8 }}
                        >
                            <Text
                                style={{
                                    fontSize: 14,
                                    color: PROFILE_COLORS.textSecondary,
                                    textAlign: "center",
                                    lineHeight: 20,
                                }}
                            >
                                {businessDescription}
                            </Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            onPress={handleOpenIntroModal}
                            activeOpacity={0.7}
                            style={{ marginTop: 8 }}
                        >
                            <Text
                                style={{
                                    fontSize: 14,
                                    color: PROFILE_COLORS.primary,
                                    textAlign: "center",
                                    fontWeight: "500",
                                }}
                            >
                                Chỉnh sửa lời giới thiệu
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Action buttons row */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{
                        paddingHorizontal: 16,
                        paddingTop: 20,
                        paddingBottom: 4,
                        gap: 10,
                    }}
                >
                    {[
                        { icon: "color-palette-outline" as const, label: "Cài zStyle" },
                        { icon: "images-outline" as const, label: "Ảnh của tôi" },
                        { icon: "film-outline" as const, label: "Kho khoảnh khắc" },
                    ].map((item) => (
                        <TouchableOpacity
                            key={item.label}
                            activeOpacity={0.6}
                            onPress={() => { }}
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                backgroundColor: "#1c1c1e",
                                borderRadius: 20,
                                paddingHorizontal: 14,
                                paddingVertical: 10,
                                gap: 6,
                            }}
                        >
                            <Ionicons name={item.icon} size={18} color={PROFILE_COLORS.primary} />
                            <Text
                                style={{
                                    color: PROFILE_COLORS.text,
                                    fontSize: 13,
                                    fontWeight: "500",
                                }}
                            >
                                {item.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Separator */}
                <View style={{ height: 8, backgroundColor: "#1c1c1e", marginTop: 16 }} />

                {/* Diary section */}
                <View
                    style={{
                        alignItems: "center",
                        paddingVertical: 44,
                        paddingHorizontal: 32,
                    }}
                >
                    {/* Floating icons */}
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            marginBottom: 24,
                        }}
                    >
                        <View
                            style={{
                                width: 34,
                                height: 34,
                                borderRadius: 17,
                                backgroundColor: "#ef4444",
                                alignItems: "center",
                                justifyContent: "center",
                                marginRight: -8,
                                zIndex: 3,
                            }}
                        >
                            <Ionicons name="heart" size={16} color="#fff" />
                        </View>
                        <View
                            style={{
                                width: 50,
                                height: 50,
                                borderRadius: 25,
                                backgroundColor: PROFILE_COLORS.primary,
                                alignItems: "center",
                                justifyContent: "center",
                                zIndex: 2,
                            }}
                        >
                            <Ionicons name="chatbubble-ellipses" size={24} color="#fff" />
                        </View>
                        <View
                            style={{
                                width: 34,
                                height: 34,
                                borderRadius: 17,
                                backgroundColor: "#22c55e",
                                alignItems: "center",
                                justifyContent: "center",
                                marginLeft: -8,
                                zIndex: 3,
                            }}
                        >
                            <Ionicons name="chatbox" size={15} color="#fff" />
                        </View>
                    </View>

                    <Text
                        style={{
                            fontSize: 16,
                            fontWeight: "600",
                            color: PROFILE_COLORS.text,
                            textAlign: "center",
                            marginBottom: 8,
                        }}
                    >
                        Hôm nay {displayName} có gì vui?
                    </Text>
                    <Text
                        style={{
                            fontSize: 13,
                            color: PROFILE_COLORS.textSecondary,
                            textAlign: "center",
                            lineHeight: 20,
                            marginBottom: 24,
                        }}
                    >
                        Đây là Nhật ký của bạn – Hãy làm đầy Nhật ký với những{"\n"}
                        dấu ấn cuộc đời và kỷ niệm đáng nhớ nhé!
                    </Text>

                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => { }}
                        style={{
                            backgroundColor: PROFILE_COLORS.primary,
                            borderRadius: 22,
                            paddingHorizontal: 28,
                            paddingVertical: 11,
                        }}
                    >
                        <Text
                            style={{
                                color: '#fff',
                                fontSize: 14,
                                fontWeight: "600",
                            }}
                        >
                            Đăng lên Nhật ký
                        </Text>
                    </TouchableOpacity>
                </View>

                <View style={{ height: 60 }} />
            </ScrollView>

            {/* Modal chỉnh sửa lời giới thiệu */}
            <Modal
                transparent
                visible={introModalVisible}
                animationType="fade"
                onRequestClose={() => setIntroModalVisible(false)}
            >
                <View
                    style={{
                        flex: 1,
                        backgroundColor: "rgba(0,0,0,0.6)",
                        justifyContent: "center",
                        alignItems: "center",
                    }}
                >
                    <View
                        style={{
                            width: "88%",
                            backgroundColor: "#18181b",
                            borderRadius: 16,
                            padding: 20,
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 17,
                                fontWeight: "600",
                                color: PROFILE_COLORS.text,
                                textAlign: "center",
                                marginBottom: 16,
                            }}
                        >
                            Lời giới thiệu
                        </Text>

                        <TextInput
                            style={{
                                backgroundColor: PROFILE_COLORS.searchBg,
                                borderRadius: 10,
                                paddingHorizontal: 14,
                                paddingVertical: 12,
                                fontSize: 15,
                                color: PROFILE_COLORS.text,
                                height: 100,
                                textAlignVertical: "top",
                            }}
                            value={introText}
                            onChangeText={setIntroText}
                            placeholder="Giới thiệu ngắn gọn về bạn..."
                            placeholderTextColor={PROFILE_COLORS.textSecondary}
                            multiline
                            numberOfLines={4}
                            autoFocus
                        />

                        <View
                            style={{
                                flexDirection: "row",
                                justifyContent: "flex-end",
                                marginTop: 16,
                                gap: 10,
                            }}
                        >
                            <TouchableOpacity
                                onPress={() => setIntroModalVisible(false)}
                                style={{
                                    paddingVertical: 9,
                                    paddingHorizontal: 18,
                                    borderRadius: 20,
                                    borderWidth: 1,
                                    borderColor: "#3a3a3c",
                                }}
                                activeOpacity={0.7}
                            >
                                <Text style={{ color: PROFILE_COLORS.textSecondary, fontSize: 14 }}>
                                    Hủy
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleSaveIntro}
                                disabled={saving}
                                style={{
                                    paddingVertical: 9,
                                    paddingHorizontal: 18,
                                    borderRadius: 20,
                                    backgroundColor: PROFILE_COLORS.primary,
                                    opacity: saving ? 0.6 : 1,
                                }}
                                activeOpacity={0.7}
                            >
                                <Text
                                    style={{
                                        color: "#fff",
                                        fontSize: 14,
                                        fontWeight: "600",
                                    }}
                                >
                                    {saving ? "Đang lưu..." : "Lưu"}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
