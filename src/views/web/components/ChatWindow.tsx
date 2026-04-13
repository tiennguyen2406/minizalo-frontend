import React, { useEffect, useCallback, useState, useMemo } from "react";
import { Box, Avatar } from "zmp-ui";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import GroupInfoPanel from "./GroupInfoPanel";
import DirectChatInfoPanel from "./DirectChatInfoPanel";
import AddMembersModal from "./AddMembersModal";
import ForwardMessageModal from "./ForwardMessageModal";
import { useChatStore } from "@/shared/store/useChatStore";
import { useGroupStore } from "@/shared/store/useGroupStore";
import { useFriendStore } from "@/shared/store/friendStore";
import { Message } from "@/shared/types";
import { webSocketService } from "@/shared/services/WebSocketService";
import {
  chatService,
  MessageDynamo,
  type Attachment as ChatServiceAttachment,
} from "@/shared/services/chatService";
import { useAuthStore } from "@/shared/store/authStore";
import { MessageService } from "@/shared/services/MessageService";
import friendService from "@/shared/services/friendService";
import SendFriendRequestModalWeb from "./SendFriendRequestModalWeb";
import { deriveFolderNameFromFiles } from "../utils/folderSend";
import {
  isStrangerMessagesNotAllowedError,
  STRANGER_MESSAGES_DEFAULT_TEXT,
} from "@/shared/utils/chatErrors";

interface ChatWindowProps {
  roomId: string;
}

/** Nền vùng chat (header + tin nhắn + composer) */
const CHAT_PANEL_BG = "#ebecf0";

function mapDynamoToMessage(msg: MessageDynamo, roomId: string): Message {
  const atts = msg.attachments || [];
  const isFolder = msg.type === "FOLDER";
  const totalFolderSize =
    isFolder && atts.length > 0
      ? atts.reduce((s, a) => s + (a.size ?? 0), 0)
      : undefined;

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
    fileUrl: atts[0]?.url,
    fileName: isFolder ? msg.content : atts[0]?.name || atts[0]?.filename,
    fileSize: isFolder ? totalFolderSize : atts[0]?.size,
    attachments: atts,
    reactions: Array.isArray(msg.reactions) ? [...msg.reactions] : [],
    replyToId: msg.replyToMessageId,
  };
}

