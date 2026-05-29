import { create } from 'zustand';
import { callService, CallType, GroupCallEventPayload, GroupCallParticipantDto, GroupCallSessionResponse } from '../services/callService';
import { IncomingCallPayload } from '../services/callService';
import { api } from '../services/apiClient';
import { soundManager } from '../services/SoundManager';

export type CallStatus = 'idle' | 'incoming' | 'calling' | 'connected' | 'ended';
export type CallEndReason = 'NO_ANSWER' | 'REJECTED' | 'CANCELLED' | 'ENDED' | 'ERROR' | null;
export type IncomingCallKind = 'direct' | 'group';

interface CallState {
    incomingCall: IncomingCallPayload | null;
    incomingCallKind: IncomingCallKind;
    activeCall: {
        token: string;
        channelName: string;
        appId: string;
        callType: CallType;
        callSessionId: string;
        /** Accept video call without publishing camera initially. */
        startWithCamera?: boolean;
        partnerName?: string;
        partnerAvatar?: string;
        /** Group call meta */
        isGroupCall?: boolean;
        hostId?: string;
        conversationId?: string;
    } | null;
    callStatus: CallStatus;
    callEndReason: CallEndReason;

    /** Group call participants snapshot (including self). */
    participants: GroupCallParticipantDto[];
    
    // Actions
    setIncomingCall: (payload: IncomingCallPayload | null) => void;
    setIncomingCallKind: (kind: IncomingCallKind) => void;
    setCallStatus: (status: CallStatus) => void;
    setCallEndReason: (reason: CallEndReason) => void;
    dismissCallEndReason: () => void;
    initiateCall: (conversationId: string, receiverId: string, callType: CallType, partnerName?: string, partnerAvatar?: string) => Promise<void>;
    initiateGroupCall: (conversationId: string, receiverIds: string[], callType: CallType) => Promise<void>;
    acceptCall: (callSessionId: string) => Promise<void>;
    acceptCallNoCamera: (callSessionId: string) => Promise<void>;
    rejectCall: (callSessionId: string) => Promise<void>;
    cancelCall: (callSessionId: string) => Promise<void>;
    endCall: (callSessionId: string) => Promise<void>;
    joinGroupCall: (callSessionId: string) => Promise<void>;
    joinGroupCallNoCamera: (callSessionId: string) => Promise<void>;
    leaveGroupCall: (callSessionId: string) => Promise<void>;
    endGroupCall: (callSessionId: string) => Promise<void>;
    applyGroupCallEvent: (evt: GroupCallEventPayload) => void;
    resetCall: () => void;
    clearCallTimer: () => void;
}

// Biến global để lưu Timer ngoài Store (do setTimeout của Zustant có thể gặp vấn đề Closure)
let globalCallTimeout: any = null;

