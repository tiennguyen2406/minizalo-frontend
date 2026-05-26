import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import {
    View, Text, Platform, TextInput, TouchableOpacity, Pressable, ScrollView,
    Image, ActivityIndicator, Modal, Dimensions, Animated, PanResponder,
    KeyboardAvoidingView, Keyboard, TouchableWithoutFeedback, Easing,
    BackHandler, StyleSheet, Alert, RefreshControl,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeView as SafeAreaView } from "@/shared/components/SafeView";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/shared/theme/colors";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system";
import { ResizeMode, Video } from "expo-av";
import { useStoryStore } from "@/shared/store/storyStore";
import { useUserStore } from "@/shared/store/userStore";
import { useFriendStore } from "@/shared/store/friendStore";
import { usePostStore } from "@/shared/store/postStore";
import { showToast as toast } from "@/shared/utils/toast";
import { getImageUrl } from "@/shared/utils/mediaUtils";
import { chatService } from "@/shared/services/chatService";
import * as VideoThumbnails from 'expo-video-thumbnails';
import StoryFeedWeb from "@/views/web/components/StoryFeed";
import ViewShot from "react-native-view-shot";
import { ChatListHeader } from "@/views/mobile/chat/components/ChatListHeader";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// ─────────────────────────────────────────────
// Types — defined below near usage
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const PHOTO_DURATION_MS = 5000;
const VIDEO_MAX_DURATION_S = 15;
const LOOP_DURATION_MS = 3000;

const BG_COLORS = ["#0068FF", "#000000", "#FF3B30", "#4CD964", "#FF9500", "#5856D6"];

const REACTIONS = ["❤️", "👍", "😂", "😮", "😢", "😡", "🎉", "😍"];
const REACTION_TYPE_MAP: Record<string, string> = {
    heart: "heart", like: "like", haha: "haha", wow: "wow",
    sad: "sad", angry: "angry", party: "party", love: "love"
};
const POST_REACTIONS = [
    { type: "like", emoji: "👍" },
    { type: "heart", emoji: "❤️" },
    { type: "haha", emoji: "😂" },
    { type: "wow", emoji: "😮" },
    { type: "sad", emoji: "😢" },
    { type: "angry", emoji: "😡" },
];
// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const parseOverlayItems = (backgroundConfig?: string): OverlayItem[] => {
    if (!backgroundConfig || !backgroundConfig.includes("|||")) return [];
    try {
        const parts = backgroundConfig.split("|||");
        if (parts.length < 2) return [];
        return JSON.parse(parts[1]);
    } catch { return []; }
};

const parseBgColor = (backgroundConfig?: string): string => {
    if (!backgroundConfig) return "#0068FF";
    const color = backgroundConfig.split("|||")[0] || "";
    // Validate: phải là hex color hoặc rgb/named color
    return color.startsWith("#") || color.startsWith("rgb") ? color : "#0068FF";
};

// ─────────────────────────────────────────────
// Helper: ReactionButton
// ─────────────────────────────────────────────
function ReactionButton({ emoji, onPress }: { emoji: string; onPress: () => void }) {
    const scale = useRef(new Animated.Value(1)).current;
    const handlePress = () => {
        Animated.sequence([
            Animated.spring(scale, { toValue: 1.35, friction: 4, useNativeDriver: true }),
            Animated.spring(scale, { toValue: 1.0, friction: 5, useNativeDriver: true }),
        ]).start();
        onPress();
    };
    return (
        <TouchableWithoutFeedback onPress={handlePress}>
            <Animated.View style={[styles.reactionBtn, { transform: [{ scale }] }]}>
                <Text style={{ fontSize: 22 }}>{emoji}</Text>
            </Animated.View>
        </TouchableWithoutFeedback>
    );
}

// ─────────────────────────────────────────────
// Helper: FlyingEmoji
// ─────────────────────────────────────────────
function FlyingEmoji({ emoji, onComplete }: { emoji: string; onComplete: () => void }) {
    const translateY = useRef(new Animated.Value(0)).current;
    const opacity = useRef(new Animated.Value(1)).current;
    const scale = useRef(new Animated.Value(1)).current;
    const randomX = useRef(Math.random() * 60 - 30).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(translateY, { toValue: -380, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 1100, useNativeDriver: true }),
            Animated.sequence([
                Animated.timing(scale, { toValue: 2.0, duration: 280, useNativeDriver: true }),
                Animated.timing(scale, { toValue: 1.3, duration: 820, useNativeDriver: true }),
            ]),
        ]).start(onComplete);
    }, []);

    return (
        <Animated.Text style={{
            position: "absolute", bottom: 130,
            alignSelf: "center", fontSize: 38,
            opacity, zIndex: 200,
            transform: [{ translateY }, { scale }, { translateX: randomX }],
        }}>
            {emoji}
        </Animated.Text>
    );
}

// ─────────────────────────────────────────────
// Helper: PrivacySheet
// ─────────────────────────────────────────────
function AvatarImage({
    name,
    uri,
    size,
    style,
    textStyle,
}: {
    name?: string | null;
    uri?: string | null;
    size: number;
    style?: any;
    textStyle?: any;
}) {
    const [failed, setFailed] = useState(false);
    const resolvedUri = uri ? getImageUrl(uri) : "";
    const initial = (name || "U").trim().charAt(0).toUpperCase() || "U";

    return (
        <View
            style={[
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: "#D9E8FF",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                },
                style,
            ]}
        >
            <Text style={[{ color: "#0068FF", fontWeight: "800", fontSize: Math.max(13, size * 0.42) }, textStyle]}>
                {initial}
            </Text>
            {!!resolvedUri && !failed ? (
                <Image
                    source={{ uri: resolvedUri }}
                    style={StyleSheet.absoluteFillObject}
                    resizeMode="cover"
                    onError={() => setFailed(true)}
                />
            ) : null}
        </View>
    );
}

type PrivacyMode = "public" | "only" | "except";

interface PrivacySheetProps {
    visible: boolean;
    privacyMode: PrivacyMode;
    onSelect: (mode: PrivacyMode) => void;
    onClose: () => void;
    bottomInset: number;
    colors: any;
    title?: string;
    subtitle?: string;
}

function PrivacySheet({ visible, privacyMode, onSelect, onClose, bottomInset, colors, title, subtitle }: PrivacySheetProps) {
    const translateY = useRef(new Animated.Value(500)).current;
    const sheetHeight = useRef(0);

    useEffect(() => {
        if (visible) {
            Animated.spring(translateY, {
                toValue: 0, tension: 68, friction: 12, useNativeDriver: true,
            }).start();
        }
    }, [visible]);

    const handleClose = useCallback(() => {
        Animated.timing(translateY, {
            toValue: sheetHeight.current || 500, duration: 220, useNativeDriver: true,
        }).start(() => onClose());
    }, [onClose]);

    // Android back button — chỉ đóng sheet
    useEffect(() => {
        if (!visible) return;
        const sub = BackHandler.addEventListener("hardwareBackPress", () => {
            handleClose();
            return true;
        });
        return () => sub.remove();
    }, [visible, handleClose]);

    if (!visible) return null;

    const options: { mode: PrivacyMode; icon: string; title: string; subtitle: string }[] = [
        { mode: "public", icon: "people-outline", title: "Bạn bè Zalo", subtitle: "Trừ bạn bè đã bị chặn xem" },
        { mode: "only", icon: "person-add-outline", title: "Một số bạn bè", subtitle: "Chọn bạn bè được xem" },
        { mode: "except", icon: "person-remove-outline", title: "Bạn bè ngoại trừ...", subtitle: "Chọn bạn bè không được xem" },
    ];

    return (
        <>
            {/* Dim overlay — nhấn ra ngoài để đóng sheet, KHÔNG đóng editor */}
            <TouchableWithoutFeedback onPress={handleClose}>
                <View style={StyleSheet.absoluteFillObject} />
            </TouchableWithoutFeedback>

            <Animated.View
                onLayout={(e) => { sheetHeight.current = e.nativeEvent.layout.height; }}
                style={[styles.privacySheet, {
                    backgroundColor: colors.background,
                    paddingBottom: bottomInset + 16,
                    transform: [{ translateY }],
                }]}
            >
                {/* Handle bar */}
                <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 8 }}>
                    <View style={[styles.handleBar, { backgroundColor: colors.border }]} />
                </View>

                <Text style={[styles.sheetTitle, { color: colors.text }]}>
                    {title || "Ai được xem khoảnh khắc này?"}
                </Text>
                <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>
                    {subtitle || "Khoảnh khắc chỉ xem được trong 24 giờ"}
                </Text>

                {options.map((opt, idx) => (
                    <View key={opt.mode}>
                        <TouchableOpacity
                            onPress={() => {
                                onSelect(opt.mode);
                                if (opt.mode === "public") handleClose();
                            }}
                            style={styles.privacyOption}
                            activeOpacity={0.7}
                        >
                            {/* Radio */}
                            <View style={[styles.radioOuter, {
                                borderColor: privacyMode === opt.mode ? "#0068FF" : colors.border,
                                backgroundColor: privacyMode === opt.mode ? "#0068FF" : "transparent",
                            }]}>
                                {privacyMode === opt.mode && (
                                    <View style={styles.radioInner} />
                                )}
                            </View>
                            <Ionicons name={opt.icon as any} size={22} color={colors.textSecondary} style={{ marginRight: 12 }} />
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.optionTitle, { color: colors.text }]}>{opt.title}</Text>
                                <Text style={[styles.optionSub, { color: colors.textSecondary }]}>{opt.subtitle}</Text>
                            </View>
                            {opt.mode !== "public" && (
                                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                            )}
                        </TouchableOpacity>
                        {idx < options.length - 1 && (
                            <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        )}
                    </View>
                ))}
            </Animated.View>
        </>
    );
}

// ─────────────────────────────────────────────
// Types cho editor overlay items
// ─────────────────────────────────────────────
interface OverlayItem {
    id: string;
    type: "music" | "text";
    // Vị trí tuyệt đối (px từ top-left màn hình)
    x: number;
    y: number;
    // Xoay (degrees)
    rotation: number;
    // Scale (1.0 = mặc định)
    scale: number;
    // Chỉ cho music
    musicTitle?: string;
    musicArtist?: string;
    musicThumb?: string;
    // Chỉ cho text
    textContent?: string;
    textStyle?: "normal" | "italic" | "bold";
}

interface MusicTrack {
    id: string;
    title: string;
    artist: string;
    thumbnail: string;
    previewUrl: string;
}

// ─────────────────────────────────────────────
// Helper: DraggableOverlayItem
// Hỗ trợ: drag (1 ngón), pinch-to-zoom + rotate (2 ngón)
// ─────────────────────────────────────────────
interface DraggableOverlayItemProps {
    item: OverlayItem;
    onUpdate: (id: string, changes: Partial<OverlayItem>) => void;
    onDelete: (id: string) => void;
    onEdit: (id: string) => void;
    showTrash: boolean;
    onDragStart: () => void;
    onDragEnd: () => void;
    trashScaleAnim: Animated.Value;   // shared từ parent để trash button animate
    trashPos: { x: number; y: number; r: number }; // vị trí + radius của trash
    paused?: boolean;
}

function DraggableOverlayItem({
    item, onUpdate, onDelete, onEdit, showTrash, onDragStart, onDragEnd,
    trashScaleAnim, trashPos, paused,
}: DraggableOverlayItemProps) {
    // ── Animated values ──
    const posX = useRef(new Animated.Value(item.x)).current;
    const posY = useRef(new Animated.Value(item.y)).current;
    const rot = useRef(new Animated.Value(item.rotation)).current;
    const scl = useRef(new Animated.Value(item.scale)).current;

    // Giá trị hiện tại (không gây re-render)
    const curX = useRef(item.x);
    const curY = useRef(item.y);
    const curRot = useRef(item.rotation);
    const curScl = useRef(item.scale);

    // Trạng thái drag
    const dragStartX = useRef(item.x);
    const dragStartY = useRef(item.y);
    const hasMoved = useRef(false);
    const dragging = useRef(false);

    // Trạng thái pinch
    const pinching = useRef(false);
    const pinchInitDist = useRef(0);
    const pinchInitAng = useRef(0);
    const pinchInitScl = useRef(1);
    const pinchInitRot = useRef(0);

    // ── Hiệu ứng hút vào trash ──
    const suckScale = useRef(new Animated.Value(1)).current;
    const suckOpacity = useRef(new Animated.Value(1)).current;
    const [nearTrash, setNearTrash] = useState(false);
    const nearTrashRef = useRef(false); // ref tránh stale closure trong PanResponder

    const doSuckAndDelete = useCallback(() => {
        Animated.parallel([
            Animated.timing(suckScale, {
                toValue: 0, duration: 280,
                easing: Easing.in(Easing.quad), useNativeDriver: true,
            }),
            Animated.timing(suckOpacity, {
                toValue: 0, duration: 240, useNativeDriver: true,
            }),
            Animated.sequence([
                Animated.spring(trashScaleAnim, {
                    toValue: 1.5, friction: 3, useNativeDriver: true,
                }),
                Animated.spring(trashScaleAnim, {
                    toValue: 1.0, friction: 5, useNativeDriver: true,
                }),
            ]),
        ]).start(() => onDelete(item.id));
    }, [item.id, onDelete, suckScale, suckOpacity, trashScaleAnim]);

    // ── Spin animation cho đĩa nhạc ──
    const spinAnim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        if (item.type !== "music") return;
        let active = true;
        const runAnimation = () => {
            if (!active) return;
            const curVal = (spinAnim as any)._value || 0;
            const duration = 5000 * (1 - curVal);
            Animated.timing(spinAnim, {
                toValue: 1, duration, easing: Easing.linear, useNativeDriver: true,
            }).start(({ finished }) => {
                if (finished && active) {
                    spinAnim.setValue(0);
                    runAnimation();
                }
            });
        };
        if (paused) {
            spinAnim.stopAnimation();
        } else {
            runAnimation();
        }
        return () => { active = false; spinAnim.stopAnimation(); };
    }, [item.type, paused, spinAnim]);
    const avatarSpin = spinAnim.interpolate({
        inputRange: [0, 1], outputRange: ["0deg", "360deg"],
    });

    // ─────────────────────────────────
    // HANDLER 1: DRAG (1 ngón)
    // ─────────────────────────────────
    const getDist = (a: any, b: any) => {
        const dx = b.pageX - a.pageX, dy = b.pageY - a.pageY;
        return Math.sqrt(dx * dx + dy * dy);
    };
    const getAng = (a: any, b: any) =>
        Math.atan2(b.pageY - a.pageY, b.pageX - a.pageX) * (180 / Math.PI);

    const dragPan = useRef(PanResponder.create({
        onStartShouldSetPanResponder: () => !pinching.current,
        onMoveShouldSetPanResponder: (_, g) =>
            !pinching.current && (Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3),

        onPanResponderGrant: () => {
            hasMoved.current = false;
            dragging.current = true;
            dragStartX.current = curX.current;
            dragStartY.current = curY.current;
            suckScale.setValue(1);
            suckOpacity.setValue(1);
        },

        onPanResponderMove: (_, g) => {
            if (pinching.current) return;

            const moved = Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4;
            if (moved && !hasMoved.current) {
                hasMoved.current = true;
                onDragStart();
            }
            if (!hasMoved.current) return;

            const nx = dragStartX.current + g.dx;
            const ny = dragStartY.current + g.dy;

            // Tính từ tâm model (~80x28 là nửa kích thước pill)
            const modelCX = nx + 80;
            const modelCY = ny + 28;
            const dist = Math.sqrt(
                (modelCX - trashPos.x) ** 2 + (modelCY - trashPos.y) ** 2
            );
            const isNear = dist < trashPos.r;

            nearTrashRef.current = isNear;
            setNearTrash(isNear);

            Animated.spring(trashScaleAnim, {
                toValue: isNear ? 1.5 : 1.0,
                friction: 4, useNativeDriver: true,
            }).start();

            // Magnet effect: kéo model nhẹ về phía trash khi gần
            if (isNear) {
                Animated.spring(posX, {
                    toValue: trashPos.x - 80,
                    friction: 10, useNativeDriver: false,
                }).start();
                Animated.spring(posY, {
                    toValue: trashPos.y - 28,
                    friction: 10, useNativeDriver: false,
                }).start();
            } else {
                posX.setValue(nx);
                posY.setValue(ny);
            }
        },

        onPanResponderRelease: (_, g) => {
            dragging.current = false;

            if (!hasMoved.current) {
                if (item.type === "text") onEdit(item.id);
                onDragEnd();
                return;
            }

            // Dùng nearTrashRef thay vì tính lại dist — tránh stale closure
            const inTrash = nearTrashRef.current;

            nearTrashRef.current = false;
            setNearTrash(false);
            Animated.spring(trashScaleAnim, {
                toValue: 1, friction: 5, useNativeDriver: true,
            }).start();

            if (inTrash) {
                Animated.parallel([
                    Animated.timing(posX, {
                        toValue: trashPos.x - 30, duration: 180,
                        easing: Easing.in(Easing.quad), useNativeDriver: false,
                    }),
                    Animated.timing(posY, {
                        toValue: trashPos.y - 30, duration: 180,
                        easing: Easing.in(Easing.quad), useNativeDriver: false,
                    }),
                ]).start(() => doSuckAndDelete());
            } else {
                const nx = dragStartX.current + g.dx;
                const ny = dragStartY.current + g.dy;
                curX.current = nx;
                curY.current = ny;
                onUpdate(item.id, { x: nx, y: ny });
                onDragEnd();
            }
            hasMoved.current = false;
        },

        onPanResponderTerminate: () => {
            dragging.current = false;
            hasMoved.current = false;
            setNearTrash(false);
            Animated.spring(trashScaleAnim, { toValue: 1, friction: 5, useNativeDriver: true }).start();
            onDragEnd();
        },
    })).current;

    // ─────────────────────────────────
    // HANDLER 2: PINCH + ROTATE (2 ngón)
    // View riêng bọc ngoài — nhận multitouch độc lập
    // ─────────────────────────────────
    const pinchPan = useRef(PanResponder.create({
        // Chỉ nhận khi có ≥ 2 ngón
        onStartShouldSetPanResponder: (evt) =>
            evt.nativeEvent.touches.length >= 2,
        onMoveShouldSetPanResponder: (evt) =>
            evt.nativeEvent.touches.length >= 2,

        onPanResponderGrant: (evt) => {
            const ts = evt.nativeEvent.touches;
            if (ts.length < 2) return;
            pinching.current = true;
            pinchInitDist.current = getDist(ts[0], ts[1]);
            pinchInitAng.current = getAng(ts[0], ts[1]);
            pinchInitScl.current = curScl.current;
            pinchInitRot.current = curRot.current;
        },

        onPanResponderMove: (evt) => {
            const ts = evt.nativeEvent.touches;
            if (ts.length < 2 || !pinching.current) return;

            const dist = getDist(ts[0], ts[1]);
            const ang = getAng(ts[0], ts[1]);

            const ns = Math.max(0.2, Math.min(6,
                pinchInitScl.current * (dist / Math.max(pinchInitDist.current, 1))
            ));
            const nr = pinchInitRot.current + (ang - pinchInitAng.current);

            scl.setValue(ns);
            rot.setValue(nr);
            curScl.current = ns;
            curRot.current = nr;
        },

        onPanResponderRelease: () => {
            pinching.current = false;
            onUpdate(item.id, { scale: curScl.current, rotation: curRot.current });
        },

        onPanResponderTerminate: () => {
            pinching.current = false;
        },
    })).current;

    // ── rotateStr ──
    const rotateStr = rot.interpolate({
        inputRange: [-3600, 3600],
        outputRange: ["-3600deg", "3600deg"],
    });

    // ── Render ──
    const content = item.type === "music" ? (
        <View style={itemStyles.musicPill}>
            {item.musicThumb ? (
                <Animated.Image
                    source={{ uri: item.musicThumb }}
                    style={[itemStyles.musicThumb, { transform: [{ rotate: avatarSpin }] }]}
                />
            ) : (
                <View style={[itemStyles.musicThumb, { backgroundColor: "#333", alignItems: "center", justifyContent: "center" }]}>
                    <Ionicons name="musical-notes" size={14} color="white" />
                </View>
            )}
            <View style={{ flexShrink: 1, justifyContent: "center", marginLeft: 10, marginRight: 4 }}>
                <Text style={itemStyles.musicTitle} numberOfLines={1}>{item.musicTitle || "Unknown"}</Text>
                <Text style={itemStyles.musicArtist} numberOfLines={1}>{item.musicArtist || "Artist"}</Text>
            </View>
        </View>
    ) : (
        (() => {
            const fontStyle = item.textStyle === "italic"
                ? { fontStyle: "italic" as const }
                : item.textStyle === "bold"
                    ? { fontWeight: "bold" as const }
                    : {};
            return (
                <View style={itemStyles.textPill}>
                    <Text style={[itemStyles.textContent, fontStyle]}>{item.textContent}</Text>
                </View>
            );
        })()
    );

    return (
        // Layer ngoài: nhận pinch gesture
        <Animated.View
            {...pinchPan.panHandlers}
            style={{
                position: "absolute",
                left: posX,
                top: posY,
                zIndex: 20,
            }}
        >
            {/* Layer trong: nhận drag + áp transform */}
            <Animated.View
                {...dragPan.panHandlers}
                style={{
                    transform: [{ rotate: rotateStr }, { scale: scl }],
                    opacity: suckOpacity,
                }}
            >
                <Animated.View style={{ transform: [{ scale: suckScale }] }}>
                    {content}
                </Animated.View>
            </Animated.View>
        </Animated.View>
    );
}

