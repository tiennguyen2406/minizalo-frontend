import React, { useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { AuthInput, AuthButton } from "@/views/mobile/auth/components";
import { useThemeColors } from "@/shared/theme/colors";
import { userService } from "@/shared/services/userService";
import { useAuthStore } from "@/shared/store/authStore";

export default function AccountSecurityScreen() {
    const router = useRouter();
    const colors = useThemeColors();
    const logout = useAuthStore((s) => s.logout);

    const [password, setPassword] = useState("");
    const [passwordError, setPasswordError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleLockAccount = () => {
        setPasswordError("");
        if (!password) {
            setPasswordError("Vui lòng nhập mật khẩu để xác nhận");
            return;
        }

        Alert.alert(
            "Khóa tài khoản",
            "Sau khi khóa, bạn sẽ bị đăng xuất trên tất cả thiết bị và không thể đăng nhập lại cho đến khi được hỗ trợ mở khóa. Bạn có chắc chắn không?",
            [
                { text: "Hủy", style: "cancel" },
                {
                    text: "Khóa tài khoản",
                    style: "destructive",
                    onPress: async () => {
                        setLoading(true);
                        try {
                            await userService.lockAccount(password);
                            await logout();
                            Alert.alert("Thành công", "Tài khoản đã được khóa.");
                            router.replace("/(auth)/login-form");
                        } catch (err: any) {
                            const msg = err?.response?.data?.message || "Không thể khóa tài khoản. Vui lòng thử lại.";
                            Alert.alert("Lỗi", msg);
                        } finally {
                            setLoading(false);
                        }
                    },
                },
            ]
        );
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
                    <TouchableOpacity onPress={() => router.back()} style={{ paddingRight: 16, paddingVertical: 4 }}>
                        <Ionicons name="chevron-back" size={26} color={colors.headerText} />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 18, fontWeight: "600", color: colors.headerText, flex: 1 }}>
                        Tài khoản và bảo mật
                    </Text>
                </View>
            </SafeAreaView>

            <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
                <TouchableOpacity
                    onPress={() => router.push("/change-password")}
                    activeOpacity={0.7}
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        backgroundColor: colors.card,
                        borderWidth: 0.5,
                        borderColor: colors.border,
                        borderRadius: 12,
                        paddingHorizontal: 14,
                        paddingVertical: 14,
                        marginBottom: 12,
                    }}
                >
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: "500" }}>Đổi mật khẩu</Text>
                    <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </TouchableOpacity>

                <View
                    style={{
                        backgroundColor: colors.card,
                        borderWidth: 0.5,
                        borderColor: colors.border,
                        borderRadius: 12,
                        padding: 14,
                        marginTop: 8,
                    }}
                >
                    <Text style={{ color: "#d32f2f", fontSize: 16, fontWeight: "600", marginBottom: 8 }}>
                        Khóa tài khoản
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18, marginBottom: 12 }}>
                        Hành động này sẽ đăng xuất bạn khỏi tất cả thiết bị và chặn đăng nhập lại cho đến khi tài khoản được mở khóa.
                    </Text>

                    <AuthInput
                        placeholder="Nhập mật khẩu để xác nhận"
                        value={password}
                        onChangeText={(v) => {
                            setPassword(v);
                            setPasswordError("");
                        }}
                        isPassword
                        disabled={loading}
                        error={passwordError}
                    />

                    <AuthButton
                        title={loading ? "Đang khóa..." : "Khóa tài khoản"}
                        onPress={handleLockAccount}
                        loading={loading}
                        style={{ marginTop: 8 }}
                    />
                </View>
            </ScrollView>
        </View>
    );
}

