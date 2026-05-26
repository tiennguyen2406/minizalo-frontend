import React, { useState, useEffect, useMemo } from "react";
import {
    View,
    Text,
    TextInput,
    Image,
    TouchableOpacity,
    Pressable,
    ScrollView,
    Alert,
    Modal,
    StyleSheet,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Dimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { SafeView as SafeAreaView } from "@/shared/components/SafeView";
import { Ionicons } from "@expo/vector-icons";
import type { UserProfile, UserProfileUpdateRequest } from "@/shared/services/types";
import { useThemeColors, ThemeColors } from "@/shared/theme/colors";

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        height: 52,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 16,
        backgroundColor: colors.headerBg,
    },
    backButton: {
        position: "absolute",
        left: 16,
        paddingVertical: 8,
        paddingRight: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: colors.headerText,
    },
    avatarSection: {
        alignItems: "center",
        paddingVertical: 24,
        backgroundColor: colors.card,
    },
    avatarLarge: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: colors.searchBg,
    },
    infoCard: {
        backgroundColor: colors.card,
        marginTop: 8,
        paddingHorizontal: 20,
    },
    infoRow: {
        paddingVertical: 16,
        borderBottomWidth: 0.5,
        borderBottomColor: colors.border,
    },
    infoRowLast: {
        borderBottomWidth: 0,
    },
    infoLabel: {
        fontSize: 13,
        color: colors.textSecondary,
        marginBottom: 4,
    },
    infoValue: {
        fontSize: 16,
        color: colors.text,
        fontWeight: "400",
    },
    infoValuePlaceholder: {
        fontSize: 16,
        color: colors.iconColor,
        fontStyle: "italic",
    },
    editButtonContainer: {
        paddingHorizontal: 20,
        paddingVertical: 24,
    },
    editButton: {
        backgroundColor: colors.primary,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
    },
    editButtonText: {
        color: "#ffffff",
        fontSize: 16,
        fontWeight: "600",
        marginLeft: 8,
    },

    // Modal styles
    modalHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.border,
        alignSelf: "center",
        marginBottom: 16,
    },
    modalHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 24,
        paddingHorizontal: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: colors.text,
    },
    modalCloseButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.searchBg,
        alignItems: "center",
        justifyContent: "center",
    },
    modalField: {
        marginBottom: 20,
    },
    modalLabel: {
        fontSize: 13,
        color: colors.textSecondary,
        marginBottom: 8,
        fontWeight: "500",
    },
    modalInput: {
        backgroundColor: colors.searchBg,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        color: colors.text,
        borderWidth: 1,
        borderColor: colors.border,
    },
    modalInputFocused: {
        borderColor: colors.primary,
    },
    genderRow: {
        flexDirection: "row",
        gap: 12,
    },
    genderOption: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: colors.border,
        backgroundColor: colors.searchBg,
        alignItems: "center",
        justifyContent: "center",
    },
    genderOptionActive: {
        borderColor: colors.primary,
    },
    genderText: {
        fontSize: 15,
        color: colors.textSecondary,
        fontWeight: "500",
    },
    genderTextActive: {
        color: colors.primary,
        fontWeight: "600",
    },
    dobDisplay: {
        backgroundColor: colors.searchBg,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderWidth: 1,
        borderColor: colors.border,
    },
    dobText: {
        fontSize: 16,
        color: colors.text,
    },
    modalSaveButton: {
        backgroundColor: colors.primary,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: "center",
        marginTop: 8,
    },
    modalSaveText: {
        color: "#ffffff",
        fontSize: 16,
        fontWeight: "600",
    },
});

/* ─── Calendar Picker (pure RN, no native modules) ─── */

const DAYS_VI = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const MONTHS_VI = [
    "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
    "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12",
];

interface CalendarPickerModalProps {
    visible: boolean;
    initialDate: Date;
    onConfirm: (date: Date) => void;
    onCancel: () => void;
    themeColors: ThemeColors;
}

