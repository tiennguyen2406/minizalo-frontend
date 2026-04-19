import React, { useState, useCallback, useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { View, TextInput, TouchableOpacity, Text, Platform, Alert, Image, Pressable, StyleSheet, Keyboard, ScrollView, Linking } from "react-native";
import { Ionicons, MaterialIcons, SimpleLineIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as Clipboard from "expo-clipboard";
import { useThemeColors } from "@/shared/theme/colors";

interface ChatFooterProps {
    onSend?: (message: string) => void;
    onSendImage?: (assets: ImagePicker.ImagePickerAsset[]) => void;
    onSendFile?: (files: DocumentPicker.DocumentPickerAsset[]) => void;
    /** Nhóm: mở form tạo bình chọn (giống web). */
    onCreatePoll?: () => void;
    uploadProgress?: number | null;
    uploadText?: string;
    replyTo?: {
        senderName?: string;
        content: string;
    } | null;
    onCancelReply?: () => void;
}

export interface ChatFooterHandle {
    closeEmojiPicker: () => void;
}

const ChatFooter = forwardRef<ChatFooterHandle, ChatFooterProps>((
    { onSend, onSendImage, onSendFile, onCreatePoll, uploadProgress, uploadText, replyTo, onCancelReply },
    ref
) => {
    const [message, setMessage] = useState("");
    const [clipboardImage, setClipboardImage] = useState<string | null>(null);
    const colors = useThemeColors();

    const [isFocused, setIsFocused] = useState(false);
    const [showPasteTooltip, setShowPasteTooltip] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const inputRef = useRef<TextInput>(null);

    useEffect(() => {
        const showSub = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setKeyboardVisible(true));
        const hideSub = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboardVisible(false));
        return () => { showSub.remove(); hideSub.remove(); };
    }, []);

    const EMOJI_LIST = [
        "😊", "😰", "😍", "😂", "😎", "😭", "😚", "😜",
        "😴", "😠", "😓", "😡", "😋", "😁", "😮", "😟",
        "😏", "😳", "😎", "😘", "🤭", "😌", "🤫", "🤔",
        "😒", "😛", "🤢", "😱", "😕", "😖", "🚬", "😤",
        "🤥", "🤓", "🤩", "🤯", "🧐", "🥵", "🥶", "🥳",
        "😵‍💫", "🥴", "🥺", "🥰", "🥱", "🥸", "🤪", "🤑",
        "👍", "👎", "👌", "✌️", "🤞", "🤟", "🤘", "🤙",
        "👋", "👏", "🙌", "👐", "🤲", "🙏", "🤝", "💅",
        "🤳", "💪", "🦾", "🦶", "🦵", "👂", "👃", "🧠",
        "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍",
        "🔥", "✨", "🌟", "💢", "💯", "🎈", "🎉", "🎊"
    ];

    const checkHasContent = async (): Promise<boolean> => {
        try {
            const hasImg = await Clipboard.hasImageAsync();
            if (hasImg) return true;
            const hasString = await Clipboard.hasStringAsync();
            if (hasString) {
                const str = await Clipboard.getStringAsync();
                return str.trim().length > 0;
            }
            return false;
        } catch (e) {
            return false;
        }
    };

    const handlePasteFromClipboard = async () => {
        try {
            const hasImg = await Clipboard.hasImageAsync();
            if (hasImg) {
                const img = await Clipboard.getImageAsync({ format: "png" });
                if (img?.data) {
                    setClipboardImage(img.data);
                    showToast("Đã lấy ảnh từ bộ nhớ tạm");
                    return;
                }
            }
            
            const str = await Clipboard.getStringAsync();
            if (str) {
                // Improved image URL detection (handles query params and MinIO paths)
                const isImgUrl = (str.startsWith('http') && (
                    str.match(/\.(jpg|jpeg|png|gif|webp|heic)(\?.*)?$/i) || 
                    str.includes('/files/download/')
                ));

                if (isImgUrl) {
                    setClipboardImage(str);
                    showToast("Đã lấy liên kết ảnh");
                } else {
                    // Normal text or link - append to message
                    setMessage(prev => {
                        const space = prev.length > 0 && !prev.endsWith(" ") ? " " : "";
                        return prev + space + str;
                    });
                    showToast("Đã dán văn bản");
                }
            }
        } catch (e) {
            console.error("Error fetching clipboard content:", e);
        }
    };

    const showToast = (msg: string) => {
        // We could use a local toast or just ignore, 
        // but feedback is nice.
    };

    const handlePasteImage = async () => {
        if (!clipboardImage) return;
        
        let uri = clipboardImage;
        if (!uri.startsWith('http') && !uri.startsWith('data:')) {
            uri = `data:image/png;base64,${clipboardImage}`;
        }

        const asset: any = {
            uri,
            type: "image",
            width: 500,
            height: 500,
            fileName: `clipboard_${Date.now()}.png`,
        };
        
        onSendImage?.([asset]);
        setClipboardImage(null);
    };

    const handleSend = () => {
        const trimmed = message.trim();
        if (trimmed.length === 0) return;
        onSend?.(trimmed);
        setMessage("");
    };

    const requestPermission = async (type: "camera" | "library") => {
        if (type === "camera") {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== "granted") {
                Alert.alert("Cần quyền truy cập", "Vui lòng cho phép truy cập camera để chụp ảnh.");
                return false;
            }
        } else {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== "granted") {
                Alert.alert("Cần quyền truy cập", "Vui lòng cho phép truy cập thư viện ảnh.");
                return false;
            }
        }
        return true;
    };

    const pickImage = async () => {
        const ok = await requestPermission("library");
        if (!ok) return;

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images", "videos"],
            quality: 0.8,
            allowsMultipleSelection: true,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            onSendImage?.(result.assets);
        }
    };

    const takePhoto = async () => {
        const ok = await requestPermission("camera");
        if (!ok) return;

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ["images", "videos"],
            quality: 0.8,
        });

        if (!result.canceled && result.assets?.[0]) {
            onSendImage?.([result.assets[0]]);
        }
    };

    const pickFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: "*/*",
                copyToCacheDirectory: true,
                multiple: true,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                onSendFile?.(result.assets);
            }
        } catch (err) {
            // console.log("Error picking file:", err);
        }
    };


    const handlePressInput = () => {
        setShowPasteTooltip(false);
        setShowEmojiPicker(false);
        inputRef.current?.focus();
    };

    const toggleEmojiPicker = () => {
        if (showEmojiPicker) {
            inputRef.current?.focus();
        } else {
            Keyboard.dismiss();
            setShowEmojiPicker(true);
        }
    };

    const handleSelectEmoji = (emoji: string) => {
        setMessage(prev => prev + emoji);
    };

    useImperativeHandle(ref, () => ({
        closeEmojiPicker: () => {
            setShowEmojiPicker(false);
        }
    }));

    return (
        <View style={{ backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border, paddingBottom: keyboardVisible ? 4 : (Platform.OS === 'ios' ? 30 : 10) }}>
            {/* Clipboard image preview/paste bar (SHOWN AFTER CLICKING "DÁN") */}
            {clipboardImage && (
                <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    backgroundColor: colors.card,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                }}>
                    <View style={{ width: 40, height: 40, borderRadius: 4, overflow: 'hidden', marginRight: 12 }}>
                        <Image 
                            source={{ 
                                uri: clipboardImage.startsWith('http') 
                                    ? clipboardImage 
                                    : (clipboardImage.startsWith('data:') 
                                        ? clipboardImage 
                                        : `data:image/png;base64,${clipboardImage}`) 
                            }} 
                            style={{ width: 40, height: 40 }} 
                        />
                    </View>
                    <TouchableOpacity onPress={handlePasteImage} style={{
                        backgroundColor: colors.primary,
                        paddingHorizontal: 16,
                        paddingVertical: 6,
                        borderRadius: 15,
                    }}>
                        <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>Gửi</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setClipboardImage(null)} style={{ marginLeft: "auto", padding: 4 }}>
                        <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                </View>
            )}

            {/* Small Paste Tooltip that appears on Tap while already focused */}
            {showPasteTooltip && (
                <View style={{
                    position: 'absolute',
                    top: -45,
                    left: 20,
                    zIndex: 2000,
                }}>
                    <TouchableOpacity 
                        onPress={() => {
                            setShowPasteTooltip(false);
                            handlePasteFromClipboard();
                        }}
                        activeOpacity={0.8}
                        style={{
                            backgroundColor: colors.card,
                            paddingHorizontal: 20,
                            paddingVertical: 8,
                            borderRadius: 8,
                            borderWidth: 0.5,
                            borderColor: colors.border,
                            elevation: 5,
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.2,
                            shadowRadius: 3,
                        }}
                    >
                        <Text style={{ color: colors.text, fontWeight: "600" }}>Dán</Text>
                    </TouchableOpacity>
                    {/* Triangle arrow for tooltip */}
                    <View style={{
                        width: 0,
                        height: 0,
                        backgroundColor: "transparent",
                        borderStyle: "solid",
                        borderLeftWidth: 8,
                        borderRightWidth: 8,
                        borderTopWidth: 8,
                        borderLeftColor: "transparent",
                        borderRightColor: "transparent",
                        borderTopColor: colors.card,
                        alignSelf: 'center',
                        marginTop: -1,
                    }} />
                </View>
            )}

            {replyTo && (
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 16,
                        paddingTop: 8,
                        paddingBottom: 4,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                    }}
                >
                    <View
                        style={{
                            flex: 1,
                            borderLeftWidth: 2,
                            borderLeftColor: colors.primary,
                            paddingLeft: 8,
                        }}
                    >
                        {replyTo.senderName && (
                            <Text
                                style={{
                                    color: colors.primary,
                                    fontSize: 12,
                                    fontWeight: "600",
                                }}
                            >
                                Đang trả lời {replyTo.senderName}
                            </Text>
                        )}
                        <Text
                            numberOfLines={1}
                            style={{
                                color: colors.text,
                                fontSize: 12,
                            }}
                        >
                            {replyTo.content}
                        </Text>
                    </View>
                    {onCancelReply && (
                        <TouchableOpacity
                            onPress={onCancelReply}
                            style={{ paddingHorizontal: 8, paddingVertical: 4 }}
                        >
                            <Ionicons name="close" size={18} color={colors.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {uploadProgress != null && (
                <View
                    style={{
                        paddingHorizontal: 16,
                        paddingTop: 8,
                        paddingBottom: 6,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                    }}
                >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                            {uploadText || "Đang tải tệp..."}
                        </Text>
                        <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "700" }}>
                            {Math.max(0, Math.min(100, Math.round(uploadProgress)))}%
                        </Text>
                    </View>
                    <View
                        style={{
                            height: 4,
                            borderRadius: 999,
                            backgroundColor: colors.border,
                            overflow: "hidden",
                        }}
                    >
                        <View
                            style={{
                                width: `${Math.max(0, Math.min(100, uploadProgress))}%`,
                                height: "100%",
                                backgroundColor: colors.primary,
                            }}
                        />
                    </View>
                </View>
            )}

            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 }}>
                {/* Sticker Icon */}
                <TouchableOpacity 
                    style={{ marginRight: 10 }}
                    onPress={toggleEmojiPicker}
                >
                    <MaterialIcons 
                        name="emoji-emotions" 
                        size={26} 
                        color={showEmojiPicker ? colors.primary : colors.textSecondary} 
                    />
                </TouchableOpacity>

                {/* Input Field Area */}
                <View style={{ flex: 1, marginRight: 10, position: 'relative' }}>
                    <TextInput
                        ref={inputRef}
                        value={message}
                        onChangeText={setMessage}
                        onFocus={() => {
                            setIsFocused(true);
                            setShowPasteTooltip(false);
                            setShowEmojiPicker(false);
                        }}
                        onBlur={() => setIsFocused(false)}
                        placeholder="Tin nhắn"
                        placeholderTextColor={colors.textSecondary}
                        style={{
                            fontSize: 16,
                            color: colors.text,
                            paddingVertical: 6,
                        }}
                        multiline
                        onSubmitEditing={handleSend}
                    />
                    {/* Invisible pressable overlay for focus and "Dán" on second tap */}
                    <Pressable 
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                        onPress={() => {
                            if (isFocused) {
                                // Tap while already focused -> Check clipboard
                                checkHasContent().then((hasContent: boolean) => {
                                    if (hasContent) setShowPasteTooltip(true);
                                });
                            } else {
                                handlePressInput();
                            }
                        }}
                    />
                </View>

                {/* Right Icons */}
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {(message.trim().length > 0 || clipboardImage) ? (
                        <TouchableOpacity onPress={clipboardImage ? handlePasteImage : handleSend}>
                            <Ionicons name="send" size={26} color={colors.primary} />
                        </TouchableOpacity>
                    ) : (
                        <>
                            <TouchableOpacity onPress={pickFile}>
                                <SimpleLineIcons name="options" size={22} color={colors.textSecondary} />
                            </TouchableOpacity>

                            {onCreatePoll && (
                                <TouchableOpacity onPress={onCreatePoll} style={{ marginLeft: 16 }}>
                                    <Ionicons name="stats-chart-outline" size={26} color={colors.textSecondary} />
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity onPress={takePhoto} style={{ marginLeft: 16 }}>
                                <Ionicons name="camera-outline" size={26} color={colors.textSecondary} />
                            </TouchableOpacity>

                            <TouchableOpacity onPress={pickImage} style={{ marginLeft: 16 }}>
                                <Ionicons name="image-outline" size={26} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </View>


            {/* Emoji Picker Board */}
            {showEmojiPicker && (
                <View style={{ 
                    height: 250, 
                    backgroundColor: colors.card,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                }}>
                    <ScrollView 
                        contentContainerStyle={{ 
                            flexDirection: 'row', 
                            flexWrap: 'wrap', 
                            padding: 10,
                            justifyContent: 'space-between'
                        }}
                    >
                        {EMOJI_LIST.map((emoji, index) => (
                            <TouchableOpacity
                                key={index}
                                onPress={() => handleSelectEmoji(emoji)}
                                style={{
                                    width: '12.5%', // 8 emojis per row
                                    height: 45,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                }}
                            >
                                <Text style={{ fontSize: 28 }}>{emoji}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}
        </View>
    );
});

export default ChatFooter;
