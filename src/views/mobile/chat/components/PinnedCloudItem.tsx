import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/shared/theme/colors";

export const PinnedCloudItem = () => {
    const colors = useThemeColors();
    return (
        <TouchableOpacity
            activeOpacity={0.7}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.background,
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderBottomWidth: 0.5,
                borderBottomColor: colors.border,
            }}
        >
            <View style={{ position: 'relative', marginRight: 12 }}>
                <View style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    backgroundColor: '#162447',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                }}>
                    <Ionicons name="cloud-outline" size={28} color="#4da6ff" />
                </View>
            </View>

            <View style={{ flex: 1, justifyContent: 'center', height: 52 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 16, color: colors.text }}>Cloud của tôi</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    <Text style={{ fontSize: 14, color: '#3498db' }} numberOfLines={1}>Cuộc trò chuyện này đang được ghim</Text>
                </View>
            </View>
        </TouchableOpacity>
    );
};
