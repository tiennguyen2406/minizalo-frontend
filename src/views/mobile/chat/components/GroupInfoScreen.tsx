import React, { useEffect, useState, useCallback } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    Image,
    ActivityIndicator,
    Platform,
    StatusBar as RNStatusBar,
    Alert,
    Switch,
    Modal,
    TextInput,
    FlatList,
    Pressable,
    Animated,
    Dimensions,
    StyleSheet,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { groupService } from "@/shared/services/groupService";
import { chatService } from "@/shared/services/chatService";
import { friendService } from "@/shared/services/friendService";
import { webSocketService } from "@/shared/services/WebSocketService";
import { isImageAttachment, isVideoAttachment } from "@/shared/utils/messageAttachments";
import { useAuthStore } from "@/shared/store/authStore";
import { useChatStore } from "@/shared/store/useChatStore";
import { GroupDetail } from "@/shared/types";
import { useThemeColors } from "@/shared/theme/colors";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import * as VideoThumbnails from "expo-video-thumbnails";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import { setChatWallpaperUri } from "@/shared/utils/chatWallpaper";
import useImagePicker from "@/shared/hooks/useImagePicker";
import MediaStorageScreen from "../screens/MediaStorageScreen";
import GroupSettingsScreen from "../screens/GroupSettingsScreen";
import GroupMembersScreen from "../screens/GroupMembersScreen";
import ReportAbuseModal from "@/shared/components/ReportAbuseModal";

const SCREEN_WIDTH = Dimensions.get("window").width;

function getWebJoinBaseUrl(): string {
    return (
        process.env.EXPO_PUBLIC_WEB_ORIGIN ||
        process.env.EXPO_PUBLIC_API_URL?.replace(/\/api\/?$/, "") ||
        ""
    ).replace(/\/$/, "");
}

function buildJoinConversationUrl(joinLinkToken?: string): string {
    const b = getWebJoinBaseUrl();
    return b && joinLinkToken ? `${b}/join/${encodeURIComponent(joinLinkToken)}` : "";
}

const getImageUrl = (url: string) => {
    if (!url) return url;
    if (url.includes("localhost") && process.env.EXPO_PUBLIC_API_URL) {
        const match = process.env.EXPO_PUBLIC_API_URL.match(/https?:\/\/([^:\/]+)/);
        if (match?.[1]) return url.replace("localhost", match[1]);
    }
    if (process.env.EXPO_PUBLIC_API_URL) {
        const apiMatch = process.env.EXPO_PUBLIC_API_URL.match(/https?:\/\/([^:\/]+)/);
        if (apiMatch?.[1]) {
            const apiHost = apiMatch[1];
            if (url.match(/https?:\/\/(192\.168\.|10\.|172\.)/)) {
                const urlMatch = url.match(/https?:\/\/([^:\/]+)/);
                if (urlMatch?.[1] && urlMatch[1] !== apiHost) return url.replace(urlMatch[1], apiHost);
            }
            if (url.includes(":9000") && !apiHost.includes(":9000")) {
                const urlMatch = url.match(/https?:\/\/([^:]+):/);
                if (urlMatch?.[1] && urlMatch[1] !== apiHost.split(":")[0]) {
                    return url.replace(urlMatch[1], apiHost.split(":")[0]);
                }
            }
        }
    }
    return url;
};

interface GroupInfoScreenProps {
    roomId: string;
    onClose: () => void;
}

// ─── Add Member Modal ───
interface Friend {
    id: string;
    username: string;
    fullName: string;
    avatarUrl?: string;
}

