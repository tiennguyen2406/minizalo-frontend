import React, { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAuthStore } from "@/shared/store/authStore";
import axios from "axios";

const COLORS = {
    primary: "var(--accent)",
    white: "#fff",
    text: "#333",
    textSecondary: "#666",
    border: "#e0e0e0",
    error: "#d32f2f",
    success: "#4caf50",
};

interface ChangePasswordModalProps {
    onClose: () => void;
}

export default function ChangePasswordModal({ onClose }: ChangePasswordModalProps) {
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const accessToken = useAuthStore((s) => s.accessToken);

    const rawBase =
        typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL
            ? process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, "")
            : "http://localhost:8080/api";
    const API_BASE_URL = rawBase.endsWith("/api") ? rawBase : `${rawBase}/api`;

    const handleSubmit = useCallback(async () => {
        setError("");
        if (!oldPassword) { setError("Vui lòng nhập mật khẩu cũ"); return; }
        if (!newPassword) { setError("Vui lòng nhập mật khẩu mới"); return; }
        if (newPassword.length < 6 || newPassword.length > 32) { setError("Mật khẩu phải từ 6-32 ký tự"); return; }
        if (/\s/.test(newPassword)) { setError("Mật khẩu không được chứa khoảng trắng"); return; }
        if (!/[A-Z]/.test(newPassword)) { setError("Mật khẩu phải chứa ít nhất 1 chữ hoa"); return; }
        if (!/[a-z]/.test(newPassword)) { setError("Mật khẩu phải chứa ít nhất 1 chữ thường"); return; }
        if (!/[0-9]/.test(newPassword)) { setError("Mật khẩu phải chứa ít nhất 1 chữ số"); return; }
        if (newPassword === oldPassword) { setError("Mật khẩu mới phải khác mật khẩu hiện tại"); return; }
        if (newPassword !== confirmPassword) { setError("Mật khẩu nhập lại không khớp"); return; }

        setLoading(true);
        try {
            await axios.post(
                `${API_BASE_URL}/auth/change-password`,
                { oldPassword, newPassword, confirmPassword },
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            setSuccess(true);
            setTimeout(onClose, 1500);
        } catch (err: any) {
            setError(err.response?.data?.message || "Đổi mật khẩu thất bại. Vui lòng thử lại.");
        } finally {
            setLoading(false);
        }
    }, [oldPassword, newPassword, confirmPassword, accessToken, API_BASE_URL, onClose]);

    const modal = (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 10000,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(0,0,0,0.5)",
            }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div
                style={{
                    backgroundColor: "var(--bg-primary)",
                    borderRadius: 16,
                    padding: 32,
                    width: 400,
                    maxWidth: "90vw",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
                }}
            >
                <h2 style={{ margin: "0 0 24px", fontSize: 22, fontWeight: 700, color: "var(--text-primary)", textAlign: "center" }}>
                    Đổi mật khẩu
                </h2>

                {success ? (
                    <p style={{ color: "var(--success)", textAlign: "center", fontSize: 16, fontWeight: 500 }}>
                        Đổi mật khẩu thành công!
                    </p>
                ) : (
                    <>
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>
                                Mật khẩu cũ
                            </label>
                            <input
                                type="password"
                                name="old-password-field"
                                autoComplete="new-password"
                                value={oldPassword}
                                onChange={(e) => setOldPassword(e.target.value)}
                                disabled={loading}
                                style={{
                                    width: "100%",
                                    padding: "12px 16px",
                                    border: `1px solid ${"var(--border-primary)"}`,
                                    borderRadius: 8,
                                    fontSize: 15,
                                    outline: "none",
                                    boxSizing: "border-box",
                                    backgroundColor: "var(--bg-input)",
                                    color: "var(--text-primary)",
                                }}
                            />
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>
                                Mật khẩu mới
                            </label>
                            <input
                                type="password"
                                name="new-password-field"
                                autoComplete="new-password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                disabled={loading}
                                style={{
                                    width: "100%",
                                    padding: "12px 16px",
                                    border: `1px solid ${"var(--border-primary)"}`,
                                    borderRadius: 8,
                                    fontSize: 15,
                                    outline: "none",
                                    boxSizing: "border-box",
                                    backgroundColor: "var(--bg-input)",
                                    color: "var(--text-primary)",
                                }}
                            />
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>
                                Nhập lại mật khẩu mới
                            </label>
                            <input
                                type="password"
                                name="confirm-password-field"
                                autoComplete="new-password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                disabled={loading}
                                style={{
                                    width: "100%",
                                    padding: "12px 16px",
                                    border: `1px solid ${"var(--border-primary)"}`,
                                    borderRadius: 8,
                                    fontSize: 15,
                                    outline: "none",
                                    boxSizing: "border-box",
                                    backgroundColor: "var(--bg-input)",
                                    color: "var(--text-primary)",
                                }}
                            />
                        </div>

                        {error ? (
                            <p style={{ color: "var(--danger)", fontSize: 14, marginBottom: 12 }}>{error}</p>
                        ) : null}

                        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={loading}
                                style={{
                                    flex: 1,
                                    padding: "12px 16px",
                                    border: `1px solid ${"var(--border-primary)"}`,
                                    borderRadius: 25,
                                    background: "var(--bg-primary)",
                                    color: "var(--text-primary)",
                                    fontSize: 15,
                                    fontWeight: 500,
                                    cursor: "pointer",
                                }}
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={loading}
                                style={{
                                    flex: 1,
                                    padding: "12px 16px",
                                    border: "none",
                                    borderRadius: 25,
                                    background: loading ? "#88b4ff" : "var(--accent)",
                                    color: "var(--text-inverse)",
                                    fontSize: 15,
                                    fontWeight: 600,
                                    cursor: loading ? "default" : "pointer",
                                }}
                            >
                                {loading ? "Đang xử lý..." : "Xác nhận"}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );

    return createPortal(modal, document.body);
}
