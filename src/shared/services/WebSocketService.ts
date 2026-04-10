import { Client, IMessage } from "@stomp/stompjs";
import { useAuthStore } from "@/shared/store/authStore";
import {
    ChatMessageRequest,
    TypingIndicatorRequest,
    ReadReceiptRequest,
    PinMessageRequest,
} from "../types";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8080/api";
const WS_URL = API_URL.replace(/^http/, "ws").replace(/\/api$/, "/ws-raw");

class WebSocketService {
    private client: Client;
    private connected: boolean = false;
    private pendingSubscriptions: Record<string, (message: IMessage) => void> = {};
    private subscriptions: Record<string, any> = {};
    private currentToken: string | null = null;

    constructor() {
        this.client = new Client({
            brokerURL: WS_URL,
            debug: () => {},
            reconnectDelay: 5000,
            heartbeatIncoming: 4000,
            heartbeatOutgoing: 4000,

            forceBinaryWSFrames: true,
            appendMissingNULLonIncoming: true,
        });

        this.client.onConnect = () => {
            this.connected = true;

            Object.keys(this.pendingSubscriptions).forEach((dest) => {
                const callback = this.pendingSubscriptions[dest];
                const sub = this.client.subscribe(dest, callback);
                this.subscriptions[dest] = sub;
            });
            this.pendingSubscriptions = {};
        };

        this.client.onStompError = async (frame) => {
            const msg = frame.headers["message"] || "";
            if (msg.includes("JWT") || msg.includes("expired") || msg.includes("Authorization")) {
                this.connected = false;
                this.currentToken = null;
                const refreshed = await useAuthStore.getState().refreshAuth();
                if (refreshed) {
                    const newToken = useAuthStore.getState().accessToken;
                    if (newToken) this.activate(newToken);
                }
            }
        };

        this.client.onWebSocketError = (event) => {
        };

        this.client.onDisconnect = () => {
            this.connected = false;
            this.subscriptions = {};
        };
    }

    /** Activate the STOMP connection with JWT token */
    activate(token?: string) {
        const authToken = token || useAuthStore.getState().accessToken;
        if (!authToken) {
            console.warn('Cannot activate WebSocket: no JWT token');
            return;
        }

        if (this.connected && this.currentToken === authToken) return;

        if (this.connected && this.currentToken !== authToken) {
            this.client.deactivate();
            this.connected = false;
            this.subscriptions = {};
        }

        this.currentToken = authToken;
        this.client.connectHeaders = {
            Authorization: `Bearer ${authToken}`,
        };

        this.client.activate();
    }

    /** Deactivate the STOMP connection */
    deactivate() {
        this.client.deactivate();
        this.connected = false;
        this.currentToken = null;
        this.subscriptions = {};
        this.pendingSubscriptions = {};
    }

    /** Check if connected */
    isConnected(): boolean {
        return this.connected && this.client.connected;
    }

    /** Subscribe to a topic/destination */
    subscribe(destination: string, callback: (message: IMessage) => void) {
        if (!this.client.connected) {
            this.pendingSubscriptions[destination] = callback;
            return;
        }
        if (this.subscriptions[destination]) {
            return; // Already subscribed
        }
        const subscription = this.client.subscribe(destination, callback);
        this.subscriptions[destination] = subscription;
    }

    /** Unsubscribe from a topic/destination */
    unsubscribe(destination: string) {
        if (this.subscriptions[destination]) {
            this.subscriptions[destination].unsubscribe();
            delete this.subscriptions[destination];
        }
        if (this.pendingSubscriptions[destination]) {
            delete this.pendingSubscriptions[destination];
        }
    }

    /** Gửi tin nhắn chat qua WebSocket, trả về true nếu thành công */
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
        const body: any = {
            receiverId,
            content,
            type,
        };
        if (replyToMessageId) {
            body.replyToMessageId = replyToMessageId;
        }
        if (attachments && attachments.length > 0) {
            body.attachments = attachments;
        }
        this.client.publish({
            destination: "/app/chat.send",
            body: JSON.stringify(body),
        });
        return true;
    }

    /** Gửi qua ChatMessageRequest đầy đủ */
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

    /** Send typing indicator */
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
}

export const webSocketService = new WebSocketService();
