import React, { useState, useEffect, useMemo, useRef } from "react";
import WebChatLayout from "../components/WebChatLayout";
import ChatWindow from "../components/ChatWindow";
import { useGroupStore } from "@/shared/store/useGroupStore";
import { useChatStore } from "@/shared/store/useChatStore";
import { useCallStore } from "@/shared/store/useCallStore";
import IncomingCallNotification from "../components/IncomingCallNotification";
import CallModal from "../components/CallModal";
import CallEndNotification from "../components/CallEndNotification";
import { chatService, mapChatRoomResponseToFrontend } from "@/shared/services/chatService";
import { useLocalSearchParams } from "expo-router";

const HomeWeb = () => {
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const params = useLocalSearchParams();
  const { registerOnGroupCreated, unregisterOnGroupCreated } = useGroupStore();
  const rooms = useChatStore((s) => s.rooms);
  const pendingOpenRoomId = useChatStore((s) => s.pendingOpenRoomId);
  const setPendingOpenRoomId = useChatStore((s) => s.setPendingOpenRoomId);
  const mergeRooms = useChatStore((s) => s.mergeRooms);
  const { activeCall } = useCallStore();

  const openRoomIdParam = useMemo(() => {
    const openRoomId = (params as any)?.openRoomId;
    const rid = Array.isArray(openRoomId) ? openRoomId[0] : openRoomId;
    return rid ? String(rid) : null;
  }, [params]);
  const lastAppliedOpenParamRef = useRef<string | null>(null);

  // Direct open via query param (used by WebSidebar Zalo Cloud click)
  useEffect(() => {
    if (!openRoomIdParam) return;
    // Avoid infinite loop: only apply when param value changes.
    if (lastAppliedOpenParamRef.current === openRoomIdParam) return;
    lastAppliedOpenParamRef.current = openRoomIdParam;
    if (pendingOpenRoomId === openRoomIdParam) return;
    setPendingOpenRoomId(openRoomIdParam);
  }, [openRoomIdParam, pendingOpenRoomId, setPendingOpenRoomId]);

  // Sau khi đồng ý kết bạn (Danh bạ): mở đúng phòng + thẻ chào mừng.
  useEffect(() => {
    if (!pendingOpenRoomId) return;
    let cancelled = false;
    const run = async () => {
      // Nếu room chưa có trong store (race sau fetch), tự fetch/merge rồi mới open
      if (!rooms.some((r) => r.id === pendingOpenRoomId)) {
        try {
          const apiRooms = await chatService.getChatRooms();
          if (cancelled) return;
          const mapped = apiRooms.map(mapChatRoomResponseToFrontend);
          mergeRooms(mapped as any);
        } catch {
          // ignore
        }
      }
      if (cancelled) return;
      setSelectedRoomId(pendingOpenRoomId);
      setPendingOpenRoomId(null);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [pendingOpenRoomId, setPendingOpenRoomId, rooms, mergeRooms]);

  // Tự động clear phòng nếu bị out khỏi room (do rời nhóm, vv...)
  useEffect(() => {
    // Tránh clear ngay lập tức khi vừa setSelectedRoomId nhưng rooms chưa kịp merge.
    if (selectedRoomId && !pendingOpenRoomId && !rooms.some((r) => r.id === selectedRoomId)) {
      setSelectedRoomId(null);
    }
  }, [rooms, selectedRoomId, pendingOpenRoomId]);

  // Đăng ký callback: khi tạo nhóm thành công → tự chuyển sang phòng mới
  // mà KHÔNG dùng router.push (giữ nguyên WebSidebar xanh)
  useEffect(() => {
    registerOnGroupCreated((roomId) => setSelectedRoomId(roomId));
    return () => unregisterOnGroupCreated();
  }, [registerOnGroupCreated, unregisterOnGroupCreated]);

  // WebSocket Signaling is now handled globally in WebSocketService.ts
  // to ensure persistence across all views.

  return (
    <WebChatLayout
      selectedRoomId={selectedRoomId}
      onSelectRoom={setSelectedRoomId}
    >
      {selectedRoomId ? (
        <ChatWindow roomId={selectedRoomId} key={selectedRoomId} />
      ) : (
        <div
          className="flex-1 flex items-center justify-center min-h-full"
          style={{ color: "var(--text-tertiary)" }}
        >
          <div className="text-center">
            <h3
              className="text-xl font-medium mb-2"
              style={{ color: "var(--text-primary)" }}
            >
              Chào mừng đến với MiniZalo
            </h3>
            <p>Chọn một cuộc trò chuyện để bắt đầu nhắn tin.</p>
          </div>
        </div>
      )}

      {/* Global Call UI */}
      <IncomingCallNotification />
      <CallEndNotification />
      {activeCall && <CallModal isOpen={!!activeCall} />}
    </WebChatLayout>
  );
};

export default HomeWeb;