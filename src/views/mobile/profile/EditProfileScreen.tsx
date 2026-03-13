import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    Image,
    TouchableOpacity,
    ScrollView,
    Platform,
    Alert,
    Modal,
    StyleSheet,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { profileStyles } from "./styles";
import type { UserProfile, UserProfileUpdateRequest } from "@/shared/services/types";
import type { DimensionValue } from "react-native";
import { useThemeColors, ThemeColors } from "@/shared/theme/colors";

const createEditStyles = (colors: ThemeColors) => StyleSheet.create({
    header: {
        height: 52,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.headerBg,
    },
    backButton: {
        paddingVertical: 8,
        paddingRight: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: colors.headerText,
    },
    saveButton: {
        padding: 8,
    },
    saveButtonText: {
        fontSize: 16,
        fontWeight: "600",
        color: colors.headerText,
    },
    formContent: {
        padding: 16,
        paddingBottom: 24,
    },
    avatarSection: {
        alignItems: "center",
        marginBottom: 24,
    },
    avatarLarge: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: colors.card,
    },
    changeAvatar: {
        marginTop: 12,
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    changeAvatarText: {
        fontSize: 14,
        color: colors.primary,
        fontWeight: "500",
    },
    field: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: 8,
    },
    input: {
        backgroundColor: colors.searchBg,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 16,
        color: colors.text,
    },
    genderRow: {
        flexDirection: "row",
        gap: 12,
    },
    genderOption: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
    },
    genderOptionActive: {
        borderColor: "#0068FF", // primary
    },
    genderText: {
        fontSize: 14,
        color: colors.textSecondary,
        fontWeight: "500",
    },
    genderTextActive: {
        color: colors.primary,
    },
    dobDisplay: {
        backgroundColor: colors.searchBg,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    dobText: {
        fontSize: 16,
        color: colors.text,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.6)",
        justifyContent: "center",
        alignItems: "center",
    },
    modalContent: {
        width: "86%" as DimensionValue,
        borderRadius: 16,
        backgroundColor: colors.card,
        padding: 16,
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: colors.text,
        marginBottom: 12,
        textAlign: "center",
    },
    dobRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 16,
    },
    dobColumn: {
        flex: 1,
        alignItems: "center",
    },
    dobLabel: {
        fontSize: 12,
        color: colors.textSecondary,
        marginBottom: 4,
    },
    dobValueBox: {
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 10,
        backgroundColor: colors.searchBg,
        minWidth: 64,
        alignItems: "center",
    },
    dobValueText: {
        fontSize: 16,
        color: colors.text,
        fontWeight: "500",
    },
    dobAdjustRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 8,
        width: "100%" as DimensionValue,
    },
    dobAdjustButton: {
        flex: 1,
        paddingVertical: 6,
        marginHorizontal: 4,
        borderRadius: 999,
        backgroundColor: colors.background === "#ffffff" ? "#f3f4f6" : "#27272f",
        alignItems: "center",
    },
    modalActions: {
        flexDirection: "row",
        justifyContent: "flex-end",
        gap: 8,
    },
    modalButton: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.border,
    },
    modalButtonPrimary: {
        borderColor: colors.primary,
        backgroundColor: colors.primary,
    },
    modalButtonText: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    modalButtonTextPrimary: {
        color: "#fff",
        fontWeight: "600",
    },
});

interface EditProfileScreenProps {
    user?: UserProfile | null;
    onSave?: (data: UserProfileUpdateRequest) => Promise<void>;
}

export default function EditProfileScreen({ user, onSave }: EditProfileScreenProps) {
    const router = useRouter();
    const colors = useThemeColors();
    const editStyles = createEditStyles(colors);

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
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <StatusBar style={colors.statusBar} />
            <SafeAreaView style={{ backgroundColor: colors.headerBg }} edges={["top"]}>
                <View style={editStyles.header}>
                    <TouchableOpacity
                        style={editStyles.backButton}
                        onPress={() => router.back()}
                        activeOpacity={0.7}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="chevron-back" size={26} color={colors.headerText} />
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
            </SafeAreaView>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={editStyles.formContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={editStyles.avatarSection}>
                    {user?.avatarUrl ? (
                        <Image
                            source={{ uri: user.avatarUrl as string }}
                            style={editStyles.avatarLarge}
                        />
                    ) : (
                        <View
                            style={[
                                editStyles.avatarLarge,
                                {
                                    alignItems: "center",
                                    justifyContent: "center",
                                    backgroundColor: colors.avatarBg,
                                },
                            ]}
                        >
                            <Text
                                style={{
                                    color: colors.text,
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
                        placeholderTextColor={colors.textSecondary}
                    />
                </View>

                <View style={editStyles.field}>
                    <Text style={editStyles.label}>Trạng thái</Text>
                    <TextInput
                        style={editStyles.input}
                        value={statusMessage}
                        onChangeText={setStatusMessage}
                        placeholder="Tin nhắn trạng thái"
                        placeholderTextColor={colors.textSecondary}
                    />
                </View>

                <View style={editStyles.field}>
                    <Text style={editStyles.label}>Số điện thoại</Text>
                    <TextInput
                        style={editStyles.input}
                        value={phone}
                        onChangeText={setPhone}
                        placeholder="Số điện thoại"
                        placeholderTextColor={colors.textSecondary}
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
                                        active && {
                                            backgroundColor: colors.background === "#000000" ? "#1d283a" : "#eef2ff"
                                        }
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
                        <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "500" }}>
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
                        placeholderTextColor={colors.textSecondary}
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
                                        <Text style={{ color: colors.text, fontSize: 18 }}>-</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={editStyles.dobAdjustButton}
                                        onPress={() =>
                                            setDobDay((d) =>
                                                d < 31 ? d + 1 : 31
                                            )
                                        }
                                    >
                                        <Text style={{ color: colors.text, fontSize: 18 }}>+</Text>
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
                                        <Text style={{ color: colors.text, fontSize: 18 }}>-</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={editStyles.dobAdjustButton}
                                        onPress={() =>
                                            setDobMonth((m) =>
                                                m < 12 ? m + 1 : 12
                                            )
                                        }
                                    >
                                        <Text style={{ color: colors.text, fontSize: 18 }}>+</Text>
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
                                        <Text style={{ color: colors.text, fontSize: 18 }}>-</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={editStyles.dobAdjustButton}
                                        onPress={() =>
                                            setDobYear((y) =>
                                                Math.min(new Date().getFullYear(), y + 1)
                                            )
                                        }
                                    >
                                        <Text style={{ color: colors.text, fontSize: 18 }}>+</Text>
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
        </View>
    );
}
