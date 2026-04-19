import { Client, IMessage } from "@stomp/stompjs";
import { Platform, AppState } from "react-native";
import { useAuthStore } from "@/shared/store/authStore";
import {
    ChatMessageRequest,
    TypingIndicatorRequest,
    ReadReceiptRequest,
    PinMessageRequest,
} from "../types";
import { callService } from "./callService";
import { useCallStore } from "../store/useCallStore";
import { showCallNotification } from "@/services/notificationService";
import { soundManager } from "./SoundManager";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8080/api";
const WS_URL = API_URL.replace(/^http/, "ws").replace(/\/api$/, "/ws-raw");

class WebSocketService {
    private client: Client;
    private connected: boolean = false;
    private pendingSubscriptions: Record<string, (message: IMessage) => void> = {};
    private subscriptions: Record<string, any> = {};
    /** Nhiều listener / cùng destination (multicast) — reconnect dùng fanOut đã lưu. */
    private listenerSets: Record<string, Set<(message: IMessage) => void>> = {};
    /** Fan-out cho mỗi destination (một subscription STOMP duy nhất). */
    private subscriptionCallbacks: Record<string, (message: IMessage) => void> = {};
    private currentToken: string | null = null;
    private isRefreshing: boolean = false;
    private callSubscriptionActive: boolean = false;

    constructor() {
        this.client = new Client({
            brokerURL: WS_URL,
            debug: () => {},
            reconnectDelay: 5000,
            heartbeatIncoming: 4000,
            heartbeatOutgoing: 4000,

            forceBinaryWSFrames: true,
            appendMissingNULLonIncoming: true,

            beforeConnect: () => {
                const latestToken = useAuthStore.getState().accessToken;
                if (latestToken) {
                    const url = `${WS_URL}?token=${latestToken}`;
                    this.client.brokerURL = url;
                    this.client.connectHeaders = { Authorization: `Bearer ${latestToken}` };
                    this.currentToken = latestToken;

                }
            },
        });

        this.client.onConnect = async (frame) => {
            this.connected = true;
            this.isRefreshing = false;
            this.callSubscriptionActive = false;


            this.subscribeCallQueue();

            Object.keys(this.pendingSubscriptions).forEach((dest) => {
                if (this.subscriptions[dest]) return;

                const callback = this.pendingSubscriptions[dest];
                const sub = this.client.subscribe(dest, callback);
                this.subscriptions[dest] = sub;
            });
            this.pendingSubscriptions = {};

            setTimeout(async () => {
                try {
                    const pendingCall = await callService.checkPendingCall();
                    if (pendingCall) {

                        this.handleCallSignal({ type: 'INCOMING', payload: pendingCall });
                    }
                } catch (error) {
                    // silent
                }
            }, 500);
        };

        this.client.onStompError = async (frame) => {
            const msg = frame.headers["message"] || "";
            console.warn('=== WS === STOMP Error:', msg);
            if (msg.includes("JWT") || msg.includes("expired") || msg.includes("Authorization") || msg.includes("401")) {
                await this.refreshAndReconnect();
            }
        };

        this.client.onWebSocketError = async (event) => {
            console.warn('=== WS === WebSocket transport error');
            this.connected = false;
            this.callSubscriptionActive = false;
        };

        this.client.onDisconnect = () => {

            this.connected = false;
            // stompjs xóa subscription khi socket đứt; đưa callback vào pending để onConnect subscribe lại
            Object.keys(this.subscriptions).forEach((dest) => {
                const cb = this.subscriptionCallbacks[dest];
                if (cb) this.pendingSubscriptions[dest] = cb;
            });
            this.subscriptions = {};
            this.callSubscriptionActive = false;
        };
    }

    private async refreshAndReconnect() {
        if (this.isRefreshing) return;
        this.isRefreshing = true;
        this.connected = false;
        this.currentToken = null;

        try {
            const refreshed = await useAuthStore.getState().refreshAuth();
            if (refreshed) {
                const newToken = useAuthStore.getState().accessToken;
                if (newToken) {

                    this.activate(newToken);
                    return;
                }
            }
        } catch (e) {
            console.warn('=== WS === Token refresh failed');
        }
        this.isRefreshing = false;
    }

