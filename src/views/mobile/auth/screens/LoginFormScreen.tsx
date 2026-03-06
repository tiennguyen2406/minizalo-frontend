import React, { useState } from "react";
import { View, KeyboardAvoidingView, Platform, Modal, Text, TouchableOpacity, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/shared/store/authStore";
import { useUserStore } from "@/shared/store/userStore";
import { createAuthStyles } from "../styles";
import { AuthHeader, AuthTitle, AuthInput, AuthButton, AuthLink } from "../components";
import { useThemeColors } from "@/shared/theme/colors";

export default function LoginFormScreen() {
    const router = useRouter();
    const colors = useThemeColors();
    const authStyles = createAuthStyles(colors);
    const login = useAuthStore((s) => s.login);
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [errorModal, setErrorModal] = useState({ visible: false, title: "", message: "" });

    // Validation hooks
    const [phoneError, setPhoneError] = useState("");
    const [passwordError, setPasswordError] = useState("");

    const showError = (title: string, message: string) => {
        setErrorModal({ visible: true, title, message });
    };

    const hideError = () => {
        setErrorModal({ visible: false, title: "", message: "" });
    };

    const handleLogin = async () => {
        // Reset errors
        setPhoneError("");
        setPasswordError("");

        let isValid = true;

        if (!phone.trim()) {
            setPhoneError("Vui lòng nhập số điện thoại hoặc email");
            isValid = false;
        }
        if (!password) {
            setPasswordError("Vui lòng nhập mật khẩu");
            isValid = false;
        }

        if (!isValid) return;

        setLoading(true);
        try {
            await login({
                username: phone.trim(),
                password,
            });
            // Tải profile ngay sau đăng nhập để màn Cá nhân hiển thị đúng tên/avatar
            await useUserStore.getState().fetchProfile();
            router.replace("/(tabs)");
        } catch (error: any) {
            const serverMessage = error.response?.data?.message;
            let message = "Sai tên đăng nhập hoặc mật khẩu. Vui lòng thử lại.";

            // Dịch các thông báo lỗi từ server sang tiếng Việt
            if (serverMessage) {
                if (serverMessage.toLowerCase().includes("invalid") || serverMessage.toLowerCase().includes("incorrect")) {
                    message = "Sai tên đăng nhập hoặc mật khẩu. Vui lòng thử lại.";
                } else if (serverMessage.toLowerCase().includes("not found") || serverMessage.toLowerCase().includes("user not")) {
                    message = "Tài khoản không tồn tại.";
                } else if (serverMessage.toLowerCase().includes("password")) {
                    message = "Mật khẩu không đúng.";
                } else if (serverMessage.toLowerCase().includes("locked") || serverMessage.toLowerCase().includes("disabled")) {
                    message = "Tài khoản đã bị khóa.";
                } else if (serverMessage.toLowerCase().includes("network")) {
                    message = "Lỗi kết nối mạng. Vui lòng kiểm tra internet.";
                }
            } else if (error.message?.toLowerCase().includes("network")) {
                message = "Lỗi kết nối mạng. Vui lòng kiểm tra internet.";
            }

            // Set error for both fields to indicate login failure visually
            setPhoneError(" ");
            setPasswordError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={authStyles.container}>
            <StatusBar style={colors.background === "#000000" ? "light" : "dark"} />

            <AuthHeader onBack={() => router.back()} />

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={authStyles.content}
            >
                <AuthTitle title="Đăng nhập" />

                <AuthInput
                    placeholder="Số điện thoại hoặc email"
                    value={phone}
                    onChangeText={(text) => { setPhone(text); setPhoneError(""); }}
                    keyboardType="phone-pad"
                    disabled={loading}
                    error={phoneError}
                />

                <AuthInput
                    placeholder="Mật khẩu"
                    value={password}
                    onChangeText={(text) => { setPassword(text); setPasswordError(""); }}
                    isPassword
                    disabled={loading}
                    error={passwordError}
                />

                <AuthButton
                    title="Đăng nhập"
                    onPress={handleLogin}
                    loading={loading}
                />

                <AuthLink text="Quên mật khẩu" />
            </KeyboardAvoidingView>

            {/* Error Modal */}
            <Modal
                visible={errorModal.visible}
                transparent={true}
                animationType="fade"
                onRequestClose={hideError}
            >
                <View style={[modalStyles.overlay]}>
                    <View style={[modalStyles.container, { backgroundColor: colors.card }]}>
                        <View style={modalStyles.iconContainer}>
                            <Text style={modalStyles.icon}>⚠️</Text>
                        </View>
                        <Text style={[modalStyles.title, { color: colors.text }]}>{errorModal.title}</Text>
                        <Text style={[modalStyles.message, { color: colors.textSecondary }]}>{errorModal.message}</Text>
                        <TouchableOpacity style={modalStyles.button} onPress={hideError}>
                            <Text style={modalStyles.buttonText}>OK</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const modalStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        justifyContent: "center",
        alignItems: "center",
    },
    container: {
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 24,
        width: "80%",
        maxWidth: 320,
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    iconContainer: {
        marginBottom: 16,
    },
    icon: {
        fontSize: 48,
    },
    title: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#333",
        marginBottom: 8,
        textAlign: "center",
    },
    message: {
        fontSize: 14,
        color: "#666",
        textAlign: "center",
        marginBottom: 20,
        lineHeight: 20,
    },
    button: {
        backgroundColor: "#0068FF",
        paddingVertical: 12,
        paddingHorizontal: 40,
        borderRadius: 8,
        minWidth: 120,
    },
    buttonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
        textAlign: "center",
    },
});

