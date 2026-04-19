import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    Keyboard,
    Pressable,
    Image,
} from "react-native";
import { SafeView as SafeAreaView } from "@/shared/components/SafeView";
import { useRouter } from "expo-router";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/shared/theme/colors";
import { searchService } from "@/shared/services/searchService";
import { useFriendStore } from "@/shared/store/friendStore";
import { useUserStore } from "@/shared/store/userStore";
import type { UserProfile } from "@/shared/services/types";
import UserActionModal from "@/shared/components/UserActionModal";
import { useChatStore } from "@/shared/store/useChatStore";

type SearchUsersMobileProps = {
    initialQuery?: string;
    autoFocus?: boolean;
    onBack?: () => void;
};

export default function SearchUsersMobile({
    initialQuery = "",
    autoFocus = false,
    onBack,
}: SearchUsersMobileProps) {
    const router = useRouter();
    const navigation = useNavigation();
    const colors = useThemeColors();
    const [query, setQuery] = useState(initialQuery);
    const [results, setResults] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { sendRequest, friends, sentRequests } = useFriendStore();
    const { profile } = useUserStore();
    const { rooms } = useChatStore();

    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    const [modalVisible, setModalVisible] = useState(false);

    const currentUserId = profile?.id ?? null;
    const inputRef = useRef<TextInput | null>(null);

    const friendIdSet = useMemo(() => {
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

    // Tập userId mà mình đang gửi lời mời (PENDING) dựa trên sentRequests trong store
    const pendingRequestIdSet = useMemo(() => {
        const set = new Set<string>();
        if (!currentUserId) return set;
        sentRequests.forEach((fr) => {
            // Với lời mời mình gửi: user = currentUser, friend = người nhận
            if (fr.user.id === currentUserId) {
                set.add(fr.friend.id);
            }
        });
        return set;
    }, [sentRequests, currentUserId]);

    const runSearch = async (value: string) => {
        const q = value.trim();
        if (!q) {
            setResults([]);
            setError(null);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const users = await searchService.searchUsers(q);
            setResults(users);
        } catch (e: any) {
            const data = e?.response?.data;
            if (typeof data === "string") {
                setError(data);
            } else if (data && typeof data.message === "string") {
                setError(data.message);
            } else {
                setError("Không tìm kiếm được người dùng.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        await runSearch(query);
    };

    const handleSendRequest = async (userId: string) => {
        // Đã là bạn hoặc đã có lời mời đang chờ thì không gửi thêm
        if (friendIdSet.has(userId) || pendingRequestIdSet.has(userId)) return;
        try {
            await sendRequest(userId);
            Alert.alert("Thành công", "Đã gửi lời mời kết bạn.");
        } catch {
            Alert.alert("Lỗi", "Gửi lời mời kết bạn thất bại.");
        }
    };

    // Khi có initialQuery (từ thanh tìm kiếm chính), set lại query để effect bên dưới xử lý
    useEffect(() => {
        if (initialQuery.trim()) {
            setQuery(initialQuery);
        }
    }, [initialQuery]);

    // Tìm kiếm "theo từng ký tự" với debounce ngắn
    useEffect(() => {
        const q = query.trim();
        if (!q) {
            setResults([]);
            setError(null);
            return;
        }
        const timeoutId = setTimeout(() => {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            runSearch(q);
        }, 350); // debounce ~0.35s

        return () => clearTimeout(timeoutId);
    }, [query]);

    // Tự focus ô tìm kiếm khi màn này được hiển thị (khi autoFocus = true)
    useFocusEffect(
        useCallback(() => {
            if (autoFocus && inputRef.current) {
                // nhỏ delay để đảm bảo navigation đã hoàn tất trước khi focus
                const id = setTimeout(() => {
                    inputRef.current?.focus();
                }, 80);
                return () => clearTimeout(id);
            }
            return () => { };
        }, [autoFocus])
    );

    const renderItem = ({ item }: { item: UserProfile }) => {
        const displayName = item.displayName || item.username || "Người dùng";
        const initial =
            (displayName.charAt(0).toUpperCase() || "?").toUpperCase();
        const isSelf = currentUserId === item.id;
        const alreadyFriend = friendIdSet.has(item.id);
        const isRequested = pendingRequestIdSet.has(item.id);
        const disabled = isSelf || isRequested || alreadyFriend;
        const label = isSelf
            ? ""
            : alreadyFriend
                ? "Đã là bạn"
                : isRequested
                    ? "Đã gửi"
                    : "Kết bạn";

        return (
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  setSelectedUser(item);
                  setModalVisible(true);
                }}
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderBottomWidth: 0.5,
                    borderBottomColor: colors.border,
                    backgroundColor: colors.background,
                }}
            >
                <View
                    style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: colors.searchBg,
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 12,
                        overflow: "hidden",
                    }}
                >
                    {item.avatarUrl ? (
                        <Image
                            source={{ uri: `${item.avatarUrl}?t=${Date.now()}` }}
                            style={{ width: 40, height: 40 }}
                        />
                    ) : (
                        <Text
                            style={{
                                color: colors.text,
                                fontWeight: "600",
                                fontSize: 16,
                            }}
                        >
                            {initial}
                        </Text>
                    )}
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
                    {item.phone ? (
                        <Text
                            numberOfLines={1}
                            style={{
                                color: colors.textSecondary,
                                fontSize: 12,
                                marginTop: 2,
                            }}
                        >
                            {item.phone}
                        </Text>
                    ) : item.statusMessage ? (
                        <Text
                            numberOfLines={1}
                            style={{
                                color: colors.textSecondary,
                                fontSize: 12,
                                marginTop: 2,
                            }}
                        >
                            {item.statusMessage}
                        </Text>
                    ) : null}
                </View>
                {!isSelf && (
                    <TouchableOpacity
                        disabled={disabled}
                        onPress={() => handleSendRequest(item.id)}
                        style={{
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: disabled
                                ? colors.border
                                : colors.primary,
                            backgroundColor: disabled ? colors.searchBg : "transparent",
                            marginLeft: 8,
                        }}
                    >
                        <Text
                            style={{
                                color: disabled
                                    ? colors.textSecondary
                                    : colors.primary,
                                fontSize: 12,
                                fontWeight: "500",
                            }}
                        >
                            {label}
                        </Text>
                    </TouchableOpacity>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <View
            style={{
                flex: 1,
                backgroundColor: colors.background,
            }}
        >
            <SafeAreaView style={{ backgroundColor: colors.headerBg }} edges={["top"]}>
                {/* Header tìm kiếm */}
                <View
                    style={{
                        paddingHorizontal: 16,
                        height: 52,
                        borderBottomWidth: colors.headerBg.startsWith("#00") ? 0 : 0.5,
                        borderBottomColor: colors.border,
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: colors.headerBg,
                        gap: 12,
                    }}
                >
                    <Pressable
                        onPress={() => {
                            Keyboard.dismiss();
                            try {
                                if (onBack) {
                                    onBack();
                                } else {
                                    router.back();
                                }
                            } catch (e) {
                                router.replace("/(tabs)/");
                            }
                        }}
                        style={({ pressed }) => ({
                            padding: 12,
                            opacity: pressed ? 0.5 : 1,
                            justifyContent: 'center',
                            alignItems: 'center',
                            zIndex: 999,
                        })}
                        hitSlop={50}
                    >
                        <Ionicons name="chevron-back" size={28} color={colors.headerText} />
                    </Pressable>

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
                            style={{ marginRight: 6 }}
                        />
                    <TextInput
                        ref={inputRef}
                        value={query}
                        onChangeText={setQuery}
                        placeholder="Nhập tên, số điện thoại hoặc email..."
                        placeholderTextColor={colors.headerIcon}
                        style={{
                            flex: 1,
                            color: colors.headerText,
                            fontSize: 15,
                            paddingVertical: 0,
                        }}
                        autoFocus={autoFocus}
                        onSubmitEditing={handleSubmit}
                        returnKeyType="search"
                    />
                        {query ? (
                            <TouchableOpacity
                                onPress={() => setQuery("")}
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
                </View>
            </SafeAreaView>

            {error ? (
                <View
                    style={{
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        backgroundColor: colors.background === "#ffffff" ? "#fee2e2" : "#7f1d1d",
                    }}
                >
                    <Text
                        style={{
                            color: colors.background === "#ffffff" ? "#b91c1c" : "#fee2e2",
                            fontSize: 12,
                        }}
                    >
                        {error}
                    </Text>
                </View>
            ) : null}

            {loading && results.length === 0 ? (
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
                        Đang tìm kiếm người dùng...
                    </Text>
                </View>
            ) : results.length === 0 ? (
                <View
                    style={{
                        flex: 1,
                        alignItems: "center",
                        justifyContent: "center",
                        paddingHorizontal: 32,
                    }}
                >
                    <Ionicons
                        name="person-add-outline"
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
                        Nhập thông tin và bấm “Tìm” để bắt đầu.
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={results}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingBottom: 24 }}
                />
            )}

            <UserActionModal 
              visible={modalVisible}
              user={selectedUser}
              isFriend={selectedUser ? friendIdSet.has(selectedUser.id) : false}
              isSentRequest={selectedUser ? pendingRequestIdSet.has(selectedUser.id) : false}
              onClose={() => setModalVisible(false)}
              onViewProfile={(u) => {
                router.push({
                    pathname: "/(tabs)/friend-profile",
                    params: {
                        userId: u.id,
                        displayName: u.displayName || u.username,
                        avatarUrl: u.avatarUrl || "",
                        coverPhotoUrl: u.coverPhotoUrl || "",
                        businessDescription: u.businessDescription || "",
                        statusMessage: u.statusMessage || "",
                        phone: u.phone || "",
                    },
                } as any);
              }}
              onMessage={(u) => {
                // Đóng modal trước
                setModalVisible(false);

                // Tìm ID của người lạ/bạn trong danh bạ (u.id)
                const isFriend = friendIdSet.has(u.id);
                const existingRoom = rooms.find(r =>
                    r.type === 'PRIVATE' &&
                    r.participants.some(p => p.id === u.id)
                );
                
                if (existingRoom) {
                    router.push({
                        pathname: "/chat/[id]",
                        params: { 
                            id: existingRoom.id,
                            name: u.displayName || u.username,
                            type: 'DIRECT',
                            isStranger: isFriend ? "false" : "true",
                            targetUserId: u.id // LUÔN TRUYỀN ID CỦA ĐỐI PHƯƠNG
                        }
                    } as any);
                } else {
                    router.push({
                        pathname: "/chat/[id]",
                        params: { 
                            id: "new", 
                            targetUserId: u.id,
                            name: u.displayName || u.username,
                            type: 'DIRECT',
                            avatarUrl: u.avatarUrl || "",
                            isStranger: isFriend ? "false" : "true"
                        }
                    } as any);
                }
              }}
              onAddFriend={(u) => {
                handleSendRequest(u.id);
              }}
            />
        </View>
    );
}

