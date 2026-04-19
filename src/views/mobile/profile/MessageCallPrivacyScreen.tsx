import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Modal, Pressable, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { SafeView as SafeAreaView } from "@/shared/components/SafeView";
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
    value?: string;
    onPress?: () => void;
    colors: ThemeColors;
    icon?: string;
    isHeader?: boolean;
}

function SettingsItem({ label, value, onPress, colors, icon, isHeader }: SettingsItemProps) {
    if (isHeader) {
        return (
            <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.background }}>
                <Text style={{ color: "#0068FF", fontSize: 14, fontWeight: "600" }}>{label}</Text>
            </View>
        );
    }

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
                    name={icon as any}
                    size={22}
                    color={colors.textSecondary}
                    style={{ marginRight: 12 }}
                />
            )}
            <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 16 }}>{label}</Text>
            </View>
            {value && (
                <Text style={{ color: colors.textSecondary, fontSize: 14, marginRight: 8 }}>
                    {value}
                </Text>
            )}
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
    );
}

export default function MessageCallPrivacyScreen() {
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
                        Tin nhắn và cuộc gọi
                    </Text>
                </View>
            </SafeAreaView>

            <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ marginTop: 0 }}>
                    <SettingsItem label="Tin nhắn và cuộc gọi" isHeader colors={colors} />

                    <SettingsItem
                        label="Hiện trạng thái 'Đã xem'"
                        value="Đang bật"
                        icon="eye-outline"
                        onPress={() => {}}
                        colors={colors}
                    />

                    <SettingsItem
                        label="Cho phép nhắn tin"
                        value={labelForPrivacyAudience(messagePrivacyUi)}
                        icon="chatbubble-outline"
                        onPress={() => setPickerFor("messages")}
                        colors={colors}
                    />

                    <SettingsItem
                        label="Cho phép gọi điện"
                        value={labelForPrivacyAudience(callPrivacyUi)}
                        icon="call-outline"
                        onPress={() => setPickerFor("calls")}
                        colors={colors}
                    />
                </View>

                {updating ? (
                    <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 14 }} />
                ) : null}
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
                                        pickerFor === "messages" ? "allowMessagesFrom" : "allowCallsFrom",
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
                                            (pickerFor === "messages" ? messagePrivacyUi : callPrivacyUi) === o.value
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
