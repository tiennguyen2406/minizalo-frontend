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
    success: "#4caf50",
};

type Step = "phone" | "reset";

export default function ForgotPasswordWeb() {
    const router = useRouter();
    const [step, setStep] = useState<Step>("phone");

    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [otpCooldown, setOtpCooldown] = useState(60);

    const handleSendOtp = useCallback(async () => {
        setError("");
        if (!phone.trim()) {
            setError("Vui lòng nhập số điện thoại");
            return;
        }
        if (!/^(03|05|07|08|09)[0-9]{8}$/.test(phone.trim())) {
            setError("Số điện thoại phải là 10 chữ số, bắt đầu bằng 03, 05, 07, 08 hoặc 09");
            return;
        }
        setLoading(true);
        try {
            await authService.forgotPasswordSendOtp(phone.trim());
            setStep("reset");
            setOtpCooldown(60);
        } catch (err: any) {
            setError(err.response?.data?.message || "Gửi mã OTP thất bại. Vui lòng thử lại.");
        } finally {
            setLoading(false);
        }
    }, [phone]);

    const handleResendOtp = useCallback(async () => {
        try {
            await authService.forgotPasswordSendOtp(phone.trim());
            setOtpCooldown(60);
            setError("");
        } catch (err: any) {
            setError(err.response?.data?.message || "Gửi lại mã OTP thất bại.");
        }
    }, [phone]);

    const handleResetPassword = useCallback(async () => {
        setError("");
        if (otp.length < 6) {
            setError("Vui lòng nhập đủ 6 số OTP");
            return;
        }
        if (!newPassword) {
            setError("Vui lòng nhập mật khẩu mới");
            return;
        }
        if (newPassword.length < 6 || newPassword.length > 32) {
            setError("Mật khẩu phải từ 6-32 ký tự");
            return;
        }
        if (/\s/.test(newPassword)) {
            setError("Mật khẩu không được chứa khoảng trắng");
            return;
        }
        if (!/[A-Z]/.test(newPassword)) {
            setError("Mật khẩu phải chứa ít nhất 1 chữ hoa");
            return;
        }
        if (!/[a-z]/.test(newPassword)) {
            setError("Mật khẩu phải chứa ít nhất 1 chữ thường");
            return;
        }
        if (!/[0-9]/.test(newPassword)) {
            setError("Mật khẩu phải chứa ít nhất 1 chữ số");
            return;
        }
        if (newPassword !== confirmPassword) {
            setError("Mật khẩu nhập lại không khớp");
            return;
        }
        setLoading(true);
        try {
            await authService.resetPassword(phone.trim(), otp, newPassword, confirmPassword);
            router.replace("/(auth)/login-form");
        } catch (err: any) {
            setError(err.response?.data?.message || "Đặt lại mật khẩu thất bại. Vui lòng thử lại.");
        } finally {
            setLoading(false);
        }
    }, [otp, newPassword, confirmPassword, phone, router]);

    return (
        <div style={{ minHeight: "100vh", backgroundColor: COLORS.white, padding: 24 }}>
            <div style={{ paddingTop: 20, paddingBottom: 20 }}>
                <button
                    type="button"
                    onClick={() => {
                        if (step === "reset") {
                            setStep("phone");
                            setOtp("");
                            setNewPassword("");
                            setConfirmPassword("");
                            setError("");
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
                    Quên mật khẩu
                </h1>
                <p style={{ color: COLORS.textSecondary, fontSize: 14, marginTop: 8, textAlign: "center" }}>
                    {step === "phone"
                        ? "Nhập số điện thoại để nhận mã xác thực"
                        : `Mã xác thực đã được gửi đến số ${phone}`}
                </p>
            </div>

            <div style={{ maxWidth: 400, margin: "0 auto" }}>
                {step === "phone" ? (
                    <>
                        <div style={{ marginBottom: 16 }}>
                            <Input
                                placeholder="Số điện thoại"
                                value={phone}
                                onChange={(e: any) => setPhone(e.target?.value ?? e)}
                                disabled={loading}
                                style={{ borderBottom: `1px solid ${COLORS.border}`, padding: "12px 0", fontSize: 16 }}
                            />
                        </div>

                        {error ? (
                            <p style={{ color: "#d32f2f", fontSize: 14, marginBottom: 12 }}>{error}</p>
                        ) : null}

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
                            }}
                        >
                            {loading ? "Đang gửi..." : "Gửi mã xác thực"}
                        </Button>
                    </>
                ) : (
                    <>
                        <div style={{ marginTop: 16, marginBottom: 24 }}>
                            <OtpInput
                                value={otp}
                                onChange={setOtp}
                                disabled={loading}
                                onResend={handleResendOtp}
                                cooldownSeconds={otpCooldown}
                            />
                        </div>

                        <div style={{ marginBottom: 16 }}>
                            <Input
                                type="password"
                                placeholder="Mật khẩu mới"
                                value={newPassword}
                                onChange={(e: any) => setNewPassword(e.target?.value ?? e)}
                                disabled={loading}
                                style={{ borderBottom: `1px solid ${COLORS.border}`, padding: "12px 0", fontSize: 16 }}
                            />
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <Input
                                type="password"
                                placeholder="Nhập lại mật khẩu mới"
                                value={confirmPassword}
                                onChange={(e: any) => setConfirmPassword(e.target?.value ?? e)}
                                disabled={loading}
                                style={{ borderBottom: `1px solid ${COLORS.border}`, padding: "12px 0", fontSize: 16 }}
                            />
                        </div>

                        {error ? (
                            <p style={{ color: "#d32f2f", fontSize: 14, marginBottom: 12, textAlign: "center" }}>
                                {error}
                            </p>
                        ) : null}

                        <Button
                            fullWidth
                            onClick={handleResetPassword}
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
                            }}
                        >
                            {loading ? "Đang xử lý..." : "Đặt lại mật khẩu"}
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}
