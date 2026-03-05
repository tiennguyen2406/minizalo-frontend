import React, { useState } from "react";
import { View, TextInput, TouchableOpacity, Text, Platform, Alert } from "react-native";
import { Ionicons, MaterialIcons, SimpleLineIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";

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
        <View className="bg-[#1a1a1a] border-t border-[#333]" style={{ paddingBottom: 30 }}>
            {replyTo && (
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 20,
                        paddingTop: 8,
                        paddingBottom: 4,
                        borderBottomWidth: 1,
                        borderBottomColor: "#374151",
                    }}
                >
                    <View
                        style={{
                            flex: 1,
                            borderLeftWidth: 2,
                            borderLeftColor: "#3b82f6",
                            paddingLeft: 8,
                        }}
                    >
                        {replyTo.senderName && (
                            <Text
                                style={{
                                    color: "#93c5fd",
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
                                color: "#e5e7eb",
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
                            <Ionicons name="close" size={18} color="#9ca3af" />
                        </TouchableOpacity>
                    )}
                </View>
            )}

            <View className="flex-row items-center px-2 py-2" style={{ paddingLeft: 20, paddingRight: 20 }}>
                {/* Sticker Icon */}
                <TouchableOpacity className="mr-2">
                    <MaterialIcons name="emoji-emotions" size={26} color="#888" />
                </TouchableOpacity>

                {/* Input Field */}
                <View className="flex-1 mr-2">
                    <TextInput
                        value={message}
                        onChangeText={setMessage}
                        placeholder="Tin nhắn"
                        placeholderTextColor="#666"
                        className="text-base text-white py-1"
                        multiline
                        onSubmitEditing={handleSend}
                    />
                </View>

                {/* Right Icons */}
                <View className="flex-row items-center space-x-3">
                    {message.trim().length > 0 ? (
                        <TouchableOpacity onPress={handleSend}>
                            <Ionicons name="send" size={26} color="#0091FF" />
                        </TouchableOpacity>
                    ) : (
                        <>
                            <TouchableOpacity onPress={pickFile}>
                                <SimpleLineIcons name="options" size={22} color="#888" />
                            </TouchableOpacity>

                            <TouchableOpacity onPress={takePhoto} style={{ marginLeft: 12 }}>
                                <Ionicons name="camera-outline" size={26} color="#888" />
                            </TouchableOpacity>

                            <TouchableOpacity onPress={pickImage} style={{ marginLeft: 12 }}>
                                <Ionicons name="image-outline" size={26} color="#888" />
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </View>
        </View>
    );
}
