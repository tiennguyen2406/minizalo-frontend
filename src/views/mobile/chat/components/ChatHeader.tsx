import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { SafeView as SafeAreaView } from "@/shared/components/SafeView";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useThemeColors } from "@/shared/theme/colors";
import { CallType } from "@/shared/services/callService";
import { Alert } from "react-native";
import { useCallStore } from "@/shared/store/useCallStore";

interface ChatHeaderProps {
    name: string;
    roomType?: string;
    isStranger?: boolean;
    onBack?: () => void;
    onMenuPress?: () => void;
}

export default function ChatHeader({ name, roomType, isStranger, onBack, onMenuPress }: ChatHeaderProps) {
    const router = useRouter();
    const params = useLocalSearchParams();
    const colors = useThemeColors();

    const { initiateCall } = useCallStore();

    const roomId = React.useMemo(() => {
        if (params.id) return Array.isArray(params.id) ? params.id[0] : params.id;
        return "";
    }, [params.id]);

    const handleStartCall = async (type: CallType) => {
        if (!roomId || roomId === "new") {
            Alert.alert("Lỗi", "Không thể bắt đầu cuộc gọi trong hội thoại chưa khởi tạo.");
            return;
        }

        // Lấy receiverId từ params (truyền qua route khi vào chat chi tiết)
        const receiverId = params.receiverId as string;
        if (!receiverId) {
            Alert.alert("Lỗi", "Không tìm thấy thông tin người nhận để thực hiện cuộc gọi.");
            return;
        }

        try {

            await initiateCall(roomId, receiverId, type);
        } catch (error: any) {
            Alert.alert("Cuộc gọi thất bại", error.response?.data?.message || "Đã có lỗi xảy ra");
        }
    };

    const handleBack = () => {
        if (onBack) {
            onBack();
        } else {
            router.back();
        }
    };

    return (
        <View style={{ backgroundColor: colors.headerBg }}>
            <SafeAreaView edges={["top"]}>
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingHorizontal: 16,
                        height: 52,
                        borderBottomWidth: colors.headerBg === "#0068FF" ? 0 : 0.5,
                        borderBottomColor: colors.border,
                    }}
                >
                    {/* Left: Back & Name */}
                    <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                        <TouchableOpacity
                            onPress={handleBack}
                            style={{ paddingRight: 8, paddingVertical: 4 }}
                            activeOpacity={0.7}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons name="chevron-back" size={26} color={colors.headerText} />
                        </TouchableOpacity>

                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: "row", alignItems: "center" }}>
                                <Text
                                    style={{ color: colors.headerText, fontSize: 17, fontWeight: "600" }}
                                    numberOfLines={1}
                                >
                                    {name}
                                </Text>
                            </View>
                            <Text style={{ color: colors.headerText, fontSize: 11, opacity: 0.7 }}>
                                {roomType === "GROUP" ? `Nhóm` : "Vừa mới truy cập"}
                            </Text>
                        </View>
                    </View>

                    {/* Right: Actions */}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>
                        <TouchableOpacity onPress={() => handleStartCall("VOICE")}>
                            <Ionicons name="call-outline" size={22} color={colors.headerText} />
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => handleStartCall("VIDEO")}>
                            <Ionicons name="videocam-outline" size={24} color={colors.headerText} />
                        </TouchableOpacity>

                        <TouchableOpacity onPress={onMenuPress}>
                            <Ionicons name="menu-outline" size={24} color={colors.headerText} />
                        </TouchableOpacity>
                    </View>
                </View>

            </SafeAreaView>
        </View>
    );
}
