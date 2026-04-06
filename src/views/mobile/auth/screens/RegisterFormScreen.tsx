import React, { useState, useCallback } from "react";
import { View, KeyboardAvoidingView, Platform, ScrollView, Alert, Text } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import authService from "@/shared/services/authService";
import { createAuthStyles } from "../styles";
import { AuthHeader, AuthTitle, AuthInput, AuthButton, OtpInputMobile } from "../components";
import { useThemeColors } from "@/shared/theme/colors";

type Step = "form" | "otp";

export default function RegisterFormScreen() {
    const router = useRouter();
    const colors = useThemeColors();
    const authStyles = createAuthStyles(colors);

    // Form fields
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    // OTP step
    const [step, setStep] = useState<Step>("form");
    const [otp, setOtp] = useState("");
    const [otpCooldown, setOtpCooldown] = useState(60);

    // Loading & errors
    const [loading, setLoading] = useState(false);
    const [nameError, setNameError] = useState("");
    const [phoneError, setPhoneError] = useState("");
    const [emailError, setEmailError] = useState("");
    const [passwordError, setPasswordError] = useState("");
    const [confirmPasswordError, setConfirmPasswordError] = useState("");
    const [otpError, setOtpError] = useState("");

    const validateForm = useCallback((): boolean => {
        let isValid = true;

        const trimmedName = name.trim();
        if (!trimmedName) {
            setNameError("Vui lòng nhập tên"); isValid = false;
        } else if (trimmedName.length < 2 || trimmedName.length > 40) {
            setNameError("Tên phải từ 2-40 ký tự"); isValid = false;
        }

        if (!phone.trim()) {
            setPhoneError("Vui lòng nhập số điện thoại"); isValid = false;
        } else if (!/^(03|05|07|08|09)[0-9]{8}$/.test(phone.trim())) {
            setPhoneError("Số điện thoại phải là 10 chữ số, bắt đầu bằng 03, 05, 07, 08 hoặc 09"); isValid = false;
        }

        if (!email.trim()) {
            setEmailError("Vui lòng nhập email"); isValid = false;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            setEmailError("Email không hợp lệ"); isValid = false;
        }

        if (!password) {
            setPasswordError("Vui lòng nhập mật khẩu"); isValid = false;
        } else if (password.length < 6 || password.length > 32) {
            setPasswordError("Mật khẩu phải từ 6-32 ký tự"); isValid = false;
        } else if (/\s/.test(password)) {
            setPasswordError("Mật khẩu không được chứa khoảng trắng"); isValid = false;
        } else if (!/[A-Z]/.test(password)) {
            setPasswordError("Mật khẩu phải chứa ít nhất 1 chữ hoa"); isValid = false;
        } else if (!/[a-z]/.test(password)) {
            setPasswordError("Mật khẩu phải chứa ít nhất 1 chữ thường"); isValid = false;
        } else if (!/[0-9]/.test(password)) {
            setPasswordError("Mật khẩu phải chứa ít nhất 1 chữ số"); isValid = false;
        }

        if (password !== confirmPassword) {
            setConfirmPasswordError("Mật khẩu nhập lại không khớp"); isValid = false;
        }

        return isValid;
    }, [name, phone, email, password, confirmPassword]);

    const handleSendOtp = useCallback(async () => {
        // Reset errors
        setNameError(""); setPhoneError(""); setEmailError("");
        setPasswordError(""); setConfirmPasswordError("");

        if (!validateForm()) return;

        setLoading(true);
        try {
            await authService.sendOtp(phone.trim());
            setOtp("");
            setOtpError("");
            setOtpCooldown(60);
            setStep("otp");
        } catch (err: any) {
            const msg = err.response?.data?.message || "Gửi mã OTP thất bại. Vui lòng thử lại.";
            Alert.alert("Lỗi", msg);
        } finally {
            setLoading(false);
        }
    }, [validateForm, phone]);

    const handleResendOtp = useCallback(async () => {
        try {
            await authService.sendOtp(phone.trim());
            setOtpCooldown(60);
            setOtpError("");
        } catch (err: any) {
            const msg = err.response?.data?.message || "Gửi lại mã OTP thất bại.";
            Alert.alert("Lỗi", msg);
        }
    }, [phone]);

    const handleVerifyAndRegister = useCallback(async () => {
        setOtpError("");
        if (otp.length < 6) {
            setOtpError("Vui lòng nhập đủ 6 số OTP");
            return;
        }
        setLoading(true);
        try {
            const result = await authService.verifyOtp(phone.trim(), otp);
            await authService.signup({
                name: name.trim(),
                phone: phone.trim(),
                email: email.trim(),
                password,
                verificationToken: result.verificationToken,
            });
            Alert.alert("Đăng ký thành công", "Tài khoản của bạn đã được tạo. Vui lòng đăng nhập.", [
                { text: "Đăng nhập", onPress: () => router.replace("/(auth)/login-form") },
            ]);
        } catch (err: any) {
            const msg = err.response?.data?.message || "Xác thực thất bại. Vui lòng thử lại.";
            setOtpError(msg);
        } finally {
            setLoading(false);
        }
    }, [otp, phone, name, email, password, router]);

    return (
        <View style={authStyles.container}>
            <StatusBar style={colors.background === "#000000" ? "light" : "dark"} />

            <AuthHeader
                onBack={() => {
                    if (step === "otp") {
                        setStep("form");
                        setOtp("");
                        setOtpError("");
                    } else {
                        router.back();
                    }
                }}
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={authStyles.content}
            >
                <ScrollView showsVerticalScrollIndicator={false}>
                    {step === "form" ? (
                        <>
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
                                title={loading ? "Đang gửi mã..." : "Tiếp tục"}
                                onPress={handleSendOtp}
                                loading={loading}
                                style={{ marginTop: 8, marginBottom: 40 }}
                            />
                        </>
                    ) : (
                        <>
                            <AuthTitle title="Xác thực OTP" />

                            <Text style={{
                                textAlign: "center",
                                color: colors.textSecondary,
                                fontSize: 14,
                                marginBottom: 24,
                                lineHeight: 20,
                            }}>
                                Mã xác thực đã được gửi đến số{"\n"}
                                <Text style={{ color: colors.primary, fontWeight: "600" }}>{phone}</Text>
                            </Text>

                            <OtpInputMobile
                                value={otp}
                                onChange={(v) => { setOtp(v); setOtpError(""); }}
                                disabled={loading}
                                onResend={handleResendOtp}
                                cooldownSeconds={otpCooldown}
                            />

                            {otpError ? (
                                <Text style={{
                                    color: "#d32f2f",
                                    fontSize: 13,
                                    textAlign: "center",
                                    marginTop: 12,
                                }}>
                                    {otpError}
                                </Text>
                            ) : null}

                            <AuthButton
                                title={loading ? "Đang xác thực..." : "Xác nhận"}
                                onPress={handleVerifyAndRegister}
                                loading={loading}
                                disabled={otp.length < 6}
                                style={{ marginTop: 24, marginBottom: 40 }}
                            />
                        </>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}
