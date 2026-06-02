import React, { useEffect, useCallback, useState, useMemo, useRef, useLayoutEffect } from "react";
import SearchMessagePanel from "./SearchMessagePanel";
import { Box, Avatar } from "zmp-ui";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import { groupService } from "@/shared/services/groupService";
import { useAuthStore } from "@/shared/store/authStore";
import { useGroupStore } from "@/shared/store/useGroupStore";
import GroupInfoPanel from "./GroupInfoPanel";
import DirectChatInfoPanel from "./DirectChatInfoPanel";
import AddMembersModal from "./AddMembersModal";
import ForwardMessageModal from "./ForwardMessageModal";
import CreatePollModal from "./CreatePollModal";
import SendFriendRequestModalWeb from "./SendFriendRequestModalWeb";
import { useChatStore } from "@/shared/store/useChatStore";
import { useFriendStore } from "@/shared/store/friendStore";
import { Message, User } from "@/shared/types";
import { webSocketService } from "@/shared/services/WebSocketService";
import { chatService, mapChatRoomResponseToFrontend, MessageDynamo } from "@/shared/services/chatService";
import { useCallStore } from '../../../shared/store/useCallStore';
import { MessageService } from "@/shared/services/MessageService";
import friendService from "@/shared/services/friendService";
import { validateFileSize } from "@/shared/constants";
import { isStrangerMessagesNotAllowedError } from "@/shared/utils/chatErrors";
import { isStrangerPrivateRoom } from "@/shared/utils/strangerChatRooms";
import { addIncomingChatMessageFromStomp } from "@/shared/utils/chatWebSocketInbound";
import type { IMessage } from "@stomp/stompjs";
import { CallType } from "@/shared/services/callService";
import PinnedMessagesBar from "./PinnedMessagesBar";
import GroupCallInviteModal from "./GroupCallInviteModal";
import AiSummaryModal from "./AiSummaryModal";
import { ArrowUp, Sparkles, X } from 'lucide-react';
import { showToast as toast } from '@/shared/utils/toast';
import UnreadAiSummaryModal from "./UnreadAiSummaryModal";
import AiOptionsModal from "./AiOptionsModal";
import AiPersonaBotModalWeb from "./AiPersonaBotModalWeb";
import AiTaskModalWeb, { AiTaskMode } from "./AiTaskModalWeb";
import { Ionicons } from '@/shared/components/Icons';
import CloudOptionsModal from "./CloudOptionsModal";

interface ChatWindowProps {
  roomId: string;
}

function mapDynamoToMessage(msg: MessageDynamo, roomId: string): Message {
  return {
    id: msg.messageId,
    senderId: msg.senderId,
    senderName: msg.senderName || undefined,
    roomId: roomId,
    content: msg.recalled ? "[Tin nhắn đã thu hồi]" : msg.content,
    type: (msg.type as any) || "TEXT",
    createdAt: msg.createdAt,
    readBy: msg.readBy,
    isRecall: msg.recalled,
    pinned: !!msg.pinned,
    fileUrl: msg.attachments?.[0]?.url,
    fileName: msg.attachments?.[0]?.name || msg.attachments?.[0]?.filename,
    fileSize: msg.attachments?.[0]?.size,
    attachments: msg.attachments || [],
    reactions: Array.isArray(msg.reactions) ? [...msg.reactions] : [],
    replyToId: msg.replyToMessageId,
  };
}

