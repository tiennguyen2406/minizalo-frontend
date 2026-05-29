import "zmp-ui/zaui.css";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "expo-router";
import { Button } from "zmp-ui";
import { QRCodeSVG } from "qrcode.react";
import { authService } from "@/shared/services/authService";
import { useAuthStore } from "@/shared/store/authStore";
import { userService } from "@/shared/services/userService";

const COLORS = {
    primary: "#0068FF",
    white: "#fff",
    text: "#333",
    textSecondary: "#666",
    bg: "#f0f2f5",
    border: "#e0e0e0",
};

const rawBase =
    process.env.EXPO_PUBLIC_API_URL
        ? process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, "")
        : "http://localhost:8080/api";
const API_BASE = rawBase.endsWith("/api") ? rawBase : `${rawBase}/api`;

type Mode = "qr" | "password";

export default function LoginScreenWeb() {
    const router = useRouter();
    const setTokens = useAuthStore((s) => s.setTokens);
    const setUser = useAuthStore((s) => s.setUser);

    const [mode, setMode] = useState<Mode>("qr");
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [qrStatus, setQrStatus] = useState<"loading" | "pending" | "expired" | "confirmed" | "error">("loading");
    const [error, setError] = useState("");
    const eventSourceRef = useRef<EventSource | null>(null);
    const mountedRef = useRef(true);

    const closeEventSource = useCallback(() => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
    }, []);

    const generateQr = useCallback(async () => {
        closeEventSource();
        setQrStatus("loading");
        setError("");
        try {
            const data = await authService.generateQrSession();
            if (!mountedRef.current) return;
            setSessionId(data.sessionId);
            setQrStatus("pending");
        } catch {
            if (!mountedRef.current) return;
            setQrStatus("error");
            setError("Không thể tạo mã QR. Vui lòng thử lại.");
        }
    }, [closeEventSource]);

    const handleConfirmed = useCallback(async (accessToken: string, refreshToken: string) => {
        closeEventSource();
        setQrStatus("confirmed");
        setTokens(accessToken, refreshToken);
        try {
            const profile = await userService.getProfile();
            setUser({
                id: profile.id,
                username: profile.username,
                fullName: profile.displayName || profile.username,
                avatarUrl: profile.avatarUrl || undefined,
                roles: profile.roles || [],
            });
        } catch {
            // non-critical
        }
        router.replace("/(tabs)");
    }, [closeEventSource, setTokens, setUser, router]);

    useEffect(() => {
        mountedRef.current = true;
        if (mode === "qr") {
            generateQr();
        }
        return () => {
            mountedRef.current = false;
            closeEventSource();
        };
    }, [mode, generateQr, closeEventSource]);

    useEffect(() => {
        if (mode !== "qr" || !sessionId || qrStatus !== "pending") {
            closeEventSource();
            return;
        }

        const sseUrl = `${API_BASE}/auth/qr-login/events/${sessionId}`;
        const es = new EventSource(sseUrl);
        eventSourceRef.current = es;

        es.addEventListener("confirmed", (event: MessageEvent) => {
            if (!mountedRef.current) return;
            try {
                const data = JSON.parse(event.data);
                if (data.accessToken && data.refreshToken) {
                    handleConfirmed(data.accessToken, data.refreshToken);
                }
            } catch { /* parse error */ }
        });

        es.addEventListener("expired", () => {
            if (!mountedRef.current) return;
            setQrStatus("expired");
            es.close();
        });

        es.onerror = () => {
            if (!mountedRef.current) return;
            es.close();
            eventSourceRef.current = null;
            setQrStatus("expired");
        };

        return () => {
            es.close();
            eventSourceRef.current = null;
        };
    }, [mode, sessionId, qrStatus, closeEventSource, handleConfirmed]);

    const qrValue = sessionId ? `minizalo://qr-login/${sessionId}` : "";

    return (
        <div
            style={{
                minHeight: "100vh",
                backgroundColor: COLORS.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
                colorScheme: "light",
            }}
        >
            <div
                style={{
                    backgroundColor: COLORS.white,
                    borderRadius: 12,
                    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                    padding: "40px 48px",
                    width: "100%",
                    maxWidth: 420,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                }}
            >
                <h1
                    style={{
                        fontSize: 36,
                        fontWeight: "bold",
                        color: COLORS.primary,
                        margin: "0 0 8px 0",
                    }}
                >
                    MiniZalo
                </h1>

                {mode === "qr" ? (
                    <>
                        <p
                            style={{
                                color: COLORS.text,
                                fontSize: 15,
                                margin: "0 0 24px 0",
                                textAlign: "center",
                            }}
                        >
                            Đăng nhập bằng mã QR
                        </p>

                        <div
                            style={{
                                padding: 16,
                                border: `2px solid ${COLORS.border}`,
                                borderRadius: 12,
                                marginBottom: 16,
                                position: "relative",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: 220,
                                height: 220,
                            }}
                        >
                            {qrStatus === "loading" ? (
                                <div style={{ color: COLORS.textSecondary, fontSize: 14 }}>Đang tạo mã QR...</div>
                            ) : qrStatus === "pending" && qrValue ? (
                                <QRCodeSVG
                                    value={qrValue}
                                    size={188}
                                    level="M"
                                    bgColor={COLORS.white}
                                    fgColor={COLORS.text}
                                />
                            ) : qrStatus === "expired" ? (
                                <div style={{ textAlign: "center" }}>
                                    <p style={{ color: COLORS.textSecondary, fontSize: 14, margin: "0 0 12px 0" }}>
                                        Mã QR đã hết hạn
                                    </p>
                                    <button
                                        type="button"
                                        onClick={generateQr}
                                        style={{
                                            background: COLORS.primary,
                                            color: COLORS.white,
                                            border: "none",
                                            borderRadius: 6,
                                            padding: "8px 20px",
                                            fontSize: 13,
                                            cursor: "pointer",
                                            fontWeight: 600,
                                        }}
                                    >
                                        Tạo mã mới
                                    </button>
                                </div>
                            ) : qrStatus === "confirmed" ? (
                                <div style={{ color: "#4caf50", fontWeight: 600, fontSize: 14 }}>
                                    Đăng nhập thành công!
                                </div>
                            ) : qrStatus === "error" ? (
                                <div style={{ textAlign: "center" }}>
                                    <p style={{ color: "#d32f2f", fontSize: 13, margin: "0 0 12px 0" }}>{error}</p>
                                    <button
                                        type="button"
                                        onClick={generateQr}
                                        style={{
                                            background: COLORS.primary,
                                            color: COLORS.white,
                                            border: "none",
                                            borderRadius: 6,
                                            padding: "8px 20px",
                                            fontSize: 13,
                                            cursor: "pointer",
                                            fontWeight: 600,
                                        }}
                                    >
                                        Thử lại
                                    </button>
                                </div>
                            ) : null}
                        </div>

                        {qrStatus === "pending" && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
                                <div
                                    style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: "50%",
                                        backgroundColor: COLORS.primary,
                                        animation: "pulse 1.5s ease-in-out infinite",
                                    }}
                                />
                                <span style={{ color: COLORS.textSecondary, fontSize: 13 }}>
                                    Quét mã QR bằng MiniZalo trên điện thoại
                                </span>
                            </div>
                        )}

                        <div style={{ width: "100%", borderTop: `1px solid ${COLORS.border}`, margin: "8px 0 20px 0" }} />

                        <button
                            type="button"
                            onClick={() => setMode("password")}
                            style={{
                                background: "none",
                                border: `1px solid ${COLORS.border}`,
                                borderRadius: 25,
                                padding: "10px 28px",
                                color: COLORS.text,
                                fontSize: 14,
                                cursor: "pointer",
                                fontWeight: 500,
                            }}
                        >
                            Đăng nhập bằng mật khẩu
                        </button>

                        <div style={{ marginTop: 16, display: "flex", gap: 16 }}>
                            <button
                                type="button"
                                onClick={() => router.push("/(auth)/register-form")}
                                style={{
                                    background: "none",
                                    border: "none",
                                    color: COLORS.primary,
                                    fontSize: 13,
                                    cursor: "pointer",
                                    fontWeight: 500,
                                    padding: 0,
                                }}
                            >
                                Đăng ký
                            </button>
                            <button
                                type="button"
                                onClick={() => router.push("/(auth)/forgot-password")}
                                style={{
                                    background: "none",
                                    border: "none",
                                    color: COLORS.textSecondary,
                                    fontSize: 13,
                                    cursor: "pointer",
                                    padding: 0,
                                }}
                            >
                                Quên mật khẩu
                            </button>
                        </div>

                        <style>{`
                            @keyframes pulse {
                                0%, 100% { opacity: 1; }
                                50% { opacity: 0.3; }
                            }
                        `}</style>
                    </>
                ) : (
                    <>
                        <p style={{ color: COLORS.textSecondary, fontSize: 14, margin: "0 0 20px 0" }}>
                            Đăng nhập bằng mật khẩu
                        </p>

                        <div style={{ width: "100%" }}>
                            <PasswordLoginForm
                                onSwitchToQr={() => setMode("qr")}
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function PasswordLoginForm({ onSwitchToQr }: { onSwitchToQr: () => void }) {
    const router = useRouter();
    const login = useAuthStore((s) => s.login);
    const setUser = useAuthStore((s) => s.setUser);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleLogin = async () => {
        setError("");
        if (!username.trim()) {
            setError("Vui lòng nhập số điện thoại hoặc email");
            return;
        }
        if (!password) {
            setError("Vui lòng nhập mật khẩu");
            return;
        }
        setLoading(true);
        try {
            await login({ username: username.trim(), password });
            try {
                const profile = await userService.getProfile();
                setUser({
                    id: profile.id,
                    username: profile.username,
                    fullName: profile.displayName || profile.username,
                    avatarUrl: profile.avatarUrl || undefined,
                    roles: profile.roles || [],
                });
            } catch { /* non-critical */ }
            router.replace("/(tabs)");
        } catch (err: any) {
            setError(err.response?.data?.message || "Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div style={{ marginBottom: 16 }}>
                <input
                    placeholder="Số điện thoại hoặc email"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={loading}
                    style={{
                        width: "100%",
                        border: "none",
                        borderBottom: `1px solid ${COLORS.border}`,
                        padding: "12px 0",
                        fontSize: 15,
                        outline: "none",
                        boxSizing: "border-box",
                        backgroundColor: COLORS.white,
                        color: COLORS.text,
                    }}
                />
            </div>
            <div style={{ marginBottom: 16 }}>
                <input
                    type="password"
                    placeholder="Mật khẩu"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                    style={{
                        width: "100%",
                        border: "none",
                        borderBottom: `1px solid ${COLORS.border}`,
                        padding: "12px 0",
                        fontSize: 15,
                        outline: "none",
                        boxSizing: "border-box",
                        backgroundColor: COLORS.white,
                        color: COLORS.text,
                    }}
                />
            </div>

            {error && (
                <p style={{ color: "#d32f2f", fontSize: 13, margin: "0 0 12px 0" }}>
                    {error}
                </p>
            )}

            <Button
                fullWidth
                onClick={handleLogin}
                disabled={loading}
                style={{
                    backgroundColor: loading ? "#88b4ff" : COLORS.primary,
                    borderRadius: 25,
                    padding: "12px 24px",
                    color: COLORS.white,
                    fontWeight: 600,
                    fontSize: 15,
                    border: "none",
                    marginTop: 8,
                }}
            >
                {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            </Button>

            <div style={{ display: "flex", justifyContent: "space-between", width: "100%", marginTop: 16 }}>
                <button
                    type="button"
                    onClick={() => router.push("/(auth)/forgot-password")}
                    style={{
                        background: "none",
                        border: "none",
                        color: COLORS.textSecondary,
                        fontSize: 13,
                        cursor: "pointer",
                        padding: 0,
                    }}
                >
                    Quên mật khẩu
                </button>
                <button
                    type="button"
                    onClick={() => router.push("/(auth)/register-form")}
                    style={{
                        background: "none",
                        border: "none",
                        color: COLORS.primary,
                        fontSize: 13,
                        cursor: "pointer",
                        fontWeight: 500,
                        padding: 0,
                    }}
                >
                    Đăng ký
                </button>
            </div>

            <div style={{ width: "100%", borderTop: `1px solid ${COLORS.border}`, margin: "20px 0 16px 0" }} />

            <button
                type="button"
                onClick={onSwitchToQr}
                style={{
                    background: "none",
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 25,
                    padding: "10px 28px",
                    color: COLORS.text,
                    fontSize: 14,
                    cursor: "pointer",
                    fontWeight: 500,
                }}
            >
                Đăng nhập bằng mã QR
            </button>
        </>
    );
}
