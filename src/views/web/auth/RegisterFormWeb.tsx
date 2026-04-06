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
  const [error, setError] = useState("");
  const [otpCooldown, setOtpCooldown] = useState(60);

  const validateForm = useCallback(() => {
    const trimmedName = name.trim();
    if (!trimmedName) return "Vui lòng nhập tên";
    if (trimmedName.length < 2 || trimmedName.length > 40)
      return "Tên phải từ 2-40 ký tự";
    if (!/^[\p{L} ]+$/u.test(trimmedName))
      return "Tên chỉ được chứa chữ cái và khoảng trắng, không chứa số hay ký tự đặc biệt";
    if (!phone.trim()) return "Vui lòng nhập số điện thoại";
    if (!/^(03|05|07|08|09)[0-9]{8}$/.test(phone.trim()))
      return "Số điện thoại phải là 10 chữ số, bắt đầu bằng 03, 05, 07, 08 hoặc 09";
    if (!email.trim()) return "Vui lòng nhập email";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return "Email không hợp lệ";
    if (!password) return "Vui lòng nhập mật khẩu";
    if (password.length < 6 || password.length > 32)
      return "Mật khẩu phải từ 6-32 ký tự";
    if (/\s/.test(password)) return "Mật khẩu không được chứa khoảng trắng";
    if (!/[A-Z]/.test(password)) return "Mật khẩu phải chứa ít nhất 1 chữ hoa";
    if (!/[a-z]/.test(password))
      return "Mật khẩu phải chứa ít nhất 1 chữ thường";
    if (!/[0-9]/.test(password)) return "Mật khẩu phải chứa ít nhất 1 chữ số";
    if (password !== confirmPassword) return "Mật khẩu nhập lại không khớp";
    return null;
  }, [name, phone, email, password, confirmPassword]);

  const handleSendOtp = useCallback(async () => {
    setError("");
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    try {
      await authService.sendOtp(phone.trim());
      setStep("otp");
      setOtpCooldown(60);
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Gửi mã OTP thất bại. Vui lòng thử lại.",
      );
    } finally {
      setLoading(false);
    }
  }, [validateForm, phone]);

  const handleResendOtp = useCallback(async () => {
    try {
      await authService.sendOtp(phone.trim());
      setOtpCooldown(60);
      setError("");
    } catch (err: any) {
      setError(err.response?.data?.message || "Gửi lại mã OTP thất bại.");
    }
  }, [phone]);

  const handleVerifyAndRegister = useCallback(async () => {
    setError("");
    if (otp.length < 6) {
      setError("Vui lòng nhập đủ 6 số OTP");
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
      setError(
        err.response?.data?.message || "Xác thực thất bại. Vui lòng thử lại.",
      );
    } finally {
      setLoading(false);
    }
  }, [otp, phone, name, email, password, router]);

  return (
    <div
      style={{ minHeight: "100vh", backgroundColor: COLORS.white, padding: 24 }}
    >
      <div style={{ paddingTop: 20, paddingBottom: 20 }}>
        <button
          type="button"
          onClick={() => {
            if (step === "otp") {
              setStep("form");
              setOtp("");
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
          {step === "form" ? "Đăng ký" : "Xác thực OTP"}
        </h1>
        {step === "otp" && (
          <p
            style={{
              color: COLORS.textSecondary,
              fontSize: 14,
              marginTop: 8,
              textAlign: "center",
            }}
          >
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
                onChange={(e: any) => setName(e.target?.value ?? e)}
                disabled={loading}
                style={{
                  borderBottom: `1px solid ${COLORS.border}`,
                  padding: "12px 0",
                  fontSize: 16,
                }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <Input
                placeholder="Số điện thoại"
                value={phone}
                onChange={(e: any) => setPhone(e.target?.value ?? e)}
                disabled={loading}
                style={{
                  borderBottom: `1px solid ${COLORS.border}`,
                  padding: "12px 0",
                  fontSize: 16,
                }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <Input
                placeholder="Email"
                value={email}
                onChange={(e: any) => setEmail(e.target?.value ?? e)}
                disabled={loading}
                style={{
                  borderBottom: `1px solid ${COLORS.border}`,
                  padding: "12px 0",
                  fontSize: 16,
                }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <Input
                type="password"
                placeholder="Mật khẩu"
                value={password}
                onChange={(e: any) => setPassword(e.target?.value ?? e)}
                disabled={loading}
                style={{
                  borderBottom: `1px solid ${COLORS.border}`,
                  padding: "12px 0",
                  fontSize: 16,
                }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <Input
                type="password"
                placeholder="Nhập lại mật khẩu"
                value={confirmPassword}
                onChange={(e: any) => setConfirmPassword(e.target?.value ?? e)}
                disabled={loading}
                style={{
                  borderBottom: `1px solid ${COLORS.border}`,
                  padding: "12px 0",
                  fontSize: 16,
                }}
              />
            </div>

            {error ? (
              <p style={{ color: "#d32f2f", fontSize: 14, marginBottom: 12 }}>
                {error}
              </p>
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
                onChange={setOtp}
                disabled={loading}
                onResend={handleResendOtp}
                cooldownSeconds={otpCooldown}
              />
            </div>

            {error ? (
              <p
                style={{
                  color: "#d32f2f",
                  fontSize: 14,
                  marginBottom: 12,
                  textAlign: "center",
                }}
              >
                {error}
              </p>
            ) : null}

            <Button
              fullWidth
              onClick={handleVerifyAndRegister}
              disabled={loading || otp.length < 6}
              style={{
                backgroundColor:
                  loading || otp.length < 6 ? "#88b4ff" : COLORS.primary,
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
