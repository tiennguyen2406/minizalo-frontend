import React, { useCallback, useEffect, useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    Modal,
    Pressable,
    ActivityIndicator,
    Alert,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors, ThemeColors } from "@/shared/theme/colors";
import { useUserStore } from "@/shared/store/userStore";
import {
    PRIVACY_AUDIENCE_OPTIONS,
    labelForPrivacyAudience,
    normalizePrivacyAudience,
} from "@/shared/constants/privacyAudience";
import type { PrivacyAudience } from "@/shared/services/types";

interface SettingsItemProps {
    label: string;
    onPress?: () => void;
    colors: ThemeColors;
    icon?: string;
}

function SettingsItem({ label, onPress, colors, icon }: SettingsItemProps) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 16,
                paddingVertical: 16,
                backgroundColor: colors.card,
                borderBottomWidth: 0.5,
                borderBottomColor: colors.border,
            }}
        >
            {icon && (
                <Ionicons
                    name={icon as "lock-closed-outline"}
                    size={22}
                    color={colors.textSecondary}
                    style={{ marginRight: 12 }}
                />
            )}
            <Text
                style={{
                    color: colors.text,
                    fontSize: 15,
                    flex: 1,
                }}
            >
                {label}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
    );
}

export default function PrivacyScreen() {
    const router = useRouter();
    const colors = useThemeColors();
    const { profile, fetchProfile, updateProfile } = useUserStore();
    const [updating, setUpdating] = useState(false);
    const [pickerFor, setPickerFor] = useState<"messages" | "calls" | null>(null);
    const [messagePrivacyUi, setMessagePrivacyUi] = useState<PrivacyAudience>(() =>
        normalizePrivacyAudience(undefined),
    );
    const [callPrivacyUi, setCallPrivacyUi] = useState<PrivacyAudience>(() =>
        normalizePrivacyAudience(undefined),
    );

    useEffect(() => {
        void fetchProfile();
    }, [fetchProfile]);

    useEffect(() => {
        setMessagePrivacyUi(normalizePrivacyAudience(profile?.allowMessagesFrom));
        setCallPrivacyUi(normalizePrivacyAudience(profile?.allowCallsFrom));
    }, [profile?.id, profile?.allowMessagesFrom, profile?.allowCallsFrom]);

    const applyPrivacy = useCallback(
        async (field: "allowMessagesFrom" | "allowCallsFrom", value: PrivacyAudience) => {
            if (field === "allowMessagesFrom") setMessagePrivacyUi(value);
            else setCallPrivacyUi(value);
            setUpdating(true);
            setPickerFor(null);
            try {
                await updateProfile(
                    field === "allowMessagesFrom"
                        ? { allowMessagesFrom: value }
                        : { allowCallsFrom: value },
                );
            } catch {
                Alert.alert("Lỗi", "Không thể lưu cài đặt, vui lòng thử lại.");
                const p = useUserStore.getState().profile;
                setMessagePrivacyUi(normalizePrivacyAudience(p?.allowMessagesFrom));
                setCallPrivacyUi(normalizePrivacyAudience(p?.allowCallsFrom));
            } finally {
                setUpdating(false);
            }
        },
        [updateProfile],
    );

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
                        onPress={() => router.back()}
                        style={{ paddingRight: 16, paddingVertical: 4 }}
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
                        Quyền riêng tư
                    </Text>
                </View>
            </SafeAreaView>

            <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ marginTop: 16, paddingHorizontal: 16 }}>
                    <Text
                        style={{
                            fontSize: 16,
                            fontWeight: "700",
                            color: colors.text,
                            marginBottom: 10,
                        }}
                    >
                        Tin nhắn và cuộc gọi
                    </Text>
                    <View
                        style={{
                            backgroundColor: colors.card,
                            borderRadius: 10,
                            borderWidth: 0.5,
                            borderColor: colors.border,
                            overflow: "hidden",
                        }}
                    >
                        <TouchableOpacity
                            activeOpacity={0.75}
                            onPress={() => setPickerFor("messages")}
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                                paddingVertical: 14,
                                paddingHorizontal: 14,
                            }}
                        >
                            <View style={{ flex: 1, paddingRight: 12 }}>
                                <Text
                                    style={{
                                        fontSize: 15,
                                        fontWeight: "500",
                                        color: colors.text,
                                    }}
                                >
                                    Cho phép nhắn tin
                                </Text>
                                <Text
                                    style={{
                                        fontSize: 13,
                                        color: colors.textSecondary,
                                        marginTop: 4,
                                    }}
                                >
                                    Ai được nhắn tin cho bạn
                                </Text>
                            </View>
                            <View
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 4,
                                    maxWidth: "46%",
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 14,
                                        color: colors.textSecondary,
                                        flexShrink: 1,
                                        textAlign: "right",
                                    }}
                                    numberOfLines={2}
                                >
                                    {labelForPrivacyAudience(messagePrivacyUi)}
                                </Text>
                                <Ionicons
                                    name="chevron-down"
                                    size={18}
                                    color={colors.textSecondary}
                                />
                            </View>
                        </TouchableOpacity>
                        <View
                            style={{
                                height: 0.5,
                                backgroundColor: colors.border,
                                marginLeft: 14,
                            }}
                        />
                        <TouchableOpacity
                            activeOpacity={0.75}
                            onPress={() => setPickerFor("calls")}
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                                paddingVertical: 14,
                                paddingHorizontal: 14,
                            }}
                        >
                            <View style={{ flex: 1, paddingRight: 12 }}>
                                <Text
                                    style={{
                                        fontSize: 15,
                                        fontWeight: "500",
                                        color: colors.text,
                                    }}
                                >
                                    Cho phép gọi điện
                                </Text>
                                <Text
                                    style={{
                                        fontSize: 13,
                                        color: colors.textSecondary,
                                        marginTop: 4,
                                    }}
                                >
                                    Ai được gọi điện cho bạn
                                </Text>
                            </View>
                            <View
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 4,
                                    maxWidth: "46%",
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 14,
                                        color: colors.textSecondary,
                                        flexShrink: 1,
                                        textAlign: "right",
                                    }}
                                    numberOfLines={2}
                                >
                                    {labelForPrivacyAudience(callPrivacyUi)}
                                </Text>
                                <Ionicons
                                    name="chevron-down"
                                    size={18}
                                    color={colors.textSecondary}
                                />
                            </View>
                        </TouchableOpacity>
                    </View>
                    {updating ? (
                        <ActivityIndicator
                            size="small"
                            color={colors.primary}
                            style={{ marginTop: 12 }}
                        />
                    ) : null}
                </View>

                <View style={{ marginTop: 24 }}>
                    <SettingsItem
                        label="Đổi mật khẩu"
                        icon="lock-closed-outline"
                        onPress={() => router.push("/change-password")}
                        colors={colors}
                    />
                    <SettingsItem
                        label="Tự động thêm vào nhóm"
                        icon="people-outline"
                        onPress={() => {}}
                        colors={colors}
                    />
                    <SettingsItem
                        label="Hiển thị trạng thái truy cập"
                        icon="eye-outline"
                        onPress={() => {}}
                        colors={colors}
                    />
                    <SettingsItem 
                        label="Tin nhắn và cuộc gọi" 
                        icon="chatbubble-ellipses-outline"
                        onPress={() => {
                            console.log("=== MESSAGE AND CALL PRIVACY PRESSED ===");
                            router.push("/message-call-privacy");
                        }} 
                        colors={colors} 
                    />
                </View>
            </ScrollView>

            <Modal
                visible={pickerFor !== null}
                transparent
                animationType="fade"
                onRequestClose={() => setPickerFor(null)}
            >
                <Pressable
                    style={{
                        flex: 1,
                        backgroundColor: "rgba(0,0,0,0.45)",
                        justifyContent: "flex-end",
                    }}
                    onPress={() => setPickerFor(null)}
                >
                    <Pressable
                        onPress={() => {}}
                        style={{
                            backgroundColor: colors.card,
                            borderTopLeftRadius: 14,
                            borderTopRightRadius: 14,
                            paddingBottom: 28,
                            paddingTop: 8,
                        }}
                    >
                                <Text
                                    style={{
                                        textAlign: "center",
                                        fontSize: 13,
                                        color: colors.textSecondary,
                                        paddingVertical: 8,
                                    }}
                                >
                                    {pickerFor === "messages"
                                        ? "Ai được nhắn tin cho bạn"
                                        : "Ai được gọi điện cho bạn"}
                                </Text>
                                {PRIVACY_AUDIENCE_OPTIONS.map((o) => (
                                    <TouchableOpacity
                                        key={o.value}
                                        onPress={() => {
                                            if (!pickerFor) return;
                                            void applyPrivacy(
                                                pickerFor === "messages"
                                                    ? "allowMessagesFrom"
                                                    : "allowCallsFrom",
                                                o.value,
                                            );
                                        }}
                                        style={{
                                            paddingVertical: 16,
                                            paddingHorizontal: 20,
                                            borderTopWidth: 0.5,
                                            borderTopColor: colors.border,
                                        }}
                                    >
                                        <Text
                                            style={{
                                                fontSize: 16,
                                                color: colors.text,
                                                fontWeight:
                                                    (pickerFor === "messages"
                                                        ? messagePrivacyUi
                                                        : callPrivacyUi) === o.value
                                                        ? "700"
                                                        : "400",
                                            }}
                                        >
                                            {o.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                                <TouchableOpacity
                                    onPress={() => setPickerFor(null)}
                                    style={{
                                        marginTop: 8,
                                        marginHorizontal: 16,
                                        paddingVertical: 14,
                                        alignItems: "center",
                                        borderRadius: 10,
                                        backgroundColor: colors.background,
                                    }}
                                >
                                    <Text style={{ fontSize: 16, color: colors.textSecondary }}>
                                        Hủy
                                    </Text>
                                </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
}