function AddMemberModal({
    visible,
    onClose,
    groupId,
    existingMemberIds,
    onMembersAdded,
}: {
    visible: boolean;
    onClose: () => void;
    groupId: string;
    existingMemberIds: string[];
    onMembersAdded: (newGroup: GroupDetail) => void;
}) {
    const colors = useThemeColors();
    const insets = useSafeAreaInsets();
    const [friends, setFriends] = useState<Friend[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!visible) return;
        setLoading(true);
        setSelectedIds([]);
        setSearchQuery("");
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
                    .filter((f) => !!f.id && !existingMemberIds.includes(f.id));
                setFriends(mapped);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [visible, existingMemberIds]);

    const filtered = friends.filter((f) => {
        const q = searchQuery.toLowerCase();
        return f.fullName.toLowerCase().includes(q) || f.username.toLowerCase().includes(q);
    });

    const toggleSelect = useCallback((id: string) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    }, []);

    const handleAdd = async () => {
        if (selectedIds.length === 0) return;
        setSubmitting(true);
        try {
            const updated = await groupService.addMembersToGroup(groupId, selectedIds);
            onMembersAdded(updated);
            onClose();
        } catch (err: any) {
            Alert.alert("Lỗi", err?.response?.data?.message || "Thêm thành viên thất bại.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle={Platform.OS === "ios" ? "fullScreen" : "pageSheet"}
            onRequestClose={onClose}
        >
            <View style={{ flex: 1, backgroundColor: colors.background }}>
                {/* fullScreen trên iOS: tránh pageSheet bo góc → khoảng tối hai bên; paddingTop = safe area */}
                <View style={{ backgroundColor: colors.headerBg, paddingTop: insets.top }}>
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 16,
                        minHeight: 52,
                        backgroundColor: colors.headerBg,
                        borderBottomWidth: colors.headerBg === "#0068FF" ? 0 : 0.5,
                        borderBottomColor: colors.border,
                        gap: 12,
                    }}
                >
                    <TouchableOpacity onPress={onClose} style={{ padding: 4, marginRight: 12 }}>
                        <Ionicons name="close" size={26} color={colors.headerText} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 17, fontWeight: "600", color: colors.headerText }}>
                            Thêm thành viên
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>
                            Đã chọn: {selectedIds.length}
                        </Text>
                    </View>
                    <TouchableOpacity
                        onPress={handleAdd}
                        disabled={selectedIds.length === 0 || submitting}
                        style={{
                            backgroundColor: selectedIds.length > 0 ? colors.primary : colors.separator,
                            paddingHorizontal: 16,
                            paddingVertical: 8,
                            borderRadius: 16,
                        }}
                    >
                        {submitting ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text
                                style={{
                                    color: selectedIds.length > 0 ? "#fff" : colors.textSecondary,
                                    fontWeight: "600",
                                    fontSize: 14,
                                }}
                            >
                                Thêm
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
                </View>

                {/* Search */}
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                        backgroundColor: colors.card,
                    }}
                >
                    <View style={{
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: colors.searchBg,
                        borderRadius: 10,
                        paddingHorizontal: 12,
                        height: 36,
                    }}>
                        <Ionicons name="search" size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
                        <TextInput
                            placeholder="Tìm tên bạn bè"
                            placeholderTextColor={colors.textSecondary}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            style={{ flex: 1, fontSize: 14, color: colors.text, paddingVertical: 0 }}
                        />
                    </View>
                </View>

                {/* List */}
                {loading ? (
                    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                ) : friends.length === 0 ? (
                    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 }}>
                        <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
                        <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 10, textAlign: "center" }}>
                            Tất cả bạn bè đã trong nhóm
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        data={filtered}
                        keyExtractor={(item) => item.id}
                        showsVerticalScrollIndicator={false}
                        renderItem={({ item }) => {
                            const isSelected = selectedIds.includes(item.id);
                            const avatar =
                                item.avatarUrl ||
                                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                    item.fullName || item.username
                                )}&background=0068FF&color=fff&bold=true`;
                            return (
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    onPress={() => toggleSelect(item.id)}
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
                                            width: 22,
                                            height: 22,
                                            borderRadius: 11,
                                            borderWidth: 2,
                                            borderColor: isSelected ? colors.primary : colors.textSecondary,
                                            backgroundColor: isSelected ? colors.primary : "transparent",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            marginRight: 12,
                                        }}
                                    >
                                        {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                                    </View>
                                    <Image
                                        source={{ uri: avatar }}
                                        style={{
                                            width: 44,
                                            height: 44,
                                            borderRadius: 22,
                                            marginRight: 12,
                                            backgroundColor: colors.separator,
                                        }}
                                    />
                                    <Text style={{ fontSize: 15, color: colors.text }} numberOfLines={1}>
                                        {item.fullName || item.username}
                                    </Text>
                                </TouchableOpacity>
                            );
                        }}
                    />
                )}
            </View>
        </Modal>
    );
}

// ─── Section Row Component ───
function SectionRow({
    icon,
    iconColor,
    label,
    subtitle,
    onPress,
    rightElement,
    showChevron = true,
}: {
    icon: string;
    iconColor?: string;
    label: string;
    subtitle?: string;
    onPress?: () => void;
    rightElement?: React.ReactNode;
    showChevron?: boolean;
}) {
    const colors = useThemeColors();
    return (
        <TouchableOpacity
            activeOpacity={onPress ? 0.7 : 1}
            onPress={onPress}
            style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderBottomWidth: 0.5,
                borderBottomColor: colors.border,
                backgroundColor: colors.card,
            }}
        >
            <Ionicons
                name={icon as any}
                size={22}
                color={iconColor || colors.textSecondary}
                style={{ marginRight: 14, width: 24, textAlign: "center" }}
            />
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, color: colors.text }}>{label}</Text>
                {subtitle && (
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{subtitle}</Text>
                )}
            </View>
            {rightElement}
            {showChevron && !rightElement && (
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            )}
        </TouchableOpacity>
    );
}

// ─── Main GroupInfoScreen ───
export default function GroupInfoScreen({ roomId, onClose }: GroupInfoScreenProps) {
    const router = useRouter();
    const colors = useThemeColors();
    const mutedRooms = useChatStore((s) => s.mutedRooms);
    const toggleMuteRoom = useChatStore((s) => s.toggleMuteRoom);
    const pinnedRooms = useChatStore((s) => s.pinnedRooms);
    const togglePinRoom = useChatStore((s) => s.togglePinRoom);
    const hiddenRooms = useChatStore((s) => s.hiddenRooms);
    const toggleHiddenRoom = useChatStore((s) => s.toggleHiddenRoom);
    const upsertRoom = useChatStore((s) => s.upsertRoom);
    const [group, setGroup] = useState<GroupDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [isLeaving, setIsLeaving] = useState(false);
    const [showAddMember, setShowAddMember] = useState(false);
    const [showRenameGroup, setShowRenameGroup] = useState(false);
    const [renameDraft, setRenameDraft] = useState("");
    const [renaming, setRenaming] = useState(false);
    const [showMuteDuration, setShowMuteDuration] = useState(false);
    const [selectedMuteDuration, setSelectedMuteDuration] = useState<string>("1h");
    const [showMediaStorage, setShowMediaStorage] = useState(false);
    const [mediaStorageSlide] = useState(() => new Animated.Value(SCREEN_WIDTH));
    const [showGroupSettings, setShowGroupSettings] = useState(false);
    const [groupSettingsSlide] = useState(() => new Animated.Value(SCREEN_WIDTH));
    const [showMembers, setShowMembers] = useState(false);
    const [membersPanelSlide] = useState(() => new Animated.Value(SCREEN_WIDTH));
    const [recentMedia, setRecentMedia] = useState<{ type: "image" | "video"; url: string }[]>([]);
    const [videoThumbByResolvedUrl, setVideoThumbByResolvedUrl] = useState<Record<string, string>>({});
    const [savingVisual, setSavingVisual] = useState<"avatar" | "wallpaper" | null>(null);
    const [showDescriptionModal, setShowDescriptionModal] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [descriptionDraft, setDescriptionDraft] = useState("");
    const [savingDescription, setSavingDescription] = useState(false);
    const avatarPicker = useImagePicker({ folder: "groups/avatars/", aspect: [1, 1], allowsEditing: true });
    const wallpaperPicker = useImagePicker({ folder: "groups/wallpapers/", aspect: [9, 16], allowsEditing: true });

    const currentUserId = useAuthStore.getState().user?.id;
    const isRoomHidden = hiddenRooms.has(String(roomId));
    const canEditCurrentGroupInfo = useCallback(() => {
        if (!group || !currentUserId) return false;
        const owner = String(group.ownerId) === String(currentUserId);
        const admin = group.members.some(
            (m) => String(m.userId) === String(currentUserId) && m.role === "ADMIN",
        );
        return owner || admin || group.settings?.allowMemberChangeName !== false;
    }, [group, currentUserId]);

    const openMediaStorage = () => {
        setShowMediaStorage(true);
        Animated.timing(mediaStorageSlide, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
        }).start();
    };

    const closeMediaStorage = () => {
        Animated.timing(mediaStorageSlide, {
            toValue: SCREEN_WIDTH,
            duration: 250,
            useNativeDriver: true,
        }).start(() => setShowMediaStorage(false));
    };

    const handleToggleHiddenConversation = () => {
        if (isRoomHidden) {
            toggleHiddenRoom(roomId);
            return;
        }
        Alert.alert(
            "Ẩn trò chuyện",
            "Cuộc trò chuyện sẽ không hiển thị trong danh sách. Bạn vẫn có thể tìm lại bằng tên nhóm.",
            [
                { text: "Hủy", style: "cancel" },
                {
                    text: "Ẩn",
                    onPress: () => {
                        toggleHiddenRoom(roomId);
                        onClose();
                    },
                },
            ],
        );
    };

    const openGroupSettings = () => {
        setShowGroupSettings(true);
        Animated.timing(groupSettingsSlide, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
        }).start();
    };

    const closeGroupSettings = () => {
        Animated.timing(groupSettingsSlide, {
            toValue: SCREEN_WIDTH,
            duration: 250,
            useNativeDriver: true,
        }).start(() => setShowGroupSettings(false));
    };

    const openMembersPanel = useCallback(() => {
        setShowMembers(true);
        membersPanelSlide.setValue(SCREEN_WIDTH);
        requestAnimationFrame(() => {
            Animated.timing(membersPanelSlide, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }).start();
        });
    }, [membersPanelSlide]);

    const closeMembersPanel = useCallback(() => {
        Animated.timing(membersPanelSlide, {
            toValue: SCREEN_WIDTH,
            duration: 250,
            useNativeDriver: true,
        }).start(() => setShowMembers(false));
    }, [membersPanelSlide]);

    /** Coi là đang “ở trong” phòng khi xem tuỳ chọn nhóm — không chặn thông báo khi chỉ ChatScreen bị blur phía dưới stack. */
    useFocusEffect(
        useCallback(() => {
            if (!roomId) return;
            useChatStore.getState().setCurrentRoom(roomId);
            return () => {
                useChatStore.getState().setCurrentRoom(null);
            };
        }, [roomId]),
    );

    const pickChatWallpaper = useCallback(async () => {
        if (!roomId) return;
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
            Alert.alert("Quyền truy cập", "Cần quyền thư viện ảnh để đặt hình nền.");
            return;
        }
        const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.85,
        });
        if (res.canceled || !res.assets?.[0]?.uri) return;
        await setChatWallpaperUri(roomId, res.assets[0].uri);
        Alert.alert("Đã lưu", "Hình nền chỉ hiển thị trên thiết bị của bạn.");
    }, [roomId]);

    const pickGroupAvatar = useCallback(async () => {
        if (!roomId || savingVisual) return;
        if (!canEditCurrentGroupInfo()) {
            Alert.alert("Quyền hạn", "Chỉ trưởng/phó nhóm được sửa thông tin nhóm.");
            return;
        }
        const asset = await avatarPicker.pickImage();
        if (!asset) return;
        setSavingVisual("avatar");
        try {
            const uploadedUrl = await avatarPicker.upload(asset);
            if (!uploadedUrl) throw new Error("Upload failed");
            const updated = await groupService.updateGroupAvatar(roomId, uploadedUrl);
            setGroup(updated);
            const r = useChatStore.getState().rooms.find((x) => String(x.id) === String(roomId));
            if (r) upsertRoom({ ...r, avatarUrl: updated.avatarUrl || uploadedUrl });
            Alert.alert("Ảnh nhóm đã được cập nhật.");
        } catch (err: any) {
            Alert.alert("Loi", err?.response?.data?.message || "Khong the cap nhat anh nhom.");
        } finally {
            setSavingVisual(null);
        }
    }, [roomId, savingVisual, canEditCurrentGroupInfo, avatarPicker, upsertRoom]);

    const pickSyncedChatWallpaper = useCallback(async () => {
        if (!roomId || savingVisual) return;
        if (!canEditCurrentGroupInfo()) {
            Alert.alert("Quyền hạn", "Chỉ trưởng/phó nhóm được sửa thông tin nhóm.");
            return;
        }
        const asset = await wallpaperPicker.pickImage();
        if (!asset) return;
        setSavingVisual("wallpaper");
        try {
            const uploadedUrl = await wallpaperPicker.upload(asset);
            if (!uploadedUrl) throw new Error("Upload failed");
            const updated = await groupService.updateGroupWallpaper(roomId, uploadedUrl);
            setGroup(updated);
            await setChatWallpaperUri(roomId, uploadedUrl);
            const r = useChatStore.getState().rooms.find((x) => String(x.id) === String(roomId));
            if (r) upsertRoom({ ...r, wallpaperUrl: updated.wallpaperUrl || uploadedUrl });
            Alert.alert("Hình nền đoạn chat đã được cập nhật.");
        } catch (err: any) {
            Alert.alert("Loi", err?.response?.data?.message || "Khong the cap nhat hinh nen.");
        } finally {
            setSavingVisual(null);
        }
    }, [roomId, savingVisual, canEditCurrentGroupInfo, wallpaperPicker, upsertRoom]);

    useEffect(() => {
        if (!roomId) return;
        setLoading(true);
        groupService
            .getGroupDetails(roomId)
            .then((detail) => setGroup(detail))
            .catch((err) => console.error("Error fetching group:", err))
            .finally(() => setLoading(false));
    }, [roomId]);

    useEffect(() => {
        if (!roomId) return;
        const settingsTopic = `/topic/chat/${roomId}/settings`;
        const onSettingsChanged = (stompMessage: { body: string }) => {
            try {
                const settings = JSON.parse(String(stompMessage.body || "{}"));
                setGroup((prev) => prev ? { ...prev, settings } : prev);
            } catch (err) {
                console.error("Error parsing group settings WS message:", err);
            }
        };

        webSocketService.subscribe(settingsTopic, onSettingsChanged);
        return () => webSocketService.unsubscribe(settingsTopic, onSettingsChanged);
    }, [roomId]);

    const fetchRecentMedia = useCallback(async () => {
        if (!roomId) return;
        try {
            const res = await chatService.getChatHistory(roomId, 120);
            const raw = res.messages || [];
            const msgs = [...raw].sort(
                (a: { createdAt?: string }, b: { createdAt?: string }) =>
                    new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
            );
            const items: { type: "image" | "video"; url: string }[] = [];
            for (const msg of msgs as Array<{
                attachments?: Array<{ url?: string; type?: string; name?: string }>;
                fileUrl?: string;
                type?: string;
                createdAt?: string;
            }>) {
                if (items.length >= 5) break;
                const attachments = msg.attachments;
                if (attachments?.length) {
                    for (const att of attachments) {
                        if (items.length >= 5) break;
                        const rawU = att.url?.trim();
                        if (!rawU) continue;
                        if (isVideoAttachment(att)) {
                            items.push({ type: "video", url: rawU });
                        } else if (isImageAttachment(att)) {
                            items.push({ type: "image", url: rawU });
                        }
                    }
                }
                if (items.length >= 5) break;
                const legacy = String(msg.fileUrl || "").trim();
                if (legacy && !attachments?.length) {
                    const pseudo = { url: legacy, type: msg.type };
                    if (isVideoAttachment(pseudo)) {
                        items.push({ type: "video", url: legacy });
                    } else if (isImageAttachment(pseudo)) {
                        items.push({ type: "image", url: legacy });
                    }
                }
            }
            setRecentMedia(items);
        } catch (e) {
            console.error("GroupInfo recent media:", e);
            setRecentMedia([]);
        }
    }, [roomId]);

    useEffect(() => {
        setVideoThumbByResolvedUrl({});
        void fetchRecentMedia();
    }, [fetchRecentMedia]);

    useFocusEffect(
        useCallback(() => {
            void fetchRecentMedia();
        }, [fetchRecentMedia]),
    );

    useEffect(() => {
        let cancelled = false;
        const videos = recentMedia.filter((m) => m.type === "video");
        if (videos.length === 0) {
            setVideoThumbByResolvedUrl({});
            return;
        }
        void (async () => {
            const merged: Record<string, string> = {};
            await Promise.all(
                videos.map(async (v) => {
                    const resolved = getImageUrl(v.url);
                    try {
                        const { uri } = await VideoThumbnails.getThumbnailAsync(resolved, {
                            time: 800,
                            quality: 0.55,
                        });
                        merged[resolved] = uri;
                    } catch {
                        /* Ảnh tĩnh từ URL video thường không load — chỉ báo lỗi im lặng */
                    }
                }),
            );
            if (!cancelled) setVideoThumbByResolvedUrl(merged);
        })();
        return () => {
            cancelled = true;
        };
    }, [recentMedia]);

    const isOwner =
        group != null && currentUserId != null && String(group.ownerId) === String(currentUserId);
    const currentUserRole = group?.members.find(
        (m) => currentUserId != null && String(m.userId) === String(currentUserId),
    )?.role;
    const isAdmin = currentUserRole === "ADMIN";
    const canManageMembers = isOwner || isAdmin;

    const performRemoveMember = async (memberId: string) => {
        try {
            const updated = await groupService.removeMembersFromGroup(roomId, [memberId]);
            setGroup(updated);
        } catch (err: any) {
            Alert.alert("Lỗi", err?.response?.data?.message || "Xóa thành viên thất bại.");
        }
    };

    const handleDisbandGroup = () => {
        Alert.alert("Giải tán nhóm", "Hành động này không thể hoàn tác. Tất cả thành viên và tin nhắn sẽ bị xóa. Bạn có chắc chắn muốn giải tán nhóm này?", [
            { text: "Hủy", style: "cancel" },
            {
                text: "Giải tán",
                style: "destructive",
                onPress: async () => {
                    setIsLeaving(true);
                    try {
                        await groupService.disbandGroup(roomId);
                        onClose();
                        router.replace("/(tabs)");
                    } catch (err: any) {
                        Alert.alert("Lỗi", err?.response?.data?.message || "Giải tán nhóm thất bại.");
                    } finally {
                        setIsLeaving(false);
                    }
                },
            },
        ]);
    };

    const handleLeaveGroup = () => {
        Alert.alert("Rời nhóm", "Bạn có chắc chắn muốn rời nhóm này?", [
            { text: "Hủy", style: "cancel" },
            {
                text: "Rời nhóm",
                style: "destructive",
                onPress: async () => {
                    setIsLeaving(true);
                    try {
                        await groupService.leaveGroup(roomId);
                        onClose();
                        router.replace("/(tabs)");
                    } catch (err: any) {
                        Alert.alert("Lỗi", err?.response?.data?.message || "Rời nhóm thất bại.");
                    } finally {
                        setIsLeaving(false);
                    }
                },
            },
        ]);
    };

    // ─── Loading / Error states ───
    if (loading || !group) {
        return (
            <SafeAreaView
                style={{
                    flex: 1,
                    backgroundColor: colors.background,
                    paddingTop: Platform.OS === "android" ? RNStatusBar.currentHeight : 0,
                }}
            >
                <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                    {loading ? (
                        <>
                            <ActivityIndicator size="large" color={colors.primary} />
                            <Text style={{ color: colors.textSecondary, marginTop: 8 }}>Đang tải...</Text>
                        </>
                    ) : (
                        <Text style={{ color: colors.textSecondary }}>Không tải được thông tin nhóm</Text>
                    )}
                </View>
            </SafeAreaView>
        );
    }

    const fallbackAvatarUri = `https://ui-avatars.com/api/?name=${encodeURIComponent(
        group.groupName
    )}&background=0068FF&color=fff&bold=true&size=120`;
    const avatarUri = group.avatarUrl ? getImageUrl(group.avatarUrl) : fallbackAvatarUri;

    const existingMemberIds = group.members.map((m) => m.userId);
    const joinInviteUrl = buildJoinConversationUrl(group?.settings?.joinLink);
    const isRoomPinned = pinnedRooms.has(String(roomId));
    const canOpenGroupSettings = canManageMembers;
    const canEditGroupInfo = canEditCurrentGroupInfo();

    const handleConfirmRenameGroup = async () => {
        if (!canEditCurrentGroupInfo()) {
            Alert.alert("Quyền hạn", "Chỉ trưởng/phó nhóm được sửa thông tin nhóm.");
            return;
        }
        const name = renameDraft.trim();
        if (!name) {
            Alert.alert("Tên nhóm", "Vui lòng nhập tên nhóm.");
            return;
        }
        if (name === group.groupName) {
            setShowRenameGroup(false);
            return;
        }
        setRenaming(true);
        try {
            const updated = await groupService.renameGroup(roomId, name);
            setGroup(updated);
            const r = useChatStore.getState().rooms.find((x) => String(x.id) === String(roomId));
            if (r) upsertRoom({ ...r, name });
            setShowRenameGroup(false);
        } catch (err: any) {
            Alert.alert("Lỗi", err?.response?.data?.message || "Đổi tên thất bại.");
        } finally {
            setRenaming(false);
        }
    };

    const openDescriptionEditor = () => {
        if (!canEditCurrentGroupInfo()) {
            Alert.alert("Quyền hạn", "Chỉ trưởng/phó nhóm được sửa thông tin nhóm.");
            return;
        }
        setDescriptionDraft(group.description || "");
        setShowDescriptionModal(true);
    };

    const handleSaveDescription = async () => {
        if (!roomId || savingDescription) return;
        if (!canEditCurrentGroupInfo()) {
            Alert.alert("Quyền hạn", "Chỉ trưởng/phó nhóm được sửa thông tin nhóm.");
            return;
        }
        setSavingDescription(true);
        try {
            const updated = await groupService.updateGroupDescription(roomId, descriptionDraft.trim());
            setGroup(updated);
            const r = useChatStore.getState().rooms.find((x) => String(x.id) === String(roomId));
            if (r) upsertRoom({ ...r, description: updated.description });
            setShowDescriptionModal(false);
            Alert.alert("Da luu", "Mo ta nhom da duoc cap nhat.");
        } catch (err: any) {
            Alert.alert("Loi", err?.response?.data?.message || "Khong the luu mo ta nhom.");
        } finally {
            setSavingDescription(false);
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <StatusBar style={colors.statusBar} />
            {/* ── Header (giống ChatOptionsScreen – màu xanh phủ tận status bar) ── */}
            <View style={{ backgroundColor: colors.headerBg }}>
                <SafeAreaView edges={["top"]}>
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            paddingHorizontal: 16,
                            height: 52,
                            borderBottomWidth: colors.headerBg === "#0068FF" ? 0 : 0.5,
                            borderBottomColor: colors.border,
                        }}
                    >
                        {/* Left: Back & Title */}
                        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                            <TouchableOpacity
                                onPress={onClose}
                                activeOpacity={0.7}
                                style={{ paddingRight: 8, paddingVertical: 4 }}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name="chevron-back" size={26} color={colors.headerText} />
                            </TouchableOpacity>
                            <View style={{ flex: 1 }}>
                                <Text
                                    style={{ color: colors.headerText, fontSize: 17, fontWeight: "600" }}
                                    numberOfLines={1}
                                >
                                    Tuỳ chọn
                                </Text>
                                <Text style={{ color: colors.headerText, fontSize: 11, opacity: 0.7 }}>
                                    Cài đặt trò chuyện
                                </Text>
                            </View>
                        </View>

                        {/* Right: placeholder */}
                        <View style={{ width: 24 }} />
                    </View>
                </SafeAreaView>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 40 }}
            >
                {/* ── Avatar + Group Name ── */}
                <View style={{ alignItems: "center", paddingVertical: 28, backgroundColor: colors.card }}>
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => void pickGroupAvatar()}
                        disabled={savingVisual !== null || !canEditGroupInfo}
                        style={{ position: "relative", marginBottom: 12, opacity: canEditGroupInfo ? 1 : 0.65 }}
                    >
                        <Image
                            source={{ uri: avatarUri }}
                            style={{ width: 80, height: 80, borderRadius: 40 }}
                        />
                        <View
                            style={{
                                position: "absolute",
                                bottom: 0,
                                right: 0,
                                width: 26,
                                height: 26,
                                borderRadius: 13,
                                backgroundColor: colors.searchBg,
                                alignItems: "center",
                                justifyContent: "center",
                                borderWidth: 2,
                                borderColor: colors.card,
                            }}
                        >
                            {savingVisual === "avatar" ? (
                                <ActivityIndicator size="small" color={colors.primary} />
                            ) : (
                                <Ionicons name="camera" size={13} color={colors.textSecondary} />
                            )}
                        </View>
                    </TouchableOpacity>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>
                            {group.groupName}
                        </Text>
                        <TouchableOpacity
                            activeOpacity={0.6}
                            onPress={() => {
                                if (!canEditGroupInfo) {
                                    Alert.alert("Quyền hạn", "Chỉ trưởng/phó nhóm được sửa thông tin nhóm.");
                                    return;
                                }
                                setRenameDraft(group.groupName);
                                setShowRenameGroup(true);
                            }}
                            disabled={!canEditGroupInfo}
                        >
                            <Ionicons name="pencil-outline" size={16} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ── Quick Actions Row ── */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{
                        flexDirection: "row",
                        alignItems: "flex-start",
                        paddingHorizontal: 14,
                        paddingBottom: 20,
                        gap: 12,
                    }}
                    style={{
                        borderBottomWidth: 6,
                        borderBottomColor: colors.separator,
                        backgroundColor: colors.card,
                    }}
                >
                    {[
                        {
                            icon: "search",
                            label: "Tìm\ntin nhắn",
                            onPress: () =>
                                router.push(
                                    `/search-messages?roomId=${roomId}&name=${encodeURIComponent(group.groupName)}&avatarUrl=${encodeURIComponent(avatarUri)}&type=GROUP`,
                                ),
                        },
                        { icon: "person-add-outline", label: "Thêm\nthành viên", onPress: () => setShowAddMember(true) },
                        {
                            icon: isRoomPinned ? "pin" : "pin-outline",
                            label: isRoomPinned ? "Bỏ\nghim" : "Ghim\nhội thoại",
                            onPress: () => togglePinRoom(roomId),
                        },
                        {
                            icon: "color-palette-outline",
                            label: "Đổi\nhình nền",
                            onPress: () => void pickSyncedChatWallpaper(),
                            disabled: !canEditGroupInfo,
                        },
                        {
                            icon: mutedRooms.has(String(roomId)) ? "notifications" : "notifications-outline",
                            label: mutedRooms.has(String(roomId)) ? "Bật\nthông báo" : "Tắt\nthông báo",
                            onPress: () => {
                                if (mutedRooms.has(String(roomId))) {
                                    toggleMuteRoom(roomId);
                                } else {
                                    setSelectedMuteDuration("1h");
                                    setShowMuteDuration(true);
                                }
                            },
                        },
                    ].map((item, idx) => (
                        <TouchableOpacity
                            key={idx}
                            activeOpacity={0.7}
                            onPress={item.onPress ?? (() => {})}
                            disabled={(item as any).disabled}
                            style={{ alignItems: "center", width: 72, opacity: (item as any).disabled ? 0.45 : 1 }}
                        >
                            <View
                                style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: 22,
                                    backgroundColor: colors.searchBg,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    marginBottom: 6,
                                }}
                            >
                                <Ionicons name={item.icon as any} size={20} color={colors.text} />
                            </View>
                            <Text
                                style={{
                                    fontSize: 11,
                                    color: colors.textSecondary,
                                    textAlign: "center",
                                    lineHeight: 15,
                                }}
                            >
                                {item.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* ── Sections ── */}
                <View style={{ marginTop: 4 }}>
                    <SectionRow
                        icon="information-circle-outline"
                        onPress={canEditGroupInfo ? openDescriptionEditor : undefined}
                        subtitle={group.description || undefined}
                        label="Thêm mô tả nhóm"
                    />
                </View>

                <View style={{ height: 6, backgroundColor: colors.separator }} />

                <SectionRow icon="images-outline" label="Ảnh, file, link" onPress={openMediaStorage} />

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ backgroundColor: colors.card }}
                    contentContainerStyle={{ paddingBottom: 16, paddingLeft: 16, paddingRight: 16, gap: 10 }}
                >
                    {recentMedia.length > 0 ? (
                        <>
                            {recentMedia.map((m, i) => {
                                const resolved = getImageUrl(m.url);
                                const videoThumb =
                                    m.type === "video" ? videoThumbByResolvedUrl[resolved] : undefined;
                                return (
                                    <TouchableOpacity
                                        key={`${m.url}-${i}`}
                                        activeOpacity={0.85}
                                        onPress={openMediaStorage}
                                        style={{
                                            width: 82,
                                            height: 82,
                                            borderRadius: 12,
                                            overflow: "hidden",
                                            backgroundColor: colors.searchBg,
                                            justifyContent: "center",
                                            alignItems: "center",
                                            borderWidth: 1,
                                            borderColor: colors.border,
                                        }}
                                    >
                                        {m.type === "video" ? (
                                            videoThumb ? (
                                                <>
                                                    <Image
                                                        source={{ uri: videoThumb }}
                                                        style={{ width: 82, height: 82 }}
                                                        resizeMode="cover"
                                                    />
                                                    <View
                                                        style={{
                                                            ...StyleSheet.absoluteFillObject,
                                                            backgroundColor: "rgba(0,0,0,0.35)",
                                                            justifyContent: "center",
                                                            alignItems: "center",
                                                        }}
                                                    >
                                                        <Ionicons name="play-circle" size={36} color="#fff" />
                                                    </View>
                                                </>
                                            ) : (
                                                <View
                                                    style={{
                                                        width: 82,
                                                        height: 82,
                                                        justifyContent: "center",
                                                        alignItems: "center",
                                                    }}
                                                >
                                                    <ActivityIndicator size="small" color={colors.primary} />
                                                </View>
                                            )
                                        ) : (
                                            <Image
                                                source={{ uri: resolved }}
                                                style={{ width: 82, height: 82, borderRadius: 12 }}
                                                resizeMode="cover"
                                            />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                            {recentMedia.length >= 5 ? (
                                <TouchableOpacity
                                    onPress={openMediaStorage}
                                    style={{
                                        width: 82,
                                        height: 82,
                                        borderRadius: 12,
                                        backgroundColor: colors.searchBg,
                                        justifyContent: "center",
                                        alignItems: "center",
                                        borderWidth: 1,
                                        borderColor: colors.border,
                                    }}
                                >
                                    <Ionicons name="arrow-forward" size={24} color={colors.text} />
                                </TouchableOpacity>
                            ) : null}
                        </>
                    ) : (
                        <View
                            style={{
                                width: 82,
                                height: 82,
                                borderRadius: 12,
                                backgroundColor: colors.searchBg,
                                justifyContent: "center",
                                alignItems: "center",
                            }}
                        >
                            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Trống</Text>
                        </View>
                    )}
                </ScrollView>

                <View style={{ height: 6, backgroundColor: colors.separator }} />

                <SectionRow icon="calendar-outline" label="Lịch nhóm" />
                <SectionRow icon="pin-outline" label="Tin nhắn đã ghim" />
                <SectionRow
                    icon="bar-chart-outline"
                    label="Bình chọn"
                    subtitle="Tạo cuộc khảo sát cho cả nhóm"
                    onPress={() => {
                        const isOwnerOrAdmin = canManageMembers;
                        const allow = group.settings?.allowMemberCreatePoll;
                        if (!isOwnerOrAdmin && allow === false) {
                            Alert.alert("Bình chọn", "Chỉ trưởng/phó nhóm được tạo bình chọn.");
                            return;
                        }
                        router.push(
                            `/create-poll?roomId=${encodeURIComponent(roomId)}&groupName=${encodeURIComponent(group.groupName)}`,
                        );
                    }}
                />

                {canOpenGroupSettings ? (
                    <>
                        <SectionRow icon="settings-outline" label="Cài đặt nhóm" onPress={openGroupSettings} />
                    </>
                ) : null}

                <View style={{ height: 6, backgroundColor: colors.separator }} />

                <SectionRow
                    icon="people-outline"
                    label={
                        canManageMembers
                            ? `Quản lý thành viên (${group.members.length})`
                            : `Thành viên (${group.members.length})`
                    }
                    onPress={openMembersPanel}
                />
                <SectionRow
                    icon="link-outline"
                    label="Link tham gia nhóm"
                    subtitle={
                        joinInviteUrl
                            ? joinInviteUrl.replace(/^https?:\/\//, "")
                            : "Cấu hình EXPO_PUBLIC_WEB_ORIGIN (hoặc API) để tạo link"
                    }
                    onPress={async () => {
                        if (!joinInviteUrl) {
                            Alert.alert(
                                "Link tham gia",
                                "Thêm biến EXPO_PUBLIC_WEB_ORIGIN trong .env trỏ tới trang web của app (ví dụ https://app.example.com), hoặc dùng API URL để tự suy ra.",
                            );
                            return;
                        }
                        try {
                            await Clipboard.setStringAsync(joinInviteUrl);
                            Alert.alert("Đã sao chép", "Link tham gia nhóm đã được sao chép vào bộ nhớ.");
                        } catch {
                            Alert.alert("Lỗi", "Không thể sao chép.");
                        }
                    }}
                />

                <View style={{ height: 6, backgroundColor: colors.separator }} />

                <SectionRow
                    icon="pin-outline"
                    label="Ghim trò chuyện"
                    showChevron={false}
                    rightElement={
                        <Switch
                            value={isRoomPinned}
                            onValueChange={() => togglePinRoom(roomId)}
                            trackColor={{ false: colors.separator, true: colors.primary }}
                            thumbColor="#fff"
                        />
                    }
                />
                <SectionRow
                    icon="eye-off-outline"
                    label="Ẩn trò chuyện"
                    showChevron={false}
                    rightElement={
                        <Switch
                            value={isRoomHidden}
                            onValueChange={handleToggleHiddenConversation}
                            trackColor={{ false: colors.separator, true: colors.primary }}
                            thumbColor="#fff"
                        />
                    }
                />

                <View style={{ height: 6, backgroundColor: colors.separator }} />

                {/* ── Danger zone ── */}
                <SectionRow
                    icon="alert-circle-outline"
                    label="Báo xấu"
                    showChevron={false}
                    onPress={() => setShowReportModal(true)}
                />
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                        Alert.alert(
                            "Xác nhận",
                            "Toàn bộ nội dung trò chuyện sẽ bị xóa. Bạn có chắc chắn muốn xóa?",
                            [
                                { text: "Hủy", style: "cancel" },
                                {
                                    text: "Xóa",
                                    style: "destructive",
                                    onPress: async () => {
                                        await useChatStore.getState().clearConversation(roomId);
                                        onClose();
                                    },
                                },
                            ]
                        );
                    }}
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        borderBottomWidth: 0.5,
                        borderBottomColor: colors.border,
                        backgroundColor: colors.card,
                    }}
                >
                    <Ionicons
                        name="trash-outline"
                        size={22}
                        color="#ef4444"
                        style={{ marginRight: 14, width: 24, textAlign: "center" as const }}
                    />
                    <Text style={{ fontSize: 15, color: "#ef4444" }}>Xóa lịch sử trò chuyện</Text>
                </TouchableOpacity>

                {isOwner ? (
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={handleDisbandGroup}
                        disabled={isLeaving}
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingHorizontal: 16,
                            paddingVertical: 14,
                            backgroundColor: colors.card,
                            opacity: isLeaving ? 0.5 : 1,
                        }}
                    >
                        <Ionicons
                            name="trash-bin-outline"
                            size={22}
                            color="#ef4444"
                            style={{ marginRight: 14, width: 24, textAlign: "center" as const }}
                        />
                        <Text style={{ fontSize: 15, color: "#ef4444" }}>
                            {isLeaving ? "Đang giải tán..." : "Giải tán nhóm"}
                        </Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={handleLeaveGroup}
                        disabled={isLeaving}
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingHorizontal: 16,
                            paddingVertical: 14,
                            backgroundColor: colors.card,
                            opacity: isLeaving ? 0.5 : 1,
                        }}
                    >
                        <Ionicons
                            name="log-out-outline"
                            size={22}
                            color="#ef4444"
                            style={{ marginRight: 14, width: 24, textAlign: "center" as const }}
                        />
                        <Text style={{ fontSize: 15, color: "#ef4444" }}>
                            {isLeaving ? "Đang rời..." : "Rời nhóm"}
                        </Text>
                    </TouchableOpacity>
                )}
            </ScrollView>

            <Modal
                transparent
                animationType="fade"
                visible={showMuteDuration}
                onRequestClose={() => setShowMuteDuration(false)}
            >
                <Pressable
                    style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center" }}
                    onPress={() => setShowMuteDuration(false)}
                >
                    <Pressable
                        style={{
                            backgroundColor: colors.card,
                            borderRadius: 20,
                            paddingTop: 20,
                            paddingBottom: 14,
                            width: "82%",
                            borderWidth: 1,
                            borderColor: colors.border,
                        }}
                        onPress={(e) => e.stopPropagation()}
                    >
                        <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700", paddingHorizontal: 20, marginBottom: 6 }}>
                            Tắt thông báo
                        </Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 13, paddingHorizontal: 20, marginBottom: 14 }}>
                            Bạn sẽ không nhận thông báo từ hội thoại này trong:
                        </Text>
                        {(
                            [
                                { id: "1h", label: "Trong 1 giờ" },
                                { id: "4h", label: "Trong 4 giờ" },
                                { id: "8am", label: "Cho đến 8:00 AM" },
                                { id: "forever", label: "Cho đến khi được mở lại" },
                            ] as const
                        ).map((opt) => (
                            <TouchableOpacity
                                key={opt.id}
                                onPress={() => setSelectedMuteDuration(opt.id)}
                                style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12, gap: 12 }}
                            >
                                <View
                                    style={{
                                        width: 20,
                                        height: 20,
                                        borderRadius: 10,
                                        borderWidth: 2,
                                        borderColor: selectedMuteDuration === opt.id ? colors.primary : colors.border,
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    {selectedMuteDuration === opt.id ? (
                                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} />
                                    ) : null}
                                </View>
                                <Text style={{ color: colors.text, fontSize: 14, fontWeight: "500" }}>{opt.label}</Text>
                            </TouchableOpacity>
                        ))}
                        <View
                            style={{
                                flexDirection: "row",
                                justifyContent: "flex-end",
                                gap: 12,
                                paddingHorizontal: 20,
                                paddingTop: 10,
                                borderTopWidth: 1,
                                borderTopColor: colors.border,
                                marginTop: 6,
                            }}
                        >
                            <TouchableOpacity
                                onPress={() => setShowMuteDuration(false)}
                                style={{ paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.border }}
                            >
                                <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>Hủy</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => {
                                    if (!mutedRooms.has(String(roomId))) toggleMuteRoom(roomId);
                                    setShowMuteDuration(false);
                                }}
                                style={{ paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.primary }}
                            >
                                <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>Đồng ý</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>

            <Modal
                transparent
                animationType="fade"
                visible={showRenameGroup}
                onRequestClose={() => !renaming && setShowRenameGroup(false)}
            >
                <Pressable
                    style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center" }}
                    onPress={() => !renaming && setShowRenameGroup(false)}
                >
                    <Pressable
                        style={{
                            backgroundColor: colors.card,
                            borderRadius: 16,
                            paddingTop: 18,
                            paddingBottom: 14,
                            width: "85%",
                            maxWidth: 360,
                            borderWidth: 1,
                            borderColor: colors.border,
                        }}
                        onPress={(e) => e.stopPropagation()}
                    >
                        <Text style={{ color: colors.text, fontSize: 17, fontWeight: "700", paddingHorizontal: 18, marginBottom: 12 }}>
                            Đổi tên nhóm
                        </Text>
                        <TextInput
                            value={renameDraft}
                            onChangeText={setRenameDraft}
                            placeholder="Tên nhóm"
                            placeholderTextColor={colors.textSecondary}
                            editable={!renaming}
                            style={{
                                marginHorizontal: 16,
                                borderWidth: 1,
                                borderColor: colors.border,
                                borderRadius: 10,
                                paddingHorizontal: 12,
                                paddingVertical: 10,
                                fontSize: 16,
                                color: colors.text,
                                backgroundColor: colors.searchBg,
                            }}
                        />
                        <View
                            style={{
                                flexDirection: "row",
                                justifyContent: "flex-end",
                                gap: 12,
                                paddingHorizontal: 16,
                                paddingTop: 16,
                            }}
                        >
                            <TouchableOpacity
                                onPress={() => !renaming && setShowRenameGroup(false)}
                                style={{ paddingHorizontal: 16, paddingVertical: 10 }}
                            >
                                <Text style={{ color: colors.textSecondary, fontSize: 16, fontWeight: "600" }}>Hủy</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => void handleConfirmRenameGroup()}
                                disabled={renaming}
                                style={{
                                    paddingHorizontal: 16,
                                    paddingVertical: 10,
                                    opacity: renaming ? 0.5 : 1,
                                }}
                            >
                                {renaming ? (
                                    <ActivityIndicator size="small" color={colors.primary} />
                                ) : (
                                    <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "700" }}>Lưu</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* Overlay: Ảnh, file, link (giống tuỳ chọn chat 1-1) */}
            <Modal
                transparent
                animationType="fade"
                visible={showDescriptionModal}
                onRequestClose={() => !savingDescription && setShowDescriptionModal(false)}
            >
                <Pressable
                    style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center" }}
                    onPress={() => !savingDescription && setShowDescriptionModal(false)}
                >
                    <Pressable
                        style={{
                            backgroundColor: colors.card,
                            borderRadius: 16,
                            paddingTop: 18,
                            paddingBottom: 14,
                            width: "88%",
                            maxWidth: 380,
                            borderWidth: 1,
                            borderColor: colors.border,
                        }}
                        onPress={(e) => e.stopPropagation()}
                    >
                        <Text style={{ color: colors.text, fontSize: 17, fontWeight: "700", paddingHorizontal: 18, marginBottom: 12 }}>
                            Mô tả nhóm
                        </Text>
                        <TextInput
                            value={descriptionDraft}
                            onChangeText={setDescriptionDraft}
                            placeholder="Nhập mô tả cho nhóm"
                            placeholderTextColor={colors.textSecondary}
                            editable={!savingDescription}
                            multiline
                            maxLength={1000}
                            style={{
                                marginHorizontal: 16,
                                minHeight: 110,
                                maxHeight: 180,
                                borderWidth: 1,
                                borderColor: colors.border,
                                borderRadius: 12,
                                paddingHorizontal: 12,
                                paddingVertical: 10,
                                fontSize: 15,
                                color: colors.text,
                                backgroundColor: colors.searchBg,
                                textAlignVertical: "top",
                            }}
                        />
                        <Text style={{ color: colors.textSecondary, fontSize: 12, textAlign: "right", paddingHorizontal: 18, marginTop: 6 }}>
                            {descriptionDraft.length}/1000
                        </Text>
                        <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12, paddingHorizontal: 16, paddingTop: 12 }}>
                            <TouchableOpacity onPress={() => !savingDescription && setShowDescriptionModal(false)} style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                                <Text style={{ color: colors.textSecondary, fontSize: 16, fontWeight: "600" }}>Hủy</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => void handleSaveDescription()} disabled={savingDescription} style={{ paddingHorizontal: 16, paddingVertical: 10, opacity: savingDescription ? 0.5 : 1 }}>
                                {savingDescription ? (
                                    <ActivityIndicator size="small" color={colors.primary} />
                                ) : (
                                    <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "700" }}>Lưu</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>

            {showMediaStorage && (
                <Animated.View
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 200,
                        transform: [{ translateX: mediaStorageSlide }],
                    }}
                >
                    <MediaStorageScreen roomId={roomId} onClose={closeMediaStorage} />
                </Animated.View>
            )}

            {/* Overlay: Cài đặt nhóm (chỉ chủ nhóm mở được) */}
            {showGroupSettings && group && (
                <Animated.View
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 210,
                        transform: [{ translateX: groupSettingsSlide }],
                    }}
                >
                    <GroupSettingsScreen
                        groupId={roomId}
                        groupName={group.groupName}
                        members={group.members}
                        ownerId={group.ownerId}
                        onClose={closeGroupSettings}
                        onOpenMembers={() => {
                            closeGroupSettings();
                            setTimeout(() => openMembersPanel(), 280);
                        }}
                        onDisband={handleDisbandGroup}
                        onRefreshGroup={() =>
                            groupService.getGroupDetails(roomId).then((d) => setGroup(d)).catch(() => {})
                        }
                    />
                </Animated.View>
            )}

            <ReportAbuseModal
                visible={showReportModal}
                onClose={() => setShowReportModal(false)}
                targetType="GROUP"
                targetId={roomId}
                subjectLabel={group?.groupName || "Nhóm"}
                onSuccess={() =>
                    Alert.alert("Đã gửi báo cáo", "Yêu cầu của bạn đã được chuyển tới bộ phận kiểm duyệt.")
                }
            />

            {/* ── Add Member Modal ── */}
            <AddMemberModal
                visible={showAddMember}
                onClose={() => setShowAddMember(false)}
                groupId={roomId}
                existingMemberIds={existingMemberIds}
                onMembersAdded={(updated) => setGroup(updated)}
            />

            {/* Overlay: Thành viên / quản lý thành viên */}
            {showMembers && group ? (
                <Animated.View
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 215,
                        transform: [{ translateX: membersPanelSlide }],
                    }}
                >
                    <GroupMembersScreen
                        group={group}
                        currentUserId={currentUserId}
                        canManage={canManageMembers}
                        onClose={closeMembersPanel}
                        onRequestAddMember={() => setTimeout(() => setShowAddMember(true), 220)}
                        onRemoveMember={(id) => {
                            void performRemoveMember(id);
                        }}
                    />
                </Animated.View>
            ) : null}
        </View>
    );
}
