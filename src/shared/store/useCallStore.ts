import { create } from 'zustand';
import { callService, CallType } from '../services/callService';
import { IncomingCallPayload } from '../services/callService';
import { api } from '../services/apiClient';
import { soundManager } from '../services/SoundManager';

export type CallStatus = 'idle' | 'incoming' | 'calling' | 'connected' | 'ended';
export type CallEndReason = 'NO_ANSWER' | 'REJECTED' | 'CANCELLED' | 'ENDED' | 'ERROR' | null;

interface CallState {
    incomingCall: IncomingCallPayload | null;
    activeCall: {
        token: string;
        channelName: string;
        appId: string;
        callType: CallType;
        callSessionId: string;
        partnerName?: string;
        partnerAvatar?: string;
    } | null;
    callStatus: CallStatus;
    callEndReason: CallEndReason;
    
    // Actions
    setIncomingCall: (payload: IncomingCallPayload | null) => void;
    setCallStatus: (status: CallStatus) => void;
    setCallEndReason: (reason: CallEndReason) => void;
    dismissCallEndReason: () => void;
    initiateCall: (conversationId: string, receiverId: string, callType: CallType, partnerName?: string, partnerAvatar?: string) => Promise<void>;
    acceptCall: (callSessionId: string) => Promise<void>;
    rejectCall: (callSessionId: string) => Promise<void>;
    cancelCall: (callSessionId: string) => Promise<void>;
    endCall: (callSessionId: string) => Promise<void>;
    resetCall: () => void;
    clearCallTimer: () => void;
}

// Biến global để lưu Timer ngoài Store (do setTimeout của Zustant có thể gặp vấn đề Closure)
let globalCallTimeout: any = null;

export const useCallStore = create<CallState>((set, get) => ({
    incomingCall: null,
    activeCall: null,
    callStatus: 'idle',
    callEndReason: null,

    setIncomingCall: (payload) => {
        if (!payload) {
            set({ incomingCall: null, callStatus: 'idle' });
            return;
        }

        const current = get().incomingCall;
        if (current?.callSessionId === payload.callSessionId) {

            return;
        }


        set({ incomingCall: payload, callStatus: 'incoming' });
    },

    setCallStatus: (status) => {
        set({ callStatus: status });
    },

    setCallEndReason: (reason) => {
        set({ callEndReason: reason });
    },

    dismissCallEndReason: () => {
        set({ callEndReason: null });
    },

    initiateCall: async (conversationId, receiverId, callType, partnerName, partnerAvatar) => {
        try {
            set({ callStatus: 'calling' });
            const response = await api.post('/call/initiate', {
                conversationId,
                receiverId,
                callType
            });
            
            const data = response.data;
            const callSessionId = data.callSessionId;

            set({
                activeCall: {
                    token: data.token,
                    channelName: data.channelName,
                    appId: data.appId,
                    callType: data.callType,
                    callSessionId: callSessionId,
                    partnerName: partnerName || 'Người dùng',
                    partnerAvatar: partnerAvatar
                },
                callStatus: 'calling'
            });

            soundManager.playRingback();

            // Dọn dẹp Timer cũ nếu có
            if (globalCallTimeout) {
                clearTimeout(globalCallTimeout);
                globalCallTimeout = null;
            }

            globalCallTimeout = setTimeout(() => {
                const currentStatus = get().callStatus;
                if (currentStatus === 'calling') {

                    soundManager.stopAll();
                    get().cancelCall(callSessionId);
                    set({ callEndReason: 'NO_ANSWER' });
                }
                globalCallTimeout = null;
            }, 30000);
        } catch (error) {
            set({ callStatus: 'idle', activeCall: null });
            throw error;
        }
    },

    acceptCall: async (callSessionId) => {
        if (globalCallTimeout) {
            clearTimeout(globalCallTimeout);
            globalCallTimeout = null;
        }
        soundManager.stopAll();
        try {
            const response = await api.post('/call/accept', { callSessionId });
            const data = response.data;
            
            const incoming = get().incomingCall;
            set({
                incomingCall: null,
                callStatus: 'connected',
                activeCall: {
                    token: data.token,
                    channelName: data.channelName,
                    appId: data.appId,
                    callType: data.callType,
                    callSessionId: callSessionId,
                    partnerName: incoming?.caller?.name || 'Người dùng',
                    partnerAvatar: incoming?.caller?.avatar || undefined
                }
            });
        } catch (error: any) {
            console.error('=== [CallStore] acceptCall failed:', error?.response?.status);
            set({ callStatus: 'idle', incomingCall: null });
            if (error?.response?.status === 400) {
                set({ callEndReason: 'CANCELLED' });
            }
        }
    },

    rejectCall: async (callSessionId) => {
        soundManager.stopAll();
        try {
            await api.post('/call/reject', { callSessionId });
            set({ incomingCall: null, callStatus: 'idle' });
        } catch (error) {
            set({ incomingCall: null, callStatus: 'idle' });
        }
    },

    cancelCall: async (callSessionId) => {
        soundManager.stopAll();
        try {
            await api.post('/call/cancel', { callSessionId });
            set({ activeCall: null, callStatus: 'idle' });
        } catch (error) {
            set({ activeCall: null, callStatus: 'idle' });
        }
    },

    endCall: async (callSessionId) => {
        soundManager.stopAll();
        try {
            await api.post('/call/end', { callSessionId });
            set({ activeCall: null, callStatus: 'idle' });
        } catch (error) {
            set({ activeCall: null, callStatus: 'idle' });
        }
    },

    resetCall: () => {

        soundManager.stopAll();
        
        // Dọn dẹp Timer
        if (globalCallTimeout) {
            clearTimeout(globalCallTimeout);
            globalCallTimeout = null;
        }

        set({ 
            incomingCall: null, 
            activeCall: null, 
            callStatus: 'idle',
            callEndReason: null
        });
    },

    clearCallTimer: () => {
        if (globalCallTimeout) {

            clearTimeout(globalCallTimeout);
            globalCallTimeout = null;
        }
    }
}));