export const useCallStore = create<CallState>((set, get) => ({
    incomingCall: null,
    incomingCallKind: 'direct',
    activeCall: null,
    callStatus: 'idle',
    callEndReason: null,
    participants: [],

    setIncomingCall: (payload) => {
        if (!payload) {
            set({ incomingCall: null, callStatus: 'idle', incomingCallKind: 'direct' });
            return;
        }

        const current = get().incomingCall;
        if (current?.callSessionId === payload.callSessionId) {

            return;
        }


        set({ incomingCall: payload, callStatus: 'incoming' });
    },

    setIncomingCallKind: (kind) => set({ incomingCallKind: kind }),

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
                    partnerAvatar: partnerAvatar,
                    isGroupCall: false,
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

    initiateGroupCall: async (conversationId, receiverIds, callType) => {
        set({ callStatus: 'calling' });
        const data: GroupCallSessionResponse = await callService.initiateGroupCall(conversationId, receiverIds, callType);
        set({
            activeCall: {
                token: data.token,
                channelName: data.channelName,
                appId: data.appId,
                callType: data.callType,
                callSessionId: data.callSessionId,
                isGroupCall: true,
                hostId: data.hostId,
                conversationId: data.conversationId,
            },
            participants: data.participants || [],
            callStatus: 'calling',
        });
        soundManager.playRingback();
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
                    startWithCamera: true,
                    partnerName: incoming?.caller?.name || 'Người dùng',
                    partnerAvatar: incoming?.caller?.avatar || undefined,
                    isGroupCall: false,
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

    acceptCallNoCamera: async (callSessionId) => {
        // Accept call as usual, but mark startWithCamera=false so CallModal doesn't publish video track.
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
                    startWithCamera: false,
                    partnerName: incoming?.caller?.name || 'Người dùng',
                    partnerAvatar: incoming?.caller?.avatar || undefined,
                    isGroupCall: false,
                }
            });
        } catch (error: any) {
            console.error('=== [CallStore] acceptCallNoCamera failed:', error?.response?.status);
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

    joinGroupCall: async (callSessionId) => {
        soundManager.stopAll();
        const data = await callService.joinGroupCall(callSessionId);
        set({
            incomingCall: null,
            callStatus: 'connected',
            activeCall: {
                token: data.token,
                channelName: data.channelName,
                appId: data.appId,
                callType: data.callType,
                callSessionId: data.callSessionId,
                startWithCamera: true,
                isGroupCall: true,
                hostId: data.hostId,
                conversationId: data.conversationId,
            },
            participants: data.participants || [],
        });
    },

    joinGroupCallNoCamera: async (callSessionId) => {
        soundManager.stopAll();
        const data = await callService.joinGroupCall(callSessionId);
        set({
            incomingCall: null,
            callStatus: 'connected',
            activeCall: {
                token: data.token,
                channelName: data.channelName,
                appId: data.appId,
                callType: data.callType,
                callSessionId: data.callSessionId,
                startWithCamera: false,
                isGroupCall: true,
                hostId: data.hostId,
                conversationId: data.conversationId,
            },
            participants: data.participants || [],
        });
    },

    leaveGroupCall: async (callSessionId) => {
        soundManager.stopAll();
        try {
            await callService.leaveGroupCall(callSessionId);
        } finally {
            set({ activeCall: null, callStatus: 'idle', participants: [] });
        }
    },

    endGroupCall: async (callSessionId) => {
        soundManager.stopAll();
        try {
            await callService.endGroupCall(callSessionId);
        } finally {
            set({ activeCall: null, callStatus: 'idle', participants: [] });
        }
    },

    applyGroupCallEvent: (evt) => {
        if (!evt?.callSessionId) return;
        const st = get();
        if (st.activeCall?.callSessionId && String(st.activeCall.callSessionId) !== String(evt.callSessionId)) return;
        if (evt.participants) {
            set({ participants: evt.participants });
        }
        if (evt.eventType === 'PARTICIPANT_JOINED') {
            // Có người vào → dừng ringback, đánh dấu call active
            soundManager.stopAll();
            if (get().callStatus === 'calling') {
                set({ callStatus: 'connected' });
            }
        }
        if (evt.eventType === 'GROUP_CALL_ENDED') {
            soundManager.stopAll();
            // Nếu user đang ở màn hình INCOMING của chính session này (chưa accept) → phải dismiss luôn.
            // (Trước đây chỉ reset activeCall → incomingCall kẹt lại → UI chuông cuộc gọi đến không tắt.)
            const isIncomingSameSession =
                !!st.incomingCall?.callSessionId &&
                String(st.incomingCall.callSessionId) === String(evt.callSessionId);
            set({
                activeCall: null,
                callStatus: 'idle',
                participants: [],
                ...(isIncomingSameSession ? { incomingCall: null, incomingCallKind: 'direct' } : {}),
            });
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
            callEndReason: null,
            participants: [],
        });
    },

    clearCallTimer: () => {
        if (globalCallTimeout) {

            clearTimeout(globalCallTimeout);
            globalCallTimeout = null;
        }
    }
}));
