import React from "react";
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
} from "react-native";
import { useThemeColors } from "@/shared/theme/colors";

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "😡"];

interface ReactionPickerBottomSheetProps {
    visible: boolean;
    onSelect: (emoji: string) => void;
    onClose: () => void;
}

export default function ReactionPickerBottomSheet({
    visible,
    onSelect,
    onClose,
}: ReactionPickerBottomSheetProps) {
    const colors = useThemeColors();
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
                    justifyContent: "flex-end",
                }}
                onPress={onClose}
            >
                <View
                    style={{
                        backgroundColor: colors.card,
                        paddingHorizontal: 24,
                        paddingTop: 16,
                        paddingBottom: 28,
                        borderTopLeftRadius: 20,
                        borderTopRightRadius: 20,
                    }}
                >
                    <Text
                        style={{
                            color: colors.text,
                            fontSize: 16,
                            fontWeight: "600",
                            marginBottom: 12,
                        }}
                    >
                        Chọn reaction
                    </Text>
                    <View
                        style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                        }}
                    >
                        {REACTIONS.map((emoji) => (
                            <TouchableOpacity
                                key={emoji}
                                onPress={() => {
                                    onSelect(emoji);
                                    onClose();
                                }}
                                style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: 22,
                                    backgroundColor: colors.searchBg,
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <Text style={{ fontSize: 24 }}>{emoji}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </TouchableOpacity>
        </Modal>
    );
}

