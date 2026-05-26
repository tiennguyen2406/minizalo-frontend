import { View, Text, Platform } from "react-native";
import { useThemeColors } from "@/shared/theme/colors";

export default function SupportScreen() {
    const isWeb = Platform.OS === "web";
    const colors = useThemeColors();
    return (
        <View style={isWeb ? { flex: 1, padding: 24, backgroundColor: colors.background } : { flex: 1, backgroundColor: colors.background }}>
            <Text style={isWeb ? { fontSize: 24, fontWeight: "bold", color: colors.primary } : { color: colors.primary }}>
                Hỗ trợ
            </Text>
            <Text style={isWeb ? { marginTop: 8, color: colors.textSecondary } : { color: colors.textSecondary }}>
                Trang hỗ trợ - đang phát triển.
            </Text>
        </View>
    );
}