    activate(token?: string) {
        const authToken = token || useAuthStore.getState().accessToken;
        if (!authToken) {
            console.warn('=== WS === No token, cannot activate');
            return;
        }

        if (this.connected && this.client.connected && this.currentToken === authToken) {
            return;
        }

        if (this.client.active && this.currentToken === authToken) {
            return;
        }

        console.log('=== WS === Activating with token (last 8):', authToken.slice(-8));

        if (this.client.active && this.currentToken !== authToken) {
            console.log('=== WS === Token changed, deactivating old connection...');
            this.client.deactivate().then(() => {
                this.connected = false;
                this.subscriptions = {};
                this.callSubscriptionActive = false;
                this.doActivate(authToken);
            });
            return;
        }

        this.doActivate(authToken);
    }

    private doActivate(authToken: string) {
        this.currentToken = authToken;
        const authenticatedWsUrl = `${WS_URL}?token=${authToken}`;
        this.client.brokerURL = authenticatedWsUrl;
        this.client.connectHeaders = { Authorization: `Bearer ${authToken}` };

        if (!this.client.active) {
            console.log('=== WS === Client activating...');
            this.client.activate();
        }
    }

    deactivate() {
        console.log('=== WS === Deactivating');
        this.client.deactivate();
        this.connected = false;
        this.currentToken = null;
        this.subscriptions = {};
        this.pendingSubscriptions = {};
        this.subscriptionCallbacks = {};
        this.listenerSets = {};
        this.subscriptionCallbacks = {};
        this.listenerSets = {};
        this.callSubscriptionActive = false;
    }

    isConnected(): boolean {
        return this.connected && this.client.connected;
    }

    /** Subscribe to a topic/destination (nhiều listener cùng destination được gọi tuần tự). */
    subscribe(destination: string, callback: (message: IMessage) => void) {
        if (!this.listenerSets[destination]) {
            this.listenerSets[destination] = new Set();
        }
        this.listenerSets[destination].add(callback);

        const fanOut = (msg: IMessage) => {
            const set = this.listenerSets[destination];
            if (!set) return;
            set.forEach((cb) => {
                try {
                    cb(msg);
                } catch (e) {
                    console.error('[WebSocketService] listener error', destination, e);
                }
            });
        };

        this.subscriptionCallbacks[destination] = fanOut;

        if (!this.client.connected) {
            this.pendingSubscriptions[destination] = fanOut;
            return;
        }
        // Một subscription STOMP / destination; fanOut đọc listenerSets cập nhật runtime
        if (this.subscriptions[destination]) {
            return;
        }
        const subscription = this.client.subscribe(destination, fanOut);
        this.subscriptions[destination] = subscription;
        console.log('=== WS === Subscribed to:', destination);
    }

    /**
     * Gỡ subscription: nếu truyền `callback` chỉ gỡ listener đó;
     * không truyền thì gỡ toàn bộ destination (như logout / dọn layout).
     */
    unsubscribe(destination: string, callback?: (message: IMessage) => void) {
        if (callback) {
            this.listenerSets[destination]?.delete(callback);
            if (this.listenerSets[destination] && this.listenerSets[destination].size > 0) {
                return;
            }
        }

        delete this.listenerSets[destination];
        if (this.subscriptions[destination]) {
            this.subscriptions[destination].unsubscribe();
            delete this.subscriptions[destination];
        }
        delete this.pendingSubscriptions[destination];
        delete this.subscriptionCallbacks[destination];
    }

    sendChatMessage(
        receiverId: string,
        content: string,
        type: string = "TEXT",
        replyToMessageId?: string,
        attachments?: { url: string; type: string; filename: string; size: number }[]
    ): boolean {
        if (!this.client.connected) {
            console.error("Cannot send message: STOMP not connected");
            return false;
        }
        const body: any = { receiverId, content, type };
        if (replyToMessageId) body.replyToMessageId = replyToMessageId;
        if (attachments && attachments.length > 0) body.attachments = attachments;
        this.client.publish({
            destination: "/app/chat.send",
            body: JSON.stringify(body),
        });
        return true;
    }

    sendMessage(request: ChatMessageRequest) {
        if (this.client.connected) {
            this.client.publish({
                destination: "/app/chat.send",
                body: JSON.stringify(request),
            });
        } else {
            console.error("Cannot send message: STOMP not connected");
        }
    }

