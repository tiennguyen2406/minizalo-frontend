import { Platform, View, Text } from "react-native";
import AppearanceScreen from "@/views/mobile/profile/AppearanceScreen";

export default function AppearanceRoute() {
    if (Platform.OS === "web") {
        return (
            <View style={{ flex: 1, padding: 24, backgroundColor: "#f2f4f7" }}>
                <Text style={{ fontSize: 24, fontWeight: "bold", color: "#0068FF" }}>
                    Giao diện
                </Text>
                <Text style={{ marginTop: 8, color: "#666" }}>
                    Trang giao diện - đang phát triển.
                </Text>
            </View>
        );
    }
    return <AppearanceScreen />;
}
