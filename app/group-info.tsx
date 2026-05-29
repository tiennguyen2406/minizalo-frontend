import React from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import GroupInfoScreen from '@/views/mobile/chat/components/GroupInfoScreen';

export default function GroupInfoRoute() {
    const params = useLocalSearchParams();
    return (
        <GroupInfoScreen
            roomId={params.roomId as string}
            onClose={() => router.back()}
        />
    );
}
