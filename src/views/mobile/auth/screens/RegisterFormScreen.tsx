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

    // Form fields
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [otpChannel, setOtpChannel] = useState<OtpChannel>("SMS");

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

    const getNameError = useCallback((raw: string): string => {
        const trimmedName = raw.trim();
        if (!trimmedName) return "Vui lòng nhập tên";
        if (trimmedName.length < 2 || trimmedName.length > 40) return "Tên phải từ 2-40 ký tự";
        if (!/^[\p{L} ]+$/u.test(trimmedName)) {
            return "Tên chỉ được chứa chữ cái và khoảng trắng, không chứa số hay ký tự đặc biệt";
        }
        return "";
    }, []);

    const getPhoneError = useCallback((raw: string): string => {
        const v = raw.trim();
        if (!v) return "Vui lòng nhập số điện thoại";
        if (!/^[0-9]+$/.test(v)) return "Số điện thoại chỉ được chứa chữ số";
        if (v.length !== 10) return "Số điện thoại phải đủ 10 chữ số";
        if (!/^(03|05|07|08|09)/.test(v)) return "Số điện thoại phải bắt đầu bằng 03, 05, 07, 08 hoặc 09";
        return "";
    }, []);

    const getEmailError = useCallback((raw: string): string => {
        const v = raw.trim();
        if (!v) return "Vui lòng nhập email";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Email không hợp lệ";
        return "";
    }, []);

    const getPasswordError = useCallback((raw: string): string => {
        if (!raw) return "Vui lòng nhập mật khẩu";
        if (raw.length < 6 || raw.length > 32) return "Mật khẩu phải từ 6-32 ký tự";
        if (/\s/.test(raw)) return "Mật khẩu không được chứa khoảng trắng";
        if (!/[A-Z]/.test(raw)) return "Mật khẩu phải chứa ít nhất 1 chữ hoa";
        if (!/[a-z]/.test(raw)) return "Mật khẩu phải chứa ít nhất 1 chữ thường";
        if (!/[0-9]/.test(raw)) return "Mật khẩu phải chứa ít nhất 1 chữ số";
        return "";
    }, []);

    const getConfirmPasswordError = useCallback((pwd: string, confirm: string): string => {
        if (!confirm) return "Vui lòng nhập lại mật khẩu";
        if (pwd !== confirm) return "Mật khẩu nhập lại không khớp";
        return "";
    }, []);

    const validateForm = useCallback((): boolean => {
        let isValid = true;

        const nameErr = getNameError(name);
        setNameError(nameErr);
        if (nameErr) isValid = false;

        const phoneErr = getPhoneError(phone);
        setPhoneError(phoneErr);
        if (phoneErr) isValid = false;

        const emailErr = getEmailError(email);
        setEmailError(emailErr);
        if (emailErr) isValid = false;

        const pwdErr = getPasswordError(password);
        setPasswordError(pwdErr);
        if (pwdErr) isValid = false;

        const confirmErr = getConfirmPasswordError(password, confirmPassword);
        setConfirmPasswordError(confirmErr);
        if (confirmErr) isValid = false;

        return isValid;
    }, [
        name,
        phone,
        email,
        password,
        confirmPassword,
        getNameError,
        getPhoneError,
        getEmailError,
        getPasswordError,
        getConfirmPasswordError,
    ]);

    const handleSendOtp = useCallback(async () => {
        // Reset errors
        setNameError(""); setPhoneError(""); setEmailError("");
        setPasswordError(""); setConfirmPasswordError("");

        if (!validateForm()) return;

        setLoading(true);
        try {
            await authService.sendOtp(phone.trim(), otpChannel, email.trim());
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
    }, [validateForm, phone, email, otpChannel]);

    const handleResendOtp = useCallback(async () => {
        try {
            await authService.sendOtp(phone.trim(), otpChannel, email.trim());
            setOtpCooldown(60);
            setOtpError("");
        } catch (err: any) {
            const msg = err.response?.data?.message || "Gửi lại mã OTP thất bại.";
            Alert.alert("Lỗi", msg);
        }
    }, [phone, email, otpChannel]);

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
        <View style={[authStyles.container, { backgroundColor: "#fff" }]}>
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
                style={[authStyles.content, { backgroundColor: "#fff" }]}
            >
                <ScrollView showsVerticalScrollIndicator={false}>
                    {step === "form" ? (
                        <>
                            <AuthTitle title="Đăng ký" />

                            <AuthInput
                                placeholder="Tên"
                                value={name}
                                onChangeText={(text) => {
                                    setName(text);
                                    setNameError(getNameError(text));
                                }}
                                disabled={loading}
                                error={nameError}
                            />

                            <AuthInput
                                placeholder="Số điện thoại"
                                value={phone}
                                onChangeText={(text) => {
                                    setPhone(text);
                                    setPhoneError(getPhoneError(text));
                                }}
                                keyboardType="phone-pad"
                                disabled={loading}
                                error={phoneError}
                            />

                            <AuthInput
                                placeholder="Email"
                                value={email}
                                onChangeText={(text) => {
                                    setEmail(text);
                                    setEmailError(getEmailError(text));
                                }}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                disabled={loading}
                                error={emailError}
                            />

                            <AuthInput
                                placeholder="Mật khẩu"
                                value={password}
                                onChangeText={(text) => {
                                    setPassword(text);
                                    setPasswordError(getPasswordError(text));
                                    // Re-validate confirm password realtime when password changes
                                    setConfirmPasswordError(getConfirmPasswordError(text, confirmPassword));
                                }}
                                isPassword
                                disabled={loading}
                                error={passwordError}
                            />

                            <AuthInput
                                placeholder="Nhập lại mật khẩu"
                                value={confirmPassword}
                                onChangeText={(text) => {
                                    setConfirmPassword(text);
                                    setConfirmPasswordError(getConfirmPasswordError(password, text));
                                }}
                                isPassword
                                disabled={loading}
                                error={confirmPasswordError}
                            />

                            <View
                                style={{
                                    marginTop: 10,
                                    paddingTop: 18,
                                    borderTopWidth: 1,
                                    borderTopColor: colors.border,
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 14,
                                        color: colors.text,
                                        marginBottom: 12,
                                        fontWeight: "500",
                                    }}
                                >
                                    Nhận mã OTP qua
                                </Text>

                                <View style={{ flexDirection: "row" }}>
                                    <TouchableOpacity
                                        onPress={() => setOtpChannel("SMS")}
                                        activeOpacity={0.85}
                                        disabled={loading}
                                        style={[
                                            authStyles.submitButton,
                                            {
                                                flex: 1,
                                                minHeight: 52,
                                                marginTop: 0,
                                                backgroundColor: otpChannel === "SMS" ? colors.primary : "#fff",
                                                borderWidth: otpChannel === "SMS" ? 0 : 2,
                                                borderColor: colors.primary,
                                                opacity: loading ? 0.65 : 1,
                                            },
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                authStyles.submitButtonText,
                                                { color: otpChannel === "SMS" ? "#fff" : colors.primary },
                                            ]}
                                        >
                                            SMS
                                        </Text>
                                    </TouchableOpacity>

                                    <View style={{ width: 12 }} />

                                    <TouchableOpacity
                                        onPress={() => setOtpChannel("EMAIL")}
                                        activeOpacity={0.85}
                                        disabled={loading}
                                        style={[
                                            authStyles.submitButton,
                                            {
                                                flex: 1,
                                                minHeight: 52,
                                                marginTop: 0,
                                                backgroundColor: otpChannel === "EMAIL" ? colors.primary : "#fff",
                                                borderWidth: otpChannel === "EMAIL" ? 0 : 2,
                                                borderColor: colors.primary,
                                                opacity: loading ? 0.65 : 1,
                                            },
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                authStyles.submitButtonText,
                                                { color: otpChannel === "EMAIL" ? "#fff" : colors.primary },
                                            ]}
                                        >
                                            Email
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <AuthButton
                                title={loading ? "Đang gửi mã..." : "Tiếp tục"}
                                onPress={handleSendOtp}
                                loading={loading}
                                style={{ marginTop: 20, marginBottom: 40 }}
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
                                {otpChannel === "EMAIL" ? (
                                    <>
                                        Mã xác thực đã được gửi đến email{"\n"}
                                        <Text style={{ color: colors.primary, fontWeight: "600" }}>{email.trim()}</Text>
                                    </>
                                ) : (
                                    <>
                                        Mã xác thực đã được gửi đến số{"\n"}
                                        <Text style={{ color: colors.primary, fontWeight: "600" }}>{phone}</Text>
                                    </>
                                )}
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
