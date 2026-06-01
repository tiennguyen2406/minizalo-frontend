import type { ChatRoom } from "@/shared/types";
import type { FriendResponseDto } from "@/shared/services/types";

/** Đối tượng 1-1 trong phòng DIRECT (không phải chính mình). */
export function getPrivateChatPartnerId(
    room: ChatRoom,
    currentUserId: string,
): string | undefined {
    if (room.type !== "PRIVATE") return undefined;
    const me = String(currentUserId);
    const other = room.participants?.find(
        (p) => p.id && String(p.id) !== me,
    );
    return other?.id != null ? String(other.id) : undefined;
}

/** Tên hiển thị đối phương trong chat 1-1 (dùng cho copy thông báo privacy). */
export function getDirectChatPartnerDisplayName(
    room: ChatRoom | undefined,
    currentUserId: string | null | undefined,
): string {
    if (!room || room.type !== "PRIVATE") return "Người này";
    const me = currentUserId != null ? String(currentUserId) : "";
    const other = room.participants?.find((p) => p.id && String(p.id) !== me);
    const name = other?.fullName?.trim() || other?.username?.trim();
    return name || "Người này";
}

/** Đã là bạn ACCEPTED (hai chiều trong bảng friends). */
export function isAcceptedFriendWith(
    partnerId: string | undefined,
    currentUserId: string | undefined,
    friends: FriendResponseDto[],
): boolean {
    if (!partnerId || !currentUserId) return false;
    const me = String(currentUserId);
    const pid = String(partnerId);
    return friends.some((f) => {
        if (f.status !== "ACCEPTED") return false;
        const a = String(f.user.id);
        const b = String(f.friend.id);
        return (a === me && b === pid) || (b === me && a === pid);
    });
}

/** Chat 1-1 với người chưa phải bạn ACCEPTED. */
export function isStrangerPrivateRoom(
    room: ChatRoom,
    currentUserId: string,
    friends: FriendResponseDto[],
): boolean {
    if (room.type !== "PRIVATE") return false;
    const partnerId = getPrivateChatPartnerId(room, currentUserId);
    if (!partnerId) return false;
    return !isAcceptedFriendWith(partnerId, currentUserId, friends);
}

function hasExistingConversation(room: ChatRoom): boolean {
    return !!room.lastMessage || !!room.hasInteracted;
}

export function splitRoomsMainAndStrangers(
    rooms: ChatRoom[],
    currentUserId: string,
    friends: FriendResponseDto[],
): { mainRooms: ChatRoom[]; strangerRooms: ChatRoom[] } {
    const mainRooms: ChatRoom[] = [];
    const strangerRooms: ChatRoom[] = [];
    for (const r of rooms) {
        if (isStrangerPrivateRoom(r, currentUserId, friends) && !r.hasInteracted) {
            strangerRooms.push(r);
        } else {
            mainRooms.push(r);
        }
    }
    return { mainRooms, strangerRooms };
}
