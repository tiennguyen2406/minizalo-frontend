import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFriendStore } from "@/shared/store/friendStore";
import type { FriendResponseDto } from "@/shared/services/types";
import { useThemeColors } from "@/shared/theme/colors";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Image } from "react-native";
import { getImageUrl } from "@/shared/utils/mediaUtils";
import { chatService, mapChatRoomResponseToFrontend } from "@/shared/services/chatService";
import { useChatStore } from "@/shared/store/useChatStore";

export default function FriendRequestsMobile() {
  const {
    requests,
    sentRequests,
    loading,
    error,
    fetchRequests,
    fetchSentRequests,
    acceptRequest,
    rejectRequest,
    cancelSentRequest,
    clearError,
    fetchFriends,
  } = useFriendStore();
  const router = useRouter();
  const upsertRoom = useChatStore((s) => s.upsertRoom);
  const colors = useThemeColors();
  const [tab, setTab] = useState<"received" | "sent">("received");

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    (async () => {
      await Promise.all([fetchRequests(), fetchSentRequests()]);
    })();
  }, [fetchRequests, fetchSentRequests]);

    const handleAccept = async (id: string, targetUserId?: string, targetName?: string, targetAvatarUrl?: string) => {
        try {
            await acceptRequest(id);
            await fetchFriends();
            if (targetUserId) {
              const room = await chatService.createPrivateRoom(targetUserId);
              const frontendRoom = mapChatRoomResponseToFrontend(room);
              upsertRoom(frontendRoom);

              const participants = frontendRoom.participants || [];
              const partner = participants.find((p: any) => p.id === targetUserId);
              const displayName =
                (partner?.fullName && String(partner.fullName).trim()) ||
                (partner?.username && String(partner.username).trim()) ||
                (targetName && String(targetName).trim()) ||
                frontendRoom.name ||
                "Chat";

              router.push({
                pathname: `/chat/${frontendRoom.id}`,
                params: {
                  name: displayName,
                  type: "DIRECT",
                  targetUserId,
                  isStranger: "false",
                  avatarUrl: targetAvatarUrl || "",
                  showWelcomeTemplates: "true",
                },
              });
            }
        } catch {
            // lỗi đã nằm trong store
        }
    };

  const handleReject = async (id: string) => {
    try {
      await rejectRequest(id);
    } catch {
      // lỗi đã nằm trong store
    }
  };

  const handleCancelSent = async (id: string) => {
    try {
      await cancelSentRequest(id);
    } catch {
      // lỗi đã nằm trong store
    }
  };

  const renderReceivedItem = ({ item }: { item: FriendResponseDto }) => {
    const user = item.user; // user = người gửi, friend = người nhận (current user)
    const displayName = user.displayName || user.username || "Người dùng";
    const initial = (displayName.charAt(0).toUpperCase() || "?").toUpperCase();

    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderBottomWidth: 0.5,
          borderBottomColor: colors.border,
          backgroundColor: colors.background,
        }}
      >
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: colors.searchBg,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <Text
            style={{
              color: colors.text,
              fontWeight: "600",
              fontSize: 16,
            }}
          >
            {initial}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={1}
            style={{
              color: colors.text,
              fontSize: 15,
              fontWeight: "500",
            }}
          >
            {displayName}
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 12,
              marginTop: 2,
            }}
          >
            Muốn kết bạn
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            onPress={() => handleReject(item.id)}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: "#f97373",
            }}
          >
            <Text
              style={{
                color: "#f97373",
                fontSize: 12,
                fontWeight: "500",
              }}
            >
              Từ chối
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleAccept(item.id, user?.id, displayName, user?.avatarUrl)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: colors.primary,
            }}
          >
            <Text
              style={{
                color: "#fff",
                fontSize: 12,
                fontWeight: "600",
              }}
            >
              Đồng ý
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

    const renderSentItem = ({ item }: { item: FriendResponseDto }) => {
        const user = item.friend; // với request mình gửi, friend = người nhận
        const displayName = user.displayName || user.username || "Người dùng";
        const initial =
            (displayName.charAt(0).toUpperCase() || "?").toUpperCase();

        return (
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderBottomWidth: 0.5,
                    borderBottomColor: colors.border,
                    backgroundColor: colors.background,
                }}
            >
                <View
                    style={{
                        width: 42,
                        height: 42,
                        borderRadius: 21,
                        backgroundColor: colors.searchBg,
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 12,
                        overflow: "hidden",
                    }}
                >
                    {user.avatarUrl ? (
                        <Image
                            source={{ uri: getImageUrl(user.avatarUrl) }}
                            style={{ width: 42, height: 42 }}
                        />
                    ) : (
                        <Text
                            style={{
                                color: colors.text,
                                fontWeight: "600",
                                fontSize: 16,
                            }}
                        >
                            {initial}
                        </Text>
                    )}
                </View>
                <View style={{ flex: 1 }}>
                    <Text
                        numberOfLines={1}
                        style={{
                            color: colors.text,
                            fontSize: 15,
                            fontWeight: "500",
                        }}
                    >
                        {displayName}
                    </Text>
                    <Text
                        style={{
                            color: colors.textSecondary,
                            fontSize: 12,
                            marginTop: 2,
                        }}
                    >
                        Bạn đã gửi lời mời
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={() => handleCancelSent(item.id)}
                    style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: "#f97373",
                    }}
                >
                    <Text
                        style={{
                            color: "#f97373",
                            fontSize: 12,
                            fontWeight: "500",
                        }}
                    >
                        Hủy
                    </Text>
                </TouchableOpacity>
            </View>
        );
    };

  const currentList = tab === "received" ? requests : sentRequests;

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: colors.background,
      }}
      edges={["top"]}
    >
      <StatusBar style={colors.statusBar} />
      {/* Header: nút back + tiêu đề giống Zalo */}
      <View
        style={{
          backgroundColor: colors.headerBg,
          borderBottomWidth: colors.headerBg === "#0068FF" ? 0 : 0.5,
          borderBottomColor: colors.border,
        }}
      >
        <View
          style={{
            height: 52,
            paddingHorizontal: 16,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ paddingRight: 8, paddingVertical: 4 }}
            activeOpacity={0.8}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={26} color={colors.headerText} />
          </TouchableOpacity>
          <Text
            style={{
              color: colors.headerText,
              fontSize: 18,
              fontWeight: "600",
            }}
          >
            Lời mời kết bạn
          </Text>
        </View>
      </View>
      {/* Tabs Đã nhận / Đã gửi với số lượng, kiểu gạch chân giống Zalo */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          backgroundColor: colors.card,
          borderBottomWidth: 0.5,
          borderBottomColor: colors.border,
        }}
      >
        {[
          {
            key: "received" as const,
            label: `Đã nhận ${requests.length}`,
          },
          {
            key: "sent" as const,
            label: `Đã gửi ${sentRequests.length}`,
          },
        ].map((item) => {
          const active = tab === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              onPress={() => setTab(item.key as "received" | "sent")}
              style={{
                flex: 1,
                alignItems: "center",
                paddingBottom: 6,
                borderBottomWidth: active ? 2 : 0,
                borderBottomColor: active ? colors.primary : "transparent",
              }}
            >
              <Text
                style={{
                  color: active ? colors.text : colors.textSecondary,
                  fontSize: 14,
                  fontWeight: active ? "600" : "500",
                  paddingTop: 8,
                }}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {error ? (
        <TouchableOpacity
          onPress={clearError}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 8,
            backgroundColor: "#7f1d1d",
          }}
        >
          <Text
            style={{
              color: "#fee2e2",
              fontSize: 12,
            }}
          >
            {error} (chạm để ẩn)
          </Text>
        </TouchableOpacity>
      ) : null}

      {loading && currentList.length === 0 ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator color={colors.primary} />
          <Text
            style={{
              marginTop: 8,
              color: colors.textSecondary,
              fontSize: 13,
            }}
          >
            Đang tải lời mời kết bạn...
          </Text>
        </View>
      ) : currentList.length === 0 ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 32,
          }}
        >
          <Ionicons
            name="mail-open-outline"
            size={40}
            color={colors.textSecondary}
          />
          <Text
            style={{
              marginTop: 12,
              color: colors.text,
              fontSize: 16,
              fontWeight: "500",
              textAlign: "center",
            }}
          >
            {tab === "received"
              ? "Chưa có lời mời kết bạn nào"
              : "Bạn chưa gửi lời mời kết bạn nào"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={currentList}
          keyExtractor={(item) => item.id}
          renderItem={tab === "received" ? renderReceivedItem : renderSentItem}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </SafeAreaView>
  );
}
