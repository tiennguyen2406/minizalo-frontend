import { Platform } from "react-native";
import { useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import ProfileSettingsScreen from "@/views/mobile/profile/ProfileSettingsScreen";
import AccountInfoView from "@/views/web/profile/AccountInfoView";
import { useUserStore } from "@/shared/store/userStore";
import { isAuthenticated } from "@/shared/store/authStore";

export default function ProfileSettingsRoute() {
    const { profile, fetchProfile } = useUserStore();

    useFocusEffect(
        useCallback(() => {
            if (Platform.OS === "web") return;
            if (isAuthenticated()) fetchProfile();
        }, [fetchProfile])
    );

    if (Platform.OS === "web") {
        return <AccountInfoView />;
    }
    return <ProfileSettingsScreen user={profile} />;
}
