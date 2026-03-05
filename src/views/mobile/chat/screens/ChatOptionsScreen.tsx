import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Image,
    SafeAreaView,
    Platform,
    StatusBar,
    Animated,
    Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CreateGroupScreen from "./CreateGroupScreen";
import AddToGroupModal from "../components/AddToGroupModal";
import MediaStorageScreen from "./MediaStorageScreen";
import { chatService } from "@/shared/services/chatService";

const getImageUrl = (url: string) => {
    if (!url) return url;
    if (url.includes("localhost") && process.env.EXPO_PUBLIC_API_URL) {
        const match = process.env.EXPO_PUBLIC_API_URL.match(/https?:\/\/([^:\/]+)/);
        if (match && match[1]) {
            return url.replace("localhost", match[1]);
        }
    }
    return url;
};

const SCREEN_WIDTH = Dimensions.get("window").width;

const COLORS = {
    bg: "#1a1a1a",
    card: "#1a1a1a",
    text: "#fff",
    textSecondary: "#aaa",
    border: "#262626",
    blue: "#3b82f6",
    trackOff: "#3f3f46",
    red: "#ef4444",
};

interface ChatOptionsScreenProps {
    roomId: string;
    name: string;
    avatarUrl?: string;
    partnerId?: string;
    onClose: () => void;
}

/* ────── Custom Switch ────── */
const CustomSwitch = ({ value, onToggle }: { value: boolean; onToggle: () => void }) => (
    <TouchableOpacity
        activeOpacity={0.8}
        onPress={onToggle}
        style={[
            sw.track,
            { backgroundColor: value ? COLORS.blue : COLORS.trackOff },
        ]}
    >
        <View style={[sw.thumb, { marginLeft: value ? 20 : 2 }]} />
    </TouchableOpacity>
);

const sw = StyleSheet.create({
    track: { width: 44, height: 24, borderRadius: 12, justifyContent: "center" },
    thumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff" },
});

/* ────── Option Row ────── */
const OptionRow = ({
    icon,
    label,
    right,
    onPress,
    color = COLORS.text,
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
            s.row,
            !first && { borderTopWidth: 0.5, borderTopColor: COLORS.border },
        ]}
    >
        <Ionicons name={icon as any} size={24} color={color} style={{ width: 32 }} />
        <View style={{ flex: 1 }}>
            <Text style={[s.rowLabel, { color }]}>{label}</Text>
            {desc ? <Text style={s.rowDesc}>{desc}</Text> : null}
        </View>
        {right ?? null}
    </TouchableOpacity>
);

const Arrow = () => (
    <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
);

/* ────── Section ────── */
const Section = ({ children }: { children: React.ReactNode }) => (
    <View style={s.section}>{children}</View>
);

