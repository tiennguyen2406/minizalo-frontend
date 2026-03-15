import React from "react";
import { View, Keyboard } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { useThemeColors } from "@/shared/theme/colors";
import SearchUsersMobile from "./SearchUsersMobile";

/**
 * Màn tìm kiếm người dùng chung cho mobile (dùng lại UI Thêm bạn hiện tại).
 * - Cho phép tìm theo tên / số điện thoại / email.
 * - Được mở từ thanh tìm kiếm ở Danh bạ, Cá nhân...
 */
export default function GlobalSearchMobileScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const colors = useThemeColors();
    const params = useLocalSearchParams() as { q?: string; from?: string; t?: number };
    
    const initialQuery = typeof params.q === "string" ? params.q : "";
    const from = params.from || "contacts";

    const handleBack = () => {
        Keyboard.dismiss();
        
        // Bây giờ đã là Native Stack Screen, router.back() hoạt động cực kỳ ổn định
        if (router.canGoBack()) {
            router.back();
        } else {
            // Fallback an toàn về tab trước đó
            const target = (from === "account" || from === "profile") 
                ? "/(tabs)/account" 
                : (from === "chat" || from === "index")
                    ? "/(tabs)/"
                    : "/(tabs)/contacts";
            router.replace(target as any);
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <StatusBar style={colors.statusBar} />

            {/* Nội dung: key theo from+t để mỗi lần mở từ giao diện chính ô tìm kiếm luôn rỗng. */}
            <SearchUsersMobile
                key={`search-${from}-${params.t ?? ""}`}
                initialQuery={initialQuery}
                autoFocus
                onBack={handleBack}
            />
        </View>
    );
}