const ChatWindow: React.FC<ChatWindowProps> = ({ roomId }) => {
  const { user } = useAuthStore();
  const currentUserId = user?.id || "";

  const {
    messages,
    addMessage,
    setCurrentRoom,
    setMessages,
    rooms,
    prependMessages,
    deleteRoom,
    mergeRooms,
  } = useChatStore();
  const { isGroupInfoOpen, openGroupInfo, closeGroupInfo, currentGroupDetail } =
    useGroupStore();
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [forwardingMessages, setForwardingMessages] = useState<
    Message[] | null
  >(null);
  const [isSendingFile, setIsSendingFile] = useState(false);
  const [historyLastKey, setHistoryLastKey] = useState<string | null>(null);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [groupPerm, setGroupPerm] = useState<{
    ownerId?: string;
    members?: { userId: string; role: string }[];
    settings?: any;
  } | null>(null);
  const [permToast, setPermToast] = useState<string | null>(null);
  const [blockStatus, setBlockStatus] = useState<{
    blockedByYou: boolean;
    blockedByOther: boolean;
    blockerName: string | null;
  } | null>(null);
  const [friendsListReady, setFriendsListReady] = useState(false);
  const [friendInviteOpen, setFriendInviteOpen] = useState(false);

  const [groupCallInviteOpen, setGroupCallInviteOpen] = useState(false);
  const [groupCallType, setGroupCallType] = useState<CallType>("VOICE");
  const [isAiSummaryOpen, setIsAiSummaryOpen] = useState(false);
  const [isAiOptionsOpen, setIsAiOptionsOpen] = useState(false);
  const [isAiPersonaOpen, setIsAiPersonaOpen] = useState(false);
  const [isAiTaskOpen, setIsAiTaskOpen] = useState(false);
  const [aiTaskMode, setAiTaskMode] = useState<AiTaskMode>("translate");
  const [showUnreadAiModal, setShowUnreadAiModal] = useState(false);
  const [cloudOptionsOpen, setCloudOptionsOpen] = useState(false);
  const [unreadAiDates, setUnreadAiDates] = useState<{ start?: string; end?: string }>({});
  const [unreadAiCount, setUnreadAiCount] = useState(0);
  const [initialUnreadCount, setInitialUnreadCount] = useState(0);
  const [firstUnreadMessage, setFirstUnreadMessage] = useState<any>(null);
  const [sessionUnreadCount, setSessionUnreadCount] = useState(0);
  const isAtBottomRef = useRef(true);
  const [jumpSignal, setJumpSignal] = useState(0);
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);
  const bannerTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const typingTimersRef = useRef<Record<string, NodeJS.Timeout>>({});
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  const clearUnreadBanner = useCallback(() => {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    setInitialUnreadCount(0);
    setSessionUnreadCount(0);
    setFirstUnreadMessage(null);
    setIsBannerDismissed(true);
  }, []);

  // Track which room's timer we've already started
  const bannerTimerStartedForRoom = useRef<string | null>(null);

  // Auto-hide unread banner after 7s — start timer the moment initialUnreadCount becomes > 0
  useEffect(() => {
    if (!roomId) return;
    // Only start the timer once per room entry
    if (bannerTimerStartedForRoom.current === roomId) return;
    if (initialUnreadCount <= 0 && !firstUnreadMessage) return;
    if (isBannerDismissed) return;

    bannerTimerStartedForRoom.current = roomId;
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = setTimeout(() => {
      clearUnreadBanner();
    }, 7000);

    return () => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, [roomId, initialUnreadCount, firstUnreadMessage, isBannerDismissed, clearUnreadBanner]);

  // Reset timer tracking when room changes
  useEffect(() => {
    bannerTimerStartedForRoom.current = null;
  }, [roomId]);

  // Call Store Actions
  const { initiateCall, initiateGroupCall } = useCallStore();

  const emptyArray = useMemo(() => [], []);
  const messagesState = messages[roomId] || emptyArray;

  const fetchFriends = useFriendStore((s) => s.fetchFriends);
  const friends = useFriendStore((s) => s.friends);
  const sentRequests = useFriendStore((s) => s.sentRequests);
  const requests = useFriendStore((s) => s.requests);
  const sendFriendInvite = useFriendStore((s) => s.sendRequest);
  const acceptFriendRequest = useFriendStore((s) => s.acceptRequest);
  const fetchSentRequests = useFriendStore((s) => s.fetchSentRequests);
  const fetchFriendRequests = useFriendStore((s) => s.fetchRequests);

  const currentRoom = useMemo(() => {
    // 1. Tìm trực tiếp theo ID phòng
    const directMatch = rooms.find((r) => String(r.id) === String(roomId));
    if (directMatch) return directMatch;
    
    // 2. Nếu là chat cá nhân (roomId có thể là friendId), tìm phòng PRIVATE có chứa friendId đó
    return rooms.find((r) => 
        r.type === 'PRIVATE' && 
        r.participants?.some(p => String(p.id) === String(roomId))
    );
  }, [rooms, roomId]);

  // Nếu vào thẳng /chat/:id mà store chưa có rooms → fetch rooms để resolve đúng type/name (đặc biệt CLOUD).
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!roomId) return;
      if (currentRoom) return;
      try {
        const apiRooms = await chatService.getChatRooms();
        if (cancelled) return;
        const mapped = apiRooms.map(mapChatRoomResponseToFrontend);
        mergeRooms(mapped as any);
      } catch {
        // ignore
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [roomId, currentRoom, mergeRooms]);
  const isGroupRoom = currentRoom?.type === "GROUP";
  const isCloudRoom = currentRoom?.type === "CLOUD";
  const isGroupDisbanded = isGroupRoom && !!currentRoom?.disbanded;
  const roomName = isCloudRoom
    ? "Cloud của tôi"
    : isGroupRoom
      ? currentRoom?.name || "Nhóm chat"
      : currentRoom?.participants?.find((p) => p.id !== currentUserId)
        ?.fullName ||
        currentRoom?.participants?.find((p) => p.id !== currentUserId)
          ?.username ||
        currentRoom?.name ||
        "Phòng chat";

  /** Phòng nhóm: ưu tiên chi tiết nhóm (cập nhật ngay sau đổi avatar trong panel); không chỉ dựa vào rooms[]. */
  const roomAvatar =
    isCloudRoom
      ? ""
      : isGroupRoom &&
          currentGroupDetail?.id === roomId &&
          currentGroupDetail.avatarUrl
        ? currentGroupDetail.avatarUrl
        : currentRoom?.avatarUrl ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(roomName)}&background=${isGroupRoom ? "0068FF" : "random"}&color=fff&bold=true`;

  const roomWallpaper =
    isGroupRoom && currentGroupDetail?.id === roomId
      ? currentGroupDetail.wallpaperUrl || currentRoom?.wallpaperUrl
      : currentRoom?.wallpaperUrl;

  // Người bạn chat (với 1-1) - using case-insensitive comparison for safety
  const partner = !isGroupRoom
    ? currentRoom?.participants?.find((p) => String(p.id).toLowerCase() !== String(currentUserId).toLowerCase())
    : undefined;

  const participantMap = useMemo(() => {
    const m: Record<string, User> = {};
    currentRoom?.participants?.forEach((p) => {
      m[p.id] = p;
    });
    return m;
  }, [currentRoom]);

  /** Tin ghim: mới hơn (theo thời gian gửi tin gốc) hiển thị trước trên thanh */
  const pinnedMessagesSorted = useMemo(() => {
    const pinned = messagesState.filter((m) => m.pinned);
    return pinned.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [messagesState]);

  const scrollToMessageHighlight = useCallback((messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("bg-yellow-100");
      setTimeout(() => el.classList.remove("bg-yellow-100"), 1500);
    }
  }, []);

  const handleSelectSearchMessage = useCallback((message: MessageDynamo) => {
    if (!roomId || !message?.messageId) return;

    const selected = mapDynamoToMessage(message, roomId);
    const current = useChatStore.getState().messages[roomId] || [];
    const exists = current.some((m) => String(m.id) === String(selected.id));

    if (!exists) {
      const merged = [...current, selected].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      setMessages(roomId, merged);
    }

    useChatStore.getState().setHighlightedMessageId(selected.id);
  }, [roomId, setMessages]);

  const blockedUsers = useFriendStore((s) => s.blockedUsers);
  const blockSignal = useFriendStore((s) => s.blockSignal);
  const isBlockedByYouLocal =
    !!partner?.id && blockedUsers.some((x) => x.friend?.id === partner.id);
  const isBlocked =
    isBlockedByYouLocal ||
    blockStatus?.blockedByOther ||
    blockStatus?.blockedByYou ||
    false;

  const realMessageCount = useMemo(
    () =>
      messagesState.filter((m) => {
        const id = m.id;
        if (typeof id !== "string") return m.senderId !== "system";
        return (
          !id.startsWith("temp-") &&
          !id.startsWith("failed-") &&
          m.senderId !== "system"
        );
      }).length,
    [messagesState],
  );

  const isStrangerEmptyThread = useMemo(() => {
    if (isGroupRoom || !currentRoom || !friendsListReady || !partner?.id)
      return false;
    if (isBlocked) return false;
    if (realMessageCount > 0) return false;
    return isStrangerPrivateRoom(currentRoom, currentUserId, friends);
  }, [
    isGroupRoom,
    currentRoom,
    friendsListReady,
    partner?.id,
    isBlocked,
    realMessageCount,
    currentUserId,
    friends,
  ]);

  const friendRequestStatus = useMemo((): "NONE" | "SENT" | "INCOMING" => {
    if (!partner?.id || isGroupRoom) return "NONE";
    const incoming = requests.find((r) => {
      const id = r.user?.id ?? r.friend?.id;
      return id != null && String(id) === String(partner.id);
    });
    if (incoming) return "INCOMING";
    const sent = sentRequests.some((r) => {
      const id =
        r.friend?.id ?? (r as { friendId?: string }).friendId ?? r.user?.id;
      return id != null && String(id) === String(partner.id);
    });
    if (sent) return "SENT";
    return "NONE";
  }, [partner?.id, isGroupRoom, requests, sentRequests]);

  const incomingFriendRequest = useMemo(
    () =>
      !partner?.id
        ? undefined
        : requests.find((r) => {
          const id = r.user?.id ?? r.friend?.id;
          return id != null && String(id) === String(partner.id);
        }),
    [requests, partner?.id],
  );
  
  // ─── Mark messages as read when focusing or receiving ─────────────────────
  useEffect(() => {
    if (!roomId) return;
    
    // Always clear local unread count when focusing/opening the room
    useChatStore.getState().markRoomAsRead(roomId);

    if (messagesState.length === 0) return;

    const uid = currentUserId || "";
    
    // Find the newest message from others that is not system/temp (chronological order)
    let newestOtherMsg = null;
    for (let i = messagesState.length - 1; i >= 0; i--) {
      const m = messagesState[i];
      if (
        m &&
        m.id &&
        !m.id.startsWith("temp-") &&
        m.senderId !== uid &&
        m.senderId !== "system" &&
        m.type !== "SYSTEM" &&
        m.type !== "PIN_NOTIFICATION"
      ) {
        newestOtherMsg = m;
        break;
      }
    }

    if (newestOtherMsg) {
      const readBy = newestOtherMsg.readBy || [];
      if (!readBy.includes(uid)) {
        webSocketService.sendReadReceipt({
          roomId: roomId,
          messageId: newestOtherMsg.id,
        });
      }
    }
  }, [roomId, messagesState, currentUserId]);

  useEffect(() => {
    let cancelled = false;
    void fetchFriends().finally(() => {
      if (!cancelled) setFriendsListReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchFriends]);

  useEffect(() => {
    if (
      isGroupRoom ||
      !partner?.id ||
      !friendsListReady ||
      !currentRoom ||
      realMessageCount > 0 ||
      !isStrangerPrivateRoom(currentRoom, currentUserId, friends)
    ) {
      return;
    }
    void fetchSentRequests();
    void fetchFriendRequests({ silent: true });
  }, [
    isGroupRoom,
    partner?.id,
    friendsListReady,
    currentRoom,
    realMessageCount,
    currentUserId,
    friends,
    fetchSentRequests,
    fetchFriendRequests,
  ]);

  const handleAcceptIncomingFriend = async () => {
    if (!incomingFriendRequest) return;
    try {
      await acceptFriendRequest(incomingFriendRequest.id);
    } catch {
      window.alert("Không thể chấp nhận lời mời kết bạn.");
    }
  };

  const fetchHistory = useCallback(async (customLimit?: number) => {
    if (!roomId) return;
    try {
      // Read unreadCount from store directly so we always get the CURRENT value,
      // not a stale closure value from when the callback was created.
      const liveUnreadCount = customLimit
        ? 0
        : (useChatStore.getState().rooms.find(r => String(r.id) === String(roomId))?.unreadCount || 0);
      const limit = customLimit || (liveUnreadCount > 0 ? Math.max(100, Math.min(300, liveUnreadCount + 20)) : 40);
      const result = await chatService.getChatHistory(roomId, limit);
      setHistoryLastKey(result.lastEvaluatedKey ?? null);
      setHistoryHasMore(!!result.lastEvaluatedKey);
      const sorted = (result.messages || [])
        .slice()
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
      
      let deletedIds: string[] = [];
      if (currentUserId) {
        try {
          const raw = localStorage.getItem(`DELETED_MESSAGES_${currentUserId}`);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              deletedIds = parsed;
            }
          }
        } catch (e) {}
      }

      const historyMessages = sorted
        .map((m) => mapDynamoToMessage(m, roomId))
        .filter((m) => !deletedIds.includes(m.id));
      
      const currentMsgs = useChatStore.getState().messages[roomId] || [];
      const liveMessages = currentMsgs.filter(
        (m) => typeof m.id === "string" && m.id.startsWith("temp-"),
      );
      const merged = [...historyMessages];
      for (const liveMsg of liveMessages) {
        if (!merged.some((m) => m.id === liveMsg.id)) merged.push(liveMsg);
      }
      
      const filteredMerged = merged.filter((m) => !deletedIds.includes(m.id));
      filteredMerged.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      setMessages(roomId, filteredMerged);
    } catch (error) {
      console.error("Failed to fetch chat history", error);
    }
  }, [roomId, setMessages, currentUserId]);

  const loadMoreHistory = useCallback(async () => {
    if (!roomId || loadingOlder || !historyHasMore || !historyLastKey) return;
    setLoadingOlder(true);
    try {
      const result = await chatService.getChatHistory(
        roomId,
        40,
        historyLastKey,
      );
      setHistoryLastKey(result.lastEvaluatedKey ?? null);
      setHistoryHasMore(!!result.lastEvaluatedKey);
      const sorted = (result.messages || [])
        .slice()
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
      const older = sorted.map((m) => mapDynamoToMessage(m, roomId));
      const current = useChatStore.getState().messages[roomId] || [];
      const ids = new Set(current.map((m) => m.id));
      const uniqueOlder = older.filter((m) => !ids.has(m.id));
      
      let deletedIds: string[] = [];
      if (currentUserId) {
        try {
          const raw = localStorage.getItem(`DELETED_MESSAGES_${currentUserId}`);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              deletedIds = parsed;
            }
          }
        } catch (e) {}
      }
      
      const uniqueOlderFiltered = uniqueOlder.filter((m) => !deletedIds.includes(m.id));
      if (uniqueOlderFiltered.length > 0) {
        prependMessages(roomId, uniqueOlderFiltered);
      }
    } catch (e) {
      console.error("Failed to load older messages", e);
    } finally {
      setLoadingOlder(false);
    }
  }, [roomId, historyLastKey, historyHasMore, loadingOlder, prependMessages, currentUserId]);

  const handleJumpToOldestUnread = useCallback(() => {
    // Trigger the jump signal — MessageList.handleJumpToUnread will
    // use externalFirstUnread to find and scroll to the target.
    setJumpSignal(prev => prev + 1);
    // Only HIDE the banner visually — do NOT clear firstUnreadMessage yet!
    // handleJumpToUnread needs it to know WHERE to scroll.
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    setIsBannerDismissed(true);
  }, []);

  useEffect(() => {
    setFriendInviteOpen(false);
  }, [roomId]);

  // Capture unread count as soon as roomId changes, BEFORE any other effects
  useLayoutEffect(() => {
    if (!roomId) return;
    setIsBannerDismissed(false); // Reset dismissal lock for new room
    const rooms = useChatStore.getState().rooms;
    const room = rooms.find(r => String(r.id) === String(roomId));
    const count = room?.unreadCount || 0;
    
    if (count > 0) {
      console.log(`[ChatWindow] Found ${count} unread messages for room ${roomId}`);
      setInitialUnreadCount(count);
      // Fetch the oldest unread message immediately
      chatService.getOldestUnreadMessage(roomId).then(msg => {
        if (msg && !isBannerDismissed) {
          const mapped = mapDynamoToMessage(msg, roomId);
          setFirstUnreadMessage(mapped);
        }
      });
    } else {
      setInitialUnreadCount(0);
      setFirstUnreadMessage(null);
    }
    setSessionUnreadCount(0);
    isAtBottomRef.current = true;
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    
    setCurrentRoom(roomId);
    webSocketService.activate();

    // Reset history state for the new room BEFORE fetching
    setHistoryLastKey(null);
    setHistoryHasMore(false);
    setSearchOpen(false);
    setBlockStatus(null);
    setIsInfoOpen(false);
    closeGroupInfo();

    fetchHistory();

    const chatTopic = `/topic/chat/${roomId}`;
    // Thông báo chỉ cho riêng user
    const noticeDest = `/user/queue/chat-notices`;
    const onInboundMsg = (stompMessage: IMessage) => {
      try {
        const raw = String(stompMessage.body || "").trim();
        if (!raw) return;
        const payload = JSON.parse(raw);
        
        // If not at bottom, increment session unread
        if (!isAtBottomRef.current) {
          setSessionUnreadCount(prev => prev + 1);
          if (!firstUnreadMessage) {
            setFirstUnreadMessage(payload);
          }
        }

        addIncomingChatMessageFromStomp(roomId, raw);
      } catch (e) {
        const raw = stompMessage.body;
        if (raw != null) addIncomingChatMessageFromStomp(roomId, String(raw));
      }
    };

    webSocketService.subscribe(chatTopic, onInboundMsg);
    webSocketService.subscribe(noticeDest, onInboundMsg);

    // Subscribe to recall events
    const recallTopic = `/topic/chat/${roomId}/recall`;
    webSocketService.subscribe(recallTopic, (stompMessage) => {
      try {
        const payload = JSON.parse(stompMessage.body);
        const recalledId = payload.messageId;
        if (recalledId) {
          const currentMsgs = useChatStore.getState().messages[roomId] || [];
          const newMsgs = currentMsgs.map((m) =>
            m.id === recalledId
              ? { ...m, isRecall: true, content: "[Tin nhắn đã thu hồi]" }
              : m,
          );
          setMessages(roomId, newMsgs);

          // Update room's lastMessage in store
          const room = useChatStore.getState().rooms.find((r) => r.id === roomId);
          if (room && room.lastMessage && room.lastMessage.id === recalledId) {
            useChatStore.getState().upsertRoom({
              ...room,
              lastMessage: {
                ...room.lastMessage,
                isRecall: true,
                recalled: true,
                content: "[Tin nhắn đã thu hồi]",
              },
            });
          }
        }
      } catch (err) {
        console.error("Error parsing recall WS message:", err);
      }
    });

    // Subscribe to reaction events
    const reactionTopic = `/topic/chat/${roomId}/reaction`;
    webSocketService.subscribe(reactionTopic, (stompMessage) => {
      try {
        const payload = JSON.parse(stompMessage.body);
        const messageId = payload.messageId;
        if (messageId && payload.action) {
          const currentMsgs = useChatStore.getState().messages[roomId] || [];
          const newMsgs = currentMsgs.map((m) => {
            if (m.id === messageId) {
              const reactions = Array.isArray(m.reactions)
                ? [...m.reactions]
                : [];
              if (
                payload.action === "remove" ||
                payload.action === "removeAll"
              ) {
                // Xoá emoji đã thả
                const filtered = payload.emoji
                  ? reactions.filter(
                    (r) =>
                      !(
                        r.userId === payload.userId &&
                        r.emoji === payload.emoji
                      ),
                  )
                  : reactions.filter((r) => r.userId !== payload.userId); // removeAll theo user
                return { ...m, reactions: filtered };
              } else if (payload.action === "add") {
                // Thêm emoji mới nếu chưa có
                const exists = reactions.some(
                  (r) =>
                    r.userId === payload.userId && r.emoji === payload.emoji,
                );
                if (!exists) {
                  reactions.push({
                    userId: payload.userId,
                    emoji: payload.emoji,
                  });
                }
                return { ...m, reactions };
              }
            }
            return m;
          });
          setMessages(roomId, newMsgs);
        }
      } catch (err) {
        console.error("Error parsing reaction WS message:", err);
      }
    });

    // Subscribe to pin events
    const pinTopic = `/topic/chat/${roomId}/pin`;
    webSocketService.subscribe(pinTopic, (stompMessage) => {
      try {
        const payload = JSON.parse(stompMessage.body);
        if (payload?.error) {
          if (payload.actorId && currentUserId && String(payload.actorId) !== String(currentUserId)) {
            return;
          }
          setPermToast(payload.message || "Không thể ghim tin nhắn.");
          fetchHistory();
          return;
        }

        const messageId = payload.messageId;
        if (messageId) {
          const currentMsgs = useChatStore.getState().messages[roomId] || [];
          const newMsgs = currentMsgs.map((m) =>
            m.id === messageId ? { ...m, pinned: !!payload.isPinned } : m,
          );

          setMessages(roomId, newMsgs);
        }
      } catch (err) {
        console.error("Error parsing pin WS message:", err);
      }
    });

    // Realtime group settings updates (permissions)
    const settingsTopic = `/topic/chat/${roomId}/settings`;
    const onSettingsChanged = (stompMessage: { body: string }) => {
      try {
        const payload = JSON.parse(String(stompMessage.body || "{}"));
        console.debug("[WS settings]", roomId, payload);
        setGroupPerm((prev) => ({
          ...(prev || {}),
          settings: payload,
        }));
        // cũng sync vào store nếu đang mở panel info
        const gs = useGroupStore.getState();
        if (gs.currentGroupDetail && gs.currentGroupDetail.id === roomId) {
          gs.updateCurrentGroupDetail({
            ...gs.currentGroupDetail,
            settings: payload,
          } as any);
        }
      } catch (err) {
        console.error("Error parsing settings WS message:", err);
      }
    };
    webSocketService.subscribe(settingsTopic, onSettingsChanged);
    
    // Clear typing state when switching rooms
    setTypingUsers({});
    Object.values(typingTimersRef.current).forEach(clearTimeout);
    typingTimersRef.current = {};

    // Realtime group role/owner changes (để mở/khóa ô nhập ngay khi phong phó nhóm / chuyển trưởng nhóm)
    const groupEventsTopic = `/topic/group/${roomId}/events`;
    const typingTopic = `/topic/typing/${roomId}`;
    // Tìm ID thực từ currentRoom (vừa được tối ưu ở useMemo trên)
    const actualRoomId = currentRoom?.id;
    const typingTopicActual = actualRoomId && String(actualRoomId) !== String(roomId) ? `/topic/typing/${actualRoomId}` : null;

    const onTypingEvent = (stompMessage: IMessage) => {
      try {
        const payload = JSON.parse(String(stompMessage.body)) as {
          userId: string;
          isTyping?: boolean;
          typing?: boolean;
        };
        const senderId = String(payload.userId || "").trim().toLowerCase();
        const myId = String(currentUserId || "").trim().toLowerCase();
        
        if (!senderId || senderId === myId) return;

        // Chấp nhận cả isTyping hoặc typing
        const isUserTyping = payload.isTyping !== undefined ? payload.isTyping : payload.typing;

        setTypingUsers((prev) => {
          const next = { ...prev };
          if (isUserTyping) {
            const currentRooms = useChatStore.getState().rooms;
            const room = currentRooms.find((r) => String(r.id) === String(roomId) || (actualRoomId && String(r.id) === String(actualRoomId)));
            const user = room?.participants?.find((p) => String(p.id).trim().toLowerCase() === senderId);
            const name = user?.fullName || user?.username || "Ai đó";
            next[senderId] = name;

            if (typingTimersRef.current[senderId]) {
              clearTimeout(typingTimersRef.current[senderId]);
            }

            typingTimersRef.current[senderId] = setTimeout(() => {
              setTypingUsers((current) => {
                const updated = { ...current };
                delete updated[senderId];
                return updated;
              });
            }, 6000);
          } else {
            delete next[senderId];
            if (typingTimersRef.current[senderId]) {
              clearTimeout(typingTimersRef.current[senderId]);
              delete typingTimersRef.current[senderId];
            }
          }
          return next;
        });
      } catch (err) {
        // ignore
      }
    };

    webSocketService.subscribe(typingTopic, onTypingEvent);
    if (typingTopicActual) {
      webSocketService.subscribe(typingTopicActual, onTypingEvent);
    }

    // ── Read Receipt realtime update ──────────────────────────────────────────
    const readTopicId = actualRoomId || roomId;
    const readTopic = `/topic/chat/${readTopicId}/read`;
    const onReadEvent = (stompMessage: IMessage) => {
      try {
        const payload = JSON.parse(String(stompMessage.body)) as {
          messageId: string;
          userId: string;
          readAt?: string;
        };
        if (!payload.messageId || !payload.userId) return;
        // Cập nhật readBy vào tin nhắn tương ứng trong store
        const currentMsgs = useChatStore.getState().messages[roomId] || [];
        const updated = currentMsgs.map((m) => {
          if (m.id !== payload.messageId) return m;
          const existingReadBy = m.readBy || [];
          if (existingReadBy.includes(payload.userId)) return m;
          return { ...m, readBy: [...existingReadBy, payload.userId] };
        });
        setMessages(roomId, updated);
      } catch (err) {
        // ignore
      }
    };
    webSocketService.subscribe(readTopic, onReadEvent);
    // Nếu actualRoomId khác roomId, subscribe thêm topic với roomId gốc
    const readTopicAlt = actualRoomId && String(actualRoomId) !== String(roomId)
      ? `/topic/chat/${roomId}/read`
      : null;
    if (readTopicAlt) {
      webSocketService.subscribe(readTopicAlt, onReadEvent);
    }

    const onGroupEvent = (stompMessage: IMessage) => {
      try {
        const payload = JSON.parse(String(stompMessage.body || "{}")) as {
          message?: string;
          eventType?: string;
        };
        const msg = String(payload.message || "");
        // Backend có thể dùng eventType khác nhau; ưu tiên match theo text VN đang hiển thị cho user
        const isRoleChange =
          msg.includes("phó nhóm") || msg.includes("nhường quyền trưởng nhóm");
        if (!isRoleChange) return;

        void groupService
          .getGroupDetails(roomId)
          .then((gd) => {
            setGroupPerm((prev) => ({
              ...(prev || {}),
              ownerId: gd.ownerId,
              members: (gd.members || []).map((m: any) => ({
                userId: m.userId,
                role: m.role,
              })),
              settings: (prev as any)?.settings ?? gd.settings,
            }));

            const gs = useGroupStore.getState();
            if (gs.currentGroupDetail && gs.currentGroupDetail.id === roomId) {
              gs.updateCurrentGroupDetail(gd as any);
            }
          })
          .catch(() => {});
      } catch {
        // ignore
      }
    };
    if (isGroupRoom) {
      webSocketService.subscribe(groupEventsTopic, onGroupEvent);
    }

    // Đóng panel info khi chuyển phòng

    // Check block status for DIRECT rooms
    if (!isGroupRoom && partner?.id) {
      friendService
        .checkBlockStatus(partner.id)
        .then((status) => setBlockStatus(status))
        .catch((err) => console.error("Failed to check block status:", err));
    }

    return () => {
      webSocketService.unsubscribe(chatTopic, onInboundMsg);
      webSocketService.unsubscribe(noticeDest, onInboundMsg);
      webSocketService.unsubscribe(recallTopic);
      webSocketService.unsubscribe(reactionTopic);
      webSocketService.unsubscribe(pinTopic);
      webSocketService.unsubscribe(settingsTopic, onSettingsChanged);
      if (isGroupRoom) webSocketService.unsubscribe(groupEventsTopic, onGroupEvent);
      webSocketService.unsubscribe(typingTopic, onTypingEvent);
      if (typingTopicActual) webSocketService.unsubscribe(typingTopicActual, onTypingEvent);
      webSocketService.unsubscribe(readTopic, onReadEvent);
      if (readTopicAlt) webSocketService.unsubscribe(readTopicAlt, onReadEvent);
      Object.values(typingTimersRef.current).forEach(clearTimeout);
      typingTimersRef.current = {};
      setCurrentRoom(null);
    };
  }, [roomId, currentRoom?.id, currentUserId, fetchHistory, addMessage, user?.fullName, user?.username, clearUnreadBanner, initialUnreadCount, firstUnreadMessage, isBannerDismissed]);


  // Load group detail once so permission UI works without mở panel info
  useEffect(() => {
    if (!roomId || !isGroupRoom) return;
    groupService
      .getGroupDetails(roomId)
      .then((gd) =>
        setGroupPerm({
          ownerId: gd.ownerId,
          members: (gd.members || []).map((m: any) => ({
            userId: m.userId,
            role: m.role,
          })),
          settings: gd.settings,
        }),
      )
      .catch(() => {
        // ignore: permission UI sẽ fallback không khóa nếu không có data
      });
  }, [roomId, isGroupRoom]);

  // Đồng bộ groupPerm khi currentGroupDetail (store) thay đổi realtime (vd: phong phó nhóm / chuyển trưởng nhóm)
  useEffect(() => {
    if (!roomId || !isGroupRoom) return;
    if (!currentGroupDetail || currentGroupDetail.id !== roomId) return;
    setGroupPerm((prev) => ({
      ...(prev || {}),
      ownerId: currentGroupDetail.ownerId,
      members: (currentGroupDetail.members || []).map((m: any) => ({
        userId: m.userId,
        role: m.role,
      })),
      // giữ settings từ prev nếu có WS update mới hơn; fallback lấy từ currentGroupDetail.settings
      settings: (prev as any)?.settings ?? (currentGroupDetail as any).settings,
    }));
  }, [currentGroupDetail, roomId, isGroupRoom]);

  // Fallback: nếu WS settings không về vì lý do nào đó, vẫn sync permissions không cần F5
  useEffect(() => {
    if (!roomId || !isGroupRoom) return;
    const tick = async () => {
      try {
        const s = await groupService.getGroupSettings(roomId);
        setGroupPerm((prev) => ({ ...(prev || {}), settings: s }));
      } catch {
        // ignore
      }
    };
    tick();
    const t = window.setInterval(tick, 3000);
    return () => window.clearInterval(t);
  }, [roomId, isGroupRoom]);

  useEffect(() => {
    if (!permToast) return;
    const t = window.setTimeout(() => setPermToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [permToast]);

  const myUserId = useAuthStore((s) => s.user?.id);
  const isOwnerOrAdmin =
    !!myUserId &&
    !!groupPerm &&
    (groupPerm.ownerId === myUserId ||
      (groupPerm.members || []).some(
        (m) => m.userId === myUserId && m.role === "ADMIN",
      ));

  const allowMemberSendMessage =
    groupPerm?.settings?.allowMemberSendMessage !== false;
  const allowMemberCreatePoll =
    groupPerm?.settings?.allowMemberCreatePoll !== false;
  const allowMemberPin = groupPerm?.settings?.allowMemberPin !== false;
  const canSendMessage =
    !isGroupRoom || allowMemberSendMessage || isOwnerOrAdmin;
  const canCreatePoll = !isGroupRoom || allowMemberCreatePoll || isOwnerOrAdmin;
  const canPinMessage = !isGroupRoom || allowMemberPin || isOwnerOrAdmin;

  // Auto-refresh block status when blockedUsers changes (block/unblock from any screen)
  useEffect(() => {
    if (!isGroupRoom && partner?.id) {
      friendService
        .checkBlockStatus(partner.id)
        .then((status) => setBlockStatus(status))
        .catch((err) => console.error("Failed to re-check block status:", err));
    }
  }, [blockedUsers, partner?.id, isGroupRoom]);

  // Realtime UI update when user blocks/unblocks (optimistic)
  useEffect(() => {
    if (isGroupRoom || !partner?.id || !blockSignal) return;
    if (blockSignal.userId !== partner.id) return;
    setBlockStatus((prev) => ({
      blockedByYou: blockSignal.blocked,
      blockedByOther: prev?.blockedByOther || false,
      blockerName: prev?.blockerName || null,
    }));
  }, [blockSignal, partner?.id, isGroupRoom]);

  const handleSend = async (text: string) => {
    if (!roomId || !text.trim()) return;
    const optimistic: Message = {
      id: `temp-${Date.now()}`,
      senderId: currentUserId,
      senderName: user?.fullName || user?.username || undefined,
      roomId,
      content: text,
      type: "TEXT",
      createdAt: new Date().toISOString(),
      replyToId: replyingTo?.id,
    };
    addMessage(roomId, optimistic);
    if (isGroupRoom) {
      const sentViaWs = webSocketService.sendChatMessage(
        roomId,
        text,
        "TEXT",
        replyingTo?.id,
      );
      if (!sentViaWs) {
        try {
          await chatService.sendMessage(roomId, text, replyingTo?.id);
          await fetchHistory();
        } catch (err: any) {
          console.error(
            "REST send failed:",
            err?.response?.status,
            err?.response?.data || err.message,
          );
        }
      }
    } else {
      // Chat 1-1: gửi qua REST để nhận phản hồi từ server (chặn tin người lạ) ngay lập tức.
      try {
        await chatService.sendMessage(roomId, text, replyingTo?.id);
        await fetchHistory();
      } catch (err: unknown) {
        if (isStrangerMessagesNotAllowedError(err)) {
          useChatStore
            .getState()
            .applyStrangerMessageRejection(
              roomId,
              "Thông báo: người này hiện không nhận tin từ người lạ",
            );
        } else {
          console.error(
            "REST send failed:",
            (err as any)?.response?.status,
            (err as any)?.response?.data || (err as any)?.message,
          );
        }
      }
    }
    setReplyingTo(null);

    // Stop typing immediately when message sent
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (isTypingRef.current && roomId) {
      isTypingRef.current = false;
      webSocketService.sendTyping({ roomId, isTyping: false });
    }
  };

  const handleSendFile = async (file: File) => {
    if (!roomId) return;
    const err = validateFileSize(file);
    if (err) {
      alert(err);
      return;
    }
    setIsSendingFile(true);
    try {
      // 1. Upload file to server
      const uploadResult = await MessageService.uploadFile(file);

      // 2. Determine type
      const mimeType = file.type.toLowerCase();
      let msgType: "IMAGE" | "VIDEO" | "VOICE" | "FILE" = "FILE";
      if (mimeType.startsWith("image/")) msgType = "IMAGE";
      else if (mimeType.startsWith("video/")) msgType = "VIDEO";
      else if (mimeType.startsWith("audio/")) msgType = "VOICE";

      const attachment = {
        url: uploadResult.fileUrl,
        type: uploadResult.fileType || file.type,
        filename: uploadResult.fileName || file.name,
        name: uploadResult.fileName || file.name,
        size: uploadResult.size || file.size,
      };

      // 3. Optimistic message
      const optimistic: Message = {
        id: `temp-${Date.now()}`,
        senderId: currentUserId,
        senderName: user?.fullName || user?.username || undefined,
        roomId,
        content: "", // Fix redundant text on mobile by sending empty content for file types, matching mobile behavior.
        type: msgType,
        createdAt: new Date().toISOString(),
        fileUrl: uploadResult.fileUrl,
        fileName: file.name,
        fileSize: file.size,
        attachments: [attachment],
        replyToId: replyingTo?.id,
      };
      addMessage(roomId, optimistic);

      if (isGroupRoom) {
        // 4. Send via WebSocket (group)
        const sentViaWs = webSocketService.sendChatMessage(
          roomId,
          "",
          msgType,
          replyingTo?.id,
          [attachment],
        );
        if (!sentViaWs) {
          await fetchHistory();
        }
      } else {
        // Chat 1-1: gửi qua REST để nhận phản hồi chặn tin người lạ.
        try {
          await chatService.sendMessage(roomId, "", replyingTo?.id, msgType, [
            attachment as any,
          ]);
          await fetchHistory();
        } catch (err2: unknown) {
          if (isStrangerMessagesNotAllowedError(err2)) {
            useChatStore
              .getState()
              .applyStrangerMessageRejection(
                roomId,
                "Thông báo: người này hiện không nhận tin từ người lạ",
              );
          } else {
            console.error(
              "REST send file failed:",
              (err2 as any)?.response?.status,
              (err2 as any)?.response?.data || (err2 as any)?.message,
            );
          }
        }
      }
      setReplyingTo(null);
    } catch (error) {
      console.error("Failed to send file:", error);
    } finally {
      setIsSendingFile(false);
    }
  };

  const handleTyping = (isTyping: boolean) => {
    // Ưu tiên dùng ID thực tế từ store (UUID) thay vì ID tạm (có thể là userId)
    const targetRoomId = currentRoom?.id || roomId;
    if (!targetRoomId) return;
    
    const sendStatus = (typing: boolean) => {
      if (isTypingRef.current === typing) return;
      isTypingRef.current = typing;
      webSocketService.sendTyping({ roomId: targetRoomId, isTyping: typing });
    };

    if (isTyping) {
      sendStatus(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        sendStatus(false);
      }, 3000);
    } else {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      sendStatus(false);
    }
  };

  const handleCall = async (type: CallType) => {
    if (!roomId) return;
    if (isCloudRoom) return;
    if (isGroupRoom) {
      setGroupCallType(type);
      setGroupCallInviteOpen(true);
      return;
    }
    const receiverId = partner?.id;

    if (!receiverId) {
      alert("Không tìm thấy thông tin người nhận để thực hiện cuộc gọi");
      return;
    }

    if (String(receiverId).toLowerCase() === String(currentUserId).toLowerCase()) {
      alert("Lỗi: Bạn không thể tự gọi cho chính mình.");
      return;
    }

    try {
      await initiateCall(roomId, receiverId, type, roomName, roomAvatar);
    } catch (error: any) {
      alert(error.response?.data?.message || "Không thể thực hiện cuộc gọi. Vui lòng thử lại sau.");
    }
  };

  const confirmGroupCall = async (receiverIds: string[]) => {
    try {
      setGroupCallInviteOpen(false);
      await initiateGroupCall(roomId, receiverIds, groupCallType);
    } catch (error: any) {
      alert(error?.response?.data?.message || "Không thể gọi nhóm. Vui lòng thử lại sau.");
    }
  };

  const handleRecall = async (messageId: string | string[]) => {
    if (!roomId) return;
    const ids = (Array.isArray(messageId) ? messageId : [messageId]).filter(
      Boolean,
    );
    if (ids.length === 0) return;
    const results = await Promise.allSettled(
      ids.map((id) => MessageService.recallMessage(roomId, id)),
    );
    const ok = new Set<string>();
    results.forEach((r, i) => {
      if (r.status === "fulfilled") ok.add(ids[i]);
    });
    if (ok.size === 0) {
      console.error("Failed to recall message(s)", results);
      return;
    }
    const currentMsgs = useChatStore.getState().messages[roomId] || [];
    const newMsgs = currentMsgs.map((m) =>
      ok.has(m.id)
        ? { ...m, isRecall: true, content: "[Tin nhắn đã thu hồi]" }
        : m,
    );
    setMessages(roomId, newMsgs);
  };

  const handleReact = (messageId: string, emoji: string) => {
    if (!roomId || !currentUserId) return;

    const currentMsgs = useChatStore.getState().messages[roomId] || [];
    const targetMsg = currentMsgs.find((m) => m.id === messageId);
    if (!targetMsg) return;

    // Luôn thêm reaction mới (cho phép stacking — không toggle)
    const reactions = Array.isArray(targetMsg.reactions)
      ? [...targetMsg.reactions]
      : [];
    const newMsgs = currentMsgs.map((m) => {
      if (m.id === messageId) {
        return {
          ...m,
          reactions: [...reactions, { userId: currentUserId, emoji }],
        };
      }
      return m;
    });
    setMessages(roomId, newMsgs);

    // Call API
    try {
      MessageService.setReaction(roomId, messageId, emoji);
    } catch (error) {
      console.error("Failed to set reaction", error);
      fetchHistory();
    }
  };

  const handleReply = (msg: Message) => {
    setReplyingTo(msg);
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
  };

  const handleForward = (msg: Message | Message[]) => {
    setForwardingMessages(Array.isArray(msg) ? msg : [msg]);
  };

  const handleSendFiles = async (files: File[]) => {
    if (!roomId || files.length === 0) return;
    for (const file of files) {
      const err = validateFileSize(file);
      if (err) {
        alert(err);
        return;
      }
    }
    setIsSendingFile(true);
    try {
      // 1. Parallel upload all files
      const uploadPromises = files.map((file) =>
        MessageService.uploadFile(file),
      );
      const uploadResults = await Promise.all(uploadPromises);

      // 2. Map results to attachments
      const attachments = uploadResults.map((res, i) => ({
        url: res.fileUrl,
        type: res.fileType || files[i].type,
        filename: res.fileName || files[i].name,
        name: res.fileName || files[i].name,
        size: res.size || files[i].size,
      }));

      // Determine message type based on contents
      const isAnyVideo = files.some((f) =>
        f.type.toLowerCase().startsWith("video/"),
      );
      const isAnyImage = files.some((f) =>
        f.type.toLowerCase().startsWith("image/"),
      );
      const isAnyAudio = files.some((f) =>
        f.type.toLowerCase().startsWith("audio/"),
      );
      const msgType: "IMAGE" | "VIDEO" | "VOICE" | "FILE" = isAnyAudio
        ? "VOICE"
        : isAnyVideo
        ? "VIDEO"
        : isAnyImage
          ? "IMAGE"
          : "FILE";

      // 3. Optimistic message
      const optimistic: Message = {
        id: `temp-${Date.now()}`,
        senderId: currentUserId,
        senderName: user?.fullName || user?.username || undefined,
        roomId,
        content: "",
        type: msgType,
        createdAt: new Date().toISOString(),
        attachments,
        replyToId: replyingTo?.id,
      };
      addMessage(roomId, optimistic);

      // 4. Send grouping message
      if (isGroupRoom) {
        const sentViaWs = webSocketService.sendChatMessage(
          roomId,
          "",
          msgType,
          replyingTo?.id,
          attachments,
        );
        if (!sentViaWs) {
          await fetchHistory();
        }
      } else {
        try {
          await chatService.sendMessage(
            roomId,
            "",
            replyingTo?.id,
            msgType,
            attachments as any,
          );
          await fetchHistory();
        } catch (err2: unknown) {
          if (isStrangerMessagesNotAllowedError(err2)) {
            useChatStore
              .getState()
              .applyStrangerMessageRejection(
                roomId,
                "Thông báo: người này hiện không nhận tin từ người lạ",
              );
          }
        }
      }
      setReplyingTo(null);
    } catch (error) {
      console.error("Failed to send multi-files:", error);
    } finally {
      setIsSendingFile(false);
    }
  };

  const handleTogglePin = (messageId: string, currentPinStatus: boolean) => {
    if (!roomId) return;
    if (!canPinMessage) {
      setPermToast("Chỉ trưởng nhóm và phó nhóm được ghim tin nhắn.");
      return;
    }

    // Lấy loại tin nhắn để backend biết hiển thị đúng trong thông báo ghim
    const currentMsgs = useChatStore.getState().messages[roomId] || [];
    const targetMsg = currentMsgs.find((m) => m.id === messageId);
    const msgType = targetMsg?.type || "TEXT";

    webSocketService.sendPin({
      roomId,
      messageId,
      pin: !currentPinStatus,
      messageType: msgType,
    });
    // Optimistic update trạng thái ghim
    const newMsgs = currentMsgs.map((m) =>
      m.id === messageId ? { ...m, pinned: !currentPinStatus } : m,
    );

    setMessages(roomId, newMsgs);
  };

  const handleRemoveAllReactions = async (messageId: string) => {
    if (!roomId || !currentUserId) return;
    const currentMsgs = useChatStore.getState().messages[roomId] || [];
    const newMsgs = currentMsgs.map((m) =>
      m.id === messageId
        ? {
          ...m,
          reactions: Array.isArray(m.reactions)
            ? m.reactions.filter((r) => r.userId !== currentUserId)
            : [],
        }
        : m,
    );
    setMessages(roomId, newMsgs);
    try {
      await MessageService.removeReaction(roomId, messageId);
    } catch (error) {
      console.error("Failed to remove all reactions", error);
      fetchHistory();
    }
  };

  const handleDeleteForMe = (messageId: string) => {
    if (!roomId) return;
    if (currentUserId) {
      try {
        const key = `DELETED_MESSAGES_${currentUserId}`;
        const raw = localStorage.getItem(key);
        let deletedIds = [];
        if (raw) {
          deletedIds = JSON.parse(raw);
          if (!Array.isArray(deletedIds)) {
            deletedIds = [];
          }
        }
        if (!deletedIds.includes(messageId)) {
          deletedIds.push(messageId);
          localStorage.setItem(key, JSON.stringify(deletedIds));
        }
      } catch (e) {
        console.error("Failed to save deleted message to localStorage", e);
      }
    }
    const currentMsgs = useChatStore.getState().messages[roomId] || [];
    const newMsgs = currentMsgs.filter((m) => m.id !== messageId);
    setMessages(roomId, newMsgs);
  };

  // Toggle info panel chung cho cả 2 loại phòng
  const handleToggleInfo = () => {
    if (isCloudRoom) return;
    if (isGroupRoom) {
      isGroupInfoOpen ? closeGroupInfo() : openGroupInfo();
    } else {
      setIsInfoOpen((v) => !v);
    }
  };

  const handleOpenSearch = () => {
    setIsInfoOpen(false);
    closeGroupInfo();
    setSearchOpen(true);
  };

  const infoOpen = isCloudRoom ? false : isGroupRoom ? isGroupInfoOpen : isInfoOpen;

  return (
    <div
      className="flex h-full overflow-hidden"
      style={{
        backgroundColor: "var(--bg-primary)",
        color: "var(--text-primary)",
        transition: "background-color 0.3s ease",
      }}
    >
      {/* ── Chat area ── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div
          className="h-16 flex items-center px-4 shrink-0 justify-between"
          style={{
            borderBottom: "1px solid var(--border-primary)",
            backgroundColor: "var(--bg-primary)",
            boxShadow: "var(--shadow-sm)",
            transition: "background-color 0.3s ease",
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            {isCloudRoom ? (
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                <span className="text-xl">☁️</span>
              </div>
            ) : (
              <Avatar src={roomAvatar} key={roomAvatar} />
            )}
            <div className="min-w-0 flex flex-col gap-0.5">
              <span
                className="font-bold text-base block truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {roomName}
              </span>
              {isStrangerEmptyThread && (
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="inline-flex items-center text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border"
                    style={{
                      color: "var(--text-muted)",
                      borderColor: "var(--border-primary)",
                      backgroundColor: "var(--bg-tertiary)",
                    }}
                  >
                    Người lạ
                  </span>
                  {friendRequestStatus === "NONE" && (
                    <button
                      type="button"
                      onClick={() => setFriendInviteOpen(true)}
                      className="text-xs font-semibold px-3 py-1 rounded-full text-white bg-[#0068ff] hover:bg-[#0056d6] transition-colors"
                    >
                      Kết bạn
                    </button>
                  )}
                  {friendRequestStatus === "SENT" && (
                    <span
                      className="text-[11px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Đã gửi lời mời
                    </span>
                  )}
                  {friendRequestStatus === "INCOMING" && (
                    <button
                      type="button"
                      onClick={() => void handleAcceptIncomingFriend()}
                      className="text-xs font-semibold px-3 py-1 rounded-full border border-emerald-500 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                    >
                      Chấp nhận kết bạn
                    </button>
                  )}
                </div>
              )}
              {isGroupRoom && currentRoom && (
                <span
                  className="text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  {(currentGroupDetail?.id === roomId
                    ? currentGroupDetail.members.length
                    : currentRoom.participants?.length) || 0}{" "}
                  thành viên
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {/* AI Summary Button */}
            <button
              onClick={() => setIsAiOptionsOpen(true)}
              title="Trợ lý AI Gemini"
              className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${
                isAiOptionsOpen
                  ? "bg-purple-100 text-purple-600"
                  : "hover:bg-purple-50 text-purple-500"
              }`}
            >
              <Sparkles className="w-5 h-5 fill-current" />
            </button>
            {isCloudRoom ? null : (
              <>
                <button
                  onClick={() => void handleCall("VOICE")}
                  title="Cuộc gọi thoại"
                  className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[color:var(--bg-secondary)] text-[color:var(--text-secondary)] transition-colors"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                    />
                  </svg>
                </button>
                <button
                  onClick={() => void handleCall("VIDEO")}
                  title="Cuộc gọi video"
                  className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[color:var(--bg-secondary)] text-[color:var(--text-secondary)] transition-colors"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                </button>
              </>
            )}
            <button
              onClick={handleOpenSearch}
              title="Tìm kiếm tin nhắn"
              className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${searchOpen
                ? "bg-blue-100 text-blue-600"
                : "hover:bg-[color:var(--bg-secondary)] text-[color:var(--text-secondary)]"
                }`}
            >
              <Ionicons name="search-outline" size={20} className="text-[color:var(--text-secondary)]" />
            </button>
            {/* Cloud: mở Options theo UI My Documents */}
            {isCloudRoom ? (
              <button
                onClick={() => setCloudOptionsOpen(true)}
                title="Tùy chọn Cloud"
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[color:var(--bg-secondary)] text-[color:var(--text-secondary)] transition-colors"
              >
                <Ionicons name="settings-outline" size={20} />
              </button>
            ) : null}
            {/* Nút thông tin — không hiện trong Cloud */}
            {isCloudRoom ? null : (
              <button
                onClick={handleToggleInfo}
                title="Thông tin hội thoại"
                className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${infoOpen
                  ? "bg-blue-100 text-blue-600"
                  : "hover:bg-[color:var(--bg-secondary)] text-[color:var(--text-secondary)]"
                  }`}
              >
                <Ionicons name="information-circle-outline" size={20} />
              </button>
            )}
          </div>
        </div>

        {pinnedMessagesSorted.length > 0 && (
          <PinnedMessagesBar
            roomId={roomId}
            pinnedMessagesSorted={pinnedMessagesSorted}
            participantMap={participantMap}
            scrollToMessageHighlight={scrollToMessageHighlight}
            handleTogglePin={handleTogglePin}
            isGroupRoom={isGroupRoom}
            onOpenGroupInfo={isGroupRoom ? openGroupInfo : undefined}
          />
        )}

        {/* Messages + Input */}
        <Box
          className="flex-1 overflow-hidden flex flex-col relative"
          style={{
            backgroundColor: "var(--bg-chat-messages)",
            backgroundImage: roomWallpaper ? `linear-gradient(rgba(255,255,255,0.82), rgba(255,255,255,0.82)), url("${roomWallpaper}")` : undefined,
            backgroundSize: roomWallpaper ? "cover" : undefined,
            backgroundPosition: roomWallpaper ? "center" : undefined,
            transition: "background-color 0.3s ease",
          }}
        >
          {/* Unread Banner: show when there are enough unreads to likely be off-screen (>= 10) */}
          {(!isBannerDismissed && (initialUnreadCount + sessionUnreadCount >= 10)) && (
              <div 
                  className="absolute top-4 left-0 right-0 z-[1000] flex justify-center animate-in slide-in-from-top-4 duration-300 pointer-events-none"
              >
                  <div className="flex items-center bg-blue-600 text-white rounded-full shadow-2xl overflow-hidden border border-blue-400/30 backdrop-blur-sm pointer-events-auto">
                      <button 
                          onClick={handleJumpToOldestUnread}
                          className="flex items-center gap-2 px-5 py-2 hover:bg-blue-700 transition-colors border-r border-blue-500/50"
                      >
                          <ArrowUp className="w-4 h-4" />
                          <span className="text-sm font-bold">
                              Quay lại {initialUnreadCount + sessionUnreadCount || 1} tin chưa đọc
                          </span>
                      </button>
                      <button 
                          onClick={() => {
                            if (firstUnreadMessage?.createdAt) {
                              setUnreadAiDates({ 
                                  start: firstUnreadMessage.createdAt, 
                                  end: new Date().toISOString() 
                              });
                            }
                            setUnreadAiCount(initialUnreadCount + sessionUnreadCount);
                            setShowUnreadAiModal(true);
                            clearUnreadBanner();
                          }}
                          className="flex items-center gap-2 px-4 py-2 hover:bg-blue-700 transition-colors border-r border-blue-500/50 text-yellow-300"
                      >
                          <Sparkles className="w-4 h-4 fill-yellow-300/20" />
                          <span className="text-sm font-bold">AI</span>
                      </button>
                      <button 
                          onClick={clearUnreadBanner}
                          className="p-2 hover:bg-blue-700 transition-colors"
                      >
                          <X className="w-4 h-4" />
                      </button>
                  </div>
              </div>
          )}

          <MessageList
            roomId={roomId}
            messages={messagesState}
            currentUserId={currentUserId}
            participants={currentRoom?.participants || []}
            isGroup={isGroupRoom}
            onRecall={handleRecall}
            onReact={handleReact}
            onReply={handleReply}
            onTogglePin={handleTogglePin}
            onRemoveAllReactions={handleRemoveAllReactions}
            onDeleteForMe={handleDeleteForMe}
            onForward={handleForward}
            onLoadOlder={loadMoreHistory}
            hasMoreOlder={historyHasMore}
            loadingOlder={loadingOlder}
            onShowUnreadAi={(start, end) => {
              setUnreadAiDates({ start, end });
              setShowUnreadAiModal(true);
            }}
            externalFirstUnread={firstUnreadMessage}
            externalUnreadCount={initialUnreadCount + sessionUnreadCount}
            onScrollStatusChange={(atBottom) => {
              isAtBottomRef.current = atBottom;
              if (atBottom) {
                // Only clear session unread count when reaching bottom
                setSessionUnreadCount(0);
                // initialUnreadCount stays until the user jumps or closes the banner
              }
            }}
            jumpSignal={jumpSignal}
          />

          {/* Blocked chat overlay / nhóm đã giải tán */}
          {isBlocked ? (
            <div className="border-t border-[color:var(--border-primary)] bg-[color:var(--bg-hover)]">
              {blockStatus?.blockedByYou ? (
                <div className="flex flex-col items-center justify-center py-6 px-4 gap-3">
                  <div className="flex items-center gap-2 text-[color:var(--text-secondary)]">
                    <svg
                      className="w-5 h-5 text-red-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                      />
                    </svg>
                    <span className="text-sm font-medium">
                      Bạn đã chặn liên hệ này
                    </span>
                  </div>
                  <button
                    onClick={async () => {
                      if (partner?.id) {
                        try {
                          await useFriendStore
                            .getState()
                            .unblockUser(partner.id);
                          setBlockStatus({
                            blockedByYou: false,
                            blockedByOther: false,
                            blockerName: null,
                          });
                        } catch {
                          // error in store
                        }
                      }
                    }}
                    className="px-5 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-full transition-colors"
                  >
                    Bỏ chặn
                  </button>
                </div>
              ) : blockStatus?.blockedByOther ? (
                <div className="flex items-center justify-center py-6 px-4 gap-2 text-[color:var(--text-secondary)]">
                  <svg
                    className="w-5 h-5 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                    />
                  </svg>
                  <span className="text-sm font-medium">
                    {blockStatus.blockerName || roomName} đã chặn tin nhắn
                  </span>
                </div>
              ) : null}
            </div>
          ) : isGroupDisbanded ? (
            <div className="border-t border-[color:var(--border-primary)] bg-[color:var(--bg-hover)] flex flex-col items-center justify-center py-6 px-4 gap-2">
              <span className="text-sm text-[color:var(--text-secondary)] text-center">
                Nhóm đã được giải tán. Bạn không thể gửi tin nhắn vào nhóm này
                nữa.
              </span>
              <button
                type="button"
                className="text-sm font-semibold text-blue-500 hover:text-blue-600 hover:underline"
                onClick={async () => {
                  await deleteRoom(roomId);
                  setCurrentRoom(null);
                }}
              >
                Xóa trò chuyện
              </button>
            </div>
          ) : isGroupRoom && !canSendMessage ? (
            <div className="border-t border-[color:var(--border-primary)] bg-[color:var(--bg-hover)] flex flex-col items-center justify-center py-6 px-4 gap-2">
              <span className="text-sm text-[color:var(--text-secondary)] text-center">
                Chỉ có trưởng nhóm và phó nhóm được phép gửi tin nhắn.
              </span>
            </div>
          ) : (
            <div className="flex flex-col border-t" style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-primary)" }}>
              {/* Typing Indicator - Dính liền ngay trên MessageInput */}
              {Object.keys(typingUsers).length > 0 && (
                <div className="px-4 py-1.5 flex items-center gap-2 bg-gray-50/50 border-b border-gray-50 transition-all">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></span>
                  </div>
                  <span className="text-[11px] font-semibold text-blue-600 italic">
                    {(() => {
                      const names = Object.values(typingUsers);
                      if (names.length === 1) return `${names[0]} đang soạn tin...`;
                      if (names.length === 2) return `${names[0]} và ${names[1]} đang soạn tin...`;
                      return `${names.slice(0, 2).join(", ")} và ${names.length - 2} người khác đang soạn tin...`;
                    })()}
                  </span>
                </div>
              )}
              <MessageInput
                onSend={handleSend}
                onSendFile={handleSendFile}
                onSendFiles={handleSendFiles}
                onSendLike={() => handleSend("👍")}
                onTyping={handleTyping}
                replyingTo={replyingTo}
                onCancelReply={handleCancelReply}
                isSendingFile={isSendingFile}
                onCreatePoll={
                  isGroupRoom
                    ? () => {
                        if (!canCreatePoll) {
                          setPermToast(
                            "Chỉ có trưởng nhóm và phó nhóm được phép tạo bình chọn.",
                          );
                          return;
                        }
                        setShowCreatePoll(true);
                      }
                    : undefined
                }
              />
            </div>
          )}
        </Box>
      </div>

      {permToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[99999] px-4 pointer-events-none">
          <div className="rounded-full px-4 py-2 text-sm shadow-lg border bg-gray-900 text-white">
            {permToast}
          </div>
        </div>
      )}

      {searchOpen && currentRoom && (
        <SearchMessagePanel
          roomId={roomId}
          roomName={roomName}
          participants={currentRoom.participants || []}
          onSelectMessage={handleSelectSearchMessage}
          onClose={() => setSearchOpen(false)}
        />
      )}

      {/* ── Info Panel bên phải — slide-in từ phải ── */}
      <div
        style={{
          width: infoOpen ? 300 : 0,
          minWidth: 0,
          overflowX: "hidden",
          overflowY: "visible",
          transition: "width 260ms cubic-bezier(0.4,0,0.2,1)",
          flexShrink: 0,
          position: "relative",
        }}
      >
        <div
          style={{
            width: 300,
            height: "100%",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {isGroupRoom && currentRoom && (
            <GroupInfoPanel roomId={roomId} onClose={closeGroupInfo} />
          )}
          {!isGroupRoom && !isCloudRoom && currentRoom && (
            <DirectChatInfoPanel
              room={currentRoom}
              partner={partner}
              onClose={() => setIsInfoOpen(false)}
            />
          )}
        </div>
      </div>

      {/* Add Members Modal (chỉ nhóm) */}
      {isGroupRoom && <AddMembersModal roomId={roomId} />}

      <GroupCallInviteModal
        open={groupCallInviteOpen}
        title={groupCallType === "VIDEO" ? "Gọi video nhóm" : "Gọi thoại nhóm"}
        members={(currentRoom?.participants || []) as any}
        myUserId={currentUserId}
        onClose={() => setGroupCallInviteOpen(false)}
        onConfirm={confirmGroupCall}
      />

      {/* Forward Message Modal */}
      {forwardingMessages && (
        <ForwardMessageModal
          messages={forwardingMessages}
          currentRoomId={roomId}
          onClose={() => setForwardingMessages(null)}
        />
      )}

      {/* Create Poll Modal */}
      {showCreatePoll && (
        <CreatePollModal
          roomId={roomId}
          onClose={() => setShowCreatePoll(false)}
          onSuccess={() => fetchHistory()}
        />
      )}

      {partner && (
        <SendFriendRequestModalWeb
          open={friendInviteOpen}
          target={{
            id: partner.id,
            displayName: partner.fullName || partner.username || roomName,
            avatarUrl: partner.avatarUrl ?? null,
            coverPhotoUrl: null,
          }}
          currentDisplayName={user?.fullName || user?.username || "Bạn"}
          variant="chat_window"
          onClose={() => setFriendInviteOpen(false)}
          onOpenProfile={() => {
            setFriendInviteOpen(false);
            setIsInfoOpen(true);
          }}
          onConfirmSend={async (message, opts) => {
            await sendFriendInvite(partner.id, {
              inviteMessage: message,
              inviteSource: "WEB_CHAT",
              hideMyTimelineFromFriend: opts.hideMyTimelineFromFriend,
            });
            await fetchSentRequests();
          }}
        />
      )}

      <CloudOptionsModal
        open={cloudOptionsOpen}
        onClose={() => setCloudOptionsOpen(false)}
        roomId={isCloudRoom ? roomId : null}
      />

      {isAiSummaryOpen && (
        <AiSummaryModal
          roomId={roomId}
          onClose={() => setIsAiSummaryOpen(false)}
        />
      )}

      {isAiOptionsOpen && (
        <AiOptionsModal
          onClose={() => setIsAiOptionsOpen(false)}
          onSelectSummarize={() => setIsAiSummaryOpen(true)}
          onSelectPersona={() => setIsAiPersonaOpen(true)}
          onSelectTask={(mode) => {
            setAiTaskMode(mode);
            setIsAiTaskOpen(true);
          }}
        />
      )}

      {isAiPersonaOpen && (
        <AiPersonaBotModalWeb
          onClose={() => setIsAiPersonaOpen(false)}
        />
      )}

      {isAiTaskOpen && (
        <AiTaskModalWeb
          mode={aiTaskMode}
          roomId={roomId}
          onClose={() => setIsAiTaskOpen(false)}
        />
      )}

      {showUnreadAiModal && (
        <UnreadAiSummaryModal
          roomId={roomId}
          unreadCount={unreadAiCount || 1}
          initialStartDate={unreadAiDates.start}
          initialEndDate={unreadAiDates.end}
          onClose={() => setShowUnreadAiModal(false)}
        />
      )}
    </div>
  );
};

export default ChatWindow;
