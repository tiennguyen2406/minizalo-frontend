import React, { useState, useCallback, useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { View, TextInput, TouchableOpacity, Text, Platform, Alert, Image, Pressable, StyleSheet, Keyboard, ScrollView, Linking, ActivityIndicator } from "react-native";
import { Ionicons, MaterialIcons, SimpleLineIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as Clipboard from "expo-clipboard";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
const { readAsStringAsync, EncodingType } = FileSystem;
import { api } from "@/shared/services/apiClient";
import { useThemeColors } from "@/shared/theme/colors";

interface ChatFooterProps {
    onSend?: (message: string) => void;
    onSendImage?: (assets: ImagePicker.ImagePickerAsset[]) => void;
    onSendFile?: (files: DocumentPicker.DocumentPickerAsset[]) => void;
    /** Nhóm: mở form tạo bình chọn (giống web). */
    onCreatePoll?: () => void;
    /** Disable toàn bộ gửi tin nhắn (khi admin trên web tắt quyền gửi). */
    disabled?: boolean;
    /** Text hiển thị khi bị disable. */
    disabledText?: string;
    uploadProgress?: number | null;
    uploadText?: string;
    replyTo?: {
        senderName?: string;
        content: string;
    } | null;
    onCancelReply?: () => void;
    onVoiceActiveChange?: (active: boolean) => void;
    roomId?: string;
}

export interface ChatFooterHandle {
    closeEmojiPicker: () => void;
}

const ChatFooter = forwardRef<ChatFooterHandle, ChatFooterProps>((
    {
        onSend,
        onSendImage,
        onSendFile,
        onCreatePoll,
        disabled,
        disabledText,
        uploadProgress,
        uploadText,
        replyTo,
        onCancelReply,
        onVoiceActiveChange,
        roomId,
    },
    ref
) => {
    const [message, setMessage] = useState("");
    const [clipboardImage, setClipboardImage] = useState<string | null>(null);
    const colors = useThemeColors();

    const [isFocused, setIsFocused] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const inputRef = useRef<TextInput>(null);

    // Voice recording
    const [voiceState, setVoiceState] = useState<'none' | 'idle' | 'recording' | 'preview' | 'dictating'>('none');
    const [voiceMode, setVoiceMode] = useState<'record' | 'text'>('record'); // tab: Gửi bản ghi âm / Gửi dạng văn bản
    const [dictatingSubState, setDictatingSubState] = useState<'idle' | 'recording' | 'transcribing'>('idle');
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [previewSound, setPreviewSound] = useState<Audio.Sound | null>(null);
    const [isPlayingPreview, setIsPlayingPreview] = useState(false);
    const [previewUri, setPreviewUri] = useState<string | null>(null);
    const recordingInterval = useRef<NodeJS.Timeout | null>(null);
    const isStartingRecording = useRef(false);

    useEffect(() => {
        const showSub = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setKeyboardVisible(true));
        const hideSub = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboardVisible(false));
        return () => { 
            showSub.remove(); 
            hideSub.remove(); 
            if (recordingInterval.current) clearInterval(recordingInterval.current);
        };
    }, []);

    // Typing Indicator Logic
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isTypingRef = useRef(false);

    useEffect(() => {
        if (!roomId || disabled) return;

        const sendTypingStatus = (typing: boolean) => {
            if (isTypingRef.current === typing) return;
            isTypingRef.current = typing;
            import("@/shared/services/WebSocketService").then(({ webSocketService }) => {
                webSocketService.sendTyping({ roomId, isTyping: typing });
            });
        };

        if (message.length > 0) {
            sendTypingStatus(true);
            
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
                sendTypingStatus(false);
            }, 3000);
        } else {
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            sendTypingStatus(false);
        }

        return () => {
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        };
    }, [message, roomId, disabled]);

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
        // Log or show a simple toast if needed
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
        
        // Stop typing indicator immediately
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        if (isTypingRef.current && roomId) {
            isTypingRef.current = false;
            import("@/shared/services/WebSocketService").then(({ webSocketService }) => {
                webSocketService.sendTyping({ roomId, isTyping: false });
            });
        }

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

    const handleImageOptions = () => {
        Alert.alert(
            "Gửi hình ảnh",
            "Chọn nguồn ảnh",
            [
                { text: "Chụp ảnh", onPress: takePhoto },
                { text: "Chọn từ thư viện", onPress: pickImage },
                { text: "Hủy", style: "cancel" }
            ],
            { cancelable: true }
        );
    };

    const startRecording = async () => {
        if (isStartingRecording.current) return;
        isStartingRecording.current = true;
        try {
            const perm = await Audio.requestPermissionsAsync();
            if (perm.status !== 'granted') {
                Alert.alert("Lỗi", "Cần cấp quyền micro để gửi tin nhắn thoại.");
                isStartingRecording.current = false;
                return;
            }

            // More aggressive cleanup
            if (recording) {
                try {
                    await recording.stopAndUnloadAsync();
                } catch (e) { }
                setRecording(null);
            }

            // Reset audio mode to be sure
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
            });
            
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording: newRecording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );
            setRecording(newRecording);
            setVoiceState('recording');
            setRecordingDuration(0);
            recordingInterval.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error("Failed to start recording", err);
            showToast("Không thể bắt đầu ghi âm");
            setVoiceState('idle');
        } finally {
            isStartingRecording.current = false;
        }
    };

    const stopRecordingForPreview = async () => {
        if (!recording) return;
        if (recordingInterval.current) {
            clearInterval(recordingInterval.current);
            recordingInterval.current = null;
        }
        try {
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();
            setRecording(null);
            
            if (uri) {
                // Fix for playback volume: route to speaker instead of earpiece
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: false,
                    playsInSilentModeIOS: true,
                    playThroughEarpieceAndroid: false,
                });

                setPreviewUri(uri);
                const { sound } = await Audio.Sound.createAsync(
                    { uri },
                    { shouldPlay: false }
                );
                setPreviewSound(sound);
                sound.setOnPlaybackStatusUpdate((status: any) => {
                    if (status.didJustFinish) {
                        setIsPlayingPreview(false);
                        sound.setPositionAsync(0);
                    }
                });
                setVoiceState('preview');
            } else {
                setVoiceState('idle');
            }
        } catch (err) {
            console.error("Failed to stop recording for preview", err);
            setVoiceState('idle');
        }
    };

    const togglePreviewPlay = async () => {
        if (!previewSound) return;
        if (isPlayingPreview) {
            await previewSound.pauseAsync();
            setIsPlayingPreview(false);
        } else {
            await previewSound.playAsync();
            setIsPlayingPreview(true);
        }
    };

    const sendRecording = async () => {
        if (voiceState === 'dictating') {
            handleSend();
            closeVoicePanel();
            return;
        }

        let uriToSend = previewUri;
        
        if (voiceState === 'recording' && recording) {
            if (recordingInterval.current) {
                clearInterval(recordingInterval.current);
                recordingInterval.current = null;
            }
            try {
                await recording.stopAndUnloadAsync();
                uriToSend = recording.getURI();
                setRecording(null);
            } catch (err) {
                console.error("Failed to stop recording for sending", err);
            }
        }
        
        if (uriToSend && recordingDuration > 0) {
            const asset: any = {
                uri: uriToSend,
                mimeType: "audio/m4a",
                name: `voice_${Date.now()}.m4a`,
                size: 0,
            };
            onSendFile?.([asset]);
        }
        
        closeVoicePanel();
    };

    const discardRecording = async () => {
        if (recording) {
            if (recordingInterval.current) {
                clearInterval(recordingInterval.current);
                recordingInterval.current = null;
            }
            try {
                await recording.stopAndUnloadAsync();
            } catch (err) {}
            setRecording(null);
        }
        if (previewSound) {
            try {
                await previewSound.unloadAsync();
            } catch (err) {}
            setPreviewSound(null);
            setIsPlayingPreview(false);
        }
        setPreviewUri(null);
        setRecordingDuration(0);
        setVoiceState('idle');
    };

    const openVoicePanel = () => {
        Keyboard.dismiss();
        setShowEmojiPicker(false);
        setVoiceMode('record');
        setVoiceState('idle');
    };

    const switchToTextMode = () => {
        setVoiceMode('text');
        setDictatingSubState('idle');
        setVoiceState('dictating');
    };

    const switchToRecordMode = () => {
        setVoiceMode('record');
        setVoiceState('idle');
        Keyboard.dismiss();
    };

    const startDictating = async () => {
        if (isStartingRecording.current) return;
        isStartingRecording.current = true;
        // Start recording audio for voice-to-text
        setDictatingSubState('recording');
        try {
            await Audio.requestPermissionsAsync();
            
            // Cleanup previous if any
            if (recording) {
                try { await recording.stopAndUnloadAsync(); } catch (e) { }
                setRecording(null);
            }

            // Reset audio mode to be sure
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
            });

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                playThroughEarpieceAndroid: false,
            });
            const { recording: rec } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );
            setRecording(rec);
            setRecordingDuration(0);
            recordingInterval.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);
        } catch (err) {
            showToast("Không thể bắt đầu ghi âm");
            setDictatingSubState('idle');
        } finally {
            isStartingRecording.current = false;
        }
    };

    const stopDictatingAndTranscribe = async () => {
        if (!recording) return;
        if (recordingInterval.current) {
            clearInterval(recordingInterval.current);
            recordingInterval.current = null;
        }
        setDictatingSubState('transcribing');
        try {
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();
            setRecording(null);

            if (uri) {
                // Read audio file as base64
                const base64Audio = await readAsStringAsync(uri, {
                    encoding: EncodingType.Base64,
                });

                // Send to backend for Gemini transcription
                const response = await api.post('/chat/rooms/speech-to-text', {
                    audio: base64Audio,
                    mimeType: 'audio/mp4',
                });

                const text = response.data?.text || '';
                if (text.trim()) {
                    setMessage(prev => prev + text.trim());
                    showToast("Đã chuyển giọng nói thành văn bản!");
                } else {
                    showToast("Không nhận diện được giọng nói. Thử lại?");
                }
            }
        } catch (err) {
            console.error('Speech-to-text error:', err);
            showToast("Lỗi nhận diện giọng nói. Thử lại?");
        }
        setDictatingSubState('idle');
        setRecordingDuration(0);
    };

    const stopDictatingAndEdit = () => {
        setVoiceState('none');
        inputRef.current?.focus();
    };

    const clearDictating = () => {
        setMessage("");
        setVoiceState('none');
    };

    const sendDictating = () => {
        handleSend();
        setVoiceState('none');
    };

    const closeVoicePanel = async () => {
        setVoiceState('none');
        setVoiceMode('record');
        setDictatingSubState('idle');
        if (recordingInterval.current) {
            clearInterval(recordingInterval.current);
            recordingInterval.current = null;
        }
        if (recording) {
            const rec = recording;
            setRecording(null);
            try {
                await rec.stopAndUnloadAsync();
            } catch (err) {
                // Ignore if already unloaded
            }
        }
        if (previewSound) {
            try { await previewSound.unloadAsync(); } catch(e) {}
            setPreviewSound(null);
            setIsPlayingPreview(false);
            setPreviewUri(null);
        }
        setRecordingDuration(0);

        // Reset audio mode to prevent recorder conflicts
        try {
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
            });
        } catch (e) {}
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
        setShowEmojiPicker(false);
        if (voiceState !== 'none' && voiceState !== 'dictating') {
            closeVoicePanel();
        }
        inputRef.current?.focus();
    };

    const toggleEmojiPicker = () => {
        if (showEmojiPicker) {
            inputRef.current?.focus();
        } else {
            Keyboard.dismiss();
            if (voiceState !== 'none') closeVoicePanel();
            setShowEmojiPicker(true);
        }
    };

    const handleSelectEmoji = (emoji: string) => {
        setMessage(prev => prev + emoji);
    };

    useImperativeHandle(ref, () => ({
        closeEmojiPicker: () => {
            setShowEmojiPicker(false);
            // Only close voice panel when idle (not recording/preview/dictating)
            if (voiceState === 'idle') {
                closeVoicePanel();
            }
        }
    }));

    const isVoiceOverlayActive = voiceState === 'recording' || voiceState === 'preview' || dictatingSubState === 'recording' || dictatingSubState === 'transcribing';
    const isVoiceDismissible = voiceState === 'idle' || (voiceState === 'dictating' && dictatingSubState === 'idle');

    useEffect(() => {
        onVoiceActiveChange?.(isVoiceOverlayActive || isVoiceDismissible);
    }, [isVoiceOverlayActive, isVoiceDismissible, onVoiceActiveChange]);

    return (
        <View style={{ backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border, paddingBottom: keyboardVisible ? 4 : (Platform.OS === 'ios' ? 30 : 10) }}>
            
            {/* Dark overlay for chat area when recording/idle */}
            {(isVoiceOverlayActive || isVoiceDismissible) && (
                <Pressable
                    style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: 0,
                        right: 0,
                        height: 3000,
                        backgroundColor: isVoiceOverlayActive ? 'rgba(0,0,0,0.6)' : 'transparent',
                        zIndex: 100,
                    }}
                    onPress={() => {
                        if (isVoiceDismissible) closeVoicePanel();
                    }}
                />
            )}

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

            {!isVoiceOverlayActive && (
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 }}>
                    {/* Sticker Icon */}
                    <TouchableOpacity 
                        style={{ marginRight: 10 }}
                    onPress={toggleEmojiPicker}
                    disabled={!!disabled}
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
                            setShowEmojiPicker(false);
                            if (voiceState !== 'none') {
                                // Close panel immediately to reduce layout jump lag
                                closeVoicePanel();
                                // Re-focus after a short delay to ensure keyboard stays up
                                setTimeout(() => {
                                    if (inputRef.current) {
                                        inputRef.current.focus();
                                    }
                                }, 100);
                            }
                        }}
                        onBlur={() => setIsFocused(false)}
                        placeholder={disabled ? (disabledText || "Bạn không có quyền gửi tin nhắn") : "Tin nhắn"}
                        placeholderTextColor={colors.textSecondary}
                        editable={!disabled}
                        style={{
                            fontSize: 16,
                            color: colors.text,
                            paddingVertical: 6,
                            opacity: disabled ? 0.65 : 1,
                        }}
                        multiline
                        onSubmitEditing={handleSend}
                    />
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {disabled ? null : (message.trim().length > 0 || clipboardImage || (voiceState !== 'none' && voiceState !== 'dictating')) ? (
                        <TouchableOpacity onPress={voiceState !== 'none' && voiceState !== 'dictating' ? sendRecording : (clipboardImage ? handlePasteImage : handleSend)}>
                            <Ionicons name="send" size={26} color={colors.primary} />
                        </TouchableOpacity>
                    ) : (
                        <>
                            <TouchableOpacity onPress={pickFile} disabled={!!disabled}>
                                <SimpleLineIcons name="options" size={22} color={colors.textSecondary} />
                            </TouchableOpacity>

                            {onCreatePoll && (
                                <TouchableOpacity onPress={onCreatePoll} style={{ marginLeft: 16 }} disabled={!!disabled}>
                                    <Ionicons name="stats-chart-outline" size={26} color={colors.textSecondary} />
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity onPress={openVoicePanel} style={{ marginLeft: 16 }} disabled={!!disabled}>
                                <Ionicons name="mic-outline" size={26} color={colors.textSecondary} />
                            </TouchableOpacity>

                            <TouchableOpacity onPress={handleImageOptions} style={{ marginLeft: 16 }} disabled={!!disabled}>
                                <Ionicons name="image-outline" size={26} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </>
                    )}
                </View>
                </View>
            )}

            {/* Voice Record Board */}
            {voiceState !== 'none' && voiceState !== 'dictating' && (
                <View style={{ 
                    height: 320, 
                    backgroundColor: colors.background,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingBottom: 20
                }}>
                    {voiceState === 'idle' && (
                        <>
                            <Text style={{ color: colors.textSecondary, marginBottom: 30, fontSize: 16 }}>Bấm hoặc bấm giữ để ghi âm</Text>
                            <TouchableOpacity 
                                onPress={startRecording}
                                style={{
                                    width: 100, height: 100, borderRadius: 50,
                                    backgroundColor: colors.primary,
                                    justifyContent: 'center', alignItems: 'center',
                                    marginBottom: 30
                                }}
                            >
                                <Ionicons name="mic" size={48} color="#fff" />
                            </TouchableOpacity>
                            
                            <View style={{ flexDirection: 'row', backgroundColor: colors.card, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
                                <TouchableOpacity style={{ paddingVertical: 10, paddingHorizontal: 20, backgroundColor: voiceMode === 'record' ? '#fff' : 'transparent', borderRadius: 20 }} onPress={switchToRecordMode}>
                                    <Text style={{ fontWeight: voiceMode === 'record' ? 'bold' : 'normal', color: voiceMode === 'record' ? '#000' : colors.textSecondary }}>Gửi bản ghi âm</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={switchToTextMode} style={{ paddingVertical: 10, paddingHorizontal: 20, backgroundColor: voiceMode === 'text' ? '#fff' : 'transparent', borderRadius: 20 }}>
                                    <Text style={{ fontWeight: voiceMode === 'text' ? 'bold' : 'normal', color: voiceMode === 'text' ? '#000' : colors.textSecondary }}>Gửi dạng văn bản</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    )}

                    {voiceState === 'recording' && (
                        <>
                            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, paddingVertical: 16, paddingHorizontal: 24, borderRadius: 30, marginBottom: 50, elevation: 2 }}>
                                <Ionicons name="mic" size={24} color={colors.primary} style={{ marginRight: 10 }} />
                                <Text style={{ color: colors.primary, fontSize: 18, letterSpacing: 2, opacity: recordingDuration % 2 === 0 ? 1 : 0.5 }}>|||||||||||||||||||||||</Text>
                                <Text style={{ marginLeft: 16, fontSize: 16, color: colors.text }}>
                                    {Math.floor(recordingDuration / 60).toString().padStart(2, '0')}:{(recordingDuration % 60).toString().padStart(2, '0')}
                                </Text>
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', width: '100%', paddingHorizontal: 20 }}>
                                <TouchableOpacity onPress={discardRecording} style={{ alignItems: 'center' }}>
                                    <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center', marginBottom: 8 }}>
                                        <Ionicons name="trash" size={28} color={colors.text} />
                                    </View>
                                    <Text style={{ color: colors.text }}>Xóa</Text>
                                </TouchableOpacity>

                                <TouchableOpacity onPress={sendRecording} style={{ alignItems: 'center' }}>
                                    <View style={{ width: 90, height: 90, borderRadius: 45, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 8, elevation: 3 }}>
                                        <Ionicons name="send" size={36} color="#fff" style={{ marginLeft: 4 }} />
                                    </View>
                                    <Text style={{ color: colors.text }}>Gửi</Text>
                                </TouchableOpacity>

                                <TouchableOpacity onPress={stopRecordingForPreview} style={{ alignItems: 'center' }}>
                                    <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center', marginBottom: 8 }}>
                                        <Ionicons name="pause" size={28} color={colors.text} />
                                    </View>
                                    <Text style={{ color: colors.text }}>Nghe lại</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    )}

                    {voiceState === 'preview' && (
                        <>
                            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, paddingVertical: 16, paddingHorizontal: 24, borderRadius: 30, marginBottom: 50, elevation: 2 }}>
                                <TouchableOpacity onPress={togglePreviewPlay}>
                                    <Ionicons name={isPlayingPreview ? "pause-circle" : "play-circle"} size={36} color={colors.primary} style={{ marginRight: 10 }} />
                                </TouchableOpacity>
                                <Text style={{ color: colors.primary, fontSize: 18, letterSpacing: 2 }}>|||||||||||||||||||||||</Text>
                                <Text style={{ marginLeft: 16, fontSize: 16, color: colors.text }}>
                                    {Math.floor(recordingDuration / 60).toString().padStart(2, '0')}:{(recordingDuration % 60).toString().padStart(2, '0')}
                                </Text>
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', width: '100%', paddingHorizontal: 60 }}>
                                <TouchableOpacity onPress={discardRecording} style={{ alignItems: 'center' }}>
                                    <View style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center', marginBottom: 8 }}>
                                        <Ionicons name="trash" size={32} color={colors.text} />
                                    </View>
                                    <Text style={{ color: colors.text }}>Xóa</Text>
                                </TouchableOpacity>

                                <TouchableOpacity onPress={sendRecording} style={{ alignItems: 'center' }}>
                                    <View style={{ width: 90, height: 90, borderRadius: 45, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 8, elevation: 3 }}>
                                        <Ionicons name="send" size={36} color="#fff" style={{ marginLeft: 4 }} />
                                    </View>
                                    <Text style={{ color: colors.text }}>Gửi</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                </View>
            )}

            {/* Dictating (Voice-to-Text) Board */}
            {voiceState === 'dictating' && (
                <View style={{ 
                    height: 320, 
                    backgroundColor: colors.background,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingBottom: 20
                }}>
                    {dictatingSubState === 'idle' && (
                        <>
                            <Text style={{ color: colors.textSecondary, marginBottom: 30, fontSize: 16 }}>Bấm để bắt đầu ghi âm</Text>
                            <TouchableOpacity 
                                onPress={startDictating}
                                style={{
                                    width: 100, height: 100, borderRadius: 50,
                                    backgroundColor: colors.primary,
                                    justifyContent: 'center', alignItems: 'center',
                                    marginBottom: 30
                                }}
                            >
                                <Ionicons name="mic" size={48} color="#fff" />
                            </TouchableOpacity>

                            <View style={{ flexDirection: 'row', backgroundColor: colors.card, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
                                <TouchableOpacity onPress={switchToRecordMode} style={{ paddingVertical: 10, paddingHorizontal: 20 }}>
                                    <Text style={{ color: colors.textSecondary }}>Gửi bản ghi âm</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={{ paddingVertical: 10, paddingHorizontal: 20, backgroundColor: '#fff', borderRadius: 20 }}>
                                    <Text style={{ fontWeight: 'bold', color: '#000' }}>Gửi dạng văn bản</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    )}

                    {dictatingSubState === 'recording' && (
                        <>
                            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, paddingVertical: 16, paddingHorizontal: 24, borderRadius: 30, marginBottom: 40, elevation: 2 }}>
                                <Ionicons name="mic" size={24} color="#e74c3c" style={{ marginRight: 10 }} />
                                <Text style={{ color: '#e74c3c', fontSize: 16, fontWeight: '600' }}>Đang lắng nghe...</Text>
                                <Text style={{ marginLeft: 16, fontSize: 16, color: colors.text }}>
                                    {Math.floor(recordingDuration / 60).toString().padStart(2, '0')}:{(recordingDuration % 60).toString().padStart(2, '0')}
                                </Text>
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', width: '100%', paddingHorizontal: 40 }}>
                                <TouchableOpacity onPress={() => { if (recordingInterval.current) clearInterval(recordingInterval.current); if (recording) { try { recording.stopAndUnloadAsync(); } catch(e) {} setRecording(null); } setDictatingSubState('idle'); setRecordingDuration(0); }} style={{ alignItems: 'center' }}>
                                    <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center', marginBottom: 8 }}>
                                        <Ionicons name="trash" size={28} color={colors.text} />
                                    </View>
                                    <Text style={{ color: colors.text }}>Xóa</Text>
                                </TouchableOpacity>

                                <TouchableOpacity onPress={stopDictatingAndTranscribe} style={{ alignItems: 'center' }}>
                                    <View style={{ width: 90, height: 90, borderRadius: 45, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 8, elevation: 3 }}>
                                        <Ionicons name="stop" size={36} color="#fff" />
                                    </View>
                                    <Text style={{ color: colors.text }}>Dừng & Chuyển văn bản</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    )}

                    {dictatingSubState === 'transcribing' && (
                        <View style={{ alignItems: 'center' }}>
                            <ActivityIndicator size="large" color={colors.primary} style={{ marginBottom: 20 }} />
                            <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Đang chuyển giọng nói thành văn bản...</Text>
                        </View>
                    )}
                </View>
            )}

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
