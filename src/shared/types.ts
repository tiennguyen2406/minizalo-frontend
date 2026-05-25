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
    type:
        | "TEXT"
        | "IMAGE"
        | "VIDEO"
        | "FILE"
        | "DOCUMENT"
        | "FOLDER"
        | "STICKER"
        | "REPLY"
        | "FORWARD"
        | "SYSTEM"
        | "PIN_NOTIFICATION"
        | "POLL"
        | "VOICE"
        | "LINK"
        | "CALL_VOICE"
        | "CALL_VIDEO"
        | "STORY_REPLY";
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

// -----------------------------
// User / Profile
// -----------------------------

export interface UserProfile {
    id: string;
    username: string;
    email: string;
    displayName: string | null;
    avatarUrl: string | null;
    coverPhotoUrl: string | null;
    statusMessage: string | null;
    phone: string | null;
    gender: string | null;
    dateOfBirth: string | null;
    businessDescription: string | null;
    lastSeen: string | null;
    isOnline: boolean | null;
    createdAt: string | null;
    updatedAt: string | null;
    roles: string[] | null;
    allowPhoneSearch?: boolean;
    allowStrangerMessages?: boolean;
}

export interface PinMessageRequest {
    roomId: string;
    messageId: string;
    pin: boolean;
    messageType?: string; // TEXT, IMAGE, VIDEO, FILE, VOICE, LINK
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
    type:
        | "TEXT"
        | "IMAGE"
        | "VIDEO"
        | "FILE"
        | "DOCUMENT"
        | "FOLDER"
        | "STICKER"
        | "REPLY"
        | "FORWARD"
        | "SYSTEM"
        | "PIN_NOTIFICATION"
        | "POLL"
        | "VOICE"
        | "LINK"
        | "CALL_VOICE"
        | "CALL_VIDEO"
        | "STORY_REPLY";
    createdAt: string; // ISO string
    updatedAt?: string;
    isDeleted?: boolean;
    isRecall?: boolean;
    recalled?: boolean;
    pinned?: boolean;
    reactions?: { userId: string; emoji: string }[];
    readBy?: string[]; 
    replyToId?: string;
    replyMessage?: Message;
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
    attachments?: Attachment[];
    forwardedFromId?: string;
    receiverId?: string;
}

export type FriendStatus = "PENDING" | "ACCEPTED" | "BLOCKED";

export interface FriendResponseDto {
    id: string;
    user: UserProfile;
    friend: UserProfile;
    // Aliases to match some older code if any
    userProfile?: UserProfile;
    friendUser?: UserProfile;
    status: FriendStatus;
    createdAt: string;
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
    wallpaperUrl?: string;
    description?: string;
    type: 'GROUP' | 'PRIVATE' | 'CLOUD';
    lastMessage?: Message;
    unreadCount: number;
    participants: User[];
    updatedAt: string;
    hasInteracted?: boolean;
    /** Nhóm đã giải tán — chỉ xem lịch sử, không gửi tin mới */
    disbanded?: boolean;
}

export type GroupRole = 'ADMIN' | 'MEMBER';

export interface GroupMember {
    userId: string;
    username: string;
    fullName?: string;
    avatarUrl?: string;
    role: GroupRole;
}

/** Yêu cầu vào nhóm chờ trưởng/phó duyệt (chỉ API trả list khi bạn có quyền) */
export interface PendingJoinRequest {
    userId: string;
    username: string;
    fullName?: string;
    displayName?: string;
    avatarUrl?: string;
    invitedByUserId?: string | null;
    invitedByDisplayName?: string | null;
}

export interface GroupDetail {
    id: string;
    groupName: string;
    avatarUrl?: string;
    wallpaperUrl?: string;
    description?: string;
    ownerId: string;
    createdAt: string;
    members: GroupMember[];
    settings?: GroupSettings;
    disbanded?: boolean;
    pendingJoinRequests?: PendingJoinRequest[];
    pendingJoinRequestCount?: number;
}

// -----------------------------
// Group Admin & Features
// -----------------------------

export interface GroupSettings {
    id: string;
    groupId: string;
    allowMemberChangeName: boolean;
    allowMemberPin: boolean;
    allowMemberCreatePoll: boolean;
    allowMemberSendMessage: boolean;
    requireApproval: boolean;
    allowNewMemberReadHistory: boolean;
    allowJoinByLink: boolean;
    joinLink: string;
    updatedAt?: string;
}

export interface BlockedMember {
    id: string;
    userId: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    blockedAt: string;
    blockedBy: string;
}

export interface PollVote {
    id: string;
    userId: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    votedAt: string;
}

export interface PollOption {
    id: string;
    text: string;
    createdById: string;
    votes: PollVote[];
}

export interface Poll {
    id: string;
    roomId: string;
    question: string;
    allowMultipleChoices: boolean;
    allowAddOptions: boolean;
    closed: boolean;
    createdById: string;
    createdByName: string;
    options: PollOption[];
    createdAt: string;
    updatedAt: string;
}
