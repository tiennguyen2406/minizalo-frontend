import { Platform } from "react-native";
import { Redirect } from "expo-router";
import PrivacyScreen from "@/views/mobile/profile/PrivacyScreen";

export default function PrivacyRoute() {
    if (Platform.OS === "web") {
        return <Redirect href="/(tabs)/account" />;
    }
    return <PrivacyScreen />;
}
