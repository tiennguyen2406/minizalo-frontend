import React, { useState, useCallback } from "react";
import { View, KeyboardAvoidingView, Platform, ScrollView, Alert, Text, TouchableOpacity } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import authService from "@/shared/services/authService";
import { createAuthStyles } from "../styles";
import { AuthHeader, AuthTitle, AuthInput, AuthButton, OtpInputMobile } from "../components";
import { useThemeColors } from "@/shared/theme/colors";

type Step = "form" | "otp";
type OtpChannel = "SMS" | "EMAIL";

export default function RegisterFormScreen() {
    const router = useRouter();
    const colors = useThemeColors();
    const authStyles = createAuthStyles(colors);

    const [step, setStep] = useState<Step>("form");
    const [otpChannel, setOtpChannel] = useState<OtpChannel>("SMS");
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [otp, setOtp] = useState("");
    const [otpCooldown, setOtpCooldown] = useState(60);
    const [loading, setLoading] = useState(false);

    // Validation error states
    const [nameError, setNameError] = useState("");
    const [phoneError, setPhoneError] = useState("");
    const [emailError, setEmailError] = useState("");
    const [passwordError, setPasswordError] = useState("");
    const [confirmPasswordError, setConfirmPasswordError] = useState("");
    const [otpError, setOtpError] = useState("");

    // === Validation functions (synced with web) ===
    const validateForm = useCallback((): boolean => {
        let isValid = true;

        // Name
        const trimmedName = name.trim();
        if (!trimmedName) {
            setNameError("Vui lòng nhập tên"); isValid = false;
        } else if (trimmedName.length < 2 || trimmedName.length > 40) {
            setNameError("Tên phải từ 2-40 ký tự"); isValid = false;
        } else if (!/^[\p{L} ]+$/u.test(trimmedName)) {
            setNameError("Tên chỉ được chứa chữ cái và khoảng trắng, không chứa số hay ký tự đặc biệt"); isValid = false;
        } else {
            setNameError("");
        }

        // Phone
        const trimmedPhone = phone.trim();
        if (!trimmedPhone) {
            setPhoneError("Vui lòng nhập số điện thoại"); isValid = false;
        } else if (!/^[0-9]+$/.test(trimmedPhone)) {
            setPhoneError("Số điện thoại chỉ được chứa chữ số"); isValid = false;
        } else if (trimmedPhone.length !== 10) {
            setPhoneError("Số điện thoại phải đủ 10 chữ số"); isValid = false;
        } else if (!/^(03|05|07|08|09)/.test(trimmedPhone)) {
            setPhoneError("Số điện thoại phải bắt đầu bằng 03, 05, 07, 08 hoặc 09"); isValid = false;
        } else {
            setPhoneError("");
        }

        // Email
        const trimmedEmail = email.trim();
        if (!trimmedEmail) {
            setEmailError("Vui lòng nhập email"); isValid = false;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
            setEmailError("Email không hợp lệ"); isValid = false;
        } else {
            setEmailError("");
        }

        // Password
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
        } else {
            setPasswordError("");
        }

        // Confirm password
        if (!confirmPassword) {
            setConfirmPasswordError("Vui lòng nhập lại mật khẩu"); isValid = false;
        } else if (password !== confirmPassword) {
            setConfirmPasswordError("Mật khẩu nhập lại không khớp"); isValid = false;
        } else {
            setConfirmPasswordError("");
        }

        return isValid;
    }, [name, phone, email, password, confirmPassword]);

    // Step 1: Validate form → send OTP
    const handleSendOtp = useCallback(async () => {
        setOtpError("");
        if (!validateForm()) return;

        setLoading(true);
        try {
            console.log(`[RegisterFormScreen] Sending OTP via ${otpChannel} to:`, phone.trim(), email.trim());
            await authService.sendOtp(phone.trim(), otpChannel, email.trim());
            setStep("otp");
            setOtp("");
            setOtpCooldown(60);
            console.log("[RegisterFormScreen] OTP sent successfully");
        } catch (err: any) {
            console.error("[RegisterFormScreen] Send OTP failed:", err.response?.data || err.message);
            const msg = err.response?.data?.message || "Gửi mã OTP thất bại. Vui lòng thử lại.";
            const msgLower = msg.toLowerCase();
            if (msgLower.includes("phone") || msgLower.includes("số điện thoại") || msgLower.includes("already")) {
                setPhoneError("Số điện thoại này đã được sử dụng.");
            } else if (msgLower.includes("email")) {
                setEmailError("Email này đã được sử dụng.");
            } else {
                setOtpError(msg);
            }
        } finally {
            setLoading(false);
        }
    }, [phone, email, otpChannel, validateForm]);

    // Resend OTP
    const handleResendOtp = useCallback(async () => {
        try {
            await authService.sendOtp(phone.trim(), otpChannel, email.trim());
            setOtpCooldown(60);
            setOtpError("");
        } catch (err: any) {
            setOtpError(err.response?.data?.message || "Gửi lại mã OTP thất bại.");
        }
    }, [phone, email, otpChannel]);

    // Step 2: Verify OTP → register
    const handleVerifyAndRegister = useCallback(async () => {
        setOtpError("");
        if (otp.length < 6) {
            setOtpError("Vui lòng nhập đủ 6 số OTP");
            return;
        }

        setLoading(true);
        try {
            console.log("[RegisterFormScreen] Verifying OTP...");
            const result = await authService.verifyOtp(phone.trim(), otp);
            console.log("[RegisterFormScreen] OTP verified, signing up...");

            await authService.signup({
                name: name.trim(),
                phone: phone.trim(),
                email: email.trim(),
                password,
                verificationToken: result.verificationToken,
            });

            console.log("[RegisterFormScreen] Signup successful!");
            Alert.alert("Thành công", "Đăng ký thành công! Vui lòng đăng nhập.", [
                { text: "OK", onPress: () => router.replace("/(auth)/login-form") },
            ]);
        } catch (error: any) {
            console.error("[RegisterFormScreen] Verify/Signup failed:", {
                status: error.response?.status,
                data: error.response?.data,
                message: error.message,
            });
            const msg = error.response?.data?.message || "Xác thực thất bại. Vui lòng thử lại.";
            setOtpError(msg);
        } finally {
            setLoading(false);
        }
    }, [otp, phone, name, email, password, router]);

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
                            if (step === "otp") {
                                setStep("form");
                                setOtp("");
                                setOtpError("");
                            } else {
                                router.back();
                            }
                        }}
                    />

                    <View style={authStyles.content}>
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

                                <View style={{ marginTop: 8, marginBottom: 8, paddingTop: 22, borderTopWidth: 1, borderTopColor: colors.border }}>
                                    <Text style={{ fontSize: 14, color: colors.text, marginBottom: 12, fontWeight: "500" }}>
                                        Nhận mã OTP qua
                                    </Text>
                                    <View style={{ flexDirection: "row", gap: 10 }}>
                                        {(["SMS", "EMAIL"] as const).map((ch) => (
                                            <TouchableOpacity
                                                key={ch}
                                                onPress={() => setOtpChannel(ch)}
                                                disabled={loading}
                                                style={{
                                                    flex: 1,
                                                    height: 44,
                                                    borderRadius: 22,
                                                    borderWidth: 2,
                                                    borderColor: otpChannel === ch ? colors.primary : colors.border,
                                                    backgroundColor: otpChannel === ch ? colors.primary : colors.card,
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    opacity: loading ? 0.7 : 1,
                                                }}
                                            >
                                                <Text style={{
                                                    color: otpChannel === ch ? "#fff" : colors.text,
                                                    fontWeight: "600",
                                                    fontSize: 14,
                                                }}>
                                                    {ch === "SMS" ? "SMS" : "Email"}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                {otpError ? (
                                    <Text style={{ color: "#d32f2f", fontSize: 13, textAlign: "center", marginBottom: 8 }}>
                                        {otpError}
                                    </Text>
                                ) : null}

                                <AuthButton
                                    title={loading ? "Đang gửi mã..." : "Tiếp tục"}
                                    onPress={handleSendOtp}
                                    loading={loading}
                                    style={{ marginBottom: 40 }}
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
                                    {otpChannel === "EMAIL"
                                        ? `Mã xác thực đã được gửi đến email\n`
                                        : `Mã xác thực đã được gửi đến số\n`}
                                    <Text style={{ color: colors.primary, fontWeight: "600" }}>
                                        {otpChannel === "EMAIL" ? email.trim() : phone.trim()}
                                    </Text>
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
                                        marginTop: 8,
                                        marginBottom: 8,
                                    }}>
                                        {otpError}
                                    </Text>
                                ) : null}

                                <AuthButton
                                    title={loading ? "Đang xác thực..." : "Xác nhận"}
                                    onPress={handleVerifyAndRegister}
                                    loading={loading}
                                    disabled={otp.length < 6}
                                    style={{ marginTop: 16, marginBottom: 40 }}
                                />
                            </>
                        )}
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}
