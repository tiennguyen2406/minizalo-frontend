import React from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import SearchMessagesScreen from '@/views/mobile/chat/screens/SearchMessagesScreen';

export default function SearchMessagesRoute() {
    const params = useLocalSearchParams();
    return (
        <SearchMessagesScreen
            roomId={params.roomId as string}
            name={params.name as string}
            avatarUrl={params.avatarUrl as string}
            roomType={(params.type as string) || "DIRECT"}
            onClose={() => router.back()}
        />
    );
}
