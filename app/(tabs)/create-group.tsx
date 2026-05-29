import { Platform } from "react-native";
import CreateGroupScreen from "@/views/mobile/chat/screens/CreateGroupScreen";

export default function CreateGroupRoute() {
    if (Platform.OS === "web") return null;
    return <CreateGroupScreen />;
}