const ChatWindow: React.FC<ChatWindowProps> = ({ roomId }) => {
  const { user } = useAuthStore();
  const currentUserId = user?.id || "";

  const { messages, addMessage, setCurrentRoom, setMessages, rooms } =
    useChatStore();
  const pendingOpenDirectInfoRoomId = useChatStore(
    (s) => s.pendingOpenDirectInfoRoomId,
  );
  const setPendingOpenDirectInfoRoomId = useChatStore(
    (s) => s.setPendingOpenDirectInfoRoomId,
  );
  const { isGroupInfoOpen, openGroupInfo, closeGroupInfo, currentGroupDetail } =
    useGroupStore();
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [forwardingMessages, setForwardingMessages] = useState<
    Message[] | null
  >(null);
  const [isSendingFile, setIsSendingFile] = useState(false);
  const [fileUploadProgress, setFileUploadProgress] = useState<number | null>(
    null,
  );
  const [showPinnedMenu, setShowPinnedMenu] = useState(false);
  const [friendBarMenuOpen, setFriendBarMenuOpen] = useState(false);
  const [friendInviteModalOpen, setFriendInviteModalOpen] = useState(false);
  const [blockStatus, setBlockStatus] = useState<{
    blockedByYou: boolean;
    blockedByOther: boolean;
    blockerName: string | null;
  } | null>(null);
  const messagesState = messages[roomId] || [];

  const currentRoom = rooms.find((r) => r.id === roomId);
  const isGroupRoom = currentRoom?.type === "GROUP";
  // Chat 1-1: tên hiển thị lấy từ thành viên còn lại (bạn bè), không chỉ `room.name` (có thể trống/null).
  const partner = !isGroupRoom
    ? currentRoom?.participants?.find((p) => p.id !== currentUserId)
    : undefined;
  const roomName = isGroupRoom
    ? currentRoom?.name?.trim() || "Phòng chat"
    : partner?.fullName?.trim() ||
      partner?.username ||
      currentRoom?.name?.trim() ||
      "Phòng chat";
  const roomAvatar =
    currentRoom?.avatarUrl ||
    (!isGroupRoom && partner?.avatarUrl) ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(roomName)}&background=${isGroupRoom ? "0068FF" : "random"}&color=fff&bold=true`;

  const isBlocked =
    blockStatus?.blockedByYou || blockStatus?.blockedByOther || false;

  const friends = useFriendStore((s) => s.friends);
  const sentRequests = useFriendStore((s) => s.sentRequests);
  const fetchFriends = useFriendStore((s) => s.fetchFriends);
  const fetchSentRequests = useFriendStore((s) => s.fetchSentRequests);
  const sendFriendRequest = useFriendStore((s) => s.sendRequest);

  const isFriendWithPartner = useMemo(() => {
    if (!partner?.id || !currentUserId) return false;
    return friends.some((f) => {
      if (f.user.id === currentUserId) return f.friend.id === partner.id;
      if (f.friend.id === currentUserId) return f.user.id === partner.id;
      return false;
    });
  }, [friends, partner?.id, currentUserId]);

  const hasPendingSentToPartner = useMemo(() => {
    if (!partner?.id) return false;
    return sentRequests.some((r) => r.friend.id === partner.id);
  }, [sentRequests, partner?.id]);

  useEffect(() => {
    if (isGroupRoom || !partner?.id) return;
    void fetchFriends();
    void fetchSentRequests();
  }, [isGroupRoom, partner?.id, fetchFriends, fetchSentRequests]);

  // Sau khi mở phòng từ tìm SĐT: tự mở panel Thông tin hội thoại (giống Zalo).
  useEffect(() => {
    if (pendingOpenDirectInfoRoomId !== roomId) return;
    setIsInfoOpen(true);
    setPendingOpenDirectInfoRoomId(null);
  }, [roomId, pendingOpenDirectInfoRoomId, setPendingOpenDirectInfoRoomId]);

  const fetchHistory = useCallback(async () => {
    if (!roomId) return;
    try {
      const result = await chatService.getChatHistory(roomId);
      const sorted = (result.messages || [])
        .slice()
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
      const historyMessages = sorted.map((m) => mapDynamoToMessage(m, roomId));
      const currentMsgs = useChatStore.getState().messages[roomId] || [];
      const liveMessages = currentMsgs.filter((m) => !m.id.startsWith("temp-"));
      const merged = [...historyMessages];
      for (const liveMsg of liveMessages) {
        if (!merged.some((m) => m.id === liveMsg.id)) merged.push(liveMsg);
      }
      merged.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      setMessages(roomId, merged);
    } catch (error) {
      console.error("Failed to fetch chat history", error);
    }
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    setCurrentRoom(roomId);
    webSocketService.activate();
    fetchHistory();

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

    // Đóng panel info khi chuyển phòng
    setIsInfoOpen(false);
    closeGroupInfo();
    setBlockStatus(null);

    // Check block status for DIRECT rooms
    if (!isGroupRoom && partner?.id) {
      friendService
        .checkBlockStatus(partner.id)
        .then((status) => setBlockStatus(status))
        .catch((err) => console.error("Failed to check block status:", err));
    }

    return () => {
      webSocketService.unsubscribe(recallTopic);
      webSocketService.unsubscribe(reactionTopic);
      webSocketService.unsubscribe(pinTopic);
      setCurrentRoom(null);
    };
  }, [roomId, fetchHistory]);

  // Auto-refresh block status when blockedUsers changes (block/unblock from any screen)
  const blockedUsers = useFriendStore((s) => s.blockedUsers);
  useEffect(() => {
    if (!isGroupRoom && partner?.id) {
      friendService
        .checkBlockStatus(partner.id)
        .then((status) => setBlockStatus(status))
        .catch((err) => console.error("Failed to re-check block status:", err));
    }
  }, [blockedUsers, partner?.id, isGroupRoom]);

  const handleSend = async (text: string) => {
    if (!roomId || !text.trim()) return;
    const chatState = useChatStore.getState();
    if (chatState.friendshipWelcomeByRoomId[roomId]) {
      chatState.clearFriendshipWelcome(roomId);
    }
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
        } catch (err: unknown) {
          if (isStrangerMessagesNotAllowedError(err)) {
            const apiMsg = (
              err as { response?: { data?: { message?: string } } }
            ).response?.data?.message;
            useChatStore.getState().applyStrangerMessageRejection(
              roomId,
              typeof apiMsg === "string" && apiMsg.trim()
                ? apiMsg.trim()
                : STRANGER_MESSAGES_DEFAULT_TEXT,
            );
          } else {
            console.error(
              "REST send failed:",
              (err as { response?: { status?: number; data?: unknown } })
                ?.response?.status,
              (err as { response?: { data?: unknown }; message?: string })
                ?.response?.data ?? (err as Error)?.message,
            );
          }
        }
      }
    } else {
      // Chat 1-1: luôn gửi qua REST để server từ chối ngay (chỉ bạn bè / không nhận tin)
      // và client nhận 403 + gỡ tin tạm + dòng SYSTEM, không phụ thuộc hàng đợi WS.
      try {
        await chatService.sendMessage(roomId, text, replyingTo?.id);
        await fetchHistory();
      } catch (err: unknown) {
        if (isStrangerMessagesNotAllowedError(err)) {
          const apiMsg = (
            err as { response?: { data?: { message?: string } } }
          ).response?.data?.message;
          useChatStore.getState().applyStrangerMessageRejection(
            roomId,
            typeof apiMsg === "string" && apiMsg.trim()
              ? apiMsg.trim()
              : STRANGER_MESSAGES_DEFAULT_TEXT,
          );
        } else {
          console.error(
            "REST send failed:",
            (err as { response?: { status?: number; data?: unknown } })
              ?.response?.status,
            (err as { response?: { data?: unknown }; message?: string })
              ?.response?.data ?? (err as Error)?.message,
          );
        }
      }
    }
    setReplyingTo(null);
  };

  const uploadAndSendOneFile = async (
    file: File,
    onUploadProgress?: (pct: number) => void,
  ) => {
    if (!roomId) return;

    const uploadResult = await MessageService.uploadFile(
      file,
      onUploadProgress,
    );

    const mimeType = file.type.toLowerCase();
    let msgType: "IMAGE" | "VIDEO" | "FILE" = "FILE";
    if (mimeType.startsWith("image/")) msgType = "IMAGE";
    else if (mimeType.startsWith("video/")) msgType = "VIDEO";

    const attachment: ChatServiceAttachment = {
      id: "",
      url: uploadResult.fileUrl,
      type: uploadResult.fileType || file.type,
      filename: uploadResult.fileName || file.name,
      name: uploadResult.fileName || file.name,
      size: uploadResult.size || file.size,
    };
    const wsFilePayload = {
      url: attachment.url,
      type: attachment.type,
      filename: attachment.filename || attachment.name || file.name,
      size: attachment.size,
    };

    const optimistic: Message = {
      id: `temp-${Date.now()}-${Math.random()}`,
      senderId: currentUserId,
      senderName: user?.fullName || user?.username || undefined,
      roomId,
      content: file.name,
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
      const sentViaWs = webSocketService.sendChatMessage(
        roomId,
        file.name,
        msgType,
        replyingTo?.id,
        [wsFilePayload],
      );
      if (!sentViaWs) {
        await fetchHistory();
      }
    } else {
      try {
        await chatService.sendMessage(
          roomId,
          file.name,
          replyingTo?.id,
          msgType,
          [attachment],
        );
        await fetchHistory();
      } catch (err: unknown) {
        if (isStrangerMessagesNotAllowedError(err)) {
          const apiMsg = (
            err as { response?: { data?: { message?: string } } }
          ).response?.data?.message;
          useChatStore.getState().applyStrangerMessageRejection(
            roomId,
            typeof apiMsg === "string" && apiMsg.trim()
              ? apiMsg.trim()
              : STRANGER_MESSAGES_DEFAULT_TEXT,
          );
        } else {
          console.error("REST gửi file/ảnh thất bại:", err);
        }
      }
    }
  };

  const uploadAndSendFolder = async (
    files: File[],
    onUploadProgress?: (pct: number) => void,
    folderDisplayName?: string,
  ) => {
    if (!roomId || files.length === 0) return;

    const folderName =
      (folderDisplayName && folderDisplayName.trim()) ||
      deriveFolderNameFromFiles(files);
    const totalBytes = files.reduce((s, f) => s + f.size, 0);

    const attachments: {
      url: string;
      type: string;
      filename: string;
      name: string;
      size: number;
    }[] = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const uploadResult = await MessageService.uploadFile(f, (pct) => {
        const overall = Math.round(((i + pct / 100) / files.length) * 100);
        onUploadProgress?.(Math.min(100, overall));
      });
      const rel = f.webkitRelativePath || f.name;
      attachments.push({
        url: uploadResult.fileUrl,
        type: uploadResult.fileType || f.type || "application/octet-stream",
        filename: rel,
        name: rel,
        size: uploadResult.size ?? f.size,
      });
    }

    const optimistic: Message = {
      id: `temp-${Date.now()}-${Math.random()}`,
      senderId: currentUserId,
      senderName: user?.fullName || user?.username || undefined,
      roomId,
      content: folderName,
      type: "FOLDER",
      createdAt: new Date().toISOString(),
      fileUrl: attachments[0]?.url,
      fileName: folderName,
      fileSize: totalBytes,
      attachments,
      replyToId: replyingTo?.id,
    };
    addMessage(roomId, optimistic);

    const wsPayload = attachments.map((a) => ({
      url: a.url,
      type: a.type,
      filename: a.filename,
      size: a.size,
    }));

    const restAttachments: ChatServiceAttachment[] = wsPayload.map((a) => ({
      id: "",
      url: a.url,
      type: a.type,
      name: a.filename,
      filename: a.filename,
      size: a.size,
    }));

    if (isGroupRoom) {
      const sentViaWs = webSocketService.sendChatMessage(
        roomId,
        folderName,
        "FOLDER",
        replyingTo?.id,
        wsPayload,
      );
      if (!sentViaWs) {
        try {
          await chatService.sendMessage(
            roomId,
            folderName,
            replyingTo?.id,
            "FOLDER",
            restAttachments,
          );
          await fetchHistory();
        } catch (err: unknown) {
          if (isStrangerMessagesNotAllowedError(err)) {
            const apiMsg = (
              err as { response?: { data?: { message?: string } } }
            ).response?.data?.message;
            useChatStore.getState().applyStrangerMessageRejection(
              roomId,
              typeof apiMsg === "string" && apiMsg.trim()
                ? apiMsg.trim()
                : STRANGER_MESSAGES_DEFAULT_TEXT,
            );
          } else {
            console.error(
              "REST gửi thư mục thất bại:",
              err && typeof err === "object" && "response" in err
                ? (err as { response?: { status?: number; data?: unknown } })
                    .response
                : err,
            );
            await fetchHistory();
          }
        }
      }
    } else {
      try {
        await chatService.sendMessage(
          roomId,
          folderName,
          replyingTo?.id,
          "FOLDER",
          restAttachments,
        );
        await fetchHistory();
      } catch (err: unknown) {
        if (isStrangerMessagesNotAllowedError(err)) {
          const apiMsg = (
            err as { response?: { data?: { message?: string } } }
          ).response?.data?.message;
          useChatStore.getState().applyStrangerMessageRejection(
            roomId,
            typeof apiMsg === "string" && apiMsg.trim()
              ? apiMsg.trim()
              : STRANGER_MESSAGES_DEFAULT_TEXT,
          );
        } else {
          console.error(
            "REST gửi thư mục thất bại:",
            err && typeof err === "object" && "response" in err
              ? (err as { response?: { status?: number; data?: unknown } })
                  .response
              : err,
          );
        }
      }
    }
  };

  const handleSendFile = async (file: File) => {
    if (!roomId) return;
    setIsSendingFile(true);
    setFileUploadProgress(0);
    try {
      await uploadAndSendOneFile(file, (pct) => setFileUploadProgress(pct));
      setReplyingTo(null);
    } catch (error) {
      console.error("Failed to send file:", error);
    } finally {
      setFileUploadProgress(null);
      setIsSendingFile(false);
    }
  };

  const handleTyping = (isTyping: boolean) => {
    if (!roomId) return;
    webSocketService.sendTyping({ roomId, isTyping });
  };

  const handleRecall = async (messageId: string) => {
    if (!roomId) return;
    try {
      await MessageService.recallMessage(roomId, messageId);
      const currentMsgs = useChatStore.getState().messages[roomId] || [];
      const newMsgs = currentMsgs.map((m) =>
        m.id === messageId
          ? { ...m, isRecall: true, content: "[Tin nhắn đã thu hồi]" }
          : m,
      );
      setMessages(roomId, newMsgs);
    } catch (error) {
      console.error("Failed to recall message", error);
    }
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
    setIsSendingFile(true);
    setFileUploadProgress(0);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        await uploadAndSendOneFile(file, (pct) => {
          const overall = Math.round(((i + pct / 100) / files.length) * 100);
          setFileUploadProgress(Math.min(100, overall));
        });
      }
      setReplyingTo(null);
    } catch (error) {
      console.error("Failed to send files:", error);
    } finally {
      setFileUploadProgress(null);
      setIsSendingFile(false);
    }
  };

  const handleSendFolder = async (
    files: File[],
    folderDisplayName?: string,
  ) => {
    if (!roomId || files.length === 0) return;
    setIsSendingFile(true);
    setFileUploadProgress(0);
    try {
      await uploadAndSendFolder(
        files,
        (pct) => setFileUploadProgress(pct),
        folderDisplayName,
      );
      setReplyingTo(null);
    } catch (error) {
      console.error("Failed to send folder:", error);
    } finally {
      setFileUploadProgress(null);
      setIsSendingFile(false);
    }
  };

  const handleTogglePin = (messageId: string, currentPinStatus: boolean) => {
    if (!roomId) return;
    webSocketService.sendPin({
      roomId,
      messageId,
      pin: !currentPinStatus,
    });
    // Optimistic update
    const currentMsgs = useChatStore.getState().messages[roomId] || [];
    const newMsgs = currentMsgs.map((m) =>
      m.id === messageId ? { ...m, pinned: !currentPinStatus } : m,
    );

    // Add systemic pin/unpin notification locally (chỉ hiển thị cho người nhấn)
    const targetMessage = currentMsgs.find((m) => m.id === messageId);
    if (targetMessage) {
      newMsgs.push({
        id: `sys-${Date.now()}-${Math.random()}`,
        senderId: "system",
        roomId,
        content: !currentPinStatus
          ? "Bạn đã ghim tin nhắn"
          : "Bạn đã bỏ ghim tin nhắn",
        type: "SYSTEM",
        createdAt: new Date().toISOString(),
        isRecall: currentPinStatus,
        replyToId: !currentPinStatus ? messageId : undefined,
      });
    }

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
    const currentMsgs = useChatStore.getState().messages[roomId] || [];
    const newMsgs = currentMsgs.filter((m) => m.id !== messageId);
    setMessages(roomId, newMsgs);
  };

  // Toggle info panel chung cho cả 2 loại phòng
  const handleToggleInfo = () => {
    if (isGroupRoom) {
      isGroupInfoOpen ? closeGroupInfo() : openGroupInfo();
    } else {
      setIsInfoOpen((v) => !v);
    }
  };

  const infoOpen = isGroupRoom ? isGroupInfoOpen : isInfoOpen;

  const openFriendInviteModal = () => {
    if (!partner?.id) return;
    setFriendBarMenuOpen(false);
    setFriendInviteModalOpen(true);
  };

  const meDisplayName =
    user?.fullName?.trim() || user?.username?.trim() || "mình";

  const friendInviteTarget = partner
    ? {
        id: partner.id,
        displayName: partner.fullName || partner.username || "Người dùng",
        avatarUrl: partner.avatarUrl ?? null,
        coverPhotoUrl: null as string | null,
      }
    : null;

  return (
    <div
      className="flex h-full overflow-hidden"
      style={{
        backgroundColor: CHAT_PANEL_BG,
        color: "var(--text-primary)",
        transition: "background-color 0.3s ease",
      }}
    >
      {/* ── Chat area ── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header + (chat 1-1) thanh kết bạn nếu chưa là bạn */}
        <div
          className="shrink-0"
          style={{
            borderBottom: "1px solid var(--border-primary)",
            backgroundColor: CHAT_PANEL_BG,
            boxShadow: "var(--shadow-sm)",
            transition: "background-color 0.3s ease",
          }}
        >
          <div className="h-16 flex items-center px-4 justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Avatar src={roomAvatar} />
              <div className="min-w-0">
                <span
                  className="font-bold text-base block truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  {roomName}
                </span>
                {!isGroupRoom &&
                partner &&
                partner.businessDescription?.trim() ? (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: "rgba(0, 104, 255, 0.12)",
                        color: "var(--accent)",
                      }}
                    >
                      Business
                    </span>
                    <svg
                      width={14}
                      height={14}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      className="text-gray-400 shrink-0"
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                      />
                    </svg>
                  </div>
                ) : null}
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
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                title="Tìm trong trò chuyện"
                className="w-9 h-9 flex items-center justify-center rounded-full transition-colors hover:bg-gray-100 text-gray-500"
                onClick={() => {
                  document
                    .querySelector<HTMLTextAreaElement>(
                      "textarea[data-chat-composer]",
                    )
                    ?.focus();
                }}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <circle cx="11" cy="11" r="8" />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-4.35-4.35"
                  />
                </svg>
              </button>
              <button
                type="button"
                onClick={handleToggleInfo}
                title="Thông tin hội thoại"
                className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${
                  infoOpen
                    ? "bg-blue-100 text-blue-600"
                    : "hover:bg-gray-100 text-gray-500"
                }`}
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
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </button>
            </div>
          </div>

          {!isGroupRoom && partner && !isBlocked && !isFriendWithPartner && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "10px 16px",
                backgroundColor: "var(--bg-secondary)",
                borderTop: "1px solid var(--border-primary)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  minWidth: 0,
                  fontSize: 14,
                  color: "var(--text-secondary)",
                }}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  style={{ flexShrink: 0, color: "var(--text-tertiary)" }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
                  />
                  <circle cx="9" cy="7" r="4" />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 8v6M22 11h-6"
                  />
                </svg>
                <span style={{ lineHeight: 1.35 }}>
                  {hasPendingSentToPartner
                    ? "Bạn đã gửi lời mời kết bạn. Vui lòng chờ phản hồi."
                    : "Gửi yêu cầu kết bạn tới người này"}
                </span>
              </div>
              {!hasPendingSentToPartner && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexShrink: 0,
                    position: "relative",
                  }}
                >
                  <button
                    type="button"
                    onClick={openFriendInviteModal}
                    style={{
                      padding: "7px 16px",
                      borderRadius: 8,
                      border: "1px solid var(--border-primary)",
                      backgroundColor: "var(--bg-tertiary)",
                      color: "var(--accent)",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Gửi kết bạn
                  </button>
                  <button
                    type="button"
                    title="Thêm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFriendBarMenuOpen((v) => !v);
                    }}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      border: "none",
                      background: "transparent",
                      color: "var(--text-tertiary)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg
                      width="20"
                      height="20"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <circle cx="5" cy="12" r="2" />
                      <circle cx="12" cy="12" r="2" />
                      <circle cx="19" cy="12" r="2" />
                    </svg>
                  </button>
                  {friendBarMenuOpen && (
                    <>
                      <div
                        role="presentation"
                        style={{ position: "fixed", inset: 0, zIndex: 45 }}
                        onClick={() => setFriendBarMenuOpen(false)}
                      />
                      <div
                        style={{
                          position: "absolute",
                          right: 0,
                          top: "100%",
                          marginTop: 6,
                          zIndex: 50,
                          minWidth: 200,
                          padding: "6px 0",
                          borderRadius: 10,
                          backgroundColor: "var(--bg-modal)",
                          border: "1px solid var(--border-primary)",
                          boxShadow: "var(--shadow-md)",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setFriendBarMenuOpen(false);
                            handleToggleInfo();
                          }}
                          style={{
                            display: "block",
                            width: "100%",
                            textAlign: "left",
                            padding: "10px 14px",
                            fontSize: 14,
                            border: "none",
                            background: "transparent",
                            color: "var(--text-primary)",
                            cursor: "pointer",
                          }}
                        >
                          Thông tin hội thoại
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pinned Messages Header */}
        {messagesState.some((m) => m.pinned) &&
          (() => {
            const pinnedMessage = messagesState.filter((m) => m.pinned).pop();
            if (!pinnedMessage) return null;

            return (
              <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors">
                {/* Bấm vào phần trái sẽ cuộn đến tin nhắn */}
                <div
                  className="flex items-center gap-3 overflow-hidden flex-1"
                  title="Tin nhắn đã ghim"
                  onClick={() => {
                    const el = document.getElementById(
                      `msg-${pinnedMessage.id}`,
                    );
                    if (el) {
                      el.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                      });
                      el.classList.add("bg-yellow-100");
                      setTimeout(
                        () => el.classList.remove("bg-yellow-100"),
                        1500,
                      );
                    }
                  }}
                >
                  <div className="text-blue-500 shrink-0">
                    <svg
                      className="w-5 h-5 transform rotate-45"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                      />
                    </svg>
                  </div>
                  <div className="flex flex-col text-sm truncate min-w-0">
                    <span className="font-semibold text-gray-700">
                      Tin nhắn đã ghim
                    </span>
                    <span className="text-gray-500 truncate">
                      {pinnedMessage.type === "FILE" ||
                      pinnedMessage.type === "IMAGE" ||
                      pinnedMessage.type === "VIDEO"
                        ? "[Tệp đính kèm]"
                        : pinnedMessage.content}
                    </span>
                  </div>
                </div>

                {/* Nút 3 chấm */}
                <div className="relative ml-2 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowPinnedMenu(!showPinnedMenu);
                    }}
                    className="p-1 rounded-full text-gray-500 hover:bg-gray-200 transition-colors"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <circle cx="5" cy="12" r="2" />
                      <circle cx="12" cy="12" r="2" />
                      <circle cx="19" cy="12" r="2" />
                    </svg>
                  </button>

                  {showPinnedMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowPinnedMenu(false)}
                      />
                      <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-gray-100 py-1.5 min-w-[150px]">
                        <button
                          className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm flex items-center gap-2 text-gray-700"
                          onClick={() => {
                            navigator.clipboard.writeText(
                              pinnedMessage.content || "",
                            );
                            setShowPinnedMenu(false);
                          }}
                        >
                          <svg
                            className="w-4 h-4 text-gray-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.8}
                              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                          Copy
                        </button>
                        <button
                          className="w-full text-left px-4 py-2 hover:bg-red-50 hover:text-red-600 text-sm flex items-center gap-2 text-gray-700"
                          onClick={() => {
                            handleTogglePin(pinnedMessage.id, true);
                            setShowPinnedMenu(false);
                          }}
                        >
                          <svg
                            className="w-4 h-4 text-red-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.8}
                              d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.8}
                              d="M4 4l16 16"
                            />
                          </svg>
                          Bỏ ghim
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })()}

        {/* Messages + Input */}
        <Box
          className="flex-1 overflow-hidden flex flex-col"
          style={{
            backgroundColor: CHAT_PANEL_BG,
            transition: "background-color 0.3s ease",
          }}
        >
          <MessageList
            roomId={roomId}
            messages={messagesState}
            currentUserId={currentUserId}
            participants={currentRoom?.participants || []}
            onRecall={handleRecall}
            onReact={handleReact}
            onReply={handleReply}
            onTogglePin={handleTogglePin}
            onRemoveAllReactions={handleRemoveAllReactions}
            onDeleteForMe={handleDeleteForMe}
            onForward={handleForward}
            onWelcomeStickerPick={(emoji) => void handleSend(emoji)}
          />

          {/* Blocked chat overlay */}
          {isBlocked ? (
            <div className="border-t border-gray-200 bg-gray-50">
              {blockStatus?.blockedByYou ? (
                <div className="flex flex-col items-center justify-center py-6 px-4 gap-3">
                  <div className="flex items-center gap-2 text-gray-600">
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
                <div className="flex items-center justify-center py-6 px-4 gap-2 text-gray-500">
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
          ) : (
            <MessageInput
              onSend={handleSend}
              onSendFile={handleSendFile}
              onSendFiles={handleSendFiles}
              onSendFolder={handleSendFolder}
              onSendLike={() => handleSend("👍")}
              onTyping={handleTyping}
              replyingTo={replyingTo}
              onCancelReply={handleCancelReply}
              isSendingFile={isSendingFile}
              fileUploadProgress={fileUploadProgress}
              inputPlaceholder={
                !isGroupRoom && roomName
                  ? `Nhập @, tin nhắn tới ${roomName}`
                  : undefined
              }
            />
          )}
        </Box>
      </div>

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
          {!isGroupRoom && currentRoom && (
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

      {/* Forward Message Modal */}
      {forwardingMessages && (
        <ForwardMessageModal
          messages={forwardingMessages}
          currentRoomId={roomId}
          onClose={() => setForwardingMessages(null)}
        />
      )}

      <SendFriendRequestModalWeb
        open={friendInviteModalOpen && !!partner}
        target={friendInviteTarget}
        currentDisplayName={meDisplayName}
        variant="chat_window"
        onClose={() => setFriendInviteModalOpen(false)}
        onOpenProfile={() => {
          setFriendInviteModalOpen(false);
          setIsInfoOpen(true);
        }}
        onConfirmSend={async (msg, opts) => {
          if (!partner?.id) return;
          await sendFriendRequest(partner.id, {
            inviteMessage: msg || undefined,
            inviteSource: "CHAT_WINDOW",
            hideMyTimelineFromFriend: opts.hideMyTimelineFromFriend,
          });
          void fetchSentRequests();
        }}
      />
    </div>
  );
};

export default ChatWindow;
