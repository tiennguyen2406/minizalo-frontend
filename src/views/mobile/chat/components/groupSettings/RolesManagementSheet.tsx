import React, { useMemo } from "react";
import { Modal, View, Text, TouchableOpacity, ScrollView, Image } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import type { GroupMember } from "@/shared/types";
import { useThemeColors } from "@/shared/theme/colors";

export function RolesManagementSheet({
  visible,
  members,
  ownerId,
  canManage,
  busy,
  onClose,
  onAddAdmin,
  onRemoveAdmin,
}: {
  visible: boolean;
  members: GroupMember[];
  ownerId: string;
  canManage: boolean;
  busy: boolean;
  onClose: () => void;
  onAddAdmin: () => void;
  onRemoveAdmin: (userId: string) => void;
}) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const ownerMember = useMemo(
    () => members.find((m) => String(m.userId) === String(ownerId)) || null,
    [members, ownerId],
  );
  const adminMembers = useMemo(
    () => members.filter((m) => m.role === "ADMIN" && String(m.userId) !== String(ownerId)),
    [members, ownerId],
  );

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
            <Text style={{ fontSize: 17, fontWeight: "700", color: colors.headerText }}>Trưởng và phó nhóm</Text>
            <TouchableOpacity onPress={onAddAdmin} disabled={!canManage || busy}>
              <Text
                style={{
                  color: colors.headerText,
                  fontSize: 16,
                  fontWeight: "700",
                  opacity: !canManage || busy ? 0.55 : 1,
                }}
              >
                Thêm
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingVertical: 8 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 12, paddingHorizontal: 16, marginTop: 8, marginBottom: 6 }}>
            Trưởng nhóm
          </Text>
          {ownerMember ? (
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
              <Image
                source={{
                  uri:
                    ownerMember.avatarUrl ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(ownerMember.username)}&background=0068FF&color=fff`,
                }}
                style={{ width: 44, height: 44, borderRadius: 22, marginRight: 12 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, color: colors.text, fontWeight: "600" }}>
                  {ownerMember.fullName || ownerMember.username}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>Trưởng nhóm</Text>
              </View>
            </View>
          ) : null}

          <Text style={{ color: colors.textSecondary, fontSize: 12, paddingHorizontal: 16, marginTop: 14, marginBottom: 6 }}>
            Phó nhóm ({adminMembers.length})
          </Text>

          {adminMembers.length === 0 ? (
            <Text style={{ color: colors.textSecondary, paddingHorizontal: 16, paddingVertical: 10 }}>
              Chưa có phó nhóm.
            </Text>
          ) : (
            adminMembers.map((m) => (
              <View
                key={m.userId}
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
                <Image
                  source={{
                    uri:
                      m.avatarUrl ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(m.username)}&background=0068FF&color=fff`,
                  }}
                  style={{ width: 44, height: 44, borderRadius: 22, marginRight: 12 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, color: colors.text, fontWeight: "600" }}>
                    {m.fullName || m.username}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>Phó nhóm</Text>
                </View>
                {canManage ? (
                  <TouchableOpacity
                    onPress={() => onRemoveAdmin(m.userId)}
                    disabled={busy}
                  >
                    <Text style={{ color: "#ef4444", fontWeight: "700", opacity: busy ? 0.55 : 1 }}>Xóa</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

