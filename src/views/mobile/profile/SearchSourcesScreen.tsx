import React, { useState } from "react";
import { View, Text, TouchableOpacity, Switch, ActivityIndicator, Alert } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { SafeView as SafeAreaView } from "@/shared/components/SafeView";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/shared/theme/colors";
import { useUserStore } from "@/shared/store/userStore";

export default function SearchSourcesScreen() {
    const router = useRouter();
    const colors = useThemeColors();
    const { profile, updateProfile } = useUserStore();
    const [updating, setUpdating] = useState(false);

    // Mặc định là true (hoặc tuỳ setting từ DB)
    const isAllowPhoneSearch = profile?.allowPhoneSearch ?? true;

    const toggleSwitch = async (value: boolean) => {
        setUpdating(true);
        try {
            await updateProfile({ allowPhoneSearch: value });
        } catch (error) {
            Alert.alert("Lỗi", "Không thể cập nhật cấu hình, vui lòng thử lại sau.");
        } finally {
            setUpdating(false);
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
                        Quản lý nguồn tìm kiếm và kết bạn
                    </Text>
                </View>
            </SafeAreaView>

            <View style={{ marginTop: 16, borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: colors.border, backgroundColor: colors.card }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 }}>
                    <View style={{ flex: 1, paddingRight: 16 }}>
                        <Text style={{ fontSize: 16, color: colors.text, fontWeight: "500", lineHeight: 22 }}>
                            Cho phép người lạ tìm thấy và kết bạn qua số điện thoại
                        </Text>
                        <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
                            {profile?.phone 
                                ? (profile.phone.startsWith('0') ? '+84' + profile.phone.substring(1) : profile.phone) 
                                : "Chưa có số điện thoại"}
                        </Text>
                    </View>
                    
                    {updating ? (
                        <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />
                    ) : (
                        <Switch
                            trackColor={{ false: "#767577", true: colors.primary }}
                            thumbColor={"#f4f3f4"}
                            ios_backgroundColor="#3e3e3e"
                            onValueChange={toggleSwitch}
                            value={isAllowPhoneSearch}
                        />
                    )}
                </View>
            </View>
            <View style={{ padding: 16 }}>
                <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 20 }}>
                    Khi tắt tính năng này, người khác sẽ không thể tìm thấy bạn qua số điện thoại để kết bạn. Những người đã là bạn bè vẫn có thể tìm thấy bạn.
                </Text>
            </View>
        </View>
    );
}
