import React, { useState, useEffect, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Image,
    Platform,
    Animated,
    Dimensions,
    Alert,
    Modal,
    Pressable,
} from "react-native";
import { SafeView as SafeAreaView } from "@/shared/components/SafeView";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import CreateGroupScreen from "./CreateGroupScreen";
import AddToGroupModal from "../components/AddToGroupModal";
import MediaStorageScreen from "./MediaStorageScreen";
import { chatService } from "@/shared/services/chatService";
import { useChatStore } from "@/shared/store/useChatStore";
import { setChatWallpaperUri } from "@/shared/utils/chatWallpaper";
import { useThemeColors } from "@/shared/theme/colors";
import { useRouter } from "expo-router";

const getImageUrl = (url: string) => {
    if (!url) return url;
    
    // Xử lý localhost
    if (url.includes("localhost") && process.env.EXPO_PUBLIC_API_URL) {
        const match = process.env.EXPO_PUBLIC_API_URL.match(/https?:\/\/([^:\/]+)/);
        if (match && match[1]) {
            return url.replace("localhost", match[1]);
        }
    }
    
    // Xử lý IP address local network (192.168.x.x, 10.x.x.x, 172.x.x.x)
    if (process.env.EXPO_PUBLIC_API_URL) {
        const apiMatch = process.env.EXPO_PUBLIC_API_URL.match(/https?:\/\/([^:\/]+)/);
        if (apiMatch && apiMatch[1]) {
            const apiHost = apiMatch[1];
            
            // Thay thế IP address trong URL ảnh bằng API host
            if (url.match(/https?:\/\/(192\.168\.|10\.|172\.)/)) {
                const urlMatch = url.match(/https?:\/\/([^:\/]+)/);
                if (urlMatch && urlMatch[1] !== apiHost) {
                    return url.replace(urlMatch[1], apiHost);
                }
            }
            
            // Thay thế port 9000 (MinIO default) với API port nếu cần
            if (url.includes(":9000") && !apiHost.includes(":9000")) {
                // Giữ nguyên port 9000 vì đây là MinIO server
                // Chỉ thay thế hostname
                const urlMatch = url.match(/https?:\/\/([^:]+):/);
                if (urlMatch && urlMatch[1] !== apiHost.split(':')[0]) {
                    return url.replace(urlMatch[1], apiHost.split(':')[0]);
                }
            }
        }
    }
    
    return url;
};

const SCREEN_WIDTH = Dimensions.get("window").width;

interface ChatOptionsScreenProps {
    roomId: string;
    name: string;
    avatarUrl?: string;
    partnerId?: string;
    type?: "DIRECT" | "GROUP";
    onClose: () => void;
}

