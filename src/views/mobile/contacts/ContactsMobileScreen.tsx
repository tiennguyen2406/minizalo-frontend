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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import FriendsListMobile from "./FriendsListMobile";
import { PROFILE_COLORS, profileStyles } from "../profile/styles";
import { useRouter } from "expo-router";
import { useFriendStore } from "@/shared/store/friendStore";
import { useUserStore } from "@/shared/store/userStore";
import type { UserProfile } from "@/shared/services/types";
import { useFocusEffect } from "@react-navigation/native";

type TabKey = "friends" | "groups";

const TABS: { key: TabKey; label: string }[] = [
    { key: "friends", label: "Bạn bè" },
    { key: "groups", label: "Nhóm" },
];

export default function ContactsMobileScreen() {
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
                fetchRequests();
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
                                color: PROFILE_COLORS.textSecondary,
                                fontSize: 14,
                            }}
                        >
                            Danh sách nhóm sẽ được phát triển sau.
                        </Text>
                    </View>
                );
            default:
                return null;
        }
    };

    return (
        <SafeAreaView
            style={{
                flex: 1,
                backgroundColor: PROFILE_COLORS.background,
            }}
            edges={["top"]}
        >
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
            <View style={profileStyles.searchRow}>
                <View style={profileStyles.searchBox}>
                    <Ionicons
                        name="search"
                        size={20}
                        color={PROFILE_COLORS.textSecondary}
                    />
                    <TextInput
                        style={profileStyles.searchInput}
                        value={searchText}
                        onChangeText={setSearchText}
                        placeholder="Tìm kiếm"
                        placeholderTextColor={PROFILE_COLORS.textSecondary}
                        showSoftInputOnFocus={false}
                        onFocus={() => {
                            setSearchText("");
                            router.push({
                                pathname: "/(tabs)/contacts-search",
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
                                color={PROFILE_COLORS.textSecondary}
                            />
                        </TouchableOpacity>
                    ) : null}
                </View>
                <TouchableOpacity
                    style={profileStyles.settingsButton}
                    activeOpacity={0.8}
                    onPress={() => router.push("/(tabs)/contacts-add")}
                >
                    <Ionicons
                        name="person-add-outline"
                        size={24}
                        color={PROFILE_COLORS.text}
                    />
                </TouchableOpacity>
            </View>

            {/* Tabs: Bạn bè / Nhóm */}
            <View
                style={{
                    paddingHorizontal: 16,
                    paddingTop: 12,
                    paddingBottom: 4,
                    backgroundColor: PROFILE_COLORS.background,
                }}
            >
                <View
                    style={{
                        flexDirection: "row",
                        borderRadius: 999,
                        backgroundColor: "#1f1f21",
                        padding: 2,
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
                                    paddingVertical: 6,
                                    borderRadius: 999,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    backgroundColor: active ? "#fff" : "transparent",
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 13,
                                        fontWeight: "500",
                                        color: active ? "#111827" : PROFILE_COLORS.textSecondary,
                                    }}
                                >
                                    {tab.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            {/* Khu vực hành động dưới tabs:
               - Tab Bạn bè: Lời mời kết bạn + Sinh nhật
               - Tab Nhóm: nút Tạo nhóm (chưa cần xử lý chức năng) */}
            {activeTab === "friends" ? (
                <View
                    style={{
                        paddingHorizontal: 16,
                        paddingTop: 8,
                        paddingBottom: 4,
                        backgroundColor: PROFILE_COLORS.background,
                    }}
                >
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => router.push("/(tabs)/contacts-requests")}
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: 10,
                        }}
                    >
                        <View
                            style={{
                                width: 32,
                                height: 32,
                                borderRadius: 16,
                                backgroundColor: "#1d4ed8",
                                alignItems: "center",
                                justifyContent: "center",
                                marginRight: 10,
                            }}
                        >
                            <Ionicons
                                name="person-add-outline"
                                size={18}
                                color="#fff"
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text
                                style={{
                                    color: PROFILE_COLORS.text,
                                    fontSize: 14,
                                    fontWeight: "500",
                                }}
                            >
                                {requests.length > 0
                                    ? `Lời mời kết bạn(${requests.length})`
                                    : "Lời mời kết bạn"}
                            </Text>
                            <Text
                                style={{
                                    color: PROFILE_COLORS.textSecondary,
                                    fontSize: 12,
                                    marginTop: 2,
                                }}
                            >
                                {requests.length > 0
                                    ? `${requests.length} lời mời đang chờ`
                                    : "Xem các lời mời kết bạn của bạn"}
                            </Text>
                        </View>
                        <Ionicons
                            name="chevron-forward"
                            size={18}
                            color={PROFILE_COLORS.textSecondary}
                        />
                    </TouchableOpacity>

                    <View
                        style={{
                            height: 0.5,
                            backgroundColor: "#27272a",
                            marginVertical: 6,
                        }}
                    />

                    <BirthdaySection birthdayFriends={birthdayFriends} />
                </View>
            ) : (
                <View
                    style={{
                        paddingHorizontal: 16,
                        paddingTop: 8,
                        paddingBottom: 4,
                        backgroundColor: PROFILE_COLORS.background,
                    }}
                >
                    <TouchableOpacity
                        activeOpacity={0.8}
                        // Chưa xử lý điều hướng, chỉ làm UI
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: 10,
                        }}
                    >
                        <View
                            style={{
                                width: 32,
                                height: 32,
                                borderRadius: 16,
                                backgroundColor: "#22c55e",
                                alignItems: "center",
                                justifyContent: "center",
                                marginRight: 10,
                            }}
                        >
                            <Ionicons
                                name="people-outline"
                                size={18}
                                color="#fff"
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text
                                style={{
                                    color: PROFILE_COLORS.text,
                                    fontSize: 14,
                                    fontWeight: "500",
                                }}
                            >
                                Tạo nhóm
                            </Text>
                            <Text
                                style={{
                                    color: PROFILE_COLORS.textSecondary,
                                    fontSize: 12,
                                    marginTop: 2,
                                }}
                            >
                                Tạo nhóm chat để trò chuyện cùng nhiều bạn bè
                            </Text>
                        </View>
                        <Ionicons
                            name="chevron-forward"
                            size={18}
                            color={PROFILE_COLORS.textSecondary}
                        />
                    </TouchableOpacity>
                </View>
            )}

            {/* Nội dung từng tab */}
            <View style={{ flex: 1 }}>{renderTabContent()}</View>
        </SafeAreaView>
    );
}

type BirthdaySectionProps = {
    birthdayFriends: UserProfile[];
};

function BirthdaySection({ birthdayFriends }: BirthdaySectionProps) {
    const router = useRouter();

    return (
        <View>
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => router.push("/(tabs)/contacts-birthdays")}
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 10,
                }}
            >
                <View
                    style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: "#0ea5e9",
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 10,
                    }}
                >
                    <Ionicons
                        name="calendar-outline"
                        size={18}
                        color="#fff"
                    />
                </View>
                <View style={{ flex: 1 }}>
                    <Text
                        style={{
                            color: PROFILE_COLORS.text,
                            fontSize: 14,
                            fontWeight: "500",
                        }}
                    >
                        Sinh nhật
                    </Text>
                    <Text
                        style={{
                            color: PROFILE_COLORS.textSecondary,
                            fontSize: 12,
                            marginTop: 2,
                        }}
                    >
                        Xem sinh nhật bạn bè của bạn
                    </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={PROFILE_COLORS.textSecondary} />
            </TouchableOpacity>
        </View>
    );
}

