import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    Image,
    ActivityIndicator,
    Platform,
    StatusBar,
    Alert,
    KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { friendService } from "@/shared/services/friendService";
import { groupService } from "@/shared/services/groupService";
import { useChatStore } from "@/shared/store/useChatStore";

const COLORS = {
    bg: "#1a1a1a",
    text: "#fff",
    textSecondary: "#aaa",
    border: "#262626",
    blue: "#3b82f6",
    cardBg: "#2c2c2e",
    disabled: "#555",
};

interface Friend {
    id: string;
    username: string;
    fullName: string;
    avatarUrl?: string;
}

interface CreateGroupScreenProps {
    preSelectedIds?: string[];
    onClose?: () => void;
}

export default function CreateGroupScreen({ preSelectedIds, onClose }: CreateGroupScreenProps = {}) {
    const router = useRouter();
    const navigation = useNavigation();
    const { upsertRoom } = useChatStore();

    const [groupName, setGroupName] = useState("");
    const [friends, setFriends] = useState<Friend[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>(preSelectedIds || []);
    const [searchQuery, setSearchQuery] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"recent" | "contacts">("recent");

    // Fetch friends list
    useEffect(() => {
        setLoading(true);
        friendService
            .getFriends()
            .then((data) => {
                const mapped: Friend[] = (data as any[])
                    .map((f) => ({
                        id: f.friend?.id || f.id || "",
                        username: f.friend?.username || f.username || "",
                        fullName:
                            f.friend?.displayName ||
                            f.friend?.fullName ||
                            f.displayName ||
                            f.fullName ||
                            f.friend?.username ||
                            f.username ||
                            "",
                        avatarUrl: f.friend?.avatarUrl || f.avatarUrl || undefined,
                    }))
                    .filter((f) => !!f.id);
                setFriends(mapped);
            })
            .catch((err) => {
                console.error("Error fetching friends:", err);
            })
            .finally(() => setLoading(false));
    }, []);

    // Filter friends by search query
    const filteredFriends = friends.filter((f) => {
        const q = searchQuery.toLowerCase();
        return (
            f.fullName.toLowerCase().includes(q) ||
            f.username.toLowerCase().includes(q)
        );
    });

    // Sort: contacts tab alphabetically, recent tab as-is
    const displayFriends =
        activeTab === "contacts"
            ? [...filteredFriends].sort((a, b) =>
                a.fullName.localeCompare(b.fullName, "vi")
            )
            : filteredFriends;

    const toggleSelect = useCallback((id: string) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    }, []);

    const handleCreate = async () => {
        if (groupName.trim().length < 3) {
            Alert.alert("Lỗi", "Tên nhóm phải có ít nhất 3 ký tự.");
            return;
        }
        if (selectedIds.length === 0) {
            Alert.alert("Lỗi", "Vui lòng chọn ít nhất 1 thành viên.");
            return;
        }
        setIsSubmitting(true);
        try {
            const newGroup = await groupService.createGroup(
                groupName.trim(),
                selectedIds
            );
            upsertRoom({
                id: newGroup.id,
                name: newGroup.groupName,
                type: "GROUP",
                unreadCount: 0,
                participants: newGroup.members.map((m) => ({
                    id: m.userId,
                    username: m.username,
                    fullName: m.username,
                    avatarUrl: m.avatarUrl,
                })),
                updatedAt: newGroup.createdAt,
            });
            // Navigate to the new group chat or main screen
            if (onClose) {
                onClose();
                router.replace("/(tabs)" as any);
            } else {
                router.push(
                    `/chat/${newGroup.id}?name=${encodeURIComponent(newGroup.groupName)}&type=GROUP`
                );
            }
        } catch (err: any) {
            Alert.alert(
                "Lỗi",
                err?.response?.data?.message || "Tạo nhóm thất bại, vui lòng thử lại."
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderFriendItem = ({ item }: { item: Friend }) => {
        const isSelected = selectedIds.includes(item.id);
        const avatarUri =
            item.avatarUrl ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(
                item.fullName || item.username
            )}&background=3b82f6&color=fff&bold=true`;

        return (
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => toggleSelect(item.id)}
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                }}
            >
                {/* Radio button */}
                <View
                    style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        borderWidth: 2,
                        borderColor: isSelected ? COLORS.blue : COLORS.disabled,
                        backgroundColor: isSelected ? COLORS.blue : "transparent",
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 12,
                    }}
                >
                    {isSelected && (
                        <Ionicons name="checkmark" size={14} color="#fff" />
                    )}
                </View>

                {/* Avatar */}
                <Image
                    source={{ uri: avatarUri }}
                    style={{
                        width: 46,
                        height: 46,
                        borderRadius: 23,
                        marginRight: 12,
                        backgroundColor: COLORS.cardBg,
                    }}
                />

                {/* Name & info */}
                <View style={{ flex: 1 }}>
                    <Text
                        style={{ fontSize: 15, color: COLORS.text, fontWeight: "400" }}
                        numberOfLines={1}
                    >
                        {item.fullName || item.username}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    };

    const canCreate =
        !isSubmitting &&
        selectedIds.length > 0 &&
        groupName.trim().length >= 3;

    return (
        <SafeAreaView
            style={{
                flex: 1,
                backgroundColor: COLORS.bg,
            }}
            edges={["top"]}
        >
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                {/* ── Header ── */}
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderBottomWidth: 0.5,
                        borderBottomColor: COLORS.border,
                    }}
                >
                    <TouchableOpacity
                        onPress={() => {
                            if (onClose) {
                                onClose();
                            } else if (navigation.canGoBack()) {
                                router.back();
                            } else {
                                router.replace("/(tabs)" as any);
                            }
                        }}
                        activeOpacity={0.6}
                        style={{ padding: 4, marginRight: 12 }}
                    >
                        <Ionicons name="close" size={26} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text
                            style={{
                                fontSize: 17,
                                fontWeight: "600",
                                color: COLORS.text,
                            }}
                        >
                            Nhóm mới
                        </Text>
                        <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 1 }}>
                            Đã chọn: {selectedIds.length}
                        </Text>
                    </View>
                </View>

                {/* ── Group Name Input ── */}
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderBottomWidth: 0.5,
                        borderBottomColor: COLORS.border,
                    }}
                >
                    <View
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            backgroundColor: COLORS.cardBg,
                            alignItems: "center",
                            justifyContent: "center",
                            marginRight: 12,
                        }}
                    >
                        <Ionicons name="camera-outline" size={22} color={COLORS.textSecondary} />
                    </View>
                    <TextInput
                        placeholder="Đặt tên nhóm"
                        placeholderTextColor={COLORS.textSecondary}
                        value={groupName}
                        onChangeText={setGroupName}
                        maxLength={50}
                        style={{
                            flex: 1,
                            fontSize: 15,
                            color: COLORS.text,
                            paddingVertical: 6,
                            borderBottomWidth: 1,
                            borderBottomColor: COLORS.border,
                        }}
                    />
                </View>

                {/* ── Search Bar ── */}
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderBottomWidth: 0.5,
                        borderBottomColor: COLORS.border,
                    }}
                >
                    <Ionicons
                        name="search"
                        size={18}
                        color={COLORS.textSecondary}
                        style={{ marginRight: 8 }}
                    />
                    <TextInput
                        placeholder="Tìm tên hoặc số điện thoại"
                        placeholderTextColor={COLORS.textSecondary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        style={{
                            flex: 1,
                            fontSize: 14,
                            color: COLORS.text,
                            paddingVertical: 4,
                        }}
                    />
                </View>

                {/* ── Tabs ── */}
                <View
                    style={{
                        flexDirection: "row",
                        borderBottomWidth: 0.5,
                        borderBottomColor: COLORS.border,
                    }}
                >
                    <TouchableOpacity
                        onPress={() => setActiveTab("recent")}
                        style={{
                            flex: 1,
                            alignItems: "center",
                            paddingVertical: 10,
                            borderBottomWidth: 2,
                            borderBottomColor:
                                activeTab === "recent" ? COLORS.blue : "transparent",
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 13,
                                fontWeight: "600",
                                color:
                                    activeTab === "recent" ? COLORS.blue : COLORS.textSecondary,
                            }}
                        >
                            GẦN ĐÂY
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setActiveTab("contacts")}
                        style={{
                            flex: 1,
                            alignItems: "center",
                            paddingVertical: 10,
                            borderBottomWidth: 2,
                            borderBottomColor:
                                activeTab === "contacts" ? COLORS.blue : "transparent",
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 13,
                                fontWeight: "600",
                                color:
                                    activeTab === "contacts" ? COLORS.blue : COLORS.textSecondary,
                            }}
                        >
                            DANH BẠ
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* ── Friends List ── */}
                {loading ? (
                    <View
                        style={{
                            flex: 1,
                            justifyContent: "center",
                            alignItems: "center",
                        }}
                    >
                        <ActivityIndicator size="large" color={COLORS.blue} />
                        <Text
                            style={{ color: COLORS.textSecondary, marginTop: 8, fontSize: 13 }}
                        >
                            Đang tải danh sách bạn bè...
                        </Text>
                    </View>
                ) : friends.length === 0 ? (
                    <View
                        style={{
                            flex: 1,
                            justifyContent: "center",
                            alignItems: "center",
                            paddingHorizontal: 32,
                        }}
                    >
                        <Ionicons
                            name="people-outline"
                            size={56}
                            color={COLORS.disabled}
                        />
                        <Text
                            style={{
                                color: COLORS.textSecondary,
                                fontSize: 15,
                                marginTop: 12,
                                textAlign: "center",
                            }}
                        >
                            Chưa có bạn bè
                        </Text>
                        <Text
                            style={{
                                color: COLORS.disabled,
                                fontSize: 12,
                                marginTop: 4,
                                textAlign: "center",
                            }}
                        >
                            Hãy kết bạn trước khi tạo nhóm
                        </Text>
                    </View>
                ) : displayFriends.length === 0 ? (
                    <View
                        style={{
                            flex: 1,
                            justifyContent: "center",
                            alignItems: "center",
                        }}
                    >
                        <Text style={{ color: COLORS.textSecondary, fontSize: 14 }}>
                            Không tìm thấy kết quả
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        data={displayFriends}
                        keyExtractor={(item) => item.id}
                        renderItem={renderFriendItem}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 100 }}
                    />
                )}

                {/* ── Selected chips bar ── */}
                {selectedIds.length > 0 && (
                    <View
                        style={{
                            position: "absolute",
                            bottom: 70,
                            left: 0,
                            right: 0,
                            backgroundColor: COLORS.bg,
                            borderTopWidth: 0.5,
                            borderTopColor: COLORS.border,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            flexDirection: "row",
                            flexWrap: "wrap",
                            gap: 6,
                        }}
                    >
                        {selectedIds.slice(0, 5).map((id) => {
                            const f = friends.find((x) => x.id === id);
                            if (!f) return null;
                            const avatarUri =
                                f.avatarUrl ||
                                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                    f.fullName || f.username
                                )}&background=3b82f6&color=fff&size=32`;
                            return (
                                <TouchableOpacity
                                    key={id}
                                    onPress={() => toggleSelect(id)}
                                    style={{ alignItems: "center", position: "relative" }}
                                >
                                    <Image
                                        source={{ uri: avatarUri }}
                                        style={{
                                            width: 36,
                                            height: 36,
                                            borderRadius: 18,
                                            borderWidth: 2,
                                            borderColor: COLORS.blue,
                                        }}
                                    />
                                    <View
                                        style={{
                                            position: "absolute",
                                            top: -2,
                                            right: -2,
                                            backgroundColor: COLORS.disabled,
                                            borderRadius: 8,
                                            width: 16,
                                            height: 16,
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}
                                    >
                                        <Ionicons name="close" size={10} color="#fff" />
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                        {selectedIds.length > 5 && (
                            <View
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 18,
                                    backgroundColor: COLORS.cardBg,
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <Text
                                    style={{
                                        color: COLORS.textSecondary,
                                        fontSize: 11,
                                        fontWeight: "600",
                                    }}
                                >
                                    +{selectedIds.length - 5}
                                </Text>
                            </View>
                        )}
                    </View>
                )}

                {/* ── Create Button ── */}
                <View
                    style={{
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        borderTopWidth: 0.5,
                        borderTopColor: COLORS.border,
                        backgroundColor: COLORS.bg,
                    }}
                >
                    <TouchableOpacity
                        onPress={handleCreate}
                        disabled={!canCreate}
                        activeOpacity={0.8}
                        style={{
                            backgroundColor: canCreate ? COLORS.blue : COLORS.cardBg,
                            paddingVertical: 12,
                            borderRadius: 24,
                            alignItems: "center",
                            justifyContent: "center",
                            flexDirection: "row",
                        }}
                    >
                        {isSubmitting ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <Ionicons
                                    name="arrow-forward"
                                    size={20}
                                    color={canCreate ? "#fff" : COLORS.disabled}
                                />
                                <Text
                                    style={{
                                        color: canCreate ? "#fff" : COLORS.disabled,
                                        fontSize: 15,
                                        fontWeight: "600",
                                        marginLeft: 6,
                                    }}
                                >
                                    Tạo nhóm ({selectedIds.length})
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
