import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Platform,
    FlatList,
    Animated,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SafeView as SafeAreaView } from "@/shared/components/SafeView";
import { Ionicons } from "@expo/vector-icons";
import FriendsListMobile from "./FriendsListMobile";
import PhonebookListMobile from "./PhonebookListMobile";
import { useRouter } from "expo-router";
import { useFriendStore } from "@/shared/store/friendStore";
import { useUserStore } from "@/shared/store/userStore";
import type { UserProfile } from "@/shared/services/types";
import { useFocusEffect } from "@react-navigation/native";

import { useThemeColors } from "@/shared/theme/colors";

type TabKey = "friends" | "groups" | "phonebook";

const TABS: { key: TabKey; label: string }[] = [
    { key: "friends", label: "Bạn bè" },
    { key: "groups", label: "Nhóm" },
    { key: "phonebook", label: "Danh bạ máy" },
];

export default function ContactsMobileScreen() {
    const colors = useThemeColors();
    const [activeTab, setActiveTab] = useState<TabKey>("friends");
    const [searchText, setSearchText] = useState("");
    const [showRequestBanner, setShowRequestBanner] = useState(false);
    const [newRequestsCount, setNewRequestsCount] = useState(0);
    const bannerTranslateY = useRef(new Animated.Value(-80)).current;
    const hideBannerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { friends, requests, fetchRequests } = useFriendStore();
    const { profile } = useUserStore();
    const currentUserId = profile?.id ?? null;

    // Lưu lại số lượng lời mời trước đó để phát hiện "lời mời mới"
    const lastRequestsCountRef = useRef<number>(requests.length);

    const birthdayFriends = useMemo<UserProfile[]>(() => {
        const result: UserProfile[] = [];
        const seen = new Set<string>();
        const nowYear = new Date().getFullYear();

        friends.forEach((f) => {
            const user =
                currentUserId && f.user.id === currentUserId ? f.friend : f.user;
            if (!user.dateOfBirth) return;
            if (seen.has(user.id)) return;
            // dateOfBirth là năm sinh; nếu <= năm hiện tại thì xem là hợp lệ
            const year = new Date(user.dateOfBirth).getFullYear();
            if (Number.isNaN(year) || year > nowYear) return;
            seen.add(user.id);
            result.push(user);
        });

        return result;
    }, [friends, currentUserId]);

    // Khi tab Danh bạ được focus:
    // - Tải ngay danh sách lời mời
    // - Poll định kỳ để 2 thiết bị đồng bộ nhanh hơn (gần real-time)
    useFocusEffect(
        useCallback(() => {
            let isActive = true;
            // Gọi lần đầu
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            fetchRequests();

            const intervalId = setInterval(() => {
                if (!isActive) return;
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                fetchRequests({ silent: true });
            }, 5000); // 5s một lần; có thể giảm xuống 3s nếu cần nhanh hơn

            return () => {
                isActive = false;
                clearInterval(intervalId);
            };
        }, [fetchRequests])
    );

    // Hiển thị banner thông báo khi có thêm lời mời kết bạn mới
    useEffect(() => {
        const prevCount = lastRequestsCountRef.current;
        const currentCount = requests.length;

        // Chỉ thông báo khi số lượng lời mời tăng lên
        if (currentCount > prevCount) {
            const added = currentCount - prevCount;
            lastRequestsCountRef.current = currentCount;
            setNewRequestsCount(added);
            setShowRequestBanner(true);

            // Hủy timer cũ nếu đang chạy
            if (hideBannerTimeoutRef.current) {
                clearTimeout(hideBannerTimeoutRef.current);
                hideBannerTimeoutRef.current = null;
            }

            // Slide từ trên xuống
            bannerTranslateY.setValue(-80);
            Animated.timing(bannerTranslateY, {
                toValue: 0,
                duration: 220,
                useNativeDriver: true,
            }).start(() => {
                // Tự ẩn sau 3 giây
                hideBannerTimeoutRef.current = setTimeout(() => {
                    Animated.timing(bannerTranslateY, {
                        toValue: -80,
                        duration: 200,
                        useNativeDriver: true,
                    }).start(() => {
                        setShowRequestBanner(false);
                    });
                }, 3000);
            });
        } else {
            // Cập nhật lại giá trị tham chiếu để lần sau so sánh đúng
            lastRequestsCountRef.current = currentCount;
        }

        return () => {
            if (hideBannerTimeoutRef.current) {
                clearTimeout(hideBannerTimeoutRef.current);
                hideBannerTimeoutRef.current = null;
            }
        };
    }, [requests.length, bannerTranslateY]);

    const renderTabContent = () => {
        switch (activeTab) {
            case "friends":
                // Danh sách bạn bè không bị ảnh hưởng bởi thanh tìm kiếm chính.
                // Thanh tìm kiếm chỉ dùng để mở màn tìm kiếm riêng (contacts-search).
                return <FriendsListMobile />;
            case "groups":
                return (
                    <View
                        style={{
                            flex: 1,
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <Text
                            style={{
                                color: colors.textSecondary,
                                fontSize: 14,
                            }}
                        >
                            Danh sách nhóm sẽ được phát triển sau.
                        </Text>
                    </View>
                );
            case "phonebook":
                return <PhonebookListMobile />;
            default:
                return null;
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <StatusBar style={colors.statusBar} />
            <SafeAreaView style={{ backgroundColor: colors.headerBg }} edges={["top"]}>
                {/* Banner thông báo lời mời kết bạn mới (đổ từ trên xuống, tự ẩn) */}
                {showRequestBanner && (
                    <Animated.View
                        style={{
                            position: "absolute",
                            left: 0,
                            right: 0,
                            top: insets.top || 0,
                            zIndex: 20,
                            transform: [{ translateY: bannerTranslateY }],
                        }}
                    >
                        <View
                            style={{
                                marginHorizontal: 12,
                                paddingHorizontal: 12,
                                paddingVertical: 10,
                                borderRadius: 12,
                                backgroundColor: "#1d4ed8",
                                flexDirection: "row",
                                alignItems: "center",
                            }}
                        >
                            <Ionicons
                                name="notifications-outline"
                                size={18}
                                color="#fff"
                                style={{ marginRight: 8 }}
                            />
                            <View style={{ flex: 1 }}>
                                <Text
                                    style={{
                                        color: "#fff",
                                        fontSize: 13,
                                        fontWeight: "600",
                                    }}
                                >
                                    {newRequestsCount > 1
                                        ? `Bạn có ${newRequestsCount} lời mời kết bạn mới`
                                        : "Bạn có 1 lời mời kết bạn mới"}
                                </Text>
                                <Text
                                    style={{
                                        color: "#e5e7eb",
                                        fontSize: 12,
                                        marginTop: 2,
                                    }}
                                >
                                    Chạm để xem danh sách lời mời.
                                </Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => {
                                    // Ẩn banner khi người dùng tự đóng, đồng thời mở màn Lời mời
                                    if (hideBannerTimeoutRef.current) {
                                        clearTimeout(hideBannerTimeoutRef.current);
                                        hideBannerTimeoutRef.current = null;
                                    }
                                    Animated.timing(bannerTranslateY, {
                                        toValue: -80,
                                        duration: 180,
                                        useNativeDriver: true,
                                    }).start(() => {
                                        setShowRequestBanner(false);
                                    });
                                    router.push("/(tabs)/contacts-requests");
                                }}
                                style={{ marginLeft: 8, padding: 4 }}
                            >
                                <Ionicons name="chevron-forward" size={18} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                )}

                {/* Header: ô tìm kiếm + icon thêm bạn */}
                <View
                    style={{
                        height: 52,
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 16,
                        backgroundColor: colors.headerBg,
                        borderBottomWidth: colors.headerBg.startsWith("#0") ? 0 : 0.5,
                        borderBottomColor: colors.border,
                        gap: 12,
                    }}
                >
                    <View
                        style={{
                            flex: 1,
                            flexDirection: "row",
                            alignItems: "center",
                            borderRadius: 10,
                            backgroundColor: colors.headerSearchBg,
                            paddingHorizontal: 10,
                            height: 36,
                        }}
                    >
                        <Ionicons
                            name="search"
                            size={18}
                            color={colors.headerIcon}
                        />
                        <TextInput
                            style={{
                                flex: 1,
                                fontSize: 15,
                                color: colors.headerText,
                                marginLeft: 8,
                                paddingVertical: 0,
                            }}
                            value={searchText}
                            onChangeText={setSearchText}
                            placeholder="Tìm kiếm"
                            placeholderTextColor={colors.headerIcon}
                            showSoftInputOnFocus={false}
                            onFocus={() => {
                                setSearchText("");
                                router.push({
                                    pathname: "/search",
                                    params: { from: "contacts", t: Date.now() },
                                });
                            }}
                        />
                        {searchText ? (
                            <TouchableOpacity
                                onPress={() => setSearchText("")}
                                style={{ paddingLeft: 4 }}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name="close-circle"
                                    size={18}
                                    color={colors.headerIcon}
                                />
                            </TouchableOpacity>
                        ) : null}
                    </View>
                    <TouchableOpacity
                        style={{ padding: 4 }}
                        activeOpacity={0.8}
                        onPress={() => router.push("/(tabs)/contacts-add")}
                    >
                        <Ionicons
                            name="person-add-outline"
                            size={24}
                            color={colors.headerIcon}
                        />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            {/* Tabs: Bạn bè / Nhóm */}
            <View
                style={{
                    flexDirection: "row",
                    backgroundColor: colors.card,
                    borderBottomWidth: 0.5,
                    borderBottomColor: colors.border,
                }}
            >
                {TABS.map((tab) => {
                    const active = activeTab === tab.key;
                    return (
                        <TouchableOpacity
                            key={tab.key}
                            onPress={() => setActiveTab(tab.key)}
                            activeOpacity={0.9}
                            style={{
                                flex: 1,
                                paddingVertical: 14,
                                alignItems: "center",
                                justifyContent: "center",
                                borderBottomWidth: active ? 2 : 0,
                                borderBottomColor: active ? colors.primary : "transparent",
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: 15,
                                    fontWeight: active ? "600" : "500",
                                    color: active ? colors.text : colors.textSecondary,
                                }}
                            >
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Khu vực hành động dưới tabs (chỉ hiện với tab Bạn bè và Nhóm) */}
            {activeTab === "friends" && (
                <View>
                    <View
                        style={{
                            paddingHorizontal: 16,
                            paddingTop: 8,
                            paddingBottom: 4,
                            backgroundColor: colors.background,
                        }}
                    >
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => router.push("/(tabs)/contacts-requests")}
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                paddingVertical: 12,
                            }}
                        >
                            <View
                                style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 14,
                                    backgroundColor: colors.primary,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    marginRight: 16,
                                }}
                            >
                                <Ionicons name="people" size={22} color="#fff" />
                            </View>
                            <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
                                <Text style={{ color: colors.text, fontSize: 16, fontWeight: "400" }}>
                                    Lời mời kết bạn
                                </Text>
                                {requests.length > 0 && (
                                    <Text style={{ color: colors.textSecondary, fontSize: 16, marginLeft: 6 }}>
                                        ({requests.length})
                                    </Text>
                                )}
                            </View>
                        </TouchableOpacity>
                        <BirthdaySection birthdayFriends={birthdayFriends} />
                    </View>
                    <View style={{ height: 8, backgroundColor: colors.searchBg }} />
                </View>
            )}
            {activeTab === "groups" && (
                <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, backgroundColor: colors.background }}>
                    <TouchableOpacity
                        activeOpacity={0.8}
                        style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10 }}
                    >
                        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#22c55e", alignItems: "center", justifyContent: "center", marginRight: 10 }}>
                            <Ionicons name="people-outline" size={18} color="#fff" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ color: colors.text, fontSize: 14, fontWeight: "500" }}>Tạo nhóm</Text>
                            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                                Tạo nhóm chat để trò chuyện cùng nhiều bạn bè
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                </View>
            )}

            {/* Nội dung từng tab */}
            <View style={{ flex: 1 }}>{renderTabContent()}</View>
        </View>
    );
}

type BirthdaySectionProps = {
    birthdayFriends: UserProfile[];
};

function BirthdaySection({ birthdayFriends }: BirthdaySectionProps) {
    const router = useRouter();
    const colors = useThemeColors();

    return (
        <View>
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => router.push("/(tabs)/contacts-birthdays")}
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 12,
                }}
            >
                <View
                    style={{
                        width: 40,
                        height: 40,
                        borderRadius: 14,
                        backgroundColor: colors.primary,
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 16,
                    }}
                >
                    <Ionicons
                        name="gift"
                        size={22}
                        color="#fff"
                    />
                </View>
                <View style={{ flex: 1 }}>
                    <Text
                        style={{
                            color: colors.text,
                            fontSize: 16,
                            fontWeight: "400",
                        }}
                    >
                        Sinh nhật
                    </Text>
                </View>
            </TouchableOpacity>
        </View>
    );
}