const itemStyles = StyleSheet.create({
    musicPill: {
        flexDirection: "row", alignItems: "center",
        backgroundColor: "rgba(7, 43, 43, 0.85)", borderRadius: 40,
        paddingRight: 18, paddingVertical: 6, paddingLeft: 6, gap: 10,
        maxWidth: 240, minWidth: 160, shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 10, elevation: 8,
        borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
    },
    musicThumb: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#222" },
    musicTitle: { color: "white", fontSize: 13, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
    musicArtist: { color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 1 },
    textPill: {
        backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 10,
        paddingHorizontal: 14, paddingVertical: 10, shadowColor: "#000",
        shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
    },
    textContent: { color: "#1A1A1A", fontSize: 18, fontWeight: "600" },
});

// ─────────────────────────────────────────────
// Helper: MusicSearchSheet
// ─────────────────────────────────────────────
interface MusicSearchSheetProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (track: MusicTrack) => void;
    colors: any;
    bottomInset: number;
}

const SAMPLE_CATEGORIES = ["Top viral", "Đang yêu", "Buồn", "Vui", "Chill"];

function MusicSearchSheet({ visible, onClose, onSelect, colors, bottomInset }: MusicSearchSheetProps) {
    const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const [query, setQuery] = useState("");
    const [tracks, setTracks] = useState<MusicTrack[]>([]);
    const [loading, setLoading] = useState(false);
    const [category, setCategory] = useState("Top viral");
    const [playingId, setPlayingId] = useState<string | null>(null);
    // Audio player dùng HTML5 Audio (web) hoặc Expo AV (native)
    const audioRef = useRef<any>(null);

    useEffect(() => {
        if (visible) {
            Animated.spring(translateY, {
                toValue: 0, tension: 68, friction: 12, useNativeDriver: true,
            }).start();
            searchTracks("top hits vietnam");
        } else {
            stopAudio();
            Animated.timing(translateY, {
                toValue: SCREEN_HEIGHT, duration: 220, useNativeDriver: true,
            }).start();
        }
    }, [visible]);

    // Dọn dẹp audio khi unmount
    useEffect(() => () => { stopAudio(); }, []);

    const stopAudio = async () => {
        try {
            if (audioRef.current) {
                await audioRef.current.stopAsync?.();
                await audioRef.current.unloadAsync?.();
                audioRef.current = null;
            }
        } catch { }
        setPlayingId(null);
    };

    const togglePreview = async (track: MusicTrack) => {
        if (!track.previewUrl) return;

        // Nếu đang phát bài này → dừng
        if (playingId === track.id) {
            await stopAudio();
            return;
        }

        // Dừng bài cũ
        await stopAudio();

        try {
            // Thử dùng Expo AV nếu có
            const { Audio } = require("expo-av");
            await Audio.setAudioModeAsync({
                playsInSilentModeIOS: true,
                staysActiveInBackground: false,
            });
            const { sound } = await Audio.Sound.createAsync(
                { uri: track.previewUrl },
                { shouldPlay: true, volume: 1.0 }
            );
            audioRef.current = sound;
            setPlayingId(track.id);

            // Tự dừng sau 30 giây
            sound.setOnPlaybackStatusUpdate((status: any) => {
                if (status.didJustFinish) {
                    setPlayingId(null);
                    audioRef.current = null;
                }
            });
        } catch (e) {
            // Expo AV không có → thử Web Audio
            try {
                const audio = new (window as any).Audio(track.previewUrl);
                audio.play();
                audioRef.current = { stopAsync: () => audio.pause(), unloadAsync: () => { } };
                setPlayingId(track.id);
                audio.onended = () => { setPlayingId(null); audioRef.current = null; };
            } catch {
                setPlayingId(null);
            }
        }
    };

    const handleSelect = async (track: MusicTrack) => {
        await stopAudio();
        onSelect(track);
        onClose();
    };

    const searchTracks = async (keyword: string) => {
        if (!keyword.trim()) return;
        setLoading(true);
        try {
            const url = `https://itunes.apple.com/search?term=${encodeURIComponent(keyword)}&media=music&limit=20&country=VN`;
            const res = await fetch(url);
            const data = await res.json();
            const mapped: MusicTrack[] = (data.results || []).map((item: any) => ({
                id: String(item.trackId),
                title: item.trackName || "",
                artist: item.artistName || "",
                thumbnail: (item.artworkUrl100 || "").replace("100x100", "200x200"),
                previewUrl: item.previewUrl || "",
            }));
            setTracks(mapped);
        } catch {
            setTracks([]);
        } finally {
            setLoading(false);
        }
    };

    const CATEGORY_KEYWORDS: Record<string, string> = {
        "Top viral": "top hits vietnam 2024",
        "Đang yêu": "love songs vietnamese",
        "Buồn": "sad vietnamese ballad",
        "Vui": "happy upbeat vietnam",
        "Chill": "chill lofi vietnam",
    };

    if (!visible) return null;

    return (
        <Animated.View style={[musicStyles.sheet, { transform: [{ translateY }], paddingBottom: bottomInset + 8 }]}>
            {/* Handle bar */}
            <View style={{ alignItems: "center", paddingVertical: 8 }}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: "#E0E0E0" }} />
            </View>

            {/* Search bar */}
            <View style={musicStyles.searchBar}>
                <View style={musicStyles.searchBarInner}>
                    <Ionicons name="search" size={16} color="#888" style={{ marginRight: 8 }} />
                    <TextInput
                        style={{ flex: 1, fontSize: 15, color: "#1A1A1A" }}
                        placeholder="Tìm bài hát hoặc nghệ sĩ"
                        placeholderTextColor="#888"
                        value={query}
                        onChangeText={setQuery}
                        returnKeyType="search"
                        onSubmitEditing={() => searchTracks(query)}
                    />
                </View>
            </View>

            {/* Category chips */}
            <View style={{ height: 50 }}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={musicStyles.chipRow}
                >
                    {SAMPLE_CATEGORIES.map(cat => (
                        <TouchableOpacity
                            key={cat}
                            onPress={() => { setCategory(cat); searchTracks(CATEGORY_KEYWORDS[cat] || cat); }}
                            style={[musicStyles.chip, category === cat && musicStyles.chipActive]}
                        >
                            <Text style={[musicStyles.chipText, category === cat && musicStyles.chipTextActive]}>
                                {cat}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Track list */}
            {loading ? (
                <ActivityIndicator color="#0068FF" style={{ marginTop: 32 }} />
            ) : (
                <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                    {tracks.map(track => (
                        <View key={track.id} style={musicStyles.trackRow}>
                            <Image source={{ uri: track.thumbnail }} style={musicStyles.trackThumb} />
                            <View style={{ flex: 1, marginHorizontal: 12 }}>
                                <Text style={musicStyles.trackTitle} numberOfLines={1}>{track.title}</Text>
                                <Text style={musicStyles.trackArtist} numberOfLines={1}>{track.artist}</Text>
                            </View>
                            {/* Nút nghe thử */}
                            <TouchableOpacity
                                onPress={() => togglePreview(track)}
                                style={[musicStyles.previewBtn, playingId === track.id && musicStyles.previewBtnActive]}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name={playingId === track.id ? "pause" : "play"}
                                    size={16}
                                    color={playingId === track.id ? "white" : "#0068FF"}
                                />
                            </TouchableOpacity>
                            {/* Nút Chọn */}
                            <TouchableOpacity
                                onPress={() => handleSelect(track)}
                                style={musicStyles.chooseBtn}
                                activeOpacity={0.7}
                            >
                                <Text style={musicStyles.chooseBtnText}>Chọn</Text>
                            </TouchableOpacity>
                        </View>
                    ))}
                </ScrollView>
            )}
        </Animated.View>
    );
}

const musicStyles = StyleSheet.create({
    sheet: {
        position: "absolute", bottom: 0, left: 0, right: 0,
        height: SCREEN_HEIGHT * 0.78,
        backgroundColor: "white",
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
        zIndex: 100,
    },
    searchBar: { paddingHorizontal: 16, marginBottom: 4 },
    searchBarInner: {
        flexDirection: "row", alignItems: "center",
        backgroundColor: "#F2F2F2", borderRadius: 12,
        paddingHorizontal: 12, height: 44,
    },
    // FIX chip: height cố định, không stretch
    chipRow: {
        paddingHorizontal: 16, paddingVertical: 10,
        flexDirection: "row", alignItems: "center", gap: 8,
    },
    chip: {
        height: 34,
        paddingHorizontal: 16,
        borderRadius: 17,
        borderWidth: 1.5, borderColor: "#E0E0E0",
        backgroundColor: "white",
        alignItems: "center", justifyContent: "center",
    },
    chipActive: { borderColor: "#0068FF", backgroundColor: "#E8F0FF" },
    chipText: { color: "#555", fontWeight: "600", fontSize: 13 },
    chipTextActive: { color: "#0068FF" },
    trackRow: {
        flexDirection: "row", alignItems: "center",
        paddingHorizontal: 16, paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#F0F0F0",
        gap: 6,
    },
    trackThumb: { width: 50, height: 50, borderRadius: 8 },
    trackTitle: { fontSize: 14, fontWeight: "600", color: "#1A1A1A" },
    trackArtist: { fontSize: 12, color: "#888", marginTop: 2 },
    previewBtn: {
        width: 36, height: 36, borderRadius: 18,
        borderWidth: 1.5, borderColor: "#0068FF",
        alignItems: "center", justifyContent: "center",
    },
    previewBtnActive: { backgroundColor: "#0068FF" },
    chooseBtn: {
        paddingHorizontal: 14, paddingVertical: 8,
        borderRadius: 18, borderWidth: 1.5,
        borderColor: "#0068FF", backgroundColor: "#E8F0FF",
    },
    chooseBtnText: { color: "#0068FF", fontSize: 13, fontWeight: "600" },
});

// ─────────────────────────────────────────────
// Helper: TextOverlayInput
// ─────────────────────────────────────────────
interface TextOverlayInputProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: (text: string, style: "normal" | "italic" | "bold") => void;
    initialText?: string;
    initialStyle?: "normal" | "italic" | "bold";
}

function TextOverlayInput({ visible, onClose, onConfirm, initialText = "", initialStyle = "normal" }: TextOverlayInputProps) {
    const [inputText, setInputText] = useState(initialText);
    const [textStyle, setTextStyle] = useState<"normal" | "italic" | "bold">(initialStyle);
    const inputRef = useRef<any>(null);

    // Reset khi mở với text mới
    useEffect(() => {
        if (visible) {
            setInputText(initialText);
            setTextStyle(initialStyle);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [visible, initialText, initialStyle]);

    if (!visible) return null;

    return (
        <View style={textInputStyles.overlay}>
            <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); onClose(); }}>
                <View style={StyleSheet.absoluteFillObject} />
            </TouchableWithoutFeedback>

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ width: "100%" }}
            >
                {/* Preview text live — hiển thị ở giữa màn hình */}
                <View style={textInputStyles.previewArea}>
                    <Text style={[
                        textInputStyles.preview,
                        textStyle === "italic" && { fontStyle: "italic" },
                        textStyle === "bold" && { fontWeight: "900" },
                    ]}>
                        {inputText || "Nhập nội dung..."}
                    </Text>
                </View>

                {/* Style selector + nút Lưu */}
                <View style={textInputStyles.controlRow}>
                    {(["normal", "italic", "bold"] as const).map((s, i) => (
                        <TouchableOpacity
                            key={s}
                            onPress={() => setTextStyle(s)}
                            style={[textInputStyles.styleBtn, textStyle === s && textInputStyles.styleBtnActive]}
                        >
                            <Text style={[
                                textInputStyles.styleBtnText,
                                s === "italic" && { fontStyle: "italic" },
                                s === "bold" && { fontWeight: "900" },
                                textStyle === s && { color: "#1A1A1A" },
                            ]}>
                                {s === "normal" ? "Aa" : s === "italic" ? "Aa" : "AA"}
                            </Text>
                        </TouchableOpacity>
                    ))}
                    <View style={{ flex: 1 }} />
                    <TouchableOpacity
                        onPress={() => {
                            if (inputText.trim()) {
                                onConfirm(inputText.trim(), textStyle);
                                setInputText("");
                            }
                        }}
                        style={[textInputStyles.saveBtn, { opacity: inputText.trim() ? 1 : 0.4 }]}
                        disabled={!inputText.trim()}
                    >
                        <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>Lưu</Text>
                    </TouchableOpacity>
                </View>

                {/* TextInput ẩn — chỉ nhận keyboard input, không hiển thị */}
                <TextInput
                    ref={inputRef}
                    value={inputText}
                    onChangeText={setInputText}
                    style={{ height: 0, opacity: 0 }}
                    multiline
                    autoFocus
                />
            </KeyboardAvoidingView>
        </View>
    );
}

const textInputStyles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject as any,
        backgroundColor: "rgba(0,0,0,0.75)",
        zIndex: 80,
        justifyContent: "flex-end",
    },
    previewArea: {
        paddingHorizontal: 32,
        paddingVertical: 24,
        alignItems: "center",
    },
    preview: {
        color: "white",
        fontSize: 28,
        textAlign: "center",
        fontWeight: "600",
    },
    controlRow: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(20,20,20,0.95)",
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 10,
    },
    styleBtn: {
        width: 48, height: 48, borderRadius: 24,
        backgroundColor: "rgba(255,255,255,0.15)",
        alignItems: "center", justifyContent: "center",
    },
    styleBtnActive: { backgroundColor: "white" },
    styleBtnText: { color: "white", fontSize: 17 },
    saveBtn: {
        paddingHorizontal: 20, paddingVertical: 10,
        borderRadius: 22, backgroundColor: "#0068FF",
    },
});

// ─────────────────────────────────────────────
// Helper: StoryMenuSheet
// ─────────────────────────────────────────────
interface StoryMenuSheetProps {
    visible: boolean;
    onClose: () => void;
    isOwnStory: boolean;
    storyData: any;
    onDelete: () => void;
    onPrivacyChange: () => void;
    onDownload: () => void;
    onReport?: () => void;
    bottomInset: number;
    colors: any;
}

