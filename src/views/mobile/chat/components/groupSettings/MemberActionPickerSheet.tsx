import React, { useMemo } from "react";
import { Modal, View, Text, TouchableOpacity, FlatList, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
    if (mode === "ADD_ADMIN") return list.filter((m) => m.role !== "ADMIN");
    return list;
  }, [members, mode, ownerId]);

  const title = mode === "ADD_ADMIN" ? "Chọn phó nhóm" : "Chặn thành viên";
  const empty = mode === "ADD_ADMIN" ? "Không còn thành viên phù hợp để bổ nhiệm." : "Không có thành viên phù hợp để chặn.";

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }}>
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
                Hủy
              </Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: "800", color: colors.headerText }} numberOfLines={1}>
              {title}
            </Text>
            <View style={{ width: 64 }} />
          </View>
        </View>

        <FlatList
          data={data}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={{ paddingVertical: 12, paddingBottom: 28, flexGrow: 1 }}
          renderItem={({ item }) => {
            const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.fullName || item.username)}&background=0068FF&color=fff`;
            const avatar = /^https?:\/\//i.test(String(item.avatarUrl || "")) ? item.avatarUrl! : fallbackAvatar;
            return (
              <TouchableOpacity
                activeOpacity={0.75}
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
                  opacity: busy ? 0.65 : 1,
                }}
                disabled={busy}
                onPress={() => onPick(item.userId)}
              >
                <Image source={{ uri: avatar }} style={{ width: 48, height: 48, borderRadius: 24, marginRight: 12 }} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 16, color: colors.text, fontWeight: "800" }} numberOfLines={1}>
                    {item.fullName || item.username}
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 3 }}>{item.role}</Text>
                </View>
                <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: colors.searchBg }}>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 }}>
              <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: colors.searchBg, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="people-outline" size={30} color={colors.textSecondary} />
              </View>
              <Text style={{ textAlign: "center", color: colors.textSecondary, marginTop: 14, fontSize: 15, fontWeight: "600" }}>
                {empty}
              </Text>
            </View>
          }
        />
      </View>
    </Modal>
  );
}
