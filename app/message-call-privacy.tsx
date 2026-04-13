import { Platform } from "react-native";
import { Redirect } from "expo-router";
import { MessageCallPrivacyScreen } from "@/views/mobile/profile";

export default function MessageCallPrivacyRoute() {
    if (Platform.OS === "web") {
        return <Redirect href="/(tabs)/account" />;
    }
    return <MessageCallPrivacyScreen />;
}
