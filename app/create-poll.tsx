import React, { useMemo, useLayoutEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import CreatePollScreen from "@/views/mobile/chat/screens/CreatePollScreen";

export default function CreatePollRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    roomId?: string;
    groupName?: string;
  }>();

  const roomId = useMemo(() => {
    const raw = params.roomId;
    const s = raw == null ? "" : Array.isArray(raw) ? raw[0] : raw;
    return String(s).trim();
  }, [params.roomId]);

  const groupName = useMemo(() => {
    const raw = params.groupName;
    if (raw == null) return "Nhóm";
    const s = Array.isArray(raw) ? raw[0] : raw;
    try {
      return decodeURIComponent(String(s));
    } catch {
      return String(s);
    }
  }, [params.groupName]);

  useLayoutEffect(() => {
    if (!roomId) router.back();
  }, [roomId, router]);

  if (!roomId) return null;

  return <CreatePollScreen roomId={roomId} groupName={groupName} onClose={() => router.back()} />;
}
