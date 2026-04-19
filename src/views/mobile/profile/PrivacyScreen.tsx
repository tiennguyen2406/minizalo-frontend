import React from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { SafeView as SafeAreaView } from "@/shared/components/SafeView";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors, ThemeColors } from "@/shared/theme/colors";

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
                    name={icon as any} 
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
    
    console.log("=== PRIVACY SCREEN RENDERING ===");

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
                            console.log("=== BACK BUTTON PRESSED ===");
                            router.back();
                        }}
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
                <View style={{ marginTop: 8 }}>
                    <SettingsItem 
                        label="Đổi mật khẩu" 
                        icon="lock-closed-outline"
                        onPress={() => {
                            console.log("=== CHANGE PASSWORD PRESSED ===");
                            router.push("/change-password");
                        }} 
                        colors={colors} 
                    />
                    <SettingsItem 
                        label="Tự động thêm vào nhóm" 
                        icon="people-outline"
                        onPress={() => console.log("Tự động thêm vào nhóm pressed")}
                        colors={colors} 
                    />
                    <SettingsItem 
                        label="Hiển thị trạng thái truy cập" 
                        icon="eye-outline"
                        onPress={() => console.log("Hiển thị trạng thái truy cập pressed")}
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
        </View>
    );
}
