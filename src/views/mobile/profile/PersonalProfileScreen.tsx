import React, { useState } from "react";
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    ScrollView,
    Dimensions,
    Modal,
    TextInput,
    Alert,
    ActivityIndicator,
    ActionSheetIOS,
    Platform,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import type { UserProfile } from "@/shared/services/types";
import { useUserStore } from "@/shared/store/userStore";
import { useThemeColors } from "@/shared/theme/colors";
import { useImagePicker } from "@/shared/hooks/useImagePicker";

const COVER_HEIGHT = 240;
const AVATAR_SIZE = 100;

interface PersonalProfileScreenProps {
    user?: UserProfile | null;
}

export default function PersonalProfileScreen({ user }: PersonalProfileScreenProps) {
    const router = useRouter();
    const { updateProfile } = useUserStore();
    const colors = useThemeColors();

    const displayName =
        (user?.displayName?.trim() || user?.username?.trim() || "").trim() || "Người dùng";
    const avatarUrl = user?.avatarUrl ?? null;
    const avatarInitial = displayName.charAt(0).toUpperCase() || "U";
    const statusMessage = user?.statusMessage?.trim() || "";
    const businessDescription = user?.businessDescription?.trim() || "";

    const [introModalVisible, setIntroModalVisible] = useState(false);
    const [introText, setIntroText] = useState(businessDescription);
    const [saving, setSaving] = useState(false);

    // Hooks for images
    const avatarPicker = useImagePicker({ folder: "avatars/", aspect: [1, 1], allowsEditing: true });
    const coverPicker = useImagePicker({ folder: "covers/", aspect: [3, 2], allowsEditing: true });

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

    const handleImageAction = async (
        picker: ReturnType<typeof useImagePicker>,
        onSuccess: (url: string) => Promise<void>
    ) => {
        const options = ["Hủy", "Chụp ảnh mới", "Chọn từ thư viện"];
        
        const processSelection = async (index: number) => {
            let asset = null;
            if (index === 1) asset = await picker.takePhoto();
            else if (index === 2) asset = await picker.pickImage();
            
            if (asset) {
                const url = await picker.upload(asset);
                if (url) {
                    try {
                        await onSuccess(url);
                        Alert.alert("Thành công", "Đã cập nhật hình ảnh.");
                    } catch {
                        Alert.alert("Lỗi", "Không thể lưu hình ảnh mới.");
                    }
                }
            }
        };

        if (Platform.OS === "ios") {
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options,
                    cancelButtonIndex: 0,
                    title: "Thay đổi hình ảnh",
                },
                processSelection
            );
        } else {
            Alert.alert("Thay đổi hình ảnh", "Bạn muốn chọn ảnh từ đâu?", [
                { text: "Hủy", style: "cancel" },
                { text: "Chụp ảnh mới", onPress: () => processSelection(1) },
                { text: "Chọn từ thư viện", onPress: () => processSelection(2) },
            ]);
        }
    };

    const handleChangeAvatar = () => {
        handleImageAction(avatarPicker, (url) => updateProfile({ avatarUrl: url }));
    };

    const handleChangeCover = () => {
        handleImageAction(coverPicker, (url) => updateProfile({ coverPhotoUrl: url }));
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <StatusBar style="light" />

            <ScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                bounces={false}
            >
                {/* Cover + Avatar area */}
                <View style={{ height: COVER_HEIGHT + AVATAR_SIZE / 2, position: "relative" }}>
                    {/* Cover background */}
                    <View style={{ height: COVER_HEIGHT, width: "100%", position: 'relative', overflow: 'hidden' }}>
                        {user?.coverPhotoUrl ? (
                            <Image
                                key={user.coverPhotoUrl}
                                source={{ uri: `${user.coverPhotoUrl}?t=${Date.now()}` }}
                                style={{ width: "100%", height: COVER_HEIGHT }}
                                resizeMode="cover"
                                onError={(e) => console.log("Cover Load Error:", e.nativeEvent.error, user.coverPhotoUrl)}
                            />
                        ) : (
                            <View
                                style={{
                                    height: COVER_HEIGHT,
                                    backgroundColor: colors.primary, // Zalo blue as primary
                                    width: "100%",
                                }}
                            />
                        )}

                        {/* Top bar overlay gradient */}
                        <View
                            style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                right: 0,
                                height: 120,
                                backgroundColor: "rgba(0,0,0,0.25)",
                                zIndex: 1,
                            }}
                        />

                        {/* Change Cover Button */}
                        <TouchableOpacity
                            onPress={handleChangeCover}
                            disabled={coverPicker.uploading}
                            style={{
                                position: "absolute",
                                bottom: 16,
                                right: 16,
                                backgroundColor: "rgba(0,0,0,0.4)",
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                alignItems: "center",
                                justifyContent: "center",
                                zIndex: 30, // Higher than top bar/avatar if needed
                                borderWidth: 1,
                                borderColor: 'rgba(255,255,255,0.4)',
                            }}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            {coverPicker.uploading ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Ionicons name="camera" size={22} color="#fff" />
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Top bar overlay */}
                    <SafeAreaView
                        edges={["top"]}
                        pointerEvents="box-none"
                        style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            zIndex: 10,
                        }}
                    >
                        <View
                            pointerEvents="box-none"
                            style={{
                                height: 52,
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                                paddingHorizontal: 8,
                            }}
                        >
                            {/* Left: Back button */}
                            <TouchableOpacity
                                onPress={() => router.back()}
                                style={{ padding: 8 }}
                                activeOpacity={0.7}
                                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                            >
                                <Ionicons name="chevron-back" size={28} color="#fff" />
                            </TouchableOpacity>

                            {/* Right: Search person + 3-dot menu */}
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                <TouchableOpacity
                                    onPress={() => router.push("/(tabs)/profile-settings")}
                                    style={{ padding: 8 }}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
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
                        pointerEvents="box-none"
                        style={{
                            position: "absolute",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            alignItems: "center",
                            zIndex: 20,
                        }}
                    >
                        <View style={{ position: "relative" }}>
                            {avatarUrl ? (
                                <Image
                                    key={avatarUrl}
                                    source={{ 
                                        uri: `${avatarUrl}?t=${Date.now()}`,
                                    }}
                                    style={{
                                        width: AVATAR_SIZE,
                                        height: AVATAR_SIZE,
                                        borderRadius: AVATAR_SIZE / 2,
                                        borderWidth: 3,
                                        borderColor: colors.background,
                                        backgroundColor: "#f0f2f5",
                                    }}
                                    onError={(e) => console.log("Avatar Load Error:", e.nativeEvent.error, avatarUrl)}
                                />
                            ) : (
                                <View
                                    style={{
                                        width: AVATAR_SIZE,
                                        height: AVATAR_SIZE,
                                        borderRadius: AVATAR_SIZE / 2,
                                        borderWidth: 3,
                                        borderColor: colors.background,
                                        backgroundColor: "#f0f2f5",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <Text
                                        style={{
                                            color: colors.primary,
                                            fontSize: 40,
                                            fontWeight: "700",
                                        }}
                                    >
                                        {avatarInitial}
                                    </Text>
                                </View>
                            )}
                            
                            {/* Change Avatar Button */}
                            <TouchableOpacity
                                onPress={handleChangeAvatar}
                                disabled={avatarPicker.uploading}
                                style={{
                                    position: "absolute",
                                    bottom: 0,
                                    right: 0,
                                    backgroundColor: colors.card,
                                    width: 32,
                                    height: 32,
                                    borderRadius: 16,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    elevation: 4,
                                    shadowColor: "#000",
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.15,
                                    shadowRadius: 4,
                                    zIndex: 25,
                                }}
                            >
                                {avatarPicker.uploading ? (
                                    <ActivityIndicator size="small" color={colors.primary} />
                                ) : (
                                    <Ionicons name="camera" size={18} color={colors.text} />
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* Name */}
                <View style={{ alignItems: "center", paddingTop: 16, paddingHorizontal: 24 }}>
                    <Text
                        style={{
                            fontSize: 24,
                            fontWeight: "700",
                            color: colors.text,
                            textAlign: "center",
                        }}
                    >
                        {displayName}
                    </Text>
                    {statusMessage ? (
                        <Text
                            style={{
                                fontSize: 14,
                                color: colors.textSecondary,
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
                                    color: colors.textSecondary,
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
                                    color: colors.primary,
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
                                backgroundColor: colors.searchBg,
                                borderRadius: 20,
                                paddingHorizontal: 14,
                                paddingVertical: 10,
                                gap: 6,
                            }}
                        >
                            <Ionicons name={item.icon} size={18} color={colors.primary} />
                            <Text
                                style={{
                                    color: colors.text,
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
                <View style={{ height: 8, backgroundColor: colors.separator, marginTop: 16 }} />

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
                                backgroundColor: colors.primary,
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
                            color: colors.text,
                            textAlign: "center",
                            marginBottom: 8,
                        }}
                    >
                        Hôm nay {displayName} có gì vui?
                    </Text>
                    <Text
                        style={{
                            fontSize: 13,
                            color: colors.textSecondary,
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
                            backgroundColor: colors.primary,
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
                            backgroundColor: colors.card,
                            borderRadius: 16,
                            padding: 20,
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 17,
                                fontWeight: "600",
                                color: colors.text,
                                textAlign: "center",
                                marginBottom: 16,
                            }}
                        >
                            Lời giới thiệu
                        </Text>

                        <TextInput
                            style={{
                                backgroundColor: colors.searchBg,
                                borderRadius: 10,
                                paddingHorizontal: 14,
                                paddingVertical: 12,
                                fontSize: 15,
                                color: colors.text,
                                height: 100,
                                textAlignVertical: "top",
                            }}
                            value={introText}
                            onChangeText={setIntroText}
                            placeholder="Giới thiệu ngắn gọn về bạn..."
                            placeholderTextColor={colors.textSecondary}
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
                                    borderColor: colors.border,
                                }}
                                activeOpacity={0.7}
                            >
                                <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
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
                                    backgroundColor: colors.primary,
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
