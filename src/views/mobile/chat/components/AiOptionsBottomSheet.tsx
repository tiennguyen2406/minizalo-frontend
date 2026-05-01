import React from "react";
import { Modal, View, Text, TouchableOpacity, ScrollView, Alert, Platform, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/shared/theme/colors";

interface AiOptionsBottomSheetProps {
    visible: boolean;
    onClose: () => void;
    onSelectSummarize: () => void;
    onSelectPersona: () => void;
}

export default function AiOptionsBottomSheet({
    visible,
    onClose,
    onSelectSummarize,
    onSelectPersona,
}: AiOptionsBottomSheetProps) {
    const colors = useThemeColors();

    const handleFeatureSelect = (action: () => void) => {
        action();
        onClose();
    };

    const handleComingSoon = (featureName: string) => {
        Alert.alert(
            "Tính năng đang phát triển",
            `Tính năng "${featureName}" đang được tích hợp và sẽ sớm ra mắt trong các phiên bản tiếp theo.`,
            [{ text: "Đóng", style: "cancel" }]
        );
        onClose();
    };

    return (
        <Modal
            transparent
            animationType="slide"
            visible={visible}
            onRequestClose={onClose}
        >
            <TouchableOpacity
                activeOpacity={1}
                style={{
                    flex: 1,
                    backgroundColor: "rgba(0,0,0,0.4)",
                }}
                onPress={onClose}
            >
                <Pressable onPress={(e) => e.stopPropagation()} style={{ position: 'absolute', bottom: 0, width: '100%' }}>
                    <View
                        style={{
                            backgroundColor: colors.background,
                            paddingHorizontal: 20,
                            paddingTop: 12,
                            paddingBottom: Platform.OS === 'ios' ? 34 : 24,
                            borderTopLeftRadius: 20,
                            borderTopRightRadius: 20,
                            maxHeight: '100%',
                        }}
                    >
                        {/* Drag handle */}
                        <View style={{ alignItems: "center", marginBottom: 16 }}>
                            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
                        </View>

                        <Text
                            style={{
                                color: colors.text,
                                fontSize: 18,
                                fontWeight: "700",
                                marginBottom: 16,
                                textAlign: "center",
                            }}
                        >
                            Trợ lý AI Gemini
                        </Text>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Option 1: Tóm tắt */}
                            <TouchableOpacity
                                onPress={() => handleFeatureSelect(onSelectSummarize)}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    paddingVertical: 14,
                                    borderBottomWidth: 1,
                                    borderBottomColor: colors.border,
                                }}
                            >
                                <View style={{ width: 40, alignItems: "center" }}>
                                    <Ionicons name="document-text" size={24} color="#3b82f6" />
                                </View>
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>
                                        Tóm tắt cuộc trò chuyện
                                    </Text>
                                    <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                                        Đọc nhanh nội dung chính của toàn bộ tin nhắn
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            {/* Option 2: Tạo Bot */}
                            <TouchableOpacity
                                onPress={() => handleFeatureSelect(onSelectPersona)}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    paddingVertical: 14,
                                    borderBottomWidth: 1,
                                    borderBottomColor: colors.border,
                                }}
                            >
                                <View style={{ width: 40, alignItems: "center" }}>
                                    <Ionicons name="color-wand" size={24} color="#8b5cf6" />
                                </View>
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>
                                        Gọi Bot chuyên gia
                                    </Text>
                                    <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                                        Tạo Bot theo chủ đề riêng (Thể thao, Ẩm thực...)
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            {/* Option 3: Dịch thuật */}
                            <TouchableOpacity
                                onPress={() => handleComingSoon("Dịch thuật tự động")}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    paddingVertical: 14,
                                    borderBottomWidth: 1,
                                    borderBottomColor: colors.border,
                                }}
                            >
                                <View style={{ width: 40, alignItems: "center" }}>
                                    <Ionicons name="language" size={24} color="#10b981" />
                                </View>
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>
                                        Dịch thuật tự động
                                    </Text>
                                    <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                                        Dịch tin nhắn gần nhất sang ngôn ngữ của bạn
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            {/* Option 4: Viết lại tin nhắn */}
                            <TouchableOpacity
                                onPress={() => handleComingSoon("Cải thiện tin nhắn")}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    paddingVertical: 14,
                                    borderBottomWidth: 1,
                                    borderBottomColor: colors.border,
                                }}
                            >
                                <View style={{ width: 40, alignItems: "center" }}>
                                    <Ionicons name="create" size={24} color="#f59e0b" />
                                </View>
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>
                                        Cải thiện văn phong
                                    </Text>
                                    <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                                        Sửa lỗi chính tả, làm cho tin nhắn chuyên nghiệp hơn
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            {/* Option 5: Trích xuất lịch */}
                            <TouchableOpacity
                                onPress={() => handleComingSoon("Trích xuất thông tin")}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    paddingVertical: 14,
                                }}
                            >
                                <View style={{ width: 40, alignItems: "center" }}>
                                    <Ionicons name="calendar" size={24} color="#ef4444" />
                                </View>
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>
                                        Trích xuất lịch hẹn
                                    </Text>
                                    <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                                        Tìm ngày tháng, sự kiện có trong cuộc trò chuyện
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </Pressable>
            </TouchableOpacity>
        </Modal>
    );
}
