import React, { useCallback, useState } from "react";
import { View, Text, TouchableOpacity, TextInput, Alert, Modal, ScrollView } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeView as SafeAreaView } from "@/shared/components/SafeView";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useFriendStore } from "@/shared/store/friendStore";
import { useUserStore } from "@/shared/store/userStore";
import { searchService } from "@/shared/services/searchService";
import type { UserProfile } from "@/shared/services/types";
import { useThemeColors } from "@/shared/theme/colors";

export default function AddFriendMobileScreen() {
    const router = useRouter();
    const [phone, setPhone] = useState("");
    const [selectedCountryCode, setSelectedCountryCode] = useState("+84");
    const [countryPickerVisible, setCountryPickerVisible] = useState(false);
    const [searching, setSearching] = useState(false);
    const [resultUser, setResultUser] = useState<UserProfile | null>(null);
    const { sendRequest, friends, sentRequests } = useFriendStore();
    const { profile } = useUserStore();
    const colors = useThemeColors();

    const currentUserId = profile?.id ?? null;

    const friendIdSet = React.useMemo(() => {
        const set = new Set<string>();
        if (!currentUserId) return set;
        friends.forEach((f) => {
            if (f.user.id === currentUserId) {
                set.add(f.friend.id);
            } else if (f.friend.id === currentUserId) {
                set.add(f.user.id);
            }
        });
        return set;
    }, [friends, currentUserId]);

    const pendingRequestIdSet = React.useMemo(() => {
        const set = new Set<string>();
        if (!currentUserId) return set;
        sentRequests.forEach((fr) => {
            if (fr.user.id === currentUserId) {
                set.add(fr.friend.id);
            }
        });
        return set;
    }, [sentRequests, currentUserId]);

    // Mỗi lần màn Thêm bạn được focus, reset kết quả cũ
    useFocusEffect(
        useCallback(() => {
            setPhone("");
            setResultUser(null);
        }, [])
    );

    const handleSearchByPhone = async () => {
        const raw = phone.replace(/\s+/g, "");
        if (!raw) {
            Alert.alert("Thông báo", "Vui lòng nhập số điện thoại.");
            return;
        }
        if (!/^\d+$/.test(raw)) {
            Alert.alert("Thông báo", "Số điện thoại chỉ được chứa chữ số.");
            return;
        }

        setSearching(true);
        setResultUser(null);
        try {
            // Thử tìm theo nhiều dạng: số thuần, số có mã quốc gia
            const queries = [raw, `${selectedCountryCode}${raw}`];
            const allUsersMap = new Map<string, UserProfile>();

            // Gọi tuần tự để tránh áp lực backend (dữ liệu nhỏ)
            // eslint-disable-next-line no-restricted-syntax
            for (const q of queries) {
                // eslint-disable-next-line no-await-in-loop
                const users = await searchService.searchUsers(q);
                users.forEach((u) => {
                    if (!allUsersMap.has(u.id)) {
                        allUsersMap.set(u.id, u);
                    }
                });
            }

            const allUsers = Array.from(allUsersMap.values());

            const normalize = (s: string) => s.replace(/[^\d]/g, "");

            let found =
                allUsers.find((u) => u.phone && normalize(u.phone) === raw) ||
                allUsers.find((u) => u.phone && normalize(u.phone).endsWith(raw)) ||
                allUsers[0];

            if (!found) {
                Alert.alert("Không tìm thấy", "Không tìm được tài khoản với số điện thoại này.");
                return;
            }
            setResultUser(found);
        } catch {
            Alert.alert("Lỗi", "Không tìm kiếm được người dùng. Vui lòng thử lại.");
        } finally {
            setSearching(false);
        }
    };

    const handleSendRequest = async (userId: string) => {
        if (currentUserId && userId === currentUserId) {
            Alert.alert("Thông báo", "Bạn không thể kết bạn với chính mình.");
            return;
        }
        if (friendIdSet.has(userId)) {
            Alert.alert("Thông báo", "Bạn và người này đã là bạn bè.");
            return;
        }
        if (pendingRequestIdSet.has(userId)) {
            Alert.alert("Thông báo", "Bạn đã gửi lời mời kết bạn cho người này.");
            return;
        }
        try {
            await sendRequest(userId);
            Alert.alert("Thành công", "Đã gửi lời mời kết bạn.", [
                {
                    text: "OK",
                    onPress: () => router.replace("/(tabs)"),
                },
            ]);
        } catch {
            Alert.alert("Lỗi", "Gửi lời mời kết bạn thất bại.");
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <StatusBar style={colors.statusBar} />
            <SafeAreaView
                style={{ backgroundColor: colors.headerBg }}
                edges={["top"]}
            >
                {/* Header Thêm bạn */}
                <View
                    style={{
                        height: 52,
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 16,
                        borderBottomWidth: colors.headerBg.startsWith("#0") ? 0 : 0.5,
                        borderBottomColor: colors.border,
                        backgroundColor: colors.headerBg,
                    }}
                >
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={{ padding: 4, marginRight: 8 }}
                        activeOpacity={0.8}
                    >
                        <Ionicons
                            name="chevron-back"
                            size={22}
                            color={colors.headerText}
                        />
                    </TouchableOpacity>
                    <Text
                        style={{
                            color: colors.headerText,
                            fontSize: 18,
                            fontWeight: "600",
                        }}
                    >
                        Thêm bạn
                    </Text>
                </View>
            </SafeAreaView>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Nội dung: chỉ cho tìm bằng số điện thoại */}
                <View
                    style={{
                        paddingHorizontal: 16,
                        paddingTop: 12,
                    }}
                >
                {/* Hàng chọn mã quốc gia + nhập SĐT */}
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        marginBottom: 12,
                    }}
                >
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => setCountryPickerVisible(true)}
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingHorizontal: 10,
                            paddingVertical: 8,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: colors.border,
                            marginRight: 8,
                        }}
                    >
                        <Text
                            style={{
                                color: colors.text,
                                fontSize: 14,
                                marginRight: 4,
                            }}
                        >
                            {selectedCountryCode}
                        </Text>
                        <Ionicons
                            name="chevron-down"
                            size={16}
                            color={colors.textSecondary}
                        />
                    </TouchableOpacity>

                    <View
                        style={{
                            flex: 1,
                            flexDirection: "row",
                            alignItems: "center",
                            borderRadius: 999,
                            backgroundColor: colors.searchBg,
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                        }}
                    >
                        <TextInput
                            value={phone}
                            onChangeText={setPhone}
                            keyboardType="phone-pad"
                            placeholder="Nhập số điện thoại"
                            placeholderTextColor={colors.textSecondary}
                            style={{
                                flex: 1,
                                color: colors.text,
                                fontSize: 14,
                                paddingVertical: 0,
                            }}
                            returnKeyType="search"
                            onSubmitEditing={handleSearchByPhone}
                        />
                    </View>
                    <TouchableOpacity
                        onPress={handleSearchByPhone}
                        disabled={searching}
                        style={{
                            marginLeft: 8,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 999,
                            backgroundColor: colors.primary,
                            opacity: searching ? 0.7 : 1,
                        }}
                    >
                        <Text
                            style={{
                                color: "#fff",
                                fontSize: 13,
                                fontWeight: "600",
                            }}
                        >
                            Tìm
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Kết quả: trang cá nhân thu gọn */}
                {resultUser && (
                    <View
                        style={{
                            marginTop: 16,
                            borderRadius: 16,
                            backgroundColor: colors.card,
                            padding: 16,
                        }}
                    >
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                marginBottom: 16,
                            }}
                        >
                            <View
                                style={{
                                    width: 56,
                                    height: 56,
                                    borderRadius: 28,
                                    backgroundColor: colors.avatarBg,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    marginRight: 12,
                                }}
                            >
                                <Text
                                    style={{
                                        color: colors.text,
                                        fontSize: 24,
                                        fontWeight: "600",
                                    }}
                                >
                                    {(resultUser.displayName ||
                                        resultUser.username ||
                                        "U")
                                        .charAt(0)
                                        .toUpperCase()}
                                </Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text
                                    style={{
                                        color: colors.text,
                                        fontSize: 16,
                                        fontWeight: "600",
                                    }}
                                >
                                    {resultUser.displayName ||
                                        resultUser.username ||
                                        "Người dùng"}
                                </Text>
                                {resultUser.phone ? (
                                    <Text
                                        style={{
                                            color: colors.textSecondary,
                                            fontSize: 13,
                                            marginTop: 2,
                                        }}
                                    >
                                        {resultUser.phone}
                                    </Text>
                                ) : null}
                            </View>
                        </View>

                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                            }}
                        >
                            <TouchableOpacity
                                activeOpacity={0.8}
                                style={{
                                    flex: 1,
                                    marginRight: 8,
                                    paddingVertical: 10,
                                    borderRadius: 999,
                                    backgroundColor: colors.searchBg,
                                    alignItems: "center",
                                }}
                            >
                                <Text
                                    style={{
                                        color: colors.text,
                                        fontSize: 14,
                                        fontWeight: "500",
                                    }}
                                >
                                    Nhắn tin
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                activeOpacity={0.8}
                                disabled={
                                    !!currentUserId &&
                                    (currentUserId === resultUser.id ||
                                        friendIdSet.has(resultUser.id) ||
                                        pendingRequestIdSet.has(resultUser.id))
                                }
                                onPress={() => handleSendRequest(resultUser.id)}
                                style={{
                                    flex: 1,
                                    marginLeft: 8,
                                    paddingVertical: 10,
                                    borderRadius: 999,
                                    backgroundColor: colors.primary,
                                    alignItems: "center",
                                    opacity:
                                        currentUserId &&
                                            (currentUserId === resultUser.id ||
                                                friendIdSet.has(resultUser.id) ||
                                                pendingRequestIdSet.has(
                                                    resultUser.id
                                                ))
                                            ? 0.6
                                            : 1,
                                }}
                            >
                                <Text
                                    style={{
                                        color: "#fff",
                                        fontSize: 14,
                                        fontWeight: "600",
                                    }}
                                >
                                    {currentUserId && currentUserId === resultUser.id
                                        ? "Bạn"
                                        : friendIdSet.has(resultUser.id)
                                            ? "Đã là bạn"
                                            : pendingRequestIdSet.has(resultUser.id)
                                                ? "Đã gửi"
                                                : "Kết bạn"}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>

            {/* Modal chọn mã quốc gia/vùng lãnh thổ (đơn giản, vài lựa chọn phổ biến) */}
            <Modal
                visible={countryPickerVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setCountryPickerVisible(false)}
            >
                <View
                    style={{
                        flex: 1,
                        backgroundColor: "rgba(0,0,0,0.5)",
                        justifyContent: "center",
                        alignItems: "center",
                    }}
                >
                    <View
                        style={{
                            width: "80%",
                            maxWidth: 360,
                            borderRadius: 16,
                            backgroundColor: colors.card,
                            paddingVertical: 12,
                        }}
                    >
                        <Text
                            style={{
                                color: colors.text,
                                fontSize: 16,
                                fontWeight: "600",
                                textAlign: "center",
                                marginBottom: 8,
                            }}
                        >
                            Chọn mã quốc gia
                        </Text>
                        <ScrollView
                            style={{ maxHeight: 260 }}
                            contentContainerStyle={{ paddingVertical: 4 }}
                        >
                            {[
                                { code: "+84", label: "Việt Nam" },
                                { code: "+1", label: "Hoa Kỳ" },
                                { code: "+81", label: "Nhật Bản" },
                                { code: "+82", label: "Hàn Quốc" },
                                { code: "+65", label: "Singapore" },
                            ].map((c) => (
                                <TouchableOpacity
                                    key={c.code}
                                    onPress={() => {
                                        setSelectedCountryCode(c.code);
                                        setCountryPickerVisible(false);
                                    }}
                                    style={{
                                        paddingHorizontal: 16,
                                        paddingVertical: 10,
                                        flexDirection: "row",
                                        alignItems: "center",
                                    }}
                                >
                                    <Text
                                        style={{
                                            color: colors.text,
                                            fontSize: 15,
                                            fontWeight: "500",
                                            marginRight: 8,
                                        }}
                                    >
                                        {c.code}
                                    </Text>
                                    <Text
                                        style={{
                                            color: colors.textSecondary,
                                            fontSize: 14,
                                        }}
                                    >
                                        {c.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <TouchableOpacity
                            onPress={() => setCountryPickerVisible(false)}
                            style={{
                                paddingVertical: 10,
                                alignItems: "center",
                                borderTopWidth: 0.5,
                                borderTopColor: "#27272a",
                                marginTop: 4,
                            }}
                        >
                            <Text
                                style={{
                                    color: colors.textSecondary,
                                    fontSize: 14,
                                }}
                            >
                                Đóng
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
            </ScrollView>
        </View>
    );
}