function StoryMenuSheet({
    visible, onClose, isOwnStory, storyData,
    onDelete, onPrivacyChange, onDownload, onReport,
    bottomInset, colors
}: StoryMenuSheetProps) {
    const translateY = useRef(new Animated.Value(400)).current;

    useEffect(() => {
        if (visible) {
            Animated.spring(translateY, {
                toValue: 0, tension: 65, friction: 11, useNativeDriver: true,
            }).start();
        }
    }, [visible]);

    const handleClose = useCallback(() => {
        Animated.timing(translateY, {
            toValue: 400, duration: 200, useNativeDriver: true,
        }).start(() => onClose());
    }, [onClose]);

    // Android back handler
    useEffect(() => {
        if (!visible) return;
        const sub = BackHandler.addEventListener("hardwareBackPress", () => {
            handleClose();
            return true;
        });
        return () => sub.remove();
    }, [visible, handleClose]);

    if (!visible) return null;

    const privacyLabelMap: Record<string, string> = {
        "ALL_FRIENDS": "Bạn bè Zalo",
        "SPECIFIC": "Một số bạn bè",
        "EXCLUDE": "Bạn bè ngoại trừ...",
    };

    return (
        <>
            <TouchableWithoutFeedback onPress={handleClose}>
                <View style={StyleSheet.absoluteFillObject} />
            </TouchableWithoutFeedback>

            <Animated.View style={[styles.privacySheet, {
                backgroundColor: colors.background,
                paddingBottom: bottomInset + 16,
                transform: [{ translateY }],
                zIndex: 200,
            }]}>
                <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 8 }}>
                    <View style={[styles.handleBar, { backgroundColor: colors.border }]} />
                </View>

                {/* Header: Tên người đăng */}
                <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>{storyData?.displayName}</Text>
                </View>

                <View style={[styles.divider, { backgroundColor: colors.border, marginHorizontal: 0 }]} />

                {/* Mục Quyền riêng tư - Chỉ hiện nếu là story của mình */}
                {isOwnStory && (
                    <TouchableOpacity style={styles.privacyOption} onPress={() => { handleClose(); setTimeout(onPrivacyChange, 300); }}>
                        <Ionicons name="people-outline" size={22} color={colors.text} style={{ marginRight: 14 }} />
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.optionTitle, { color: colors.text }]}>Ai được xem khoảnh khắc này?</Text>
                            <Text style={[styles.optionSub, { color: colors.textSecondary }]}>
                                {privacyLabelMap[storyData?.privacy] || "Bạn bè Zalo"}
                            </Text>
                        </View>
                    </TouchableOpacity>
                )}

                {/* Mục Xóa - Chỉ hiện nếu là story của mình */}
                {isOwnStory && (
                    <TouchableOpacity style={styles.privacyOption} onPress={onDelete}>
                        <Ionicons name="trash-outline" size={22} color="#FF3B30" style={{ marginRight: 14 }} />
                        <Text style={[styles.optionTitle, { color: "#FF3B30" }]}>Xóa</Text>
                    </TouchableOpacity>
                )}

                {/* Mục Báo cáo - Chỉ hiện nếu không phải story của mình */}
                {!isOwnStory && (
                    <TouchableOpacity style={styles.privacyOption} onPress={onReport}>
                        <Ionicons name="alert-circle-outline" size={22} color="#FF3B30" style={{ marginRight: 14 }} />
                        <Text style={[styles.optionTitle, { color: "#FF3B30" }]}>Báo cáo</Text>
                    </TouchableOpacity>
                )}
            </Animated.View>
        </>
    );
}

// ─────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────
// Component riêng để thumbnail xoay trong viewer
function ViewerSpinningThumb({ uri, paused }: { uri: string, paused?: boolean }) {
    const spinAnim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        let active = true;
        const runAnimation = () => {
            if (!active) return;
            const curVal = (spinAnim as any)._value || 0;
            const duration = 5000 * (1 - curVal);
            Animated.timing(spinAnim, {
                toValue: 1, duration, easing: Easing.linear, useNativeDriver: true,
            }).start(({ finished }) => {
                if (finished && active) {
                    spinAnim.setValue(0);
                    runAnimation();
                }
            });
        };
        if (paused) {
            spinAnim.stopAnimation();
        } else {
            runAnimation();
        }
        return () => { active = false; spinAnim.stopAnimation(); };
    }, [paused, spinAnim]);
    const rotate = spinAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ["0deg", "360deg"],
    });
    return (
        <Animated.Image
            source={{ uri }}
            style={[itemStyles.musicThumb, { transform: [{ rotate }] }]}
        />
    );
}

function MarqueeText({ text, style, maxWidth }: { text: string; style: any, maxWidth: number }) {
    const [textWidth, setTextWidth] = useState(0);
    const translateX = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (textWidth > maxWidth) {
            const distance = textWidth - maxWidth + 30;
            const anim = Animated.loop(
                Animated.sequence([
                    Animated.delay(1500),
                    Animated.timing(translateX, {
                        toValue: -distance,
                        duration: distance * 40,
                        easing: Easing.linear,
                        useNativeDriver: true,
                    }),
                    Animated.timing(translateX, {
                        toValue: 20,
                        duration: 0,
                        useNativeDriver: true,
                    }),
                    Animated.timing(translateX, {
                        toValue: 0,
                        duration: 400,
                        easing: Easing.linear,
                        useNativeDriver: true,
                    }),
                ])
            );
            anim.start();
            return () => anim.stop();
        } else {
            translateX.setValue(0);
        }
    }, [textWidth, maxWidth, text]);

    return (
        <View style={{ overflow: "hidden", maxWidth: maxWidth, justifyContent: "center" }}>
            {/* Ẩn ScrollView rộng vô hạn để đo chính xác chiều dài text */}
            <ScrollView horizontal style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 9999 }}>
                <Text style={style} onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}>
                    {text}
                </Text>
            </ScrollView>

            <Animated.View style={{ width: textWidth > maxWidth ? textWidth + 50 : undefined, transform: [{ translateX }] }}>
                <Text style={[style]} numberOfLines={1}>
                    {text}
                </Text>
            </Animated.View>
        </View>
    );
}

function StoryProgressBars({ stories, currentIndex, progress, insetTop }: {
    stories: any[];
    currentIndex: number;
    progress: Animated.Value;
    insetTop: number;
}) {
    const [trackW, setTrackW] = useState(0);
    const total = stories.length;

    return (
        <View
            style={{
                position: "absolute",
                top: insetTop + 8,
                left: 10, right: 10,
                height: 2,
                flexDirection: "row",
                alignItems: "center",
                gap: 3,
            }}
            onLayout={e => {
                // Lấy width thực của container sau khi layout
                const containerW = e.nativeEvent.layout.width;
                const w = (containerW - 3 * (total - 1)) / total;
                setTrackW(w);
            }}
        >
            {stories.map((_: any, i: number) => (
                <View
                    key={i}
                    style={{
                        flex: 1,
                        height: 2,
                        backgroundColor: "rgba(255,255,255,0.35)",
                        borderRadius: 1,
                        overflow: "hidden",
                    }}
                >
                    {trackW > 0 && (
                        <Animated.View
                            style={{
                                position: "absolute",
                                left: 0, top: 0,
                                width: trackW,
                                height: 2,
                                backgroundColor: "white",
                                transform: [{
                                    translateX:
                                        i < currentIndex
                                            ? 0
                                            : i === currentIndex
                                                ? progress.interpolate({
                                                    inputRange: [0, 100],
                                                    outputRange: [-trackW, 0],
                                                    extrapolate: "clamp",
                                                })
                                                : -trackW,
                                }],
                            }}
                        />
                    )}
                </View>
            ))}
        </View>
    );
}

