import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useThemeColors } from "@/shared/theme/colors";

interface ChatHeaderProps {
    name: string;
    roomType?: string;
    isStranger?: boolean;
    /** Chỉ nhãn NGƯỜI LẠ dưới tên — nút Kết bạn đặt trên thanh trắng ngay dưới header (ChatScreen). */
    strangerSubtitleRow?: {
        visible: boolean;
    };
    onBack?: () => void;
    onMenuPress?: () => void;
}

export default function ChatHeader({
    name,
    roomType,
    isStranger,
    strangerSubtitleRow,
    onBack,
    onMenuPress,
}: ChatHeaderProps) {
    const router = useRouter();
    const colors = useThemeColors();

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
                        alignItems: strangerSubtitleRow?.visible ? "flex-start" : "center",
                        justifyContent: "space-between",
                        paddingHorizontal: 16,
                        paddingTop: strangerSubtitleRow?.visible ? 10 : 14,
                        paddingBottom: strangerSubtitleRow?.visible ? 10 : 14,
                        minHeight: 52,
                        borderBottomWidth: colors.headerBg === "#0068FF" ? 0 : 0.5,
                        borderBottomColor: colors.border,
                    }}
                >
                    {/* Left: Back & Name */}
                    <View style={{ flexDirection: "row", alignItems: strangerSubtitleRow?.visible ? "flex-start" : "center", flex: 1 }}>
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
                            {strangerSubtitleRow?.visible ? (
                                <View style={{ marginTop: 6 }}>
                                    <View
                                        style={{
                                            alignSelf: "flex-start",
                                            paddingHorizontal: 10,
                                            paddingVertical: 4,
                                            borderRadius: 999,
                                            backgroundColor: "rgba(0,0,0,0.38)",
                                        }}
                                    >
                                        <Text
                                            style={{
                                                color: "#ffffff",
                                                fontSize: 10,
                                                fontWeight: "900",
                                                letterSpacing: 0.6,
                                            }}
                                        >
                                            NGƯỜI LẠ
                                        </Text>
                                    </View>
                                </View>
                            ) : (
                                <Text style={{ color: colors.headerText, fontSize: 11, opacity: 0.7 }}>
                                    {roomType === "GROUP" ? `Nhóm` : "Vừa mới truy cập"}
                                </Text>
                            )}
                        </View>
                    </View>

                    {/* Right: Actions */}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 18, paddingTop: strangerSubtitleRow?.visible ? 2 : 0 }}>
                        <TouchableOpacity>
                            <Ionicons name="call-outline" size={22} color={colors.headerText} />
                        </TouchableOpacity>

                        <TouchableOpacity>
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
