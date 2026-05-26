import React, { useState } from "react";
import {
    ActionSheetIOS,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { SafeView as SafeAreaView } from "@/shared/components/SafeView";
import { Ionicons } from "@expo/vector-icons";
import type { UserProfile } from "@/shared/services/types";
import { useImagePicker } from "@/shared/hooks/useImagePicker";
import { useUserStore } from "@/shared/store/userStore";
import { useThemeColors, ThemeColors } from "@/shared/theme/colors";

interface ProfileSettingsScreenProps {
    user?: UserProfile | null;
}

interface SettingsItemProps {
    label: string;
    onPress?: () => void;
    isHeader?: boolean;
    colors: ThemeColors;
}

function SettingsItem({ label, onPress, isHeader, colors }: SettingsItemProps) {
    if (isHeader) {
        return (
            <View
                style={{
                    paddingHorizontal: 16,
                    paddingTop: 16,
                    paddingBottom: 10,
                    backgroundColor: colors.background,
                    borderBottomWidth: 0.5,
                    borderBottomColor: colors.border,
                }}
            >
                <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "600" }}>
                    {label}
                </Text>
            </View>
        );
    }

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            style={{
                paddingHorizontal: 16,
                paddingVertical: 18,
                backgroundColor: colors.card,
                borderBottomWidth: 0.5,
                borderBottomColor: colors.border,
                minHeight: 56,
            }}
        >
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: "500" }}>
                {label}
            </Text>
        </TouchableOpacity>
    );
}

