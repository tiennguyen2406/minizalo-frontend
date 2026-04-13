export interface User {
    id: string;
    username: string;
    fullName: string;
    avatarUrl?: string; // Optional as it might not be in all responses
    /** Mô tả doanh nghiệp — hiển thị nhãn Business + panel thông tin. */
    businessDescription?: string | null;
}

export interface ChatMessageRequest {
    receiverId: string;
    content: string;
    type: "TEXT" | "IMAGE" | "VIDEO" | "FILE" | "STICKER" | "REPLY" | "FORWARD";
    replyToId?: string;
    // Field backend thực sự sử dụng cho reply
    replyToMessageId?: string;
    fileUrl?: string;
}

export interface TypingIndicatorRequest {
    roomId: string;
    isTyping: boolean;
}

export interface ReadReceiptRequest {
    roomId: string;
    messageId: string;
}

export interface ReactionRequest {
    roomId: string;
    messageId: string;
    emoji: string;
}

export interface PinMessageRequest {
    roomId: string;
    messageId: string;
    pin: boolean;
}

export interface Attachment {
    url: string;
    type: string; // "IMAGE", "VIDEO", "DOCUMENT"
    name: string;
    filename?: string;
    size: number;
    thumbnailUrl?: string;
}

// Backend 'MessageDynamo' model equivalent
export interface Message {
    id: string;
    senderId: string;
    senderName?: string;
    roomId: string;
    content: string;
    type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'FILE' | 'DOCUMENT' | 'FOLDER' | 'STICKER' | 'REPLY' | 'FORWARD' | 'SYSTEM';
    createdAt: string; // ISO string
    updatedAt?: string;
    isDeleted?: boolean;
    isRecall?: boolean;
    pinned?: boolean;
    reactions?: { userId: string; emoji: string }[];
    readBy?: string[]; // userIds
    replyToId?: string;
    replyMessage?: Message; // recursive optional
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
    attachments?: Attachment[];
    forwardedFromId?: string; // original sender id if forwarded
    receiverId?: string; // Optional: ID of the receiver for private messages
}

export interface PaginatedMessageResult {
    messages: Message[];
    lastKey?: string; // For DynamoDB pagination
    hasMore: boolean;
}

export interface SearchMessageResponse {
    results: Message[];
    lastKey?: string;
    total: number;
}

export interface ChatRoom {
    id: string;
    name: string;
    avatarUrl?: string; // Group avatar or friend avatar
    type: 'GROUP' | 'PRIVATE';
    lastMessage?: Message;
    unreadCount: number;
    participants: User[];
    updatedAt: string;
}

export type GroupRole = 'ADMIN' | 'MEMBER';

export interface GroupMember {
    userId: string;
    username: string;
    fullName?: string;
    avatarUrl?: string;
    role: GroupRole;
}

export interface GroupDetail {
    id: string;
    groupName: string;
    avatarUrl?: string;
    ownerId: string;
    createdAt: string;
    members: GroupMember[];
}
