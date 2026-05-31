import React, { useState, useCallback } from "react";
import { View, KeyboardAvoidingView, Platform, ScrollView, Alert, Text, TouchableOpacity } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/shared/store/authStore";
import axios from "axios";
import { useThemeColors } from "@/shared/theme/colors";
import { SafeView as SafeAreaView } from "@/shared/components/SafeView";
import { Ionicons } from "@expo/vector-icons";
import { AuthInput, AuthButton } from "../auth/components";

export default function ChangePasswordScreen() {
    const router = useRouter();
    const colors = useThemeColors();
    const accessToken = useAuthStore((s) => s.accessToken);

    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    
    const [loading, setLoading] = useState(false);
    const [oldPasswordError, setOldPasswordError] = useState("");
    const [newPasswordError, setNewPasswordError] = useState("");
    const [confirmPasswordError, setConfirmPasswordError] = useState("");

    const rawBase =
        process.env.EXPO_PUBLIC_API_URL
            ? process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, "")
            : "http://localhost:8080/api";
    const API_BASE_URL = rawBase.endsWith("/api") ? rawBase : `${rawBase}/api`;

    const validateForm = useCallback((): boolean => {
        let isValid = true;
        setOldPasswordError("");
        setNewPasswordError("");
        setConfirmPasswordError("");

        if (!oldPassword) {
            setOldPasswordError("Vui lòng nhập mật khẩu cũ"); isValid = false;
        }
        if (!newPassword) {
            setNewPasswordError("Vui lòng nhập mật khẩu mới"); isValid = false;
        } else if (newPassword === oldPassword) {
            setNewPasswordError("Mật khẩu mới phải khác mật khẩu hiện tại"); isValid = false;
        } else if (newPassword.length < 6 || newPassword.length > 32) {
            setNewPasswordError("Mật khẩu phải từ 6-32 ký tự"); isValid = false;
        } else if (/\s/.test(newPassword)) {
            setNewPasswordError("Mật khẩu không được chứa khoảng trắng"); isValid = false;
        } else if (!/[A-Z]/.test(newPassword)) {
            setNewPasswordError("Mật khẩu phải chứa ít nhất 1 chữ hoa"); isValid = false;
        } else if (!/[a-z]/.test(newPassword)) {
            setNewPasswordError("Mật khẩu phải chứa ít nhất 1 chữ thường"); isValid = false;
        } else if (!/[0-9]/.test(newPassword)) {
            setNewPasswordError("Mật khẩu phải chứa ít nhất 1 chữ số"); isValid = false;
        }

        if (newPassword !== confirmPassword) {
            setConfirmPasswordError("Mật khẩu nhập lại không khớp"); isValid = false;
        }

        return isValid;
    }, [oldPassword, newPassword, confirmPassword]);

    const handleChangePassword = useCallback(async () => {
        if (!validateForm()) return;

        setLoading(true);
        try {
            await axios.post(
                `${API_BASE_URL}/auth/change-password`,
                { oldPassword, newPassword, confirmPassword },
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            Alert.alert("Thành công", "Đổi mật khẩu thành công!", [
                { text: "OK", onPress: () => router.back() }
            ]);
        } catch (err: any) {
            const msg = err.response?.data?.message || "Đổi mật khẩu thất bại. Vui lòng thử lại.";
            Alert.alert("Lỗi", msg);
        } finally {
            setLoading(false);
        }
    }, [validateForm, oldPassword, newPassword, confirmPassword, accessToken, API_BASE_URL, router]);

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
                        Đổi mật khẩu
                    </Text>
                </View>
            </SafeAreaView>

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <ScrollView 
                    contentContainerStyle={{ padding: 24 }} 
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <Text style={{ fontSize: 16, color: colors.text, marginBottom: 24, fontWeight: "500" }}>
                        Mật khẩu phải bao gồm cả chữ hoa, chữ thường và chữ số, độ dài từ 6 - 32 ký tự.
                    </Text>

                    <AuthInput
                        placeholder="Mật khẩu hiện tại"
                        value={oldPassword}
                        onChangeText={(text: string) => { setOldPassword(text); setOldPasswordError(""); }}
                        isPassword
                        disabled={loading}
                        error={oldPasswordError}
                    />

                    <AuthInput
                        placeholder="Mật khẩu mới"
                        value={newPassword}
                        onChangeText={(text: string) => { setNewPassword(text); setNewPasswordError(""); }}
                        isPassword
                        disabled={loading}
                        error={newPasswordError}
                    />

                    <AuthInput
                        placeholder="Nhập lại mật khẩu mới"
                        value={confirmPassword}
                        onChangeText={(text: string) => { setConfirmPassword(text); setConfirmPasswordError(""); }}
                        isPassword
                        disabled={loading}
                        error={confirmPasswordError}
                    />

                    <AuthButton
                        title={loading ? "Đang xử lý..." : "Cập nhật mật khẩu"}
                        onPress={handleChangePassword}
                        loading={loading}
                        style={{ marginTop: 24, marginBottom: 40 }}
                    />
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}