    sendTyping(request: TypingIndicatorRequest) {
        if (this.client.connected) {
            this.client.publish({
                destination: "/app/chat.typing",
                body: JSON.stringify(request),
            });
        }
    }

    sendReadReceipt(request: ReadReceiptRequest) {
        if (this.client.connected) {
            this.client.publish({
                destination: "/app/chat.read",
                body: JSON.stringify(request),
            });
        }
    }

    sendPin(request: PinMessageRequest) {
        if (this.client.connected) {
            this.client.publish({
                destination: "/app/chat.pin",
                body: JSON.stringify(request),
            });
        } else {
            console.error("Cannot send pin: STOMP not connected");
        }
    }

    handleCallSignal(data: any) {
        console.log('=== [CallSignal] type:', data.type, 'payload keys:', data.payload ? Object.keys(data.payload) : 'none');
        try {
            const { type, payload, callSessionId } = data;
            const callStore = useCallStore.getState();
            const currentSessionId = callStore.activeCall?.callSessionId || callStore.incomingCall?.callSessionId;

            switch (type) {
                case 'INCOMING':
                    console.log('=== [CallSignal] INCOMING from:', payload?.caller?.name, 'session:', payload?.callSessionId);
                    callStore.setIncomingCall(payload);
                    if (Platform.OS === 'web') {
                        soundManager.playRingtone();
                    } else if (AppState.currentState !== 'active') {
                        const callerName = payload?.caller?.name || 'Cuộc gọi đến';
                        const callType = payload?.callType || 'VOICE';
                        showCallNotification(callerName, callType);
                    }
                    break;
                
                case 'ACCEPTED':
                    console.log('=== [CallSignal] ACCEPTED - Clearing timer');
                    soundManager.stopAll();
                    soundManager.playBeep();
                    callStore.clearCallTimer();
                    callStore.setCallStatus('connected');
                    break;

                case 'CANCELLED':
                case 'ENDED':
                case 'REJECTED':
                    console.log(`=== [CallSignal] ${type} - sessionId:`, callSessionId, 'current:', currentSessionId);
                    soundManager.stopAll();
                    if (!callSessionId || callSessionId === currentSessionId) {
                        callStore.resetCall();
                    }
                    break;
                
                default:
                    console.warn('=== [CallSignal] Unknown type:', type);
            }
        } catch (error) {
            console.error("Failed to handle call signal", error);
        }
    }

    subscribeCallQueue() {
        if (this.callSubscriptionActive) {
            console.log('=== [WS] Call subscription already active, skipping');
            return;
        }

        const userId = useAuthStore.getState().user?.id;
        if (!userId) {
            console.warn('=== [WS] user.id not available, setting up retry listener...');
            const unsub = useAuthStore.subscribe((state) => {
                if (state.user?.id && this.connected) {
                    unsub();
                    console.log('=== [WS] user.id now available, retrying subscribeCallQueue');
                    this.subscribeCallQueue();
                }
            });
            return;
        }

        const dest = `/topic/call/${userId}`;

        if (this.subscriptions[dest]) {
            delete this.subscriptions[dest];
        }

        if (this.client.connected) {
            const sub = this.client.subscribe(dest, (message) => {
                try {
                    const data = JSON.parse(message.body);
                    this.handleCallSignal(data);
                } catch (e) {
                    console.error("Call signal parse error", e);
                }
            });
            this.subscriptions[dest] = sub;
            this.callSubscriptionActive = true;
            console.log('=== [WS] ✓ Call topic subscribed:', dest);
        } else {
            this.pendingSubscriptions[dest] = (message) => {
                try {
                    const data = JSON.parse(message.body);
                    this.handleCallSignal(data);
                } catch (e) {
                    console.error("Call signal parse error", e);
                }
            };
            console.log('=== [WS] Call topic queued as pending:', dest);
        }
    }

    unsubscribeCallQueue() {
        const userId = useAuthStore.getState().user?.id;
        if (userId) {
            this.unsubscribe(`/topic/call/${userId}`);
        }
        this.callSubscriptionActive = false;
    }
}

export const webSocketService = new WebSocketService();
