import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Text,
    TouchableOpacity,
    View,
    Alert,
    Modal,
    TextInput,
    ScrollView,
    Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GestureHandlerRootView, Swipeable } from "react-native-gesture-handler";
import { useRouter } from "expo-router";
import { useFriendStore } from "@/shared/store/friendStore";
import { useChatStore } from "@/shared/store/useChatStore";
import { useUserStore } from "@/shared/store/userStore";
import type { FriendResponseDto } from "@/shared/services/types";
import type { UserProfile } from "@/shared/services/types";
import { useThemeColors } from "@/shared/theme/colors";
import friendCategoryService, {
    type FriendCategory,
} from "@/shared/services/friendCategoryService";
import friendService from "@/shared/services/friendService";

type FriendsListMobileProps = {
    /** Chuỗi tìm kiếm từ header Contacts, lọc cục bộ danh sách bạn bè. */
    searchText?: string;
};

function getFriendUser(item: FriendResponseDto, currentUserId?: string | null) {
    if (!currentUserId) return item.friend;
    return item.user.id === currentUserId ? item.friend : item.user;
}

const CLOSE_FRIEND_CATEGORY_NAME = "Bạn thân";

export default function FriendsListMobile({ searchText = "" }: FriendsListMobileProps) {
    const router = useRouter();
    const colors = useThemeColors();
    const {
        friends,
        loading,
        error,
        fetchFriends,
        removeFriend,
        clearError,
        blockedUsers,
        blockUser,
        unblockUser,
    } = useFriendStore();
    const { rooms } = useChatStore();
    const currentUser = useUserStore((s) => s.profile);

    const [categories, setCategories] = useState<FriendCategory[]>([]);
    const [friendCategoryMap, setFriendCategoryMap] = useState<
        Record<string, string | undefined>
    >({});
    const [closeFriendCategoryId, setCloseFriendCategoryId] = useState<string | null>(null);
    const [manageCategoriesVisible, setManageCategoriesVisible] =
        useState(false);
    const [actionSheetFriend, setActionSheetFriend] = useState<{
        raw: FriendResponseDto;
        user: UserProfile;
        displayName: string;
    } | null>(null);
    const [blockSheetFriend, setBlockSheetFriend] = useState<{
        userId: string;
        displayName: string;
    } | null>(null);
    const [blockOptions, setBlockOptions] = useState({
        blockMessages: false,
        blockCalls: false,
        blockTimeline: false,
    });
    const [initialBlockedByYou, setInitialBlockedByYou] = useState<boolean | null>(null);
    const [addToCloseFriendsVisible, setAddToCloseFriendsVisible] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState("");
    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
        null
    );
    const [editingCategoryName, setEditingCategoryName] = useState("");

    const randomColor = () => {
        const palette = [
            "#ef4444",
            "#22c55e",
            "#f97316",
            "#8b5cf6",
            "#eab308",
            "#3b82f6",
        ];
        return palette[Math.floor(Math.random() * palette.length)];
    };

    useEffect(() => {
        // Tải danh sách bạn bè khi vào màn
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        fetchFriends();
    }, [fetchFriends]);

    // Đồng bộ trạng thái blockMessages theo backend khi mở sheet Quản lý chặn
    useEffect(() => {
        if (!blockSheetFriend) {
            setBlockOptions({ blockMessages: false, blockCalls: false, blockTimeline: false });
            setInitialBlockedByYou(null);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                // Ưu tiên dùng danh sách blockedUsers trong store nếu đã có
                const isBlockedFromStore = blockedUsers.some(
                    (f) => f.friend.id === blockSheetFriend.userId
                );
                let isBlocked = isBlockedFromStore;
                if (!isBlockedFromStore) {
                    // Fallback: gọi trực tiếp API checkBlockStatus để chắc chắn
                    const status = await friendService.checkBlockStatus(blockSheetFriend.userId);
                    isBlocked = !!status.blockedByYou;
                }
                if (!cancelled) {
                    setInitialBlockedByYou(isBlocked);
                    setBlockOptions((prev) => ({
                        ...prev,
                        blockMessages: isBlocked,
                    }));
                }
            } catch {
                if (!cancelled) {
                    setInitialBlockedByYou(null);
                    // giữ nguyên blockOptions mặc định
                }
            }
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [blockSheetFriend]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [cats, assigns] = await Promise.all([
                    friendCategoryService.listCategories(),
                    friendCategoryService.listAssignments(),
                ]);
                if (cancelled) return;
                setCategories(cats);
                const map: Record<string, string> = {};
                assigns.forEach((a) => {
                    if (a.categoryId) {
                        map[a.targetUserId] = a.categoryId;
                    }
                });
                setFriendCategoryMap(map);
                let closeId = cats.find((c) => c.name === CLOSE_FRIEND_CATEGORY_NAME)?.id ?? null;
                if (!closeId) {
                    try {
                        const created = await friendCategoryService.createCategory({
                            name: CLOSE_FRIEND_CATEGORY_NAME,
                            color: "#eab308",
                        });
                        if (!cancelled) {
                            setCategories((prev) => [...prev, created]);
                            setCloseFriendCategoryId(created.id);
                        }
                    } catch {
                        // ignore: có thể đã có từ trước
                    }
                } else {
                    setCloseFriendCategoryId(closeId);
                }
            } catch {
                // ignore lỗi mạng: vẫn cho phép xem danh sách bạn
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const groupedFriends = useMemo(() => {
        const normalizedSearch = searchText.trim().toLowerCase();
        const items = friends
            .map((item) => {
                const u = getFriendUser(item, currentUser?.id);
                const name = (u.displayName || u.username || "").trim();
                return { raw: item, user: u, name };
            })
            .filter(({ name }) =>
                normalizedSearch ? name.toLowerCase().includes(normalizedSearch) : true
            )
            .sort((a, b) =>
                a.name.localeCompare(b.name, "vi", { sensitivity: "base" })
            );

        const closeFriends = closeFriendCategoryId
            ? items.filter(({ user }) => friendCategoryMap[user.id] === closeFriendCategoryId)
            : [];
        // Danh sách chính theo chữ cái: gồm TẤT CẢ bạn bè (kể cả bạn thân)
        const rest = items;

        const groups: { key: string; data: typeof items }[] = [];
        if (closeFriends.length > 0) {
            groups.push({ key: "__closeFriends", data: closeFriends });
        }
        const map: Record<string, typeof items> = {};
        for (const it of rest) {
            const letter = it.name.charAt(0).toUpperCase() || "#";
            const key = /[A-ZÁÀÂÃĂẠẢẤẦẨẪẬẮẰẲẴẶÉÈẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴ]/.test(
                letter
            )
                ? letter
                : "#";
            if (!map[key]) map[key] = [];
            map[key].push(it);
        }
        Object.keys(map)
            .sort((a, b) => a.localeCompare(b))
            .forEach((k) => {
                groups.push({ key: k, data: map[k] });
            });
        return groups;
    }, [friends, searchText, friendCategoryMap, closeFriendCategoryId, currentUser?.id]);

    const handleAssignCategory = async (userId: string, categoryId: string) => {
        const current = friendCategoryMap[userId];
        const nextCategoryId = current === categoryId ? undefined : categoryId;

        setFriendCategoryMap((prev) => {
            const next = { ...prev };
            if (!nextCategoryId) {
                delete next[userId];
            } else {
                next[userId] = nextCategoryId;
            }
            return next;
        });

        try {
            await friendCategoryService.assignCategory(
                userId,
                nextCategoryId ?? null
            );
        } catch {
            Alert.alert(
                "Lỗi",
                "Không cập nhật được thẻ phân loại. Vui lòng thử lại sau."
            );
        }
    };

    const handleClearCategory = async (userId: string) => {
        setFriendCategoryMap((prev) => {
            const next = { ...prev };
            delete next[userId];
            return next;
        });
        try {
            await friendCategoryService.assignCategory(userId, null);
        } catch {
            Alert.alert(
                "Lỗi",
                "Không hủy được thẻ phân loại. Vui lòng thử lại sau."
            );
        }
    };

    const handleAddCategory = async () => {
        const name = newCategoryName.trim();
        if (!name) return;
        const color = randomColor();
        try {
            const created = await friendCategoryService.createCategory({
                name,
                color,
            });
            setCategories((prev) => [...prev, created]);
            setNewCategoryName("");
        } catch {
            Alert.alert(
                "Lỗi",
                "Không thêm được thẻ phân loại. Vui lòng thử lại sau."
            );
        }
    };

    const handleSaveEditCategory = async () => {
        if (!editingCategoryId) return;
        const name = editingCategoryName.trim();
        if (!name) return;
        const current = categories.find((c) => c.id === editingCategoryId);
        if (!current) return;
        try {
            const updated = await friendCategoryService.updateCategory(
                editingCategoryId,
                { name, color: current.color }
            );
            setCategories((prev) =>
                prev.map((c) => (c.id === updated.id ? updated : c))
            );
            setEditingCategoryId(null);
            setEditingCategoryName("");
        } catch {
            Alert.alert(
                "Lỗi",
                "Không lưu được thẻ phân loại. Vui lòng thử lại sau."
            );
        }
    };

    const handleDeleteCategory = (id: string, name: string) => {
        Alert.alert(
            "Xóa thẻ phân loại",
            `Bạn có chắc chắn muốn xóa thẻ "${name}"?`,
            [
                { text: "Hủy", style: "cancel" },
                {
                    text: "Xóa",
                    style: "destructive",
                    onPress: async () => {
                        setCategories((prev) => prev.filter((c) => c.id !== id));
                        setFriendCategoryMap((prev) => {
                            const next = { ...prev };
                            Object.keys(next).forEach((friendId) => {
                                if (next[friendId] === id) {
                                    delete next[friendId];
                                }
                            });
                            return next;
                        });
                        try {
                            await friendCategoryService.deleteCategory(id);
                        } catch {
                            Alert.alert(
                                "Lỗi",
                                "Không xóa được thẻ phân loại. Vui lòng thử lại sau."
                            );
                        }
                    },
                },
            ]
        );
    };

    const handleRemoveFriend = (friendId: string, friendName: string) => {
        Alert.alert(
            "Xóa bạn",
            `Bạn có chắc chắn muốn xóa "${friendName}" khỏi danh sách bạn bè?`,
            [
                { text: "Hủy", style: "cancel" },
                {
                    text: "Xóa",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await removeFriend(friendId);
                        } catch {
                            // lỗi đã có trong store
                        }
                    },
                },
            ]
        );
    };

    const renderSwipeLeftActions = (
        userId: string,
        displayName: string,
        raw: FriendResponseDto,
        user: UserProfile,
        onCloseSwipeable?: () => void
    ) => (
        <View style={{ flexDirection: "row", alignItems: "stretch" }}>
            <TouchableOpacity
                onPress={() => {
                    onCloseSwipeable?.();
                    setActionSheetFriend({ raw, user, displayName });
                }}
                style={{
                    backgroundColor: "#374151",
                    justifyContent: "center",
                    alignItems: "center",
                    paddingHorizontal: 20,
                    minWidth: 72,
                }}
            >
                <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
                <Text style={{ color: "#fff", fontSize: 11, marginTop: 2 }}>Thêm</Text>
            </TouchableOpacity>
            <TouchableOpacity
                onPress={() => handleRemoveFriend(userId, displayName)}
                style={{
                    backgroundColor: "#ef4444",
                    justifyContent: "center",
                    alignItems: "center",
                    paddingHorizontal: 20,
                    minWidth: 72,
                }}
            >
                <Ionicons name="trash-outline" size={20} color="#fff" />
                <Text style={{ color: "#fff", fontSize: 11, marginTop: 2 }}>Xóa</Text>
            </TouchableOpacity>
        </View>
    );

    const renderFriendRow = (item: FriendResponseDto) => {
        const u = getFriendUser(item, currentUser?.id);
        const displayName = u.displayName || u.username || "Người dùng";
        const initial =
            (displayName.charAt(0).toUpperCase() || "?").toUpperCase();

        // Dùng biến cục bộ cho từng hàng, tránh trùng ref giữa danh sách Bạn thân và danh sách chữ cái
        let swipeableInstance: Swipeable | null = null;

        const rowContent = (
            <TouchableOpacity
                activeOpacity={0.8}
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    backgroundColor: colors.background,
                }}
            >
                <View
                    style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: colors.avatarBg,
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 12,
                    }}
                >
                    <Text
                        style={{
                            color: colors.text,
                            fontWeight: "600",
                            fontSize: 16,
                        }}
                    >
                        {initial}
                    </Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text
                        numberOfLines={1}
                        style={{
                            color: colors.text,
                            fontSize: 15,
                            fontWeight: "500",
                        }}
                    >
                        {displayName}
                    </Text>
                    {u.statusMessage ? (
                        <Text
                            numberOfLines={1}
                            style={{
                                color: colors.textSecondary,
                                fontSize: 12,
                                marginTop: 2,
                            }}
                        >
                            {u.statusMessage}
                        </Text>
                    ) : null}
                </View>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <TouchableOpacity style={{ padding: 6 }} onPress={() => { }}>
                        <Ionicons name="call-outline" size={22} color={colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity style={{ padding: 6, marginLeft: 4 }} onPress={() => { }}>
                        <Ionicons name="videocam-outline" size={22} color={colors.text} />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );

        return (
            <Swipeable
                key={item.id}
                ref={(r) => {
                    swipeableInstance = r;
                }}
                renderRightActions={() =>
                    renderSwipeLeftActions(u.id, displayName, item, u, () =>
                        swipeableInstance?.close?.()
                    )
                }
                friction={2}
            >
                {rowContent}
            </Swipeable>
        );
    };

    const closeFriendsCount = useMemo(() => {
        if (!closeFriendCategoryId) return 0;
        return friends.filter(
            (f) => friendCategoryMap[getFriendUser(f, currentUser?.id).id] === closeFriendCategoryId
        ).length;
    }, [friends, friendCategoryMap, closeFriendCategoryId, currentUser?.id]);

    const renderSection = ({
        item,
    }: {
        item: { key: string; data: { raw: FriendResponseDto; user: UserProfile; name: string }[] };
    }) => {
        const isCloseFriendsSection = item.key === "__closeFriends";
        return (
            <View>
                {!isCloseFriendsSection && (
                    <View
                        style={{
                            paddingHorizontal: 16,
                            paddingVertical: 6,
                            backgroundColor: colors.background, // Match Zalo standard
                        }}
                    >
                        <Text
                            style={{
                                color: colors.text,
                                fontSize: 13,
                                fontWeight: "600",
                            }}
                        >
                            {item.key.toUpperCase()}
                        </Text>
                    </View>
                )}
                {item.data.map(({ raw }) => renderFriendRow(raw))}
            </View>
        );
    };

    const renderCloseFriendsBar = () => {
        if (closeFriendsCount === 0) return null;
        return (
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderBottomWidth: 0.5,
                    borderBottomColor: colors.border,
                    backgroundColor: colors.background,
                }}
            >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Ionicons name="star" size={18} color={"#eab308"} style={{ marginRight: 6 }} />
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>
                        Bạn thân
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={() => setAddToCloseFriendsVisible(true)}
                    style={{ paddingVertical: 4, paddingHorizontal: 8 }}
                >
                    <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "500" }}>
                        + Thêm
                    </Text>
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <View
                style={{
                    flex: 1,
                    backgroundColor: colors.background,
                }}
            >
                {error ? (
                    <TouchableOpacity
                        onPress={clearError}
                        style={{
                            paddingHorizontal: 16,
                            paddingVertical: 8,
                            backgroundColor: "#7f1d1d",
                        }}
                    >
                        <Text
                            style={{
                                color: "#fee2e2",
                                fontSize: 12,
                            }}
                        >
                            {error} (chạm để ẩn)
                        </Text>
                    </TouchableOpacity>
                ) : null}

                <View style={{ height: 6, backgroundColor: colors.separator }} />

                {renderCloseFriendsBar()}

                <View style={{ height: 1, backgroundColor: colors.separator }} />

                {loading && friends.length === 0 ? (
                    <View
                        style={{
                            flex: 1,
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <ActivityIndicator color={colors.primary} />
                        <Text
                            style={{
                                marginTop: 8,
                                color: colors.textSecondary,
                                fontSize: 13,
                            }}
                        >
                            Đang tải danh sách bạn bè...
                        </Text>
                    </View>
                ) : friends.length === 0 ? (
                    <View
                        style={{
                            flex: 1,
                            alignItems: "center",
                            justifyContent: "center",
                            paddingHorizontal: 32,
                        }}
                    >
                        <Ionicons
                            name="people-outline"
                            size={40}
                            color={colors.textSecondary}
                        />
                        <Text
                            style={{
                                marginTop: 12,
                                color: colors.text,
                                fontSize: 16,
                                fontWeight: "500",
                                textAlign: "center",
                            }}
                        >
                            Bạn chưa có bạn bè nào
                        </Text>
                        <Text
                            style={{
                                marginTop: 4,
                                color: colors.textSecondary,
                                fontSize: 13,
                                textAlign: "center",
                            }}
                        >
                            Hãy chuyển sang tab “Tìm bạn” để gửi lời mời kết bạn.
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        data={groupedFriends}
                        keyExtractor={(item) => item.key}
                        renderItem={renderSection}
                        contentContainerStyle={{ paddingBottom: 24 }}
                    />
                )}
                {/* Modal Thêm (từ swipe): avatar, toggle Bạn thân, Xem trang cá nhân, Quản lý chặn, Xóa bạn, Nhắn tin */}
                {actionSheetFriend && (
                    <Modal
                        transparent
                        visible
                        animationType="slide"
                        onRequestClose={() => setActionSheetFriend(null)}
                    >
                        <TouchableOpacity
                            activeOpacity={1}
                            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}
                            onPress={() => setActionSheetFriend(null)}
                        >
                            <TouchableOpacity activeOpacity={1} onPress={() => { }} style={{ backgroundColor: colors.modalBg, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 }}>
                                <View style={{ alignItems: "center", marginBottom: 12 }}>
                                    <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.background === "#000000" ? "#2a2a2a" : colors.searchBg, alignItems: "center", justifyContent: "center" }}>
                                        <Text style={{ color: colors.text, fontSize: 24, fontWeight: "600" }}>
                                            {(actionSheetFriend.displayName.charAt(0).toUpperCase() || "?").toUpperCase()}
                                        </Text>
                                    </View>
                                    <Text style={{ color: colors.text, fontSize: 17, fontWeight: "600", marginTop: 8 }}>
                                        {actionSheetFriend.displayName}
                                    </Text>
                                </View>
                                <View style={{ flexDirection: "row", marginBottom: 12 }}>
                                    <TouchableOpacity
                                        onPress={() => {
                                            const friend = actionSheetFriend;
                                            setActionSheetFriend(null);
                                            router.push({
                                                pathname: "/(tabs)/friend-profile",
                                                params: {
                                                    userId: friend.user.id,
                                                    displayName: friend.displayName,
                                                    avatarUrl: friend.user.avatarUrl || "",
                                                    businessDescription: friend.user.businessDescription || "",
                                                    statusMessage: friend.user.statusMessage || "",
                                                    phone: friend.user.phone || "",
                                                },
                                            } as any);
                                        }}
                                        style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: colors.background === "#000000" ? "#2a2a2a" : colors.searchBg, paddingVertical: 12, marginRight: 6, borderRadius: 10 }}
                                    >
                                        <Ionicons name="person-outline" size={18} color={colors.text} style={{ marginRight: 6 }} />
                                        <Text style={{ color: colors.text, fontSize: 14 }}>Xem trang cá nhân</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => {
                                            setBlockOptions({ blockMessages: false, blockCalls: false, blockTimeline: false });
                                            setBlockSheetFriend({ userId: actionSheetFriend.user.id, displayName: actionSheetFriend.displayName });
                                        }}
                                        style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: colors.background === "#000000" ? "#2a2a2a" : colors.searchBg, paddingVertical: 12, marginLeft: 6, borderRadius: 10 }}
                                    >
                                        <Ionicons name="ban-outline" size={18} color={colors.text} style={{ marginRight: 6 }} />
                                        <Text style={{ color: colors.text, fontSize: 14 }}>Quản lý chặn</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={{ borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 8 }}>
                                    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8 }}>
                                        <Ionicons name="person-outline" size={18} color={colors.textSecondary} style={{ marginRight: 10 }} />
                                        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Đã kết bạn</Text>
                                    </View>
                                    <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8 }}>
                                        <Ionicons name="people-outline" size={18} color={colors.textSecondary} style={{ marginRight: 10 }} />
                                        <Text style={{ flex: 1, color: colors.text, fontSize: 14 }}>Xem nhóm chung (0)</Text>
                                        <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8 }}>
                                        <Ionicons name="time-outline" size={18} color={colors.textSecondary} style={{ marginRight: 10 }} />
                                        <Text style={{ flex: 1, color: colors.text, fontSize: 14 }}>Xem nhật ký chung</Text>
                                        <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10 }}>
                                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                                            <Ionicons name="star-outline" size={18} color={colors.textSecondary} style={{ marginRight: 10 }} />
                                            <Text style={{ color: colors.text, fontSize: 14 }}>Đánh dấu bạn thân</Text>
                                        </View>
                                        <Switch
                                            value={!!(closeFriendCategoryId && friendCategoryMap[actionSheetFriend.user.id] === closeFriendCategoryId)}
                                            onValueChange={async (v) => {
                                                if (!closeFriendCategoryId) return;
                                                if (v) await handleAssignCategory(actionSheetFriend.user.id, closeFriendCategoryId);
                                                else await handleClearCategory(actionSheetFriend.user.id);
                                            }}
                                            trackColor={{ false: colors.searchBg, true: colors.primary }}
                                            thumbColor="#fff"
                                        />
                                    </View>
                                </View>
                                <View style={{ flexDirection: "row", marginTop: 16 }}>
                                    <TouchableOpacity
                                        onPress={() => {
                                            setActionSheetFriend(null);
                                            handleRemoveFriend(actionSheetFriend.user.id, actionSheetFriend.displayName);
                                        }}
                                        style={{ flex: 1, backgroundColor: colors.background === "#000000" ? "#2a2a2a" : colors.searchBg, paddingVertical: 12, borderRadius: 10, alignItems: "center", marginRight: 8 }}
                                    >
                                        <Text style={{ color: "#f97373", fontSize: 14, fontWeight: "500" }}>Xóa bạn</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => {
                                            const room = rooms.find((r) => r.type === "PRIVATE" && r.participants?.some((p) => p.id === actionSheetFriend.user.id));
                                            setActionSheetFriend(null);
                                            if (room) {
                                                router.push(`/chat/${room.id}?name=${encodeURIComponent(actionSheetFriend.displayName)}&type=DIRECT` as any);
                                            }
                                        }}
                                        style={{ flex: 1, backgroundColor: colors.primary, paddingVertical: 12, borderRadius: 10, alignItems: "center" }}
                                    >
                                        <Text style={{ color: "#fff", fontSize: 14, fontWeight: "500" }}>Nhắn tin</Text>
                                    </TouchableOpacity>
                                </View>
                            </TouchableOpacity>
                        </TouchableOpacity>
                    </Modal>
                )}

                {/* Sheet Quản lý chặn */}
                {blockSheetFriend && (
                    <Modal transparent visible animationType="slide" onRequestClose={() => setBlockSheetFriend(null)}>
                        <TouchableOpacity activeOpacity={1} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }} onPress={() => setBlockSheetFriend(null)}>
                            <TouchableOpacity activeOpacity={1} onPress={() => { }} style={{ backgroundColor: colors.modalBg, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 }}>
                                <Text style={{ color: colors.text, fontSize: 17, fontWeight: "600", marginBottom: 16 }}>
                                    Quản lý chặn {blockSheetFriend.displayName}
                                </Text>
                                <TouchableOpacity
                                    onPress={() => setBlockOptions((o) => ({ ...o, blockMessages: !o.blockMessages }))}
                                    style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border }}
                                >
                                    <Ionicons name="chatbubble-outline" size={20} color={colors.textSecondary} style={{ marginRight: 12 }} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ color: colors.text, fontSize: 14 }}>Chặn tin nhắn</Text>
                                        <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>Cả hai sẽ không thể nhắn tin cho nhau</Text>
                                    </View>
                                    {blockOptions.blockMessages ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} /> : <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border }} />}
                                </TouchableOpacity>
                                <TouchableOpacity
                                    activeOpacity={1}
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        paddingVertical: 12,
                                        borderBottomWidth: 0.5,
                                        borderBottomColor: colors.border,
                                        opacity: 0.4,
                                    }}
                                >
                                    <Ionicons name="call-outline" size={20} color={colors.textSecondary} style={{ marginRight: 12 }} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ color: colors.text, fontSize: 14 }}>Chặn cuộc gọi</Text>
                                        <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>Cả hai sẽ không thể gọi điện cho nhau</Text>
                                    </View>
                                    <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border }} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    activeOpacity={1}
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        paddingVertical: 12,
                                        borderBottomWidth: 0.5,
                                        borderBottomColor: colors.border,
                                        opacity: 0.4,
                                    }}
                                >
                                    <Ionicons name="time-outline" size={20} color={colors.textSecondary} style={{ marginRight: 12 }} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ color: colors.text, fontSize: 14 }}>Chặn và ẩn khỏi nhật ký</Text>
                                    </View>
                                    <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border }} />
                                </TouchableOpacity>
                                {(() => {
                                    // Nút Áp dụng chỉ active khi có thay đổi trạng thái "Chặn tin nhắn"
                                    const initialBlockMessages = initialBlockedByYou ?? false;
                                    const hasChange = blockOptions.blockMessages !== initialBlockMessages;
                                    const isBlockedNow = !!initialBlockedByYou;
                                    return (
                                        <TouchableOpacity
                                            onPress={async () => {
                                                if (!hasChange) {
                                                    return;
                                                }
                                                try {
                                                    const wantBlock = blockOptions.blockMessages;
                                                    // Nếu hiện tại chưa chặn và user chỉ bật các tùy chọn khác (call/timeline)
                                                    // mà KHÔNG bật "Chặn tin nhắn" -> không hỗ trợ, báo lỗi.
                                                    if (!isBlockedNow && !wantBlock) {
                                                        Alert.alert(
                                                            "Thông báo",
                                                            "Hiện tại chỉ hỗ trợ chặn tin nhắn."
                                                        );
                                                        return;
                                                    }
                                                    if (wantBlock && !isBlockedNow) {
                                                        // Chuyển từ chưa chặn -> chặn tin nhắn
                                                        await blockUser(blockSheetFriend.userId);
                                                        Alert.alert(
                                                            "Đã chặn",
                                                            "Người này đã bị chặn tin nhắn."
                                                        );
                                                    } else if (!wantBlock && isBlockedNow) {
                                                        // Chuyển từ đang chặn -> bỏ chặn tin nhắn
                                                        await unblockUser(blockSheetFriend.userId);
                                                    }
                                                    setBlockSheetFriend(null);
                                                    setActionSheetFriend(null);
                                                } catch (e) {
                                                    console.log("Error applying block:", e);
                                                    Alert.alert("Lỗi", "Không cập nhật được trạng thái chặn.");
                                                }
                                            }}
                                            activeOpacity={hasChange ? 0.8 : 1}
                                            style={{
                                                marginTop: 16,
                                                backgroundColor: hasChange
                                                    ? colors.primary
                                                    : colors.searchBg,
                                                paddingVertical: 14,
                                                borderRadius: 10,
                                                alignItems: "center",
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    color: hasChange
                                                        ? colors.text
                                                        : colors.textSecondary,
                                                    fontSize: 15,
                                                    fontWeight: "500",
                                                }}
                                            >
                                                Áp dụng
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })()}
                            </TouchableOpacity>
                        </TouchableOpacity>
                    </Modal>
                )}

                {/* Modal + Thêm (thêm vào Bạn thân) */}
                {addToCloseFriendsVisible && closeFriendCategoryId && (
                    <Modal transparent visible animationType="slide" onRequestClose={() => setAddToCloseFriendsVisible(false)}>
                        <TouchableOpacity activeOpacity={1} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }} onPress={() => setAddToCloseFriendsVisible(false)}>
                            <View style={{ backgroundColor: colors.modalBg, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24, maxHeight: "60%" }}>
                                <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600", marginBottom: 12 }}>Thêm vào Bạn thân</Text>
                                <ScrollView style={{ maxHeight: 320 }}>
                                    {friends
                                        .map((f) => getFriendUser(f, currentUser?.id))
                                        .filter((u) => friendCategoryMap[u.id] !== closeFriendCategoryId)
                                        .sort((a, b) => (a.displayName || a.username || "").localeCompare(b.displayName || b.username || "", "vi"))
                                        .map((u) => (
                                            <TouchableOpacity
                                                key={u.id}
                                                onPress={async () => {
                                                    await handleAssignCategory(u.id, closeFriendCategoryId);
                                                    setAddToCloseFriendsVisible(false);
                                                }}
                                                style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border }}
                                            >
                                                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.avatarBg, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                                                    <Text style={{ color: colors.text, fontWeight: "600", fontSize: 16 }}>
                                                        {((u.displayName || u.username || "?").charAt(0).toUpperCase() || "?").toUpperCase()}
                                                    </Text>
                                                </View>
                                                <Text style={{ color: colors.text, fontSize: 15 }} numberOfLines={1}>{u.displayName || u.username || "Người dùng"}</Text>
                                            </TouchableOpacity>
                                        ))}
                                </ScrollView>
                                <TouchableOpacity onPress={() => setAddToCloseFriendsVisible(false)} style={{ marginTop: 12, paddingVertical: 10 }}>
                                    <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: "center" }}>Đóng</Text>
                                </TouchableOpacity>
                            </View>
                        </TouchableOpacity>
                    </Modal>
                )}

                {/* Modal quản lý thẻ phân loại */}
                {manageCategoriesVisible && (
                    <Modal
                        transparent
                        visible
                        animationType="fade"
                        onRequestClose={() => setManageCategoriesVisible(false)}
                    >
                        <View
                            style={{
                                flex: 1,
                                backgroundColor: "rgba(0,0,0,0.6)",
                                justifyContent: "center",
                                alignItems: "center",
                                paddingHorizontal: 16,
                            }}
                        >
                            <View
                                style={{
                                    width: "100%",
                                    maxWidth: 420,
                                    backgroundColor: colors.background,
                                    borderRadius: 16,
                                    paddingHorizontal: 16,
                                    paddingVertical: 14,
                                }}
                            >
                                <View
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        marginBottom: 10,
                                    }}
                                >
                                    <Text
                                        style={{
                                            color: colors.text,
                                            fontSize: 16,
                                            fontWeight: "600",
                                        }}
                                    >
                                        Quản lý thẻ phân loại
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() =>
                                            setManageCategoriesVisible(false)
                                        }
                                    >
                                        <Ionicons
                                            name="close"
                                            size={20}
                                            color={colors.textSecondary}
                                        />
                                    </TouchableOpacity>
                                </View>

                                <View
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        marginBottom: 12,
                                    }}
                                >
                                    <TextInput
                                        placeholder="Thêm thẻ mới..."
                                        placeholderTextColor={
                                            colors.textSecondary
                                        }
                                        value={newCategoryName}
                                        onChangeText={setNewCategoryName}
                                        style={{
                                            flex: 1,
                                            height: 40,
                                            borderRadius: 999,
                                            borderWidth: 1,
                                            borderColor: colors.border,
                                            paddingHorizontal: 12,
                                            color: colors.text,
                                            fontSize: 14,
                                            marginRight: 8,
                                        }}
                                    />
                                    <TouchableOpacity
                                        onPress={handleAddCategory}
                                        style={{
                                            paddingHorizontal: 14,
                                            paddingVertical: 8,
                                            borderRadius: 999,
                                            backgroundColor: colors.primary,
                                        }}
                                    >
                                        <Text
                                            style={{
                                                color: "#fff",
                                                fontSize: 14,
                                                fontWeight: "500",
                                            }}
                                        >
                                            Thêm
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                <ScrollView
                                    style={{ maxHeight: 260 }}
                                    contentContainerStyle={{ paddingBottom: 4 }}
                                >
                                    {categories.map((c) => (
                                        <View
                                            key={c.id}
                                            style={{
                                                flexDirection: "row",
                                                alignItems: "center",
                                                paddingVertical: 8,
                                                borderBottomWidth: 0.5,
                                                borderBottomColor: colors.border,
                                            }}
                                        >
                                            <View
                                                style={{
                                                    width: 18,
                                                    height: 12,
                                                    borderRadius: 999,
                                                    backgroundColor: c.color,
                                                    marginRight: 10,
                                                }}
                                            />
                                            {editingCategoryId === c.id ? (
                                                <TextInput
                                                    value={editingCategoryName}
                                                    onChangeText={
                                                        setEditingCategoryName
                                                    }
                                                    style={{
                                                        flex: 1,
                                                        height: 36,
                                                        borderRadius: 8,
                                                        borderWidth: 1,
                                                        borderColor: colors.border,
                                                        paddingHorizontal: 10,
                                                        color: colors.text,
                                                        fontSize: 14,
                                                    }}
                                                />
                                            ) : (
                                                <Text
                                                    style={{
                                                        flex: 1,
                                                        color: colors.text,
                                                        fontSize: 14,
                                                    }}
                                                >
                                                    {c.name}
                                                </Text>
                                            )}

                                            {editingCategoryId === c.id ? (
                                                <>
                                                    <TouchableOpacity
                                                        onPress={
                                                            handleSaveEditCategory
                                                        }
                                                        style={{
                                                            paddingHorizontal: 10,
                                                            paddingVertical: 6,
                                                            borderRadius: 8,
                                                            backgroundColor:
                                                                "#22c55e",
                                                            marginLeft: 6,
                                                        }}
                                                    >
                                                        <Text
                                                            style={{
                                                                color: "#fff",
                                                                fontSize: 12,
                                                            }}
                                                        >
                                                            Lưu
                                                        </Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        onPress={() => {
                                                            setEditingCategoryId(
                                                                null
                                                            );
                                                            setEditingCategoryName(
                                                                ""
                                                            );
                                                        }}
                                                        style={{
                                                            paddingHorizontal: 10,
                                                            paddingVertical: 6,
                                                            borderRadius: 8,
                                                            borderWidth: 1,
                                                            borderColor: colors.border,
                                                            marginLeft: 6,
                                                        }}
                                                    >
                                                        <Text
                                                            style={{
                                                                color: colors.textSecondary,
                                                                fontSize: 12,
                                                            }}
                                                        >
                                                            Hủy
                                                        </Text>
                                                    </TouchableOpacity>
                                                </>
                                            ) : (
                                                <>
                                                    <TouchableOpacity
                                                        onPress={() => {
                                                            setEditingCategoryId(
                                                                c.id
                                                            );
                                                            setEditingCategoryName(
                                                                c.name
                                                            );
                                                        }}
                                                        style={{
                                                            paddingHorizontal: 10,
                                                            paddingVertical: 6,
                                                            borderRadius: 8,
                                                            borderWidth: 1,
                                                            borderColor: colors.border,
                                                            marginLeft: 6,
                                                        }}
                                                    >
                                                        <Text
                                                            style={{
                                                                color: colors.textSecondary,
                                                                fontSize: 12,
                                                            }}
                                                        >
                                                            Sửa
                                                        </Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        onPress={() =>
                                                            handleDeleteCategory(
                                                                c.id,
                                                                c.name
                                                            )
                                                        }
                                                        style={{
                                                            paddingHorizontal: 10,
                                                            paddingVertical: 6,
                                                            borderRadius: 8,
                                                            borderWidth: 1,
                                                            borderColor: "#fecaca",
                                                            marginLeft: 6,
                                                        }}
                                                    >
                                                        <Text
                                                            style={{
                                                                color: "#f97373",
                                                                fontSize: 12,
                                                            }}
                                                        >
                                                            Xóa
                                                        </Text>
                                                    </TouchableOpacity>
                                                </>
                                            )}
                                        </View>
                                    ))}
                                </ScrollView>

                                <TouchableOpacity
                                    onPress={() => setManageCategoriesVisible(false)}
                                    style={{
                                        marginTop: 10,
                                        paddingVertical: 10,
                                    }}
                                >
                                    <Text
                                        style={{
                                            color: colors.textSecondary,
                                            fontSize: 14,
                                            textAlign: "center",
                                        }}
                                    >
                                        Đóng
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Modal>
                )}
            </View>
        </GestureHandlerRootView>
    );
}

