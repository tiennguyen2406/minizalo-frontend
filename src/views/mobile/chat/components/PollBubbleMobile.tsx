import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { pollService } from "@/shared/services/pollService";
import type { Poll, PollOption } from "@/shared/types";
import { useAuthStore } from "@/shared/store/authStore";
import { useThemeColors } from "@/shared/theme/colors";

interface PollBubbleMobileProps {
  pollId: string;
  roomId: string;
}

export default function PollBubbleMobile({ pollId, roomId }: PollBubbleMobileProps) {
  const colors = useThemeColors();
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newOptionText, setNewOptionText] = useState("");
  const [isAddingOption, setIsAddingOption] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { data: polls, isLoading, error } = useQuery({
    queryKey: ["polls", roomId],
    queryFn: () => pollService.getPollsInRoom(roomId),
    enabled: !!pollId && !!roomId,
    refetchInterval: 5000,
  });

  const poll = polls?.find((p: Poll) => p.id === pollId);

  useEffect(() => {
    if (poll && currentUserId) {
      const mine = poll.options
        .filter((opt) => opt.votes?.some((v) => v.userId === currentUserId))
        .map((opt) => opt.id);
      setSelectedOptionIds(mine);
    }
  }, [poll, currentUserId]);

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["polls", roomId] });
  }, [queryClient, roomId]);

  const toggleOption = (optionId: string) => {
    if (!poll || poll.closed) return;
    if (!poll.allowMultipleChoices) {
      setSelectedOptionIds([optionId]);
    } else {
      setSelectedOptionIds((prev) =>
        prev.includes(optionId)
          ? prev.filter((id) => id !== optionId)
          : [...prev, optionId],
      );
    }
  };

  const handleVote = async () => {
    if (!poll) return;
    setIsSubmitting(true);
    try {
      await pollService.votePoll(poll.id, selectedOptionIds);
      invalidate();
      setDetailOpen(false);
    } catch (e) {
      console.error(e);
      Alert.alert("Lỗi", "Không gửi được bình chọn.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddOption = async () => {
    if (!poll || !newOptionText.trim()) return;
    setIsSubmitting(true);
    try {
      await pollService.addOptionToPoll(poll.id, newOptionText.trim());
      setNewOptionText("");
      setIsAddingOption(false);
      invalidate();
    } catch (e) {
      console.error(e);
      Alert.alert("Lỗi", "Không thêm được lựa chọn.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClosePoll = () => {
    if (!poll) return;
    Alert.alert("Đóng bình chọn", "Bạn có chắc muốn đóng bình chọn này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Đóng",
        style: "destructive",
        onPress: async () => {
          setIsSubmitting(true);
          try {
            await pollService.closePoll(poll.id);
            setSettingsOpen(false);
            setDetailOpen(false);
            invalidate();
          } catch (e) {
            console.error(e);
            Alert.alert("Lỗi", "Không đóng được bình chọn.");
          } finally {
            setIsSubmitting(false);
          }
        },
      },
    ]);
  };

  if (isLoading || !pollId) {
    return (
      <View
        style={{
          padding: 16,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          alignItems: "center",
        }}
      >
        <ActivityIndicator color={colors.primary} />
        <Text style={{ marginTop: 8, color: colors.textSecondary, fontSize: 13 }}>
          Đang tải bình chọn…
        </Text>
      </View>
    );
  }

  if (error || !poll) {
    return (
      <View
        style={{
          padding: 16,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
        }}
      >
        <Text style={{ color: "#ef4444", fontSize: 14 }}>Không tải được bình chọn.</Text>
      </View>
    );
  }

  const totalVotes = poll.options.reduce((s, opt) => s + (opt.votes?.length || 0), 0);
  const isCreator = poll.createdById === currentUserId;
  const canManage = isCreator && !poll.closed;

  const renderOptionRow = (opt: PollOption, interactive: boolean) => {
    const votesCount = opt.votes?.length || 0;
    const percent = totalVotes > 0 ? Math.round((votesCount / totalVotes) * 100) : 0;
    const isSelected = selectedOptionIds.includes(opt.id);
    return (
      <Pressable
        key={opt.id}
        onPress={() => interactive && toggleOption(opt.id)}
        style={{
          marginBottom: 8,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: isSelected ? colors.primary : colors.border,
          backgroundColor: colors.card,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${percent}%`,
            backgroundColor: `${colors.primary}22`,
          }}
        />
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 10,
            paddingHorizontal: 12,
            gap: 10,
          }}
        >
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              borderWidth: 2,
              borderColor: isSelected ? colors.primary : colors.border,
              backgroundColor: isSelected ? colors.primary : "transparent",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
          <Text style={{ flex: 1, color: colors.text, fontSize: 15, fontWeight: "600" }}>
            {opt.text}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "700" }}>
            {votesCount}
          </Text>
        </View>
      </Pressable>
    );
  };

  const InlineOptions = ({ interactive }: { interactive: boolean }) => (
    <View style={{ paddingTop: 4 }}>
      {poll.options.map((opt) => renderOptionRow(opt, interactive))}
      {!poll.closed && poll.allowAddOptions && interactive && (
        <View style={{ marginTop: 8 }}>
          {isAddingOption ? (
            <View style={{ gap: 8 }}>
              <TextInput
                value={newOptionText}
                onChangeText={setNewOptionText}
                placeholder="Thêm lựa chọn..."
                placeholderTextColor={colors.textSecondary}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  color: colors.text,
                  fontSize: 15,
                }}
              />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity
                  onPress={handleAddOption}
                  disabled={isSubmitting || !newOptionText.trim()}
                  style={{
                    flex: 1,
                    backgroundColor: colors.primary,
                    paddingVertical: 10,
                    borderRadius: 10,
                    alignItems: "center",
                    opacity: !newOptionText.trim() ? 0.5 : 1,
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "700" }}>Thêm</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setIsAddingOption(false);
                    setNewOptionText("");
                  }}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ color: colors.text }}>Hủy</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setIsAddingOption(true)}>
              <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 14 }}>
                + Thêm phương án
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );

  return (
    <View style={{ width: "100%", maxWidth: 400, alignSelf: "center" }}>
      <View
        style={{
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          overflow: "hidden",
        }}
      >
        <View style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <Ionicons name="stats-chart-outline" size={18} color={colors.primary} />
            <Text
              style={{
                color: colors.primary,
                fontSize: 12,
                fontWeight: "800",
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Bình chọn
            </Text>
            {poll.closed && (
              <Text style={{ color: "#ef4444", fontSize: 12, fontWeight: "700" }}>Đã đóng</Text>
            )}
          </View>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: "700" }}>
            {poll.question}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
            {poll.closed
              ? `${totalVotes} lượt bình chọn`
              : poll.allowMultipleChoices
                ? "Có thể chọn nhiều phương án"
                : "Chỉ chọn một phương án"}
          </Text>
        </View>

        <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
          {!poll.closed ? (
            <>
              <TouchableOpacity
                onPress={() => setDetailOpen(true)}
                style={{
                  backgroundColor: colors.primary,
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>Mở bình chọn</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8 }}>
                Kết quả ({poll.options.length} phương án)
              </Text>
              <InlineOptions interactive={false} />
              <TouchableOpacity
                onPress={() => setDetailOpen(true)}
                style={{
                  marginTop: 12,
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.primary, fontWeight: "700" }}>Xem chi tiết</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <Modal visible={detailOpen} transparent animationType="slide" onRequestClose={() => setDetailOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <Pressable
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}
            onPress={() => setDetailOpen(false)}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{
                backgroundColor: colors.card,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                paddingBottom: Platform.OS === "ios" ? 34 : 20,
                maxHeight: "88%",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 16,
                  paddingTop: 12,
                  paddingBottom: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textSecondary }}>
                    Bình chọn
                  </Text>
                  <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }} numberOfLines={2}>
                    {poll.question}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setDetailOpen(false)} hitSlop={12}>
                  <Ionicons name="close" size={26} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ paddingHorizontal: 16, paddingTop: 12 }} keyboardShouldPersistTaps="handled">
                <InlineOptions interactive={!poll.closed} />

                {!poll.closed && (
                  <TouchableOpacity
                    onPress={handleVote}
                    disabled={isSubmitting || selectedOptionIds.length === 0}
                    style={{
                      marginTop: 8,
                      marginBottom: 12,
                      backgroundColor: colors.primary,
                      paddingVertical: 14,
                      borderRadius: 12,
                      alignItems: "center",
                      opacity: selectedOptionIds.length === 0 ? 0.45 : 1,
                    }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>
                      {isSubmitting ? "Đang gửi…" : "Gửi lựa chọn"}
                    </Text>
                  </TouchableOpacity>
                )}

                {canManage && (
                  <TouchableOpacity
                    onPress={() => setSettingsOpen((v) => !v)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      paddingVertical: 10,
                      marginBottom: 8,
                    }}
                  >
                    <Ionicons name="settings-outline" size={20} color={colors.textSecondary} />
                    <Text style={{ color: colors.text, fontWeight: "600" }}>Quản lý</Text>
                    <Ionicons
                      name={settingsOpen ? "chevron-up" : "chevron-down"}
                      size={18}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                )}

                {canManage && settingsOpen && (
                  <TouchableOpacity
                    onPress={handleClosePoll}
                    disabled={isSubmitting}
                    style={{
                      borderWidth: 1,
                      borderColor: "#fecaca",
                      backgroundColor: "#fef2f2",
                      paddingVertical: 12,
                      borderRadius: 12,
                      alignItems: "center",
                      marginBottom: 20,
                    }}
                  >
                    <Text style={{ color: "#dc2626", fontWeight: "800" }}>Đóng bình chọn</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
