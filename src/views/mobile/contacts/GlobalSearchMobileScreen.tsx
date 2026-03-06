import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, TouchableOpacity } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useThemeColors } from "@/shared/theme/colors";

// Import bình thường, nhưng dùng kiểu any để tránh lỗi typings khác biệt giữa phiên bản expo-router
// đồng thời cho phép truyền prop autoFocus tuỳ chọn.
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const SearchUsersMobile = require("./SearchUsersMobile")
    .default as (props: { initialQuery?: string; autoFocus?: boolean }) => React.ReactElement;

/**
 * Màn tìm kiếm người dùng chung cho mobile (dùng lại UI Thêm bạn hiện tại).
 * - Cho phép tìm theo tên / số điện thoại / email.
 * - Được mở từ thanh tìm kiếm ở Danh bạ, Cá nhân...
 */
export default function GlobalSearchMobileScreen() {
    const router = useRouter();
    const colors = useThemeColors();
    // Dùng require để tránh lỗi type khi dự án chưa khai báo hook useLocalSearchParams trong typings
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const { useLocalSearchParams } = require("expo-router") as {
        useLocalSearchParams?: () => Record<string, unknown>;
    };
    const rawParams = useLocalSearchParams ? useLocalSearchParams() : {};
    const params = rawParams as { q?: string; from?: string; t?: number };
    const initialQuery = typeof params.q === "string" ? params.q : "";
    const from = params.from || "contacts";

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            if (from === "account") {
                router.replace("/(tabs)/account");
            } else if (from === "chat") {
                router.replace("/(tabs)/");
            } else {
                router.replace("/(tabs)/contacts");
            }
        }
    };

    return (
        <SafeAreaView
            style={{ flex: 1, backgroundColor: colors.background }}
            edges={["top"]}
        >
            <StatusBar style={colors.statusBar} />
            {/* Header: nút quay lại + tiêu đề giống header chuẩn cao 52px */}
            <View
                style={{
                    height: 52,
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 16,
                    backgroundColor: colors.headerBg,
                    borderBottomWidth: 0.5,
                    borderBottomColor: colors.border,
                }}
            >
                <TouchableOpacity
                    onPress={handleBack}
                    style={{ paddingRight: 8, paddingVertical: 4 }}
                    activeOpacity={0.8}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons
                        name="chevron-back"
                        size={26}
                        color={colors.headerText}
                    />
                </TouchableOpacity>
                <Text
                    style={{
                        color: colors.headerText,
                        fontSize: 18,
                        fontWeight: "600",
                    }}
                >
                    Tìm kiếm
                </Text>
            </View>

            {/* Nội dung: key theo from+t để mỗi lần mở từ giao diện chính ô tìm kiếm luôn rỗng. */}
            <SearchUsersMobile
                key={`search-${from}-${params.t ?? ""}`}
                initialQuery={initialQuery}
                autoFocus
            />
        </SafeAreaView>
    );
}

