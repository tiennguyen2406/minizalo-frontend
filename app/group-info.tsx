import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import GroupInfoScreen from '@/views/mobile/chat/components/GroupInfoScreen';

class GroupInfoRouteBoundary extends React.Component<
    { children: React.ReactNode; onClose: () => void },
    { error: Error | null }
> {
    state = { error: null };

    static getDerivedStateFromError(error: Error) {
        return { error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('GROUP_INFO_ROUTE_ERROR', error, info.componentStack);
    }

    render() {
        if (!this.state.error) return this.props.children;
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#fff' }}>
                <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 8 }}>Không mở được thông tin nhóm</Text>
                <Text style={{ color: '#64748b', textAlign: 'center', marginBottom: 16 }}>
                    Vui lòng quay lại phòng chat và thử mở lại.
                </Text>
                <TouchableOpacity onPress={this.props.onClose} style={{ paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, backgroundColor: '#0068FF' }}>
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Quay lại</Text>
                </TouchableOpacity>
            </View>
        );
    }
}

export default function GroupInfoRoute() {
    const params = useLocalSearchParams();
    const roomId = Array.isArray(params.roomId) ? params.roomId[0] : params.roomId;
    const handleClose = () => router.back();
    return (
        <GroupInfoRouteBoundary onClose={handleClose}>
            <GroupInfoScreen
                roomId={roomId || ""}
                onClose={handleClose}
            />
        </GroupInfoRouteBoundary>
    );
}
