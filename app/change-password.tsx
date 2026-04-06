import { Platform } from "react-native";
import { Redirect } from "expo-router";
import ChangePasswordScreen from "@/views/mobile/profile/ChangePasswordScreen";

export default function ChangePasswordRoute() {
    if (Platform.OS === "web") {
        return <Redirect href="/(tabs)/account" />;
    }
    return <ChangePasswordScreen />;
}
