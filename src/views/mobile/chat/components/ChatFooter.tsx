import React, { useState } from "react";
import { View, TextInput, TouchableOpacity, Text, Platform, Alert } from "react-native";
import { Ionicons, MaterialIcons, SimpleLineIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { useThemeColors } from "@/shared/theme/colors";

interface ChatFooterProps {
    onSend?: (message: string) => void;
    onSendImage?: (assets: ImagePicker.ImagePickerAsset[]) => void;
    onSendFile?: (file: DocumentPicker.DocumentPickerAsset) => void;
    replyTo?: {
        senderName?: string;
        content: string;
    } | null;
    onCancelReply?: () => void;
}

export default function ChatFooter({ onSend, onSendImage, onSendFile, replyTo, onCancelReply }: ChatFooterProps) {
    const [message, setMessage] = useState("");
    const colors = useThemeColors();

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
            mediaTypes: ["images"],
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
            mediaTypes: ["images"],
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
            });

            if (!result.canceled && result.assets?.[0]) {
                onSendFile?.(result.assets[0]);
            }
        } catch (err) {
            console.log("Error picking file:", err);
        }
    };

    return (
        <View style={{ backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border, paddingBottom: Platform.OS === 'ios' ? 30 : 10 }}>
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

            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 }}>
                {/* Sticker Icon */}
                <TouchableOpacity style={{ marginRight: 10 }}>
                    <MaterialIcons name="emoji-emotions" size={26} color={colors.textSecondary} />
                </TouchableOpacity>

                {/* Input Field */}
                <View style={{ flex: 1, marginRight: 10 }}>
                    <TextInput
                        value={message}
                        onChangeText={setMessage}
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
                </View>

                {/* Right Icons */}
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {message.trim().length > 0 ? (
                        <TouchableOpacity onPress={handleSend}>
                            <Ionicons name="send" size={26} color={colors.primary} />
                        </TouchableOpacity>
                    ) : (
                        <>
                            <TouchableOpacity onPress={pickFile}>
                                <SimpleLineIcons name="options" size={22} color={colors.textSecondary} />
                            </TouchableOpacity>

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
        </View>
    );
}
