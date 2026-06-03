import React, { useMemo } from "react";
import { Modal, View, Text, TouchableOpacity, ScrollView, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { GroupMember } from "@/shared/types";
import { useThemeColors } from "@/shared/theme/colors";

function avatarOf(member: GroupMember) {
  const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(member.fullName || member.username || "User")}&background=0068FF&color=fff`;
  return /^https?:\/\//i.test(String(member.avatarUrl || "")) ? member.avatarUrl! : fallback;
}

function MemberCard({
  member,
  roleLabel,
  action,
}: {
  member: GroupMember;
  roleLabel: string;
  action?: React.ReactNode;
}) {
  const colors = useThemeColors();
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
      <Image source={{ uri: avatarOf(member) }} style={{ width: 48, height: 48, borderRadius: 24, marginRight: 12 }} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 16, color: colors.text, fontWeight: "800" }} numberOfLines={1}>
          {member.fullName || member.username}
        </Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 3 }} numberOfLines={1}>
          {roleLabel}
        </Text>
      </View>
      {action}
    </View>
  );
}

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
                Đóng
              </Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: "800", color: colors.headerText }} numberOfLines={1}>
              Trưởng và phó nhóm
            </Text>
            <TouchableOpacity onPress={onAddAdmin} disabled={!canManage || busy} style={{ paddingVertical: 8, minWidth: 64, alignItems: "flex-end" }}>
              <Text style={{ color: colors.headerText, fontSize: 16, fontWeight: "800", opacity: !canManage || busy ? 0.55 : 1 }}>
                Thêm
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingVertical: 12, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
          <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "800", paddingHorizontal: 20, marginTop: 8, marginBottom: 8 }}>
            Trưởng nhóm
          </Text>
          {ownerMember ? <MemberCard member={ownerMember} roleLabel="Trưởng nhóm" /> : null}

          <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "800", paddingHorizontal: 20, marginTop: 16, marginBottom: 8 }}>
            Phó nhóm ({adminMembers.length})
          </Text>
          {adminMembers.length === 0 ? (
            <View style={{ marginHorizontal: 12, borderRadius: 14, backgroundColor: colors.card, borderWidth: 0.5, borderColor: colors.border, paddingVertical: 28, alignItems: "center" }}>
              <Ionicons name="shield-outline" size={30} color={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 8 }}>Chưa có phó nhóm.</Text>
            </View>
          ) : (
            adminMembers.map((m) => (
              <MemberCard
                key={m.userId}
                member={m}
                roleLabel="Phó nhóm"
                action={
                  canManage ? (
                    <TouchableOpacity onPress={() => onRemoveAdmin(m.userId)} disabled={busy} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: "#fee2e2" }}>
                      <Text style={{ color: "#ef4444", fontWeight: "800", opacity: busy ? 0.55 : 1 }}>Xóa</Text>
                    </TouchableOpacity>
                  ) : null
                }
              />
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
