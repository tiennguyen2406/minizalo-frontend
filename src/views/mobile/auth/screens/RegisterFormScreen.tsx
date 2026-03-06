import React, { useState } from "react";
import { View, KeyboardAvoidingView, Platform, ScrollView, Alert, TouchableOpacity, Text } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import authService from "@/shared/services/authService";
import { createAuthStyles } from "../styles";
import { AuthHeader, AuthTitle, AuthInput, AuthButton } from "../components";
import { useThemeColors } from "@/shared/theme/colors";

export default function RegisterFormScreen() {
    const router = useRouter();
    const colors = useThemeColors();
    const authStyles = createAuthStyles(colors);
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);

    // Validation error states
    const [nameError, setNameError] = useState("");
    const [phoneError, setPhoneError] = useState("");
    const [emailError, setEmailError] = useState("");
    const [passwordError, setPasswordError] = useState("");
    const [confirmPasswordError, setConfirmPasswordError] = useState("");

    const handleRegister = async () => {
        // Reset errors
        setNameError("");
        setPhoneError("");
        setEmailError("");
        setPasswordError("");
        setConfirmPasswordError("");

        let isValid = true;

        // Validation
        if (!name.trim()) {
            setNameError("Vui lòng nhập tên");
            isValid = false;
        }
        if (!phone.trim()) {
            setPhoneError("Vui lòng nhập số điện thoại");
            isValid = false;
        } else if (!/^[0-9]{10,11}$/.test(phone)) {
            setPhoneError("Số điện thoại phải có 10-11 chữ số");
            isValid = false;
        }
        if (!email.trim()) {
            setEmailError("Vui lòng nhập email");
            isValid = false;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setEmailError("Email không hợp lệ");
            isValid = false;
        }
        if (!password) {
            setPasswordError("Vui lòng nhập mật khẩu");
            isValid = false;
        } else if (password.length < 6) {
            setPasswordError("Mật khẩu phải có ít nhất 6 ký tự");
            isValid = false;
        } else if (!/^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).{6,}$/.test(password)) {
            // Check complexity
            setPasswordError("Mật khẩu phải có ít nhất 6 ký tự, bao gồm chữ hoa, số và ký tự đặc biệt (!@#$%^&*)");
            isValid = false;
        }

        if (password !== confirmPassword) {
            setConfirmPasswordError("Mật khẩu nhập lại không khớp");
            isValid = false;
        }

        if (!isValid) return;

        setLoading(true);
        try {
            await authService.signup({
                name: name.trim(),
                phone: phone.trim(),
                email: email.trim(),
                password,
            });
            Alert.alert("Thành công", "Đăng ký thành công! Vui lòng đăng nhập.", [
                { text: "OK", onPress: () => router.replace("/(auth)/login-form") },
            ]);
        } catch (error: any) {
            const message = error.response?.data?.message || "Đăng ký thất bại. Vui lòng thử lại.";
            const messageLower = message.toLowerCase();

            // Handle duplicate errors specifically if possible
            if (messageLower.includes("phone") || messageLower.includes("số điện thoại") || messageLower.includes("already registed") || messageLower.includes("already registered")) {
                setPhoneError("Số điện thoại này đã được sử dụng.");
            } else if (messageLower.includes("email")) {
                setEmailError("Email này đã được sử dụng.");
            } else {
                Alert.alert("Lỗi", message);
            }
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
                <ScrollView showsVerticalScrollIndicator={false}>
                    <AuthTitle title="Đăng ký" />

                    <AuthInput
                        placeholder="Tên"
                        value={name}
                        onChangeText={(text) => { setName(text); setNameError(""); }}
                        disabled={loading}
                        error={nameError}
                    />

                    <AuthInput
                        placeholder="Số điện thoại"
                        value={phone}
                        onChangeText={(text) => { setPhone(text); setPhoneError(""); }}
                        keyboardType="phone-pad"
                        disabled={loading}
                        error={phoneError}
                    />

                    <AuthInput
                        placeholder="Email"
                        value={email}
                        onChangeText={(text) => { setEmail(text); setEmailError(""); }}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        disabled={loading}
                        error={emailError}
                    />

                    <AuthInput
                        placeholder="Mật khẩu"
                        value={password}
                        onChangeText={(text) => { setPassword(text); setPasswordError(""); }}
                        isPassword
                        disabled={loading}
                        error={passwordError}
                    />

                    <AuthInput
                        placeholder="Nhập lại mật khẩu"
                        value={confirmPassword}
                        onChangeText={(text) => { setConfirmPassword(text); setConfirmPasswordError(""); }}
                        isPassword
                        disabled={loading}
                        error={confirmPasswordError}
                    />


                    <AuthButton
                        title="Đăng ký"
                        onPress={handleRegister}
                        loading={loading}
                        style={{ marginBottom: 40 }}
                    />
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}