/* ══════════════════════════ MAIN ══════════════════════════ */
export default function ChatOptionsScreen({ roomId, name, avatarUrl, partnerId, onClose }: ChatOptionsScreenProps) {
    const avatar = avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff`;

    const [bestFriend, setBestFriend] = useState(false);
    const [pinned, setPinned] = useState(false);
    const [hidden, setHidden] = useState(false);
    const [notifyCall, setNotifyCall] = useState(true);
    const [recentMedia, setRecentMedia] = useState<{ type: 'image' | 'file' | 'link', url: string }[]>([]);

    useEffect(() => {
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

    return (
        <SafeAreaView style={s.container}>
            {/* Header */}
            <View style={s.header}>
                <TouchableOpacity onPress={onClose} style={s.backBtn}>
                    <Ionicons name="chevron-back" size={28} color="white" />
                </TouchableOpacity>
                <Text style={s.headerTitle}>Tuỳ chọn</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Profile */}
                <View style={s.profile}>
                    <Image source={{ uri: avatar }} style={s.avatar} />
                    <Text style={s.nameText}>{name}</Text>

                    {/* 4 Action Buttons */}
                    <View style={s.actions}>
                        {[
                            { icon: "search-outline", text: "Tìm\ntin nhắn" },
                            { icon: "person-outline", text: "Trang\ncá nhân" },
                            { icon: "color-palette-outline", text: "Đổi\nhình nền" },
                            { icon: "notifications-off-outline", text: "Tắt\nthông báo" },
                        ].map((btn, i) => (
                            <TouchableOpacity key={i} style={s.actionBtn}>
                                <View style={s.actionCircle}>
                                    <Ionicons name={btn.icon as any} size={22} color={COLORS.text} />
                                </View>
                                <Text style={s.actionLabel}>{btn.text}</Text>
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

                {/* Group 2: Media */}
                <Section>
                    <OptionRow icon="images-outline" label="Ảnh, file, link" right={<Arrow />} onPress={openMediaStorage} first />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingBottom: 16, paddingRight: 16 }}>
                        {recentMedia.length > 0 ? (
                            recentMedia.map((m, i) => (
                                <View key={i} style={s.mediaPH}>
                                    {m.type === 'image' ? (
                                        <Image source={{ uri: getImageUrl(m.url) }} style={{ width: 70, height: 70, borderRadius: 8 }} />
                                    ) : m.type === 'file' ? (
                                        <Ionicons name="document-text-outline" size={32} color={COLORS.text} />
                                    ) : (
                                        <Ionicons name="link-outline" size={32} color={COLORS.text} />
                                    )}
                                </View>
                            ))
                        ) : (
                            <View style={[s.mediaPH, { justifyContent: 'center', alignItems: 'center' }]}>
                                <Text style={{ color: COLORS.textSecondary, fontSize: 13 }}>Trống</Text>
                            </View>
                        )}
                        {recentMedia.length >= 4 && (
                            <TouchableOpacity style={s.mediaPH} onPress={openMediaStorage}>
                                <Ionicons name="arrow-forward" size={24} color={COLORS.text} />
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

                {/* Group 4: Settings */}
                <Section>
                    <OptionRow icon="pin-outline" label="Ghim trò chuyện" right={<CustomSwitch value={pinned} onToggle={() => setPinned(v => !v)} />} first />
                    <OptionRow icon="eye-off-outline" label="Ẩn trò chuyện" right={<CustomSwitch value={hidden} onToggle={() => setHidden(v => !v)} />} />
                    <OptionRow icon="call-outline" label="Báo cuộc gọi đến" right={<CustomSwitch value={notifyCall} onToggle={() => setNotifyCall(v => !v)} />} />
                    <OptionRow icon="settings-outline" label="Cài đặt cá nhân" right={<Arrow />} />
                    <OptionRow icon="timer-outline" label="Tin nhắn tự xoá" desc="Không tự xoá" />
                </Section>

                {/* Group 5: Danger */}
                <Section>
                    <OptionRow icon="alert-circle-outline" label="Báo xấu" first />
                    <OptionRow icon="ban-outline" label="Quản lý chặn" right={<Arrow />} />
                    <OptionRow icon="pie-chart-outline" label="Dung lượng trò chuyện" />
                    <OptionRow icon="trash-outline" label="Xóa lịch sử trò chuyện" color={COLORS.red} />
                </Section>

                <View style={{ height: 40 }} />
            </ScrollView>

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
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bg,
        paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        height: 50,
        paddingHorizontal: 8,
        backgroundColor: COLORS.card,
    },
    backBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
    headerTitle: { color: "white", fontSize: 18, fontWeight: "600" },
    profile: { alignItems: "center", paddingVertical: 20, backgroundColor: COLORS.card },
    avatar: { width: 90, height: 90, borderRadius: 45, marginBottom: 12 },
    nameText: { color: COLORS.text, fontSize: 20, fontWeight: "bold", marginBottom: 20 },
    actions: { flexDirection: "row", justifyContent: "center", gap: 24, paddingHorizontal: 20 },
    actionBtn: { alignItems: "center" },
    actionCircle: {
        width: 48, height: 48, borderRadius: 24,
        backgroundColor: "#2c2c2e", justifyContent: "center", alignItems: "center", marginBottom: 8,
    },
    actionLabel: { color: COLORS.textSecondary, fontSize: 12, textAlign: "center", lineHeight: 16 },
    section: { backgroundColor: COLORS.card, borderTopWidth: 8, borderTopColor: "#000", paddingLeft: 16 },
    row: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingRight: 16 },
    rowLabel: { fontSize: 16 },
    rowDesc: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
    mediaPH: {
        width: 70, height: 70, borderRadius: 8,
        backgroundColor: "#2c2c2e", marginRight: 8, justifyContent: "center", alignItems: "center",
    },
});
