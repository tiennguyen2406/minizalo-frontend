import React, { useEffect, useMemo } from "react";
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    ScrollView,
    Dimensions,
    Modal,
    Pressable,
    Alert,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { SafeView as SafeAreaView } from "@/shared/components/SafeView";
import { Ionicons } from "@expo/vector-icons";
import { ResizeMode, Video } from "expo-av";
import { useChatStore } from "@/shared/store/useChatStore";
import { useFriendStore } from "@/shared/store/friendStore";
import { usePostStore } from "@/shared/store/postStore";
import { useThemeColors } from "@/shared/theme/colors";
import { getImageUrl } from "@/shared/utils/mediaUtils";

const COVER_HEIGHT = 240;
const AVATAR_SIZE = 100;
const SCREEN_WIDTH = Dimensions.get("window").width;

interface FriendProfileScreenProps {
    userId: string;
    displayName: string;
    avatarUrl?: string | null;
    coverUrl?: string | null;
    businessDescription?: string;
    statusMessage?: string;
    phone?: string;
}

export default function FriendProfileScreen({
    userId,
    displayName,
    avatarUrl,
    coverUrl,
    businessDescription,
    statusMessage,
    phone,
}: FriendProfileScreenProps) {
    const router = useRouter();
    const { rooms } = useChatStore();
    const blockUser = useFriendStore((s) => s.blockUser);
    const removeFriend = useFriendStore((s) => s.removeFriend);
    const posts = usePostStore((s) => s.posts);
    const fetchPostFeed = usePostStore((s) => s.fetchFeed);
    const colors = useThemeColors();
    const [menuVisible, setMenuVisible] = React.useState(false);
    const avatarInitial = (displayName || "?").charAt(0).toUpperCase();
    const mediaTile = (SCREEN_WIDTH - 48) / 3;

    const commonGroups = useMemo(
        () => rooms.filter((r) => r.type === "GROUP" && r.participants?.some((p) => p.id === userId)),
        [rooms, userId],
    );

    const postMedia = useMemo(() => {
        return posts
            .filter((post) => post.userId === userId)
            .flatMap((post) => {
                const items = Array.isArray(post.mediaItems) && post.mediaItems.length > 0
                    ? post.mediaItems
                    : post.mediaUrl
                        ? [{ id: post.id, mediaUrl: post.mediaUrl, mediaType: post.mediaType, sortOrder: 0 }]
                        : [];
                return items
                    .filter((item) => item.mediaUrl && (item.mediaType === "IMAGE" || item.mediaType === "VIDEO"))
                    .map((item) => ({ ...item, postId: post.id }));
            });
    }, [posts, userId]);

    useEffect(() => {
        void fetchPostFeed({ silent: true });
    }, [fetchPostFeed]);

    const handleMessage = async () => {
        let room = rooms.find(
            (r) => r.type === "PRIVATE" && r.participants?.some((p) => p.id === userId),
        );

        if (!room) {
            try {
                room = await useChatStore.getState().createPrivateRoom(userId);
            } catch (error) {
                console.error("Failed to create room:", error);
                return;
            }
        }

        if (room) {
            router.push(`/chat/${room.id}?name=${encodeURIComponent(displayName)}&type=DIRECT` as any);
        }
    };

    const handleReport = () => {
        setMenuVisible(false);
        Alert.alert("Báo xấu", "Giao diện báo xấu đang được phát triển.");
    };

    const handleRecommend = () => {
        setMenuVisible(false);
        Alert.alert("Giới thiệu cho bạn", "Giao diện giới thiệu bạn bè đang được phát triển.");
    };

    const handleBlock = () => {
        setMenuVisible(false);
        Alert.alert(
            "Chặn liên hệ",
            `Bạn có chắc muốn chặn ${displayName}? Người này sẽ không thể nhắn tin cho bạn.`,
            [
                { text: "Hủy", style: "cancel" },
                {
                    text: "Chặn",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await blockUser(userId);
                            Alert.alert("Đã chặn", `Bạn đã chặn ${displayName}.`, [
                                { text: "OK", onPress: () => router.back() },
                            ]);
                        } catch {
                            Alert.alert("Lỗi", "Không thể chặn liên hệ này.");
                        }
                    },
                },
            ],
        );
    };

    const handleRemoveFriend = () => {
        setMenuVisible(false);
        Alert.alert(
            "Xóa bạn",
            `Xóa ${displayName} khỏi danh sách bạn bè?`,
            [
                { text: "Hủy", style: "cancel" },
                {
                    text: "Xóa",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await removeFriend(userId);
                            Alert.alert("Đã xóa", `Đã xóa ${displayName} khỏi danh sách bạn bè.`, [
                                { text: "OK", onPress: () => router.back() },
                            ]);
                        } catch {
                            Alert.alert("Lỗi", "Không thể xóa bạn lúc này.");
                        }
                    },
                },
            ],
        );
    };

    const MenuRow = ({
        icon,
        label,
        color = colors.text,
        onPress,
    }: {
        icon: keyof typeof Ionicons.glyphMap;
        label: string;
        color?: string;
        onPress: () => void;
    }) => (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.75}
            style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
                paddingHorizontal: 18,
                paddingVertical: 15,
            }}
        >
            <View
                style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.searchBg,
                }}
            >
                <Ionicons name={icon} size={19} color={color} />
            </View>
            <Text style={{ flex: 1, color, fontSize: 16, fontWeight: "500" }}>{label}</Text>
        </TouchableOpacity>
    );

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <StatusBar style={colors.statusBar} />

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} bounces={false}>
                <View style={{ height: COVER_HEIGHT + AVATAR_SIZE / 2, position: "relative" }}>
                    {coverUrl ? (
                        <Image
                            source={{ uri: `${coverUrl}?t=${Date.now()}` }}
                            style={{ height: COVER_HEIGHT, width: "100%" }}
                            resizeMode="cover"
                        />
                    ) : (
                        <View style={{ height: COVER_HEIGHT, width: "100%", backgroundColor: "#1a2a3a" }} />
                    )}

                    <SafeAreaView
                        edges={["top"]}
                        style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 }}
                    >
                        <View
                            style={{
                                height: 52,
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                                paddingHorizontal: 8,
                            }}
                        >
                            <TouchableOpacity
                                onPress={() => router.back()}
                                style={{ padding: 8 }}
                                activeOpacity={0.7}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name="chevron-back" size={28} color="#fff" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={{ padding: 8 }}
                                activeOpacity={0.7}
                                onPress={() => setMenuVisible(true)}
                            >
                                <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </SafeAreaView>

                    <View
                        style={{
                            position: "absolute",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            alignItems: "center",
                        }}
                    >
                        {avatarUrl ? (
                            <Image
                                source={{ uri: `${avatarUrl}?t=${Date.now()}` }}
                                style={{
                                    width: AVATAR_SIZE,
                                    height: AVATAR_SIZE,
                                    borderRadius: AVATAR_SIZE / 2,
                                    backgroundColor: colors.avatarBg,
                                    borderWidth: 4,
                                    borderColor: colors.background,
                                }}
                            />
                        ) : (
                            <View
                                style={{
                                    width: AVATAR_SIZE,
                                    height: AVATAR_SIZE,
                                    borderRadius: AVATAR_SIZE / 2,
                                    backgroundColor: colors.avatarBg,
                                    borderWidth: 4,
                                    borderColor: colors.background,
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <Text style={{ color: colors.text, fontSize: 38, fontWeight: "600" }}>
                                    {avatarInitial}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                <View style={{ alignItems: "center", paddingTop: 14, paddingHorizontal: 24 }}>
                    <Text style={{ fontSize: 22, fontWeight: "700", color: colors.text, textAlign: "center" }}>
                        {displayName}
                    </Text>

                    {businessDescription ? (
                        <Text
                            style={{
                                fontSize: 14,
                                color: colors.textSecondary,
                                marginTop: 6,
                                textAlign: "center",
                                lineHeight: 20,
                            }}
                        >
                            {businessDescription}
                        </Text>
                    ) : null}

                    {phone ? (
                        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, gap: 4 }}>
                            <Ionicons name="call-outline" size={14} color={colors.textSecondary} />
                            <Text style={{ fontSize: 13, color: colors.textSecondary }}>{phone}</Text>
                        </View>
                    ) : null}
                </View>

                <View style={{ height: 8, backgroundColor: colors.separator, marginTop: 20 }} />

                <View style={{ paddingHorizontal: 16, paddingVertical: 16 }}>
                    <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: 12 }}>
                        Thông tin
                    </Text>

                    {statusMessage ? (
                        <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 10 }}>
                            <Ionicons name="chatbubble-outline" size={16} color={colors.textSecondary} />
                            <Text style={{ color: colors.textSecondary, fontSize: 14, flex: 1 }}>
                                {statusMessage}
                            </Text>
                        </View>
                    ) : null}

                    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 10 }}>
                        <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
                        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Đã kết bạn</Text>
                    </View>

                    <TouchableOpacity
                        onPress={() => {}}
                        activeOpacity={0.75}
                        style={{
                            marginTop: 8,
                            borderWidth: 1,
                            borderColor: colors.border,
                            borderRadius: 14,
                            paddingHorizontal: 12,
                            paddingVertical: 12,
                            backgroundColor: colors.card,
                        }}
                    >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                            <View
                                style={{
                                    width: 34,
                                    height: 34,
                                    borderRadius: 17,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    backgroundColor: colors.searchBg,
                                }}
                            >
                                <Ionicons name="people-outline" size={18} color={colors.primary} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>
                                    Nhóm chung
                                </Text>
                                <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                                    {commonGroups.length > 0
                                        ? `${commonGroups.length} nhóm đang tham gia cùng nhau`
                                        : "Chưa có nhóm chung"}
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                        </View>

                        {commonGroups.length > 0 ? (
                            <View style={{ marginTop: 12, gap: 8 }}>
                                {commonGroups.slice(0, 3).map((group) => (
                                    <View key={group.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                                        <Image
                                            source={{
                                                uri:
                                                    group.avatarUrl ||
                                                    `https://ui-avatars.com/api/?name=${encodeURIComponent(group.name)}&background=0068ff&color=fff`,
                                            }}
                                            style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.avatarBg }}
                                        />
                                        <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontSize: 13 }}>
                                            {group.name}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        ) : null}
                    </TouchableOpacity>
                </View>

                <View style={{ height: 8, backgroundColor: colors.separator }} />

                <View style={{ paddingHorizontal: 16, paddingVertical: 16 }}>
                    <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: 12 }}>
                        Ảnh và video
                    </Text>
                    {postMedia.length > 0 ? (
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                            {postMedia.map((item, index) => {
                                const uri = getImageUrl(item.mediaUrl);
                                const isVideo = item.mediaType === "VIDEO";
                                return (
                                    <View
                                        key={`${item.postId}_${item.id || index}`}
                                        style={{
                                            width: mediaTile,
                                            height: mediaTile,
                                            borderRadius: 12,
                                            overflow: "hidden",
                                            backgroundColor: "#000",
                                        }}
                                    >
                                        {isVideo ? (
                                            <>
                                                <Video
                                                    source={{ uri }}
                                                    style={{ width: "100%", height: "100%" }}
                                                    resizeMode={ResizeMode.COVER}
                                                    shouldPlay={false}
                                                    isMuted
                                                />
                                                <View
                                                    style={{
                                                        position: "absolute",
                                                        top: 0,
                                                        left: 0,
                                                        right: 0,
                                                        bottom: 0,
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        backgroundColor: "rgba(0,0,0,0.18)",
                                                    }}
                                                >
                                                    <View
                                                        style={{
                                                            width: 36,
                                                            height: 36,
                                                            borderRadius: 18,
                                                            backgroundColor: "rgba(0,0,0,0.55)",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                        }}
                                                    >
                                                        <Ionicons name="play" size={18} color="#fff" style={{ marginLeft: 2 }} />
                                                    </View>
                                                </View>
                                            </>
                                        ) : (
                                            <Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    ) : (
                        <View
                            style={{
                                minHeight: 86,
                                borderRadius: 14,
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: colors.searchBg,
                            }}
                        >
                            <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                                Chưa có ảnh hoặc video đã đăng
                            </Text>
                        </View>
                    )}
                </View>

                <View style={{ height: 72 }} />
            </ScrollView>

            <SafeAreaView
                edges={["bottom"]}
                style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: colors.background,
                    borderTopWidth: 0.5,
                    borderTopColor: colors.border,
                }}
            >
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                    }}
                >
                    <TouchableOpacity
                        onPress={handleMessage}
                        activeOpacity={0.7}
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            backgroundColor: colors.searchBg,
                            borderRadius: 20,
                            paddingHorizontal: 18,
                            paddingVertical: 10,
                            gap: 8,
                        }}
                    >
                        <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.text} />
                        <Text style={{ color: colors.text, fontSize: 14, fontWeight: "500" }}>Nhắn tin</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            <Modal
                transparent
                visible={menuVisible}
                animationType="fade"
                onRequestClose={() => setMenuVisible(false)}
            >
                <Pressable
                    onPress={() => setMenuVisible(false)}
                    style={{
                        flex: 1,
                        backgroundColor: "rgba(0,0,0,0.38)",
                        justifyContent: "flex-end",
                    }}
                >
                    <Pressable
                        onPress={(e) => e.stopPropagation()}
                        style={{
                            backgroundColor: colors.card,
                            borderTopLeftRadius: 22,
                            borderTopRightRadius: 22,
                            paddingTop: 10,
                            paddingBottom: 12,
                        }}
                    >
                        <View
                            style={{
                                width: 42,
                                height: 4,
                                borderRadius: 2,
                                backgroundColor: colors.border,
                                alignSelf: "center",
                                marginBottom: 6,
                            }}
                        />
                        <View style={{ paddingHorizontal: 18, paddingVertical: 10 }}>
                            <Text style={{ color: colors.text, fontSize: 17, fontWeight: "700" }}>
                                {displayName}
                            </Text>
                            <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                                Tùy chọn liên hệ
                            </Text>
                        </View>
                        <MenuRow icon="flag-outline" label="Báo xấu" onPress={handleReport} />
                        <MenuRow icon="person-add-outline" label="Giới thiệu cho bạn" onPress={handleRecommend} />
                        <MenuRow icon="ban-outline" label="Chặn liên hệ này" color="#ef4444" onPress={handleBlock} />
                        <MenuRow icon="trash-outline" label="Xóa bạn" color="#ef4444" onPress={handleRemoveFriend} />
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
}
