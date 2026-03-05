import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { useUserStore } from "@/shared/store/userStore";
import { useAuthStore } from "@/shared/store/authStore";
import { useAvatarUpload } from "@/shared/hooks/useAvatarUpload";

const MONTHS = "tháng 01,tháng 02,tháng 03,tháng 04,tháng 05,tháng 06,tháng 07,tháng 08,tháng 09,tháng 10,tháng 11,tháng 12".split(",");

function formatDate(iso: string | null | undefined): string {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    const mi = parseInt(m, 10) - 1;
    if (isNaN(mi) || mi < 0 || mi > 11) return iso;
    return `${d} ${MONTHS[mi]} ${y}`;
}

const iconClose = (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);
const iconPencil = (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
);
const iconCamera = (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
    </svg>
);

export default function AccountInfoView() {
    const router = useRouter();
    const { profile, loading, error, fetchProfile } = useUserStore();
    const isHydrated = useAuthStore((s) => s.isHydrated);
    const accessToken = useAuthStore((s) => s.accessToken);
    const hasToken = !!accessToken;
    const { preview, uploading, error: avatarError, selectFile, upload, hasToken: hasAuth } = useAvatarUpload();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const coverInputRef = useRef<HTMLInputElement>(null);
    const [coverPreview, setCoverPreview] = useState<string | null>(null);
    const [coverUploading, setCoverUploading] = useState(false);
    const [coverError, setCoverError] = useState<string | null>(null);
    const [coverHover, setCoverHover] = useState(false);

    // Chỉ gọi API sau khi auth đã rehydrate từ storage (tránh 401 do token chưa kịp có)
    useEffect(() => {
        if (isHydrated && hasToken) fetchProfile();
    }, [isHydrated, hasToken, fetchProfile]);

    const onClose = () => router.replace("/(tabs)");

    const onAvatarClick = () => fileInputRef.current?.click();
    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            selectFile(file);
            if (hasAuth) upload(file);
        }
        e.target.value = "";
    };

    const onCoverClick = () => coverInputRef.current?.click();
    const onCoverFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            setCoverError("Vui lòng chọn file ảnh (JPEG, PNG, GIF).");
            e.target.value = "";
            return;
        }
        setCoverError(null);
        const url = URL.createObjectURL(file);
        setCoverPreview(url);
        if (hasAuth) {
            setCoverUploading(true);
            try {
                const userService = (await import("@/shared/services/userService")).default;
                const updatedProfile = await userService.uploadCoverPhoto(file);
                useUserStore.getState().setProfile(updatedProfile);
                setCoverPreview(null);
            } catch (err: unknown) {
                const msg = (err as { response?: { data?: string } })?.response?.data ?? "Tải ảnh bìa thất bại.";
                setCoverError(typeof msg === "string" ? msg : "Tải ảnh bìa thất bại.");
            } finally {
                setCoverUploading(false);
            }
        }
        e.target.value = "";
    };

    // Khi đã đăng nhập: chỉ dùng profile từ API (userStore), không dùng data ảo
    const displayProfile = profile ?? null;
    const avatarUrl = preview || displayProfile?.avatarUrl || null;
    const displayName = displayProfile?.displayName || displayProfile?.username || "Người dùng";

    return (
        <div
            role="dialog"
            aria-label="Thông tin tài khoản"
            onClick={onClose}
            style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(0,0,0,0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1100,
                padding: 24,
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    backgroundColor: "#fff",
                    borderRadius: 20,
                    maxWidth: 640,
                    width: "100%",
                    maxHeight: "90vh",
                    overflowY: "auto",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
                }}
            >
                {/* Title + Close */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "20px 28px",
                        borderBottom: "1px solid #eee",
                    }}
                >
                    <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: "#333" }}>
                        Thông tin tài khoản
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            border: "none",
                            background: "none",
                            cursor: "pointer",
                            padding: 4,
                            color: "#666",
                        }}
                    >
                        {iconClose}
                    </button>
                </div>

                {/* Đợi auth rehydrate từ storage (tránh 401 do token chưa kịp có) */}
                {!isHydrated && (
                    <div style={{ padding: 40, textAlign: "center", color: "#666", fontSize: 16 }}>
                        Đang tải...
                    </div>
                )}
                {/* Loading / Error */}
                {isHydrated && loading && !displayProfile && (
                    <div style={{ padding: 40, textAlign: "center", color: "#666", fontSize: 16 }}>
                        Đang tải thông tin tài khoản...
                    </div>
                )}
                {isHydrated && error && !displayProfile && (
                    <div style={{ padding: 28, textAlign: "center" }}>
                        <p style={{ color: "#e53935", marginBottom: 16, fontSize: 16 }}>{error}</p>
                        <button
                            type="button"
                            onClick={() => fetchProfile()}
                            style={{
                                padding: "10px 20px",
                                borderRadius: 10,
                                border: "none",
                                backgroundColor: "#0068FF",
                                color: "#fff",
                                fontSize: 16,
                                fontWeight: 500,
                                cursor: "pointer",
                            }}
                        >
                            Thử lại
                        </button>
                    </div>
                )}

                {/* Nội dung chỉ hiển thị khi đã có profile từ API */}
                {displayProfile && (
                    <>
                        {/* Banner - click to update cover photo */}
                        <div
                            onClick={onCoverClick}
                            onMouseEnter={() => setCoverHover(true)}
                            onMouseLeave={() => setCoverHover(false)}
                            style={{
                                height: 160,
                                background: (coverPreview || displayProfile?.coverPhotoUrl)
                                    ? `url(${coverPreview || displayProfile?.coverPhotoUrl}) center/cover no-repeat`
                                    : "linear-gradient(135deg, #0068FF 0%, #00C6FF 100%)",
                                borderRadius: "0 0 0 0",
                                cursor: coverUploading ? "wait" : "pointer",
                                position: "relative",
                                transition: "filter 0.2s ease",
                            }}
                        >
                            {/* Hover overlay */}
                            <div
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    backgroundColor: coverHover ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    transition: "background-color 0.2s ease",
                                    borderRadius: "inherit",
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        color: "#fff",
                                        fontSize: 14,
                                        fontWeight: 500,
                                        opacity: coverHover ? 1 : 0,
                                        transition: "opacity 0.2s ease",
                                        pointerEvents: "none",
                                    }}
                                >
                                    {coverUploading ? (
                                        <span>Đang tải lên...</span>
                                    ) : (
                                        <>
                                            {iconCamera}
                                            <span>Cập nhật ảnh bìa</span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <input
                                ref={coverInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/gif"
                                style={{ display: "none" }}
                                onChange={onCoverFileChange}
                            />
                        </div>
                        {coverError && (
                            <div style={{ padding: "6px 28px", fontSize: 14, color: "#e53935" }}>
                                {coverError}
                            </div>
                        )}

                        {/* Avatar + Name */}
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
                                    }}
                                >
                                    {avatarUrl ? (
                                        <img
                                            src={avatarUrl}
                                            alt="Avatar"
                                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                        />
                                    ) : (
                                        <div
                                            style={{
                                                width: "100%",
                                                height: "100%",
                                                backgroundColor: "#e0e0e0",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                color: "#666",
                                                fontSize: 40,
                                                fontWeight: 600,
                                            }}
                                        >
                                            {(displayName && displayName.charAt(0).toUpperCase()) || "?"}
                                        </div>
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
                                        disabled={uploading}
                                        style={{
                                            position: "absolute",
                                            right: 0,
                                            bottom: 0,
                                            width: 40,
                                            height: 40,
                                            borderRadius: "50%",
                                            border: "3px solid #fff",
                                            backgroundColor: "#0068FF",
                                            color: "#fff",
                                            cursor: uploading ? "wait" : "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}
                                    >
                                        {iconCamera}
                                    </button>
                                </div>
                                <div style={{ flex: 1, paddingBottom: 10 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <span style={{ fontSize: 26, fontWeight: 600, color: "#333" }}>
                                            {displayName}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => router.push("/(tabs)/account-edit")}
                                            style={{
                                                border: "none",
                                                background: "none",
                                                cursor: "pointer",
                                                padding: 4,
                                                color: "#0068FF",
                                            }}
                                        >
                                            {iconPencil}
                                        </button>
                                    </div>
                                    {(avatarError || error) && (
                                        <div style={{ fontSize: 14, color: "#e53935", marginTop: 6 }}>
                                            {avatarError || error}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Thông tin kinh doanh */}
                        <div
                            style={{
                                margin: "0 28px 20px",
                                padding: 20,
                                backgroundColor: "#f5f5f5",
                                borderRadius: 14,
                            }}
                        >
                            <div style={{ fontSize: 16, color: "#666", marginBottom: 10 }}>Mô tả</div>
                            <a
                                href={displayProfile?.businessDescription || "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    fontSize: 16,
                                    color: "#0068FF",
                                    textDecoration: "none",
                                    wordBreak: "break-all",
                                }}
                            >
                                {displayProfile?.businessDescription || "Chưa cập nhật"}
                            </a>
                            <div style={{ marginTop: 16 }}>
                                <button
                                    type="button"
                                    onClick={() => router.push("/(tabs)/account-edit")}
                                    style={{
                                        padding: "10px 20px",
                                        borderRadius: 10,
                                        border: "none",
                                        backgroundColor: "#0068FF",
                                        color: "#fff",
                                        fontSize: 16,
                                        fontWeight: 500,
                                        cursor: "pointer",
                                    }}
                                >
                                    Cập nhật
                                </button>
                            </div>
                        </div>

                        {/* Thông tin cá nhân */}
                        <div
                            style={{
                                margin: "0 28px 24px",
                                padding: 20,
                                backgroundColor: "#f5f5f5",
                                borderRadius: 14,
                            }}
                        >
                            <div style={{ fontSize: 16, color: "#333", marginBottom: 14 }}>
                                <strong>Giới tính:</strong> {displayProfile?.gender || "Chưa cập nhật"}
                            </div>
                            <div style={{ fontSize: 16, color: "#333", marginBottom: 14 }}>
                                <strong>Ngày sinh:</strong> {formatDate(displayProfile?.dateOfBirth) || "Chưa cập nhật"}
                            </div>
                            <div style={{ fontSize: 16, color: "#333", marginBottom: 10 }}>
                                <strong>Điện thoại:</strong> {displayProfile?.phone || "Chưa cập nhật"}
                            </div>
                            <div style={{ fontSize: 14, color: "#666", marginBottom: 16 }}>
                                Chỉ bạn bè có lưu số của bạn trong danh bạ mới xem được số này.
                            </div>
                            <button
                                type="button"
                                onClick={() => router.push("/(tabs)/account-edit")}
                                style={{
                                    padding: "10px 20px",
                                    borderRadius: 10,
                                    border: "none",
                                    backgroundColor: "#0068FF",
                                    color: "#fff",
                                    fontSize: 16,
                                    fontWeight: 500,
                                    cursor: "pointer",
                                }}
                            >
                                Cập nhật
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
