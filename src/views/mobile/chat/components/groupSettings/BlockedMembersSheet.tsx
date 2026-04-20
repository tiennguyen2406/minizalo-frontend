import React from "react";
import { Modal, View, Text, TouchableOpacity, ActivityIndicator, FlatList, Image } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import type { BlockedMember } from "@/shared/types";
import { useThemeColors } from "@/shared/theme/colors";

export function BlockedMembersSheet({
  visible,
  loading,
  members,
  busy,
  canManage,
  onClose,
  onOpenBlockPicker,
  onUnblock,
}: {
  visible: boolean;
  loading: boolean;
  members: BlockedMember[];
  busy: boolean;
  canManage: boolean;
  onClose: () => void;
  onOpenBlockPicker: () => void;
  onUnblock: (userId: string) => void;
}) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
        <View style={{ backgroundColor: colors.headerBg, paddingTop: insets.top }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              minHeight: 56,
              borderBottomWidth: colors.headerBg === "#0068FF" ? 0 : 0.5,
              borderBottomColor: colors.border,
              backgroundColor: colors.headerBg,
            }}
          >
            <TouchableOpacity onPress={onClose} disabled={busy}>
              <Text style={{ color: colors.headerText, fontSize: 16, fontWeight: "600", opacity: busy ? 0.55 : 1 }}>
                Đóng
              </Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: "700", color: colors.headerText }}>Chặn khỏi nhóm</Text>
            <TouchableOpacity onPress={onOpenBlockPicker} disabled={!canManage || busy}>
              <Text
                style={{
                  color: colors.headerText,
                  fontSize: 16,
                  fontWeight: "700",
                  opacity: !canManage || busy ? 0.55 : 1,
                }}
              >
                Chặn
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={members}
            keyExtractor={(item) => item.userId}
            contentContainerStyle={{ paddingVertical: 8 }}
            ListEmptyComponent={
              <Text style={{ textAlign: "center", color: colors.textSecondary, marginTop: 24 }}>
                Chưa có ai bị chặn.
              </Text>
            }
            renderItem={({ item }) => {
              const avatar =
                item.avatarUrl ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(item.displayName || item.username)}&background=0068FF&color=fff`;
              return (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    backgroundColor: colors.card,
                    borderBottomWidth: 0.5,
                    borderBottomColor: colors.border,
                  }}
                >
                  <Image source={{ uri: avatar }} style={{ width: 44, height: 44, borderRadius: 22, marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, color: colors.text, fontWeight: "600" }}>
                      {item.displayName || item.username}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>Đã chặn</Text>
                  </View>
                  <TouchableOpacity onPress={() => onUnblock(item.userId)} disabled={busy}>
                    <Text style={{ color: colors.primary, fontWeight: "700", opacity: busy ? 0.55 : 1 }}>
                      Bỏ chặn
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

