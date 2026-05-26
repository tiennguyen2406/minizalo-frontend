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
  const hasVoted = selectedOptionIds.length > 0;

  const renderOptionRow = (opt: PollOption, interactive: boolean) => {
    const isSelected = selectedOptionIds.includes(opt.id);
    return (
      <Pressable
        key={opt.id}
        onPress={() => interactive && toggleOption(opt.id)}
        style={{
          backgroundColor: colors.searchBg,
          borderRadius: 8,
          paddingVertical: 12,
          paddingHorizontal: 12,
          marginBottom: 10,
          borderWidth: 1,
          borderColor: isSelected ? colors.primary : "rgba(0,0,0,0.05)",
        }}
      >
        <Text
          style={{
            color: colors.text,
            fontSize: 15,
            fontWeight: "600",
          }}
          numberOfLines={2}
        >
          {opt.text}
        </Text>
      </Pressable>
    );
  };

  const InlineOptions = ({ interactive }: { interactive: boolean }) => (
    <View style={{ paddingTop: 8 }}>
      {poll.options.map((opt) => renderOptionRow(opt, interactive))}
    </View>
  );

  return (
    <View style={{ width: "88%", maxWidth: 340, alignSelf: "center" }}>
      <Pressable
        onPress={() => setDetailOpen(true)}
        style={{
          borderRadius: 12,
          borderWidth: 1,
          borderColor: "rgba(0,0,0,0.08)",
          backgroundColor: colors.card,
          paddingHorizontal: 14,
          paddingTop: 12,
          paddingBottom: 14,
        }}
      >
        <Text style={{ color: colors.text, fontSize: 16.5, fontWeight: "800", marginBottom: 10 }}>
          {poll.question}
        </Text>

        <InlineOptions interactive={!poll.closed && !hasVoted} />

        <TouchableOpacity
          onPress={hasVoted ? () => setDetailOpen(true) : handleVote}
          disabled={poll.closed || isSubmitting || selectedOptionIds.length === 0}
          style={{
            marginTop: 2,
            borderRadius: 10,
            paddingVertical: 12,
            backgroundColor: "rgba(0, 104, 255, 0.1)",
            alignItems: "center",
            opacity: poll.closed || selectedOptionIds.length === 0 ? 0.55 : 1,
          }}
        >
          <Text style={{ color: colors.primary, fontSize: 15.5, fontWeight: "800" }}>
            {poll.closed
              ? "Đã đóng"
              : hasVoted
                ? "Sửa bình chọn"
                : isSubmitting
                  ? "Đang gửi..."
                  : "Bình chọn"}
          </Text>
        </TouchableOpacity>
      </Pressable>

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
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 10 }}>
                  {poll.closed ? `${totalVotes} lượt bình chọn` : poll.allowMultipleChoices ? "Chọn nhiều phương án" : "Chỉ chọn 1 phương án"}
                </Text>
                {poll.options.map((opt) => {
                  const votesCount = opt.votes?.length || 0;
                  const isSelected = selectedOptionIds.includes(opt.id);
                  return (
                    <Pressable
                      key={opt.id}
                      onPress={() => !poll.closed && toggleOption(opt.id)}
                      style={{
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: isSelected ? colors.primary : colors.border,
                        backgroundColor: colors.card,
                        paddingHorizontal: 12,
                        paddingVertical: 12,
                        marginBottom: 10,
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <Text style={{ flex: 1, color: colors.text, fontSize: 15, fontWeight: "700" }}>
                          {opt.text}
                        </Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "800" }}>
                          {votesCount}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}

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
                      borderColor: "rgba(220, 38, 38, 0.3)",
                      backgroundColor: "rgba(220, 38, 38, 0.1)",
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
