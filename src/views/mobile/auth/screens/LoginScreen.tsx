import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeView as SafeAreaView } from "@/shared/components/SafeView";
import { useRouter } from "expo-router";
import { useThemeColors } from "@/shared/theme/colors";

export default function LoginScreen() {
    const router = useRouter();
    const colors = useThemeColors();

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <StatusBar style={colors.isDark ? "light" : "dark"} />
            <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.content}>
                    {/* Logo */}
                    <Text style={[styles.logo, { color: colors.primary }]}>MiniZalo</Text>

                    {/* Buttons */}
                    <View style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={[styles.loginButton, { backgroundColor: colors.primary }]}
                            activeOpacity={0.8}
                            onPress={() => router.push("/(auth)/login-form")}
                        >
                            <Text style={styles.loginButtonText}>ĐĂNG NHẬP</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.registerButton, { backgroundColor: colors.searchBg }]}
                            activeOpacity={0.8}
                            onPress={() => router.push("/(auth)/register-form")}
                        >
                            <Text style={[styles.registerButtonText, { color: colors.text }]}>ĐĂNG KÝ</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Forgot Password */}
                    <TouchableOpacity
                        style={styles.forgotContainer}
                        onPress={() => router.push("/(auth)/forgot-password")}
                    >
                        <Text style={[styles.forgotText, { color: colors.textSecondary }]}>Quên mật khẩu?</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
    content: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 16,
    },
    logo: {
        fontSize: 48,
        fontWeight: "bold",
        color: "#0068FF",
        marginBottom: 80,
    },
    buttonContainer: {
        width: "100%",
        maxWidth: 280,
    },
    loginButton: {
        backgroundColor: "#0068FF",
        borderRadius: 25,
        paddingVertical: 14,
        alignItems: "center",
        marginBottom: 16,
    },
    loginButtonText: {
        color: "#fff",
        fontWeight: "bold",
        fontSize: 14,
    },
    registerButton: {
        backgroundColor: "#e5e5e5",
        borderRadius: 25,
        paddingVertical: 14,
        alignItems: "center",
    },
    registerButtonText: {
        color: "#333",
        fontWeight: "bold",
        fontSize: 14,
    },
    forgotContainer: {
        marginTop: 24,
    },
    forgotText: {
        color: "#666",
        fontSize: 14,
    },
});
