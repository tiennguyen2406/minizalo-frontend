import React, { useMemo } from "react";
import { useLocalSearchParams, router } from "expo-router";
import ChatOptionsScreen from "@/views/mobile/chat/screens/ChatOptionsScreen";
import { useChatStore } from "@/shared/store/useChatStore";

function oneParam(v: string | string[] | undefined): string {
    if (v == null) return "";
    return Array.isArray(v) ? String(v[0] ?? "") : String(v);
}

export default function ChatOptionsRoute() {
    const params = useLocalSearchParams();
    const rooms = useChatStore((s) => s.rooms);

    const roomId = useMemo(() => oneParam(params.roomId as string | string[] | undefined), [params.roomId]);
    const name = useMemo(() => oneParam(params.name as string | string[] | undefined), [params.name]);
    const avatarUrl = useMemo(() => oneParam(params.avatarUrl as string | string[] | undefined), [params.avatarUrl]);
    const partnerId = useMemo(() => oneParam(params.partnerId as string | string[] | undefined), [params.partnerId]);
    const typeRaw = useMemo(
        () => oneParam(params.type as string | string[] | undefined).toUpperCase(),
        [params.type],
    );

    const resolvedType = useMemo((): "DIRECT" | "GROUP" | "CLOUD" => {
        const room = rooms.find((r) => r.id === roomId);
        if (room?.type === "CLOUD") return "CLOUD";
        if (room?.type === "GROUP") return "GROUP";
        if (typeRaw === "CLOUD") return "CLOUD";
        if (typeRaw === "GROUP") return "GROUP";
        return "DIRECT";
    }, [rooms, roomId, typeRaw]);

    return (
        <ChatOptionsScreen
            roomId={roomId}
            name={name}
            avatarUrl={avatarUrl}
            partnerId={partnerId}
            type={resolvedType}
            onClose={() => router.back()}
        />
    );
}
