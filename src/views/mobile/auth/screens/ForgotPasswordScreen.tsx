import React, { useState, useCallback } from "react";
import { View, KeyboardAvoidingView, Platform, ScrollView, Alert, Text } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import authService from "@/shared/services/authService";
import { createAuthStyles } from "../styles";
import { AuthHeader, AuthTitle, AuthInput, AuthButton, OtpInputMobile } from "../components";
import { useThemeColors } from "@/shared/theme/colors";

type Step = "phone" | "reset";

export default function ForgotPasswordScreen() {
    const router = useRouter();
    const colors = useThemeColors();
    const authStyles = createAuthStyles(colors);

    const [step, setStep] = useState<Step>("phone");
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [otpCooldown, setOtpCooldown] = useState(60);

    const [loading, setLoading] = useState(false);
    const [phoneError, setPhoneError] = useState("");
    const [otpError, setOtpError] = useState("");
    const [newPasswordError, setNewPasswordError] = useState("");
    const [confirmPasswordError, setConfirmPasswordError] = useState("");

    const handleSendOtp = useCallback(async () => {
        setPhoneError("");
        if (!phone.trim()) {
            setPhoneError("Vui lòng nhập số điện thoại");
            return;
        }
        if (!/^(03|05|07|08|09)[0-9]{8}$/.test(phone.trim())) {
            setPhoneError("Số điện thoại phải là 10 chữ số, bắt đầu bằng 03, 05, 07, 08 hoặc 09");
            return;
        }
        setLoading(true);
        try {
            await authService.forgotPasswordSendOtp(phone.trim());
            setOtp("");
            setOtpError("");
            setOtpCooldown(60);
            setStep("reset");
        } catch (err: any) {
            const msg = err.response?.data?.message || "Gửi mã OTP thất bại. Vui lòng thử lại.";
            Alert.alert("Lỗi", msg);
        } finally {
            setLoading(false);
        }
    }, [phone]);

    const handleResendOtp = useCallback(async () => {
        try {
            await authService.forgotPasswordSendOtp(phone.trim());
            setOtpCooldown(60);
            setOtpError("");
        } catch (err: any) {
            const msg = err.response?.data?.message || "Gửi lại mã OTP thất bại.";
            Alert.alert("Lỗi", msg);
        }
    }, [phone]);

    const validatePassword = useCallback((): boolean => {
        let isValid = true;
        if (!newPassword) {
            setNewPasswordError("Vui lòng nhập mật khẩu mới"); isValid = false;
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
    }, [newPassword, confirmPassword]);

    const handleResetPassword = useCallback(async () => {
        setOtpError("");
        setNewPasswordError("");
        setConfirmPasswordError("");

        if (otp.length < 6) {
            setOtpError("Vui lòng nhập đủ 6 số OTP");
            return;
        }
        if (!validatePassword()) return;

        setLoading(true);
        try {
            await authService.resetPassword(phone.trim(), otp, newPassword, confirmPassword);
            Alert.alert("Thành công", "Mật khẩu đã được đặt lại. Vui lòng đăng nhập bằng mật khẩu mới.", [
                { text: "Đăng nhập", onPress: () => router.replace("/(auth)/login-form") },
            ]);
        } catch (err: any) {
            let msg = err.response?.data?.message || "Đặt lại mật khẩu thất bại. Vui lòng thử lại.";
            if (msg === "New password must be different from old password") {
                msg = "Mật khẩu mới phải khác mật khẩu hiện tại";
            }
            setOtpError(msg);
        } finally {
            setLoading(false);
        }
    }, [otp, phone, newPassword, confirmPassword, validatePassword, router]);

    return (
        <View style={authStyles.container}>
            <StatusBar style={colors.background === "#000000" ? "light" : "dark"} />

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
            >
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 60 }}
                    keyboardShouldPersistTaps="handled"
                >
                    <AuthHeader
                        onBack={() => {
                            if (step === "reset") {
                                setStep("phone");
                                setOtp("");
                                setNewPassword("");
                                setConfirmPassword("");
                                setOtpError("");
                                setNewPasswordError("");
                                setConfirmPasswordError("");
                            } else {
                                router.back();
                            }
                        }}
                    />

                    <View style={authStyles.content}>
                        {step === "phone" ? (
                            <>
                                <AuthTitle title="Quên mật khẩu" />

                                <Text style={{
                                    textAlign: "center",
                                    color: colors.textSecondary,
                                    fontSize: 14,
                                    marginBottom: 24,
                                    lineHeight: 20,
                                }}>
                                    Nhập số điện thoại để nhận mã xác thực
                                </Text>

                                <AuthInput
                                    placeholder="Số điện thoại"
                                    value={phone}
                                    onChangeText={(text) => { setPhone(text); setPhoneError(""); }}
                                    keyboardType="phone-pad"
                                    disabled={loading}
                                    error={phoneError}
                                />

                                <AuthButton
                                    title={loading ? "Đang gửi..." : "Gửi mã xác thực"}
                                    onPress={handleSendOtp}
                                    loading={loading}
                                    style={{ marginTop: 8, marginBottom: 40 }}
                                />
                            </>
                        ) : (
                            <>
                                <AuthTitle title="Đặt mật khẩu mới" />

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
                                        marginTop: 4,
                                        marginBottom: 8,
                                    }}>
                                        {otpError}
                                    </Text>
                                ) : null}

                                <View style={{ marginTop: 16 }}>
                                    <AuthInput
                                        placeholder="Mật khẩu mới"
                                        value={newPassword}
                                        onChangeText={(text) => { setNewPassword(text); setNewPasswordError(""); }}
                                        isPassword
                                        disabled={loading}
                                        error={newPasswordError}
                                    />

                                    <AuthInput
                                        placeholder="Nhập lại mật khẩu mới"
                                        value={confirmPassword}
                                        onChangeText={(text) => { setConfirmPassword(text); setConfirmPasswordError(""); }}
                                        isPassword
                                        disabled={loading}
                                        error={confirmPasswordError}
                                    />
                                </View>

                                <AuthButton
                                    title={loading ? "Đang xử lý..." : "Đặt lại mật khẩu"}
                                    onPress={handleResetPassword}
                                    loading={loading}
                                    disabled={otp.length < 6}
                                    style={{ marginTop: 8, marginBottom: 40 }}
                                />
                            </>
                        )}
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}
