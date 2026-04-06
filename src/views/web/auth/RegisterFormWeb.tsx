import "zmp-ui/zaui.css";
import React, { useState, useCallback } from "react";
import { useRouter } from "expo-router";
import { Button, Input } from "zmp-ui";
import authService from "@/shared/services/authService";
import OtpInput from "./OtpInput";

const COLORS = {
    primary: "#0068FF",
    white: "#fff",
    text: "#333",
    textSecondary: "#666",
    border: "#e0e0e0",
};

type Step = "form" | "otp";

export default function RegisterFormWeb() {
    const router = useRouter();
    const [step, setStep] = useState<Step>("form");

    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [otp, setOtp] = useState("");
    const [verificationToken, setVerificationToken] = useState("");

    const [loading, setLoading] = useState(false);
    const [nameError, setNameError] = useState("");
    const [phoneError, setPhoneError] = useState("");
    const [emailError, setEmailError] = useState("");
    const [passwordError, setPasswordError] = useState("");
    const [confirmPasswordError, setConfirmPasswordError] = useState("");
    const [otpError, setOtpError] = useState("");
    const [otpCooldown, setOtpCooldown] = useState(60);

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
        setNameError("");
        setPhoneError("");
        setEmailError("");
        setPasswordError("");
        setConfirmPasswordError("");
        setOtpError("");

        if (!validateForm()) return;

        setLoading(true);
        try {
            await authService.sendOtp(phone.trim());
            setStep("otp");
            setOtpCooldown(60);
        } catch (err: any) {
            setOtpError(err.response?.data?.message || "Gửi mã OTP thất bại. Vui lòng thử lại.");
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
            setOtpError(err.response?.data?.message || "Gửi lại mã OTP thất bại.");
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
            setVerificationToken(result.verificationToken);

            await authService.signup({
                name: name.trim(),
                phone: phone.trim(),
                email: email.trim(),
                password,
                verificationToken: result.verificationToken,
            });
            router.replace("/(auth)/login-form");
        } catch (err: any) {
            setOtpError(err.response?.data?.message || "Xác thực thất bại. Vui lòng thử lại.");
        } finally {
            setLoading(false);
        }
    }, [otp, phone, name, email, password, router]);

    return (
        <div style={{ minHeight: "100vh", backgroundColor: COLORS.white, padding: 24 }}>
            <div style={{ paddingTop: 20, paddingBottom: 20 }}>
                <button
                    type="button"
                    onClick={() => {
                        if (step === "otp") {
                            setStep("form");
                            setOtp("");
                            setNameError("");
                            setPhoneError("");
                            setEmailError("");
                            setPasswordError("");
                            setConfirmPasswordError("");
                            setOtpError("");
                        } else {
                            router.back();
                        }
                    }}
                    style={{
                        background: "none",
                        border: "none",
                        fontSize: 24,
                        color: COLORS.text,
                        cursor: "pointer",
                        padding: "12px 16px",
                    }}
                >
                    ←
                </button>
            </div>

            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    marginTop: 32,
                    marginBottom: 40,
                }}
            >
                <h1
                    style={{
                        fontSize: 28,
                        fontWeight: "bold",
                        color: COLORS.primary,
                        textAlign: "center",
                        margin: 0,
                    }}
                >
                    {step === "form" ? "Đăng ký" : "Xác thực OTP"}
                </h1>
                {step === "otp" && (
                    <p style={{ color: COLORS.textSecondary, fontSize: 14, marginTop: 8, textAlign: "center" }}>
                        Mã xác thực đã được gửi đến số {phone}
                    </p>
                )}
            </div>

            <div style={{ maxWidth: 400, margin: "0 auto" }}>
                {step === "form" ? (
                    <>
                        <div style={{ marginBottom: 16 }}>
                            <Input
                                placeholder="Tên"
                                value={name}
                                onChange={(e: any) => {
                                    const v = e.target?.value ?? e;
                                    setName(v);
                                    setNameError(getNameError(v));
                                }}
                                disabled={loading}
                                style={{
                                    borderBottom: `1px solid ${nameError ? "#d32f2f" : COLORS.border}`,
                                    padding: "12px 0",
                                    fontSize: 16,
                                }}
                            />
                            {nameError ? (
                                <p style={{ color: "#d32f2f", fontSize: 13, margin: "8px 0 0" }}>{nameError}</p>
                            ) : null}
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <Input
                                placeholder="Số điện thoại"
                                value={phone}
                                onChange={(e: any) => {
                                    const v = e.target?.value ?? e;
                                    setPhone(v);
                                    setPhoneError(getPhoneError(v));
                                }}
                                disabled={loading}
                                style={{
                                    borderBottom: `1px solid ${phoneError ? "#d32f2f" : COLORS.border}`,
                                    padding: "12px 0",
                                    fontSize: 16,
                                }}
                            />
                            {phoneError ? (
                                <p style={{ color: "#d32f2f", fontSize: 13, margin: "8px 0 0" }}>{phoneError}</p>
                            ) : null}
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <Input
                                placeholder="Email"
                                value={email}
                                onChange={(e: any) => {
                                    const v = e.target?.value ?? e;
                                    setEmail(v);
                                    setEmailError(getEmailError(v));
                                }}
                                disabled={loading}
                                style={{
                                    borderBottom: `1px solid ${emailError ? "#d32f2f" : COLORS.border}`,
                                    padding: "12px 0",
                                    fontSize: 16,
                                }}
                            />
                            {emailError ? (
                                <p style={{ color: "#d32f2f", fontSize: 13, margin: "8px 0 0" }}>{emailError}</p>
                            ) : null}
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <Input
                                type="password"
                                placeholder="Mật khẩu"
                                value={password}
                                onChange={(e: any) => {
                                    const v = e.target?.value ?? e;
                                    setPassword(v);
                                    setPasswordError(getPasswordError(v));
                                    setConfirmPasswordError(getConfirmPasswordError(v, confirmPassword));
                                }}
                                disabled={loading}
                                style={{
                                    borderBottom: `1px solid ${passwordError ? "#d32f2f" : COLORS.border}`,
                                    padding: "12px 0",
                                    fontSize: 16,
                                }}
                            />
                            {passwordError ? (
                                <p style={{ color: "#d32f2f", fontSize: 13, margin: "8px 0 0" }}>{passwordError}</p>
                            ) : null}
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <Input
                                type="password"
                                placeholder="Nhập lại mật khẩu"
                                value={confirmPassword}
                                onChange={(e: any) => {
                                    const v = e.target?.value ?? e;
                                    setConfirmPassword(v);
                                    setConfirmPasswordError(getConfirmPasswordError(password, v));
                                }}
                                disabled={loading}
                                style={{
                                    borderBottom: `1px solid ${confirmPasswordError ? "#d32f2f" : COLORS.border}`,
                                    padding: "12px 0",
                                    fontSize: 16,
                                }}
                            />
                            {confirmPasswordError ? (
                                <p style={{ color: "#d32f2f", fontSize: 13, margin: "8px 0 0" }}>
                                    {confirmPasswordError}
                                </p>
                            ) : null}
                        </div>

                        <Button
                            fullWidth
                            onClick={handleSendOtp}
                            disabled={loading}
                            style={{
                                backgroundColor: loading ? "#88b4ff" : COLORS.primary,
                                borderRadius: 25,
                                padding: "14px 24px",
                                color: COLORS.white,
                                fontWeight: 600,
                                fontSize: 16,
                                border: "none",
                                marginTop: 16,
                                marginBottom: 40,
                            }}
                        >
                            {loading ? "Đang gửi mã..." : "Tiếp tục"}
                        </Button>
                    </>
                ) : (
                    <>
                        <div style={{ marginTop: 16, marginBottom: 24 }}>
                            <OtpInput
                                value={otp}
                                onChange={(v) => {
                                    setOtp(v);
                                    setOtpError("");
                                }}
                                disabled={loading}
                                onResend={handleResendOtp}
                                cooldownSeconds={otpCooldown}
                            />
                        </div>

                        {otpError ? (
                            <p style={{ color: "#d32f2f", fontSize: 14, marginBottom: 12, textAlign: "center" }}>
                                {otpError}
                            </p>
                        ) : null}

                        <Button
                            fullWidth
                            onClick={handleVerifyAndRegister}
                            disabled={loading || otp.length < 6}
                            style={{
                                backgroundColor: loading || otp.length < 6 ? "#88b4ff" : COLORS.primary,
                                borderRadius: 25,
                                padding: "14px 24px",
                                color: COLORS.white,
                                fontWeight: 600,
                                fontSize: 16,
                                border: "none",
                                marginTop: 16,
                                marginBottom: 40,
                            }}
                        >
                            {loading ? "Đang xác thực..." : "Xác nhận"}
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}
