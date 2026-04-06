import { Platform, View, Text } from "react-native";
import SearchSourcesScreen from "@/views/mobile/profile/SearchSourcesScreen";

export default function SearchSourcesRoute() {
    if (Platform.OS === "web") {
        return (
            <View style={{ flex: 1, padding: 24, backgroundColor: "#f2f4f7" }}>
                <Text style={{ fontSize: 24, fontWeight: "bold", color: "#0068FF" }}>
                    Quản lý nguồn tìm kiếm
                </Text>
                <Text style={{ marginTop: 8, color: "#666" }}>
                    Trang quản lý nguồn tìm kiếm - đang phát triển.
                </Text>
            </View>
        );
    }
    return <SearchSourcesScreen />;
}
