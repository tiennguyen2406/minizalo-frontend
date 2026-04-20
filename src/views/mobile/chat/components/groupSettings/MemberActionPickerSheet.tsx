import React, { useMemo } from "react";
import { Modal, View, Text, TouchableOpacity, FlatList, Image } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { GroupMember } from "@/shared/types";
import { useThemeColors } from "@/shared/theme/colors";

export type MemberActionPickerMode = "ADD_ADMIN" | "BLOCK";

export function MemberActionPickerSheet({
  visible,
  mode,
  members,
  ownerId,
  busy,
  onClose,
  onPick,
}: {
  visible: boolean;
  mode: MemberActionPickerMode;
  members: GroupMember[];
  ownerId: string;
  busy: boolean;
  onClose: () => void;
  onPick: (userId: string) => void;
}) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const data = useMemo(() => {
    const list = members.filter((m) => String(m.userId) !== String(ownerId));
    if (mode === "ADD_ADMIN") {
      return list.filter((m) => m.role !== "ADMIN");
    }
    return list;
  }, [members, mode, ownerId]);

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
                Hủy
              </Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: "700", color: colors.headerText }}>
              {mode === "ADD_ADMIN" ? "Chọn thành viên" : "Chặn thành viên"}
            </Text>
            <View style={{ width: 48 }} />
          </View>
        </View>

        <FlatList
          data={data}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={{ paddingVertical: 8 }}
          renderItem={({ item }) => {
            const avatar =
              item.avatarUrl ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(item.username)}&background=0068FF&color=fff`;
            return (
              <TouchableOpacity
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  backgroundColor: colors.card,
                  borderBottomWidth: 0.5,
                  borderBottomColor: colors.border,
                }}
                disabled={busy}
                onPress={() => onPick(item.userId)}
              >
                <Image source={{ uri: avatar }} style={{ width: 44, height: 44, borderRadius: 22, marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, color: colors.text }}>
                    {item.fullName || item.username}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>{item.role}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <Text style={{ textAlign: "center", color: colors.textSecondary, marginTop: 24 }}>
              Không có thành viên phù hợp.
            </Text>
          }
        />
      </SafeAreaView>
    </Modal>
  );
}

