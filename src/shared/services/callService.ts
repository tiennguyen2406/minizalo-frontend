import { api } from "./apiClient";
import { AxiosError } from "axios";

export type CallType = 'VOICE' | 'VIDEO';
export type CallState = 'idle' | 'calling' | 'connected' | 'ended';

export interface IncomingCallPayload {
    callSessionId: string;
    channelName: string;
    callType: CallType;
    caller: {
        id: string;
        name: string;
        avatar: string | null;
    };
}

export interface CallHistory {
    id: string;
    callerId: string;
    receiverId: string;
    callType: CallType;
    status: string;
    durationSeconds: number;
    createdAt: string;
}

export interface CallTokenRequest {
    conversationId: string;
    callType: CallType;
}

export interface CallTokenResponse {
    token: string;
    appId: string;
    channelName: string;
    uid: string;
    expireAt: number;
    callType: CallType;
}

export interface CallError {
    message: string;
    code: number;
}

class CallService {
    /**
     * Request a call token from the backend.
     * Endpoint: POST /api/call/token (managed by apiClient with base /api)
     */
    async getCallToken(conversationId: string, callType: CallType): Promise<CallTokenResponse> {
        try {
            const response = await api.post<CallTokenResponse>("/call/token", {
                conversationId,
                callType
            });
            return response.data;
        } catch (error) {
            const axiosError = error as AxiosError;
            const status = axiosError.response?.status;

            if (status === 401) {
                throw new Error("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
            } else if (status === 404) {
                throw new Error("Cuộc hội thoại không tồn tại hoặc bạn không còn tham gia.");
            } else if (status === 500) {
                throw new Error("Lỗi hệ thống cuộc gọi (Agora). Vui lòng thử lại sau.");
            }

            throw new Error(
                (axiosError.response?.data as any)?.message || 
                "Không thể kết nối cuộc gọi. Vui lòng kiểm tra mạng."
            );
        }
    }

    /**
     * Check if there is a pending call for the current user.
     * Useful for restoring call state after a reconnect.
     */
    async checkPendingCall(): Promise<IncomingCallPayload | null> {
        try {
            const response = await api.get<IncomingCallPayload>("/call/pending");
            if (response.status === 204) return null;
            return response.data;
        } catch (error) {
            // No logs here to avoid console noise
            return null;
        }
    }
}

export const callService = new CallService();