function CalendarPickerModal(props: CalendarPickerModalProps) {
    const { visible, initialDate, onConfirm, onCancel, themeColors: colors } = props;
    const [viewYear, setViewYear] = useState(initialDate.getFullYear());
    const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
    const [selectedDay, setSelectedDay] = useState(initialDate.getDate());
    const [showYearPicker, setShowYearPicker] = useState(false);

    useEffect(() => {
        if (visible) {
            setViewYear(initialDate.getFullYear());
            setViewMonth(initialDate.getMonth());
            setSelectedDay(initialDate.getDate());
            setShowYearPicker(false);
        }
    }, [visible]);

    const today = new Date();
    const cellSize = Math.floor((Dimensions.get("window").width - 80) / 7);

    const calendarDays = useMemo(() => {
        const firstDay = new Date(viewYear, viewMonth, 1).getDay();
        const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
        const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

        const cells: { day: number; inMonth: boolean; disabled: boolean }[] = [];

        for (let i = firstDay - 1; i >= 0; i--) {
            cells.push({ day: daysInPrevMonth - i, inMonth: false, disabled: true });
        }
        for (let d = 1; d <= daysInMonth; d++) {
            const isFuture =
                viewYear > today.getFullYear() ||
                (viewYear === today.getFullYear() && viewMonth > today.getMonth()) ||
                (viewYear === today.getFullYear() && viewMonth === today.getMonth() && d > today.getDate());
            cells.push({ day: d, inMonth: true, disabled: isFuture });
        }
        const remaining = 7 - (cells.length % 7);
        if (remaining < 7) {
            for (let i = 1; i <= remaining; i++) {
                cells.push({ day: i, inMonth: false, disabled: true });
            }
        }
        return cells;
    }, [viewYear, viewMonth]);

    const goPrevMonth = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
        else setViewMonth((m) => m - 1);
    };
    const goNextMonth = () => {
        if (viewYear > today.getFullYear() || (viewYear === today.getFullYear() && viewMonth >= today.getMonth())) return;
        if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
        else setViewMonth((m) => m + 1);
    };

    const years = useMemo(() => {
        const result: number[] = [];
        for (let y = today.getFullYear(); y >= 1900; y--) result.push(y);
        return result;
    }, []);

    if (!visible) return null;

    return (
        <Modal transparent visible animationType="fade" onRequestClose={onCancel}>
            <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" }} onPress={onCancel}>
                <Pressable
                    style={{ backgroundColor: colors.card, borderRadius: 16, width: Dimensions.get("window").width - 40, maxHeight: "80%", overflow: "hidden" }}
                    onPress={() => {}}
                >
                    {/* Header */}
                    <View style={{ backgroundColor: colors.primary, paddingVertical: 16, paddingHorizontal: 20, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
                        <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>Chọn ngày sinh</Text>
                        <Text style={{ color: "#fff", fontSize: 22, fontWeight: "700", marginTop: 4 }}>
                            {selectedDay.toString().padStart(2, "0")}/{(viewMonth + 1).toString().padStart(2, "0")}/{viewYear}
                        </Text>
                    </View>

                    {!showYearPicker ? (
                        <View style={{ padding: 16 }}>
                            {/* Month/Year nav */}
                            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                                <Pressable onPress={goPrevMonth} style={{ padding: 8 }}>
                                    <Ionicons name="chevron-back" size={22} color={colors.text} />
                                </Pressable>
                                <Pressable onPress={() => setShowYearPicker(true)} style={{ flexDirection: "row", alignItems: "center" }}>
                                    <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text }}>
                                        {MONTHS_VI[viewMonth]} {viewYear}
                                    </Text>
                                    <Ionicons name="caret-down" size={14} color={colors.iconColor} style={{ marginLeft: 4 }} />
                                </Pressable>
                                <Pressable onPress={goNextMonth} style={{ padding: 8 }}>
                                    <Ionicons name="chevron-forward" size={22} color={colors.text} />
                                </Pressable>
                            </View>

                            {/* Day headers */}
                            <View style={{ flexDirection: "row" }}>
                                {DAYS_VI.map((d) => (
                                    <View key={d} style={{ width: cellSize, alignItems: "center", paddingVertical: 4 }}>
                                        <Text style={{ fontSize: 12, color: colors.textSecondary, fontWeight: "600" }}>{d}</Text>
                                    </View>
                                ))}
                            </View>

                            {/* Day grid */}
                            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                                {calendarDays.map((cell, i) => {
                                    const isSelected = cell.inMonth && cell.day === selectedDay;
                                    const isToday = cell.inMonth && cell.day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
                                    return (
                                        <Pressable
                                            key={i}
                                            disabled={cell.disabled}
                                            onPress={() => cell.inMonth && setSelectedDay(cell.day)}
                                            style={{
                                                width: cellSize,
                                                height: cellSize,
                                                alignItems: "center",
                                                justifyContent: "center",
                                            }}
                                        >
                                            <View style={{
                                                width: 36,
                                                height: 36,
                                                borderRadius: 18,
                                                alignItems: "center",
                                                justifyContent: "center",
                                                backgroundColor: isSelected ? colors.primary : "transparent",
                                                borderWidth: isToday && !isSelected ? 1.5 : 0,
                                                borderColor: colors.primary,
                                            }}>
                                                <Text style={{
                                                    fontSize: 15,
                                                    fontWeight: isSelected || isToday ? "700" : "400",
                                                    color: isSelected ? "#fff" : cell.inMonth ? (cell.disabled ? colors.textSecondary : colors.text) : colors.textSecondary,
                                                }}>
                                                    {cell.day}
                                                </Text>
                                            </View>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </View>
                    ) : (
                        /* Year picker */
                        <ScrollView style={{ maxHeight: 300, padding: 16 }}>
                            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center" }}>
                                {years.map((y) => (
                                    <Pressable
                                        key={y}
                                        onPress={() => { setViewYear(y); setShowYearPicker(false); }}
                                        style={{
                                            paddingVertical: 10,
                                            paddingHorizontal: 16,
                                            margin: 4,
                                            borderRadius: 999,
                                            backgroundColor: y === viewYear ? colors.primary : "transparent",
                                        }}
                                    >
                                        <Text style={{
                                            fontSize: 15,
                                            fontWeight: y === viewYear ? "700" : "400",
                                            color: y === viewYear ? "#fff" : colors.text,
                                        }}>
                                            {y}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        </ScrollView>
                    )}

                    {/* Actions */}
                    <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 16, paddingBottom: 16, paddingTop: 4, gap: 12 }}>
                        <Pressable onPress={onCancel} style={{ paddingVertical: 10, paddingHorizontal: 20 }}>
                            <Text style={{ color: colors.textSecondary, fontSize: 15, fontWeight: "600" }}>Hủy</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => onConfirm(new Date(viewYear, viewMonth, selectedDay))}
                            style={{ backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 24 }}
                        >
                            <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}>Xác nhận</Text>
                        </Pressable>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

interface EditProfileScreenProps {
    user?: UserProfile | null;
    onSave?: (data: UserProfileUpdateRequest) => Promise<void>;
}

export default function EditProfileScreen({ user, onSave }: EditProfileScreenProps) {
    const router = useRouter();
    const colors = useThemeColors();
    const s = createStyles(colors);

    const [editModalVisible, setEditModalVisible] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [saving, setSaving] = useState(false);

    const [editName, setEditName] = useState(user?.displayName ?? user?.username ?? "");
    const [editGender, setEditGender] = useState(user?.gender ?? "");
    const [editDob, setEditDob] = useState(user?.dateOfBirth ?? "");
    const [pickerDate, setPickerDate] = useState<Date>(() => {
        if (user?.dateOfBirth) {
            const d = new Date(user.dateOfBirth);
            if (!Number.isNaN(d.getTime())) return d;
        }
        return new Date(2000, 0, 1);
    });

    useEffect(() => {
        if (user) {
            setEditName(user.displayName ?? user.username ?? "");
            setEditGender(user.gender ?? "");
            setEditDob(user.dateOfBirth ?? "");
            if (user.dateOfBirth) {
                const d = new Date(user.dateOfBirth);
                if (!Number.isNaN(d.getTime())) setPickerDate(d);
            }
        }
    }, [user]);

    const openEditModal = () => {
        setEditName(user?.displayName ?? user?.username ?? "");
        setEditGender(user?.gender ?? "");
        setEditDob(user?.dateOfBirth ?? "");
        if (user?.dateOfBirth) {
            const d = new Date(user.dateOfBirth);
            if (!Number.isNaN(d.getTime())) setPickerDate(d);
        }
        setShowDatePicker(false);
        setEditModalVisible(true);
    };

    const handleSave = async () => {
        if (!editName.trim()) {
            Alert.alert("Lỗi", "Tên hiển thị không được để trống.");
            return;
        }
        setSaving(true);
        try {
            if (onSave) {
                await onSave({
                    displayName: editName.trim(),
                    gender: editGender || undefined,
                    dateOfBirth: editDob || undefined,
                });
            }
            setEditModalVisible(false);
            Alert.alert("Thành công", "Đã cập nhật thông tin.");
        } catch (e: unknown) {
            const msg = e && typeof e === "object" && "message" in e
                ? String((e as { message: unknown }).message)
                : "Không thể lưu.";
            Alert.alert("Lỗi", msg);
        } finally {
            setSaving(false);
        }
    };

    const displayName = user?.displayName ?? user?.username ?? "";
    const phone = user?.phone ?? "";
    const gender = user?.gender ?? "";
    const dateOfBirth = user?.dateOfBirth ?? "";
    const statusMessage = user?.statusMessage ?? "";
    const businessDescription = user?.businessDescription ?? "";

    const formatDob = (dob: string) => {
        if (!dob) return "";
        const d = new Date(dob);
        if (Number.isNaN(d.getTime())) return dob;
        return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;
    };

    return (
        <View style={s.container}>
            <StatusBar style="light" />
            <SafeAreaView style={{ backgroundColor: colors.headerBg }} edges={["top"]}>
                <View style={s.header}>
                    <TouchableOpacity
                        style={s.backButton}
                        onPress={() => router.back()}
                        activeOpacity={0.7}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="chevron-back" size={26} color={colors.headerText} />
                    </TouchableOpacity>
                    <Text style={s.headerTitle}>Thông tin cá nhân</Text>
                </View>
            </SafeAreaView>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 24 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Avatar */}
                <View style={s.avatarSection}>
                    {user?.avatarUrl ? (
                        <Image
                            source={{ uri: user.avatarUrl as string }}
                            style={s.avatarLarge}
                        />
                    ) : (
                        <View
                            style={[
                                s.avatarLarge,
                                {
                                    alignItems: "center",
                                    justifyContent: "center",
                                    backgroundColor: colors.primary,
                                },
                            ]}
                        >
                            <Text style={{ color: "#ffffff", fontSize: 36, fontWeight: "700" }}>
                                {(displayName || "U").charAt(0).toUpperCase()}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Info Card */}
                <View style={s.infoCard}>
                    <View style={s.infoRow}>
                        <Text style={s.infoLabel}>Tên hiển thị</Text>
                        <Text style={s.infoValue}>{displayName || "Chưa cập nhật"}</Text>
                    </View>

                    <View style={s.infoRow}>
                        <Text style={s.infoLabel}>Giới tính</Text>
                        <Text style={gender ? s.infoValue : s.infoValuePlaceholder}>
                            {gender || "Chưa cập nhật"}
                        </Text>
                    </View>

                    <View style={s.infoRow}>
                        <Text style={s.infoLabel}>Ngày sinh</Text>
                        <Text style={dateOfBirth ? s.infoValue : s.infoValuePlaceholder}>
                            {dateOfBirth ? formatDob(dateOfBirth) : "Chưa cập nhật"}
                        </Text>
                    </View>

                    <View style={s.infoRow}>
                        <Text style={s.infoLabel}>Số điện thoại</Text>
                        <Text style={phone ? s.infoValue : s.infoValuePlaceholder}>
                            {phone || "Chưa cập nhật"}
                        </Text>
                    </View>

                    {statusMessage ? (
                        <View style={s.infoRow}>
                            <Text style={s.infoLabel}>Trạng thái</Text>
                            <Text style={s.infoValue}>{statusMessage}</Text>
                        </View>
                    ) : null}

                    <View style={[s.infoRow, s.infoRowLast]}>
                        <Text style={s.infoLabel}>Giới thiệu</Text>
                        <Text style={businessDescription ? s.infoValue : s.infoValuePlaceholder}>
                            {businessDescription || "Chưa cập nhật"}
                        </Text>
                    </View>
                </View>

                {/* Edit Button */}
                <View style={s.editButtonContainer}>
                    <TouchableOpacity
                        style={s.editButton}
                        activeOpacity={0.8}
                        onPress={openEditModal}
                    >
                        <Ionicons name="create-outline" size={20} color="#ffffff" />
                        <Text style={s.editButtonText}>Chỉnh sửa</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* ─── Edit Modal ─── */}
            <Modal
                transparent
                visible={editModalVisible}
                animationType="slide"
                onRequestClose={() => { Keyboard.dismiss(); setEditModalVisible(false); }}
            >
                <Pressable
                    style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.3)" }}
                    onPress={() => { Keyboard.dismiss(); setEditModalVisible(false); }}
                />
                <KeyboardAvoidingView
                    style={{
                        backgroundColor: colors.card,
                        borderTopLeftRadius: 20,
                        borderTopRightRadius: 20,
                        paddingBottom: Platform.OS === "ios" ? 34 : 24,
                    }}
                    behavior={Platform.OS === "ios" ? "padding" : undefined}
                >
                    {/* Handle bar */}
                    <View style={{ alignItems: "center", paddingTop: 10, paddingBottom: 4 }}>
                        <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
                    </View>

                    <View style={[s.modalHeader, { paddingTop: 8 }]}>
                        <Text style={s.modalTitle}>Chỉnh sửa thông tin</Text>
                        <Pressable
                            style={s.modalCloseButton}
                            onPress={() => { Keyboard.dismiss(); setEditModalVisible(false); }}
                        >
                            <Ionicons name="close" size={18} color={colors.textSecondary} />
                        </Pressable>
                    </View>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Tên hiển thị */}
                        <View style={s.modalField}>
                            <Text style={s.modalLabel}>Tên hiển thị</Text>
                            <TextInput
                                style={s.modalInput}
                                value={editName}
                                onChangeText={setEditName}
                                placeholder="Nhập tên hiển thị"
                                placeholderTextColor="#c7c7cc"
                                returnKeyType="done"
                                onSubmitEditing={Keyboard.dismiss}
                                blurOnSubmit
                            />
                        </View>

                        {/* Giới tính */}
                        <View style={s.modalField}>
                            <Text style={s.modalLabel}>Giới tính</Text>
                            <View style={s.genderRow}>
                                {["Nam", "Nữ"].map((value) => {
                                    const active = editGender === value;
                                    return (
                                        <Pressable
                                            key={value}
                                            style={[s.genderOption, active && s.genderOptionActive]}
                                            onPress={() => { Keyboard.dismiss(); setEditGender(value); }}
                                        >
                                            <Text style={[s.genderText, active && s.genderTextActive]}>
                                                {value}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </View>

                        {/* Ngày sinh */}
                        <View style={s.modalField}>
                            <Text style={s.modalLabel}>Ngày sinh</Text>
                            <Pressable
                                onPress={() => {
                                    Keyboard.dismiss();
                                    setEditModalVisible(false);
                                    setTimeout(() => setShowDatePicker(true), 350);
                                }}
                                style={s.dobDisplay}
                            >
                                <Text style={s.dobText}>
                                    {editDob ? formatDob(editDob) : "Chọn ngày sinh"}
                                </Text>
                                <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                            </Pressable>
                        </View>

                        {/* Save */}
                        <Pressable
                            style={[s.modalSaveButton, saving && { opacity: 0.6 }]}
                            onPress={() => { Keyboard.dismiss(); handleSave(); }}
                            disabled={saving}
                        >
                            <Text style={s.modalSaveText}>
                                {saving ? "Đang lưu..." : "Lưu thay đổi"}
                            </Text>
                        </Pressable>
                    </ScrollView>
                </KeyboardAvoidingView>
            </Modal>

            {/* ─── Calendar Date Picker Modal ─── */}
            <CalendarPickerModal
                visible={showDatePicker}
                initialDate={pickerDate}
                themeColors={colors}
                onConfirm={(date) => {
                    setPickerDate(date);
                    const yyyy = date.getFullYear();
                    const mm = (date.getMonth() + 1).toString().padStart(2, "0");
                    const dd = date.getDate().toString().padStart(2, "0");
                    setEditDob(`${yyyy}-${mm}-${dd}`);
                    setShowDatePicker(false);
                    setTimeout(() => setEditModalVisible(true), 300);
                }}
                onCancel={() => {
                    setShowDatePicker(false);
                    setTimeout(() => setEditModalVisible(true), 300);
                }}
            />
        </View>
    );
}
