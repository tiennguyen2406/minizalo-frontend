import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    Image,
    TouchableOpacity,
    ScrollView,
    StatusBar,
    Alert,
    Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { profileStyles, PROFILE_COLORS } from "./styles";
import type { UserProfile, UserProfileUpdateRequest } from "@/shared/services/types";
import type { DimensionValue } from "react-native";

const editStyles = {
    header: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        justifyContent: "space-between" as const,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: PROFILE_COLORS.border,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: "600" as const,
        color: PROFILE_COLORS.text,
    },
    saveButton: {
        padding: 8,
    },
    saveButtonText: {
        fontSize: 16,
        fontWeight: "600" as const,
        color: PROFILE_COLORS.primary,
    },
    formContent: {
        padding: 16,
        paddingBottom: 24,
    },
    avatarSection: {
        alignItems: "center" as const,
        marginBottom: 24,
    },
    avatarLarge: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: PROFILE_COLORS.card,
    },
    changeAvatar: {
        marginTop: 12,
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    changeAvatarText: {
        fontSize: 14,
        color: PROFILE_COLORS.primary,
        fontWeight: "500" as const,
    },
    field: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        color: PROFILE_COLORS.textSecondary,
        marginBottom: 8,
    },
    input: {
        backgroundColor: PROFILE_COLORS.searchBg,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 16,
        color: PROFILE_COLORS.text,
    },
    genderRow: {
        flexDirection: "row" as const,
        gap: 12,
    },
    genderOption: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: PROFILE_COLORS.border,
        alignItems: "center" as const,
        justifyContent: "center" as const,
    },
    genderOptionActive: {
        borderColor: PROFILE_COLORS.primary,
        backgroundColor: "#1d283a",
    },
    genderText: {
        fontSize: 14,
        color: PROFILE_COLORS.textSecondary,
        fontWeight: "500" as const,
    },
    genderTextActive: {
        color: PROFILE_COLORS.text,
    },
    dobDisplay: {
        backgroundColor: PROFILE_COLORS.searchBg,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        flexDirection: "row" as const,
        alignItems: "center" as const,
        justifyContent: "space-between" as const,
    },
    dobText: {
        fontSize: 16,
        color: PROFILE_COLORS.text,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.6)",
        justifyContent: "center" as const,
        alignItems: "center" as const,
    },
    modalContent: {
        width: "86%" as DimensionValue,
        borderRadius: 16,
        backgroundColor: "#18181b",
        padding: 16,
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: "600" as const,
        color: PROFILE_COLORS.text,
        marginBottom: 12,
        textAlign: "center" as const,
    },
    dobRow: {
        flexDirection: "row" as const,
        justifyContent: "space-between" as const,
        marginBottom: 16,
    },
    dobColumn: {
        flex: 1,
        alignItems: "center" as const,
    },
    dobLabel: {
        fontSize: 12,
        color: PROFILE_COLORS.textSecondary,
        marginBottom: 4,
    },
    dobValueBox: {
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 10,
        backgroundColor: PROFILE_COLORS.searchBg,
        minWidth: 64,
        alignItems: "center" as const,
    },
    dobValueText: {
        fontSize: 16,
        color: PROFILE_COLORS.text,
        fontWeight: "500" as const,
    },
    dobAdjustRow: {
        flexDirection: "row" as const,
        justifyContent: "space-between" as const,
        marginTop: 8,
        width: "100%" as DimensionValue,
    },
    dobAdjustButton: {
        flex: 1,
        paddingVertical: 6,
        marginHorizontal: 4,
        borderRadius: 999,
        backgroundColor: "#27272f",
        alignItems: "center" as const,
    },
    modalActions: {
        flexDirection: "row" as const,
        justifyContent: "flex-end" as const,
        gap: 8,
    },
    modalButton: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: PROFILE_COLORS.border,
    },
    modalButtonPrimary: {
        borderColor: PROFILE_COLORS.primary,
        backgroundColor: "#1d283a",
    },
    modalButtonText: {
        fontSize: 14,
        color: PROFILE_COLORS.textSecondary,
    },
    modalButtonTextPrimary: {
        color: PROFILE_COLORS.text,
        fontWeight: "600" as const,
    },
};

