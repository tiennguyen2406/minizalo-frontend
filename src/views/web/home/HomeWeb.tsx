import React, { useState, useEffect } from "react";
import WebChatLayout from "../components/WebChatLayout";
import ChatWindow from "../components/ChatWindow";
import { useGroupStore } from "@/shared/store/useGroupStore";
import { useChatStore } from "@/shared/store/useChatStore";

const HomeWeb = () => {
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const { registerOnGroupCreated, unregisterOnGroupCreated } = useGroupStore();
  const rooms = useChatStore((s) => s.rooms);
  const pendingOpenRoomId = useChatStore((s) => s.pendingOpenRoomId);
  const setPendingOpenRoomId = useChatStore((s) => s.setPendingOpenRoomId);

  // Sau khi đồng ý kết bạn (Danh bạ): mở đúng phòng + thẻ chào mừng.
  useEffect(() => {
    if (!pendingOpenRoomId) return;
    setSelectedRoomId(pendingOpenRoomId);
    setPendingOpenRoomId(null);
  }, [pendingOpenRoomId, setPendingOpenRoomId]);

  // Tự động clear phòng nếu bị out khỏi room (do rời nhóm, vv...)
  useEffect(() => {
    if (selectedRoomId && !rooms.some((r) => r.id === selectedRoomId)) {
      setSelectedRoomId(null);
    }
  }, [rooms, selectedRoomId]);

  // Đăng ký callback: khi tạo nhóm thành công → tự chuyển sang phòng mới
  // mà KHÔNG dùng router.push (giữ nguyên WebSidebar xanh)
  useEffect(() => {
    registerOnGroupCreated((roomId) => setSelectedRoomId(roomId));
    return () => unregisterOnGroupCreated();
  }, []);

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
    </WebChatLayout>
  );
};

export default HomeWeb;
