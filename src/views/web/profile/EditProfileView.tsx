import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { useUserStore } from "@/shared/store/userStore";
import { useAuthStore } from "@/shared/store/authStore";
import { useAvatarUpload } from "@/shared/hooks/useAvatarUpload";
import type { UserProfileUpdateRequest } from "@/shared/services/types";

const iconCamera = (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
    </svg>
);

const COLORS = {
    primary: "#0068FF",
    white: "#fff",
    text: "#333",
    textSecondary: "#666",
    border: "#e0e0e0",
};

const inputStyle = {
    width: "100%" as const,
    padding: "12px 14px",
    fontSize: 16,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 10,
    boxSizing: "border-box" as const,
};

export default function EditProfileView() {
    const router = useRouter();
    const { profile, loading, error, fetchProfile, updateProfile } = useUserStore();
    const isHydrated = useAuthStore((s) => s.isHydrated);
    const hasToken = !!useAuthStore((s) => s.accessToken);
    const { preview, uploading: avatarUploading, error: avatarError, selectFile, upload, hasToken: hasAuth } = useAvatarUpload();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [displayName, setDisplayName] = useState("");
    const [phone, setPhone] = useState("");
    const [gender, setGender] = useState("");
    const [dateOfBirth, setDateOfBirth] = useState("");
    const [businessDescription, setBusinessDescription] = useState("");
    const [submitError, setSubmitError] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isHydrated && hasToken) fetchProfile();
    }, [isHydrated, hasToken, fetchProfile]);

    useEffect(() => {
        if (profile) {
            setDisplayName(profile.displayName ?? "");
            setPhone(profile.phone ?? "");
            setGender(profile.gender ?? "");
            setDateOfBirth(profile.dateOfBirth ?? "");
            setBusinessDescription(profile.businessDescription ?? "");
        }
    }, [profile]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitError("");
        setSaving(true);
        try {
            const data: UserProfileUpdateRequest = {
                displayName: displayName.trim() || undefined,
                phone: phone.trim() || undefined,
                gender: gender || undefined,
                dateOfBirth: dateOfBirth || undefined,
                businessDescription: businessDescription.trim() || undefined,
            };
            await updateProfile(data);
            router.replace("/(tabs)/account");
        } catch {
            setSubmitError("Cập nhật thất bại. Vui lòng thử lại.");
        } finally {
            setSaving(false);
        }
    };

    if (!isHydrated) {
        return (
            <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary, fontSize: 16 }}>
                Đang tải...
            </div>
        );
    }

    if (!hasToken) {
        return (
            <div style={{ padding: 24, textAlign: "center", color: COLORS.textSecondary, fontSize: 16 }}>
                Vui lòng đăng nhập để chỉnh sửa thông tin.
            </div>
        );
    }

    if (loading && !profile) {
        return (
            <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary, fontSize: 16 }}>
                Đang tải...
            </div>
        );
    }

    const displayNameForAvatar = displayName || profile?.username || "?";
    const avatarUrl = preview || profile?.avatarUrl || null;

    const onAvatarClick = () => fileInputRef.current?.click();
    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            selectFile(file);
            if (hasAuth) upload(file);
        }
        e.target.value = "";
    };

    return (
        <div
            style={{
                minHeight: "100vh",
                backgroundColor: "rgba(0,0,0,0.4)",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "center",
                padding: "24px 16px 40px",
            }}
        >
            <div
                style={{
                    backgroundColor: COLORS.white,
                    borderRadius: 20,
                    maxWidth: 640,
                    width: "100%",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
                    overflow: "hidden",
                }}
            >
                {/* Title + Back */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "20px 28px",
                        borderBottom: "1px solid #eee",
                    }}
                >
                    <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: COLORS.text }}>
                        Chỉnh sửa thông tin tài khoản
                    </h2>
                    <button
                        type="button"
                        onClick={() => router.back()}
                        style={{
                            border: "none",
                            background: "none",
                            cursor: "pointer",
                            padding: 8,
                            color: COLORS.textSecondary,
                            fontSize: 24,
                        }}
                    >
                        ←
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Banner - giống hồ sơ */}
                    <div
                        style={{
                            height: 160,
                            background: profile?.coverPhotoUrl
                                ? `url(${profile.coverPhotoUrl}) center/cover no-repeat`
                                : "linear-gradient(135deg, #0068FF 0%, #00C6FF 100%)",
                        }}
                    />

                    {/* Avatar + Tên (chỉnh sửa) - cho phép đổi ảnh */}
                    <div style={{ padding: "0 28px 20px", marginTop: -60 }}>
                        <div style={{ display: "flex", alignItems: "flex-end", gap: 20 }}>
                            <div
                                style={{
                                    position: "relative",
                                    width: 120,
                                    height: 120,
                                    borderRadius: "50%",
                                    overflow: "hidden",
                                    border: "4px solid #fff",
                                    boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
                                    flexShrink: 0,
                                    backgroundColor: "#e0e0e0",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "#666",
                                    fontSize: 40,
                                    fontWeight: 600,
                                }}
                            >
                                {avatarUrl ? (
                                    <img
                                        src={avatarUrl}
                                        alt="Avatar"
                                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                    />
                                ) : (
                                    (displayNameForAvatar && displayNameForAvatar.charAt(0).toUpperCase()) || "?"
                                )}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/gif"
                                    style={{ display: "none" }}
                                    onChange={onFileChange}
                                />
                                <button
                                    type="button"
                                    onClick={onAvatarClick}
                                    disabled={avatarUploading}
                                    style={{
                                        position: "absolute",
                                        right: 0,
                                        bottom: 0,
                                        width: 40,
                                        height: 40,
                                        borderRadius: "50%",
                                        border: "3px solid #fff",
                                        backgroundColor: COLORS.primary,
                                        color: COLORS.white,
                                        cursor: avatarUploading ? "wait" : "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    {iconCamera}
                                </button>
                            </div>
                            <div style={{ flex: 1, paddingBottom: 10 }}>
                                <label
                                    style={{
                                        display: "block",
                                        fontSize: 16,
                                        fontWeight: 500,
                                        color: COLORS.textSecondary,
                                        marginBottom: 8,
                                    }}
                                >
                                    Họ và tên
                                </label>
                                <input
                                    type="text"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    placeholder="Nhập họ và tên"
                                    disabled={saving}
                                    style={inputStyle}
                                />
                                {avatarError && (
                                    <div style={{ fontSize: 14, color: "#e53935", marginTop: 8 }}>{avatarError}</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Thông tin kinh doanh - giống hồ sơ */}
                    <div
                        style={{
                            margin: "0 28px 20px",
                            padding: 20,
                            backgroundColor: "#f5f5f5",
                            borderRadius: 14,
                        }}
                    >
                        <div style={{ fontSize: 16, color: "#666", marginBottom: 10 }}>Mô tả</div>
                        <input
                            type="text"
                            value={businessDescription}
                            onChange={(e) => setBusinessDescription(e.target.value)}
                            placeholder="VD: https://facebook.com/... hoặc mô tả"
                            disabled={saving}
                            style={inputStyle}
                        />
                    </div>

                    {/* Thông tin cá nhân - giống hồ sơ */}
                    <div
                        style={{
                            margin: "0 28px 24px",
                            padding: 20,
                            backgroundColor: "#f5f5f5",
                            borderRadius: 14,
                        }}
                    >
                        <div style={{ fontSize: 16, color: "#666", marginBottom: 10 }}>Giới tính</div>
                        <select
                            value={gender}
                            onChange={(e) => setGender(e.target.value)}
                            disabled={saving}
                            style={{
                                ...inputStyle,
                                backgroundColor: COLORS.white,
                            }}
                        >
                            <option value="">Chọn giới tính</option>
                            <option value="Nam">Nam</option>
                            <option value="Nữ">Nữ</option>
                            <option value="Khác">Khác</option>
                        </select>

                        <div style={{ fontSize: 16, color: "#666", marginBottom: 10, marginTop: 16 }}>Ngày sinh</div>
                        <input
                            type="date"
                            value={dateOfBirth}
                            onChange={(e) => setDateOfBirth(e.target.value)}
                            disabled={saving}
                            style={inputStyle}
                        />

                        <div style={{ fontSize: 16, color: "#666", marginBottom: 10, marginTop: 16 }}>Điện thoại</div>
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="VD: 0362356676"
                            disabled={saving}
                            style={inputStyle}
                        />
                        <div style={{ fontSize: 14, color: "#666", marginTop: 10 }}>
                            Chỉ bạn bè có lưu số của bạn trong danh bạ mới xem được số này.
                        </div>
                    </div>

                    {submitError && (
                        <p style={{ color: "#d32f2f", fontSize: 15, margin: "0 28px 16px" }}>{submitError}</p>
                    )}

                    <div style={{ padding: "0 28px 24px", display: "flex", gap: 12, flexWrap: "wrap" }}>
                        <button
                            type="submit"
                            disabled={saving}
                            style={{
                                padding: "10px 20px",
                                borderRadius: 10,
                                border: "none",
                                backgroundColor: saving ? "#88b4ff" : COLORS.primary,
                                color: COLORS.white,
                                fontSize: 16,
                                fontWeight: 500,
                                cursor: saving ? "wait" : "pointer",
                            }}
                        >
                            {saving ? "Đang lưu..." : "Lưu thay đổi"}
                        </button>
                        <button
                            type="button"
                            onClick={() => router.back()}
                            style={{
                                padding: "10px 20px",
                                borderRadius: 10,
                                border: `1px solid ${COLORS.border}`,
                                backgroundColor: "transparent",
                                color: COLORS.textSecondary,
                                fontSize: 16,
                                cursor: "pointer",
                            }}
                        >
                            Hủy
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
