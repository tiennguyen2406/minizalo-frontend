import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import {
  View,
  FlatList,
  Text,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  Modal,
  TouchableOpacity,
  Alert,
  Image,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Pressable,
  useColorScheme,
} from "react-native";
import { useRoute, useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";
import ChatHeader from "../components/ChatHeader";
import StrangerProfilePreviewCard from "../components/StrangerProfilePreviewCard";
import ChatFooter, { ChatFooterHandle } from "../components/ChatFooter";
import MessageBubble from "../components/MessageBubble";
import {
  chatService,
  MessageDynamo,
  MessageReaction,
} from "@/shared/services/chatService";
import { groupService } from "@/shared/services/groupService";
import { MessageService } from "@/shared/services/MessageService";
import { webSocketService } from "@/shared/services/WebSocketService";
import { useUserStore } from "@/shared/store/userStore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getImageUrl } from "@/shared/utils/mediaUtils";
import { formatTime } from "@/shared/utils/dateUtils";
import {
  buildMobileChatRows,
  type MobileChatRow,
} from "@/shared/utils/mobileChatRows";
import {
  buildChatGalleryItems,
  findChatGalleryIndex,
} from "@/shared/utils/chatGallery";
import { getChatWallpaperUri } from "@/shared/utils/chatWallpaper";
import { dedupCallMessages } from "@/shared/utils/dedupCallMessages";
import { Video, ResizeMode } from "expo-av";
import GroupInfoScreen from "../components/GroupInfoScreen";
import ChatOptionsScreen from "./ChatOptionsScreen";
import { useChatStore } from "@/shared/store/useChatStore";
import { useFriendStore } from "@/shared/store/friendStore";
import friendService from "@/shared/services/friendService";
import { userService } from "@/shared/services/userService";
import type { UserProfile } from "@/shared/services/types";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/shared/theme/colors";
import { useThemeStore } from "@/shared/store/themeStore";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system/legacy";
import AiSummaryModal from "../components/AiSummaryModal";
import AiOptionsBottomSheet from "../components/AiOptionsBottomSheet";
import UnreadAiSummaryModal from "../components/UnreadAiSummaryModal";
import AiPersonaBotModal from "../components/AiPersonaBotModal";
import AiTaskModal, { AiTaskMode } from "../components/AiTaskModal";
import ReadReceiptModal from "../components/ReadReceiptModal";
const {
  documentDirectory,
  cacheDirectory,
  downloadAsync,
  readAsStringAsync,
  EncodingType,
} = FileSystem;
import { useAuthStore } from "@/shared/store/authStore";
import { validateFileSize } from "@/shared/constants";
import {
  formatStrangerPrivacyRejectionMessage,
  isStrangerMessagesNotAllowedError,
} from "@/shared/utils/chatErrors";
import { useLocalSearchParams } from "expo-router";
import type { GroupDetail, GroupSettings } from "@/shared/types";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;

// ─── Upload helpers ───────────────────────────────────────────────────────────
function uploadFileWithXHR(
  url: string,
  formData: FormData,
  token: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    if (onProgress) {
      xhr.upload.onprogress = (e: ProgressEvent) => {
        if (e.lengthComputable) onProgress(e.loaded, e.total);
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error("Invalid JSON response"));
        }
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.ontimeout = () => reject(new Error("Upload timed out"));
    xhr.send(formData);
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
// ─────────────────────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const footerRef = useRef<ChatFooterHandle>(null);
  const isFocused = useIsFocused();
  const colors = useThemeColors();
  const theme = useThemeStore((s) => s.theme);
  const route = useRoute<any>();
  const router = useRouter();
  const {
    id,
    name,
    type,
    targetUserId,
    isStranger: isStrangerParam,
    avatarUrl: avatarUrlParam,
    showWelcomeTemplates,
  } = (route.params || {}) as any;
  const [activeRoomId, setActiveRoomId] = useState<string | null>(
    typeof id === "string" && id !== "new" ? id : null,
  );
  
  // Read receipt state
  const [selectedReceiptMsg, setSelectedReceiptMsg] = useState<MessageDynamo | null>(null);
  const roomId = activeRoomId || "";
  const displayName = typeof name === "string" ? name : "Người dùng";
  const roomType = type === "GROUP" ? "GROUP" : "DIRECT";

  const currentUserId = useUserStore((s) => s.profile?.id);
  const rooms = useChatStore((s) => s.rooms);
  const unblockUser = useFriendStore((s) => s.unblockUser);
  const blockedUsers = useFriendStore((s) => s.blockedUsers);
  const {
    friends,
    requests,
    sentRequests,
    fetchRequests,
    fetchSentRequests,
    fetchFriends,
  } = useFriendStore();
  const avatarUrl = typeof avatarUrlParam === "string" ? avatarUrlParam : "";
  const partnerAvatar = avatarUrl || "";
  const targetUserIdStr =
    typeof targetUserId === "string" ? targetUserId : null;
  const inferredTargetUserId = useMemo(() => {
    if (roomType !== "DIRECT") return null;
    const room = rooms.find((r) => r.id === roomId || r.id === id);
    const partner = room?.participants?.find(
      (p: any) => p.id !== currentUserId,
    );
    return partner?.id ?? null;
  }, [roomType, rooms, roomId, id, currentUserId]);
  const resolvedTargetUserId = targetUserIdStr || inferredTargetUserId;

  // Tính toán isStranger dựa trên kiểm tra trong danh sách bạn bè (Source of truth)
  const isStranger = useMemo(() => {
    // Nếu là GROUP thì không là người lạ (theo logic App hiện tại)
    if (roomType === "GROUP") return false;

    // Luôn kiểm tra trong store trước nếu có targetUserId (param hoặc suy luận từ participants)
    if (resolvedTargetUserId) {
      const isFriend = friends.some((f: any) => {
        // f.id is the relationship ID, NOT a user ID — skip it
        const uid = f?.user?.id;
        const fid = f?.friend?.id;
        return uid === resolvedTargetUserId || fid === resolvedTargetUserId;
      });
      return !isFriend;
    }

    // Fallback về param nếu chưa có targetUserId trong store
    if (isStrangerParam === "true" || isStrangerParam === true) return true;

    return false;
  }, [isStrangerParam, resolvedTargetUserId, friends, roomType]);

  const friendRequestStatus = useMemo(() => {
    if (!resolvedTargetUserId) return "NONE";
    const isSent = sentRequests.some((r: any) => {
      const id = r?.friend?.id || r?.friendId || r?.user?.id;
      return id === resolvedTargetUserId;
    });
    if (isSent) return "SENT";
    const isReceived = requests.some((r: any) => {
      const id = r?.user?.id || r?.userId || r?.friend?.id;
      return id === resolvedTargetUserId;
    });
    if (isReceived) return "INCOMING";
    return "NONE";
  }, [resolvedTargetUserId, sentRequests, requests]);

  const [messages, setMessages] = useState<
    (MessageDynamo & { isError?: boolean })[]
  >([]);
  const messagesRef = useRef<(MessageDynamo & { isError?: boolean })[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  /** Gom các tin IMAGE liên tiếp (web gửi từng ảnh một) để hiển thị một cụm giống web */
  // Dedup call message: session đã end → ẩn bubble STARTED, chỉ giữ bubble kết thúc.
  const visibleMessages = useMemo(() => {
    const visible = messages.filter((m) => !(m as any).isOnlyPinned);
    return dedupCallMessages(visible);
  }, [messages]);
  const chatRows = useMemo(() => buildMobileChatRows(visibleMessages), [visibleMessages]);
  const [partnerProfileDetail, setPartnerProfileDetail] =
    useState<UserProfile | null>(null);

  const [sending, setSending] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<any | null>(
    null,
  );
  const [loaded, setLoaded] = useState(false);

  const [initialUnreadCount, setInitialUnreadCount] = useState(0);
  const [firstUnreadMessage, setFirstUnreadMessage] = useState<MessageDynamo | null>(null);
  const [showUnreadAiModal, setShowUnreadAiModal] = useState(false);
  const [aiSummaryDates, setAiSummaryDates] = useState<{ start?: Date; end?: Date }>({});

  useEffect(() => {
    if (activeRoomId) {
      const room = rooms.find((r) => String(r.id) === String(activeRoomId));

      // 1. Chỉ chạy logic init unread Banner MỘT LẦN duy nhất khi vào phòng
      if (lastInitRoomIdRef.current !== activeRoomId) {
        lastInitRoomIdRef.current = String(activeRoomId);

        if (room && (room.unreadCount || 0) < 10) {
          useChatStore.getState().markRoomAsRead(String(activeRoomId));
          if (messages.length > 0) {
            const newest = messages[messages.length - 1];
            if (newest && newest.messageId && newest.senderId !== currentUserId) {
              webSocketService.sendReadReceipt({
                roomId: String(activeRoomId),
                messageId: newest.messageId,
              });
            }
          }
        }

        if (room && room.unreadCount && room.unreadCount >= 10) {
          setInitialUnreadCount(room.unreadCount);
          chatService.getOldestUnreadMessage(String(activeRoomId)).then(msg => {
            if (msg) setFirstUnreadMessage(msg);
          }).catch(() => { });
        }
      }
    } else {
      lastInitRoomIdRef.current = null;
    }
  }, [activeRoomId, messages.length, currentUserId, rooms]);

  // 2. Logic Timer 10 giây riêng biệt, đảm bảo bền bỉ không bị reset
  useEffect(() => {
    if (initialUnreadCount > 0 && activeRoomId && initTimerSetRef.current !== activeRoomId) {
      initTimerSetRef.current = activeRoomId;
      const timer = setTimeout(() => {
        setInitialUnreadCount(0);
      }, 10000); // 10 giây
      return () => clearTimeout(timer);
    }
    if (!activeRoomId) {
      initTimerSetRef.current = null;
    }
  }, [activeRoomId, initialUnreadCount > 0]);

  useEffect(() => {
    if (activeRoomId) {
      useChatStore.getState().setCurrentRoom(activeRoomId);
    }
    return () => {
      useChatStore.getState().setCurrentRoom(null);
      // Xóa highlight khi thoát phòng để không bị cuộn lại khi vào lại
      useChatStore.getState().setHighlightedMessageId(null);
    };
  }, [activeRoomId]);

  const flatListRef = useRef<FlatList>(null);
  const galleryRef = useRef<FlatList>(null);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const [galleryCurrentIndex, setGalleryCurrentIndex] = useState(0);

  const galleryViewabilityConfig = useRef({
    itemVisiblePercentThreshold: 55,
    minimumViewTime: 48,
  }).current;

  const onGalleryViewableItemsChanged = useCallback(
    (info: { viewableItems: Array<{ index: number | null }> }) => {
      const ix = info.viewableItems[0]?.index;
      if (typeof ix === "number" && ix >= 0) {
        setGalleryCurrentIndex(ix);
      }
    },
    [],
  );

  const [selectedMessage, setSelectedMessage] = useState<MessageDynamo | null>(
    null,
  );
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showPinnedList, setShowPinnedList] = useState(false);
  const [reactionListMessage, setReactionListMessage] =
    useState<MessageDynamo | null>(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [showAiMenu, setShowAiMenu] = useState(false);
  const [showAiPersonaModal, setShowAiPersonaModal] = useState(false);
  const [showAiTaskModal, setShowAiTaskModal] = useState(false);
  const [aiTaskMode, setAiTaskMode] = useState<AiTaskMode>("translate");
  const [forwardingMessage, setForwardingMessage] =
    useState<MessageDynamo | null>(null);
  const [forwardLoading, setForwardLoading] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [forwardSearch, setForwardSearch] = useState("");
  const [selectedForwardRooms, setSelectedForwardRooms] = useState<Set<string>>(
    new Set(),
  );
  const [replyTo, setReplyTo] = useState<{
    messageId: string;
    senderName?: string;
    content: string;
  } | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const typingTimerRefs = useRef<Record<string, NodeJS.Timeout>>({});

  // Dùng Refs cho phân trang và trạng thái
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(true);
  const lastKeyRef = useRef<string | null>(null);
  const isAtBottomRef = useRef(true);
  const lastReadMessageIdRef = useRef<string | null>(null);
  const lastInitRoomIdRef = useRef<string | null>(null);
  const initTimerSetRef = useRef<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // ─── Đánh dấu đã đọc dựa trên tầm mắt ──────────────────────────────────────
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 40,
    minimumViewTime: 100,
  }).current;

  const onViewableItemsChangedHandler = useRef((info: { viewableItems: any[] }) => {
    if (!info.viewableItems || info.viewableItems.length === 0) return;

    const uid = useUserStore.getState().profile?.id;
    if (!uid) return;

    let newestVisibleMsg: MessageDynamo | null = null;

    for (const v of info.viewableItems) {
      const row = v.item as MobileChatRow;
      if (row.kind === 'message') {
        const m = row.message;
        if (m.senderId !== uid && m.senderId !== 'system' && !m.messageId?.startsWith('temp-')) {
          if (!newestVisibleMsg || (m.createdAt > newestVisibleMsg.createdAt)) {
            newestVisibleMsg = m;
          }
        }
      } else if (row.kind === 'imageGroup') {
        for (const m of row.messages) {
          if (m.senderId !== uid && !m.messageId?.startsWith('temp-')) {
            if (!newestVisibleMsg || (m.createdAt > newestVisibleMsg.createdAt)) {
              newestVisibleMsg = m;
            }
          }
        }
      }
    }

    if (newestVisibleMsg && newestVisibleMsg.messageId !== lastReadMessageIdRef.current) {
      const readBy = newestVisibleMsg.readBy || [];
      if (!readBy.includes(uid)) {
        lastReadMessageIdRef.current = newestVisibleMsg.messageId!;
        webSocketService.sendReadReceipt({
          roomId: useChatStore.getState().currentRoomId || "",
          messageId: newestVisibleMsg.messageId!,
        });
        useChatStore.getState().markRoomAsRead(useChatStore.getState().currentRoomId || "");
      }
    }

    // Kiểm tra xem đã cuộn tới tin nhắn chưa đọc cũ nhất chưa để ẩn Banner
    if (initialUnreadCount > 0 && firstUnreadMessage) {
      const fumid = firstUnreadMessage.messageId;
      const isFirstUnreadVisible = info.viewableItems.some(v => {
        const row = v.item as MobileChatRow;
        if (row.kind === 'message') return row.message.messageId === fumid;
        if (row.kind === 'imageGroup') return row.messages.some(m => m.messageId === fumid);
        return false;
      });
      if (isFirstUnreadVisible) {
        setInitialUnreadCount(0);
      }
    }
  }).current;

  const openGroupInfo = () => {
    router.push({
      pathname: "/group-info",
      params: {
        roomId,
      },
    });
  };

  const openChatOptions = () => {
    const avatarUrl =
      useChatStore.getState().rooms.find((r) => r.id === roomId)?.avatarUrl ||
      "";
    router.push({
      pathname: "/chat-options",
      params: {
        roomId,
        name: displayName,
        avatarUrl,
        partnerId: partnerId ?? "",
        type: roomType,
      },
    });
  };

  const [blockStatus, setBlockStatus] = useState<{
    blockedByYou: boolean;
    blockedByOther: boolean;
    blockerName: string | null;
  } | null>(null);

  const partnerId = useMemo(() => {
    if (roomType !== "DIRECT" || !roomId) return null;
    const room = rooms.find((r) => r.id === roomId);
    const participants = room?.participants || [];
    const partner = participants.find((p: any) => p.id !== currentUserId);
    return partner?.id ?? null;
  }, [rooms, roomId, roomType, currentUserId]);

  const currentChatRoomMeta = useMemo(
    () => rooms.find((r) => r.id === roomId),
    [rooms, roomId],
  );
  const isGroupDisbanded =
    roomType === "GROUP" && !!currentChatRoomMeta?.disbanded;

  const [groupJoinPendingBadge, setGroupJoinPendingBadge] = useState(false);
  const refreshGroupJoinBadge = useCallback(async () => {
    if (roomType !== "GROUP" || !roomId) {
      setGroupJoinPendingBadge(false);
      return;
    }
    try {
      const g = await groupService.getGroupDetails(roomId);
      setGroupJoinPendingBadge((g.pendingJoinRequestCount ?? 0) > 0);
    } catch {
      setGroupJoinPendingBadge(false);
    }
  }, [roomType, roomId]);

  useEffect(() => {
    void refreshGroupJoinBadge();
  }, [refreshGroupJoinBadge]);

  useEffect(() => {
    if (!isFocused) return;
    void refreshGroupJoinBadge();
  }, [isFocused, refreshGroupJoinBadge]);

  // ─── Đồng bộ quyền nhóm (web bật/tắt → mobile áp dụng) ─────────────────────
  const [groupDetail, setGroupDetail] = useState<GroupDetail | null>(null);
  const [groupSettings, setGroupSettings] = useState<GroupSettings | null>(null);

  const refreshGroupPermissions = useCallback(async () => {
    if (roomType !== "GROUP" || !roomId) {
      setGroupDetail(null);
      setGroupSettings(null);
      return;
    }
    try {
      const g = await groupService.getGroupDetails(roomId);
      setGroupDetail(g);
      if (g?.settings) setGroupSettings(g.settings as GroupSettings);
      else {
        const s = await groupService.getGroupSettings(roomId);
        setGroupSettings(s);
      }
    } catch {
      /* giữ trạng thái cũ nếu lỗi mạng */
    }
  }, [roomType, roomId]);

  useEffect(() => {
    void refreshGroupPermissions();
  }, [refreshGroupPermissions]);

  useEffect(() => {
    if (!isFocused) return;
    if (roomType !== "GROUP" || !roomId) return;
    const t = setInterval(() => {
      void refreshGroupPermissions();
    }, 2000);
    return () => clearInterval(t);
  }, [isFocused, roomType, roomId, refreshGroupPermissions]);

  const isGroupOwnerOrAdmin = useMemo(() => {
    if (roomType !== "GROUP") return true;
    if (!currentUserId) return false;
    const ownerId = groupDetail?.ownerId;
    if (ownerId && String(ownerId) === String(currentUserId)) return true;
    const role = groupDetail?.members?.find(
      (m) => String(m.userId) === String(currentUserId),
    )?.role;
    return role === "ADMIN";
  }, [roomType, currentUserId, groupDetail]);

  const canSendMessage = useMemo(() => {
    if (roomType !== "GROUP") return true;
    if (isGroupDisbanded) return false;
    if (isGroupOwnerOrAdmin) return true;
    return groupSettings?.allowMemberSendMessage ?? true;
  }, [roomType, isGroupDisbanded, isGroupOwnerOrAdmin, groupSettings]);

  const canCreatePoll = useMemo(() => {
    if (roomType !== "GROUP") return false;
    if (isGroupOwnerOrAdmin) return true;
    return groupSettings?.allowMemberCreatePoll ?? true;
  }, [roomType, isGroupOwnerOrAdmin, groupSettings]);

  const canPinMessage = useMemo(() => {
    if (roomType !== "GROUP") return true;
    if (isGroupOwnerOrAdmin) return true;
    return groupSettings?.allowMemberPin ?? true;
  }, [roomType, isGroupOwnerOrAdmin, groupSettings]);

  // ─── Deleted Messages state ───
  const [deletedMessageIds, setDeletedMessageIds] = useState<Set<string>>(
    new Set(),
  );
  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "success",
  });
  const [showWelcomePicker, setShowWelcomePicker] = useState(false);
  const [wallpaperUri, setWallpaperUri] = useState<string | null>(null);
  const uploadState = useChatStore((s) =>
    roomId ? s.uploadProgressByRoom[roomId] : undefined,
  );
  const setUploadProgressForRoom = useChatStore((s) => s.setUploadProgress);
  const isUploadingActive = Boolean(uploadState?.active);

  const showToast = useCallback(
    (message: string, type: "success" | "error" | "info" = "success") => {
      setToast({ visible: true, message, type });
      setTimeout(() => {
        setToast((prev) => ({ ...prev, visible: false }));
      }, 2000);
    },
    [],
  );

  const strangerRejectionSignal = useChatStore((s) => s.strangerRejectionSignal);
  const processedStrangerKeys = useRef<Set<string>>(new Set());

  useEffect(() => {
    processedStrangerKeys.current.clear();
  }, [roomId]);

  // ─── Highlight tin nhắn trưởng/phó (pref local) ────────────────────────────
  const [highlightAdminPref, setHighlightAdminPref] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const uid = useAuthStore.getState().user?.id || currentUserId || "anon";
    const key = `minizalo:${uid}:groupHighlightAdmin:${roomId}`;
    if (roomType !== "GROUP" || !roomId) {
      setHighlightAdminPref(false);
      return;
    }
    AsyncStorage.getItem(key)
      .then((v) => {
        if (!cancelled) setHighlightAdminPref(v === "1");
      })
      .catch(() => { });
    return () => {
      cancelled = true;
    };
  }, [roomId, roomType, currentUserId]);

  /** Store gọi applyStrangerMessageRejection (chat-errors / REST 403) — ChatScreen dùng state local nên đồng bộ tin SYSTEM + gỡ temp. */
  useEffect(() => {
    if (!roomId || !strangerRejectionSignal) return;
    if (strangerRejectionSignal.roomId !== roomId) return;
    const n = strangerRejectionSignal.nonce;
    const dedupeKey = `${roomId}:${n}`;
    if (processedStrangerKeys.current.has(dedupeKey)) return;
    processedStrangerKeys.current.add(dedupeKey);
    const text = strangerRejectionSignal.text;
    const uid = currentUserId ?? "";
    setMessages((prev) => {
      const filtered = prev.filter((m) => {
        const mid = m.messageId ?? "";
        const isTemp =
          mid.startsWith("temp-") ||
          mid.startsWith("temp-media-") ||
          mid.startsWith("temp-file-");
        if (!isTemp) return true;
        return m.senderId !== uid;
      });
      const sysMsg: MessageDynamo = {
        messageId: `sys-stranger-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        chatRoomId: roomId,
        senderId: "SYSTEM",
        senderName: "SYSTEM",
        content: text,
        attachments: [],
        type: "SYSTEM",
        createdAt: new Date().toISOString(),
        replyToMessageId: "",
        read: false,
        readBy: [],
        reactions: [],
        recalled: false,
        recalledAt: "",
        pinned: false,
      };
      return [sysMsg, ...filtered];
    });
    showToast("Không gửi được tin nhắn", "error");
  }, [strangerRejectionSignal?.nonce, roomId, currentUserId, showToast]);

  const hasChatActivity = useMemo(() => {
    return messages.some((m) => {
      const mid = m.messageId || "";
      if (mid.startsWith("temp-")) return true;
      if (m.senderId === "system" || m.type === "SYSTEM") return false;
      return true;
    });
  }, [messages]);

  const isBlockedChat = Boolean(
    blockStatus?.blockedByYou || blockStatus?.blockedByOther,
  );

  const isStrangerEmptyThread = useMemo(() =>
    roomType === "DIRECT" && isStranger && !isBlockedChat && !hasChatActivity,
    [roomType, isStranger, isBlockedChat, hasChatActivity],
  );

  const handleStrangerFriendPress = useCallback(() => {
    if (!resolvedTargetUserId) return;
    if (friendRequestStatus === "NONE") {
      useFriendStore
        .getState()
        .sendRequest(resolvedTargetUserId)
        .then(() => {
          fetchSentRequests();
          Alert.alert("Thành công", "Đã gửi lời mời kết bạn.");
        })
        .catch(() => Alert.alert("Lỗi", "Gửi lời mời kết bạn thất bại."));
    } else if (friendRequestStatus === "INCOMING") {
      const req = requests.find((r: any) => {
        const id = r?.user?.id || r?.userId || r?.friend?.id;
        return id === resolvedTargetUserId;
      });
      if (req) {
        useFriendStore
          .getState()
          .acceptRequest(req.id)
          .then(() => {
            fetchFriends();
            setShowWelcomePicker(true);
            showToast("Đã chấp nhận lời mời kết bạn", "success");
          })
          .catch(() =>
            Alert.alert("Lỗi", "Chấp nhận lời mời kết bạn thất bại."),
          );
      }
    }
  }, [
    resolvedTargetUserId,
    friendRequestStatus,
    requests,
    fetchSentRequests,
    fetchFriends,
    showToast,
  ]);

  useEffect(() => {
    void fetchFriends();
  }, [fetchFriends]);

  useEffect(() => {
    if (!resolvedTargetUserId || !isStrangerEmptyThread) return;
    void fetchSentRequests();
    void fetchRequests({ silent: true });
  }, [
    resolvedTargetUserId,
    isStrangerEmptyThread,
    fetchSentRequests,
    fetchRequests,
  ]);

  useEffect(() => {
    if (!resolvedTargetUserId || !isStrangerEmptyThread) {
      setPartnerProfileDetail(null);
      return;
    }
    let cancelled = false;
    userService
      .getUserProfile(resolvedTargetUserId)
      .then((p) => {
        if (!cancelled) setPartnerProfileDetail(p);
      })
      .catch(() => {
        if (!cancelled) setPartnerProfileDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [resolvedTargetUserId, isStrangerEmptyThread]);

  useEffect(() => {
    const flag =
      showWelcomeTemplates === "true" || showWelcomeTemplates === true;
    if (!flag) return;
    // Chỉ gợi ý khi chat 1-1 và đã là bạn bè (không phải người lạ)
    if (roomType !== "DIRECT") return;
    if (isStranger) return;
    setShowWelcomePicker(true);
  }, [showWelcomeTemplates, roomType, isStranger]);

  // ─── Load chat history ───
  const fetchMessages = useCallback(
    async (isLoadMore = false) => {
      if (
        !roomId ||
        (isLoadMore && (!hasMoreRef.current || loadingMoreRef.current))
      )
        return;

      if (isLoadMore) {
        loadingMoreRef.current = true;
        setIsLoadingMore(true);
      } else {
        setLoaded(false);
      }

      try {
        let latestDeletedIds = deletedMessageIds;
        if (currentUserId) {
          const raw = await AsyncStorage.getItem(
            `DELETED_MESSAGES_${currentUserId}`,
          );
          if (raw) {
            const parsed = JSON.parse(raw);
            latestDeletedIds = new Set(parsed);
            setDeletedMessageIds(latestDeletedIds);
          }
        }

        const currentKey = isLoadMore ? lastKeyRef.current : null;
        if (!activeRoomId) return;
        const result = await chatService.getChatHistory(
          activeRoomId,
          20,
          currentKey || undefined,
        );

        if (result?.messages) {
          const filtered = result.messages.filter(
            (m) => !latestDeletedIds.has(m.messageId),
          );

          if (isLoadMore) {
            setMessages((prev) => {
              const nextPrev = prev.map((m) => {
                if ((m as any).isOnlyPinned && filtered.some((f) => f.messageId === m.messageId)) {
                  return { ...m, isOnlyPinned: false };
                }
                return m;
              });
              const existingIds = new Set(nextPrev.map((m) => m.messageId));
              const uniqueNewMessages = filtered.filter(
                (m) => !existingIds.has(m.messageId),
              );
              const all = [...nextPrev, ...uniqueNewMessages];
              all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
              return all;
            });
          } else {
            // Load pinned messages separately to ensure they're always present
            let pinnedMsgs: MessageDynamo[] = [];
            try {
              const pinResult = await chatService.getPinnedMessages(
                activeRoomId,
                20,
              );
              console.log("=== PIN_FETCH_RESULT ===", pinResult?.messages?.length, pinResult?.messages?.map(m => m.messageId));
              if (pinResult?.messages) {
                pinnedMsgs = pinResult.messages
                  .filter((m) => !latestDeletedIds.has(m.messageId))
                  .map((m) => ({ ...m, pinned: true }));
              }
            } catch (err) {
              console.error("=== PIN_FETCH_ERROR ===", err);
              /* ignore pin fetch failure */
            }

            const pinnedIds = new Set(pinnedMsgs.map((m) => m.messageId));

            // Merge: pinned messages that aren't in history + history
            const historyWithPin = filtered.map((m) =>
              pinnedIds.has(m.messageId) ? { ...m, pinned: true } : m
            );
            const historyIds = new Set(historyWithPin.map((m) => m.messageId));
            const extraPinned = pinnedMsgs.filter(
              (m) => !historyIds.has(m.messageId),
            ).map((m) => ({ ...m, isOnlyPinned: true }) as MessageDynamo);
            setMessages((prev) => {
              const strangerSysLocal = prev.filter(
                (m) =>
                  typeof m.messageId === "string" &&
                  m.messageId.startsWith("sys-stranger-"),
              );
              const merged = [...historyWithPin, ...extraPinned];
              merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
              const mergedIds = new Set(
                merged.map((m) => m.messageId).filter(Boolean),
              );
              const keep = strangerSysLocal.filter(
                (m) => m.messageId && !mergedIds.has(m.messageId),
              );
              return [...keep, ...merged];
            });
          }

          lastKeyRef.current = result.lastEvaluatedKey;
          hasMoreRef.current = !!result.lastEvaluatedKey;
        }
      } catch (err) {
        showToast("Không thể tải tin nhắn", "error");
      } finally {
        setLoaded(true);
        loadingMoreRef.current = false;
        setIsLoadingMore(false);
      }
    },
    [activeRoomId, currentUserId],
  );

  const handleLoadMore = () => {
    if (hasMoreRef.current && !loadingMoreRef.current) {
      fetchMessages(true);
    }
  };

  // Đồng bộ nền sau khi gửi qua WS để tránh trường hợp UI chưa nhận đủ event realtime.
  const schedulePostSendSync = useCallback(() => {
    setTimeout(() => {
      void fetchMessages(false);
    }, 1200);
    setTimeout(() => {
      void fetchMessages(false);
    }, 3200);
  }, [fetchMessages]);

  // ─── Check block status & Privacy settings for DIRECT chats ───
  useEffect(() => {
    if (!roomId || roomType !== "DIRECT" || !partnerId) {
      setBlockStatus(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const status = await friendService.checkBlockStatus(partnerId);
        if (!cancelled) {
          setBlockStatus({
            blockedByYou: !!status.blockedByYou,
            blockedByOther: !!status.blockedByOther,
            blockerName: status.blockerName ?? null,
          });
        }
      } catch (err) {
        // Fail silence
      }
    };
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    load();
    return () => {
      cancelled = true;
    };
  }, [roomId, roomType, partnerId, isStranger]);

  // Re-check when global blockedUsers list changes (chặn/bỏ chặn từ nơi khác)
  useEffect(() => {
    if (!roomId || roomType !== "DIRECT" || !partnerId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const status = await friendService.checkBlockStatus(partnerId);
        if (!cancelled) {
          setBlockStatus({
            blockedByYou: !!status.blockedByYou,
            blockedByOther: !!status.blockedByOther,
            blockerName: status.blockerName ?? null,
          });
        }
      } catch (err) {
        // Fail silence
      }
    };
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    load();
    return () => {
      cancelled = true;
    };
  }, [blockedUsers, roomId, roomType, partnerId]);

  // Phòng đang mở: sync theo `isFocused` — đổi tab / thoát chat → currentRoomId=null để unread & banner đúng
  useEffect(() => {
    if (!roomId) {
      setWallpaperUri(null);
      useChatStore.getState().setCurrentRoom(null);
      return;
    }
    if (!isFocused) {
      useChatStore.getState().setCurrentRoom(null);
      return;
    }
    useChatStore.getState().setCurrentRoom(roomId as string);
    let cancelled = false;
    void getChatWallpaperUri(roomId as string).then((u) => {
      if (!cancelled) setWallpaperUri(u);
    });
    return () => {
      cancelled = true;
      useChatStore.getState().setCurrentRoom(null);
    };
  }, [roomId, isFocused]);

  // ─── WebSocket: subscribe to room for realtime ───
  useEffect(() => {
    if (!roomId) {
      if (activeRoomId === null) {
        // Đây là "virtual chat" (roomId="new")
        setLoaded(true);
      }
      return;
    }

    // Fetch history
    fetchMessages();

    // Activate WebSocket
    webSocketService.activate();

    // Subscribe to room topic (tin nhắn mới)
    const topic = `/topic/chat/${roomId}`;

    // Sau khi subscribe xong, kiểm tra và gửi tin nhắn pending (nếu vừa tạo room mới)
    const sendPendingMessage = () => {
      const pending = pendingSendRef.current;
      if (pending) {
        pendingSendRef.current = null;
        // Thêm tin nhắn optimistic
        const optimisticMsg: any = {
          messageId: `temp-${Date.now()}`,
          chatRoomId: roomId,
          senderId: currentUserId || "",
          senderName: "Tôi",
          content: pending.content,
          attachments: [],
          type: "TEXT",
          createdAt: new Date().toISOString(),
          replyToMessageId: pending.replyToId ?? "",
          read: false,
          readBy: [],
          reactions: [],
          recalled: false,
          recalledAt: "",
          pinned: false,
        };
        setMessages((prev) => [optimisticMsg, ...prev]);
        // Gửi tin nhắn thực tế
        const sentViaWs = webSocketService.sendChatMessage(
          roomId,
          pending.content,
          "TEXT",
          pending.replyToId,
        );
        if (!sentViaWs) {
          chatService
            .sendMessage(roomId, pending.content, pending.replyToId)
            .then(() => {
              void fetchMessages(false);
            })
            .catch((err: unknown) => {
              if (isStrangerMessagesNotAllowedError(err)) {
                useChatStore.getState().applyStrangerMessageRejection(
                  roomId,
                  formatStrangerPrivacyRejectionMessage(displayName),
                );
              }
            });
        }
        schedulePostSendSync();
      }
    };
    const handleIncomingMsg = (stompMessage: any) => {
      try {
        const rawBody = stompMessage?.body;
        if (rawBody == null) return;
        const parsed: unknown = JSON.parse(String(rawBody));
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          const p = parsed as {
            roomListEvent?: string;
            roomId?: string;
            forUserId?: string;
          };
          if (p.roomListEvent === "REMOVED" && p.roomId) {
            const uid = useAuthStore.getState().user?.id;
            if (p.forUserId && p.forUserId !== uid) return;
            const rid = String(p.roomId);
            useChatStore.getState().removeRoomLocal(rid);
            if (rid === roomId || rid === String(id ?? "")) {
              router.back();
            }
            return;
          }
          if (p.roomListEvent === "DISBANDED" && p.roomId) {
            const rid = String(p.roomId);
            const existing = useChatStore.getState().rooms.find((r) => r.id === rid);
            if (existing) {
              useChatStore.getState().upsertRoom({ ...existing, disbanded: true });
            }
            return;
          }
          if (p.roomListEvent === "PENDING_JOINS_CHANGED" && p.roomId) {
            const rid = String(p.roomId);
            if (rid === roomId) void refreshGroupJoinBadge();
            return;
          }
          if (p.roomListEvent === "ADDED" && p.roomId) {
            return;
          }

          // BE phát `messageUpdate=true` khi cập nhật in-place 1 tin hiện có
          // (vd: group call STARTED → ENDED). Patch trực tiếp tin đã có trong list,
          // KHÔNG prepend tin mới để không nhảy bubble và không "bump" room lên top.
          const pu = parsed as {
            messageUpdate?: boolean;
            messageId?: string;
            content?: string;
            type?: string;
            recalled?: boolean;
          };
          if (pu.messageUpdate === true && typeof pu.messageId === "string" && pu.messageId) {
            setMessages((prev) =>
              prev.map((m) =>
                m.messageId === pu.messageId
                  ? ({
                      ...m,
                      content: pu.recalled ? "[Tin nhắn đã thu hồi]" : pu.content ?? m.content,
                      type: (pu.type as any) ?? m.type,
                      recalled: !!pu.recalled,
                    } as any)
                  : m,
              ),
            );
            // Cập nhật luôn useChatStore để lastMessage ở room list đồng bộ.
            useChatStore.getState().updateMessage(roomId, pu.messageId, {
              content: pu.recalled ? "[Tin nhắn đã thu hồi]" : pu.content ?? "",
              type: (pu.type as any) ?? undefined,
              isRecall: !!pu.recalled,
            } as any);
            return;
          }
        }
        const newMsg: MessageDynamo = parsed as MessageDynamo;

        // Fallback sync: nếu nhận thông báo PIN_NOTIFICATION từ web (có replyToMessageId),
        // nhưng client vì lý do nào đó không nhận được event /pin, thì vẫn đồng bộ danh sách ghim.
        // Dùng silentSync để không rebuild toàn bộ messages array (tránh FlatList reset scroll).
        if (
          newMsg?.type === "PIN_NOTIFICATION" &&
          typeof newMsg.replyToMessageId === "string" &&
          newMsg.replyToMessageId.trim().length > 0
        ) {
          // Chỉ cần sync 1 lần sau delay để tránh eventual-consistency
          setTimeout(() => {
            void syncPinnedFromServer(roomId, { preserveIfEmpty: true });
          }, 1500);
        }

        setMessages((prev) => {
          if (prev.some((m) => m.messageId === newMsg.messageId)) {
            return prev;
          }

          const isMyMessage =
            currentUserId &&
            newMsg.senderId &&
            newMsg.senderId.toLowerCase() === currentUserId.toLowerCase();

          if (isMyMessage) {
            const isFileLike =
              newMsg.type === "FILE" || newMsg.type === "DOCUMENT";
            const isMediaLike =
              newMsg.type === "IMAGE" || newMsg.type === "VIDEO";

            const tempMsgs = prev.filter((m) => {
              if (!m.messageId?.startsWith("temp-")) return false;
              if (isFileLike) {
                return (
                  m.messageId.startsWith("temp-file-") ||
                  m.type === "FILE" ||
                  m.type === "DOCUMENT"
                );
              }
              if (isMediaLike) {
                return (
                  m.messageId.startsWith("temp-media-") ||
                  m.type === "IMAGE" ||
                  m.type === "VIDEO"
                );
              }
              return m.type === newMsg.type;
            });

            if (tempMsgs.length > 0) {
              const targetTemp = tempMsgs[tempMsgs.length - 1];
              const tempIdx = prev.findIndex(
                (m) => m.messageId === targetTemp.messageId,
              );

              if (tempIdx !== -1) {
                const next = [...prev];
                next.splice(tempIdx, 1);
                return [newMsg, ...next];
              }
            }
          }

          return [newMsg, ...prev];
        });

        const isUserMessage =
          newMsg.type === "TEXT" ||
          newMsg.type === "IMAGE" ||
          newMsg.type === "VIDEO" ||
          newMsg.type === "VOICE" ||
          newMsg.type === "FILE" ||
          newMsg.type === "DOCUMENT" ||
          newMsg.type === "POLL" ||
          newMsg.type === "STORY_REPLY";

        if (newMsg.senderId === currentUserId && isUserMessage) {
          setTimeout(() => {
            flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
          });
        }
      } catch (err) {
        // Error parsing WS message
      }
    };
    webSocketService.subscribe(topic, handleIncomingMsg);

    // Subscribe to personal topic for privacy-blocked messages
    if (currentUserId) {
      const personalTopic = `/topic/chat/${roomId}/${currentUserId}`;
      webSocketService.subscribe(personalTopic, handleIncomingMsg);
    }

    // Subscribe recall events
    const recallTopic = `/topic/chat/${roomId}/recall`;
    webSocketService.subscribe(recallTopic, (stompMessage) => {
      try {
        const payload = JSON.parse(stompMessage.body) as {
          messageId?: string;
          recalledAt?: string;
        };
        if (!payload?.messageId) return;
        setMessages((prev) =>
          prev.map((m) =>
            m.messageId === payload.messageId
              ? {
                ...m,
                recalled: true,
                recalledAt: payload.recalledAt || new Date().toISOString(),
              }
              : m,
          ),
        );
      } catch (err) {
        // Error parsing recall WS message
      }
    });

    // Subscribe reaction events
    const reactionTopic = `/topic/chat/${roomId}/reaction`;
    webSocketService.subscribe(reactionTopic, (stompMessage) => {
      try {
        const payload = JSON.parse(stompMessage.body) as {
          messageId?: string;
          userId?: string;
          emoji?: string | null;
          action?: "add" | "remove" | "removeAll";
        };
        if (!payload?.messageId || !payload.userId) return;
        const action = payload.action ?? (payload.emoji ? "add" : "removeAll");
        setMessages((prev) =>
          prev.map((m) => {
            if (m.messageId !== payload.messageId) return m;
            const reactions = Array.isArray(m.reactions)
              ? [...m.reactions]
              : [];
            if (action === "removeAll") {
              const next = reactions.filter((r) => r.userId !== payload.userId);
              return { ...m, reactions: next };
            }
            if (action === "remove" && payload.emoji) {
              const next = reactions.filter(
                (r) =>
                  !(r.userId === payload.userId && r.emoji === payload.emoji),
              );
              return { ...m, reactions: next };
            }
            if (action === "add" && payload.emoji) {
              // Check for duplicates
              const exists = reactions.some(
                (r) => r.userId === payload.userId && r.emoji === payload.emoji,
              );
              if (exists) return m;

              return {
                ...m,
                reactions: [
                  ...reactions,
                  {
                    userId: payload.userId!,
                    emoji: payload.emoji,
                  } as MessageReaction,
                ],
              };
            }
            return m;
          }),
        );
      } catch (err) {
        // Error parsing reaction WS message
      }
    });

    // Subscribe pin events
    const pinTopic = `/topic/chat/${roomId}/pin`;
    webSocketService.subscribe(pinTopic, (stompMessage) => {
      try {
        const payload = JSON.parse(stompMessage.body) as {
          messageId?: string;
          isPinned?: boolean;
          error?: boolean;
          message?: string;
        };
        if (payload?.error) {
          showToast(payload.message || "Không thể ghim tin nhắn", "error");
          return;
        }
        if (!payload?.messageId) return;

        // Update nhanh cho mượt, rồi sync lại toàn bộ danh sách pins để đồng bộ ghim/bỏ ghim từ web.
        const targetId = String(payload.messageId);
        const nextPinned = !!payload.isPinned;
        setMessages((prev) =>
          prev.map((m) =>
            m.messageId === targetId ? { ...m, pinned: nextPinned } : m,
          ),
        );
        if (nextPinned) {
          void syncPinnedFromServer(roomId, { preserveIfEmpty: true });
        }
        // Không showToast ở đây vì backend sẽ broadcast system message PIN_NOTIFICATION
      } catch (err) {
        // Error parsing pin WS message
      }
    });

    // Subscribe typing events
    const typingTopic = `/topic/typing/${activeRoomId}`;
    webSocketService.subscribe(typingTopic, (stompMessage) => {
      try {
        const payload = JSON.parse(stompMessage.body) as {
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
            // Find user name from participants
            const room = rooms.find((r) => String(r.id) === String(activeRoomId));
            const user = room?.participants?.find((p) => String(p.id).trim().toLowerCase() === senderId);
            const name = user?.fullName || user?.username || "Ai đó";
            next[senderId] = name;

            // Clear old timer if any
            if (typingTimerRefs.current[senderId]) {
              clearTimeout(typingTimerRefs.current[senderId]);
            }

            // Auto-remove after 6s in case we miss the 'false' event
            typingTimerRefs.current[payload.userId] = setTimeout(() => {
              setTypingUsers((current) => {
                const updated = { ...current };
                delete updated[payload.userId];
                return updated;
              });
            }, 6000);
          } else {
            delete next[payload.userId];
            if (typingTimerRefs.current[payload.userId]) {
              clearTimeout(typingTimerRefs.current[payload.userId]);
              delete typingTimerRefs.current[payload.userId];
            }
          }
          return next;
        });
      } catch (err) {
        // Error parsing typing WS message
      }
    });

    // Subscribe to read events
    const readTopic = `/topic/chat/${activeRoomId}/read`;
    webSocketService.subscribe(readTopic, (stompMessage) => {
      try {
        const payload = JSON.parse(stompMessage.body) as {
          messageId: string;
          userId: string;
          readAt?: string;
        };
        if (!payload.messageId || !payload.userId) return;

        // Cập nhật readBy vào tin nhắn trong danh sách hiện tại
        setMessages((prev) =>
          prev.map((m) => {
            if (m.messageId !== payload.messageId) return m;
            const existingReadBy = m.readBy || [];
            if (existingReadBy.includes(payload.userId)) return m;
            return { ...m, readBy: [...existingReadBy, payload.userId] };
          }),
        );
      } catch (err) {
        // Error parsing read WS message
      }
    });

    // Gửi tin nhắn pending (do vừa tạo room mới) sau khi WS subscribe xong
    setTimeout(sendPendingMessage, 500);

    return () => {
      webSocketService.unsubscribe(topic);
      if (currentUserId) {
        webSocketService.unsubscribe(`/topic/chat/${roomId}/${currentUserId}`);
      }
      webSocketService.unsubscribe(recallTopic);
      webSocketService.unsubscribe(reactionTopic);
      webSocketService.unsubscribe(pinTopic);
      webSocketService.unsubscribe(typingTopic);
      webSocketService.unsubscribe(readTopic);
      // Clean up all typing timers
      Object.values(typingTimerRefs.current).forEach(clearTimeout);
      typingTimerRefs.current = {};
    };
  }, [activeRoomId, roomId, id, fetchMessages, currentUserId, displayName, router, refreshGroupJoinBadge, rooms]);

  useEffect(() => {
    if (isStranger && isFocused) {
      fetchRequests();
      fetchSentRequests();
    }
  }, [isStranger, isFocused]);

  // ─── Send message ───
  // Ref để giữ tin nhắn đang chờ gửi khi tạo room mới
  const pendingSendRef = useRef<{ content: string; replyToId?: string } | null>(
    null,
  );

  const handleSend = async (content: string) => {
    if (!canSendMessage) {
      showToast("Chỉ trưởng/phó nhóm được gửi tin nhắn", "info");
      return;
    }
    if (sending || !content.trim()) return;

    let workingRoomId = activeRoomId;

    // Nếu là phòng chat mới (chưa có ID thực), tiến hành tạo phòng backend
    if (!workingRoomId) {
      if (!resolvedTargetUserId) {
        Alert.alert(
          "Lỗi",
          "Không tìm thấy thông tin người nhận để tạo phòng chat.",
        );
        return;
      }
      try {
        setSending(true);
        const { useChatStore } = await import("@/shared/store/useChatStore");
        const newRoom = await useChatStore
          .getState()
          .createPrivateRoom(resolvedTargetUserId);
        workingRoomId = newRoom.id;
        // Lưu tin nhắn vào ref, sẽ gửi sau khi useEffect subscribe WS xong
        pendingSendRef.current = {
          content: content.trim(),
          replyToId: replyTo?.messageId,
        };
        setReplyTo(null);
        setActiveRoomId(newRoom.id);
        // RETURN ở đây – useEffect [roomId] sẽ subscribe WS + gọi sendPendingMessage
        setSending(false);
        return;
      } catch (err) {
        Alert.alert("Lỗi", "Không thể khởi tạo phòng chat. Vui lòng thử lại.");
        setSending(false);
        return;
      }
    }

    if (
      roomType === "DIRECT" &&
      blockStatus &&
      (blockStatus.blockedByYou || blockStatus.blockedByOther)
    ) {
      Alert.alert(
        "Không thể gửi tin nhắn",
        blockStatus.blockedByYou
          ? "Bạn đang chặn tin nhắn với người này. Hãy bỏ chặn để tiếp tục nhắn tin."
          : "Bạn đã bị chặn tin nhắn trong cuộc trò chuyện này.",
      );
      setSending(false);
      return;
    }
    setSending(true);

    const optimisticMsg: MessageDynamo = {
      messageId: `temp-${Date.now()}`,
      chatRoomId: workingRoomId || "",
      senderId: currentUserId || "",
      senderName: "Tôi",
      content,
      attachments: [],
      type: "TEXT",
      createdAt: new Date().toISOString(),
      replyToMessageId: replyTo?.messageId ?? "",
      read: false,
      readBy: [],
      reactions: [],
      recalled: false,
      recalledAt: "",
      pinned: false,
    };

    setMessages((prev) => [optimisticMsg, ...prev]);
    setTimeout(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }, 100);

    try {
      const sentViaWs = webSocketService.sendChatMessage(
        workingRoomId!,
        content,
        "TEXT",
        replyTo?.messageId,
      );
      if (!sentViaWs) {
        await chatService.sendMessage(
          workingRoomId!,
          content,
          replyTo?.messageId,
        );
        void fetchMessages(false);
      }
      schedulePostSendSync();
    } catch (err: unknown) {
      if (isStrangerMessagesNotAllowedError(err)) {
        useChatStore.getState().applyStrangerMessageRejection(
          workingRoomId!,
          formatStrangerPrivacyRejectionMessage(displayName),
        );
      } else {
        showToast("Gửi tin nhắn thất bại", "error");
        setMessages((prev) =>
          prev.map((m) =>
            m.messageId === optimisticMsg.messageId ? { ...m, isError: true } : m,
          ),
        );
      }
    } finally {
      setSending(false);
      setReplyTo(null);
    }
  };

  // ─── Send image(s) ───
  const handleSendImage = async (assets: ImagePicker.ImagePickerAsset[]) => {
    if (!canSendMessage) {
      showToast("Chỉ trưởng/phó nhóm được gửi tin nhắn", "info");
      return;
    }
    if (!roomId || sending || isUploadingActive || assets.length === 0) return;
    for (const a of assets) {
      const sz = a.fileSize;
      if (sz != null && sz > 0) {
        const mime =
          a.mimeType || (a.type === "video" ? "video/mp4" : "image/jpeg");
        const err = validateFileSize({ size: sz, type: mime });
        if (err) {
          Alert.alert("Giới hạn dung lượng", err);
          return;
        }
      }
    }
    setSending(true);
    setUploadProgressForRoom(roomId, {
      progress: 1,
      text: "Đang tải ảnh/video... 1%",
    });

    const msgType = assets.some((a) => a.type === "video") ? "VIDEO" : "IMAGE";

    // Optimistic UI with local media (tạm thời để hiển thị ngay)
    const tempId = `temp-media-${Date.now()}`;
    const optimisticMsg: MessageDynamo = {
      messageId: tempId,
      chatRoomId: roomId,
      senderId: currentUserId || "",
      senderName: "Tôi",
      content: "",
      attachments: assets.map((a, i) => ({
        id: "",
        url: a.uri, // Tạm thời dùng local URI
        type: a.type === "video" ? "VIDEO" : "IMAGE",
        name: a.fileName || `media_${i}.${a.type === "video" ? "mp4" : "jpg"}`,
        size: a.fileSize || 0,
      })),
      type: msgType,
      createdAt: new Date().toISOString(),
      replyToMessageId: "",
      read: false,
      readBy: [],
      reactions: [],
      recalled: false,
      recalledAt: "",
      pinned: false,
    };
    setMessages((prev) => [optimisticMsg, ...prev]);
    setTimeout(
      () => flatListRef.current?.scrollToOffset({ offset: 0, animated: true }),
      100,
    );

    try {
      const token =
        (await import("@/shared/store/authStore")).useAuthStore.getState()
          .accessToken ?? "";
      const rawBase =
        process.env?.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ||
        "http://localhost:8080/api";
      const apiBase = rawBase.endsWith("/api") ? rawBase : `${rawBase}/api`;

      // Byte-level parallel progress tracking
      const fileSizes = assets.map((a) => a.fileSize ?? 0);
      const loadedArr = new Array(assets.length).fill(0) as number[];
      const totalArr = [...fileSizes] as number[];

      const reportProgress = () => {
        const sumLoaded = loadedArr.reduce((s, b) => s + b, 0);
        const sumTotal = totalArr.reduce((s, b) => s + b, 0) || 1;
        const pct = Math.min(
          99,
          Math.max(1, Math.round((sumLoaded / sumTotal) * 100)),
        );
        const sizePart =
          sumTotal > 1
            ? ` · ${formatBytes(sumLoaded)} / ${formatBytes(sumTotal)}`
            : "";
        setUploadProgressForRoom(roomId, {
          progress: pct,
          text: `Đang tải ảnh/video... ${pct}%${sizePart}`,
        });
      };

      const uploadPromises = assets.map(async (asset, i) => {
        const uri = asset.uri;
        const ext = asset.type === "video" ? "mp4" : "jpg";
        const filename = asset.fileName || `media_${Date.now()}_${i}.${ext}`;
        const type =
          asset.mimeType ||
          (asset.type === "video" ? "video/mp4" : "image/jpeg");

        const formData = new FormData();
        formData.append("file", { uri, name: filename, type } as any);

        const uploadData = await uploadFileWithXHR(
          `${apiBase}/files/upload`,
          formData,
          token,
          (loaded, total) => {
            loadedArr[i] = loaded;
            if (total > 0) totalArr[i] = total;
            reportProgress();
          },
        );
        // Mark this file as fully uploaded
        loadedArr[i] = totalArr[i] || loadedArr[i];
        reportProgress();

        return {
          id: "",
          name: uploadData.fileName || filename,
          url: uploadData.fileUrl,
          type: uploadData.fileType || type,
          filename: uploadData.fileName || filename,
          size: uploadData.size || asset.fileSize || 0,
        };
      });

      const uploadedAttachments = await Promise.all(uploadPromises);

      // ✅ Cập nhật optimistic message với server URLs
      setMessages((prev) =>
        prev.map((m) =>
          m.messageId === tempId
            ? { ...m, attachments: uploadedAttachments }
            : m,
        ),
      );

      // Send message with all attachments via WebSocket
      const sentViaWs = webSocketService.sendChatMessage(
        roomId,
        "",
        msgType,
        undefined,
        uploadedAttachments,
      );
      if (!sentViaWs) {
        await chatService.sendMessage(
          roomId,
          "",
          undefined,
          msgType as any,
          uploadedAttachments,
        );
        await fetchMessages();
      }
      schedulePostSendSync();
    } catch (err: unknown) {
      if (isStrangerMessagesNotAllowedError(err)) {
        useChatStore.getState().applyStrangerMessageRejection(
          roomId,
          formatStrangerPrivacyRejectionMessage(displayName),
        );
      } else {
        showToast("Gửi file phương tiện thất bại", "error");
        setMessages((prev) =>
          prev.map((m) => (m.messageId === tempId ? { ...m, isError: true } : m)),
        );
      }
    } finally {
      setUploadProgressForRoom(roomId, null);
      setSending(false);
    }
  };

  const handleSendFile = async (
    files: DocumentPicker.DocumentPickerAsset[],
  ) => {
    if (!canSendMessage) {
      showToast("Chỉ trưởng/phó nhóm được gửi tin nhắn", "info");
      return;
    }
    if (!roomId || sending || isUploadingActive || !files || files.length === 0)
      return;
    for (const f of files) {
      const fsz = f.size;
      if (fsz != null && fsz > 0) {
        const err = validateFileSize({ size: fsz, type: f.mimeType || "" });
        if (err) {
          Alert.alert("Giới hạn dung lượng", err);
          return;
        }
      }
    }
    setSending(true);
    setUploadProgressForRoom(roomId, {
      progress: 1,
      text: "Đang tải tệp... 1%",
    });

    const tempId = `temp-file-${Date.now()}`;
    const optimisticMsg: MessageDynamo = {
      messageId: tempId,
      chatRoomId: roomId,
      senderId: currentUserId || "",
      senderName: "Tôi",
      content: "",
      attachments: files.map((f) => ({
        id: "",
        url: f.uri,
        type: f.mimeType || "application/octet-stream",
        name: f.name || "file",
        size: f.size || 0,
      })),
      type: "FILE",
      createdAt: new Date().toISOString(),
      replyToMessageId: "",
      read: false,
      readBy: [],
      reactions: [],
      recalled: false,
      recalledAt: "",
      pinned: false,
    };
    setMessages((prev) => [optimisticMsg, ...prev]);
    setTimeout(
      () => flatListRef.current?.scrollToOffset({ offset: 0, animated: true }),
      100,
    );

    try {
      const token =
        (await import("@/shared/store/authStore")).useAuthStore.getState()
          .accessToken ?? "";
      const rawBase =
        process.env?.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ||
        "http://localhost:8080/api";
      const apiBase = rawBase.endsWith("/api") ? rawBase : `${rawBase}/api`;

      // Byte-level parallel progress tracking
      const fileSizes = files.map((f) => f.size ?? 0);
      const loadedArr = new Array(files.length).fill(0) as number[];
      const totalArr = [...fileSizes] as number[];

      const reportProgress = () => {
        const sumLoaded = loadedArr.reduce((s, b) => s + b, 0);
        const sumTotal = totalArr.reduce((s, b) => s + b, 0) || 1;
        const pct = Math.min(
          99,
          Math.max(1, Math.round((sumLoaded / sumTotal) * 100)),
        );
        const sizePart =
          sumTotal > 1
            ? ` · ${formatBytes(sumLoaded)} / ${formatBytes(sumTotal)}`
            : "";
        setUploadProgressForRoom(roomId, {
          progress: pct,
          text: `Đang tải tệp... ${pct}%${sizePart}`,
        });
      };

      const uploadPromises = files.map(async (file, i) => {
        const filename = file.name || `file_${Date.now()}_${i}`;
        const type = file.mimeType || "application/octet-stream";
        const formData = new FormData();
        formData.append("file", { uri: file.uri, name: filename, type } as any);

        const uploadData = await uploadFileWithXHR(
          `${apiBase}/files/upload`,
          formData,
          token,
          (loaded, total) => {
            loadedArr[i] = loaded;
            if (total > 0) totalArr[i] = total;
            reportProgress();
          },
        );
        // Mark this file as fully uploaded
        loadedArr[i] = totalArr[i] || loadedArr[i];
        reportProgress();

        return {
          id: "",
          name: uploadData.fileName || filename,
          url: uploadData.fileUrl,
          type: uploadData.fileType || type,
          filename: uploadData.fileName || filename,
          size: uploadData.size || file.size || 0,
        };
      });

      const uploadedAttachments = await Promise.all(uploadPromises);

      setMessages((prev) =>
        prev.map((m) =>
          m.messageId === tempId
            ? { ...m, attachments: uploadedAttachments }
            : m,
        ),
      );

      const sentViaWs = webSocketService.sendChatMessage(
        roomId,
        "",
        "FILE",
        undefined,
        uploadedAttachments,
      );
      if (!sentViaWs) {
        await chatService.sendMessage(
          roomId,
          "",
          undefined,
          "FILE",
          uploadedAttachments,
        );
        await fetchMessages();
      }
      schedulePostSendSync();
    } catch (err: unknown) {
      if (isStrangerMessagesNotAllowedError(err)) {
        useChatStore.getState().applyStrangerMessageRejection(
          roomId,
          formatStrangerPrivacyRejectionMessage(displayName),
        );
      } else {
        showToast("Gửi file thất bại", "error");
        setMessages((prev) =>
          prev.map((m) => (m.messageId === tempId ? { ...m, isError: true } : m)),
        );
      }
    } finally {
      setUploadProgressForRoom(roomId, null);
      setSending(false);
    }
  };

  const handleMessagePress = (message: MessageDynamo) => {
    // Sẽ dùng cho reply / xem chi tiết sau
  };

  const handleMessageLongPress = (message: MessageDynamo, attachment?: any) => {
    setSelectedMessage(message);
    setSelectedAttachment(attachment || null);
    setShowActionSheet(true);
  };

  const closeActionSheet = () => {
    setShowActionSheet(false);
    setSelectedMessage(null);
    setSelectedAttachment(null);
  };

  const handleRecall = (msg?: MessageDynamo) => {
    const target = msg || selectedMessage;
    if (!target || !roomId) return;
    if (target.senderId !== currentUserId) return;

    const messageTime = new Date(target.createdAt).getTime();
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    if (now - messageTime > oneDayMs) {
      Alert.alert("Không thể thu hồi", "Tin nhắn đã gửi quá 1 ngày.");
      closeActionSheet();
      return;
    }

    Alert.alert("Thu hồi tin nhắn", "Bạn có chắc muốn thu hồi tin nhắn này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Thu hồi",
        style: "destructive",
        onPress: async () => {
          try {
            await MessageService.recallMessage(roomId, target.messageId);
            setMessages((prev) =>
              prev.map((m) =>
                m.messageId === target.messageId
                  ? {
                    ...m,
                    recalled: true,
                    recalledAt: new Date().toISOString(),
                  }
                  : m,
              ),
            );
            showToast("Đã thu hồi tin nhắn");
          } catch (err: any) {
            const status = err?.response?.status;
            if (status === 400) {
              showToast("Tin nhắn đã gửi quá 1 ngày", "error");
            } else {
              showToast("Không thu hồi được tin nhắn", "error");
            }
          } finally {
            closeActionSheet();
          }
        },
      },
    ]);
  };

  const handleCopyMessage = async (msg?: MessageDynamo) => {
    const target = msg || selectedMessage;
    if (!target) return;

    // Close menu immediately for faster UI feel
    closeActionSheet();

    try {
      // Check if it's an image message to copy actual image data
      // Use selectedAttachment if available (from direct long press on an image)
      const firstImage =
        selectedAttachment ||
        target.attachments?.find(
          (a) => a.type === "IMAGE" || a.type?.startsWith("image/"),
        );

      if (firstImage && !target.recalled) {
        const url = getImageUrl(firstImage.url);
        if (url) {
          showToast("Đang chuẩn bị ảnh...");

          // Create a stable filename for better caching
          const urlHash =
            firstImage.id ||
            firstImage.url.split("/").pop()?.split("?")[0] ||
            `copy_temp`;
          const extension =
            url.split(".").pop()?.split("?")[0]?.toLowerCase() || "jpg";
          const filename = `cache_${urlHash}.${extension}`;
          const localUri = `${cacheDirectory}${filename}`;

          // ─── OPTIMIZE CACHE: Check if file already exists ───
          const info = await FileSystem.getInfoAsync(localUri);
          let targetUri = localUri;

          if (!info.exists) {
            const downloadRes = await downloadAsync(url, localUri);
            if (!downloadRes) throw new Error("Download for copy failed");
            targetUri = downloadRes.uri;
          }

          const base64 = await readAsStringAsync(targetUri, {
            encoding: EncodingType.Base64,
          });
          await Clipboard.setImageAsync(base64);
          showToast("Đã sao chép hình ảnh!");
          return;
        }
      }

      // Normal text or link copy fallback
      let copyText = target.content || "";

      // Append attachment info if present
      if (target.attachments && target.attachments.length > 0) {
        const attachInfo = target.attachments
          .map((a) => `${a.name || "Tệp"}: ${getImageUrl(a.url)}`)
          .join("\n");

        if (copyText) {
          copyText += "\n\n" + attachInfo;
        } else {
          copyText = attachInfo;
        }
      }

      if (copyText) {
        await Clipboard.setStringAsync(copyText);
        showToast("Đã sao chép văn bản!");
      } else {
        showToast("Không có nội dung để sao chép", "info");
      }
    } catch (e) {
      console.error("Copy failed:", e);
      showToast("Lỗi khi sao chép", "error");
    }
  };

  const handleJumpToUnread = async () => {
    if (!firstUnreadMessage?.messageId || !activeRoomId) return;

    // Luôn đặt Highlight ID để Effect tự động nạp lịch sử nếu cần
    useChatStore.getState().setHighlightedMessageId(firstUnreadMessage.messageId);

    // Tìm index của tin chưa đọc cũ nhất trong danh sách hiện tại
    const targetIdx = messages.findIndex((m) => m.messageId === firstUnreadMessage.messageId);

    if (targetIdx !== -1) {
      flatListRef.current?.scrollToIndex({
        index: targetIdx,
        animated: true,
        viewPosition: 0.5,
      });
    } else {
      // Nếu chưa có trên máy, Toast thông báo đang tải thêm
      showToast("Đang tìm tin nhắn cũ nhất chưa đọc...", "info");
    }

    // Sau khi nhấn, thực hiện các yêu cầu: ẩn banner, đánh dấu đã đọc locally/server
    setInitialUnreadCount(0);
    useChatStore.getState().markRoomAsRead(activeRoomId);
    webSocketService.sendReadReceipt({
      roomId: activeRoomId,
      messageId: firstUnreadMessage.messageId,
    });
  };

  const handleAiSummarizeUnread = async () => {
    if (!firstUnreadMessage || !activeRoomId) return;

    // Tính mốc từ tin nhắn chưa đọc cổ nhất
    const startDate = new Date(firstUnreadMessage.createdAt);
    const endDate = new Date(); // Đến hiện tại

    setAiSummaryDates({ start: startDate, end: endDate });
    setShowUnreadAiModal(true);
  };

  const handleDownloadMessage = async (msg?: MessageDynamo) => {
    const target = msg || selectedMessage;
    if (!target) return;

    try {
      const getFileUrl = () => {
        if (target.attachments && target.attachments.length > 0) {
          return target.attachments[0].url;
        }
        return (target as any).fileUrl || target.content;
      };

      const rawUrl = getFileUrl();
      if (!rawUrl) {
        showToast("Không tìm thấy đường dẫn tệp", "error");
        return;
      }

      const url = getImageUrl(rawUrl);
      const extension = url.split(".").pop()?.split("?")[0]?.toLowerCase() || "";
      const isMedia = ["jpg", "jpeg", "png", "gif", "mp4", "mov"].includes(extension);

      const filename = target.attachments?.[0]?.name || target.attachments?.[0]?.filename || (target as any).fileName || `file_${Date.now()}.${extension}`;
      const localUri = `${cacheDirectory}${filename}`;

      showToast("Đang tải xuống...");
      const downloadRes = await downloadAsync(url, localUri);

      if (!downloadRes) throw new Error("Download failed");

      if (isMedia) {
        const MediaLibrary = require("expo-media-library");
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status === "granted") {
          await MediaLibrary.saveToLibraryAsync(downloadRes.uri);
          showToast("Đã lưu vào thiết bị!");
        } else {
          showToast("Không có quyền lưu tệp", "error");
        }
      } else {
        const Sharing = require("expo-sharing");
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(downloadRes.uri);
        } else {
          showToast("Không thể chia sẻ tệp này", "error");
        }
      }
      setSelectedMessage(null); // Hide menu
    } catch (error) {
      console.error("Download failed:", error);
      showToast("Lỗi khi tải xuống", "error");
    }
  };

  const handleDeleteMessage = (msg?: MessageDynamo) => {
    const target = msg || selectedMessage;
    if (!target) return;

    Alert.alert("Xóa tin nhắn", "Tin nhắn này sẽ được xóa ở phía bạn.", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: async () => {
          const mid = target.messageId;
          try {
            const newSet = new Set(deletedMessageIds);
            newSet.add(mid);
            setDeletedMessageIds(newSet);
            if (currentUserId) {
              await AsyncStorage.setItem(
                `DELETED_MESSAGES_${currentUserId}`,
                JSON.stringify(Array.from(newSet)),
              );
            }
          } catch (e) {
            // Error saving deleted message id
          }

          setMessages((prev) => prev.filter((m) => m.messageId !== mid));
          showToast("Đã xóa phía bạn");
          closeActionSheet();
        },
      },
    ]);
  };

  const handleStartReply = (msg?: MessageDynamo) => {
    const target = msg || selectedMessage;
    if (!target) return;
    setReplyTo({
      messageId: target.messageId,
      senderName: target.senderName,
      content: target.content || "[Tin nhắn]",
    });
    setShowActionSheet(false);
  };

  const handleOpenForward = (msg?: MessageDynamo) => {
    const target = msg || selectedMessage;
    if (!target) return;

    // Prevent forwarding messages that haven't been confirmed by server
    if (target.messageId.startsWith("temp-")) {
      showToast("Đang xử lý tin nhắn, vui lòng thử lại sau giây lát", "info");
      // Recovery: try to fetch messages again in case WS was missed
      fetchMessages();
      return;
    }

    setForwardingMessage(target);
    setForwardSearch("");
    setSelectedForwardRooms(new Set());
    setShowActionSheet(false);
    setShowForwardModal(true);
  };

  const toggleForwardRoom = (targetRoomId: string) => {
    setSelectedForwardRooms((prev) => {
      const next = new Set(prev);
      if (next.has(targetRoomId)) {
        next.delete(targetRoomId);
      } else {
        next.add(targetRoomId);
      }
      return next;
    });
  };

  const handleConfirmForward = async () => {
    if (
      !forwardingMessage ||
      !roomId ||
      forwardLoading ||
      selectedForwardRooms.size === 0
    )
      return;
    setForwardLoading(true);
    try {
      await Promise.all(
        Array.from(selectedForwardRooms).map((targetRoomId) =>
          MessageService.forwardMessage(
            roomId,
            forwardingMessage.messageId,
            targetRoomId,
          ),
        ),
      );
      setShowForwardModal(false);
      setForwardingMessage(null);
      setSelectedForwardRooms(new Set());
      showToast(
        selectedForwardRooms.size === 1
          ? "Đã chuyển tiếp tin nhắn!"
          : "Đã chuyển tiếp thành công!",
      );
    } catch (err) {
      showToast("Chuyển tiếp thất bại", "error");
    } finally {
      setForwardLoading(false);
    }
  };

  const handleTogglePin = (msg?: MessageDynamo) => {
    const target = msg || selectedMessage;
    if (!target || !roomId) return;
    if (!canPinMessage) {
      showToast("Bạn không có quyền ghim tin nhắn", "info");
      closeActionSheet();
      return;
    }
    const nextPin = !target.pinned;

    if (nextPin) {
      const pinnedCount = messages.filter((m) => m.pinned).length;
      if (pinnedCount >= 5) {
        showToast("Chỉ có thể ghim tối đa 5 tin nhắn", "info");
        closeActionSheet();
        return;
      }
    }

    webSocketService.sendPin({
      roomId,
      messageId: target.messageId,
      pin: nextPin,
      messageType: target.type || "TEXT",
    });
    closeActionSheet();
  };

  // Map userId -> tên hiển thị (từ tin nhắn trong phòng hoặc "Tôi")
  const reactionUserNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (currentUserId) map[currentUserId] = "Tôi";
    messages.forEach((m) => {
      if (m.senderId && m.senderName) map[m.senderId] = m.senderName;
    });
    return map;
  }, [messages, currentUserId]);

  // getImageUrl đã chuyển sang shared/utils/mediaUtils.ts

  const decodeAttachmentName = (raw?: string | null) => {
    if (!raw) return "";
    let value = raw.trim();
    if (!value) return "";
    // Một số backend/client gửi tên file dạng query-encoded hoặc double-encoded.
    for (let i = 0; i < 2; i += 1) {
      try {
        const normalized = value.replace(/\+/g, "%20");
        const decoded = decodeURIComponent(normalized);
        if (decoded === value) break;
        value = decoded;
      } catch {
        break;
      }
    }
    return value;
  };

  const getPinnedDisplayText = (m: MessageDynamo) => {
    if (m.recalled) return "Tin nhắn đã thu hồi";
    if (m.type === "POLL") return "[Bình chọn]";
    if (m.type === "IMAGE") return "[Hình ảnh]";
    if (m.type === "VIDEO") return "[Video]";
    if (m.type === "VOICE") return "[Tin nhắn thoại]";
    if (
      m.type === "FILE" ||
      m.type === "DOCUMENT" ||
      (m.attachments && m.attachments.length > 0)
    ) {
      const rawName =
        m.attachments?.[0]?.name ||
        m.attachments?.[0]?.filename ||
        "Tệp đính kèm";
      const fileName = decodeAttachmentName(rawName) || "Tệp đính kèm";
      return `[File] ${fileName}`;
    }
    if ((m.type === "TEXT" || m.type === "STORY_REPLY") && m.content && m.content.startsWith('{"type":"STORY_QUOTE"')) {
      return "[Khoảnh khắc]";
    }
    return m.content || "Tin nhắn đã ghim";
  };

  const galleryItems = useMemo(() => {
    return buildChatGalleryItems(messages, getImageUrl);
  }, [messages]);

  const handleGalleryOpen = useCallback(
    (resolvedMediaUrl: string) => {
      const idx = findChatGalleryIndex(resolvedMediaUrl, galleryItems);
      setGalleryIndex(idx);
      setGalleryCurrentIndex(idx);
    },
    [galleryItems],
  );

  /** Làm mịn vị trí khi mở gallery (initialScrollIndex lỗi trên một số máy) + sync index. */
  useEffect(() => {
    if (galleryIndex === null || galleryItems.length === 0) return;
    setGalleryCurrentIndex(galleryIndex);
    const id = requestAnimationFrame(() => {
      try {
        galleryRef.current?.scrollToIndex({
          index: galleryIndex,
          animated: false,
        });
      } catch {
        try {
          galleryRef.current?.scrollToOffset({
            offset: SCREEN_WIDTH * galleryIndex,
            animated: false,
          });
        } catch {
          /* empty */
        }
      }
    });
    return () => cancelAnimationFrame(id as unknown as number);
  }, [galleryIndex, galleryItems.length]);

  // ─── Render ───
  // Hàm scroll đến tin nhắn được ghim - xử lý đúng với inverted FlatList
  const scrollToPinnedMessage = useCallback(
    (pinnedMsgId: string) => {
      const idx = chatRows.findIndex((row) =>
        row.kind === "imageGroup"
          ? row.messages.some((m) => m.messageId === pinnedMsgId)
          : row.message.messageId === pinnedMsgId,
      );
      if (idx === -1) return;
      try {
        flatListRef.current?.scrollToIndex({
          index: idx,
          animated: true,
          viewPosition: 0.5,
        });
      } catch (e) {
        // Fallback: tính offset thủ công (estimate)
        flatListRef.current?.scrollToOffset({
          offset: idx * 80,
          animated: true,
        });
      }
    },
    [chatRows],
  );

  /** Đồng bộ pinned từ server (để web ghim/bỏ ghim mobile cập nhật ngay).
   *  Tối ưu: chỉ mutate các phần tử thực sự thay đổi để tránh FlatList reset scroll position. */
  const syncPinnedFromServer = useCallback(
    async (roomIdStr: string, opts?: { preserveIfEmpty?: boolean }) => {
      try {
        const pinResult = await chatService.getPinnedMessages(roomIdStr, 20);
        const raw = pinResult?.messages;
        const pinnedMsgs: MessageDynamo[] = Array.isArray(raw)
          ? raw.map((m) => ({ ...m, pinned: true }))
          : [];
        const preserveIfEmpty = opts?.preserveIfEmpty === true;
        const pinnedIds = new Set(
          pinnedMsgs.map((m) => m.messageId).filter(Boolean),
        );

        setMessages((curr) => {
          // Kiểm tra xem có gì thay đổi không
          const existingIds = new Set(curr.map((m) => m.messageId));

          // Tìm các pinned message chưa có trong danh sách hiện tại
          const newPinnedToAdd: MessageDynamo[] = [];
          for (const m of pinnedMsgs) {
            if (!m?.messageId || existingIds.has(m.messageId)) continue;
            newPinnedToAdd.push({ ...m, isOnlyPinned: true } as MessageDynamo);
          }

          // Nếu vừa ghim mà API pins trả rỗng (eventual consistency),
          // đừng xoá trạng thái pinned hiện có để tránh UI "Tin nhắn ghim" tự biến mất.
          const shouldClear = !(preserveIfEmpty && pinnedIds.size === 0);

          // Kiểm tra xem trạng thái pinned có thay đổi không
          let hasChanges = newPinnedToAdd.length > 0;
          if (!hasChanges && shouldClear) {
            for (const m of curr) {
              const shouldBePinned = pinnedIds.has(m.messageId);
              if (!!m.pinned !== shouldBePinned) {
                hasChanges = true;
                break;
              }
            }
          }

          // Nếu không có gì thay đổi, giữ nguyên reference để FlatList không re-render
          if (!hasChanges) return curr;

          // Chỉ thay đổi các phần tử cần thiết
          let result = curr.map((m) => {
            const newPinState = shouldClear ? pinnedIds.has(m.messageId) : !!m.pinned;
            if (!!m.pinned !== newPinState) {
              return { ...m, pinned: newPinState };
            }
            return m;
          });

          // Thêm các pinned message mới
          if (newPinnedToAdd.length > 0) {
            result = [...result, ...newPinnedToAdd];
            result.sort(
              (a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            );
          }

          return result;
        });
      } catch {
        // ignore
      }
    },
    [setMessages],
  );

  /** Dùng chung cho các link \"Xem\": đảm bảo tin đã có rồi mới cuộn. */
  const scrollToMessageEnsuringLoaded = useCallback(
    async (messageId: string) => {
      const mid = String(messageId || "").trim();
      if (!mid) return;
      const exists = messagesRef.current.some((m) => m.messageId === mid);
      if (!exists && roomId) {
        await syncPinnedFromServer(roomId);
      }
      scrollToPinnedMessage(mid);
      if (!messagesRef.current.some((m) => m.messageId === mid)) {
        showToast(
          "Không tìm thấy tin nhắn được ghim trong danh sách hiện tại",
          "info",
        );
      }
    },
    [roomId, scrollToPinnedMessage, showToast, syncPinnedFromServer],
  );

  const scrollToMessageId = useCallback(
    (messageId: string) => {
      void scrollToMessageEnsuringLoaded(messageId);
    },
    [scrollToMessageEnsuringLoaded],
  );

  const highlightedMessageId = useChatStore((s) => s.highlightedMessageId);
  const setHighlightedMessageId = useChatStore(
    (s) => s.setHighlightedMessageId,
  );

  /** Từ màn tìm kiếm tin nhắn: cuộn tới message (tải thêm lịch sử nếu cần). */
  useEffect(() => {
    if (!highlightedMessageId || !roomId || !isFocused || !loaded) return;

    const exists = messages.some((m) => m.messageId === highlightedMessageId);
    if (exists) {
      requestAnimationFrame(() => {
        scrollToPinnedMessage(highlightedMessageId);
      });
      const clearAnim = setTimeout(() => {
        setHighlightedMessageId(null);
      }, 5000); // 5 giây như yêu cầu cho unread jump (dùng chung cho search)
      return () => clearTimeout(clearAnim);
    }

    if (loadingMoreRef.current) {
      return;
    }

    if (hasMoreRef.current) {
      void fetchMessages(true);
      return;
    }

    showToast("Không tìm thấy tin nhắn trong cuộc trò chuyện", "info");
    setHighlightedMessageId(null);
  }, [
    highlightedMessageId,
    messages,
    loaded,
    isFocused,
    roomId,
    fetchMessages,
    scrollToPinnedMessage,
    showToast,
    setHighlightedMessageId,
  ]);

  const lastMyMessageId = useMemo(() => {
    const lastRow = chatRows.find(
      (r) =>
        (r.kind === "message" && r.message.senderId === currentUserId) ||
        (r.kind === "imageGroup" && r.messages[0].senderId === currentUserId)
    );
    if (lastRow?.kind === "message") return lastRow.message.messageId;
    if (lastRow?.kind === "imageGroup") return lastRow.messages[0].messageId;
    return null;
  }, [chatRows, currentUserId]);

  const renderMessage = ({ item }: { item: MobileChatRow }) => {
    if (item.kind === "imageGroup") {
      const newest = item.messages[0];
      const isMe = newest.senderId === currentUserId;

      const replySource =
        newest.replyToMessageId &&
        messages.find((m) => m.messageId === newest.replyToMessageId);

      const room = rooms.find((r) => r.id === roomId);
      const sender = room?.participants?.find(
        (p: any) => p.id === newest.senderId,
      ) as any;
      const senderAvatarUrl = sender?.avatarUrl || "";

      const hlSearch =
        !!highlightedMessageId &&
        item.messages.some((m) => m.messageId === highlightedMessageId);

      return (
        <MessageBubble
          message={newest}
          imageGroupMessages={item.messages}
          isMe={isMe}
          showSenderName={roomType === "GROUP"}
          isSearchHighlight={hlSearch}
          onPress={handleMessagePress}
          onLongPress={handleMessageLongPress}
          onPressReactions={(msg) => setReactionListMessage(msg)}
          onForward={handleOpenForward}
          onRecall={handleRecall}
          onDelete={handleDeleteMessage}
          onReply={handleStartReply}
          onTogglePin={handleTogglePin}
          senderAvatarUrl={senderAvatarUrl}
          replyPreview={
            replySource
              ? {
                senderName: replySource.senderName,
                content: replySource.content || "[Tin nhắn]",
              }
              : null
          }
          partnerName={displayName}
          onAddFriend={() => {
            if (targetUserIdStr) {
              useFriendStore
                .getState()
                .sendRequest(targetUserIdStr)
                .then(() => {
                  fetchSentRequests();
                  showToast("Đã gửi lời mời kết bạn", "success");
                })
                .catch(() => showToast("Gửi lời mời kết bạn thất bại", "error"));
            }
          }}
          onImagePress={(url) => handleGalleryOpen(url)}
          onScrollToMessageId={scrollToMessageId}
          isLastMyMessage={newest.messageId === lastMyMessageId}
          readByIds={newest.readBy?.filter(id => id !== currentUserId)}
          participants={room?.participants || []}
          isGroup={roomType === "GROUP"}
          onShowReadReceipts={(msg) => setSelectedReceiptMsg(msg)}
        />
      );
    }

    const itemMsg = item.message;
    const isMe = itemMsg.senderId === currentUserId;

    const isAdminSender =
      roomType === "GROUP" &&
      highlightAdminPref &&
      !isMe &&
      !!itemMsg.senderId &&
      (String(itemMsg.senderId) === String(groupDetail?.ownerId) ||
        groupDetail?.members?.some(
          (m) => String(m.userId) === String(itemMsg.senderId) && m.role === "ADMIN",
        ) === true) &&
      itemMsg.type !== "SYSTEM" &&
      itemMsg.type !== "PIN_NOTIFICATION";

    // ─── PIN_NOTIFICATION: hiển thị dạng thông báo hệ thống giữa chat ───
    if (
      itemMsg.type === "PIN_NOTIFICATION" ||
      (itemMsg.senderId === "system" && itemMsg.type !== "SYSTEM")
    ) {
      const pinnedMsgId = itemMsg.replyToMessageId;
      // "đã ghim" xuất hiện trong cả "đã ghim" và "đã bỏ ghim", dùng điều kiện chặt hơn
      const isPinAction =
        !!itemMsg.content &&
        itemMsg.content.includes("đã ghim") &&
        !itemMsg.content.includes("bỏ ghim");
      return (
        <View
          style={{
            alignItems: "center",
            marginVertical: 6,
            paddingHorizontal: 16,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor:
                theme === "dark"
                  ? "rgba(255,255,255,0.07)"
                  : "rgba(0,0,0,0.05)",
              borderRadius: 20,
              paddingHorizontal: 14,
              paddingVertical: 7,
              maxWidth: "90%",
            }}
          >
            <Ionicons
              name={isPinAction ? "bookmark" : "bookmark-outline"}
              size={14}
              color={isPinAction ? "#f59e0b" : colors.textSecondary}
              style={{ marginRight: 6 }}
            />
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 12.5,
                flexShrink: 1,
              }}
              numberOfLines={2}
            >
              {itemMsg.content}
            </Text>
            {isPinAction && pinnedMsgId && (
              <TouchableOpacity
                onPress={() => void scrollToMessageEnsuringLoaded(pinnedMsgId)}
                style={{ marginLeft: 6 }}
              >
                <Text
                  style={{
                    color: colors.primary,
                    fontSize: 12.5,
                    fontWeight: "600",
                  }}
                >
                  Xem
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    }

    const replySource =
      itemMsg.replyToMessageId &&
      messages.find((m) => m.messageId === itemMsg.replyToMessageId);

    const room = rooms.find((r) => r.id === roomId);
    const sender = room?.participants?.find(
      (p: any) => p.id === itemMsg.senderId,
    ) as any;
    const senderAvatarUrl = sender?.avatarUrl || "";

    return (
      <MessageBubble
        message={itemMsg}
        isMe={isMe}
        showSenderName={roomType === "GROUP"}
        isSearchHighlight={highlightedMessageId === itemMsg.messageId}
        isAdminHighlight={isAdminSender}
        onPress={handleMessagePress}
        onLongPress={handleMessageLongPress}
        onPressReactions={(msg) => setReactionListMessage(msg)}
        onForward={handleOpenForward}
        onRecall={handleRecall}
        onDelete={handleDeleteMessage}
        onReply={handleStartReply}
        onTogglePin={handleTogglePin}
        senderAvatarUrl={senderAvatarUrl}
        replyPreview={
          replySource
            ? {
              senderName: replySource.senderName,
              content: replySource.content || "[Tin nhắn]",
            }
            : null
        }
        partnerName={displayName}
          onAddFriend={() => {
          if (targetUserIdStr) {
            useFriendStore
              .getState()
              .sendRequest(targetUserIdStr)
              .then(() => {
                fetchSentRequests();
                showToast("Đã gửi lời mời kết bạn", "success");
              })
              .catch(() => showToast("Gửi lời mời kết bạn thất bại", "error"));
          }
        }}
        onImagePress={(url) => handleGalleryOpen(url)}
        onScrollToMessageId={scrollToMessageId}
        isLastMyMessage={itemMsg.messageId === lastMyMessageId}
        readByIds={itemMsg.readBy?.filter(id => id !== currentUserId)}
        participants={room?.participants || []}
        isGroup={roomType === "GROUP"}
        onShowReadReceipts={(msg) => setSelectedReceiptMsg(msg)}
      />
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {wallpaperUri ? (
        <>
          <Image
            source={{ uri: wallpaperUri }}
            style={[StyleSheet.absoluteFillObject, { zIndex: 0 }]}
            resizeMode="cover"
          />
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              {
                zIndex: 1,
                backgroundColor:
                  theme === "dark"
                    ? "rgba(0,0,0,0.72)"
                    : "rgba(255,255,255,0.88)",
              },
            ]}
          />
        </>
      ) : null}
      <View style={{ flex: 1, zIndex: 2 }}>
        <ChatHeader
          name={displayName}
          roomType={roomType}
          isStranger={isStranger}
          strangerSubtitleRow={
            isStrangerEmptyThread ? { visible: true } : undefined
          }
          showMenuBadge={roomType === "GROUP" ? groupJoinPendingBadge : false}
          onMenuPress={() => {
            if (roomType === "GROUP") {
              openGroupInfo();
            } else {
              openChatOptions();
            }
          }}
          onAiPress={() => setShowAiMenu(true)}
        />

        <AiOptionsBottomSheet
          visible={showAiMenu}
          onClose={() => setShowAiMenu(false)}
          onSelectSummarize={() => setShowAiModal(true)}
          onSelectPersona={() => setShowAiPersonaModal(true)}
          onSelectTask={(mode) => {
            setAiTaskMode(mode);
            setShowAiTaskModal(true);
          }}
        />

        <AiTaskModal
          visible={showAiTaskModal}
          mode={aiTaskMode}
          roomId={typeof roomId === "string" ? roomId : (id || "")}
          onClose={() => setShowAiTaskModal(false)}
        />

        <AiPersonaBotModal
          visible={showAiPersonaModal}
          onClose={() => setShowAiPersonaModal(false)}
        />

        <AiSummaryModal
          visible={showAiModal}
          roomId={typeof roomId === "string" ? roomId : (id || "")}
          onClose={() => setShowAiModal(false)}
          onSummarize={async (startTime, endTime) => {
            const roomIdStr = typeof roomId === "string" ? roomId : id;
            if (!roomIdStr) return "Không rõ ID vòng chat.";
            return await chatService.summarizeChat(roomIdStr, startTime, endTime);
          }}
        />

        {/* Modal Tóm tắt tin nhắn CHƯA ĐỌC - UI HOÀN TOÀN MỚI */}
        <UnreadAiSummaryModal
          visible={showUnreadAiModal}
          unreadCount={initialUnreadCount}
          onClose={() => {
            setShowUnreadAiModal(false);
            setAiSummaryDates({});
          }}
          onSummarize={async () => {
            const roomIdStr = typeof roomId === "string" ? roomId : id;
            if (!roomIdStr) return "Không rõ ID vòng chat.";

            // Sử dụng mốc thời gian từ tin nhắn chưa đọc cổ nhất, và bật mode isUnreadOnly
            const startTime = aiSummaryDates.start?.toISOString() || new Date(Date.now() - 3600000).toISOString();
            const endTime = aiSummaryDates.end?.toISOString() || new Date().toISOString();

            return await chatService.summarizeChat(roomIdStr, startTime, endTime, true);
          }}
        />

        {/* Thanh trắng Kết bạn — ngay dưới header (hội thoại trống + người lạ), giống Zalo */}
        {isStrangerEmptyThread && roomType === "DIRECT" && (
          <View
            style={{
              backgroundColor: theme === "dark" ? colors.card : "#ffffff",
              paddingVertical: 10,
              alignItems: "center",
              justifyContent: "center",
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.border,
            }}
          >
            <TouchableOpacity
              onPress={handleStrangerFriendPress}
              disabled={friendRequestStatus === "SENT"}
              activeOpacity={0.75}
              style={{
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <Ionicons
                name={
                  friendRequestStatus === "SENT"
                    ? "time-outline"
                    : friendRequestStatus === "INCOMING"
                      ? "person-add"
                      : "person-add-outline"
                }
                size={20}
                color={
                  friendRequestStatus === "SENT"
                    ? colors.textSecondary
                    : colors.primary
                }
                style={{ marginRight: 8 }}
              />
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "600",
                  color:
                    friendRequestStatus === "SENT"
                      ? colors.textSecondary
                      : colors.text,
                }}
              >
                {friendRequestStatus === "SENT"
                  ? "Đã gửi lời mời"
                  : friendRequestStatus === "INCOMING"
                    ? "Chấp nhận kết bạn"
                    : "Kết bạn"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Banner người lạ - Kết bạn (khi đã có hoạt động trong hội thoại — tránh trùng với hàng header + thẻ preview) */}
        {isStranger && roomType === "DIRECT" && !isStrangerEmptyThread && (
          <View
            style={{
              backgroundColor: theme === "dark" ? "#1c1c1e" : "#f0f2f5",
              paddingVertical: 10,
              alignItems: "center",
              borderBottomWidth: 0.5,
              borderBottomColor: colors.border,
            }}
          >
            <TouchableOpacity
              onPress={() => {
                if (resolvedTargetUserId) {
                  if (friendRequestStatus === "NONE") {
                    useFriendStore
                      .getState()
                      .sendRequest(resolvedTargetUserId)
                      .then(() => {
                        fetchSentRequests();
                        Alert.alert("Thành công", "Đã gửi lời mời kết bạn.");
                      })
                      .catch(() =>
                        Alert.alert("Lỗi", "Gửi lời mời kết bạn thất bại."),
                      );
                  } else if (friendRequestStatus === "INCOMING") {
                    const req = requests.find((r: any) => {
                      const id = r?.user?.id || r?.userId || r?.friend?.id;
                      return id === resolvedTargetUserId;
                    });
                    if (req) {
                      useFriendStore
                        .getState()
                        .acceptRequest(req.id)
                        .then(() => {
                          fetchFriends();
                          setShowWelcomePicker(true);
                          showToast("Đã chấp nhận lời mời kết bạn", "success");
                        })
                        .catch(() =>
                          Alert.alert(
                            "Lỗi",
                            "Chấp nhận lời mời kết bạn thất bại.",
                          ),
                        );
                    }
                  }
                }
              }}
              disabled={friendRequestStatus === "SENT"}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor:
                  friendRequestStatus === "SENT" ? "#e1e4e8" : "#fff",
                paddingHorizontal: 20,
                paddingVertical: 8,
                borderRadius: 20,
                borderWidth: 1,
                borderColor:
                  friendRequestStatus === "SENT" ? "#e1e4e8" : colors.border,
                elevation: 2,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 2,
              }}
            >
              <Ionicons
                name={
                  friendRequestStatus === "SENT"
                    ? "time-outline"
                    : friendRequestStatus === "INCOMING"
                      ? "person-add"
                      : "person-add"
                }
                size={18}
                color={
                  friendRequestStatus === "SENT"
                    ? colors.textSecondary
                    : colors.primary
                }
                style={{ marginRight: 8 }}
              />
              <Text
                style={{
                  color:
                    friendRequestStatus === "SENT"
                      ? colors.textSecondary
                      : colors.text,
                  fontWeight: "600",
                  fontSize: 15,
                }}
              >
                {friendRequestStatus === "SENT"
                  ? "Đã gửi lời mời"
                  : friendRequestStatus === "INCOMING"
                    ? "Chấp nhận kết bạn"
                    : "Kết bạn"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Header pinned messages */}
        {messages.some((m) => m.pinned) &&
          (() => {
            const pinned = messages.filter((m) => m.pinned);
            const latest = pinned[0];
            if (!latest) return null;

            const getIcon = (m: MessageDynamo) => {
              if (m.type === "IMAGE") return "image-outline";
              if (m.type === "VIDEO") return "videocam-outline";
              if (m.type === "VOICE") return "mic-outline";
              if (m.type === "POLL") return "stats-chart-outline";
              if (
                m.type === "FILE" ||
                m.type === "DOCUMENT" ||
                (m.attachments && m.attachments.length > 0)
              )
                return "document-text-outline";
              return "pin-outline";
            };

            return (
              <View
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderBottomWidth: 0.5,
                  borderBottomColor:
                    theme === "dark"
                      ? "rgba(255,255,255,0.1)"
                      : "rgba(0,0,0,0.05)",
                  backgroundColor: theme === "dark" ? "#1c1c1e" : "#eef6ff",
                }}
              >
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={{
                    borderRadius: 8,
                    paddingHorizontal: 8,
                    paddingVertical: 6,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                  onPress={() => setShowPinnedList(true)}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      flex: 1,
                    }}
                  >
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor:
                          theme === "dark"
                            ? "rgba(255,255,255,0.1)"
                            : "rgba(0,104,255,0.1)",
                        justifyContent: "center",
                        alignItems: "center",
                        marginRight: 8,
                      }}
                    >
                      <Ionicons
                        name={getIcon(latest)}
                        size={14}
                        color={colors.primary}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text
                        numberOfLines={1}
                        style={{
                          color: colors.primary,
                          fontSize: 13,
                          fontWeight: "600",
                        }}
                      >
                        Tin nhắn ghim
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={{
                          color: colors.textSecondary,
                          fontSize: 12,
                          marginTop: -1,
                        }}
                      >
                        {getPinnedDisplayText(latest)}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginLeft: 8,
                    }}
                  >
                    {pinned.length > 1 && (
                      <View
                        style={{
                          backgroundColor:
                            theme === "dark"
                              ? "rgba(255,255,255,0.1)"
                              : "rgba(0,0,0,0.05)",
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 10,
                          marginRight: 6,
                        }}
                      >
                        <Text
                          style={{
                            color: colors.textSecondary,
                            fontSize: 10,
                            fontWeight: "700",
                          }}
                        >
                          +{pinned.length - 1}
                        </Text>
                      </View>
                    )}
                    <Ionicons
                      name="chevron-down"
                      size={16}
                      color={colors.textSecondary}
                    />
                  </View>
                </TouchableOpacity>
              </View>
            );
          })()}

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={0}
          style={{ flex: 1 }}
        >
          <View style={{ flex: 1 }}>
            {initialUnreadCount > 0 && (
              <View
                style={{
                  position: "absolute",
                  top: 10,
                  alignSelf: "center",
                  flexDirection: "row",
                  alignItems: "center",
                  zIndex: 999,
                  backgroundColor: colors.primary,
                  borderRadius: 24,
                  padding: 2, // Tạo khoảng hở cho border bên trong nếu cần
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 5,
                  elevation: 8,
                }}
              >
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleJumpToUnread}
                  style={{
                    paddingVertical: 8,
                    paddingLeft: 16,
                    paddingRight: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    borderRightWidth: 1,
                    borderRightColor: "rgba(255,255,255,0.2)",
                  }}
                >
                  <Ionicons
                    name="arrow-up"
                    size={16}
                    color="white"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={{ color: "white", fontSize: 13, fontWeight: "700" }}>
                    {initialUnreadCount} tin nhắn mới
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleAiSummarizeUnread}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <Ionicons
                    name="sparkles"
                    size={18}
                    color="#FFD700"
                    style={{ marginRight: 4 }}
                  />
                  <Text style={{ color: "white", fontSize: 13, fontWeight: "700" }}>
                    AI
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <FlatList
              style={{ flex: 1 }}
              ref={flatListRef}
              data={chatRows}
              inverted
              {...(Platform.OS !== "web" ? {
                maintainVisibleContentPosition: {
                  minIndexForVisible: 1,
                  autoscrollToTopThreshold: 80,
                },
              } : {})}
              keyExtractor={(row) =>
                row.kind === "imageGroup"
                  ? `ig-${row.messages.map((m) => m.messageId || "x").join("-")}`
                  : `${row.message.messageId || "msg"}`
              }
              renderItem={renderMessage}
              contentContainerStyle={{ paddingVertical: 8, flexGrow: 1 }}
              showsVerticalScrollIndicator={false}
              onTouchStart={() => footerRef.current?.closeEmojiPicker()}
              onScrollBeginDrag={() => footerRef.current?.closeEmojiPicker()}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.5}
              initialNumToRender={15}
              maxToRenderPerBatch={10}
              windowSize={11}
              onViewableItemsChanged={onViewableItemsChangedHandler}
              viewabilityConfig={viewabilityConfig}
              onScroll={(e) => {
                const offset = e.nativeEvent.contentOffset.y;
                // FlatList inverted: offset gần 0 có nghĩa là đang ở dưới cùng
                isAtBottomRef.current = offset < 50;

                if (offset > 400) {
                  if (!showScrollToBottom) setShowScrollToBottom(true);
                } else {
                  if (showScrollToBottom) setShowScrollToBottom(false);
                }
              }}
              removeClippedSubviews={Platform.OS === "android"}
              onScrollToIndexFailed={(info) => {
                // Item chưa render trong viewport — scroll đến vị trí ước tính
                // rồi retry sau khi layout xong
                const offset = info.averageItemLength * info.index;
                flatListRef.current?.scrollToOffset({ offset, animated: false });
                setTimeout(() => {
                  flatListRef.current?.scrollToIndex({
                    index: info.index,
                    animated: true,
                    viewPosition: 0.5,
                  });
                }, 200);
              }}
              ListFooterComponent={
                <View style={{ paddingBottom: 20 }}>
                  {isLoadingMore ? (
                    <View style={{ paddingVertical: 10 }}>
                      <ActivityIndicator size="small" color={colors.primary} />
                    </View>
                  ) : null}
                </View>
              }
              ListEmptyComponent={() => (
                <View
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                    transform: [{ scaleY: -1 }],
                  }}
                >
                  {loaded && isStrangerEmptyThread ? (
                    <View style={{ height: 1 }} />
                  ) : loaded ? (
                    <Text style={{ color: colors.textSecondary }}>
                      Hãy gửi tin nhắn đầu tiên! 👋
                    </Text>
                  ) : (
                    <Text style={{ color: colors.textSecondary }}>
                      Đang tải tin nhắn...
                    </Text>
                  )}
                </View>
              )}
            />
            {isStrangerEmptyThread ? (
              <StrangerProfilePreviewCard
                displayName={
                  partnerProfileDetail?.displayName?.trim() || displayName
                }
                avatarUrl={
                  (partnerProfileDetail?.avatarUrl ?? partnerAvatar) || null
                }
                coverPhotoUrl={partnerProfileDetail?.coverPhotoUrl ?? null}
              />
            ) : null}
          </View>
          {isGroupDisbanded ? (
            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderTopWidth: 1,
                borderTopColor: colors.border,
                backgroundColor: colors.card,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 13,
                  textAlign: "center",
                }}
              >
                Nhóm đã được giải tán. Bạn không thể gửi tin nhắn vào nhóm này nữa.
              </Text>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={async () => {
                  if (!roomId) return;
                  try {
                    await useChatStore.getState().deleteRoom(roomId);
                    router.back();
                  } catch {
                    showToast("Không xóa được cuộc trò chuyện", "error");
                  }
                }}
                style={{ marginTop: 10 }}
              >
                <Text
                  style={{
                    color: colors.primary,
                    fontSize: 14,
                    fontWeight: "600",
                    textAlign: "center",
                  }}
                >
                  Xóa trò chuyện
                </Text>
              </TouchableOpacity>
            </View>
          ) : roomType === "DIRECT" &&
            blockStatus &&
            (blockStatus.blockedByYou || blockStatus.blockedByOther) ? (
            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 16,
                borderTopWidth: 1,
                borderTopColor: colors.border,
                backgroundColor: colors.card,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: colors.text,
                  fontSize: 13,
                  marginBottom: blockStatus.blockedByYou ? 10 : 0,
                  textAlign: "center",
                }}
              >
                {blockStatus.blockedByYou
                  ? "Bạn đã chặn tin nhắn"
                  : "Bạn đã bị chặn tin nhắn"}
              </Text>
              {blockStatus.blockedByYou && partnerId && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={async () => {
                    try {
                      await unblockUser(partnerId);
                      setBlockStatus({
                        blockedByYou: false,
                        blockedByOther: false,
                        blockerName: null,
                      });
                    } catch {
                      showToast("Không bỏ chặn được người này", "error");
                    }
                  }}
                  style={{
                    marginTop: 8,
                    alignSelf: "center",
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: colors.primary,
                  }}
                >
                  <Text
                    style={{
                      color: "#ffffff",
                      fontSize: 14,
                      fontWeight: "600",
                    }}
                  >
                    Bỏ chặn
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              {/* Typing Indicator */}
              {Object.keys(typingUsers).length > 0 && !isVoiceActive && (
                <View
                  style={{
                    backgroundColor: "#f9fafb",
                    paddingHorizontal: 16,
                    paddingVertical: 6,
                    flexDirection: "row",
                    alignItems: "center",
                    borderTopWidth: 1,
                    borderTopColor: "#f3f4f6",
                    borderBottomWidth: 1,
                    borderBottomColor: "#f3f4f6",
                  }}
                >
                  <View style={{ flexDirection: "row", marginRight: 8 }}>
                    <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: "#3b82f6", marginRight: 3 }} />
                    <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: "#3b82f6", marginRight: 3, opacity: 0.6 }} />
                    <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: "#3b82f6", opacity: 0.3 }} />
                  </View>
                  <Text style={{ fontSize: 11, color: "#2563eb", fontWeight: "600", fontStyle: "italic" }}>
                    {(() => {
                      const names = Object.values(typingUsers);
                      if (names.length === 1) return `${names[0]} đang soạn tin...`;
                      return `${names.length} người đang soạn tin...`;
                    })()}
                  </Text>
                </View>
              )}
              <ChatFooter
                ref={footerRef}
                roomId={activeRoomId || undefined}
              onSend={handleSend}
              onSendImage={handleSendImage}
              onSendFile={handleSendFile}
              disabled={!canSendMessage}
              disabledText={
                isGroupDisbanded
                  ? "Nhóm đã giải tán"
                  : "Chỉ trưởng/phó nhóm được gửi tin nhắn"
              }
              onCreatePoll={
                roomType === "GROUP" && roomId && roomId !== "new" && canCreatePoll
                  ? () =>
                    router.push(
                      `/create-poll?roomId=${encodeURIComponent(roomId)}&groupName=${encodeURIComponent(displayName)}`,
                    )
                  : undefined
              }
              uploadProgress={uploadState?.progress ?? null}
              uploadText={uploadState?.text}
              replyTo={replyTo}
              onCancelReply={() => setReplyTo(null)}
              onVoiceActiveChange={setIsVoiceActive}
            />
          </>
          )}

          {showScrollToBottom && !isVoiceActive && (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
                setShowScrollToBottom(false);
              }}
              style={{
                position: "absolute",
                bottom: 85, // Phía trên ô nhập text (ChatFooter cao tầm 60-70px)
                right: 16,
                width: 42,
                height: 42,
                borderRadius: 21,
                backgroundColor: theme === "dark" ? "#2c2c2e" : "#ffffff",
                justifyContent: "center",
                alignItems: "center",
                elevation: 5,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 4,
                zIndex: 1000,
                borderWidth: 1,
                borderColor: theme === "dark" ? "#3a3a3c" : "#e5e5ea",
              }}
            >
              <Ionicons name="chevron-down" size={24} color={colors.primary} />
            </TouchableOpacity>
          )}
        </KeyboardAvoidingView>

        {/* Action sheet khi nhấn giữ tin nhắn */}
        <Modal
          transparent
          animationType="fade"
          visible={showActionSheet && !!selectedMessage}
          onRequestClose={closeActionSheet}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.5)",
              justifyContent: "flex-end",
            }}
            onPress={closeActionSheet}
          >
            <View
              style={{
                backgroundColor: colors.card,
                paddingBottom: 32,
                paddingTop: 12,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: -3 },
                shadowOpacity: 0.1,
                shadowRadius: 10,
                elevation: 20,
              }}
            >
              <View
                style={{
                  alignSelf: "center",
                  width: 36,
                  height: 5,
                  borderRadius: 999,
                  backgroundColor: colors.border,
                  marginBottom: 20,
                }}
              />

              {/* Hàng reaction giống Zalo */}
              {selectedMessage && !selectedMessage.recalled && (
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-around",
                    marginBottom: 16,
                    paddingHorizontal: 24,
                  }}
                >
                  {["❤️", "👍", "😂", "😮", "😢", "😡"].map((emoji) => (
                    <TouchableOpacity
                      key={emoji}
                      onPress={async () => {
                        if (!selectedMessage || !roomId || !currentUserId) return;

                        // Optimistic UI update
                        const emojiToSet = emoji;
                        const msgId = selectedMessage.messageId;

                        setMessages((prev) =>
                          prev.map((m) => {
                            if (m.messageId === msgId) {
                              const existingReactions = Array.isArray(m.reactions)
                                ? m.reactions
                                : [];
                              // Find if I already reacted with THIS SPECIFIC emoji
                              const sameEmojiIndex = existingReactions.findIndex(
                                (r) =>
                                  r.userId === currentUserId &&
                                  r.emoji === emojiToSet,
                              );

                              let nextReactions = [...existingReactions];

                              if (sameEmojiIndex >= 0) {
                                // Toggle off this specific emoji
                                nextReactions.splice(sameEmojiIndex, 1);
                              } else {
                                // Add this emoji (keep other emojis from me)
                                nextReactions.push({
                                  userId: currentUserId,
                                  emoji: emojiToSet,
                                });
                              }
                              return { ...m, reactions: nextReactions };
                            }
                            return m;
                          }),
                        );

                        // Close sheet immediately for smoothness
                        closeActionSheet();

                        // Send to server in background
                        try {
                          await MessageService.setReaction(
                            roomId,
                            msgId,
                            emojiToSet,
                          );
                        } catch (err) {
                          // If error, we might want to revert but for "smoothness" and Zalo-like feel,
                          // often we just let it be or show a quiet toast
                          console.error("Reaction failed sync:", err);
                        }
                      }}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: colors.card,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text style={{ fontSize: 22 }}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}

                  {/* Biểu tượng gỡ cảm xúc */}
                  {selectedMessage?.reactions?.some(
                    (r) => r.userId === currentUserId,
                  ) && (
                      <TouchableOpacity
                        onPress={async () => {
                          if (!selectedMessage || !roomId || !currentUserId) return;
                          const msgId = selectedMessage.messageId;

                          // Optimistic UI update: gỡ toàn bộ reactions của tôi
                          setMessages((prev) =>
                            prev.map((m) => {
                              if (m.messageId === msgId) {
                                const nextReactions = (m.reactions || []).filter(
                                  (r) => r.userId !== currentUserId,
                                );
                                return { ...m, reactions: nextReactions };
                              }
                              return m;
                            }),
                          );

                          closeActionSheet();

                          try {
                            await MessageService.removeReaction(roomId, msgId);
                          } catch (err) {
                            console.error("Remove reaction failed sync:", err);
                          }
                        }}
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                          backgroundColor: colors.card,
                          alignItems: "center",
                          justifyContent: "center",
                          borderWidth: 1,
                          borderColor: "#ef4444", // red border for remove action
                        }}
                      >
                        <Ionicons name="trash-outline" size={22} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                </View>
              )}

              {selectedMessage &&
                selectedMessage.senderId === currentUserId &&
                !selectedMessage.recalled && (
                  <TouchableOpacity
                    onPress={() => handleRecall()}
                    style={{
                      paddingVertical: 12,
                      paddingHorizontal: 20,
                      flexDirection: "row",
                      alignItems: "center",
                    }}
                  >
                    <Ionicons
                      name="refresh-outline"
                      size={20}
                      color="#ea580c"
                      style={{ marginRight: 12 }}
                    />
                    <Text
                      style={{
                        color: "#ea580c",
                        fontSize: 16,
                        fontWeight: "600",
                      }}
                    >
                      Thu hồi tin nhắn
                    </Text>
                  </TouchableOpacity>
                )}

              {selectedMessage && !selectedMessage.recalled && (
                <TouchableOpacity
                  onPress={() => handleStartReply()}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 20,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <Ionicons
                    name="arrow-redo-outline"
                    size={20}
                    color={colors.text}
                    style={{ marginRight: 12 }}
                  />
                  <Text style={{ color: colors.text, fontSize: 16 }}>
                    Trả lời
                  </Text>
                </TouchableOpacity>
              )}

              {selectedMessage &&
                !selectedMessage.recalled &&
                (selectedMessage.type === "TEXT" ||
                  selectedMessage.type === "IMAGE") && (
                  <TouchableOpacity
                    onPress={() => handleCopyMessage()}
                    style={{
                      paddingVertical: 12,
                      paddingHorizontal: 20,
                      flexDirection: "row",
                      alignItems: "center",
                    }}
                  >
                    <Ionicons
                      name="copy-outline"
                      size={20}
                      color={colors.text}
                      style={{ marginRight: 12 }}
                    />
                    <Text style={{ color: colors.text, fontSize: 16 }}>
                      Sao chép
                    </Text>
                  </TouchableOpacity>
                )}

              {selectedMessage &&
                !selectedMessage.recalled &&
                (selectedMessage.type === "IMAGE" ||
                  selectedMessage.type === "VIDEO" ||
                  selectedMessage.type === "FILE" ||
                  selectedMessage.type === "DOCUMENT") && (
                  <TouchableOpacity
                    onPress={() => handleDownloadMessage()}
                    style={{
                      paddingVertical: 12,
                      paddingHorizontal: 20,
                      flexDirection: "row",
                      alignItems: "center",
                    }}
                  >
                    <Ionicons
                      name="download-outline"
                      size={20}
                      color={colors.text}
                      style={{ marginRight: 12 }}
                    />
                    <Text style={{ color: colors.text, fontSize: 16 }}>
                      Tải về
                    </Text>
                  </TouchableOpacity>
                )}

              {selectedMessage && !selectedMessage.recalled && (
                <TouchableOpacity
                  onPress={() => handleOpenForward()}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 20,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <Ionicons
                    name="share-outline"
                    size={20}
                    color="#60a5fa"
                    style={{ marginRight: 12 }}
                  />
                  <Text
                    style={{ color: "#60a5fa", fontSize: 16, fontWeight: "500" }}
                  >
                    Chuyển tiếp
                  </Text>
                </TouchableOpacity>
              )}

              {selectedMessage && !selectedMessage.recalled && (
                <TouchableOpacity
                  onPress={() => handleTogglePin()}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 20,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <Ionicons
                    name={selectedMessage.pinned ? "pin" : "pin-outline"}
                    size={20}
                    color={colors.text}
                    style={{ marginRight: 12 }}
                  />
                  <Text style={{ color: colors.text, fontSize: 16 }}>
                    {selectedMessage.pinned ? "Bỏ ghim" : "Ghim"}
                  </Text>
                </TouchableOpacity>
              )}

              {selectedMessage && (
                <TouchableOpacity
                  onPress={() => handleDeleteMessage()}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 20,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <Ionicons
                    name="trash-outline"
                    size={20}
                    color="#ef4444"
                    style={{ marginRight: 12 }}
                  />
                  <Text
                    style={{ color: "#ef4444", fontSize: 16, fontWeight: "500" }}
                  >
                    Xóa
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={closeActionSheet}
                style={{
                  paddingVertical: 14,
                  paddingHorizontal: 20,
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <Ionicons
                  name="close-outline"
                  size={20}
                  color={colors.textSecondary}
                  style={{ marginRight: 12 }}
                />
                <Text style={{ color: colors.textSecondary, fontSize: 16 }}>
                  Đóng
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Danh sách tin nhắn đã ghim - overlay dạng bottom sheet */}
        <Modal
          transparent
          animationType="slide"
          visible={showPinnedList}
          onRequestClose={() => setShowPinnedList(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.5)",
              justifyContent: "flex-end",
            }}
            onPress={() => setShowPinnedList(false)}
          >
            <View
              style={{
                backgroundColor: colors.card,
                paddingTop: 16,
                paddingBottom: 32,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                maxHeight: "75%",
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: -2 },
                shadowOpacity: 0.1,
                shadowRadius: 10,
                elevation: 20,
              }}
            >
              <Text
                style={{
                  color: colors.text,
                  fontSize: 17,
                  fontWeight: "700",
                  textAlign: "center",
                  marginBottom: 12,
                }}
              >
                Tin nhắn đã ghim
              </Text>

              <View
                style={{
                  maxHeight: "100%",
                }}
              >
                {messages.filter((m) => m.pinned).length === 0 ? (
                  <Text
                    style={{
                      color: colors.textSecondary,
                      textAlign: "center",
                      paddingVertical: 40,
                    }}
                  >
                    Chưa có tin nhắn nào được ghim.
                  </Text>
                ) : (
                  messages
                    .filter((m) => m.pinned)
                    .map((m) => (
                      <TouchableOpacity
                        key={m.messageId}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          paddingVertical: 12,
                          paddingHorizontal: 16,
                          borderBottomWidth: 0.5,
                          borderBottomColor: colors.border,
                        }}
                        onPress={() => {
                          const index = chatRows.findIndex((row) =>
                            row.kind === "imageGroup"
                              ? row.messages.some(
                                (x) => x.messageId === m.messageId,
                              )
                              : row.message.messageId === m.messageId,
                          );
                          if (index >= 0) {
                            flatListRef.current?.scrollToIndex({
                              index,
                              animated: true,
                            });
                          }
                          setShowPinnedList(false);
                        }}
                      >
                        {/* Icon based on type */}
                        <View
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 10,
                            backgroundColor:
                              theme === "dark"
                                ? "rgba(255,255,255,0.05)"
                                : "#f0f7ff",
                            justifyContent: "center",
                            alignItems: "center",
                            marginRight: 12,
                          }}
                        >
                          <Ionicons
                            name={
                              m.type === "IMAGE"
                                ? "image"
                                : m.type === "VIDEO"
                                  ? "videocam"
                                  : m.type === "VOICE"
                                    ? "mic"
                                    : m.type === "POLL"
                                      ? "stats-chart"
                                      : m.type === "FILE" ||
                                        m.type === "DOCUMENT" ||
                                        (m.attachments && m.attachments.length > 0)
                                        ? "document-text"
                                        : "chatbubble-ellipses"
                            }
                            size={22}
                            color={colors.primary}
                          />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              color: colors.text,
                              fontSize: 15,
                              fontWeight: "600",
                            }}
                            numberOfLines={1}
                          >
                            {getPinnedDisplayText(m)}
                          </Text>
                          <Text
                            style={{
                              color: colors.textSecondary,
                              fontSize: 12,
                              marginTop: 2,
                            }}
                          >
                            {m.senderName} • {formatTime(m.createdAt)}
                          </Text>
                        </View>

                        <TouchableOpacity
                          onPress={() => {
                            if (!roomId) return;
                            // Optimistic: cập nhật ngay trên UI trước khi server phản hồi
                            setMessages((prev) =>
                              prev.map((msg) =>
                                msg.messageId === m.messageId
                                  ? { ...msg, pinned: false }
                                  : msg,
                              ),
                            );
                            webSocketService.sendPin({
                              roomId,
                              messageId: m.messageId,
                              pin: false,
                              messageType: m.type || "TEXT",
                            });
                          }}
                          style={{ padding: 8 }}
                        >
                          <Ionicons
                            name="close-circle"
                            size={20}
                            color={colors.textSecondary}
                          />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))
                )}
              </View>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Danh sách reaction – bấm vào dải reaction dưới tin nhắn */}
        <Modal
          transparent
          animationType="slide"
          visible={!!reactionListMessage}
          onRequestClose={() => setReactionListMessage(null)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.5)",
              justifyContent: "flex-end",
            }}
            onPress={() => setReactionListMessage(null)}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => { }}
              style={{
                backgroundColor: colors.card,
                paddingTop: 16,
                paddingBottom: 32,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                maxHeight: "75%",
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: -3 },
                shadowOpacity: 0.1,
                shadowRadius: 10,
                elevation: 20,
              }}
            >
              {reactionListMessage &&
                (() => {
                  const raw = reactionListMessage?.reactions;
                  const reactions = Array.isArray(raw) ? raw : [];
                  const total = reactions.length;
                  const byEmoji = reactions.reduce<Record<string, number>>(
                    (acc, r) => {
                      if (!r?.emoji) return acc;
                      acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                      return acc;
                    },
                    {},
                  );
                  const byUser = reactions.reduce<Record<string, string[]>>(
                    (acc, r) => {
                      if (!r?.userId || !r?.emoji) return acc;
                      if (!Array.isArray(acc[r.userId])) acc[r.userId] = [];
                      if (!acc[r.userId].includes(r.emoji))
                        acc[r.userId].push(r.emoji);
                      return acc;
                    },
                    {},
                  );
                  const userIds = Object.keys(byUser);
                  return (
                    <>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          paddingHorizontal: 20,
                          marginBottom: 16,
                        }}
                      >
                        <Text
                          style={{
                            color: colors.text,
                            fontSize: 17,
                            fontWeight: "700",
                          }}
                        >
                          Tất cả {total}
                        </Text>
                        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                          {Object.entries(byEmoji).map(([emoji, count]) => (
                            <Text
                              key={emoji}
                              style={{
                                color: colors.text,
                                fontSize: 14,
                                marginLeft: 12,
                              }}
                            >
                              {emoji} {count}
                            </Text>
                          ))}
                        </View>
                      </View>
                      <View style={{ maxHeight: "100%" }}>
                        {userIds.map((uid) => (
                          <View
                            key={uid}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              paddingHorizontal: 20,
                              paddingVertical: 12,
                              borderBottomWidth: 1,
                              borderBottomColor: colors.border,
                            }}
                          >
                            <View
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                backgroundColor: colors.card,
                                alignItems: "center",
                                justifyContent: "center",
                                marginRight: 12,
                                borderWidth: 1,
                                borderColor: colors.border,
                              }}
                            >
                              <Text
                                style={{
                                  color: colors.text,
                                  fontSize: 15,
                                  fontWeight: "600",
                                }}
                              >
                                {(reactionUserNameMap[uid] || uid)
                                  .charAt(0)
                                  .toUpperCase()}
                              </Text>
                            </View>
                            <Text
                              style={{
                                flex: 1,
                                color: colors.text,
                                fontSize: 15,
                              }}
                              numberOfLines={1}
                            >
                              {reactionUserNameMap[uid] || "Người dùng"}
                            </Text>
                            <View style={{ flexDirection: "row" }}>
                              {(Array.isArray(byUser[uid])
                                ? byUser[uid]
                                : []
                              ).map((emoji) => (
                                <Text
                                  key={emoji}
                                  style={{ fontSize: 18, marginLeft: 8 }}
                                >
                                  {emoji}
                                </Text>
                              ))}
                            </View>
                          </View>
                        ))}
                      </View>
                    </>
                  );
                })()}
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {/* ─── Modal chuyển tiếp tin nhắn (multi-select) ─── */}

        {/* ─── Chat-wide swipeable image gallery ─── */}
        <Modal
          visible={galleryIndex !== null}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => setGalleryIndex(null)}
        >
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.98)" }}>
            <TouchableOpacity
              onPress={() => setGalleryIndex(null)}
              style={{
                position: "absolute",
                top: 52,
                right: 20,
                zIndex: 10,
                padding: 8,
              }}
            >
              <Ionicons name="close" size={32} color="#fff" />
            </TouchableOpacity>

            {galleryItems.length > 1 && (
              <View
                style={{
                  position: "absolute",
                  top: 56,
                  left: 0,
                  right: 0,
                  zIndex: 10,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#fff", fontSize: 18, fontWeight: "600" }}>
                  {galleryCurrentIndex + 1} / {galleryItems.length}
                </Text>
              </View>
            )}

            <FlatList
              ref={galleryRef}
              style={{ flex: 1 }}
              data={galleryItems}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(_, i) => `chat-gallery-${i}`}
              initialScrollIndex={Math.min(
                galleryIndex ?? 0,
                Math.max(0, galleryItems.length - 1),
              )}
              getItemLayout={(_, index) => ({
                length: SCREEN_WIDTH,
                offset: SCREEN_WIDTH * index,
                index,
              })}
              viewabilityConfig={galleryViewabilityConfig}
              onViewableItemsChanged={onGalleryViewableItemsChanged}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(
                  e.nativeEvent.contentOffset.x / SCREEN_WIDTH,
                );
                setGalleryCurrentIndex(idx);
              }}
              renderItem={({ item, index }) => {
                const isActive = galleryCurrentIndex === index;
                return (
                  <View
                    style={{
                      width: SCREEN_WIDTH,
                      height: SCREEN_HEIGHT,
                      justifyContent: "center",
                      alignItems: "center",
                      backgroundColor: "black",
                    }}
                  >
                    {item.kind === "video" ? (
                      <Video
                        source={{ uri: item.url }}
                        style={{
                          width: SCREEN_WIDTH,
                          height: SCREEN_HEIGHT * 0.75,
                          backgroundColor: "#000",
                        }}
                        resizeMode={ResizeMode.CONTAIN}
                        useNativeControls
                        shouldPlay={isActive}
                        isLooping={false}
                        isMuted
                      />
                    ) : (
                      <Image
                        source={{ uri: item.url }}
                        style={{
                          width: SCREEN_WIDTH,
                          height: SCREEN_HEIGHT * 0.75,
                        }}
                        resizeMode="contain"
                      />
                    )}
                  </View>
                );
              }}
            />
          </View>
        </Modal>

        {/* Generic Toast Notification */}
        {toast.visible && (
          <View
            style={{
              position: "absolute",
              top: "40%",
              alignSelf: "center",
              backgroundColor:
                toast.type === "error"
                  ? "rgba(239, 68, 68, 0.95)"
                  : "rgba(0,0,0,0.85)",
              paddingHorizontal: 20,
              paddingVertical: 12,
              borderRadius: 24,
              flexDirection: "row",
              alignItems: "center",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 4.65,
              elevation: 8,
              zIndex: 99999,
            }}
          >
            <Ionicons
              name={toast.type === "error" ? "alert-circle" : "checkmark-circle"}
              size={20}
              color="#fff"
              style={{ marginRight: 8 }}
            />
            <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}>
              {toast.message}
            </Text>
          </View>
        )}

        {/* Welcome templates (after accepting friend request) */}
        <Modal
          transparent
          animationType="fade"
          visible={showWelcomePicker}
          onRequestClose={() => setShowWelcomePicker(false)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.45)",
              justifyContent: "flex-end",
            }}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={{ flex: 1 }}
              onPress={() => setShowWelcomePicker(false)}
            />
            <View
              style={{
                backgroundColor: colors.card,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                paddingTop: 12,
                paddingBottom: 22,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View
                style={{
                  alignSelf: "center",
                  width: 40,
                  height: 4,
                  borderRadius: 999,
                  backgroundColor: colors.border,
                  marginBottom: 12,
                }}
              />
              <Text
                style={{
                  color: colors.text,
                  fontSize: 16,
                  fontWeight: "800",
                  paddingHorizontal: 18,
                }}
              >
                Chọn 1 tin nhắn chào mừng
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 12,
                  paddingHorizontal: 18,
                  marginTop: 4,
                }}
              >
                Không tự gửi. Bạn chọn 1 mẫu để gửi nhanh.
              </Text>

              {[
                "Chào bạn, rất vui được kết bạn với bạn!",
                "Hello! Mình vừa chấp nhận lời mời, bạn đang làm gì đó?",
                "Chào bạn, mình có thể giúp gì cho bạn không?",
              ].map((tpl) => (
                <TouchableOpacity
                  key={tpl}
                  onPress={() => {
                    handleSend(tpl);
                    showToast("Đã chọn và gửi tin nhắn chào mừng", "success");
                    setShowWelcomePicker(false);
                  }}
                  style={{
                    marginTop: 10,
                    marginHorizontal: 14,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    borderRadius: 14,
                    backgroundColor: theme === "dark" ? "#2c2c2e" : "#f3f4f6",
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 14,
                      fontWeight: "600",
                    }}
                  >
                    {tpl}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>

        {/* ─── Modal chuyển tiếp tin nhắn (multi-select) ─── */}
        <Modal
          transparent
          animationType="slide"
          visible={showForwardModal}
          onRequestClose={() => {
            if (!forwardLoading) {
              setShowForwardModal(false);
              setSelectedForwardRooms(new Set());
            }
          }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.55)",
              justifyContent: "flex-end",
            }}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={{ flex: 1 }}
              onPress={() => {
                if (!forwardLoading) {
                  setShowForwardModal(false);
                  setSelectedForwardRooms(new Set());
                }
              }}
            />
            <View
              style={{
                backgroundColor: colors.card,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                paddingTop: 12,
                maxHeight: "85%",
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: -3 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
                elevation: 25,
              }}
            >
              {/* Handle bar */}
              <View
                style={{
                  alignSelf: "center",
                  width: 40,
                  height: 4,
                  borderRadius: 999,
                  backgroundColor: colors.border,
                  marginBottom: 14,
                }}
              />

              {/* Header */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 20,
                  marginBottom: 10,
                }}
              >
                <View>
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 17,
                      fontWeight: "700",
                    }}
                  >
                    Chuyển tiếp đến
                  </Text>
                  {selectedForwardRooms.size > 0 && (
                    <Text
                      style={{ color: "#60a5fa", fontSize: 12, marginTop: 2 }}
                    >
                      Đã chọn {selectedForwardRooms.size} cuộc trò chuyện
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => {
                    if (!forwardLoading) {
                      setShowForwardModal(false);
                      setSelectedForwardRooms(new Set());
                    }
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Preview tin nhắn gốc */}
              {forwardingMessage && (
                <View
                  style={{
                    marginHorizontal: 16,
                    marginBottom: 10,
                    padding: 10,
                    backgroundColor: colors.card,
                    borderRadius: 12,
                    borderLeftWidth: 3,
                    borderLeftColor: "#60a5fa",
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <Ionicons
                    name={
                      forwardingMessage.type === "IMAGE"
                        ? "image-outline"
                        : forwardingMessage.attachments?.length > 0
                          ? "document-outline"
                          : "chatbubble-outline"
                    }
                    size={18}
                    color="#60a5fa"
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    numberOfLines={1}
                    style={{ color: colors.text, fontSize: 13, flex: 1 }}
                  >
                    {forwardingMessage.type === "IMAGE"
                      ? `${forwardingMessage.attachments?.length ?? 1} hình ảnh`
                      : forwardingMessage.attachments?.length > 0
                        ? forwardingMessage.attachments[0].name || "Tệp đính kèm"
                        : forwardingMessage.content || "[Tin nhắn]"}
                  </Text>
                </View>
              )}

              {/* Ô tìm kiếm */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginHorizontal: 16,
                  marginBottom: 6,
                  backgroundColor: colors.card,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Ionicons
                  name="search-outline"
                  size={16}
                  color={colors.textSecondary}
                  style={{ marginRight: 8 }}
                />
                <TextInput
                  placeholder="Tìm cuộc trò chuyện..."
                  placeholderTextColor={colors.textSecondary}
                  value={forwardSearch}
                  onChangeText={setForwardSearch}
                  style={{
                    flex: 1,
                    color: colors.text,
                    fontSize: 14,
                    padding: 0,
                  }}
                />
                {forwardSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setForwardSearch("")}>
                    <Ionicons
                      name="close-circle"
                      size={16}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                )}
              </View>

              {/* Danh sách cuộc trò chuyện – multi-select */}
              <FlatList
                data={rooms.filter(
                  (r) =>
                    r.id !== roomId &&
                    (forwardSearch.trim() === "" ||
                      r.name
                        ?.toLowerCase()
                        .includes(forwardSearch.toLowerCase())),
                )}
                keyExtractor={(item) => item.id}
                style={{ maxHeight: 340 }}
                contentContainerStyle={{
                  paddingHorizontal: 16,
                  paddingVertical: 4,
                }}
                ListEmptyComponent={() => (
                  <View style={{ alignItems: "center", paddingVertical: 28 }}>
                    <Ionicons
                      name="chatbubbles-outline"
                      size={36}
                      color={colors.textSecondary}
                    />
                    <Text
                      style={{
                        color: colors.textSecondary,
                        marginTop: 8,
                        fontSize: 14,
                      }}
                    >
                      Không tìm thấy cuộc trò chuyện
                    </Text>
                  </View>
                )}
                renderItem={({ item }) => {
                  const isSelected = selectedForwardRooms.has(item.id);
                  const avatarUri =
                    item.avatarUrl ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name || "U")}&background=0068FF&color=fff`;
                  return (
                    <TouchableOpacity
                      onPress={() => toggleForwardRoom(item.id)}
                      disabled={forwardLoading}
                      activeOpacity={0.7}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingVertical: 10,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                        opacity: forwardLoading ? 0.5 : 1,
                      }}
                    >
                      {/* Checkbox */}
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          borderWidth: 2,
                          borderColor: isSelected ? "#60a5fa" : colors.border,
                          backgroundColor: isSelected ? "#60a5fa" : "transparent",
                          alignItems: "center",
                          justifyContent: "center",
                          marginRight: 12,
                        }}
                      >
                        {isSelected && (
                          <Ionicons name="checkmark" size={14} color="#fff" />
                        )}
                      </View>

                      {/* Avatar */}
                      <Image
                        source={{ uri: avatarUri }}
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                          marginRight: 12,
                          backgroundColor: colors.card,
                          borderWidth: isSelected ? 2 : 0,
                          borderColor: "#60a5fa",
                        }}
                      />

                      {/* Thông tin */}
                      <View style={{ flex: 1 }}>
                        <Text
                          numberOfLines={1}
                          style={{
                            color: isSelected ? "#60a5fa" : colors.text,
                            fontSize: 15,
                            fontWeight: isSelected ? "600" : "400",
                          }}
                        >
                          {item.name || "Người dùng"}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={{
                            color: colors.textSecondary,
                            fontSize: 12,
                            marginTop: 1,
                          }}
                        >
                          {item.type === "GROUP" ? "👥 Nhóm" : "👤 Cá nhân"}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />

              {/* Nút gửi – cố định dưới đáy modal */}
              <View
                style={{
                  paddingHorizontal: 16,
                  paddingTop: 12,
                  paddingBottom: 28,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                }}
              >
                <TouchableOpacity
                  onPress={handleConfirmForward}
                  disabled={selectedForwardRooms.size === 0 || forwardLoading}
                  style={{
                    backgroundColor:
                      selectedForwardRooms.size === 0 ? colors.border : "#60a5fa",
                    borderRadius: 14,
                    paddingVertical: 14,
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "center",
                  }}
                >
                  {forwardLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons
                        name="send"
                        size={18}
                        color={
                          selectedForwardRooms.size === 0
                            ? colors.textSecondary
                            : "#fff"
                        }
                        style={{ marginRight: 8 }}
                      />
                      <Text
                        style={{
                          color:
                            selectedForwardRooms.size === 0
                              ? colors.textSecondary
                              : "#fff",
                          fontSize: 16,
                          fontWeight: "700",
                        }}
                      >
                        {selectedForwardRooms.size === 0
                          ? "Chọn để chuyển tiếp"
                          : `Chuyển tiếp`}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </View>
  );
}
