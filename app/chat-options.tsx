import React from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import ChatOptionsScreen from '@/views/mobile/chat/screens/ChatOptionsScreen';

export default function ChatOptionsRoute() {
    const params = useLocalSearchParams();
    return (
        <ChatOptionsScreen
            roomId={params.roomId as string}
            name={params.name as string}
            avatarUrl={params.avatarUrl as string}
            partnerId={params.partnerId as string}
            type={params.type === "GROUP" ? "GROUP" : "DIRECT"}
            onClose={() => router.back()}
        />
    );
}
