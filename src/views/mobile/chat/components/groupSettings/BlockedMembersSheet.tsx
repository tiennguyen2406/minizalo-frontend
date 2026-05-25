import React from "react";
import { Modal, View, Text, TouchableOpacity, ActivityIndicator, FlatList, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
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
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
        <View style={{ backgroundColor: colors.headerBg }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              minHeight: 58,
              borderBottomWidth: colors.headerBg === "#0068FF" ? 0 : 0.5,
              borderBottomColor: colors.border,
            }}
          >
            <TouchableOpacity onPress={onClose} disabled={busy} style={{ paddingVertical: 8, minWidth: 64 }}>
              <Text style={{ color: colors.headerText, fontSize: 16, fontWeight: "700", opacity: busy ? 0.55 : 1 }}>
                Đóng
              </Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: "800", color: colors.headerText }}>Chặn khỏi nhóm</Text>
            <TouchableOpacity onPress={onOpenBlockPicker} disabled={!canManage || busy} style={{ paddingVertical: 8, minWidth: 64, alignItems: "flex-end" }}>
              <Text style={{ color: colors.headerText, fontSize: 16, fontWeight: "800", opacity: !canManage || busy ? 0.55 : 1 }}>
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
            contentContainerStyle={{ paddingVertical: 12, paddingBottom: 28, flexGrow: 1 }}
            ListEmptyComponent={
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 }}>
                <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: colors.searchBg, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="ban-outline" size={30} color={colors.textSecondary} />
                </View>
                <Text style={{ textAlign: "center", color: colors.textSecondary, marginTop: 14, fontSize: 15, fontWeight: "600" }}>
                  Chưa có ai bị chặn.
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const avatar = item.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.displayName || item.username)}&background=0068FF&color=fff`;
              return (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginHorizontal: 12,
                    marginBottom: 8,
                    paddingHorizontal: 14,
                    paddingVertical: 13,
                    backgroundColor: colors.card,
                    borderRadius: 14,
                    borderWidth: 0.5,
                    borderColor: colors.border,
                  }}
                >
                  <Image source={{ uri: avatar }} style={{ width: 48, height: 48, borderRadius: 24, marginRight: 12 }} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 16, color: colors.text, fontWeight: "800" }} numberOfLines={1}>
                      {item.displayName || item.username}
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 3 }}>Đã chặn</Text>
                  </View>
                  <TouchableOpacity onPress={() => onUnblock(item.userId)} disabled={busy} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.primary + "18" }}>
                    <Text style={{ color: colors.primary, fontWeight: "800", opacity: busy ? 0.55 : 1 }}>Bỏ chặn</Text>
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
