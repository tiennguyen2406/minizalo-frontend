import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import WebChatLayout from '../components/WebChatLayout';
import ChatWindow from '../components/ChatWindow';
import { useEffect } from 'react';
import { useAuthStore } from '@/shared/store/authStore';
import { useCallStore } from '@/shared/store/useCallStore';
import { webSocketService } from '@/shared/services/WebSocketService';
import IncomingCallNotification from '../components/IncomingCallNotification';

const ChatScreenWeb = () => {
    const { id } = useLocalSearchParams();
    const roomId = Array.isArray(id) ? id[0] : id; 
    const user = useAuthStore(state => state.user);
    const { setIncomingCall, resetCall, activeCall, incomingCall } = useCallStore();

    return (
        <WebChatLayout selectedRoomId={roomId}>
             <ChatWindow roomId={roomId} />
        </WebChatLayout>
    );
};

export default ChatScreenWeb;