interface EditProfileScreenProps {
    user?: UserProfile | null;
    onSave?: (data: UserProfileUpdateRequest) => Promise<void>;
}

export default function EditProfileScreen({ user, onSave }: EditProfileScreenProps) {
    const router = useRouter();
    const [displayName, setDisplayName] = useState(user?.displayName ?? user?.username ?? "");
    const [statusMessage, setStatusMessage] = useState(user?.statusMessage ?? "");
    const [phone, setPhone] = useState(user?.phone ?? "");
    const [gender, setGender] = useState(user?.gender ?? "");
    const [dateOfBirth, setDateOfBirth] = useState(user?.dateOfBirth ?? "");
    const [businessDescription, setBusinessDescription] = useState(user?.businessDescription ?? "");
    const [saving, setSaving] = useState(false);
    const [dobModalVisible, setDobModalVisible] = useState(false);

    // Local state cho picker ngày sinh (ngày/tháng/năm riêng)
    const initialDate = (() => {
        if (user?.dateOfBirth) {
            const d = new Date(user.dateOfBirth);
            if (!Number.isNaN(d.getTime())) return d;
        }
        return new Date(2000, 0, 1); // 01/01/2000 mặc định
    })();
    const [dobYear, setDobYear] = useState(initialDate.getFullYear());
    const [dobMonth, setDobMonth] = useState(initialDate.getMonth() + 1);
    const [dobDay, setDobDay] = useState(initialDate.getDate());

    // Đồng bộ form khi user được tải (sau fetchProfile)
    useEffect(() => {
        if (user) {
            setDisplayName(user.displayName ?? user.username ?? "");
            setStatusMessage(user.statusMessage ?? "");
            setPhone(user.phone ?? "");
            setGender(user.gender ?? "");
            setDateOfBirth(user.dateOfBirth ?? "");
            if (user.dateOfBirth) {
                const d = new Date(user.dateOfBirth);
                if (!Number.isNaN(d.getTime())) {
                    setDobYear(d.getFullYear());
                    setDobMonth(d.getMonth() + 1);
                    setDobDay(d.getDate());
                }
            }
            setBusinessDescription(user.businessDescription ?? "");
        }
    }, [user]);

    const handleSave = async () => {
        setSaving(true);
        try {
            if (onSave) {
                await onSave({
                    displayName: displayName.trim() || undefined,
                    statusMessage: statusMessage.trim() || undefined,
                    phone: phone.trim() || undefined,
                    gender: gender.trim() || undefined,
                    dateOfBirth: dateOfBirth.trim() || undefined,
                    businessDescription: businessDescription.trim() || undefined,
                });
            }
            Alert.alert("Thành công", "Đã lưu thông tin.");
            router.navigate("/(tabs)/personal-profile" as any);
        } catch (e: unknown) {
            const msg = e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "Không thể lưu.";
            Alert.alert("Lỗi", msg);
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView style={profileStyles.container} edges={["top"]}>
            <StatusBar barStyle="light-content" backgroundColor={PROFILE_COLORS.background} />

            <View style={editStyles.header}>
                <TouchableOpacity
                    style={editStyles.backButton}
                    onPress={() => router.navigate("/(tabs)/profile-settings" as any)}
                >
                    <Text style={{ color: PROFILE_COLORS.text, fontSize: 20 }}>←</Text>
                </TouchableOpacity>
                <Text style={editStyles.headerTitle}>Chỉnh sửa thông tin</Text>
                <TouchableOpacity
                    style={editStyles.saveButton}
                    onPress={handleSave}
                    disabled={saving}
                >
                    <Text style={editStyles.saveButtonText}>
                        {saving ? "..." : "Lưu"}
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={editStyles.formContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={editStyles.avatarSection}>
                    {user?.avatarUrl ? (
                        <Image
                            source={{ uri: user.avatarUrl }}
                            style={editStyles.avatarLarge}
                        />
                    ) : (
                        <View
                            style={[
                                editStyles.avatarLarge,
                                {
                                    alignItems: "center",
                                    justifyContent: "center",
                                },
                            ]}
                        >
                            <Text
                                style={{
                                    color: PROFILE_COLORS.text,
                                    fontSize: 32,
                                    fontWeight: "600",
                                }}
                            >
                                {(displayName || "U").charAt(0).toUpperCase()}
                            </Text>
                        </View>
                    )}
                    <TouchableOpacity style={editStyles.changeAvatar}>
                        <Text style={editStyles.changeAvatarText}>Thay đổi ảnh đại diện</Text>
                    </TouchableOpacity>
                </View>

                <View style={editStyles.field}>
                    <Text style={editStyles.label}>Tên hiển thị</Text>
                    <TextInput
                        style={editStyles.input}
                        value={displayName}
                        onChangeText={setDisplayName}
                        placeholder="Nhập tên hiển thị"
                        placeholderTextColor={PROFILE_COLORS.textSecondary}
                    />
                </View>

                <View style={editStyles.field}>
                    <Text style={editStyles.label}>Trạng thái</Text>
                    <TextInput
                        style={editStyles.input}
                        value={statusMessage}
                        onChangeText={setStatusMessage}
                        placeholder="Tin nhắn trạng thái"
                        placeholderTextColor={PROFILE_COLORS.textSecondary}
                    />
                </View>

                <View style={editStyles.field}>
                    <Text style={editStyles.label}>Số điện thoại</Text>
                    <TextInput
                        style={editStyles.input}
                        value={phone}
                        onChangeText={setPhone}
                        placeholder="Số điện thoại"
                        placeholderTextColor={PROFILE_COLORS.textSecondary}
                        keyboardType="phone-pad"
                    />
                </View>

                <View style={editStyles.field}>
                    <Text style={editStyles.label}>Giới tính</Text>
                    <View style={editStyles.genderRow}>
                        {["Nam", "Nữ"].map((value) => {
                            const active = gender === value;
                            return (
                                <TouchableOpacity
                                    key={value}
                                    style={[
                                        editStyles.genderOption,
                                        active && editStyles.genderOptionActive,
                                    ]}
                                    onPress={() => setGender(value)}
                                    activeOpacity={0.8}
                                >
                                    <Text
                                        style={[
                                            editStyles.genderText,
                                            active && editStyles.genderTextActive,
                                        ]}
                                    >
                                        {value}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                <View style={editStyles.field}>
                    <Text style={editStyles.label}>Ngày sinh</Text>
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => setDobModalVisible(true)}
                        style={editStyles.dobDisplay}
                    >
                        <Text style={editStyles.dobText}>
                            {dateOfBirth || "Chọn ngày sinh"}
                        </Text>
                        <Text style={{ color: PROFILE_COLORS.textSecondary, fontSize: 12 }}>
                            Thay đổi
                        </Text>
                    </TouchableOpacity>
                </View>

                <View style={editStyles.field}>
                    <Text style={editStyles.label}>Mô tả công việc / giới thiệu</Text>
                    <TextInput
                        style={[editStyles.input, { height: 96, textAlignVertical: "top" as const }]}
                        value={businessDescription}
                        onChangeText={setBusinessDescription}
                        placeholder="Giới thiệu ngắn gọn về bạn"
                        placeholderTextColor={PROFILE_COLORS.textSecondary}
                        multiline
                        numberOfLines={4}
                    />
                </View>
            </ScrollView>

            {/* Modal chọn ngày sinh đơn giản (Ngày/Tháng/Năm) */}
            <Modal
                transparent
                visible={dobModalVisible}
                animationType="fade"
                onRequestClose={() => setDobModalVisible(false)}
            >
                <View style={editStyles.modalBackdrop}>
                    <View style={editStyles.modalContent}>
                        <Text style={editStyles.modalTitle}>Chọn ngày sinh</Text>

                        <View style={editStyles.dobRow}>
                            {/* Ngày */}
                            <View style={editStyles.dobColumn}>
                                <Text style={editStyles.dobLabel}>Ngày</Text>
                                <View style={editStyles.dobValueBox}>
                                    <Text style={editStyles.dobValueText}>
                                        {dobDay.toString().padStart(2, "0")}
                                    </Text>
                                </View>
                                <View style={editStyles.dobAdjustRow}>
                                    <TouchableOpacity
                                        style={editStyles.dobAdjustButton}
                                        onPress={() =>
                                            setDobDay((d) => (d > 1 ? d - 1 : 1))
                                        }
                                    >
                                        <Text style={editStyles.modalButtonText}>-</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={editStyles.dobAdjustButton}
                                        onPress={() =>
                                            setDobDay((d) =>
                                                d < 31 ? d + 1 : 31
                                            )
                                        }
                                    >
                                        <Text style={editStyles.modalButtonText}>+</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Tháng */}
                            <View style={editStyles.dobColumn}>
                                <Text style={editStyles.dobLabel}>Tháng</Text>
                                <View style={editStyles.dobValueBox}>
                                    <Text style={editStyles.dobValueText}>
                                        {dobMonth.toString().padStart(2, "0")}
                                    </Text>
                                </View>
                                <View style={editStyles.dobAdjustRow}>
                                    <TouchableOpacity
                                        style={editStyles.dobAdjustButton}
                                        onPress={() =>
                                            setDobMonth((m) => (m > 1 ? m - 1 : 1))
                                        }
                                    >
                                        <Text style={editStyles.modalButtonText}>-</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={editStyles.dobAdjustButton}
                                        onPress={() =>
                                            setDobMonth((m) =>
                                                m < 12 ? m + 1 : 12
                                            )
                                        }
                                    >
                                        <Text style={editStyles.modalButtonText}>+</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Năm */}
                            <View style={editStyles.dobColumn}>
                                <Text style={editStyles.dobLabel}>Năm</Text>
                                <View style={editStyles.dobValueBox}>
                                    <Text style={editStyles.dobValueText}>
                                        {dobYear}
                                    </Text>
                                </View>
                                <View style={editStyles.dobAdjustRow}>
                                    <TouchableOpacity
                                        style={editStyles.dobAdjustButton}
                                        onPress={() =>
                                            setDobYear((y) => Math.max(1900, y - 1))
                                        }
                                    >
                                        <Text style={editStyles.modalButtonText}>-</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={editStyles.dobAdjustButton}
                                        onPress={() =>
                                            setDobYear((y) =>
                                                Math.min(new Date().getFullYear(), y + 1)
                                            )
                                        }
                                    >
                                        <Text style={editStyles.modalButtonText}>+</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>

                        <View style={editStyles.modalActions}>
                            <TouchableOpacity
                                style={editStyles.modalButton}
                                onPress={() => setDobModalVisible(false)}
                            >
                                <Text style={editStyles.modalButtonText}>Hủy</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    editStyles.modalButton,
                                    editStyles.modalButtonPrimary,
                                ]}
                                onPress={() => {
                                    const mm = dobMonth.toString().padStart(2, "0");
                                    const dd = dobDay.toString().padStart(2, "0");
                                    const iso = `${dobYear}-${mm}-${dd}`;
                                    setDateOfBirth(iso);
                                    setDobModalVisible(false);
                                }}
                            >
                                <Text
                                    style={[
                                        editStyles.modalButtonText,
                                        editStyles.modalButtonTextPrimary,
                                    ]}
                                >
                                    Lưu
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
