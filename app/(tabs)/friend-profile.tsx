import { Platform } from "react-native";
import { useLocalSearchParams } from "expo-router";
import FriendProfileScreen from "@/views/mobile/contacts/FriendProfileScreen";
import AccountInfoView from "@/views/web/profile/AccountInfoView";

export default function FriendProfileRoute() {
    const params = useLocalSearchParams<{
        userId: string;
        displayName: string;
        avatarUrl?: string;
        businessDescription?: string;
        statusMessage?: string;
        phone?: string;
    }>();

    if (Platform.OS === "web") {
        return <AccountInfoView />;
    }
    return (
        <FriendProfileScreen
            userId={params.userId || ""}
            displayName={params.displayName || "Người dùng"}
            avatarUrl={params.avatarUrl || null}
            businessDescription={params.businessDescription || ""}
            statusMessage={params.statusMessage || ""}
            phone={params.phone || ""}
        />
    );
}
