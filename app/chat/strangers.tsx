import React from "react";
import StrangerChatsScreen from "@/views/mobile/chat/screens/StrangerChatsScreen";
import { Stack } from "expo-router";

export default function StrangersRoute() {
    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <StrangerChatsScreen />
        </>
    );
}
