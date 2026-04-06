// Auth API types - shared cho Web & Mobile
export interface SignupRequest {
    name: string;
    phone: string;
    email: string;
    password: string;
    gender?: string;
    dateOfBirth?: string;
    verificationToken: string;
}

export interface LoginRequest {
    username: string; // phone hoặc email
    password: string;
    deviceType?: "WEB" | "MOBILE";
    deviceId?: string;
}

export interface JwtResponse {
    accessToken: string;
    refreshToken: string;
}

export interface MessageResponse {
    message: string;
}

export interface ApiError {
    message: string;
    status?: number;
}

// -----------------------------
// User / Profile
// -----------------------------

// User profile (khớp UserProfileResponse backend)
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
    dateOfBirth: string | null; // ISO date "YYYY-MM-DD"
    businessDescription: string | null;
    lastSeen: string | null;
    isOnline: boolean | null;
    createdAt: string | null;
    updatedAt: string | null;
    roles: string[] | null;
    allowPhoneSearch?: boolean;
}

export interface UserProfileUpdateRequest {
    displayName?: string;
    avatarUrl?: string;
    coverPhotoUrl?: string;
    statusMessage?: string;
    phone?: string;
    gender?: string;
    dateOfBirth?: string; // "YYYY-MM-DD"
    businessDescription?: string;
    allowPhoneSearch?: boolean;
}

// -----------------------------
// Friends
// -----------------------------

export type FriendStatus = "PENDING" | "ACCEPTED" | "BLOCKED";

// Khớp FriendResponse backend
export interface FriendResponseDto {
    id: string;
    user: UserProfile;
    friend: UserProfile;
    status: FriendStatus;
    createdAt: string;
}

export interface SendFriendRequestPayload {
    friendId: string;
}