export default function ProfileSettingsScreen({ user }: ProfileSettingsScreenProps) {
    const router = useRouter();
    const colors = useThemeColors();
    const updateProfile = useUserStore((s) => s.updateProfile);
    const avatarPicker = useImagePicker({ folder: "avatars/", aspect: [1, 1], allowsEditing: true });
    const coverPicker = useImagePicker({ folder: "covers/", aspect: [3, 2], allowsEditing: true });

    const [introVisible, setIntroVisible] = useState(false);
    const [introText, setIntroText] = useState(user?.businessDescription?.trim() || "");
    const [savingIntro, setSavingIntro] = useState(false);
    const [savingImage, setSavingImage] = useState<"avatar" | "cover" | null>(null);

    const displayName =
        (user?.displayName?.trim() || user?.username?.trim() || "").trim() || "Người dùng";

    const openIntroModal = () => {
        setIntroText(user?.businessDescription?.trim() || "");
        setIntroVisible(true);
    };

    const saveIntro = async () => {
        setSavingIntro(true);
        try {
            await updateProfile({ businessDescription: introText.trim() || undefined });
            setIntroVisible(false);
            Alert.alert("Thành công", "Đã cập nhật giới thiệu bản thân.");
        } catch {
            Alert.alert("Lỗi", "Không thể cập nhật giới thiệu bản thân.");
        } finally {
            setSavingIntro(false);
        }
    };

    const handleImageAction = async (
        type: "avatar" | "cover",
        picker: ReturnType<typeof useImagePicker>,
    ) => {
        const saveUrl = async (url: string) => {
            if (type === "avatar") {
                await updateProfile({ avatarUrl: url });
            } else {
                await updateProfile({ coverPhotoUrl: url });
            }
        };

        const processSelection = async (index: number) => {
            try {
                const asset =
                    index === 1 ? await picker.takePhoto() : index === 2 ? await picker.pickImage() : null;
                if (!asset) return;

                setSavingImage(type);
                const url = await picker.upload(asset);
                if (!url) {
                    Alert.alert("Lỗi", "Không thể tải ảnh lên.");
                    return;
                }

                await saveUrl(url);
                Alert.alert("Thành công", type === "avatar" ? "Đã đổi ảnh đại diện." : "Đã đổi ảnh bìa.");
            } catch {
                Alert.alert("Lỗi", "Không thể cập nhật hình ảnh.");
            } finally {
                setSavingImage(null);
            }
        };

        if (Platform.OS === "ios") {
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options: ["Hủy", "Chụp ảnh mới", "Chọn từ thư viện"],
                    cancelButtonIndex: 0,
                    title: type === "avatar" ? "Đổi ảnh đại diện" : "Đổi ảnh bìa",
                },
                processSelection,
            );
            return;
        }

        Alert.alert(type === "avatar" ? "Đổi ảnh đại diện" : "Đổi ảnh bìa", "Bạn muốn chọn ảnh từ đâu?", [
            { text: "Hủy", style: "cancel" },
            { text: "Chụp ảnh mới", onPress: () => processSelection(1) },
            { text: "Chọn từ thư viện", onPress: () => processSelection(2) },
        ]);
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <StatusBar style={colors.statusBar} />

            <SafeAreaView style={{ backgroundColor: colors.headerBg }} edges={["top"]}>
                <View
                    style={{
                        height: 52,
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 16,
                        backgroundColor: colors.headerBg,
                        borderBottomWidth: colors.headerBg === "#0068FF" ? 0 : 0.5,
                        borderBottomColor: colors.border,
                    }}
                >
                    <TouchableOpacity
                        onPress={() => {
                            if (router.canGoBack()) router.back();
                            else router.replace("/(tabs)/personal-profile");
                        }}
                        style={{ paddingRight: 8, paddingVertical: 4 }}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="chevron-back" size={26} color={colors.headerText} />
                    </TouchableOpacity>
                    <Text
                        style={{
                            fontSize: 18,
                            fontWeight: "600",
                            color: colors.headerText,
                            flex: 1,
                        }}
                    >
                        {displayName}
                    </Text>
                    {savingImage ? <ActivityIndicator size="small" color={colors.headerText} /> : null}
                </View>
            </SafeAreaView>

            <ScrollView showsVerticalScrollIndicator={false} style={{ backgroundColor: colors.background }}>
                <SettingsItem
                    label="Thông tin"
                    onPress={() => router.push("/(tabs)/account-edit")}
                    colors={colors}
                />
                <SettingsItem
                    label="Đổi ảnh đại diện"
                    onPress={() => handleImageAction("avatar", avatarPicker)}
                    colors={colors}
                />
                <SettingsItem
                    label="Đổi ảnh bìa"
                    onPress={() => handleImageAction("cover", coverPicker)}
                    colors={colors}
                />
                <SettingsItem
                    label="Cập nhật giới thiệu bản thân"
                    onPress={openIntroModal}
                    colors={colors}
                />

                <View style={{ height: 8, backgroundColor: colors.separator }} />

                <SettingsItem label="Cài đặt" isHeader colors={colors} />
                <SettingsItem
                    label="Quyền riêng tư"
                    onPress={() => router.push("/privacy")}
                    colors={colors}
                />
                <SettingsItem
                    label="Quản lý tài khoản"
                    onPress={() => router.push("/account-security")}
                    colors={colors}
                />
                <SettingsItem
                    label="Cài đặt chung"
                    onPress={() => router.push("/(tabs)/settings")}
                    colors={colors}
                />

                <View style={{ height: 48 }} />
            </ScrollView>

            <Modal
                transparent
                visible={introVisible}
                animationType="slide"
                onRequestClose={() => setIntroVisible(false)}
            >
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => setIntroVisible(false)}
                    style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)" }}
                />
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : undefined}
                    style={{
                        backgroundColor: colors.card,
                        borderTopLeftRadius: 20,
                        borderTopRightRadius: 20,
                        padding: 20,
                        paddingBottom: Platform.OS === "ios" ? 34 : 24,
                    }}
                >
                    <View
                        style={{
                            width: 40,
                            height: 4,
                            borderRadius: 2,
                            backgroundColor: colors.border,
                            alignSelf: "center",
                            marginBottom: 18,
                        }}
                    />
                    <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700", textAlign: "center" }}>
                        Giới thiệu bản thân
                    </Text>
                    <TextInput
                        value={introText}
                        onChangeText={setIntroText}
                        placeholder="Viết vài dòng giới thiệu về bạn"
                        placeholderTextColor={colors.textSecondary}
                        multiline
                        textAlignVertical="top"
                        style={{
                            minHeight: 120,
                            marginTop: 18,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: colors.background,
                            color: colors.text,
                            paddingHorizontal: 14,
                            paddingVertical: 12,
                            fontSize: 15,
                            lineHeight: 21,
                        }}
                    />
                    <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => setIntroVisible(false)}
                            style={{
                                flex: 1,
                                height: 46,
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: colors.border,
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <Text style={{ color: colors.text, fontWeight: "700" }}>Hủy</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={saveIntro}
                            disabled={savingIntro}
                            style={{
                                flex: 1,
                                height: 46,
                                borderRadius: 12,
                                backgroundColor: colors.primary,
                                alignItems: "center",
                                justifyContent: "center",
                                opacity: savingIntro ? 0.7 : 1,
                            }}
                        >
                            <Text style={{ color: "#fff", fontWeight: "700" }}>
                                {savingIntro ? "Đang lưu..." : "Lưu"}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}
