import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

interface ChatHeaderProps {
    name: string;
    roomType?: string;
    onBack?: () => void;
    onMenuPress?: () => void;
}

export default function ChatHeader({ name, roomType, onBack, onMenuPress }: ChatHeaderProps) {
    const router = useRouter();

    const handleBack = () => {
        if (onBack) {
            onBack();
        } else {
            router.back();
        }
    };

    return (
        <View style={{ backgroundColor: "#1a1a1a" }}>
            <SafeAreaView edges={["top"]}>
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingHorizontal: 12,
                        height: 50,
                    }}
                >
                    {/* Left: Back & Name */}
                    <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                        <TouchableOpacity onPress={handleBack} style={{ marginRight: 8 }}>
                            <Ionicons name="chevron-back" size={28} color="white" />
                        </TouchableOpacity>

                        <View style={{ flex: 1 }}>
                            <Text
                                style={{ color: "white", fontSize: 18, fontWeight: "bold" }}
                                numberOfLines={1}
                            >
                                {name}
                            </Text>
                            <Text style={{ color: "#93c5fd", fontSize: 12 }}>
                                {roomType === "GROUP" ? `Nhóm` : "Vừa mới truy cập"}
                            </Text>
                        </View>
                    </View>

                    {/* Right: Actions */}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 20 }}>
                        <TouchableOpacity>
                            <Ionicons name="call-outline" size={24} color="white" />
                        </TouchableOpacity>

                        <TouchableOpacity>
                            <Ionicons name="videocam-outline" size={26} color="white" />
                        </TouchableOpacity>

                        <TouchableOpacity onPress={onMenuPress}>
                            <Ionicons name="menu-outline" size={26} color="white" />
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeAreaView>
        </View>
    );
}