export default function WorkScreen() {
    const isWeb = Platform.OS === "web";
    const router = useRouter();
    const colors = useThemeColors();
    const insets = useSafeAreaInsets();
    const routeParams = useLocalSearchParams();
    const targetPostId = Array.isArray(routeParams.postId)
        ? routeParams.postId[0]
        : routeParams.postId
            ? String(routeParams.postId)
            : null;
    const { feed, fetchFeed, uploadStory, viewStory, addReaction, updateStoryPrivacy } = useStoryStore();
    const { profile } = useUserStore();
    const { friends } = useFriendStore();
    const { posts, loading: postsLoading, fetchFeed: fetchPostFeed, createPost, reactPost, removePostReaction, commentPost, deletePostComment, updatePostPrivacy } = usePostStore();

    // ── Creation state ──
    const [creationStep, setCreationStep] = useState<"NONE" | "TYPE" | "TEXT" | "EDIT">("NONE");
    const [selectedAssets, setSelectedAssets] = useState<any[]>([]);
    const [textContent, setTextContent] = useState("");
    const [bgConfig, setBgConfig] = useState(BG_COLORS[0]);
    const [isPosting, setIsPosting] = useState(false);
    const [showPrivacySheet, setShowPrivacySheet] = useState(false);
    const [privacyMode, setPrivacyMode] = useState<PrivacyMode>("public");
    const [privacyUsers, setPrivacyUsers] = useState<string[]>([]);
    const [postText, setPostText] = useState("");
    const [postAssets, setPostAssets] = useState<any[]>([]);
    const [isPostSubmitting, setIsPostSubmitting] = useState(false);
    const [isRefreshingWall, setIsRefreshingWall] = useState(false);
    const [postVideoRatios, setPostVideoRatios] = useState<Record<string, number>>({});
    const [postCommentDrafts, setPostCommentDrafts] = useState<Record<string, string>>({});
    const [expandedPostComments, setExpandedPostComments] = useState<Record<string, boolean>>({});
    const [activePostReactionPicker, setActivePostReactionPicker] = useState<string | null>(null);
    const [reactionListPostId, setReactionListPostId] = useState<string | null>(null);
    const [postPrivacyTargetId, setPostPrivacyTargetId] = useState<string | null>(null);
    const wallScrollRef = useRef<ScrollView | null>(null);
    const postOffsetMapRef = useRef<Record<string, number>>({});
    const [highlightPostId, setHighlightPostId] = useState<string | null>(null);

    // ── Overlay items ──
    const [overlayItems, setOverlayItems] = useState<OverlayItem[]>([]);
    const [showMusicSheet, setShowMusicSheet] = useState(false);
    const [showTextInput, setShowTextInput] = useState(false);
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [isDraggingItem, setIsDraggingItem] = useState(false);
    const [isEditorPaused, setIsEditorPaused] = useState(false);
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const trashScaleAnim = useRef(new Animated.Value(1)).current;
    const TRASH_POS = useMemo(() => ({
        x: SCREEN_WIDTH / 2,
        y: insets.top + 52 + 34 + 26, // top + padding + nửa chiều cao circle
        r: 120,                   // vùng bắt rộng → dễ kéo vào hơn
    }), [insets.top]);

    // ── Editor Audio ──
    const editorAudioRef = useRef<any>(null);
    const activeMusicItem = useMemo(() => overlayItems.find(i => i.type === "music"), [overlayItems]);

    const stopEditorAudio = async () => {
        try {
            if (editorAudioRef.current) {
                await editorAudioRef.current.stopAsync?.();
                await editorAudioRef.current.unloadAsync?.();
                editorAudioRef.current = null;
            }
        } catch { }
    };

    const playEditorAudio = async (url: string) => {
        await stopEditorAudio();
        try {
            const { Audio } = require("expo-av");
            const { sound } = await Audio.Sound.createAsync(
                { uri: url },
                { shouldPlay: true, isLooping: true, volume: 1.0 }
            );
            editorAudioRef.current = sound;
        } catch (e) {
            // Web fallback
            try {
                const audio = new (window as any).Audio(url);
                audio.loop = true;
                audio.play();
                editorAudioRef.current = { stopAsync: () => audio.pause(), unloadAsync: () => { }, pause: () => audio.pause(), play: () => audio.play() };
            } catch { }
        }
    };

    // Theo dõi thay đổi nhạc để phát audio
    const lastPlayedUrl = useRef<string | null>(null);

    useEffect(() => {
        if (!targetPostId || posts.length === 0) return;

        let cancelled = false;
        const scrollToTargetPost = () => {
            const y = postOffsetMapRef.current[targetPostId];
            if (typeof y !== "number") return false;

            wallScrollRef.current?.scrollTo({ y: Math.max(0, y - 88), animated: true });
            setHighlightPostId(targetPostId);
            setTimeout(() => {
                if (!cancelled) {
                    setHighlightPostId((current) => current === targetPostId ? null : current);
                }
            }, 2200);
            return true;
        };

        if (scrollToTargetPost()) {
            return () => { cancelled = true; };
        }

        const timers: Array<ReturnType<typeof setTimeout>> = [
            setTimeout(scrollToTargetPost, 350),
            setTimeout(scrollToTargetPost, 900),
            setTimeout(scrollToTargetPost, 1500),
        ];
        return () => {
            cancelled = true;
            timers.forEach(clearTimeout);
        };
    }, [targetPostId, posts.length]);

    useEffect(() => {
        if (creationStep === "EDIT" || creationStep === "TEXT") {
            const musicItem = overlayItems.find(i => i.type === "music");
            const newUrl = (musicItem as any)?.previewUrl || null;

            if (newUrl) {
                // Chỉ phát nếu là bài hát mới
                if (newUrl !== lastPlayedUrl.current) {
                    lastPlayedUrl.current = newUrl;
                    playEditorAudio(newUrl);
                }
            } else {
                // Nếu không còn sticker nhạc nào thì tắt
                lastPlayedUrl.current = null;
                stopEditorAudio();
            }
        } else {
            lastPlayedUrl.current = null;
            stopEditorAudio();
        }
    }, [overlayItems, creationStep]);

    // Đồng bộ isEditorPaused khi mở các sheet trong màn hình edit
    useEffect(() => {
        if (showMusicSheet || showPrivacySheet || showTextInput) {
            setIsEditorPaused(true);
        } else {
            setIsEditorPaused(false);
        }
    }, [showMusicSheet, showPrivacySheet, showTextInput]);

    // Dừng hoặc tiếp tục phát nhạc nền editor
    useEffect(() => {
        if (editorAudioRef.current && typeof editorAudioRef.current.setStatusAsync === "function") {
            editorAudioRef.current.setStatusAsync({ shouldPlay: !isEditorPaused }).catch(() => { });
        } else if (editorAudioRef.current && typeof editorAudioRef.current.pause === "function") {
            if (isEditorPaused) editorAudioRef.current.pause();
            else editorAudioRef.current.play();
        }
    }, [isEditorPaused]);

    // Dọn dẹp khi đóng editor
    useEffect(() => {
        return () => { stopEditorAudio(); };
    }, []);

    // ── Viewer state ──
    const [selectedStory, setSelectedStory] = useState<any>(null);
    const [currentItemIndex, setCurrentItemIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [replyText, setReplyText] = useState("");
    const [showViewers, setShowViewers] = useState(false);
    const [activeTab, setActiveTab] = useState<"VIEWERS" | "REACTIONS">("VIEWERS");
    const [flyingEmojis, setFlyingEmojis] = useState<{ id: number; emoji: string }[]>([]);
    const [isMuted, setIsMuted] = useState(false);
    const [isImageReady, setIsImageReady] = useState(false);
    const [showStoryMenu, setShowStoryMenu] = useState(false);
    const viewerAudioRef = useRef<any>(null);
    const [keyboardH, setKeyboardH] = useState(0);
    const viewShotRef = useRef<any>(null); // ref để chụp story composite

    useEffect(() => {
        const showSub = Keyboard.addListener("keyboardDidShow", (e) => setKeyboardH(e.endCoordinates.height));
        const hideSub = Keyboard.addListener("keyboardDidHide", () => setKeyboardH(0));
        return () => { showSub.remove(); hideSub.remove(); };
    }, []);

    // ── Tối ưu 1: Pre-parsing toàn bộ Feed để không bị khựng khi chuyển Story ──
    const parsedFeedOverlays = useMemo(() => {
        const map = new Map<string, OverlayItem[]>();
        (feed || []).forEach((st: any) => {
            const key = `${st.userId}_${st.createdAt}`;
            map.set(key, parseOverlayItems(st.backgroundConfig));
        });
        return map;
    }, [feed]);

    const storyOverlayItems = useMemo(() => {
        if (!selectedStory) return [];
        const key = `${selectedStory.userId}_${selectedStory.createdAt}`;
        return parsedFeedOverlays.get(key) || [];
    }, [selectedStory, parsedFeedOverlays]);

    // ── Animated values ──
    const creationPanY = useRef(new Animated.Value(0)).current;
    const viewerPanY = useRef(new Animated.Value(0)).current;
    const storySlideX = useRef(new Animated.Value(0)).current;
    const storyFade = useRef(new Animated.Value(1)).current;
    const storyNavDirection = useRef(1);
    const storyProgress = useRef(new Animated.Value(0)).current;
    const replyScrollX = useRef(new Animated.Value(0)).current;
    const progressAnim = useRef<Animated.CompositeAnimation | null>(null);
    const unpauseTimer = useRef<NodeJS.Timeout | null>(null);
    const elapsedProgress = useRef(0);
    const currentUserIndexRef = useRef(0);
    const longPressedPostReactionRef = useRef<string | null>(null);
    const postReactionPickerCloseTimer = useRef<NodeJS.Timeout | null>(null);
    const myUserId = profile?.id;
    const storyFrameWidth = SCREEN_WIDTH;
    const storyFrameHeight = Math.min(SCREEN_HEIGHT - insets.top - insets.bottom - 168, Math.min(SCREEN_WIDTH - 32, 420) * 16 / 9);

    // ── Toast ──
    const [mobileToast, setMobileToast] = useState({ visible: false, message: "" });
    const showToastMsg = useCallback((message: string) => {
        if (isWeb) toast.success(message);
        else {
            setMobileToast({ visible: true, message });
            setTimeout(() => setMobileToast({ visible: false, message: "" }), 3000);
        }
    }, [isWeb]);

    // ── Helpers ──
    const resolveUser = useCallback((userId: string) => {
        if (userId === profile?.id)
            return { displayName: profile?.displayName || "Bạn", avatarUrl: profile?.avatarUrl };
        const f = friends.find(item => item.user.id === userId || item.friend.id === userId);
        if (f) {
            const partner = f.user.id === userId ? f.user : f.friend;
            return { displayName: partner.displayName, avatarUrl: partner.avatarUrl };
        }
        return { displayName: "Người dùng", avatarUrl: null };
    }, [profile, friends]);

    const formatDate = (isoString: string) => {
        if (!isoString) return "";
        const diffMs = Math.max(0, Date.now() - new Date(isoString).getTime());
        const diffMin = Math.floor(diffMs / 60000);
        const diffHr = Math.floor(diffMin / 60);
        if (diffMin < 1) return "Vừa xong";
        if (diffMin < 60) return `${diffMin} phút`;
        if (diffHr < 24) return `${diffHr} giờ`;
        return `${Math.floor(diffHr / 24)} ngày`;
    };

    // ── Data ──
    const buildAvatarUrl = useCallback((name?: string | null, avatarUrl?: string | null) => (
        getImageUrl(avatarUrl) || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "U")}&background=0068FF&color=fff&bold=true`
    ), []);

    const refreshWall = useCallback(async () => {
        setIsRefreshingWall(true);
        try {
            await Promise.all([
                fetchPostFeed(),
                !isWeb ? fetchFeed() : Promise.resolve(),
            ]);
        } finally {
            setIsRefreshingWall(false);
        }
    }, [fetchFeed, fetchPostFeed, isWeb]);

    useEffect(() => {
        fetchPostFeed();
        if (!isWeb) fetchFeed();
    }, [fetchFeed, fetchPostFeed, isWeb]);

    const groupedStories = useMemo(() => {
        const acc: Record<string, any[]> = {};
        (feed || []).forEach((story: any) => {
            if (!acc[story.userId]) acc[story.userId] = [];
            acc[story.userId].push(story);
        });
        Object.keys(acc).forEach(uid => {
            acc[uid].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        });
        return acc;
    }, [feed]);

    const userIds = useMemo(() => {
        const allUids = Object.keys(groupedStories);
        const myGroup = allUids.filter(uid => uid === myUserId);
        const friendUids = allUids.filter(uid => uid !== myUserId);

        const hasUnviewed = (uid: string) =>
            groupedStories[uid].some((st: any) => !st.viewers?.includes(myUserId));

        const unviewedFriends = friendUids
            .filter(uid => hasUnviewed(uid))
            .sort((a, b) => new Date(groupedStories[b][0].createdAt).getTime() - new Date(groupedStories[a][0].createdAt).getTime());

        const viewedFriends = friendUids
            .filter(uid => !hasUnviewed(uid))
            .sort((a, b) => new Date(groupedStories[b][0].createdAt).getTime() - new Date(groupedStories[a][0].createdAt).getTime());

        return [...myGroup, ...unviewedFriends, ...viewedFriends];
    }, [groupedStories, myUserId]);

    // ── Navigation ──
    const handleNextItem = useCallback(() => {
        if (!selectedStory) return;
        storyNavDirection.current = 1;
        const userStories = groupedStories[selectedStory.userId] || [];
        storyProgress.setValue(0);
        elapsedProgress.current = 0;

        if (currentItemIndex < userStories.length - 1) {
            const next = currentItemIndex + 1;
            setCurrentItemIndex(next);
            setSelectedStory(userStories[next]);
        } else {
            const nextUserIndex = currentUserIndexRef.current + 1;
            if (nextUserIndex < userIds.length) {
                const nextUserId = userIds[nextUserIndex];
                const nextUserStories = groupedStories[nextUserId] || [];
                if (nextUserStories.length > 0) {
                    currentUserIndexRef.current = nextUserIndex;
                    setCurrentItemIndex(0);
                    setSelectedStory(nextUserStories[0]);
                    return;
                }
            }
            Keyboard.dismiss();
            setIsTyping(false);
            setReplyText("");
            setKeyboardH(0);
            setSelectedStory(null);
            setCurrentItemIndex(0);
            currentUserIndexRef.current = 0;
        }
    }, [selectedStory, currentItemIndex, groupedStories, userIds]);

    const handlePrevItem = useCallback(() => {
        if (!selectedStory) return;
        storyNavDirection.current = -1;
        storyProgress.setValue(0);
        elapsedProgress.current = 0;

        if (currentItemIndex > 0) {
            const prev = currentItemIndex - 1;
            const userStories = groupedStories[selectedStory.userId] || [];
            setCurrentItemIndex(prev);
            setSelectedStory(userStories[prev]);
        } else {
            const prevUserIndex = currentUserIndexRef.current - 1;
            if (prevUserIndex >= 0) {
                const prevUserId = userIds[prevUserIndex];
                const prevUserStories = groupedStories[prevUserId] || [];
                if (prevUserStories.length > 0) {
                    currentUserIndexRef.current = prevUserIndex;
                    const lastIdx = prevUserStories.length - 1;
                    setCurrentItemIndex(lastIdx);
                    setSelectedStory(prevUserStories[lastIdx]);
                    return;
                }
            }
            const duration = getStoryDuration(selectedStory);
            startProgress(0, duration);
        }
    }, [selectedStory, currentItemIndex, groupedStories, userIds]);

    // ── Progress bar logic ──
    const startProgress = useCallback((fromValue = 0, duration = PHOTO_DURATION_MS) => {
        storyProgress.stopAnimation();
        storyProgress.setValue(fromValue);
        elapsedProgress.current = fromValue;

        const remaining = duration * (1 - fromValue / 100);
        progressAnim.current = Animated.timing(storyProgress, {
            toValue: 100,
            duration: Math.max(0, remaining),
            easing: Easing.linear,
            useNativeDriver: false,
        });

        progressAnim.current.start(({ finished }) => {
            if (finished) handleNextItem();
        });
    }, [storyProgress, handleNextItem]);

    const pauseProgress = useCallback(() => {
        progressAnim.current?.stop();
        // Đọc giá trị synchronous trực tiếp từ Animated.Value
        elapsedProgress.current = (storyProgress as any)._value ?? elapsedProgress.current;
    }, [storyProgress]);

    const resumeProgress = useCallback((duration = PHOTO_DURATION_MS) => {
        startProgress(elapsedProgress.current, duration);
    }, [startProgress]);

    const getStoryDuration = useCallback((story: any): number => {
        if (!story) return PHOTO_DURATION_MS;
        const type = story.storyType || story.mediaType;
        if (type === "LOOP") return LOOP_DURATION_MS;
        if (type === "VIDEO" || type === "video") {
            const videoDurationMs = story.videoDuration
                ? Math.min(story.videoDuration * 1000, VIDEO_MAX_DURATION_S * 1000)
                : VIDEO_MAX_DURATION_S * 1000;
            return videoDurationMs;
        }
        return PHOTO_DURATION_MS;
    }, []);

    // ── Progress effect — 1 effect duy nhất, dùng ref để phân biệt story change vs pause ──
    const prevStoryKeyRef = useRef("");

    useEffect(() => {
        if (!selectedStory) {
            progressAnim.current?.stop();
            storyProgress.setValue(0);
            elapsedProgress.current = 0;
            prevStoryKeyRef.current = "";
            return;
        }

        const storyKey = `${selectedStory.userId}_${selectedStory.createdAt}_${currentItemIndex}`;
        const storyChanged = storyKey !== prevStoryKeyRef.current;

        if (storyChanged) {
            // Story mới → luôn reset và start từ 0, bất kể isPaused
            prevStoryKeyRef.current = storyKey;
            progressAnim.current?.stop();
            storyProgress.setValue(0);
            elapsedProgress.current = 0;
            storySlideX.stopAnimation();
            storyFade.stopAnimation();
            storySlideX.setValue(storyNavDirection.current * 28);
            storyFade.setValue(0.82);
            Animated.parallel([
                Animated.spring(storySlideX, {
                    toValue: 0,
                    speed: 18,
                    bounciness: 4,
                    useNativeDriver: true,
                }),
                Animated.timing(storyFade, {
                    toValue: 1,
                    duration: 180,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
            ]).start();
            if (!isPaused && !isTyping) {
                const duration = getStoryDuration(selectedStory);
                startProgress(0, duration);
            }
        } else {
            // Cùng story → chỉ xử lý pause/resume
            const duration = getStoryDuration(selectedStory);
            if (isPaused || isTyping) {
                pauseProgress();
            } else {
                resumeProgress(duration);
            }
        }
    }, [selectedStory, currentItemIndex, isPaused, isTyping]);

    useEffect(() => {
        if (selectedStory && selectedStory.userId !== myUserId) {
            viewStory(selectedStory.userId, selectedStory.createdAt);
        }
    }, [selectedStory]);

    // isImageReady dùng cho prefetch logic — không dùng làm guard overlay nữa

    // ── Tối ưu 3: Pre-fetch ảnh của Story tiếp theo để hiện tức thì ──
    useEffect(() => {
        if (!selectedStory) return;

        const userStories = groupedStories[selectedStory.userId] || [];
        let nextStory: any = null;

        if (currentItemIndex < userStories.length - 1) {
            nextStory = userStories[currentItemIndex + 1];
        } else {
            const nextUserIndex = currentUserIndexRef.current + 1;
            if (nextUserIndex < userIds.length) {
                const nextUserId = userIds[nextUserIndex];
                const nextUserStories = groupedStories[nextUserId] || [];
                if (nextUserStories.length > 0) {
                    nextStory = nextUserStories[0];
                }
            }
        }

        const nextMediaUrl = nextStory?.mediaUrl;
        if (nextMediaUrl && nextMediaUrl.startsWith("http") && !isVideoStory(nextStory)) {
            Image.prefetch(nextMediaUrl);
        }
    }, [selectedStory, currentItemIndex, groupedStories, userIds]);

    // ── Tối ưu 2: Tải nhạc mượt mà hơn ──
    useEffect(() => {
        // Dọn dẹp âm thanh cũ ngay lập tức
        const cleanup = async () => {
            if (viewerAudioRef.current) {
                const sound = viewerAudioRef.current;
                viewerAudioRef.current = null;
                try {
                    await sound.stopAsync();
                    await sound.unloadAsync();
                } catch { }
            }
        };
        cleanup();

        if (!selectedStory) return;

        // Phát nhạc nếu có music overlay
        const musicItem = storyOverlayItems.find(i => i.type === "music");
        if (musicItem && (musicItem as any).previewUrl && !isMuted) {
            (async () => {
                try {
                    const { Audio } = require("expo-av");
                    // Chỉ set audio mode 1 lần hoặc khi cần thiết, tránh gọi liên tục gây lag
                    await Audio.setAudioModeAsync({
                        playsInSilentModeIOS: true,
                        staysActiveInBackground: false,
                        interruptionModeIOS: 1, // DoNotMix
                        shouldRouteThroughEarpieceAndroid: false,
                    });

                    const { sound } = await Audio.Sound.createAsync(
                        { uri: (musicItem as any).previewUrl },
                        { shouldPlay: true, isLooping: true, volume: 1.0, progressUpdateIntervalMillis: 1000 }
                    );
                    viewerAudioRef.current = sound;
                } catch (e) {
                    console.log("Audio load error:", e);
                }
            })();
        }

        return () => { cleanup(); };
    }, [selectedStory]); // Không reload khi isMuted thay đổi

    // Effect riêng xử lý volume để tránh giật lag khi mute/unmute
    useEffect(() => {
        if (viewerAudioRef.current) {
            viewerAudioRef.current.setVolumeAsync(isMuted ? 0 : 1.0).catch(() => { });
        }
    }, [isMuted]);

    // Pause progress và nhạc khi mở menu
    useEffect(() => {
        // Xử lý pause/resume progress
        if (showStoryMenu) {
            setIsPaused(true);
        } else {
            setIsPaused(false);
        }
    }, [showStoryMenu]);

    // Xử lý audio riêng — dừng/phát nhạc theo isPaused
    useEffect(() => {
        if (viewerAudioRef.current) {
            if (isPaused) {
                viewerAudioRef.current.setStatusAsync?.({ shouldPlay: false }).catch(() => { });
            } else if (!isMuted) {
                viewerAudioRef.current.setStatusAsync?.({ shouldPlay: true }).catch(() => { });
            }
        }
    }, [isPaused, isMuted]);

    const handleCloseMenu = useCallback(() => {
        setShowStoryMenu(false);
        setIsPaused(false);
    }, []);

    const handleDownloadStory = async () => {
        if (!selectedStory) return;

        // TEXT/STATUS story: hiện tại chỉ hỗ trợ báo lỗi hoặc chụp màn hình (giả định chưa hỗ trợ tải file)
        if (selectedStory.mediaType === "TEXT" || selectedStory.mediaType === "STATUS") {
            showToastMsg("Không hỗ trợ tải về story chữ");
            return;
        }

        try {
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== "granted") {
                showToastMsg("Cần quyền truy cập thư viện để tải về");
                return;
            }

            const fileUrl = selectedStory.mediaUrl;
            const fileExt = fileUrl.split(".").pop() || (selectedStory.mediaType === "VIDEO" ? "mp4" : "jpg");
            const fileName = `ZaloStory_${Date.now()}.${fileExt}`;
            // @ts-ignore
            const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory || "";
            const fileUri = dir + fileName;

            const downloadRes = await FileSystem.downloadAsync(fileUrl, fileUri);
            if (downloadRes.status === 200) {
                await MediaLibrary.saveToLibraryAsync(downloadRes.uri);
                showToastMsg("Đã tải về");
            } else {
                throw new Error("Download failed");
            }
        } catch (error) {
            console.error("Download error:", error);
            showToastMsg("Lỗi khi tải về máy");
        }
    };

    const handleDeleteStory = () => {
        if (!selectedStory) return;
        Alert.alert(
            "Xóa khoảnh khắc",
            "Bạn muốn xóa khoảnh khắc này?",
            [
                { text: "Không", style: "cancel" },
                {
                    text: "Xóa",
                    style: "destructive",
                    onPress: async () => {
                        if (!selectedStory) return;
                        const { userId, createdAt } = selectedStory;
                        try {
                            // Assuming storyStore has a deleteStory function
                            const { deleteStory } = useStoryStore.getState();
                            await deleteStory(createdAt as any);
                            await fetchFeed();
                            showToastMsg("Đã xóa");
                            closeStoryViewer();
                            setShowStoryMenu(false);
                        } catch {
                            showToastMsg("Lỗi khi xóa");
                        }
                    }
                }
            ]
        );
    };

    const handleReaction = useCallback((emoji: string) => {
        if (!selectedStory) return;
        setFlyingEmojis(prev => [...prev, { id: Date.now(), emoji }]);
        addReaction(selectedStory.userId, selectedStory.createdAt, REACTION_TYPE_MAP[emoji] || "heart");
    }, [selectedStory, addReaction]);

    /** Đóng story viewer — luôn reset typing state và dismiss keyboard trước */
    const closeStoryViewer = useCallback(() => {
        Keyboard.dismiss();
        setIsTyping(false);
        setReplyText("");
        setKeyboardH(0);
        setSelectedStory(null);
        setCurrentItemIndex(0);
        currentUserIndexRef.current = 0;
    }, []);

    const handleSendMessage = useCallback(async () => {
        if (!replyText.trim() || !selectedStory) return;
        const msgText = replyText.trim();
        setIsTyping(false);
        setIsPaused(false);
        setReplyText("");
        Keyboard.dismiss();

        try {
            const room = await chatService.createPrivateRoom(selectedStory.userId);
            const roomId = room.id;

            const postedAt = selectedStory.createdAt
                ? new Date(selectedStory.createdAt).toLocaleTimeString("vi-VN", {
                    hour: "2-digit", minute: "2-digit",
                })
                : "";

            // Gộp thành 1 tin nhắn duy nhất: story card + text của người dùng
            // thumbnailUri (base64) đã bị loại bỏ vì quá lớn → dùng mediaUrl (remote URL)
            let thumbnailUri = null;
            if (selectedStory.mediaType === 'VIDEO') {
                try {
                    const { uri } = await VideoThumbnails.getThumbnailAsync(selectedStory.mediaUrl, { time: 0 });
                    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
                    thumbnailUri = `data:image/jpeg;base64,${base64}`;
                } catch (e) {
                    console.warn("Failed to generate video thumbnail:", e);
                }
            }

            const storyQuotePayload = JSON.stringify({
                type: "STORY_QUOTE",
                mediaUrl: selectedStory.mediaUrl || null,
                thumbnailUri: thumbnailUri, // Base64 thumbnail for video or permanent fallback
                mediaType: selectedStory.mediaType || "PHOTO",
                postedAt: postedAt,
                storyId: selectedStory.createdAt,
                authorId: selectedStory.userId,
                replyText: msgText,
            });
            await chatService.sendMessage(roomId, storyQuotePayload, undefined, "STORY_REPLY");

            showToastMsg("Đã gửi tin nhắn");
        } catch (e) {
            console.error("Send story reply error:", e);
            showToastMsg("Lỗi khi gửi tin nhắn");
        }
    }, [replyText, selectedStory, showToastMsg]);

    const onScrollBegin = useCallback(() => {
        if (unpauseTimer.current) clearTimeout(unpauseTimer.current);
        setIsPaused(true);
    }, []);

    const resetUnpauseTimer = useCallback(() => {
        if (unpauseTimer.current) clearTimeout(unpauseTimer.current);
        unpauseTimer.current = setTimeout(() => {
            if (!isTyping) setIsPaused(false);
        }, 500);
    }, [isTyping]);

    const onScrollEnd = useCallback(() => {
        resetUnpauseTimer();
    }, [resetUnpauseTimer]);

    useEffect(() => () => {
        if (unpauseTimer.current) clearTimeout(unpauseTimer.current);
        storyProgress.removeAllListeners();
    }, []);

    const panResponder = useRef(PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 10,
        onPanResponderMove: (_, g) => { if (g.dy > 0) creationPanY.setValue(g.dy); },
        onPanResponderRelease: (_, g) => {
            if (g.dy > 100) {
                Animated.timing(creationPanY, { toValue: SCREEN_HEIGHT, duration: 200, useNativeDriver: false })
                    .start(() => setCreationStep("NONE"));
            } else {
                Animated.spring(creationPanY, { toValue: 0, useNativeDriver: false, bounciness: 0 }).start();
            }
        },
    })).current;

    useEffect(() => {
        if (creationStep === "TYPE") {
            creationPanY.setValue(SCREEN_HEIGHT);
            Animated.timing(creationPanY, { toValue: 0, duration: 260, useNativeDriver: false }).start();
        }
    }, [creationStep]);

    const viewerPanResponder = useRef(PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 10,
        onPanResponderMove: (_, g) => { if (g.dy > 0) viewerPanY.setValue(g.dy); },
        onPanResponderRelease: (_, g) => {
            if (g.dy > 100) {
                Animated.timing(viewerPanY, { toValue: SCREEN_HEIGHT, duration: 200, useNativeDriver: false })
                    .start(() => {
                        setShowViewers(false);
                        setIsPaused(false);
                    });
            } else {
                Animated.spring(viewerPanY, { toValue: 0, useNativeDriver: false, bounciness: 0 }).start();
            }
        },
    })).current;

    useEffect(() => {
        if (showViewers) {
            viewerPanY.setValue(SCREEN_HEIGHT);
            Animated.timing(viewerPanY, { toValue: 0, duration: 260, useNativeDriver: false }).start();
        }
    }, [showViewers]);

    const handlePickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images", "videos"],
            allowsMultipleSelection: false,
            quality: 0.85,
            videoMaxDuration: VIDEO_MAX_DURATION_S,
        });
        if (!result.canceled && result.assets[0]) {
            setSelectedAssets([result.assets[0]]);
            setCreationStep("EDIT");
        }
    };

    const handleLaunchCamera = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") { showToastMsg("Cần quyền truy cập máy ảnh"); return; }
        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ["images", "videos"],
            quality: 0.85,
            videoMaxDuration: VIDEO_MAX_DURATION_S,
        });
        if (!result.canceled && result.assets[0]) {
            setSelectedAssets([result.assets[0]]);
            setCreationStep("EDIT");
        }
    };

    const handlePickPostMedia = async (kind: "image" | "video" | "all" = "all") => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: kind === "image" ? ["images"] : kind === "video" ? ["videos"] : ["images", "videos"],
            allowsMultipleSelection: true,
            quality: 0.85,
            videoMaxDuration: 60,
        });
        if (!result.canceled && result.assets[0]) {
            setPostAssets((prev) => [...prev, ...result.assets].slice(0, 10));
        }
    };

    const handleSubmitTimelinePost = async () => {
        if (isPostSubmitting) return;
        if (!postText.trim() && postAssets.length === 0) {
            showToastMsg("Nhập nội dung hoặc chọn ảnh/video");
            return;
        }
        try {
            setIsPostSubmitting(true);
            await createPost(postText, postAssets.map((asset) => asset?.file ?? asset));
            setPostText("");
            setPostAssets([]);
            showToastMsg("Đã đăng bài viết");
        } catch (error) {
            console.error("Create post error:", error);
            showToastMsg("Không thể đăng bài viết");
        } finally {
            setIsPostSubmitting(false);
        }
    };

    const removePostAsset = (index: number) => {
        setPostAssets((prev) => prev.filter((_, i) => i !== index));
    };

    const handleReactTimelinePost = async (postId: string, type: string) => {
        try {
            await reactPost(postId, type);
        } catch (error) {
            console.error("React post error:", error);
            showToastMsg("KhÃ´ng thá»ƒ tháº£ cáº£m xÃºc");
        }
    };

    const handleRemoveTimelinePostReaction = async (postId: string) => {
        try {
            setActivePostReactionPicker(null);
            await removePostReaction(postId);
        } catch (error) {
            console.error("Remove post reaction error:", error);
            showToastMsg("Không thể hủy cảm xúc");
        }
    };

    const handleSubmitPostComment = async (postId: string) => {
        const content = postCommentDrafts[postId] || "";
        if (!content.trim()) return;
        try {
            await commentPost(postId, content);
            setPostCommentDrafts((prev) => ({ ...prev, [postId]: "" }));
            setExpandedPostComments((prev) => ({ ...prev, [postId]: true }));
        } catch (error) {
            console.error("Comment post error:", error);
            showToastMsg("KhÃ´ng thá»ƒ bÃ¬nh luáº­n");
        }
    };

    const handleDeletePostComment = async (postId: string, commentId: string) => {
        try {
            await deletePostComment(postId, commentId);
        } catch (error) {
            console.error("Delete post comment error:", error);
            showToastMsg("Không thể xóa bình luận");
        }
    };

    const getPostReactionEmoji = useCallback((type?: string | null) => {
        return POST_REACTIONS.find((reaction) => reaction.type === type)?.emoji || "👍";
    }, []);

    const postPrivacyToMode = useCallback((privacy?: string | null): PrivacyMode => {
        if (privacy === "SPECIFIC") return "only";
        if (privacy === "EXCLUDE") return "except";
        return "public";
    }, []);

    const modeToPostPrivacy = useCallback((mode: PrivacyMode) => (
        mode === "only" ? "SPECIFIC" : mode === "except" ? "EXCLUDE" : "ALL_FRIENDS"
    ), []);

    const getPrivacyLabel = useCallback((privacy?: string | null) => {
        if (privacy === "SPECIFIC") return "Một số bạn bè";
        if (privacy === "EXCLUDE") return "Ngoại trừ...";
        return "Bạn bè Zalo";
    }, []);

    const openPostPrivacySheet = useCallback((post: any) => {
        setPostPrivacyTargetId(post.id);
        setPrivacyMode(postPrivacyToMode(post.privacy));
        setPrivacyUsers(Array.isArray(post.permittedUserIds) ? post.permittedUserIds : []);
        setShowPrivacySheet(true);
    }, [postPrivacyToMode]);

    const handleSelectPostPrivacy = useCallback(async (mode: PrivacyMode) => {
        const postId = postPrivacyTargetId;
        setPrivacyMode(mode);
        if (!postId) return;
        try {
            await updatePostPrivacy(postId, modeToPostPrivacy(mode), privacyUsers);
            setPostPrivacyTargetId(null);
            setShowPrivacySheet(false);
        } catch (error) {
            console.error("Update post privacy error:", error);
            showToastMsg("Không thể cập nhật đối tượng xem");
        }
    }, [modeToPostPrivacy, postPrivacyTargetId, privacyUsers, showToastMsg, updatePostPrivacy]);

    const openPostReactionPicker = useCallback((postId: string) => {
        if (postReactionPickerCloseTimer.current) {
            clearTimeout(postReactionPickerCloseTimer.current);
            postReactionPickerCloseTimer.current = null;
        }
        setActivePostReactionPicker(postId);
    }, []);

    const scheduleClosePostReactionPicker = useCallback((postId: string) => {
        if (postReactionPickerCloseTimer.current) clearTimeout(postReactionPickerCloseTimer.current);
        postReactionPickerCloseTimer.current = setTimeout(() => {
            setActivePostReactionPicker((current) => current === postId ? null : current);
            postReactionPickerCloseTimer.current = null;
        }, 220);
    }, []);

    const renderPostMedia = (mediaUrl?: string | null, mediaType?: string | null, size: "mobile" | "web" = "mobile") => {
        if (!mediaUrl) return null;
        const uri = getImageUrl(mediaUrl);
        if (!uri) return null;
        if (mediaType === "VIDEO") {
            const ratio = postVideoRatios[uri] || 9 / 16;
            const maxHeight = size === "web" ? 620 : 460;
            const minHeight = size === "web" ? 320 : 260;
            const frameHeight = Math.max(minHeight, Math.min(maxHeight, (size === "web" ? 720 : SCREEN_WIDTH - 24) / ratio));
            if (isWeb) {
                return (
                    <div
                        style={{
                            width: "100%",
                            height: frameHeight,
                            borderRadius: 10,
                            background: "#000",
                            marginTop: 12,
                            overflow: "hidden",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <video
                            src={uri}
                            controls
                            playsInline
                            style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                            onLoadedMetadata={(event) => {
                                const video = event.currentTarget;
                                if (video.videoWidth > 0 && video.videoHeight > 0) {
                                    const nextRatio = video.videoWidth / video.videoHeight;
                                    setPostVideoRatios((prev) => prev[uri] === nextRatio ? prev : { ...prev, [uri]: nextRatio });
                                }
                            }}
                        />
                    </div>
                );
            }
            return (
                <View style={{ width: "100%", height: frameHeight, borderRadius: 10, backgroundColor: "#000", marginTop: 12, overflow: "hidden" }}>
                    <Video
                        source={{ uri }}
                        style={{ width: "100%", height: "100%" }}
                        resizeMode={ResizeMode.CONTAIN}
                        useNativeControls
                        shouldPlay={false}
                        isLooping={false}
                        onReadyForDisplay={(event: any) => {
                            const natural = event?.naturalSize;
                            if (natural?.width > 0 && natural?.height > 0) {
                                const nextRatio = natural.width / natural.height;
                                setPostVideoRatios((prev) => prev[uri] === nextRatio ? prev : { ...prev, [uri]: nextRatio });
                            }
                        }}
                    />
                </View>
            );
        }
        const height = size === "web" ? 360 : 260;
        return <Image source={{ uri }} style={{ width: "100%", height, borderRadius: 10, marginTop: 12, backgroundColor: colors.border }} resizeMode="cover" />;
    };

    const renderPostMediaItems = (post: any, size: "mobile" | "web" = "mobile") => {
        const mediaItems = Array.isArray(post.mediaItems) && post.mediaItems.length > 0
            ? post.mediaItems
            : post.mediaUrl
                ? [{ id: post.id, mediaUrl: post.mediaUrl, mediaType: post.mediaType, sortOrder: 0 }]
                : [];
        if (mediaItems.length === 0) return null;
        if (mediaItems.length === 1) {
            return renderPostMedia(mediaItems[0].mediaUrl, mediaItems[0].mediaType, size);
        }

        const gap = 6;
        const itemHeight = size === "web" ? 220 : 170;
        return (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap, marginTop: 12 }}>
                {mediaItems.slice(0, 6).map((item: any, index: number) => {
                    const uri = getImageUrl(item.mediaUrl);
                    const isVideo = item.mediaType === "VIDEO" || /\.(mp4|mov|m4v|webm|3gp)(\?|$)/i.test(String(item.mediaUrl || ""));
                    const basis = mediaItems.length === 2 ? "48.8%" : "32%";
                    return (
                        <View key={item.id || `${post.id}_${index}`} style={{ width: basis as any, height: itemHeight, borderRadius: 10, overflow: "hidden", backgroundColor: "#000" }}>
                            {isVideo ? (
                                !!uri ? <Video source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode={ResizeMode.CONTAIN} useNativeControls shouldPlay={false} /> : <View style={{ width: "100%", height: "100%" }} />
                            ) : (
                                !!uri ? <Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" /> : <View style={{ width: "100%", height: "100%" }} />
                            )}
                            {index === 5 && mediaItems.length > 6 ? (
                                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" }]}>
                                    <Text style={{ color: "#fff", fontSize: 20, fontWeight: "800" }}>+{mediaItems.length - 6}</Text>
                                </View>
                            ) : null}
                        </View>
                    );
                })}
            </View>
        );
    };

    const renderPostInteractions = (post: any, size: "mobile" | "web" = "mobile") => {
        const reactions = Array.isArray(post.reactions) ? post.reactions : [];
        const comments = Array.isArray(post.comments) ? post.comments : [];
        const myReaction = reactions.find((reaction: any) => reaction.userId === profile?.id);
        const isCommentsOpen = !!expandedPostComments[post.id];
        const isWeb = size === "web";
        const isReactionPickerOpen = activePostReactionPicker === post.id;
        return (
            <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <TouchableOpacity
                        disabled={reactions.length === 0}
                        onPress={() => reactions.length > 0 && setReactionListPostId(post.id)}
                    >
                        <Text style={{ color: reactions.length > 0 ? colors.primary : colors.textSecondary, fontSize: 12, fontWeight: reactions.length > 0 ? "700" : "500" }}>
                            {reactions.length} cảm xúc
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setExpandedPostComments((prev) => ({ ...prev, [post.id]: !prev[post.id] }))}>
                        <Text style={{ color: isCommentsOpen ? colors.primary : colors.textSecondary, fontSize: 12, fontWeight: isCommentsOpen ? "700" : "500" }}>
                            {comments.length} bình luận
                        </Text>
                    </TouchableOpacity>
                </View>
                <View style={{ flexDirection: "row", gap: 8, marginBottom: isCommentsOpen ? 12 : 0 }}>
                    <Pressable
                        onHoverIn={() => {
                            if (isWeb) openPostReactionPicker(post.id);
                        }}
                        onHoverOut={() => {
                            if (isWeb) scheduleClosePostReactionPicker(post.id);
                        }}
                        onLongPress={() => {
                            if (!isWeb) {
                                longPressedPostReactionRef.current = post.id;
                                openPostReactionPicker(post.id);
                            }
                        }}
                        onPress={() => {
                            if (longPressedPostReactionRef.current === post.id) {
                                longPressedPostReactionRef.current = null;
                                return;
                            }
                            if (myReaction) {
                                handleRemoveTimelinePostReaction(post.id);
                                return;
                            }
                            handleReactTimelinePost(post.id, "like");
                        }}
                        style={{
                            flex: 1,
                            position: "relative",
                            height: isWeb ? 38 : 36,
                            borderRadius: 8,
                            backgroundColor: myReaction ? "rgba(0, 104, 255, 0.15)" : "transparent",
                            alignItems: "center",
                            justifyContent: "center",
                            zIndex: isReactionPickerOpen ? 10 : 1,
                        }}
                    >
                        {isReactionPickerOpen ? (
                            <Pressable
                                onHoverIn={() => {
                                    if (isWeb) openPostReactionPicker(post.id);
                                }}
                                onHoverOut={() => {
                                    if (isWeb) scheduleClosePostReactionPicker(post.id);
                                }}
                                style={{
                                    position: "absolute",
                                    bottom: isWeb ? 36 : 36,
                                    left: 0,
                                    alignItems: "flex-start",
                                    paddingTop: 12,
                                    paddingBottom: 8,
                                    zIndex: 20,
                                }}
                            >
                                <View
                                    style={{
                                        flexDirection: "row",
                                        gap: 6,
                                        paddingHorizontal: 8,
                                        paddingVertical: 7,
                                        borderRadius: 24,
                                        backgroundColor: colors.card,
                                        borderWidth: 1,
                                        borderColor: colors.border,
                                        shadowColor: "#000",
                                        shadowOpacity: 0.16,
                                        shadowRadius: 12,
                                        shadowOffset: { width: 0, height: 6 },
                                        elevation: 8,
                                    }}
                                >
                                    {POST_REACTIONS.map((reaction) => (
                                        <TouchableOpacity
                                            key={reaction.type}
                                            onPress={() => {
                                                setActivePostReactionPicker(null);
                                                handleReactTimelinePost(post.id, reaction.type);
                                            }}
                                            style={{
                                                width: isWeb ? 34 : 38,
                                                height: isWeb ? 34 : 38,
                                                borderRadius: 19,
                                                alignItems: "center",
                                                justifyContent: "center",
                                                backgroundColor: myReaction?.type === reaction.type ? "rgba(0, 104, 255, 0.15)" : "transparent",
                                            }}
                                        >
                                            <Text style={{ fontSize: isWeb ? 20 : 22 }}>{reaction.emoji}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </Pressable>
                        ) : null}
                        <Text style={{ color: myReaction ? colors.primary : colors.text, fontWeight: "700", fontSize: myReaction ? 20 : 14 }}>
                            {myReaction ? getPostReactionEmoji(myReaction.type) : "Thả cảm xúc"}
                        </Text>
                    </Pressable>
                    <TouchableOpacity
                        onPress={() => setExpandedPostComments((prev) => ({ ...prev, [post.id]: !prev[post.id] }))}
                        style={{
                            flex: 1,
                            height: isWeb ? 38 : 36,
                            borderRadius: 8,
                            backgroundColor: isCommentsOpen ? "rgba(0, 104, 255, 0.15)" : "transparent",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <Text style={{ color: isCommentsOpen ? colors.primary : colors.text, fontWeight: "700" }}>
                            Bình luận
                        </Text>
                    </TouchableOpacity>
                </View>
                {isCommentsOpen ? (
                    <View style={{ gap: 10 }}>
                        {comments.length === 0 ? (
                            <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: "center", paddingVertical: 4 }}>
                                Chưa có bình luận nào.
                            </Text>
                        ) : comments.map((comment: any) => {
                            const isMyComment = comment.userId === profile?.id;
                            const commentName = isMyComment ? "Tôi" : (comment.displayName || comment.username);
                            return (
                                <View key={comment.id} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                                    <AvatarImage name={commentName} uri={comment.avatarUrl} size={30} />
                                    <View style={{ flex: 1 }}>
                                        <View style={{ alignSelf: "flex-start", maxWidth: "100%", minWidth: 116, backgroundColor: colors.searchBg, borderRadius: 14, paddingLeft: 12, paddingRight: 58, paddingVertical: 8, position: "relative" }}>
                                            <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "700", fontSize: 13, maxWidth: "100%" }}>
                                                {commentName}
                                            </Text>
                                            {!!comment.createdAt && (
                                                <Text numberOfLines={1} style={{ position: "absolute", top: 9, right: 10, color: colors.textSecondary, fontSize: 11 }}>
                                                    {formatDate(comment.createdAt)}
                                                </Text>
                                            )}
                                            <Text style={{ color: colors.text, marginTop: 2, lineHeight: 19 }}>{comment.content}</Text>
                                        </View>
                                    </View>
                                    {isMyComment ? (
                                        <TouchableOpacity onPress={() => handleDeletePostComment(post.id, comment.id)} style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.searchBg }}>
                                            <Ionicons name="trash-outline" size={14} color={colors.textSecondary} />
                                        </TouchableOpacity>
                                    ) : null}
                                </View>
                            );
                        })}
                        <View style={{ flexDirection: "row", gap: 8, alignItems: "center", paddingTop: 2 }}>
                            <AvatarImage name={profile?.displayName || profile?.username} uri={profile?.avatarUrl} size={30} />
                            <TextInput
                                value={postCommentDrafts[post.id] || ""}
                                onChangeText={(text) => setPostCommentDrafts((prev) => ({ ...prev, [post.id]: text }))}
                                placeholder="Viết bình luận..."
                                placeholderTextColor={colors.textSecondary}
                                style={{ flex: 1, minHeight: 38, borderRadius: 19, paddingHorizontal: 14, backgroundColor: colors.searchBg, color: colors.text }}
                            />
                            <TouchableOpacity onPress={() => handleSubmitPostComment(post.id)} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
                                <Ionicons name="send" size={16} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : null}
            </View>
        );
    };

    const renderPostReactionsModal = () => {
        const post = reactionListPostId ? posts.find((item) => item.id === reactionListPostId) : null;
        const reactions = Array.isArray(post?.reactions) ? post!.reactions : [];
        return (
            <Modal visible={!!reactionListPostId} transparent animationType="fade" onRequestClose={() => setReactionListPostId(null)}>
                <TouchableWithoutFeedback onPress={() => setReactionListPostId(null)}>
                    <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", alignItems: "center", padding: 18 }}>
                        <TouchableWithoutFeedback>
                            <View style={{ width: "100%", maxWidth: 420, maxHeight: "70%" as any, backgroundColor: colors.card, borderRadius: 16, padding: 16 }}>
                                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                                    <View>
                                        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>Cảm xúc</Text>
                                        <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>{reactions.length} người đã thả cảm xúc</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => setReactionListPostId(null)} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.searchBg, alignItems: "center", justifyContent: "center" }}>
                                        <Ionicons name="close" size={18} color={colors.text} />
                                    </TouchableOpacity>
                                </View>
                                <ScrollView showsVerticalScrollIndicator={false}>
                                    {reactions.length === 0 ? (
                                        <Text style={{ color: colors.textSecondary, textAlign: "center", paddingVertical: 24 }}>Chưa có cảm xúc nào.</Text>
                                    ) : reactions.map((reaction: any) => {
                                        const displayName = reaction.displayName || "Người dùng";
                                        const isMe = reaction.userId === profile?.id;
                                        return (
                                            <View key={`${reaction.userId}_${reaction.type}`} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9 }}>
                                                <AvatarImage name={displayName} uri={reaction.avatarUrl} size={38} />
                                                <View style={{ flex: 1 }}>
                                                    <Text style={{ color: colors.text, fontWeight: "700" }}>{isMe ? "Tôi" : displayName}</Text>
                                                </View>
                                                <Text style={{ fontSize: 24 }}>{getPostReactionEmoji(reaction.type)}</Text>
                                            </View>
                                        );
                                    })}
                                </ScrollView>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        );
    };

    const isVideoStory = (story?: any) => {
        if (!story) return false;
        const mediaUrl = String(story.mediaUrl || "").toLowerCase();
        return story.mediaType === "VIDEO"
            || story.storyType === "VIDEO"
            || /\.(mp4|mov|m4v|webm|3gp)(\?|$)/i.test(mediaUrl);
    };

    const isVideoAsset = (asset?: any) => {
        if (!asset) return false;
        const uri = String(asset.uri || "");
        const mimeType = String(asset.mimeType || "");
        return asset.type === "video"
            || mimeType.startsWith("video/")
            || /\.(mp4|mov|m4v|webm|3gp)(\?|$)/i.test(uri);
    };

    const handlePost = async () => {
        if (isPosting) return;
        const privacyParam = privacyMode === "public" ? "ALL_FRIENDS"
            : privacyMode === "only" ? "SPECIFIC" : "EXCLUDE";

        if (creationStep === "EDIT" && selectedAssets[0]) {
            const asset = selectedAssets[0];
            const isVideo = isVideoAsset(asset);
            if (isVideo && asset.duration && asset.duration > VIDEO_MAX_DURATION_S * 1000) {
                showToastMsg(`Video tối đa ${VIDEO_MAX_DURATION_S} giây theo quy định`);
                return;
            }
        }

        try {
            setIsPosting(true);

            // Serialize overlayItems để lưu cùng story
            const overlayMeta = overlayItems.length > 0
                ? JSON.stringify(overlayItems.map(i => ({
                    id: i.id,
                    type: i.type,
                    x: i.x,
                    y: i.y,
                    rotation: i.rotation,
                    scale: i.scale,
                    textContent: i.textContent,
                    textStyle: i.textStyle,
                    musicTitle: i.musicTitle,
                    musicArtist: i.musicArtist,
                    musicThumb: i.musicThumb,
                    previewUrl: (i as any).previewUrl,
                })))
                : undefined;

            if (creationStep === "TEXT") {
                await uploadStory(null, textContent, {
                    storyType: "STATUS",
                    privacy: privacyParam,
                    permittedUserIds: privacyUsers,
                    backgroundConfig: bgConfig,
                    // overlayMeta gửi kèm nếu server hỗ trợ field riêng
                    // Nếu không có field riêng: nhúng vào backgroundConfig
                    ...(overlayMeta && { backgroundConfig: bgConfig + "|||" + overlayMeta }),
                });
            } else {
                for (const asset of selectedAssets) {
                    const isVideo = isVideoAsset(asset);
                    await uploadStory(asset, textContent, {
                        storyType: isVideo ? "VIDEO" : "PHOTO",
                        privacy: privacyParam,
                        permittedUserIds: privacyUsers,
                        backgroundConfig: overlayMeta
                            ? (bgConfig || "") + "|||" + overlayMeta
                            : bgConfig,
                    });
                }
            }
            await fetchFeed();
            showToastMsg("Đã đăng Khoảnh khắc!");
            setCreationStep("NONE");
            setSelectedAssets([]);
            setTextContent("");
            setBgConfig(BG_COLORS[0]);
            setPrivacyMode("public");
            setPrivacyUsers([]);
            setShowPrivacySheet(false);
            setOverlayItems([]);
            setShowMusicSheet(false);
            setShowTextInput(false);
        } catch {
            showToastMsg("Lỗi khi đăng, vui lòng thử lại");
        } finally {
            setIsPosting(false);
        }
    };

    const forceCloseEditor = useCallback(() => {
        setCreationStep("NONE");
        setSelectedAssets([]);
        setTextContent("");
        setBgConfig(BG_COLORS[0]);
        setPrivacyMode("public");
        setPrivacyUsers([]);
        setShowPrivacySheet(false);
        setOverlayItems([]);
        setShowMusicSheet(false);
        setShowTextInput(false);
        setShowExitConfirm(false);
    }, []);

    const closeEditor = useCallback(() => {
        if (overlayItems.length > 0 || (creationStep === "TEXT" && textContent.trim().length > 0)) {
            setShowExitConfirm(true);
        } else {
            forceCloseEditor();
        }
    }, [overlayItems.length, creationStep, textContent, forceCloseEditor]);

    const handleAddMusic = useCallback((track: MusicTrack) => {
        // Xóa nhạc cũ nếu có (chỉ cho phép 1 bài)
        setOverlayItems(prev => prev.filter(i => i.type !== "music"));

        const newItem: OverlayItem = {
            id: `music_${Date.now()}`,
            type: "music",
            x: SCREEN_WIDTH / 2 - 120,
            y: SCREEN_HEIGHT * 0.3,
            rotation: 0,
            scale: 1,
            musicTitle: track.title,
            musicArtist: track.artist,
            musicThumb: track.thumbnail,
            // @ts-ignore: Lưu thêm url để phát lặp lại
            previewUrl: track.previewUrl,
        };
        setOverlayItems(prev => [...prev, newItem]);
    }, []);

    const handleAddText = useCallback((text: string, style: "normal" | "italic" | "bold") => {
        if (editingItemId) {
            // Edit lại item đã có
            setOverlayItems(prev => prev.map(item =>
                item.id === editingItemId
                    ? { ...item, textContent: text, textStyle: style }
                    : item
            ));
            setEditingItemId(null);
        } else {
            // Thêm item mới
            const newItem: OverlayItem = {
                id: `text_${Date.now()}`,
                type: "text",
                x: SCREEN_WIDTH / 2 - 80,
                y: SCREEN_HEIGHT * 0.4,
                rotation: 0,
                scale: 1,
                textContent: text,
                textStyle: style,
            };
            setOverlayItems(prev => [...prev, newItem]);
        }
        setShowTextInput(false);
    }, [editingItemId]);

    const handleUpdateOverlayItem = useCallback((id: string, changes: Partial<OverlayItem>) => {
        setOverlayItems(prev => prev.map(item => item.id === id ? { ...item, ...changes } : item));
    }, []);

    const handleDeleteOverlayItem = useCallback((id: string) => {
        setOverlayItems(prev => prev.filter(item => item.id !== id));
    }, []);

    if (isWeb) {
        return (
            <View style={{ height: "100vh" as any, flex: 1, backgroundColor: colors.background, alignItems: "center", overflow: "hidden" as any }}>
                <ScrollView
                    ref={wallScrollRef}
                    style={{ width: "100%", flex: 1 }}
                    contentContainerStyle={{ width: "100%", maxWidth: 720, alignSelf: "center", padding: 24, paddingBottom: 40, gap: 14 }}
                    refreshControl={<RefreshControl refreshing={isRefreshingWall} onRefresh={refreshWall} tintColor="#0068FF" />}
                >
                    <Text style={{ fontSize: 26, fontWeight: "800", color: colors.text }}>Tường nhà</Text>
                    <StoryFeedWeb />
                    <View style={[styles.timelineComposer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                            <Image source={{ uri: buildAvatarUrl(profile?.displayName || profile?.username, profile?.avatarUrl) }} style={[styles.timelineComposerAvatar, { backgroundColor: colors.searchBg }]} />
                            <TextInput value={postText} onChangeText={setPostText} placeholder="Hôm nay bạn thế nào?" placeholderTextColor={colors.textSecondary} style={[styles.timelineComposerInput, { color: colors.text, backgroundColor: colors.searchBg }]} />
                            <TouchableOpacity onPress={handleSubmitTimelinePost} disabled={isPostSubmitting} style={[styles.timelinePostButton, { opacity: isPostSubmitting ? 0.6 : 1 }]}>
                                <Text style={{ color: "#fff", fontWeight: "700" }}>{isPostSubmitting ? "Đang đăng" : "Đăng"}</Text>
                            </TouchableOpacity>
                        </View>
                        {postAssets.length > 0 ? (
                            <View style={{ marginTop: 12 }}>
                                {isVideoAsset(postAssets[0]) ? (
                                    <Video source={{ uri: postAssets[0].uri }} style={styles.timelinePreviewMedia} resizeMode={ResizeMode.CONTAIN} useNativeControls />
                                ) : (
                                    <Image source={{ uri: postAssets[0].uri }} style={styles.timelinePreviewMedia} resizeMode="cover" />
                                )}
                                <TouchableOpacity onPress={() => setPostAssets([])} style={{ marginTop: 8 }}>
                                    <Text style={{ color: "#ef4444", fontWeight: "600" }}>Bỏ media</Text>
                                </TouchableOpacity>
                            </View>
                        ) : null}
                        <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                            <TouchableOpacity onPress={() => handlePickPostMedia("image")} style={[styles.postComposerPill, { backgroundColor: colors.isDark ? "#2C2C2E" : "#F1F3F5" }]}><Ionicons name="image" size={16} color="#22C55E" /><Text style={[styles.postComposerPillText, { color: colors.text }]}>Ảnh</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => handlePickPostMedia("video")} style={[styles.postComposerPill, { backgroundColor: colors.isDark ? "#2C2C2E" : "#F1F3F5" }]}><Ionicons name="videocam" size={16} color="#D946EF" /><Text style={[styles.postComposerPillText, { color: colors.text }]}>Video</Text></TouchableOpacity>
                        </View>
                    </View>
                    {postsLoading ? <ActivityIndicator color="#0068FF" /> : posts.map((post) => (
                        <View
                            key={post.id}
                            onLayout={(event) => { postOffsetMapRef.current[post.id] = event.nativeEvent.layout.y; }}
                            style={[
                                styles.timelinePostCard,
                                { backgroundColor: colors.card, borderColor: colors.border },
                                highlightPostId === post.id && {
                                    borderColor: colors.primary,
                                    shadowColor: colors.primary,
                                    shadowOpacity: 0.16,
                                    shadowRadius: 12,
                                    shadowOffset: { width: 0, height: 6 },
                                },
                            ]}
                        >
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                                <Image source={{ uri: buildAvatarUrl(post.displayName || post.username, post.avatarUrl) }} style={[styles.timelinePostAvatar, { backgroundColor: colors.searchBg }]} />
                                <View>
                                    <Text style={{ color: colors.text, fontWeight: "700" }}>{post.displayName || post.username}</Text>
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{formatDate(post.createdAt)}</Text>
                                        {post.userId === profile?.id ? (
                                            <TouchableOpacity onPress={() => openPostPrivacySheet(post)} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                                                <Ionicons name="people-outline" size={12} color={colors.textSecondary} />
                                                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{getPrivacyLabel(post.privacy)}</Text>
                                            </TouchableOpacity>
                                        ) : null}
                                    </View>
                                </View>
                            </View>
                            {!!post.content && <Text style={{ color: colors.text, marginTop: 12, fontSize: 15, lineHeight: 21 }}>{post.content}</Text>}
                            {renderPostMediaItems(post, "web")}
                            {renderPostInteractions(post, "web")}
                        </View>
                    ))}
                </ScrollView>
                {renderPostReactionsModal()}
                {postPrivacyTargetId && showPrivacySheet ? (
                    <PrivacySheet
                        visible={showPrivacySheet}
                        privacyMode={privacyMode}
                        onSelect={handleSelectPostPrivacy}
                        onClose={() => { setShowPrivacySheet(false); setPostPrivacyTargetId(null); }}
                        bottomInset={insets.bottom}
                        colors={colors}
                        title="Ai được xem bài viết này?"
                        subtitle="Bạn có thể đổi đối tượng xem bài viết bất cứ lúc nào"
                    />
                ) : null}
            </View>
        );
    }

    if (false && isWeb) {
        return (
            <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="home-outline" size={80} color={colors.textSecondary} style={{ opacity: 0.3 }} />
                <Text style={{ fontSize: 24, fontWeight: "bold", color: colors.text, marginTop: 16 }}>Tường nhà</Text>
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <StatusBar style={colors.statusBar} />
            {renderPostReactionsModal()}
            {postPrivacyTargetId && showPrivacySheet ? (
                <PrivacySheet
                    visible={showPrivacySheet}
                    privacyMode={privacyMode}
                    onSelect={handleSelectPostPrivacy}
                    onClose={() => { setShowPrivacySheet(false); setPostPrivacyTargetId(null); }}
                    bottomInset={insets.bottom}
                    colors={colors}
                    title="Ai được xem bài viết này?"
                    subtitle="Bạn có thể đổi đối tượng xem bài viết bất cứ lúc nào"
                />
            ) : null}

            <ChatListHeader />

            <ScrollView
                ref={wallScrollRef}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={isRefreshingWall} onRefresh={refreshWall} tintColor="#0068FF" />}
            >
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 12 }} style={{ backgroundColor: colors.card, marginBottom: 8 }}>
                    <TouchableOpacity onPress={() => { creationPanY.setValue(SCREEN_HEIGHT); setCreationStep("TYPE"); }} style={styles.storyCard}>
                        <Image source={{ uri: buildAvatarUrl(profile?.displayName || profile?.username, profile?.avatarUrl) }} style={[StyleSheet.absoluteFillObject, { resizeMode: "cover" }]} />
                        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "flex-end", alignItems: "center", paddingBottom: 12 }]}>
                            <View style={styles.createBtn}><Ionicons name="add" size={24} color="white" /></View>
                            <Text style={styles.storyLabel}>Tạo mới</Text>
                        </View>
                    </TouchableOpacity>

                    {userIds.map((uid, uidIndex) => {
                        const userStories = groupedStories[uid] || [];
                        const s = userStories[0];
                        const isMe = uid === myUserId;
                        const allViewed = userStories.every((st: any) => st.viewers?.includes(myUserId));
                        return (
                            <TouchableOpacity key={uid} onPress={() => { currentUserIndexRef.current = uidIndex; storyProgress.setValue(0); elapsedProgress.current = 0; setCurrentItemIndex(0); setSelectedStory(userStories[0]); }} style={styles.storyCard}>
                                {s.mediaType === "TEXT" ? (
                                    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: s.backgroundConfig || "#0068FF", justifyContent: "center", alignItems: "center", padding: 8 }]}>
                                        <Text style={{ color: "white", fontSize: 11, textAlign: "center" }} numberOfLines={4}>{s.caption}</Text>
                                    </View>
                                ) : isVideoStory(s) ? (
                                    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "#111827", justifyContent: "center", alignItems: "center", padding: 8 }]}>
                                        <Ionicons name="play-circle" size={34} color="rgba(255,255,255,0.92)" />
                                        {!!s.caption && (
                                            <Text style={{ color: "rgba(255,255,255,0.86)", fontSize: 10, marginTop: 4, textAlign: "center" }} numberOfLines={2}>
                                                {s.caption}
                                            </Text>
                                        )}
                                    </View>
                                ) : (
                                    !!(getImageUrl(s.mediaUrl) || getImageUrl(s.avatarUrl)) ? <Image source={{ uri: getImageUrl(s.mediaUrl) || getImageUrl(s.avatarUrl) }} style={[StyleSheet.absoluteFillObject, { resizeMode: "cover" }]} /> : <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "#222" }]} />
                                )}
                                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.15)", justifyContent: "flex-end", alignItems: "center", paddingBottom: 10 }]}>
                                    <View style={[styles.avatarBorder, { borderColor: allViewed ? "#C0C0C0" : colors.primary }]}>
                                        <AvatarImage name={s.displayName} uri={s.avatarUrl} size={30} />
                                    </View>
                                    <Text numberOfLines={1} style={[styles.storyLabel, allViewed && { color: "rgba(255,255,255,0.6)" }]}>{isMe ? "Tôi" : s.displayName}</Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
                <View style={[styles.mobilePostComposer, { backgroundColor: colors.card }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <AvatarImage name={profile?.displayName || profile?.username} uri={profile?.avatarUrl} size={40} style={[styles.mobilePostAvatar, { backgroundColor: colors.searchBg }]} />
                        <TextInput
                            value={postText}
                            onChangeText={setPostText}
                            placeholder="Hôm nay bạn thế nào?"
                            placeholderTextColor={colors.textSecondary}
                            style={[styles.mobilePostInput, { backgroundColor: colors.searchBg, color: colors.text }]}
                        />
                    </View>
                    {postAssets.length > 0 ? (
                        <View style={{ marginTop: 12 }}>
                            {isVideoAsset(postAssets[0]) ? (
                                <Video source={{ uri: postAssets[0].uri }} style={styles.mobilePostPreview} resizeMode={ResizeMode.CONTAIN} useNativeControls />
                            ) : (
                                <Image source={{ uri: postAssets[0].uri }} style={styles.mobilePostPreview} resizeMode="cover" />
                            )}
                            <TouchableOpacity onPress={() => setPostAssets([])} style={{ marginTop: 8 }}>
                                <Text style={{ color: "#FF3B30", fontWeight: "600" }}>Bỏ media</Text>
                            </TouchableOpacity>
                        </View>
                    ) : null}
                    <View style={styles.mobilePostActionRow}>
                        <TouchableOpacity onPress={() => handlePickPostMedia("image")} style={[styles.mobilePostAction, { backgroundColor: colors.isDark ? "#2C2C2E" : "#F1F3F5" }]}><Ionicons name="image" size={16} color="#22C55E" /><Text style={[styles.mobilePostActionText, { color: colors.text }]}>Ảnh</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => handlePickPostMedia("video")} style={[styles.mobilePostAction, { backgroundColor: colors.isDark ? "#2C2C2E" : "#F1F3F5" }]}><Ionicons name="videocam" size={16} color="#D946EF" /><Text style={[styles.mobilePostActionText, { color: colors.text }]}>Video</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => handlePickPostMedia("all")} style={[styles.mobilePostAction, { backgroundColor: colors.isDark ? "#2C2C2E" : "#F1F3F5" }]}><Ionicons name="albums" size={16} color="#3B82F6" /><Text style={[styles.mobilePostActionText, { color: colors.text }]}>Album</Text></TouchableOpacity>
                        <TouchableOpacity onPress={handleSubmitTimelinePost} disabled={isPostSubmitting} style={[styles.mobileSubmitPostBtn, { opacity: isPostSubmitting ? 0.6 : 1 }]}><Text style={styles.mobileSubmitPostText}>Đăng</Text></TouchableOpacity>
                    </View>
                </View>

                <View style={{ paddingHorizontal: 12, gap: 10 }}>
                    {posts.map((post) => (
                        <View
                            key={post.id}
                            onLayout={(event) => { postOffsetMapRef.current[post.id] = event.nativeEvent.layout.y; }}
                            style={[
                                styles.mobileTimelinePost,
                                { backgroundColor: colors.card },
                                highlightPostId === post.id && {
                                    borderWidth: 1.5,
                                    borderColor: colors.primary,
                                    shadowColor: colors.primary,
                                    shadowOpacity: 0.16,
                                    shadowRadius: 10,
                                    shadowOffset: { width: 0, height: 5 },
                                    elevation: 3,
                                },
                            ]}
                        >
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                                <AvatarImage name={post.displayName || post.username} uri={post.avatarUrl} size={40} style={[styles.mobilePostAvatar, { backgroundColor: colors.searchBg }]} />
                                <View>
                                    <Text style={{ color: colors.text, fontWeight: "700" }}>{post.displayName || post.username}</Text>
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{formatDate(post.createdAt)}</Text>
                                        {post.userId === profile?.id ? (
                                            <TouchableOpacity onPress={() => openPostPrivacySheet(post)} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                                                <Ionicons name="people-outline" size={12} color={colors.textSecondary} />
                                                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{getPrivacyLabel(post.privacy)}</Text>
                                            </TouchableOpacity>
                                        ) : null}
                                    </View>
                                </View>
                            </View>
                            {!!post.content && <Text style={{ color: colors.text, marginTop: 12, lineHeight: 20 }}>{post.content}</Text>}
                            {renderPostMediaItems(post, "mobile")}
                            {renderPostInteractions(post, "mobile")}
                        </View>
                    ))}
                </View>
            </ScrollView>

            <Modal visible={creationStep !== "NONE"} transparent animationType="none" statusBarTranslucent onRequestClose={closeEditor}>
                <View style={{ flex: 1, backgroundColor: creationStep === "TYPE" ? "rgba(0,0,0,0.5)" : "black" }}>
                    {(creationStep === "EDIT" || creationStep === "TEXT") && (
                        <View style={{ flex: 1 }}>
                            {creationStep === "TEXT" ? (
                                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                                    <View style={{ flex: 1, backgroundColor: bgConfig, justifyContent: "center", alignItems: "center", padding: 40 }}>
                                        <TextInput multiline autoFocus style={styles.textStoryInput} value={textContent} onChangeText={setTextContent} placeholder="Nhập nội dung..." placeholderTextColor="rgba(255,255,255,0.5)" returnKeyType="done" blurOnSubmit={true} />
                                    </View>
                                </TouchableWithoutFeedback>
                            ) : (
                                <View style={{ flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" }}>
                                    {selectedAssets[0] && (
                                        isVideoAsset(selectedAssets[0]) ? (
                                            <Video source={{ uri: selectedAssets[0].uri }} style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }} resizeMode={ResizeMode.CONTAIN} shouldPlay={false} isLooping={false} useNativeControls />
                                        ) : (
                                            <Image source={{ uri: selectedAssets[0].uri }} style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }} resizeMode="contain" />
                                        )
                                    )}
                                </View>
                            )}

                            {/* Overlay Items Wrapper */}
                            <View style={[StyleSheet.absoluteFillObject, { zIndex: 10 }]} pointerEvents="box-none">
                                {overlayItems.map(item => (
                                    <DraggableOverlayItem
                                        key={item.id}
                                        item={item}
                                        onUpdate={handleUpdateOverlayItem}
                                        onDelete={handleDeleteOverlayItem}
                                        onEdit={(id) => {
                                            setEditingItemId(id);
                                            setShowTextInput(true);
                                        }}
                                        showTrash={isDraggingItem}
                                        onDragStart={() => setIsDraggingItem(true)}
                                        onDragEnd={() => setIsDraggingItem(false)}
                                        trashScaleAnim={trashScaleAnim}
                                        trashPos={TRASH_POS}
                                        paused={isEditorPaused}
                                    />
                                ))}
                            </View>

                            {/* Trash button — nút icon, xuất hiện khi drag, có hiệu ứng hút */}
                            {isDraggingItem && (
                                <Animated.View
                                    pointerEvents="none"
                                    style={{
                                        position: "absolute",
                                        top: insets.top + 52,
                                        left: 0, right: 0, alignItems: "center", // Giúp padding bọc lấy content chính giữa mà không cần tính left pixel
                                        zIndex: 30,
                                        transform: [{ scale: trashScaleAnim }],
                                    }}
                                >
                                    {/* Vùng nhận rộng hơn visible icon: padding 34px mỗi chiều */}
                                    <View style={{
                                        padding: 34,
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}>
                                        <View style={styles.trashCircle}>
                                            <Ionicons name="trash-outline" size={22} color="white" />
                                        </View>
                                    </View>
                                </Animated.View>
                            )}

                            <View style={[styles.editorHeader, { top: insets.top + 10 }]}>
                                <TouchableOpacity onPress={closeEditor} style={styles.iconCircle}><Ionicons name="chevron-back" size={22} color="white" /></TouchableOpacity>

                                {creationStep !== "TEXT" && (
                                    <>
                                        <TouchableOpacity onPress={() => setShowMusicSheet(true)} style={[styles.addMusicBtn, { maxWidth: SCREEN_WIDTH - 120 }]} activeOpacity={0.8}>
                                            <Ionicons name="musical-notes" size={14} color="white" />
                                            <MarqueeText
                                                text={activeMusicItem ? `${activeMusicItem.musicTitle?.toUpperCase()} -` : "Thêm nhạc"}
                                                style={styles.addMusicText}
                                                maxWidth={SCREEN_WIDTH - 180}
                                            />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => setShowTextInput(true)} style={styles.iconCircle}>
                                            <Text style={{ color: "white", fontWeight: "800", fontSize: 16 }}>Aa</Text>
                                        </TouchableOpacity>
                                    </>
                                )}
                            </View>

                            {creationStep === "TEXT" && (
                                <View style={[styles.bgColorRow, { top: insets.top + 62 }]}>
                                    {BG_COLORS.map(c => (
                                        <TouchableOpacity key={c} onPress={() => setBgConfig(c)} style={[styles.bgColorDot, { backgroundColor: c, borderWidth: bgConfig === c ? 3 : 0, borderColor: "white" }]} />
                                    ))}
                                </View>
                            )}

                            {!showPrivacySheet && (
                                <View style={[styles.editorBottomBar, { paddingBottom: insets.bottom + 12 }]}>
                                    <TouchableOpacity onPress={() => { Keyboard.dismiss(); setShowPrivacySheet(true); }} style={styles.privacyBtn} activeOpacity={0.7}><Ionicons name={privacyMode === "public" ? "people-outline" : privacyMode === "only" ? "person-add-outline" : "person-remove-outline"} size={18} color="white" /><Text style={styles.privacyBtnText}>{privacyMode === "public" ? "Bạn bè Zalo" : privacyMode === "only" ? "Một số bạn bè" : "Ngoại trừ..."}</Text><Ionicons name="chevron-up" size={14} color="rgba(255,255,255,0.7)" /></TouchableOpacity>
                                    <TouchableOpacity onPress={handlePost} disabled={isPosting || (creationStep === "TEXT" && !textContent.trim())} style={[styles.postBtn, { opacity: (isPosting || (creationStep === "TEXT" && !textContent.trim())) ? 0.55 : 1 }]} activeOpacity={0.8}>{isPosting ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.postBtnText}>Đăng</Text>}</TouchableOpacity>
                                </View>
                            )}

                            {showPrivacySheet && (
                                <View style={[StyleSheet.absoluteFillObject, { zIndex: 50 }]} pointerEvents="box-none">
                                    <TouchableWithoutFeedback onPress={() => setShowPrivacySheet(false)}><Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.55)" }]} /></TouchableWithoutFeedback>
                                    <PrivacySheet visible={showPrivacySheet} privacyMode={privacyMode} onSelect={(mode) => setPrivacyMode(mode)} onClose={() => setShowPrivacySheet(false)} bottomInset={insets.bottom} colors={colors} />
                                </View>
                            )}

                            {showMusicSheet && (
                                <View style={[StyleSheet.absoluteFillObject, { zIndex: 50 }]} pointerEvents="box-none">
                                    <TouchableWithoutFeedback onPress={() => setShowMusicSheet(false)}><View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.45)" }]} /></TouchableWithoutFeedback>
                                    <MusicSearchSheet visible={showMusicSheet} onClose={() => setShowMusicSheet(false)} onSelect={handleAddMusic} colors={colors} bottomInset={insets.bottom} />
                                </View>
                            )}

                            {showTextInput && (
                                <TextOverlayInput
                                    visible={showTextInput}
                                    onClose={() => { setShowTextInput(false); setEditingItemId(null); }}
                                    onConfirm={handleAddText}
                                    initialText={editingItemId
                                        ? overlayItems.find(i => i.id === editingItemId)?.textContent || ""
                                        : ""}
                                    initialStyle={editingItemId
                                        ? overlayItems.find(i => i.id === editingItemId)?.textStyle || "normal"
                                        : "normal"}
                                />
                            )}
                        </View>
                    )}

                    {creationStep === "TYPE" && (
                        <TouchableWithoutFeedback onPress={() => setCreationStep("NONE")}>
                            <View style={{ flex: 1 }}>
                                <Animated.View style={[styles.typeSheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16, transform: [{ translateY: creationPanY }] }]}>
                                    <View {...panResponder.panHandlers} style={{ alignItems: "center", paddingVertical: 12 }}><View style={[styles.handleBar, { backgroundColor: colors.border }]} /></View>
                                    <Text style={[styles.sheetTitle, { color: colors.text, marginBottom: 24 }]}>Tạo Khoảnh khắc</Text>
                                    <View style={styles.typeRow}>
                                        <TouchableOpacity onPress={handlePickImage} style={styles.typeBtn} activeOpacity={0.7}><View style={[styles.typeBtnIcon, { backgroundColor: colors.primary + "20" }]}><Ionicons name="images-outline" size={30} color={colors.primary} /></View><Text style={[styles.typeBtnLabel, { color: colors.text }]}>Thư viện</Text></TouchableOpacity>
                                        <TouchableOpacity onPress={() => { setCreationStep("TEXT"); }} style={styles.typeBtn} activeOpacity={0.7}><View style={[styles.typeBtnIcon, { backgroundColor: colors.primary + "20" }]}><Ionicons name="text-outline" size={30} color={colors.primary} /></View><Text style={[styles.typeBtnLabel, { color: colors.text }]}>Chữ</Text></TouchableOpacity>
                                        <TouchableOpacity onPress={handleLaunchCamera} style={styles.typeBtn} activeOpacity={0.7}><View style={[styles.typeBtnIcon, { backgroundColor: colors.primary + "20" }]}><Ionicons name="camera-outline" size={30} color={colors.primary} /></View><Text style={[styles.typeBtnLabel, { color: colors.text }]}>Máy ảnh</Text></TouchableOpacity>
                                    </View>
                                    <TouchableOpacity onPress={() => setCreationStep("NONE")} style={{ alignItems: "center", paddingVertical: 16 }}><Text style={{ color: colors.textSecondary, fontSize: 15 }}>Đóng</Text></TouchableOpacity>
                                </Animated.View>
                            </View>
                        </TouchableWithoutFeedback>
                    )}

                    {/* Hộp thoại xác nhận thoát */}
                    {showExitConfirm && (
                        <View style={[StyleSheet.absoluteFillObject, { zIndex: 100, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 32 }]} pointerEvents="auto">
                            <View style={{ backgroundColor: colors.card, borderRadius: 16, width: "100%", padding: 24, alignItems: "center", elevation: 10, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 10 }}>
                                <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600", marginBottom: 20, textAlign: "center", lineHeight: 24 }}>
                                    Chưa lưu ảnh đang chỉnh sửa.{"\n"}Thoát khỏi trang này ?
                                </Text>
                                <View style={{ flexDirection: "row", width: "100%", gap: 12 }}>
                                    <TouchableOpacity
                                        style={{ flex: 1, paddingVertical: 12, backgroundColor: colors.border, borderRadius: 24, alignItems: "center" }}
                                        onPress={() => setShowExitConfirm(false)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>Ở lại</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={{ flex: 1, paddingVertical: 12, backgroundColor: "#FF3B30", borderRadius: 24, alignItems: "center" }}
                                        onPress={forceCloseEditor}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={{ color: "white", fontSize: 15, fontWeight: "600" }}>Thoát</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    )}
                </View>
            </Modal>

            <Modal visible={!!selectedStory} transparent animationType="fade" statusBarTranslucent>
                <View style={{ flex: 1, backgroundColor: "black", alignItems: "center", justifyContent: "center" }}>
                    <Animated.View style={{ transform: [{ translateX: storySlideX }], opacity: storyFade }}>
                        <TouchableOpacity activeOpacity={1} style={{ width: storyFrameWidth, height: storyFrameHeight, borderRadius: 18, overflow: "hidden", backgroundColor: "#000", justifyContent: "center", alignItems: "center" }} onPress={(e) => { const { locationX } = e.nativeEvent; if (locationX < storyFrameWidth / 2) handlePrevItem(); else handleNextItem(); }} onLongPress={() => setIsPaused(true)} onPressOut={() => { if (isPaused && !isTyping) setIsPaused(false); }}>
                            {selectedStory?.mediaType === "TEXT" ? (
                                <View
                                    key={`text_${selectedStory?.userId}_${selectedStory?.createdAt}`}
                                    style={{ width: storyFrameWidth, height: storyFrameHeight, backgroundColor: parseBgColor(selectedStory?.backgroundConfig), justifyContent: "center", alignItems: "center", padding: 40 }}
                                >
                                    <Text style={{ color: "white", fontSize: 28, fontWeight: "bold", textAlign: "center" }}>{selectedStory?.caption}</Text>
                                </View>
                            ) : (
                                isVideoStory(selectedStory) ? (
                                    getImageUrl(selectedStory?.mediaUrl) ? <Video key={`video_${selectedStory?.userId}_${selectedStory?.createdAt}`} source={{ uri: getImageUrl(selectedStory?.mediaUrl) }} style={{ width: storyFrameWidth, height: storyFrameHeight }} resizeMode={ResizeMode.CONTAIN} shouldPlay useNativeControls /> : <View style={{ width: storyFrameWidth, height: storyFrameHeight, backgroundColor: "#000" }} />
                                ) : (
                                    getImageUrl(selectedStory?.mediaUrl) ? <Image
                                        key={`img_${selectedStory?.userId}_${selectedStory?.createdAt}`}
                                        source={{ uri: getImageUrl(selectedStory?.mediaUrl) }}
                                        style={{ width: storyFrameWidth, height: storyFrameHeight }}
                                        resizeMode="contain"
                                    /> : <View style={{ width: storyFrameWidth, height: storyFrameHeight, backgroundColor: "#000" }} />
                                )
                            )}
                        </TouchableOpacity>
                    </Animated.View>

                    {/* ViewShot bao ngoài toàn bộ story (media + overlays) để chụp composite */}
                    {/* View ngoài nhận pointerEvents vì ViewShot không có prop này */}
                    <View style={{ position: "absolute", top: 0, left: 0, width: SCREEN_WIDTH, height: SCREEN_HEIGHT, opacity: 0 }} pointerEvents="none">
                        <ViewShot ref={viewShotRef} options={{ format: "jpg", quality: 0.75 }} style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}>
                            {/* Media nền */}
                            {selectedStory?.mediaType === "TEXT" ? (
                                <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, backgroundColor: parseBgColor(selectedStory?.backgroundConfig), justifyContent: "center", alignItems: "center", padding: 40 }}>
                                    <Text style={{ color: "white", fontSize: 28, fontWeight: "bold", textAlign: "center" }}>{selectedStory?.caption}</Text>
                                </View>
                            ) : isVideoStory(selectedStory) ? (
                                <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, backgroundColor: "#000" }} />
                            ) : (
                                getImageUrl(selectedStory?.mediaUrl) ? <Image source={{ uri: getImageUrl(selectedStory?.mediaUrl) }} style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }} resizeMode="contain" /> : <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, backgroundColor: "#000" }} />
                            )}
                            {/* Overlay pills bên trên */}
                            {storyOverlayItems.map(overlayItem => {
                                if (overlayItem.type === "music") {
                                    return (
                                        <View key={overlayItem.id} style={{ position: "absolute", left: overlayItem.x, top: overlayItem.y, transform: [{ rotate: `${overlayItem.rotation}deg` }, { scale: overlayItem.scale }] }}>
                                            <View style={itemStyles.musicPill}>
                                                {overlayItem.musicThumb ? (<Image source={{ uri: overlayItem.musicThumb }} style={itemStyles.musicThumb} />) : null}
                                                <View style={{ flexShrink: 1, justifyContent: "center", marginLeft: 10, marginRight: 4 }}>
                                                    <Text style={itemStyles.musicTitle} numberOfLines={1}>{overlayItem.musicTitle}</Text>
                                                    <Text style={itemStyles.musicArtist} numberOfLines={1}>{overlayItem.musicArtist}</Text>
                                                </View>
                                            </View>
                                        </View>
                                    );
                                }
                                const fontStyle = overlayItem.textStyle === "italic" ? { fontStyle: "italic" as const } : overlayItem.textStyle === "bold" ? { fontWeight: "bold" as const } : {};
                                return (
                                    <View key={overlayItem.id} style={{ position: "absolute", left: overlayItem.x, top: overlayItem.y, transform: [{ rotate: `${overlayItem.rotation}deg` }, { scale: overlayItem.scale }] }}>
                                        <View style={itemStyles.textPill}><Text style={[itemStyles.textContent, fontStyle]}>{overlayItem.textContent}</Text></View>
                                    </View>
                                );
                            })}
                        </ViewShot>
                    </View>{/* end pointerEvents wrapper */}

                    <StoryProgressBars
                        stories={groupedStories[selectedStory?.userId] || []}
                        currentIndex={currentItemIndex}
                        progress={storyProgress}
                        insetTop={insets.top}
                    />

                    <View style={[styles.viewerHeader, { top: insets.top + 26 }]}>
                        <AvatarImage
                            name={selectedStory?.displayName || resolveUser(selectedStory?.userId || "").displayName}
                            uri={selectedStory?.avatarUrl || resolveUser(selectedStory?.userId || "").avatarUrl}
                            size={42}
                            style={styles.viewerAvatar}
                            textStyle={{ color: "#fff" }}
                        />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                <Text style={styles.viewerName}>{selectedStory?.displayName}</Text>
                                <Text style={[styles.viewerTime, { opacity: 0.8 }]}>{formatDate(selectedStory?.createdAt)}</Text>
                            </View>
                            {/* Hiển thị tên nhạc dưới tên người dùng nếu có */}
                            {storyOverlayItems.find(i => i.type === "music") && (
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                                    <Ionicons name="bar-chart-outline" size={11} color="rgba(255,255,255,0.8)" />
                                    <Text style={[styles.viewerTime, { fontSize: 11 }]} numberOfLines={1}>
                                        {storyOverlayItems.find(i => i.type === "music")?.musicTitle} -{" "}
                                        {storyOverlayItems.find(i => i.type === "music")?.musicArtist}
                                    </Text>
                                </View>
                            )}
                        </View>

                        <TouchableOpacity style={{ marginRight: 8 }} onPress={() => setShowStoryMenu(true)}>
                            <Ionicons name="ellipsis-horizontal" size={22} color="white" />
                        </TouchableOpacity>

                        <TouchableOpacity onPress={closeStoryViewer}>
                            <Ionicons name="close" size={30} color="white" />
                        </TouchableOpacity>
                    </View>

                    {/* Nút mute âm thanh — chỉ hiện khi story có nhạc */}
                    {storyOverlayItems.find(i => i.type === "music") && (
                        <TouchableOpacity
                            onPress={() => setIsMuted(m => !m)}
                            style={{
                                position: "absolute",
                                top: insets.top + 76,
                                left: 16,
                                zIndex: 50,
                                width: 40, height: 40, borderRadius: 20,
                                backgroundColor: "rgba(0,0,0,0.55)",
                                alignItems: "center", justifyContent: "center",
                            }}
                        >
                            <Ionicons
                                name={isMuted ? "volume-mute" : "volume-medium"}
                                size={20} color="white"
                            />
                        </TouchableOpacity>
                    )}

                    {/* Render overlay items (music pill + text) lên story viewer */}
                    {storyOverlayItems.map(overlayItem => {
                        if (overlayItem.type === "music") {
                            return (
                                <Animated.View
                                    key={overlayItem.id}
                                    pointerEvents="none"
                                    style={{
                                        position: "absolute",
                                        left: overlayItem.x,
                                        top: overlayItem.y,
                                        transform: [
                                            { rotate: `${overlayItem.rotation}deg` },
                                            { scale: overlayItem.scale },
                                        ],
                                        zIndex: 15,
                                    }}
                                >
                                    <View style={itemStyles.musicPill}>
                                        {overlayItem.musicThumb ? (
                                            <ViewerSpinningThumb uri={overlayItem.musicThumb} paused={isPaused} />
                                        ) : (
                                            <View style={[itemStyles.musicThumb, { backgroundColor: "#333", alignItems: "center", justifyContent: "center" }]}>
                                                <Ionicons name="musical-notes" size={14} color="white" />
                                            </View>
                                        )}
                                        <View style={{ flexShrink: 1, justifyContent: "center", marginLeft: 10, marginRight: 4 }}>
                                            <Text style={itemStyles.musicTitle} numberOfLines={1}>{overlayItem.musicTitle}</Text>
                                            <Text style={itemStyles.musicArtist} numberOfLines={1}>{overlayItem.musicArtist}</Text>
                                        </View>
                                    </View>
                                </Animated.View>
                            );
                        }
                        const fontStyle = overlayItem.textStyle === "italic"
                            ? { fontStyle: "italic" as const }
                            : overlayItem.textStyle === "bold"
                                ? { fontWeight: "bold" as const }
                                : {};
                        return (
                            <Animated.View
                                key={overlayItem.id}
                                pointerEvents="none"
                                style={{
                                    position: "absolute",
                                    left: overlayItem.x,
                                    top: overlayItem.y,
                                    transform: [
                                        { rotate: `${overlayItem.rotation}deg` },
                                        { scale: overlayItem.scale },
                                    ],
                                    zIndex: 15,
                                }}
                            >
                                <View style={itemStyles.textPill}>
                                    <Text style={[itemStyles.textContent, fontStyle]}>{overlayItem.textContent}</Text>
                                </View>
                            </Animated.View>
                        );
                    })}

                    <StoryMenuSheet
                        visible={showStoryMenu}
                        onClose={handleCloseMenu}
                        isOwnStory={selectedStory?.userId === profile?.id}
                        storyData={selectedStory}
                        onDelete={handleDeleteStory}
                        onPrivacyChange={() => {
                            const p = selectedStory?.privacy;
                            setPrivacyMode(p === "SPECIFIC" ? "only" : p === "EXCLUDE" ? "except" : "public");
                            setPrivacyUsers(selectedStory?.permittedUserIds || []);
                            setShowPrivacySheet(true);
                            setIsPaused(true);
                        }}
                        onDownload={handleDownloadStory}
                        onReport={() => {
                            handleCloseMenu();
                            setTimeout(() => {
                                showToastMsg("Đã gửi báo cáo");
                            }, 300);
                        }}
                        bottomInset={insets.bottom}
                        colors={colors}
                    />

                    <View style={[styles.viewerBottom, { bottom: insets.bottom + 12 }]}>
                        {selectedStory?.userId === profile?.id ? (
                            <View style={{ flexDirection: "row", alignItems: "center", width: "100%" }}><TouchableOpacity onPress={() => { setIsPaused(true); setShowViewers(true); }} style={styles.viewerCountBtn}><Ionicons name="eye-outline" size={20} color="white" /><Text style={{ color: "white", marginLeft: 6, fontSize: 14 }}>{selectedStory?.viewers?.length || 0} lượt xem</Text></TouchableOpacity><View style={{ flex: 1 }} /><TouchableOpacity onPress={() => { setSelectedStory(null); setCurrentItemIndex(0); creationPanY.setValue(SCREEN_HEIGHT); setCreationStep("TYPE"); }} style={{ alignItems: "center" }}><View style={[styles.createBtn, { width: 36, height: 36 }]}><Ionicons name="add" size={20} color="white" /></View><Text style={{ color: "white", fontSize: 11, marginTop: 4 }}>Tạo mới</Text></TouchableOpacity></View>
                        ) : !isTyping ? (
                            <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast" snapToOffsets={[0, 140]} onScrollBeginDrag={onScrollBegin} onMomentumScrollEnd={onScrollEnd} onScrollEndDrag={onScrollEnd} scrollEventThrottle={16} onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: replyScrollX } } }], { useNativeDriver: false, listener: () => { if (unpauseTimer.current) resetUnpauseTimer(); } })} contentContainerStyle={{ alignItems: "center", paddingRight: 16 }} style={{ width: SCREEN_WIDTH - 32 }}>
                                <Animated.View style={{ width: replyScrollX.interpolate({ inputRange: [0, 140], outputRange: [SCREEN_WIDTH - 200, 50], extrapolate: "clamp" }), opacity: replyScrollX.interpolate({ inputRange: [0, 80], outputRange: [1, 0.2], extrapolate: "clamp" }), marginRight: 10 }}>
                                    <TouchableOpacity onPress={() => { setIsPaused(true); setIsTyping(true); }} style={styles.replyFakeInput} activeOpacity={0.8}><Ionicons name="chatbubble-outline" size={17} color="rgba(255,255,255,0.6)" /><Animated.Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.5)", marginLeft: 8, fontSize: 14, flex: 1, opacity: replyScrollX.interpolate({ inputRange: [0, 40], outputRange: [1, 0], extrapolate: "clamp" }) }}>Gửi tin nhắn...</Animated.Text></TouchableOpacity>
                                </Animated.View>
                                <View style={{ flexDirection: "row" }}>{REACTIONS.map(emoji => <ReactionButton key={emoji} emoji={emoji} onPress={() => handleReaction(emoji)} />)}</View>
                            </Animated.ScrollView>
                        ) : null}
                    </View>

                    {/* Input thật — bám đáy bàn phím bằng keyboardH */}
                    {!selectedStory?.userId || selectedStory?.userId !== profile?.id ? (
                        isTyping ? (
                            <View
                                style={{
                                    position: "absolute",
                                    left: 0,
                                    right: 0,
                                    bottom: keyboardH > 0 ? keyboardH : insets.bottom,
                                    zIndex: 110,
                                    paddingHorizontal: 12,
                                    paddingVertical: 8,
                                    backgroundColor: "rgba(0,0,0,0.55)",
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 8,
                                }}
                            >
                                {/* Nút ẩn bàn phím */}
                                <TouchableOpacity
                                    onPress={() => { Keyboard.dismiss(); setIsTyping(false); setIsPaused(false); }}
                                    style={{ padding: 4 }}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Ionicons name="chevron-down" size={22} color="white" />
                                </TouchableOpacity>
                                <View style={[styles.activeInput, { flex: 1, margin: 0 }]}>
                                    <TextInput
                                        autoFocus
                                        style={{ flex: 1, color: "white", fontSize: 15 }}
                                        placeholder="Gửi tin nhắn..."
                                        placeholderTextColor="rgba(255,255,255,0.5)"
                                        value={replyText}
                                        onChangeText={setReplyText}
                                        returnKeyType="send"
                                        onSubmitEditing={handleSendMessage}
                                    />
                                    {replyText.length > 0 && (
                                        <TouchableOpacity onPress={handleSendMessage} style={{ paddingHorizontal: 12 }}>
                                            <Text style={{ color: "#0068FF", fontWeight: "700", fontSize: 15 }}>Gửi</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        ) : null
                    ) : null}

                    {flyingEmojis.map(item => <FlyingEmoji key={item.id} emoji={item.emoji} onComplete={() => setFlyingEmojis(p => p.filter(e => e.id !== item.id))} />)}

                    <Modal visible={showViewers} transparent animationType="none">
                        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
                            <TouchableOpacity style={{ flex: 1 }} onPress={() => { setShowViewers(false); setIsPaused(false); }} />
                            <Animated.View style={[styles.viewersSheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16, transform: [{ translateY: viewerPanY }] }]} {...viewerPanResponder.panHandlers}>
                                <View style={{ alignItems: "center", paddingBottom: 8 }}><View style={[styles.handleBar, { backgroundColor: colors.border }]} /></View>
                                <View style={styles.tabRow}>
                                    {(["VIEWERS", "REACTIONS"] as const).map(tab => (
                                        <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} style={[styles.tab, activeTab === tab && { borderBottomWidth: 2, borderBottomColor: colors.primary }]}>
                                            <Text style={{ color: activeTab === tab ? colors.primary : colors.textSecondary, fontWeight: "600" }}>{tab === "VIEWERS" ? `Lượt xem (${selectedStory?.viewers?.length || 0})` : `Cảm xúc (${selectedStory?.reactions?.length || 0})`}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                <ScrollView style={{ maxHeight: SCREEN_HEIGHT * 0.45 }}>
                                    {activeTab === "VIEWERS"
                                        ? (selectedStory?.viewers || []).length === 0
                                            ? <Text style={{ color: colors.textSecondary, textAlign: "center", padding: 32 }}>Chưa có ai xem</Text>
                                            : (selectedStory?.viewers || []).map((vId: string, i: number) => { const u = resolveUser(vId); return (<View key={i} style={styles.userRow}><AvatarImage name={u.displayName} uri={u.avatarUrl} size={36} style={styles.userAvatar} /><Text style={{ color: colors.text, flex: 1 }}>{u.displayName}</Text></View>); })
                                        : (selectedStory?.reactions || []).length === 0
                                            ? <Text style={{ color: colors.textSecondary, textAlign: "center", padding: 32 }}>Chưa có cảm xúc</Text>
                                            : (selectedStory?.reactions || []).map((r: string, i: number) => { const [uid, type] = r.split(":"); const u = resolveUser(uid); const emojiMap: Record<string, string> = { heart: "❤️", like: "👍", haha: "😂", wow: "😮", sad: "😢", angry: "😡", party: "🎉", love: "😍" }; return (<View key={i} style={styles.userRow}><AvatarImage name={u.displayName} uri={u.avatarUrl} size={36} style={styles.userAvatar} /><Text style={{ color: colors.text, flex: 1 }}>{u.displayName}</Text><Text style={{ fontSize: 22 }}>{emojiMap[type] || "❤️"}</Text></View>); })
                                    }
                                </ScrollView>
                            </Animated.View>
                        </View>
                    </Modal>


                    {/* Privacy Sheet cho Viewer */}
                    {showPrivacySheet && (
                        <View style={[StyleSheet.absoluteFillObject, { zIndex: 120 }]} pointerEvents="box-none">
                            <TouchableWithoutFeedback onPress={() => { setShowPrivacySheet(false); setIsPaused(false); }}>
                                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.55)" }]} />
                            </TouchableWithoutFeedback>
                            <PrivacySheet
                                visible={showPrivacySheet}
                                privacyMode={privacyMode}
                                onSelect={async (mode) => {
                                    setPrivacyMode(mode);
                                    if (selectedStory) {
                                        try {
                                            const pVal = mode === "public" ? "ALL_FRIENDS" : mode === "only" ? "SPECIFIC" : "EXCLUDE";
                                            await updateStoryPrivacy(selectedStory.createdAt, pVal, privacyUsers);
                                        } catch (e) { }
                                    }
                                }}
                                onClose={() => { setShowPrivacySheet(false); setIsPaused(false); }}
                                bottomInset={insets.bottom}
                                colors={colors}
                            />
                        </View>
                    )}
                </View>
            </Modal>

            {mobileToast.visible && <View style={styles.toast} pointerEvents="none"><Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>{mobileToast.message}</Text></View>}
        </View>
    );
}

const styles = StyleSheet.create({
    header: { height: 52, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 12 },
    searchBar: { flex: 1, flexDirection: "row", alignItems: "center", borderRadius: 10, paddingHorizontal: 10, height: 36 },
    searchInput: { flex: 1, fontSize: 15, marginLeft: 8 },
    storyCard: { width: 100, height: 160, borderRadius: 12, overflow: "hidden", backgroundColor: "#222" },
    createBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#0068FF", alignItems: "center", justifyContent: "center" },
    storyLabel: { color: "white", fontSize: 11, fontWeight: "700", marginTop: 6, paddingHorizontal: 4, textAlign: "center" },
    avatarBorder: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, backgroundColor: "white", overflow: "hidden" },
    mobilePostComposer: { marginBottom: 8, padding: 12 },
    mobilePostAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#DCEAFE" },
    mobilePostInput: { flex: 1, minHeight: 38, borderRadius: 19, paddingHorizontal: 14, fontSize: 14 },
    mobilePostActionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" },
    mobilePostAction: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#F1F3F5", borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
    mobilePostActionText: { fontSize: 13, fontWeight: "700", color: "#374151" },
    mobileSubmitPostBtn: { marginLeft: "auto", backgroundColor: "#0068FF", borderRadius: 18, paddingHorizontal: 16, paddingVertical: 8 },
    mobileSubmitPostText: { color: "#fff", fontWeight: "700" },
    mobilePostPreview: { width: "100%", height: 220, borderRadius: 10, backgroundColor: "#000" },
    mobileTimelinePost: { borderRadius: 12, padding: 12, marginBottom: 10 },
    timelineComposer: { borderRadius: 8, padding: 16, borderWidth: 1 },
    timelineComposerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#DCEAFE" },
    timelineComposerInput: { flex: 1, minHeight: 42, borderRadius: 21, paddingHorizontal: 16, fontSize: 15 },
    timelinePostButton: { backgroundColor: "#0068FF", paddingHorizontal: 16, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
    timelinePreviewMedia: { width: "100%", height: 280, borderRadius: 8, backgroundColor: "#000" },
    timelinePostCard: { borderRadius: 8, padding: 16, borderWidth: 1 },
    timelinePostAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#DCEAFE" },
    postComposerPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#F1F3F5", borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
    postComposerPillText: { fontSize: 13, fontWeight: "700", color: "#374151" },
    editorHeader: { position: "absolute", left: 16, right: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", zIndex: 30 },
    iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
    addMusicBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20 },
    addMusicText: { color: "white", fontSize: 14, fontWeight: "600" },
    trashCircle: {
        width: 52, height: 52, borderRadius: 26,
        backgroundColor: "rgba(220,50,50,0.85)",
        alignItems: "center", justifyContent: "center",
        borderWidth: 2, borderColor: "rgba(255,255,255,0.7)",
        shadowColor: "#000", shadowOpacity: 0.3,
        shadowRadius: 8, elevation: 6,
    },
    bgColorRow: { position: "absolute", left: 16, flexDirection: "column", gap: 8, zIndex: 10 },
    bgColorDot: { width: 28, height: 28, borderRadius: 14 },
    textStoryInput: { color: "white", fontSize: 30, fontWeight: "700", textAlign: "center", width: "100%" },
    editorBottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 14, zIndex: 10, backgroundColor: "rgba(0,0,0,0.3)" },
    privacyBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.18)", paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
    privacyBtnText: { color: "white", fontSize: 13, fontWeight: "500" },
    postBtn: { marginLeft: "auto", backgroundColor: "#0068FF", paddingHorizontal: 28, paddingVertical: 12, borderRadius: 24, minWidth: 80, alignItems: "center" },
    postBtnText: { color: "white", fontWeight: "700", fontSize: 15 },
    privacySheet: { position: "absolute", bottom: 0, left: 0, right: 0, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
    sheetTitle: { fontSize: 16, fontWeight: "700", textAlign: "center", paddingHorizontal: 20, marginBottom: 4 },
    sheetSubtitle: { fontSize: 12, textAlign: "center", marginBottom: 16, paddingHorizontal: 20 },
    handleBar: { width: 40, height: 4, borderRadius: 2 },
    privacyOption: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14 },
    radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center", marginRight: 14 },
    radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: "white" },
    optionTitle: { fontSize: 15, fontWeight: "500" },
    optionSub: { fontSize: 12, marginTop: 2 },
    divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 20, opacity: 0.4 },
    typeSheet: { position: "absolute", bottom: 0, left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
    typeRow: { flexDirection: "row", justifyContent: "space-around", paddingHorizontal: 20, marginBottom: 12 },
    typeBtn: { alignItems: "center", gap: 10 },
    typeBtnIcon: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center" },
    typeBtnLabel: { fontSize: 13, fontWeight: "500" },
    progressBarRow: { position: "absolute", left: 10, right: 10, flexDirection: "row", alignItems: "center", zIndex: 100, height: 4 },
    viewerHeader: { position: "absolute", left: 16, right: 16, flexDirection: "row", alignItems: "center", zIndex: 100 },
    viewerAvatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.6)" },
    viewerName: { color: "white", fontWeight: "700", fontSize: 14 },
    viewerTime: { color: "rgba(255,255,255,0.75)", fontSize: 13 },
    viewerBottom: { position: "absolute", left: 16, right: 16, zIndex: 100 },
    viewerCountBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
    activeInput: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 22, paddingLeft: 16, height: 44, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
    replyFakeInput: { height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.18)", flexDirection: "row", alignItems: "center", paddingHorizontal: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
    reactionBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center", marginHorizontal: 4 },
    viewersSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, minHeight: SCREEN_HEIGHT * 0.4 },
    tabRow: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(0,0,0,0.1)", marginBottom: 8 },
    tab: { flex: 1, alignItems: "center", paddingVertical: 12 },
    userRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 10 },
    userAvatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
    toast: { position: "absolute", bottom: 110, alignSelf: "center", backgroundColor: "rgba(0,0,0,0.88)", paddingHorizontal: 22, paddingVertical: 12, borderRadius: 24 },
});
