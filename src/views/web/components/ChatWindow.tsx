import React, { useEffect, useCallback, useState } from 'react';
import { Box, Avatar } from 'zmp-ui';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import GroupInfoPanel from './GroupInfoPanel';
import DirectChatInfoPanel from './DirectChatInfoPanel';
import AddMembersModal from './AddMembersModal';
import ForwardMessageModal from './ForwardMessageModal';
import { useChatStore } from '@/shared/store/useChatStore';
import { useGroupStore } from '@/shared/store/useGroupStore';
import { useFriendStore } from '@/shared/store/friendStore';
import { Message } from '@/shared/types';
import { webSocketService } from '@/shared/services/WebSocketService';
import { chatService, MessageDynamo } from '@/shared/services/chatService';
import { useAuthStore } from '@/shared/store/authStore';
import { useCallStore } from '../../../shared/store/useCallStore';
import { MessageService } from '@/shared/services/MessageService';
import friendService from '@/shared/services/friendService';
import { callService, CallType } from '@/shared/services/callService';
import CallModal from './CallModal';

interface ChatWindowProps {
    roomId: string;
}

function mapDynamoToMessage(msg: MessageDynamo, roomId: string): Message {
    return {
        id: msg.messageId,
        senderId: msg.senderId,
        senderName: msg.senderName || undefined,
        roomId: roomId,
        content: msg.recalled ? '[Tin nhắn đã thu hồi]' : msg.content,
        type: (msg.type as any) || 'TEXT',
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
    const currentUserId = user?.id || '';

    const { messages, addMessage, setCurrentRoom, setMessages, rooms } = useChatStore();
    const { isGroupInfoOpen, openGroupInfo, closeGroupInfo, currentGroupDetail } = useGroupStore();
    const [isInfoOpen, setIsInfoOpen] = useState(false);
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [forwardingMessages, setForwardingMessages] = useState<Message[] | null>(null);
    const [isSendingFile, setIsSendingFile] = useState(false);
    const [showPinnedMenu, setShowPinnedMenu] = useState(false);
    const [blockStatus, setBlockStatus] = useState<{
        blockedByYou: boolean;
        blockedByOther: boolean;
        blockerName: string | null;
    } | null>(null);

    // Call Store Actions
    const { initiateCall, resetCall } = useCallStore();

    const messagesState = messages[roomId] || [];

    const currentRoom = rooms.find((r) => r.id === roomId);
    const isGroupRoom = currentRoom?.type === 'GROUP';
    const roomName = currentRoom?.name || 'Phòng chat';
    const roomAvatar =
        currentRoom?.avatarUrl ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(roomName)}&background=${isGroupRoom ? '0068FF' : 'random'}&color=fff&bold=true`;

    // Người bạn chat (với 1-1)
    const partner = !isGroupRoom
        ? currentRoom?.participants?.find((p) => String(p.id).toLowerCase() !== String(currentUserId).toLowerCase())
        : undefined;

    const isBlocked = blockStatus?.blockedByYou || blockStatus?.blockedByOther || false;

    const fetchHistory = useCallback(async () => {
        if (!roomId) return;
        try {
            const result = await chatService.getChatHistory(roomId);
            const sorted = (result.messages || [])
                .slice()
                .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            const historyMessages = sorted.map((m) => mapDynamoToMessage(m, roomId));
            const currentMsgs = useChatStore.getState().messages[roomId] || [];
            const liveMessages = currentMsgs.filter((m) => !m.id.startsWith('temp-'));
            const merged = [...historyMessages];
            for (const liveMsg of liveMessages) {
                if (!merged.some((m) => m.id === liveMsg.id)) merged.push(liveMsg);
            }
            merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            setMessages(roomId, merged);
        } catch (error) {
            console.error('Failed to fetch chat history', error);
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
                            ? { ...m, isRecall: true, content: '[Tin nhắn đã thu hồi]' }
                            : m
                    );
                    setMessages(roomId, newMsgs);
                }
            } catch (err) {
                console.error('Error parsing recall WS message:', err);
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
                            const reactions = Array.isArray(m.reactions) ? [...m.reactions] : [];
                            if (payload.action === 'remove' || payload.action === 'removeAll') {
                                // Xoá emoji đã thả
                                const filtered = payload.emoji
                                    ? reactions.filter(r => !(r.userId === payload.userId && r.emoji === payload.emoji))
                                    : reactions.filter(r => r.userId !== payload.userId); // removeAll theo user
                                return { ...m, reactions: filtered };
                            } else if (payload.action === 'add') {
                                // Thêm emoji mới nếu chưa có
                                const exists = reactions.some(r => r.userId === payload.userId && r.emoji === payload.emoji);
                                if (!exists) {
                                    reactions.push({ userId: payload.userId, emoji: payload.emoji });
                                }
                                return { ...m, reactions };
                            }
                        }
                        return m;
                    });
                    setMessages(roomId, newMsgs);
                }
            } catch (err) {
                console.error('Error parsing reaction WS message:', err);
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
                        m.id === messageId ? { ...m, pinned: !!payload.isPinned } : m
                    );

                    setMessages(roomId, newMsgs);
                }
            } catch (err) {
                console.error('Error parsing pin WS message:', err);
            }
        });

        // Đóng panel info khi chuyển phòng
        setIsInfoOpen(false);
        closeGroupInfo();
        setBlockStatus(null);

        // Check block status for DIRECT rooms
        if (!isGroupRoom && partner?.id) {
            friendService.checkBlockStatus(partner.id)
                .then((status) => setBlockStatus(status))
                .catch((err) => console.error('Failed to check block status:', err));
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
            friendService.checkBlockStatus(partner.id)
                .then((status) => setBlockStatus(status))
                .catch((err) => console.error('Failed to re-check block status:', err));
        }
    }, [blockedUsers, partner?.id, isGroupRoom]);

    const handleSend = async (text: string) => {
        if (!roomId || !text.trim()) return;
        const optimistic: Message = {
            id: `temp-${Date.now()}`,
            senderId: currentUserId,
            senderName: user?.fullName || user?.username || undefined,
            roomId,
            content: text,
            type: 'TEXT',
            createdAt: new Date().toISOString(),
            replyToId: replyingTo?.id,
        };
        addMessage(roomId, optimistic);
        const sentViaWs = webSocketService.sendChatMessage(roomId, text, 'TEXT', replyingTo?.id);
        if (!sentViaWs) {
            try {
                await chatService.sendMessage(roomId, text, replyingTo?.id);
                await fetchHistory();
            } catch (err: any) {
                console.error('REST send failed:', err?.response?.status, err?.response?.data || err.message);
            }
        }
        setReplyingTo(null);
    };

    const handleSendFile = async (file: File) => {
        if (!roomId) return;
        setIsSendingFile(true);
        try {
            // 1. Upload file to server
            const uploadResult = await MessageService.uploadFile(file);

            // 2. Determine type
            const mimeType = file.type.toLowerCase();
            let msgType: 'IMAGE' | 'VIDEO' | 'FILE' = 'FILE';
            if (mimeType.startsWith('image/')) msgType = 'IMAGE';
            else if (mimeType.startsWith('video/')) msgType = 'VIDEO';

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

            // 4. Send via WebSocket
            const sentViaWs = webSocketService.sendChatMessage(
                roomId, file.name, msgType, replyingTo?.id,
                [attachment]
            );
            if (!sentViaWs) {
                await fetchHistory();
            }
            setReplyingTo(null);
        } catch (error) {
            console.error('Failed to send file:', error);
        } finally {
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
                    ? { ...m, isRecall: true, content: '[Tin nhắn đã thu hồi]' }
                    : m
            );
            setMessages(roomId, newMsgs);
        } catch (error) {
            console.error('Failed to recall message', error);
        }
    };

    const handleReact = (messageId: string, emoji: string) => {
        if (!roomId || !currentUserId) return;

        const currentMsgs = useChatStore.getState().messages[roomId] || [];
        const targetMsg = currentMsgs.find(m => m.id === messageId);
        if (!targetMsg) return;

        // Luôn thêm reaction mới (cho phép stacking — không toggle)
        const reactions = Array.isArray(targetMsg.reactions) ? [...targetMsg.reactions] : [];
        const newMsgs = currentMsgs.map((m) => {
            if (m.id === messageId) {
                return { ...m, reactions: [...reactions, { userId: currentUserId, emoji }] };
            }
            return m;
        });
        setMessages(roomId, newMsgs);

        // Call API
        try {
            MessageService.setReaction(roomId, messageId, emoji);
        } catch (error) {
            console.error('Failed to set reaction', error);
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
        try {
            for (const file of files) {
                await handleSendFile(file);
            }
        } finally {
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
            m.id === messageId ? { ...m, pinned: !currentPinStatus } : m
        );

        // Add systemic pin/unpin notification locally (chỉ hiển thị cho người nhấn)
        const targetMessage = currentMsgs.find(m => m.id === messageId);
        if (targetMessage) {
            newMsgs.push({
                id: `sys-${Date.now()}-${Math.random()}`,
                senderId: 'system',
                roomId,
                content: !currentPinStatus ? 'Bạn đã ghim tin nhắn' : 'Bạn đã bỏ ghim tin nhắn',
                type: 'SYSTEM',
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
                ? { ...m, reactions: Array.isArray(m.reactions) ? m.reactions.filter(r => r.userId !== currentUserId) : [] }
                : m
        );
        setMessages(roomId, newMsgs);
        try {
            await MessageService.removeReaction(roomId, messageId);
        } catch (error) {
            console.error('Failed to remove all reactions', error);
            fetchHistory();
        }
    };

    const handleDeleteForMe = (messageId: string) => {
        if (!roomId) return;
        const currentMsgs = useChatStore.getState().messages[roomId] || [];
        const newMsgs = currentMsgs.filter(m => m.id !== messageId);
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

    const handleCall = async (type: CallType) => {
        if (!roomId) return;
        
        const receiverId = partner?.id;
        console.log(`[WebCall Debug] My ID: ${currentUserId}`);
        console.log(`[WebCall Debug] Partner ID: ${receiverId}`);
        console.log(`[WebCall Debug] Room ID: ${roomId}`);

        if (!receiverId) {
            alert('Không tìm thấy thông tin người nhận để thực hiện cuộc gọi');
            return;
        }

        if (String(receiverId).toLowerCase() === String(currentUserId).toLowerCase()) {
            console.error('[WebCall Error] Receiver ID is SAME as Current User ID!');
            alert('Lỗi: Bạn không thể tự gọi cho chính mình.');
            return;
        }

        try {
            console.log(`[WebCall] Initiating ${type} call to: ${receiverId}`);
            await initiateCall(roomId, receiverId, type, roomName, roomAvatar);
        } catch (error: any) {
            alert(error.response?.data?.message || 'Không thể thực hiện cuộc gọi. Vui lòng thử lại sau.');
        }
    };

    return (
        <div className="flex h-full overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', transition: 'background-color 0.3s ease' }}>
            {/* ── Chat area ── */}
            <div className="flex flex-col flex-1 min-w-0">
                {/* Header */}
                <div className="h-16 flex items-center px-4 shrink-0 justify-between" style={{ borderBottom: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-primary)', boxShadow: 'var(--shadow-sm)', transition: 'background-color 0.3s ease' }}>
                    <div className="flex items-center gap-3 min-w-0">
                        <Avatar src={roomAvatar} />
                        <div className="min-w-0">
                            <span className="font-bold text-base block truncate" style={{ color: 'var(--text-primary)' }}>{roomName}</span>
                            {isGroupRoom && currentRoom && (
                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                    {(currentGroupDetail?.id === roomId ? currentGroupDetail.members.length : currentRoom.participants?.length) || 0} thành viên
                                </span>
                            )}
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {/* Audio Call Button */}
                        <button
                            onClick={() => handleCall('VOICE')}
                            title="Cuộc gọi thoại"
                            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                        </button>

                        {/* Video Call Button */}
                        <button
                            onClick={() => handleCall('VIDEO')}
                            title="Cuộc gọi video"
                            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        </button>

                        {/* Nút thông tin — hiện cho CẢ 2 loại phòng */}
                        <button
                            onClick={handleToggleInfo}
                            title="Thông tin hội thoại"
                            className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${infoOpen ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-500'
                                }`}
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round"
                                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Pinned Messages Header */}
                {messagesState.some(m => m.pinned) && (() => {
                    const pinnedMessage = messagesState.filter(m => m.pinned).pop();
                    if (!pinnedMessage) return null;

                    return (
                        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors">
                            {/* Bấm vào phần trái sẽ cuộn đến tin nhắn */}
                            <div
                                className="flex items-center gap-3 overflow-hidden flex-1"
                                title="Tin nhắn đã ghim"
                                onClick={() => {
                                    const el = document.getElementById(`msg-${pinnedMessage.id}`);
                                    if (el) {
                                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        el.classList.add('bg-yellow-100');
                                        setTimeout(() => el.classList.remove('bg-yellow-100'), 1500);
                                    }
                                }}
                            >
                                <div className="text-blue-500 shrink-0">
                                    <svg className="w-5 h-5 transform rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                    </svg>
                                </div>
                                <div className="flex flex-col text-sm truncate min-w-0">
                                    <span className="font-semibold text-gray-700">Tin nhắn đã ghim</span>
                                    <span className="text-gray-500 truncate">
                                        {pinnedMessage.type === 'FILE' || pinnedMessage.type === 'IMAGE' || pinnedMessage.type === 'VIDEO' ? '[Tệp đính kèm]' : pinnedMessage.content}
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
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                        <circle cx="5" cy="12" r="2" />
                                        <circle cx="12" cy="12" r="2" />
                                        <circle cx="19" cy="12" r="2" />
                                    </svg>
                                </button>

                                {showPinnedMenu && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setShowPinnedMenu(false)} />
                                        <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-gray-100 py-1.5 min-w-[150px]">
                                            <button
                                                className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm flex items-center gap-2 text-gray-700"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(pinnedMessage.content || '');
                                                    setShowPinnedMenu(false);
                                                }}
                                            >
                                                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                                Copy
                                            </button>
                                            <button
                                                className="w-full text-left px-4 py-2 hover:bg-red-50 hover:text-red-600 text-sm flex items-center gap-2 text-gray-700"
                                                onClick={() => {
                                                    handleTogglePin(pinnedMessage.id, true);
                                                    setShowPinnedMenu(false);
                                                }}
                                            >
                                                <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4l16 16" /></svg>
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
                <Box className="flex-1 overflow-hidden flex flex-col" style={{ backgroundColor: 'var(--bg-primary)', transition: 'background-color 0.3s ease' }}>
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
                    />

                    {/* Blocked chat overlay */}
                    {isBlocked ? (
                        <div className="border-t border-gray-200 bg-gray-50">
                            {blockStatus?.blockedByYou ? (
                                <div className="flex flex-col items-center justify-center py-6 px-4 gap-3">
                                    <div className="flex items-center gap-2 text-gray-600">
                                        <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                        </svg>
                                        <span className="text-sm font-medium">Bạn đã chặn liên hệ này</span>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            if (partner?.id) {
                                                try {
                                                    await useFriendStore.getState().unblockUser(partner.id);
                                                    setBlockStatus({ blockedByYou: false, blockedByOther: false, blockerName: null });
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
                                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
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
                            onSendLike={() => handleSend('👍')}
                            onTyping={handleTyping}
                            replyingTo={replyingTo}
                            onCancelReply={handleCancelReply}
                            isSendingFile={isSendingFile}
                        />
                    )}
                </Box>
            </div>

            {/* ── Info Panel bên phải — slide-in từ phải ── */}
            <div
                style={{
                    width: infoOpen ? 300 : 0,
                    minWidth: 0,
                    overflowX: 'hidden',
                    overflowY: 'visible',
                    transition: 'width 260ms cubic-bezier(0.4,0,0.2,1)',
                    flexShrink: 0,
                    position: 'relative',
                }}
            >
                <div style={{ width: 300, height: '100%', display: 'flex', flexDirection: 'column' }}>
                    {isGroupRoom && currentRoom && (
                        <GroupInfoPanel
                            roomId={roomId}
                            onClose={closeGroupInfo}
                        />
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

        </div>
    );
};

export default ChatWindow;
