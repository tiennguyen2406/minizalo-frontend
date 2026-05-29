import { Platform } from "react-native";
import { useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import PersonalProfileScreen from "@/views/mobile/profile/PersonalProfileScreen";
import AccountInfoView from "@/views/web/profile/AccountInfoView";
import { useUserStore } from "@/shared/store/userStore";
import { isAuthenticated } from "@/shared/store/authStore";

export default function PersonalProfileRoute() {
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
    return <PersonalProfileScreen user={profile} />;
}
