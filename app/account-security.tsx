import { Platform } from "react-native";
import { Redirect } from "expo-router";
import AccountSecurityScreen from "@/views/mobile/profile/AccountSecurityScreen";

export default function AccountSecurityRoute() {
    if (Platform.OS === "web") {
        return <Redirect href="/(tabs)/account" />;
    }
    return <AccountSecurityScreen />;
}