/* ══════════════════════════ MAIN ══════════════════════════ */
export default function ChatOptionsScreen({ roomId, name, avatarUrl, partnerId, type = "DIRECT", onClose }: ChatOptionsScreenProps) {
    const router = useRouter();
    const colors = useThemeColors();
    const mutedRooms = useChatStore((s) => s.mutedRooms);
    const toggleMuteRoom = useChatStore((s) => s.toggleMuteRoom);
    const [showMuteDuration, setShowMuteDuration] = useState(false);
    const [selectedMuteDuration, setSelectedMuteDuration] = useState<string>("1h");
    const avatar = avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff`;

    const [bestFriend, setBestFriend] = useState(false);
    const [pinned, setPinned] = useState(false);
    const [hidden, setHidden] = useState(false);
    const [notifyCall, setNotifyCall] = useState(true);
    const [recentMedia, setRecentMedia] = useState<{ type: 'image' | 'file' | 'link', url: string }[]>([]);

    useFocusEffect(
        useCallback(() => {
            if (roomId && roomId !== "new") {
                useChatStore.getState().setCurrentRoom(roomId);
                return () => {
                    useChatStore.getState().setCurrentRoom(null);
                };
            }
            return () => {
                useChatStore.getState().setCurrentRoom(null);
            };
        }, [roomId]),
    );

    const pickChatWallpaper = useCallback(async () => {
        if (!roomId || roomId === "new") return;
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

    useEffect(() => {
        if (!roomId || roomId === "new") {
            setRecentMedia([]);
            return;
        }

        const fetchRecentMedia = async () => {
            try {
                const res = await chatService.getChatHistory(roomId, 50);
                const mediaItems: { type: 'image' | 'file' | 'link', url: string }[] = [];
                for (const msg of res.messages || []) {
                    if (msg.attachments && Array.isArray(msg.attachments)) {
                        for (const att of msg.attachments) {
                            const type = (att.type || "").toLowerCase();
                            if (type.startsWith("image") || type === "image") {
                                mediaItems.push({ type: 'image', url: att.url });
                            } else {
                                mediaItems.push({ type: 'file', url: att.url });
                            }
                            if (mediaItems.length >= 4) break;
                        }
                    }
                    if (mediaItems.length >= 4) break;

                    if (msg.content) {
                        const urlRegex = /(https?:\/\/[^\s]+)/g;
                        const matches = msg.content.match(urlRegex);
                        if (matches) {
                            for (const url of matches) {
                                mediaItems.push({ type: 'link', url });
                                if (mediaItems.length >= 4) break;
                            }
                        }
                    }
                    if (mediaItems.length >= 4) break;
                }
                setRecentMedia(mediaItems);
            } catch (error) {
                console.error("Error fetching recent media:", error);
            }
        };
        fetchRecentMedia();
    }, [roomId]);

    // ── Overlay: Tạo nhóm ──
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [createGroupSlide] = useState(new Animated.Value(SCREEN_WIDTH));

    const openCreateGroup = () => {
        setShowCreateGroup(true);
        Animated.timing(createGroupSlide, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
        }).start();
    };

    const closeCreateGroup = () => {
        Animated.timing(createGroupSlide, {
            toValue: SCREEN_WIDTH,
            duration: 250,
            useNativeDriver: true,
        }).start(() => setShowCreateGroup(false));
    };

    // ── Overlay: Media Storage ──
    const [showMediaStorage, setShowMediaStorage] = useState(false);
    const [mediaStorageSlide] = useState(new Animated.Value(SCREEN_WIDTH));

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

    // ── Modal: Thêm vào nhóm ──
    const [showAddToGroup, setShowAddToGroup] = useState(false);

    /* ────── Custom Sub-components that depend on `colors` ────── */
    const CustomSwitch = ({ value, onToggle }: { value: boolean; onToggle: () => void }) => (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onToggle}
            style={[
                { width: 44, height: 24, borderRadius: 12, justifyContent: "center" },
                { backgroundColor: value ? colors.primary : colors.separator },
            ]}
        >
            <View style={[
                { width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff" },
                { marginLeft: value ? 20 : 2 }
            ]} />
        </TouchableOpacity>
    );

    const OptionRow = ({
        icon,
        label,
        right,
        onPress,
        color = colors.text,
        desc,
        first,
    }: {
        icon: string;
        label: string;
        right?: React.ReactNode;
        onPress?: () => void;
        color?: string;
        desc?: string;
        first?: boolean;
    }) => (
        <TouchableOpacity
            activeOpacity={onPress ? 0.7 : 1}
            onPress={onPress}
            style={[
                { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingRight: 16 },
                !first && { borderTopWidth: 0.5, borderTopColor: colors.border },
            ]}
        >
            <Ionicons name={icon as any} size={24} color={color} style={{ width: 32 }} />
            <View style={{ flex: 1 }}>
                <Text style={[{ fontSize: 16 }, { color }]}>{label}</Text>
                {desc ? <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{desc}</Text> : null}
            </View>
            {right ?? null}
        </TouchableOpacity>
    );

    const Arrow = () => (
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    );

    const Section = ({ children }: { children: React.ReactNode }) => (
        <View style={{ backgroundColor: colors.card, borderTopWidth: 8, borderTopColor: colors.separator, paddingLeft: 16 }}>
            {children}
        </View>
    );

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <StatusBar style={colors.statusBar} />
            {/* Header */}
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
                                style={{ paddingRight: 8, paddingVertical: 4 }}
                                activeOpacity={0.7}
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

                        {/* Right: Actions (empty for options screen) */}
                        <View style={{ width: 24 }} />
                    </View>
                </SafeAreaView>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Profile */}
                <View style={[s.profile, { backgroundColor: colors.card }]}>
                    <Image source={{ uri: avatar }} style={s.avatar} />
                    <Text style={[s.nameText, { color: colors.text }]}>{name}</Text>

                    {/* 4 Action Buttons */}
                    <View style={s.actions}>
                        {[
                            {
                                icon: "search-outline",
                                text: "Tìm\ntin nhắn",
                                onPress: () =>
                                    router.push(
                                        `/search-messages?roomId=${roomId}&name=${encodeURIComponent(name)}&avatarUrl=${encodeURIComponent(avatarUrl || "")}&type=${encodeURIComponent(type)}`,
                                    ),
                            },
                            { icon: "person-outline", text: "Trang\ncá nhân", onPress: undefined },
                            { icon: "color-palette-outline", text: "Đổi\nhình nền", onPress: pickChatWallpaper },
                            {
                                icon: mutedRooms.has(String(roomId)) ? "notifications" : "notifications-off-outline",
                                text: mutedRooms.has(String(roomId)) ? "Bật\nthông báo" : "Tắt\nthông báo",
                                onPress: () => {
                                    if (!roomId || roomId === "new") return;
                                    if (mutedRooms.has(String(roomId))) {
                                        toggleMuteRoom(roomId);
                                    } else {
                                        setSelectedMuteDuration("1h");
                                        setShowMuteDuration(true);
                                    }
                                },
                            },
                        ].map((btn, i) => (
                            <TouchableOpacity key={i} style={s.actionBtn} onPress={btn.onPress ?? (() => {})}>
                                <View style={[s.actionCircle, { backgroundColor: colors.searchBg }]}>
                                    <Ionicons name={btn.icon as any} size={22} color={colors.text} />
                                </View>
                                <Text style={[s.actionLabel, { color: colors.textSecondary }]}>{btn.text}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Group 1 */}
                <Section>
                    <OptionRow icon="pencil-outline" label="Đổi tên gợi nhớ" right={<Arrow />} first />
                    <OptionRow
                        icon="star-outline"
                        label="Đánh dấu bạn thân"
                        right={<CustomSwitch value={bestFriend} onToggle={() => setBestFriend(v => !v)} />}
                    />
                    <OptionRow icon="time-outline" label="Nhật ký chung" right={<Arrow />} />
                </Section>

                {/* Bình chọn (chỉ nhóm) — tương tự web: tạo khảo sát trong hội thoại nhóm */}
                {type === "GROUP" && roomId && roomId !== "new" && (
                    <Section>
                        <OptionRow
                            first
                            icon="stats-chart-outline"
                            label="Tạo bình chọn"
                            desc="Tạo cuộc khảo sát, mọi thành viên đều tham gia bình chọn"
                            right={<Arrow />}
                            onPress={() =>
                                router.push(
                                    `/create-poll?roomId=${encodeURIComponent(roomId)}&groupName=${encodeURIComponent(name)}`,
                                )
                            }
                        />
                    </Section>
                )}

                {/* Group 2: Media */}
                <Section>
                    <OptionRow icon="images-outline" label="Ảnh, file, link" right={<Arrow />} onPress={openMediaStorage} first />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingBottom: 16, paddingRight: 16 }}>
                        {recentMedia.length > 0 ? (
                            recentMedia.map((m, i) => (
                                <View key={i} style={[s.mediaPH, { backgroundColor: colors.searchBg }]}>
                                    {m.type === 'image' ? (
                                        <Image source={{ uri: getImageUrl(m.url) }} style={{ width: 70, height: 70, borderRadius: 8 }} />
                                    ) : m.type === 'file' ? (
                                        <Ionicons name="document-text-outline" size={32} color={colors.text} />
                                    ) : (
                                        <Ionicons name="link-outline" size={32} color={colors.text} />
                                    )}
                                </View>
                            ))
                        ) : (
                            <View style={[s.mediaPH, { backgroundColor: colors.searchBg, justifyContent: 'center', alignItems: 'center' , marginTop:10}]}>
                                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Trống</Text>
                            </View>
                        )}
                        {recentMedia.length >= 4 && (
                            <TouchableOpacity style={[s.mediaPH, { backgroundColor: colors.searchBg }]} onPress={openMediaStorage}>
                                <Ionicons name="arrow-forward" size={24} color={colors.text} />
                            </TouchableOpacity>
                        )}
                    </ScrollView>
                </Section>

                {/* Group 3: Groups */}
                <Section>
                    <OptionRow
                        icon="people-circle-outline"
                        label={`Tạo nhóm với ${name}`}
                        right={<Arrow />}
                        onPress={partnerId ? openCreateGroup : undefined}
                        first
                    />
                    <OptionRow
                        icon="person-add-outline"
                        label={`Thêm ${name} vào nhóm`}
                        right={<Arrow />}
                        onPress={partnerId ? () => setShowAddToGroup(true) : undefined}
                    />
                    <OptionRow icon="people-outline" label="Xem nhóm chung (0)" right={<Arrow />} />
                </Section>

                {/* Group 5: Settings */}
                <Section>
                    <OptionRow icon="pin-outline" label="Ghim trò chuyện" right={<CustomSwitch value={pinned} onToggle={() => setPinned(v => !v)} />} first />
                    <OptionRow icon="eye-off-outline" label="Ẩn trò chuyện" right={<CustomSwitch value={hidden} onToggle={() => setHidden(v => !v)} />} />
                    <OptionRow icon="call-outline" label="Báo cuộc gọi đến" right={<CustomSwitch value={notifyCall} onToggle={() => setNotifyCall(v => !v)} />} />
                    <OptionRow icon="settings-outline" label="Cài đặt cá nhân" right={<Arrow />} />
                    <OptionRow icon="timer-outline" label="Tin nhắn tự xoá" desc="Không tự xoá" />
                </Section>

                {/* Group 5: Danger */}
                <Section>
                    <OptionRow icon="ban-outline" label="Quản lý chặn" right={<Arrow />} first />
                    <OptionRow icon="pie-chart-outline" label="Dung lượng trò chuyện" />
                    <OptionRow
                        icon="trash-outline"
                        label="Xóa lịch sử trò chuyện"
                        color="#ef4444"
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
                    />
                </Section>

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Tắt thông báo — cùng logic danh sách chat */}
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

            {/* Overlay: Tạo nhóm với person pre-selected */}
            {showCreateGroup && partnerId && (
                <Animated.View
                    style={{
                        position: "absolute",
                        top: 0, left: 0, right: 0, bottom: 0,
                        zIndex: 200,
                        transform: [{ translateX: createGroupSlide }],
                    }}
                >
                    <CreateGroupScreen
                        preSelectedIds={[partnerId]}
                        onClose={closeCreateGroup}
                    />
                </Animated.View>
            )}

            {/* Modal: Thêm vào nhóm */}
            {partnerId && (
                <AddToGroupModal
                    visible={showAddToGroup}
                    memberId={partnerId}
                    memberName={name}
                    onClose={() => setShowAddToGroup(false)}
                />
            )}

            {/* Overlay: Media Storage */}
            {showMediaStorage && (
                <Animated.View
                    style={{
                        position: "absolute",
                        top: 0, left: 0, right: 0, bottom: 0,
                        zIndex: 200,
                        transform: [{ translateX: mediaStorageSlide }],
                    }}
                >
                    <MediaStorageScreen
                        roomId={roomId}
                        onClose={closeMediaStorage}
                    />
                </Animated.View>
            )}

        </View>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
    },
    profile: { alignItems: "center", paddingVertical: 20 },
    avatar: { width: 90, height: 90, borderRadius: 45, marginBottom: 12 },
    nameText: { fontSize: 20, fontWeight: "bold", marginBottom: 20 },
    actions: { flexDirection: "row", justifyContent: "center", gap: 24, paddingHorizontal: 20 },
    actionBtn: { alignItems: "center" },
    actionCircle: {
        width: 48, height: 48, borderRadius: 24,
        justifyContent: "center", alignItems: "center", marginBottom: 8,
    },
    actionLabel: { fontSize: 12, textAlign: "center", lineHeight: 16 },
    mediaPH: {
        width: 70, height: 70, borderRadius: 8,
        marginRight: 8, justifyContent: "center", alignItems: "center",
    },
});
