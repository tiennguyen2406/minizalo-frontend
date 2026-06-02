import React from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import GroupInfoScreen from '@/views/mobile/chat/components/GroupInfoScreen';

export default function GroupInfoRoute() {
    const params = useLocalSearchParams();
    const roomId = Array.isArray(params.roomId) ? params.roomId[0] : params.roomId;
    return (
        <GroupInfoScreen
            roomId={roomId || ""}
            onClose={() => router.back()}
        />
    );
}
