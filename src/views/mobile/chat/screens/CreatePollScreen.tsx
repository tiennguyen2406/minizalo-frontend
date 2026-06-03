import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/shared/theme/colors";
import { useThemeStore } from "@/shared/store/themeStore";
import { pollService } from "@/shared/services/pollService";
import { webSocketService } from "@/shared/services/WebSocketService";

const HAIRLINE = Platform.OS === "ios" ? 0.5 : 1;

export interface CreatePollScreenProps {
  roomId: string;
  groupName: string;
  onClose: () => void;
}

/**
 * Màn tạo bình chọn toàn màn (tham chiếu giao diện Zalo: header, ghim, câu hỏi, phương án, tuỳ chọn).
 * Chỉ gửi lên server: câu hỏi, phương án, chọn nhiều, thêm phương án. Các mục khác (hạn, ẩn phiếu) hiển thị theo mẫu, sẽ bổ sung khi API có.
 */
export default function CreatePollScreen({ roomId, groupName, onClose }: CreatePollScreenProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const theme = useThemeStore((s) => s.theme);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [pinToTop, setPinToTop] = useState(false);
  const [allowMultipleChoices, setAllowMultipleChoices] = useState(true);
  const [allowAddOptions, setAllowAddOptions] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleOptionChange = (idx: number, val: string) => {
    const next = [...options];
    next[idx] = val;
    setOptions(next);
  };

  const handleRemoveOption = (idx: number) => {
    if (options.length <= 2) return;
    const next = [...options];
    next.splice(idx, 1);
    setOptions(next);
  };

  const handleCreate = async () => {
    const cleanedQuestion = question.trim();
    const cleanedOptions = options.map((o) => o.trim()).filter(Boolean);

    if (!cleanedQuestion) {
      Alert.alert("Thiếu nội dung", "Vui lòng nhập câu hỏi bình chọn.");
      return;
    }
    if (cleanedOptions.length < 2) {
      Alert.alert("Thiếu lựa chọn", "Cần ít nhất 2 phương án hợp lệ.");
      return;
    }

    setLoading(true);
    try {
      const poll = await pollService.createPoll({
        roomId,
        question: cleanedQuestion,
        options: cleanedOptions,
        allowMultipleChoices,
        allowAddOptions,
      });

      if (pinToTop && poll?.id) {
        webSocketService.activate();
        webSocketService.sendPin({
          roomId,
          messageId: poll.id,
          pin: true,
          messageType: "POLL",
        });
      }

      onClose();
    } catch (e) {
      console.error(e);
      Alert.alert(
        "Không tạo được bình chọn",
        "Kiểm tra kết nối hoặc quyền tạo trong cài đặt nhóm.",
      );
    } finally {
      setLoading(false);
    }
  };

  const sectionTitleBlue = (
    <Text style={{ fontSize: 13, fontWeight: "700", color: colors.primary, marginBottom: 10, marginTop: 6 }}>
      Tuỳ chọn
    </Text>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar style={colors.statusBar} />
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderBottomWidth: HAIRLINE,
            borderBottomColor: colors.border,
            backgroundColor: colors.card,
          }}
        >
          <TouchableOpacity onPress={onClose} hitSlop={12} style={{ padding: 6 }}>
            <Ionicons name="chevron-back" size={26} color={colors.primary} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center", paddingHorizontal: 8 }}>
            <Text style={{ fontSize: 17, fontWeight: "700", color: colors.text }} numberOfLines={1}>
              Tạo bình chọn mới
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
              {groupName?.trim() || "Nhóm"}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => void handleCreate()}
            disabled={loading}
            style={{ paddingVertical: 8, paddingHorizontal: 10, minWidth: 56, alignItems: "flex-end" }}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={{ fontSize: 15, fontWeight: "800", color: colors.primary }}>TẠO</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingBottom: Platform.OS === "ios" ? 36 : 24,
            paddingHorizontal: 16,
            paddingTop: 12,
            backgroundColor: colors.background,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Ghim */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => setPinToTop((v) => !v)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 12,
              marginBottom: 8,
            }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                borderWidth: 2,
                borderColor: pinToTop ? colors.primary : colors.border,
                backgroundColor: pinToTop ? colors.primary : "transparent",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 12,
              }}
            >
              {pinToTop ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
            </View>
            <Text style={{ fontSize: 16, color: colors.text, flex: 1 }}>Ghim lên đầu trò chuyện</Text>
          </TouchableOpacity>

          <TextInput
            value={question}
            onChangeText={setQuestion}
            placeholder="Đặt câu hỏi bình chọn"
            placeholderTextColor={colors.textSecondary}
            multiline
            style={{
              fontSize: 17,
              color: colors.text,
              paddingVertical: 12,
              marginBottom: 8,
              minHeight: 44,
            }}
          />

          {options.map((opt, idx) => (
            <View
              key={idx}
              style={{
                flexDirection: "row",
                alignItems: "center",
                borderBottomWidth: HAIRLINE,
                borderBottomColor: colors.border,
                paddingVertical: 4,
              }}
            >
              <TextInput
                value={opt}
                onChangeText={(t) => handleOptionChange(idx, t)}
                placeholder={`Phương án ${idx + 1}`}
                placeholderTextColor={colors.textSecondary}
                style={{
                  flex: 1,
                  fontSize: 16,
                  color: colors.text,
                  paddingVertical: 12,
                  paddingRight: 8,
                }}
              />
              {options.length > 2 ? (
                <TouchableOpacity onPress={() => handleRemoveOption(idx)} hitSlop={10}>
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              ) : (
                <View style={{ width: 22 }} />
              )}
            </View>
          ))}

          <TouchableOpacity onPress={() => setOptions([...options, ""])} style={{ paddingVertical: 14 }}>
            <Text style={{ fontSize: 16, fontWeight: "600", color: colors.primary }}>Thêm phương án</Text>
          </TouchableOpacity>

          <View style={{ height: 10, borderTopWidth: 8, borderTopColor: theme === "dark" ? "#111" : "#f0f2f5", marginHorizontal: -16 }} />

          {sectionTitleBlue}

          {/* Hạn — API chưa có */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() =>
              Alert.alert(
                "Đặt thời hạn",
                "Tính năng hạn bình chọn chưa được bật trên máy chủ. Hiện tại bình chọn chỉ đóng thủ công khi quản trị khóa.",
              )
            }
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: 14,
              borderBottomWidth: HAIRLINE,
              borderBottomColor: colors.border,
            }}
          >
            <Text style={{ fontSize: 16, color: colors.text }}>Đặt thời hạn</Text>
            <Text style={{ fontSize: 15, color: colors.textSecondary }}>Không có thời hạn</Text>
          </TouchableOpacity>

          <SwitchRow
            label="Ẩn người bình chọn"
            value={false}
            disabled
            subtitle="Chưa hỗ trợ máy chủ"
            colors={colors}
          />
          <SwitchRow
            label="Ẩn kết quả khi chưa bình chọn"
            value={false}
            disabled
            subtitle="Chưa hỗ trợ máy chủ"
            colors={colors}
          />
          <SwitchRow
            label="Chọn nhiều phương án"
            value={allowMultipleChoices}
            onValueChange={setAllowMultipleChoices}
            colors={colors}
          />
          <SwitchRow
            label="Có thể thêm phương án"
            value={allowAddOptions}
            onValueChange={setAllowAddOptions}
            colors={colors}
          />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

function SwitchRow({
  label,
  value,
  onValueChange,
  disabled,
  subtitle,
  colors,
}: {
  label: string;
  value: boolean;
  onValueChange?: (v: boolean) => void;
  disabled?: boolean;
  subtitle?: string;
  colors: ReturnType<typeof useThemeColors>;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 12,
        borderBottomWidth: HAIRLINE,
        borderBottomColor: colors.border,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={{ fontSize: 16, color: colors.text }}>{label}</Text>
        {subtitle ? (
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{subtitle}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={disabled ? undefined : onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.separator, true: `${colors.primary}99` }}
        thumbColor="#fff"
      />
    </View>
  );
}
