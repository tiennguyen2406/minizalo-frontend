import { View, Text, Platform, TextInput, TouchableOpacity } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeView as SafeAreaView } from "@/shared/components/SafeView";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/shared/theme/colors";

export default function WorkScreen() {
    const isWeb = Platform.OS === "web";
    const colors = useThemeColors();

    if (isWeb) {
        return (
            <View style={{ flex: 1, padding: 24, backgroundColor: "#f2f4f7" }}>
                <Text style={{ fontSize: 24, fontWeight: "bold", color: "#0068FF" }}>
                    Công việc
                </Text>
                <Text style={{ marginTop: 8, color: "#666" }}>
                    Trang công việc / kinh doanh - đang phát triển.
                </Text>
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <StatusBar style={colors.statusBar} />
            <SafeAreaView style={{ backgroundColor: colors.headerBg }} edges={["top"]}>
                <View
                    style={{
                        height: 52,
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 16,
                        backgroundColor: colors.headerBg,
                        borderBottomWidth: colors.headerBg === "#0068FF" ? 0 : 0.5,
                        borderBottomColor: colors.border,
                        gap: 12,
                    }}
                >
                    <View
                        style={{
                            flex: 1,
                            flexDirection: "row",
                            alignItems: "center",
                            borderRadius: 10,
                            backgroundColor: colors.headerSearchBg,
                            paddingHorizontal: 10,
                            height: 36,
                        }}
                    >
                        <Ionicons name="search" size={18} color={colors.headerIcon} />
                        <TextInput
                            style={{
                                flex: 1,
                                fontSize: 15,
                                color: colors.headerText,
                                marginLeft: 8,
                                paddingVertical: 0,
                            }}
                            placeholder="Tìm kiếm"
                            placeholderTextColor={colors.headerIcon}
                            showSoftInputOnFocus={false}
                        />
                    </View>
                    <TouchableOpacity style={{ padding: 4 }} activeOpacity={0.8}>
                        <Ionicons name="briefcase-outline" size={24} color={colors.headerIcon} />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 20 }}>
                <Ionicons name="home-outline" size={64} color={colors.textSecondary} style={{ marginBottom: 16 }} />
                <Text style={{ fontSize: 18, fontWeight: "600", color: colors.text }}>Tường nhà</Text>
                <Text style={{ textAlign: "center", color: colors.textSecondary, marginTop: 8 }}>
                    Tính năng đang được phát triển.
                </Text>
            </View>
        </View>
    );
}
