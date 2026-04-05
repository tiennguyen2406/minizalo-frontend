import "zmp-ui/zaui.css";
import React, { useState } from "react";
import { useRouter } from "expo-router";
import { Button, Input } from "zmp-ui";
import { useAuthStore } from "@/shared/store/authStore";
import { userService } from "@/shared/services/userService";

const COLORS = {
    primary: "#0068FF",
    white: "#fff",
    text: "#333",
    textSecondary: "#666",
    border: "#e0e0e0",
};

export default function LoginFormWeb() {
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
            await login({
                username: username.trim(),
                password,
            });

            // Fetch user profile after login to get user id, display name, etc.
            try {
                const profile = await userService.getProfile();
                setUser({
                    id: profile.id,
                    username: profile.username,
                    fullName: profile.displayName || profile.username,
                    avatarUrl: profile.avatarUrl || undefined,
                });
            } catch (profileErr) {
                console.warn('Failed to fetch user profile after login:', profileErr);
            }

            router.replace("/(tabs)");
        } catch (err: any) {
            const message =
                err.response?.data?.message ||
                "Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.";
            setError(message);
        } finally {
            setLoading(false);
        }
    };


    return (
        <div
            style={{
                minHeight: "100vh",
                backgroundColor: COLORS.white,
                padding: 24,
            }}
        >
            <div
                style={{
                    paddingTop: 20,
                    paddingBottom: 20,
                }}
            >
                <button
                    type="button"
                    onClick={() => router.back()}
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
                    Đăng nhập
                </h1>
            </div>

            <div style={{ maxWidth: 400, margin: "0 auto" }}>
                <div style={{ marginBottom: 16 }}>
                    <Input
                        placeholder="Số điện thoại hoặc email"
                        value={username}
                        onChange={(e: any) => setUsername(e.target?.value ?? e)}
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

                {error ? (
                    <p
                        style={{
                            color: "#d32f2f",
                            fontSize: 14,
                            marginBottom: 12,
                        }}
                    >
                        {error}
                    </p>
                ) : null}

                <Button
                    fullWidth
                    onClick={handleLogin}
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
                    {loading ? "Đang đăng nhập..." : "Đăng nhập"}
                </Button>

                <div
                    style={{
                        textAlign: "center",
                        marginTop: 20,
                    }}
                >
                    <button
                        type="button"
                        onClick={() => router.push("/(auth)/forgot-password")}
                        style={{
                            background: "none",
                            border: "none",
                            color: COLORS.textSecondary,
                            fontSize: 14,
                            cursor: "pointer",
                            padding: 0,
                        }}
                    >
                        Quên mật khẩu
                    </button>
                </div>
                <div
                    style={{
                        textAlign: "center",
                        marginTop: 16,
                        fontSize: 14,
                        color: COLORS.textSecondary,
                    }}
                >
                    Chưa có tài khoản?{" "}
                    <button
                        type="button"
                        onClick={() => router.push("/(auth)/register-form")}
                        style={{
                            background: "none",
                            border: "none",
                            color: COLORS.primary,
                            fontWeight: 600,
                            fontSize: 14,
                            cursor: "pointer",
                            padding: 0,
                        }}
                    >
                        Đăng ký ngay
                    </button>
                </div>
            </div>
        </div>
    );
}
