import React, { useEffect, useMemo, useState } from "react";
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    ScrollView,
    Dimensions,
    Modal,
    TextInput,
    Alert,
    ActivityIndicator,
    ActionSheetIOS,
    Platform,
    StyleSheet,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { SafeView as SafeAreaView } from "@/shared/components/SafeView";
import { Ionicons } from "@expo/vector-icons";
import { ResizeMode, Video } from "expo-av";

import type { UserProfile } from "@/shared/services/types";
import { useUserStore } from "@/shared/store/userStore";
import { usePostStore, type TimelinePost, type TimelinePostMedia } from "@/shared/store/postStore";
import { useStoryStore, type Story } from "@/shared/store/storyStore";
import { useThemeColors } from "@/shared/theme/colors";
import { useImagePicker } from "@/shared/hooks/useImagePicker";
import { getImageUrl } from "@/shared/utils/mediaUtils";

const COVER_HEIGHT = 240;
const AVATAR_SIZE = 100;
const SCREEN_WIDTH = Dimensions.get("window").width;

interface PersonalProfileScreenProps {
    user?: UserProfile | null;
}

export default function PersonalProfileScreen({ user }: PersonalProfileScreenProps) {
    const router = useRouter();
    const { updateProfile } = useUserStore();
    const colors = useThemeColors();
    const posts = usePostStore((s) => s.posts);
    const postsLoading = usePostStore((s) => s.loading);
    const fetchPostFeed = usePostStore((s) => s.fetchFeed);
    const createPost = usePostStore((s) => s.createPost);
    const updatePostPrivacy = usePostStore((s) => s.updatePostPrivacy);
    const deletePost = usePostStore((s) => s.deletePost);
    const storyFeed = useStoryStore((s) => s.feed);
    const myStories = useStoryStore((s) => s.myStories);
    const fetchStoryFeed = useStoryStore((s) => s.fetchFeed);
    const fetchMyStories = useStoryStore((s) => s.fetchMyStories);

    const displayName =
        (user?.displayName?.trim() || user?.username?.trim() || "").trim() || "Người dùng";
    const avatarUrl = user?.avatarUrl ?? null;
    const avatarInitial = displayName.charAt(0).toUpperCase() || "U";
    const statusMessage = user?.statusMessage?.trim() || "";
    const businessDescription = user?.businessDescription?.trim() || "";

    const [introModalVisible, setIntroModalVisible] = useState(false);
    const [introText, setIntroText] = useState(businessDescription);
    const [saving, setSaving] = useState(false);
    const [postModalVisible, setPostModalVisible] = useState(false);
    const [postText, setPostText] = useState("");
    const [postAsset, setPostAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
    const [posting, setPosting] = useState(false);
    const [mediaModalVisible, setMediaModalVisible] = useState(false);
    const [storyModalVisible, setStoryModalVisible] = useState(false);
    const [postPrivacyTarget, setPostPrivacyTarget] = useState<TimelinePost | null>(null);
    const [privacySaving, setPrivacySaving] = useState(false);

    // Hooks for images
    const avatarPicker = useImagePicker({ folder: "avatars/", aspect: [1, 1], allowsEditing: true });
    const coverPicker = useImagePicker({ folder: "covers/", aspect: [3, 2], allowsEditing: true });

    const myPosts = useMemo(
        () => posts.filter((post) => !user?.id || String(post.userId) === String(user.id)),
        [posts, user?.id],
    );

    const postMedia = useMemo(() => {
        return myPosts.flatMap((post) => {
            const items = Array.isArray(post.mediaItems) && post.mediaItems.length > 0
                ? post.mediaItems
                : post.mediaUrl
                    ? [{
                        id: post.id,
                        mediaUrl: post.mediaUrl,
                        mediaType: post.mediaType,
                        sortOrder: 0,
                    } as TimelinePostMedia]
                    : [];

            return items
                .filter((item) => item.mediaUrl && (item.mediaType === "IMAGE" || item.mediaType === "VIDEO"))
                .map((item) => ({ ...item, postId: post.id }));
        });
    }, [myPosts]);

    const storyArchive = useMemo(() => {
        const map = new Map<string, Story>();
        [...myStories, ...storyFeed.filter((story) => !user?.id || String(story.userId) === String(user.id))]
            .forEach((story) => map.set(`${story.userId}-${story.createdAt}`, story));
        return [...map.values()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [myStories, storyFeed, user?.id]);

    useEffect(() => {
        void fetchPostFeed({ silent: true });
        void fetchStoryFeed();
        void fetchMyStories();
    }, [fetchPostFeed, fetchStoryFeed, fetchMyStories]);

    const handleOpenIntroModal = () => {
        setIntroText(businessDescription);
        setIntroModalVisible(true);
    };

    const handleOpenWallPost = (postId: string) => {
        router.push({ pathname: "/(tabs)/work", params: { postId } } as any);
    };

    const handleSaveIntro = async () => {
        setSaving(true);
        try {
            await updateProfile({ businessDescription: introText.trim() || undefined });
            setIntroModalVisible(false);
        } catch {
            Alert.alert("Lỗi", "Không thể cập nhật lời giới thiệu.");
        } finally {
            setSaving(false);
        }
    };

    const handleImageAction = async (
        picker: ReturnType<typeof useImagePicker>,
        onSuccess: (url: string) => Promise<void>
    ) => {
        const options = ["Hủy", "Chụp ảnh mới", "Chọn từ thư viện"];
        
        const processSelection = async (index: number) => {
            let asset = null;
            if (index === 1) asset = await picker.takePhoto();
            else if (index === 2) asset = await picker.pickImage();
            
            if (asset) {
                const url = await picker.upload(asset);
                if (url) {
                    try {
                        await onSuccess(url);
                        Alert.alert("Thành công", "Đã cập nhật hình ảnh.");
                    } catch {
                        Alert.alert("Lỗi", "Không thể lưu hình ảnh mới.");
                    }
                }
            }
        };

        if (Platform.OS === "ios") {
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options,
                    cancelButtonIndex: 0,
                    title: "Thay đổi hình ảnh",
                },
                processSelection
            );
        } else {
            Alert.alert("Thay đổi hình ảnh", "Bạn muốn chọn ảnh từ đâu?", [
                { text: "Hủy", style: "cancel" },
                { text: "Chụp ảnh mới", onPress: () => processSelection(1) },
                { text: "Chọn từ thư viện", onPress: () => processSelection(2) },
            ]);
        }
    };

    const handleChangeAvatar = () => {
        handleImageAction(avatarPicker, (url) => updateProfile({ avatarUrl: url }));
    };

    const handleChangeCover = () => {
        handleImageAction(coverPicker, (url) => updateProfile({ coverPhotoUrl: url }));
    };

    const formatDate = (value?: string | number | null) => {
        if (!value) return "";
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return "";
        return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "long", year: "numeric" });
    };

    const formatPostTime = (value?: string | null) => {
        if (!value) return "";
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return "";
        return d.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
    };

    const getPostPrivacyLabel = (privacy?: string | null) => {
        if (privacy === "SPECIFIC") return "Một số bạn bè";
        if (privacy === "EXCLUDE") return "Ngoại trừ...";
        return "Bạn bè Zalo";
    };

    const handleChangePostPrivacy = async (privacy: "ALL_FRIENDS" | "SPECIFIC" | "EXCLUDE") => {
        if (!postPrivacyTarget) return;
        setPrivacySaving(true);
        try {
            await updatePostPrivacy(postPrivacyTarget.id, privacy, postPrivacyTarget.permittedUserIds ?? []);
            setPostPrivacyTarget(null);
        } catch (error) {
            console.error("Update profile post privacy error:", error);
            Alert.alert("Lỗi", "Không thể cập nhật đối tượng xem.");
        } finally {
            setPrivacySaving(false);
        }
    };

    const handleDeletePost = (postId: string) => {
        Alert.alert("Xóa bài viết", "Bạn có chắc muốn xóa bài viết này?", [
            { text: "Hủy", style: "cancel" },
            {
                text: "Xóa",
                style: "destructive",
                onPress: async () => {
                    try {
                        await deletePost(postId);
                    } catch (error) {
                        console.error("Delete profile post error:", error);
                        Alert.alert("Lỗi", "Không thể xóa bài viết.");
                    }
                },
            },
        ]);
    };

    const handlePickPostMedia = async () => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permission.status !== "granted") {
            Alert.alert("Cần quyền truy cập", "Vui lòng cấp quyền truy cập thư viện ảnh/video.");
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images", "videos"],
            allowsMultipleSelection: false,
            quality: 0.85,
        });
        if (!result.canceled && result.assets?.[0]) {
            setPostAsset(result.assets[0]);
        }
    };

    const handleSubmitPost = async () => {
        if (!postText.trim() && !postAsset) {
            Alert.alert("Nhật ký", "Hãy nhập nội dung hoặc chọn ảnh/video trước khi đăng.");
            return;
        }
        setPosting(true);
        try {
            await createPost(postText, postAsset ? [postAsset] : undefined);
            setPostText("");
            setPostAsset(null);
            setPostModalVisible(false);
        } catch (error) {
            console.error("Create profile post error:", error);
            Alert.alert("Lỗi", "Không thể đăng Nhật ký lúc này.");
        } finally {
            setPosting(false);
        }
    };

    const renderMediaPreview = (url: string, type?: "IMAGE" | "VIDEO" | null, height = 220) => {
        const resolved = getImageUrl(url);
        if (type === "VIDEO") {
            return (
                <View style={{ height, borderRadius: 12, overflow: "hidden", backgroundColor: "#000" }}>
                    <Video
                        source={{ uri: resolved }}
                        style={{ width: "100%", height: "100%" }}
                        resizeMode={ResizeMode.CONTAIN}
                        useNativeControls
                        shouldPlay={false}
                        isLooping={false}
                    />
                </View>
            );
        }
        return (
            <Image
                source={{ uri: resolved }}
                style={{ width: "100%", height, borderRadius: 12, backgroundColor: colors.searchBg }}
                resizeMode="cover"
            />
        );
    };

    const renderPostMediaGrid = (items: TimelinePostMedia[]) => {
        const visibleItems = items.slice(0, 4);
        const extraCount = Math.max(0, items.length - visibleItems.length);
        const gap = 4;

        const cellStyle = (count: number, index: number) => {
            if (count === 1) {
                return { width: "100%" as const, height: 260 };
            }
            if (count === 2) {
                return { width: `49.4%` as const, height: 210 };
            }
            if (count === 3) {
                return index === 0
                    ? { width: "100%" as const, height: 210 }
                    : { width: `49.4%` as const, height: 150 };
            }
            return { width: `49.4%` as const, height: 150 };
        };

        return (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap, marginTop: 8 }}>
                {visibleItems.map((item, index) => {
                    const style = cellStyle(visibleItems.length, index);
                    return (
                        <View
                            key={`${item.id}-${index}`}
                            style={{
                                ...style,
                                borderRadius: 12,
                                overflow: "hidden",
                                backgroundColor: item.mediaType === "VIDEO" ? "#000" : colors.searchBg,
                            }}
                        >
                            {item.mediaType === "VIDEO" ? (
                                <>
                                    <Video
                                        source={{ uri: getImageUrl(item.mediaUrl) }}
                                        style={{ width: "100%", height: "100%" }}
                                        resizeMode={ResizeMode.COVER}
                                        shouldPlay={false}
                                        isMuted
                                        isLooping={false}
                                    />
                                    <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
                                        <Ionicons name="play-circle" size={42} color="#fff" />
                                    </View>
                                </>
                            ) : (
                                <Image
                                    source={{ uri: getImageUrl(item.mediaUrl) }}
                                    style={{ width: "100%", height: "100%" }}
                                    resizeMode="cover"
                                />
                            )}
                            {extraCount > 0 && index === visibleItems.length - 1 ? (
                                <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.48)", alignItems: "center", justifyContent: "center" }}>
                                    <Text style={{ color: "#fff", fontSize: 28, fontWeight: "900" }}>+{extraCount}</Text>
                                </View>
                            ) : null}
                        </View>
                    );
                })}
            </View>
        );
    };

    const renderPostCard = (post: TimelinePost) => {
        const items = Array.isArray(post.mediaItems) && post.mediaItems.length > 0
            ? post.mediaItems
            : post.mediaUrl
                ? [{ id: post.id, mediaUrl: post.mediaUrl, mediaType: post.mediaType, sortOrder: 0 } as TimelinePostMedia]
                : [];
        return (
            <TouchableOpacity
                key={post.id}
                activeOpacity={0.92}
                onPress={() => handleOpenWallPost(post.id)}
                style={{
                    backgroundColor: colors.card,
                    borderRadius: 14,
                    padding: 14,
                    marginHorizontal: 12,
                    marginBottom: 12,
                    borderWidth: 0.5,
                    borderColor: colors.border,
                }}
            >
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                    {avatarUrl ? (
                        <Image source={{ uri: getImageUrl(avatarUrl) }} style={{ width: 42, height: 42, borderRadius: 21 }} />
                    ) : (
                        <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.searchBg, alignItems: "center", justifyContent: "center" }}>
                            <Text style={{ color: colors.primary, fontWeight: "800" }}>{avatarInitial}</Text>
                        </View>
                    )}
                    <View style={{ marginLeft: 10, flex: 1 }}>
                        <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}>{displayName}</Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
                            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{formatPostTime(post.createdAt)}</Text>
                            <TouchableOpacity
                                onPress={(event) => {
                                    event.stopPropagation?.();
                                    setPostPrivacyTarget(post);
                                }}
                                style={{ flexDirection: "row", alignItems: "center", gap: 3 }}
                            >
                                <Ionicons name="people-outline" size={12} color={colors.textSecondary} />
                                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{getPostPrivacyLabel(post.privacy)}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    <TouchableOpacity
                        onPress={(event) => {
                            event.stopPropagation?.();
                            handleDeletePost(post.id);
                        }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        style={{ padding: 6 }}
                    >
                        <Ionicons name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                </View>
                {post.content ? (
                    <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22, marginBottom: items.length ? 10 : 0 }}>
                        {post.content}
                    </Text>
                ) : null}
                {items.length > 0 ? renderPostMediaGrid(items) : null}
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 12 }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                        {(post.reactions?.length || 0)} cảm xúc
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                        {(post.comments?.length || 0)} bình luận
                    </Text>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <StatusBar style="light" />

            <ScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                bounces={false}
            >
                {/* Cover + Avatar area */}
                <View style={{ height: COVER_HEIGHT + AVATAR_SIZE / 2, position: "relative" }}>
                    {/* Cover background */}
                    <View style={{ height: COVER_HEIGHT, width: "100%", position: 'relative', overflow: 'hidden' }}>
                        {user?.coverPhotoUrl ? (
                            <Image
                                key={user.coverPhotoUrl}
                                source={{ uri: `${user.coverPhotoUrl}?t=${Date.now()}` }}
                                style={{ width: "100%", height: COVER_HEIGHT }}
                                resizeMode="cover"
                                onError={(e) => console.log("Cover Load Error:", e.nativeEvent.error, user.coverPhotoUrl)}
                            />
                        ) : (
                            <View
                                style={{
                                    height: COVER_HEIGHT,
                                    backgroundColor: colors.primary, // Zalo blue as primary
                                    width: "100%",
                                }}
                            />
                        )}

                        {/* Change Cover Button */}
                        <TouchableOpacity
                            onPress={handleChangeCover}
                            disabled={coverPicker.uploading}
                            style={{
                                position: "absolute",
                                bottom: 16,
                                right: 16,
                                backgroundColor: "rgba(0,0,0,0.4)",
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                alignItems: "center",
                                justifyContent: "center",
                                zIndex: 30, // Higher than top bar/avatar if needed
                                borderWidth: 1,
                                borderColor: 'rgba(255,255,255,0.4)',
                            }}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            {coverPicker.uploading ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Ionicons name="camera" size={22} color="#fff" />
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Top bar overlay */}
                    <SafeAreaView
                        edges={["top"]}
                        pointerEvents="box-none"
                        style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            zIndex: 10,
                        }}
                    >
                        <View
                            pointerEvents="box-none"
                            style={{
                                height: 52,
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                                paddingHorizontal: 8,
                            }}
                        >
                            {/* Left: Back button */}
                            <TouchableOpacity
                                onPress={() => router.back()}
                                style={{ padding: 8 }}
                                activeOpacity={0.7}
                                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                            >
                                <Ionicons name="chevron-back" size={28} color="#fff" />
                            </TouchableOpacity>

                            {/* Right: Search person + 3-dot menu */}
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                <TouchableOpacity
                                    onPress={() => router.push("/(tabs)/profile-settings")}
                                    style={{ padding: 8 }}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </SafeAreaView>

                    {/* "Trạng thái hiện tại" label */}
                    {statusMessage ? (
                        <View
                            style={{
                                position: "absolute",
                                bottom: AVATAR_SIZE / 2 + 10,
                                right: Dimensions.get("window").width / 2 - AVATAR_SIZE / 2 - 100,
                                backgroundColor: "rgba(0,0,0,0.55)",
                                borderRadius: 8,
                                paddingHorizontal: 10,
                                paddingVertical: 5,
                                zIndex: 5,
                            }}
                        >
                            <Text style={{ color: "#ddd", fontSize: 11 }}>
                                Trạng thái hiện tại
                            </Text>
                        </View>
                    ) : null}

                    {/* Avatar */}
                    <View
                        pointerEvents="box-none"
                        style={{
                            position: "absolute",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            alignItems: "center",
                            zIndex: 20,
                        }}
                    >
                        <View style={{ position: "relative" }}>
                            {avatarUrl ? (
                                <Image
                                    key={avatarUrl}
                                    source={{ 
                                        uri: `${avatarUrl}?t=${Date.now()}`,
                                    }}
                                    style={{
                                        width: AVATAR_SIZE,
                                        height: AVATAR_SIZE,
                                        borderRadius: AVATAR_SIZE / 2,
                                        borderWidth: 3,
                                        borderColor: colors.background,
                                        backgroundColor: "#f0f2f5",
                                    }}
                                    onError={(e) => console.log("Avatar Load Error:", e.nativeEvent.error, avatarUrl)}
                                />
                            ) : (
                                <View
                                    style={{
                                        width: AVATAR_SIZE,
                                        height: AVATAR_SIZE,
                                        borderRadius: AVATAR_SIZE / 2,
                                        borderWidth: 3,
                                        borderColor: colors.background,
                                        backgroundColor: "#f0f2f5",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <Text
                                        style={{
                                            color: colors.primary,
                                            fontSize: 40,
                                            fontWeight: "700",
                                        }}
                                    >
                                        {avatarInitial}
                                    </Text>
                                </View>
                            )}
                            
                            {/* Change Avatar Button */}
                            <TouchableOpacity
                                onPress={handleChangeAvatar}
                                disabled={avatarPicker.uploading}
                                style={{
                                    position: "absolute",
                                    bottom: 0,
                                    right: 0,
                                    backgroundColor: colors.card,
                                    width: 32,
                                    height: 32,
                                    borderRadius: 16,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    elevation: 4,
                                    shadowColor: "#000",
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.15,
                                    shadowRadius: 4,
                                    zIndex: 25,
                                }}
                            >
                                {avatarPicker.uploading ? (
                                    <ActivityIndicator size="small" color={colors.primary} />
                                ) : (
                                    <Ionicons name="camera" size={18} color={colors.text} />
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* Name */}
                <View style={{ alignItems: "center", paddingTop: 16, paddingHorizontal: 24 }}>
                    <Text
                        style={{
                            fontSize: 24,
                            fontWeight: "700",
                            color: colors.text,
                            textAlign: "center",
                        }}
                    >
                        {displayName}
                    </Text>
                    {statusMessage ? (
                        <Text
                            style={{
                                fontSize: 14,
                                color: colors.textSecondary,
                                marginTop: 6,
                                textAlign: "center",
                            }}
                        >
                            {statusMessage}
                        </Text>
                    ) : null}

                    {/* Lời giới thiệu hoặc link "Chỉnh sửa lời giới thiệu" */}
                    {businessDescription ? (
                        <TouchableOpacity
                            onPress={handleOpenIntroModal}
                            activeOpacity={0.7}
                            style={{ marginTop: 8 }}
                        >
                            <Text
                                style={{
                                    fontSize: 14,
                                    color: colors.textSecondary,
                                    textAlign: "center",
                                    lineHeight: 20,
                                }}
                            >
                                {businessDescription}
                            </Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            onPress={handleOpenIntroModal}
                            activeOpacity={0.7}
                            style={{ marginTop: 8 }}
                        >
                            <Text
                                style={{
                                    fontSize: 14,
                                    color: colors.primary,
                                    textAlign: "center",
                                    fontWeight: "500",
                                }}
                            >
                                Chỉnh sửa lời giới thiệu
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Action buttons row */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{
                        paddingHorizontal: 16,
                        paddingTop: 20,
                        paddingBottom: 4,
                        gap: 10,
                    }}
                >
                    {[
                        { icon: "images-outline" as const, label: "Ảnh của tôi", onPress: () => setMediaModalVisible(true) },
                        { icon: "film-outline" as const, label: "Kho khoảnh khắc", onPress: () => setStoryModalVisible(true) },
                    ].map((item) => (
                        <TouchableOpacity
                            key={item.label}
                            activeOpacity={0.6}
                            onPress={item.onPress}
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                backgroundColor: colors.searchBg,
                                borderRadius: 20,
                                paddingHorizontal: 14,
                                paddingVertical: 10,
                                gap: 6,
                            }}
                        >
                            <Ionicons name={item.icon} size={18} color={colors.primary} />
                            <Text
                                style={{
                                    color: colors.text,
                                    fontSize: 13,
                                    fontWeight: "500",
                                }}
                            >
                                {item.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                <View style={{ height: 8, backgroundColor: colors.separator, marginTop: 16 }} />

                <View style={{ paddingHorizontal: 12, paddingVertical: 14 }}>
                    <TouchableOpacity
                        activeOpacity={0.82}
                        onPress={() => setPostModalVisible(true)}
                        style={{
                            backgroundColor: colors.card,
                            borderRadius: 14,
                            paddingHorizontal: 14,
                            paddingVertical: 12,
                            borderWidth: 0.5,
                            borderColor: colors.border,
                            flexDirection: "row",
                            alignItems: "center",
                        }}
                    >
                        {avatarUrl ? (
                            <Image source={{ uri: getImageUrl(avatarUrl) }} style={{ width: 42, height: 42, borderRadius: 21 }} />
                        ) : (
                            <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.searchBg, alignItems: "center", justifyContent: "center" }}>
                                <Text style={{ color: colors.primary, fontWeight: "800" }}>{avatarInitial}</Text>
                            </View>
                        )}
                        <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>Đăng lên Nhật ký</Text>
                            <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>Hôm nay bạn thế nào?</Text>
                        </View>
                        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
                            <Ionicons name="add" size={24} color="#fff" />
                        </View>
                    </TouchableOpacity>
                </View>

                <View style={{ paddingBottom: 90 }}>
                    <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800", marginHorizontal: 14, marginBottom: 10 }}>
                        Bài viết đã đăng
                    </Text>
                    {postsLoading && myPosts.length === 0 ? (
                        <ActivityIndicator color={colors.primary} style={{ marginTop: 18 }} />
                    ) : myPosts.length > 0 ? (
                        myPosts.map(renderPostCard)
                    ) : (
                        <View style={{ alignItems: "center", paddingVertical: 46, paddingHorizontal: 28 }}>
                            <Ionicons name="newspaper-outline" size={42} color={colors.textSecondary} />
                            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16, marginTop: 12 }}>Chưa có bài viết nào</Text>
                            <Text style={{ color: colors.textSecondary, textAlign: "center", marginTop: 6, lineHeight: 20 }}>
                                Những bài Nhật ký bạn đăng sẽ xuất hiện tại đây theo ngày tháng.
                            </Text>
                        </View>
                    )}
                </View>
            </ScrollView>

            <Modal
                visible={mediaModalVisible}
                animationType="slide"
                onRequestClose={() => setMediaModalVisible(false)}
            >
                <View style={{ flex: 1, backgroundColor: colors.background }}>
                    <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.headerBg }}>
                        <View style={{ height: 54, flexDirection: "row", alignItems: "center", paddingHorizontal: 8 }}>
                            <TouchableOpacity onPress={() => setMediaModalVisible(false)} style={{ padding: 10 }}>
                                <Ionicons name="chevron-back" size={26} color={colors.headerText} />
                            </TouchableOpacity>
                            <Text style={{ color: colors.headerText, fontSize: 18, fontWeight: "800", marginLeft: 4 }}>
                                Ảnh và video của tôi
                            </Text>
                        </View>
                    </SafeAreaView>
                    <ScrollView contentContainerStyle={{ padding: 10, paddingBottom: 32 }}>
                        {postMedia.length > 0 ? (
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                                {postMedia.map((item) => {
                                    const tile = (SCREEN_WIDTH - 32) / 3;
                                    return (
                                        <View
                                            key={`${item.postId}-${item.id}`}
                                            style={{
                                                width: tile,
                                                height: tile,
                                                borderRadius: 10,
                                                overflow: "hidden",
                                                backgroundColor: "#000",
                                            }}
                                        >
                                            {item.mediaType === "VIDEO" ? (
                                                <>
                                                    <Video
                                                        source={{ uri: getImageUrl(item.mediaUrl) }}
                                                        style={{ width: "100%", height: "100%" }}
                                                        resizeMode={ResizeMode.COVER}
                                                        shouldPlay={false}
                                                        isMuted
                                                        isLooping={false}
                                                    />
                                                    <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>
                                                        <Ionicons name="play-circle" size={34} color="#fff" />
                                                    </View>
                                                </>
                                            ) : (
                                                <Image source={{ uri: getImageUrl(item.mediaUrl) }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                                            )}
                                        </View>
                                    );
                                })}
                            </View>
                        ) : (
                            <View style={{ alignItems: "center", paddingTop: 80 }}>
                                <Ionicons name="images-outline" size={46} color={colors.textSecondary} />
                                <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700", marginTop: 12 }}>Chưa có ảnh/video</Text>
                                <Text style={{ color: colors.textSecondary, marginTop: 6 }}>Ảnh và video từ bài viết của bạn sẽ hiển thị ở đây.</Text>
                            </View>
                        )}
                    </ScrollView>
                </View>
            </Modal>

            <Modal
                visible={storyModalVisible}
                animationType="slide"
                onRequestClose={() => setStoryModalVisible(false)}
            >
                <View style={{ flex: 1, backgroundColor: colors.background }}>
                    <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.headerBg }}>
                        <View style={{ height: 54, flexDirection: "row", alignItems: "center", paddingHorizontal: 8 }}>
                            <TouchableOpacity onPress={() => setStoryModalVisible(false)} style={{ padding: 10 }}>
                                <Ionicons name="chevron-back" size={26} color={colors.headerText} />
                            </TouchableOpacity>
                            <Text style={{ color: colors.headerText, fontSize: 18, fontWeight: "800", marginLeft: 4 }}>
                                Kho khoảnh khắc
                            </Text>
                        </View>
                    </SafeAreaView>
                    <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 32 }}>
                        {storyArchive.length > 0 ? (
                            storyArchive.map((story: Story) => (
                                <View
                                    key={`${story.userId}-${story.createdAt}`}
                                    style={{
                                        backgroundColor: colors.card,
                                        borderRadius: 14,
                                        padding: 12,
                                        marginBottom: 12,
                                        borderWidth: 0.5,
                                        borderColor: colors.border,
                                    }}
                                >
                                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 8 }}>
                                        {formatDate(story.createdAt)}
                                    </Text>
                                    {story.mediaType === "VIDEO" ? (
                                        renderMediaPreview(story.mediaUrl, "VIDEO", 360)
                                    ) : story.mediaType === "IMAGE" ? (
                                        renderMediaPreview(story.mediaUrl, "IMAGE", 360)
                                    ) : (
                                        <View style={{ minHeight: 220, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", padding: 18 }}>
                                            <Text style={{ color: "#fff", fontSize: 24, fontWeight: "900", textAlign: "center" }}>{story.caption}</Text>
                                        </View>
                                    )}
                                    {story.caption && story.mediaType !== "TEXT" ? (
                                        <Text style={{ color: colors.text, marginTop: 10, fontSize: 14 }}>{story.caption}</Text>
                                    ) : null}
                                </View>
                            ))
                        ) : (
                            <View style={{ alignItems: "center", paddingTop: 80 }}>
                                <Ionicons name="film-outline" size={46} color={colors.textSecondary} />
                                <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700", marginTop: 12 }}>Chưa có khoảnh khắc</Text>
                                <Text style={{ color: colors.textSecondary, marginTop: 6, textAlign: "center" }}>Các story của bạn sẽ xuất hiện tại đây.</Text>
                            </View>
                        )}
                    </ScrollView>
                </View>
            </Modal>

            <Modal
                transparent
                visible={postModalVisible}
                animationType="fade"
                onRequestClose={() => setPostModalVisible(false)}
            >
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 18 }}>
                    <View style={{ backgroundColor: colors.card, borderRadius: 18, padding: 16 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
                            <Text style={{ flex: 1, color: colors.text, fontSize: 17, fontWeight: "900" }}>Đăng lên Nhật ký</Text>
                            <TouchableOpacity onPress={() => setPostModalVisible(false)} style={{ padding: 6 }}>
                                <Ionicons name="close" size={22} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        <TextInput
                            value={postText}
                            onChangeText={setPostText}
                            placeholder="Hôm nay bạn thế nào?"
                            placeholderTextColor={colors.textSecondary}
                            multiline
                            style={{
                                minHeight: 110,
                                color: colors.text,
                                backgroundColor: colors.searchBg,
                                borderRadius: 12,
                                padding: 12,
                                textAlignVertical: "top",
                                fontSize: 15,
                            }}
                        />
                        {postAsset ? (
                            <View style={{ marginTop: 12 }}>
                                {postAsset.type === "video" ? (
                                    <View style={{ height: 180, borderRadius: 12, overflow: "hidden", backgroundColor: "#000" }}>
                                        <Video
                                            source={{ uri: postAsset.uri }}
                                            style={{ width: "100%", height: "100%" }}
                                            resizeMode={ResizeMode.CONTAIN}
                                            useNativeControls
                                            shouldPlay={false}
                                            isLooping={false}
                                        />
                                    </View>
                                ) : (
                                    <Image source={{ uri: postAsset.uri }} style={{ width: "100%", height: 180, borderRadius: 12 }} resizeMode="cover" />
                                )}
                                <TouchableOpacity
                                    onPress={() => setPostAsset(null)}
                                    style={{ position: "absolute", top: 8, right: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" }}
                                >
                                    <Ionicons name="close" size={18} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        ) : null}
                        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 14, gap: 10 }}>
                            <TouchableOpacity
                                activeOpacity={0.78}
                                onPress={handlePickPostMedia}
                                style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.searchBg }}
                            >
                                <Ionicons name="image-outline" size={18} color={colors.primary} />
                                <Text style={{ color: colors.text, fontWeight: "700" }}>Ảnh/Video</Text>
                            </TouchableOpacity>
                            <View style={{ flex: 1 }} />
                            <TouchableOpacity
                                activeOpacity={0.8}
                                disabled={posting}
                                onPress={handleSubmitPost}
                                style={{ paddingHorizontal: 18, paddingVertical: 11, borderRadius: 20, backgroundColor: colors.primary, opacity: posting ? 0.65 : 1 }}
                            >
                                <Text style={{ color: "#fff", fontWeight: "800" }}>{posting ? "Đang đăng..." : "Đăng"}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal
                transparent
                visible={!!postPrivacyTarget}
                animationType="fade"
                statusBarTranslucent
                onRequestClose={() => setPostPrivacyTarget(null)}
            >
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.52)", justifyContent: "flex-end" }}>
                    <TouchableOpacity
                        activeOpacity={1}
                        onPress={() => setPostPrivacyTarget(null)}
                        style={{ ...StyleSheet.absoluteFillObject }}
                    />
                    <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 12, paddingBottom: 26 }}>
                        <View style={{ alignItems: "center", paddingBottom: 8 }}>
                            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
                        </View>
                        <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800", textAlign: "center" }}>
                            Ai được xem bài viết này?
                        </Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: "center", marginTop: 4, marginBottom: 10 }}>
                            Bạn có thể đổi đối tượng xem bất cứ lúc nào
                        </Text>
                        {([
                            ["ALL_FRIENDS", "people-outline", "Bạn bè Zalo", "Bạn bè của bạn có thể xem"],
                            ["SPECIFIC", "person-add-outline", "Một số bạn bè", "Giữ danh sách đã chọn hiện tại"],
                            ["EXCLUDE", "person-remove-outline", "Ngoại trừ...", "Ẩn với danh sách đã chọn hiện tại"],
                        ] as const).map(([value, icon, title, subtitle]) => {
                            const active = (postPrivacyTarget?.privacy || "ALL_FRIENDS") === value;
                            return (
                                <TouchableOpacity
                                    key={value}
                                    disabled={privacySaving}
                                    onPress={() => handleChangePostPrivacy(value)}
                                    style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, opacity: privacySaving ? 0.6 : 1 }}
                                >
                                    <Ionicons name={icon as any} size={22} color={colors.textSecondary} style={{ marginRight: 12 }} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>{title}</Text>
                                        <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>{subtitle}</Text>
                                    </View>
                                    {active ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} /> : null}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            </Modal>

            {/* Modal chỉnh sửa lời giới thiệu */}
            <Modal
                transparent
                visible={introModalVisible}
                animationType="fade"
                onRequestClose={() => setIntroModalVisible(false)}
            >
                <View
                    style={{
                        flex: 1,
                        backgroundColor: "rgba(0,0,0,0.6)",
                        justifyContent: "center",
                        alignItems: "center",
                    }}
                >
                    <View
                        style={{
                            width: "88%",
                            backgroundColor: colors.card,
                            borderRadius: 16,
                            padding: 20,
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 17,
                                fontWeight: "600",
                                color: colors.text,
                                textAlign: "center",
                                marginBottom: 16,
                            }}
                        >
                            Lời giới thiệu
                        </Text>

                        <TextInput
                            style={{
                                backgroundColor: colors.searchBg,
                                borderRadius: 10,
                                paddingHorizontal: 14,
                                paddingVertical: 12,
                                fontSize: 15,
                                color: colors.text,
                                height: 100,
                                textAlignVertical: "top",
                            }}
                            value={introText}
                            onChangeText={setIntroText}
                            placeholder="Giới thiệu ngắn gọn về bạn..."
                            placeholderTextColor={colors.textSecondary}
                            multiline
                            numberOfLines={4}
                            autoFocus
                        />

                        <View
                            style={{
                                flexDirection: "row",
                                justifyContent: "flex-end",
                                marginTop: 16,
                                gap: 10,
                            }}
                        >
                            <TouchableOpacity
                                onPress={() => setIntroModalVisible(false)}
                                style={{
                                    paddingVertical: 9,
                                    paddingHorizontal: 18,
                                    borderRadius: 20,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                }}
                                activeOpacity={0.7}
                            >
                                <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                                    Hủy
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleSaveIntro}
                                disabled={saving}
                                style={{
                                    paddingVertical: 9,
                                    paddingHorizontal: 18,
                                    borderRadius: 20,
                                    backgroundColor: colors.primary,
                                    opacity: saving ? 0.6 : 1,
                                }}
                                activeOpacity={0.7}
                            >
                                <Text
                                    style={{
                                        color: "#fff",
                                        fontSize: 14,
                                        fontWeight: "600",
                                    }}
                                >
                                    {saving ? "Đang lưu..." : "Lưu"}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
