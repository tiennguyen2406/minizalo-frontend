import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, Modal, Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors, ThemeColors } from "@/shared/theme/colors";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
    const [allowMessaging, setAllowMessaging] = useState("Mọi người");
    const [isBottomSheetVisible, setBottomSheetVisible] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const { userService } = await import("@/shared/services/userService");
            const profile = await userService.getProfile();
            if (profile.allowStrangerMessages !== undefined) {
                setAllowMessaging(profile.allowStrangerMessages ? "Mọi người" : "Bạn bè");
            }
        } catch (error) {
            console.error("Error loading privacy settings:", error);
        }
    };

    const saveSettings = async (value: string) => {
        try {
            const isEveryone = value === "Mọi người";
            const { userService } = await import("@/shared/services/userService");
            await userService.updateProfile({ allowStrangerMessages: isEveryone });
            setAllowMessaging(value);
        } catch (error) {
            console.error("Error saving privacy settings:", error);
            // Revert on error
            loadSettings();
        }
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
                        value={allowMessaging}
                        icon="chatbubble-outline"
                        onPress={() => setBottomSheetVisible(true)} 
                        colors={colors} 
                    />
                    
                    <SettingsItem 
                        label="Cho phép gọi điện" 
                        value="Bạn bè"
                        icon="call-outline"
                        onPress={() => {}} 
                        colors={colors} 
                    />
                </View>
            </ScrollView>

            {/* Bottom Sheet Modal */}
            <Modal
                transparent
                visible={isBottomSheetVisible}
                animationType="slide"
                onRequestClose={() => setBottomSheetVisible(false)}
            >
                <TouchableOpacity
                    style={{
                        flex: 1,
                        backgroundColor: "rgba(0,0,0,0.5)",
                        justifyContent: "flex-end",
                    }}
                    activeOpacity={1}
                    onPress={() => setBottomSheetVisible(false)}
                >
                    <View
                        style={{
                            backgroundColor: colors.card,
                            borderTopLeftRadius: 16,
                            borderTopRightRadius: 16,
                            paddingBottom: Platform.OS === "ios" ? 40 : 20,
                        }}
                    >
                        {/* Header */}
                        <View style={{ alignItems: "center", paddingVertical: 12 }}>
                            <View style={{ width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2 }} />
                            <Text style={{ marginTop: 16, fontSize: 17, fontWeight: "600", color: colors.text }}>
                                Ai được nhắn tin cho bạn?
                            </Text>
                        </View>

                        {/* Options */}
                        <TouchableOpacity
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                paddingHorizontal: 20,
                                paddingVertical: 16,
                                borderBottomWidth: 0.5,
                                borderBottomColor: colors.border,
                            }}
                            onPress={() => {
                                saveSettings("Bạn bè");
                                setBottomSheetVisible(false);
                            }}
                        >
                            <Ionicons name="people-outline" size={22} color={colors.text} />
                            <Text style={{ flex: 1, marginLeft: 16, fontSize: 16, color: colors.text }}>
                                Bạn bè
                            </Text>
                            {allowMessaging === "Bạn bè" && (
                                <Ionicons name="checkmark" size={24} color="#0068FF" />
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                paddingHorizontal: 20,
                                paddingVertical: 16,
                            }}
                            onPress={() => {
                                saveSettings("Mọi người");
                                setBottomSheetVisible(false);
                            }}
                        >
                            <Ionicons name="earth-outline" size={22} color={colors.text} />
                            <Text style={{ flex: 1, marginLeft: 16, fontSize: 16, color: colors.text }}>
                                Mọi người
                            </Text>
                            {allowMessaging === "Mọi người" && (
                                <Ionicons name="checkmark" size={24} color="#0068FF" />
                            )}
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}
