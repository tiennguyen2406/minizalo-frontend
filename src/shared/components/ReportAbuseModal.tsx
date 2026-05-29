import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/shared/theme/colors";
import {
  REPORT_REASON_OPTIONS,
  reportService,
  type ReportTargetType,
} from "@/shared/services/reportService";

export interface ReportAbuseModalProps {
  visible: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  subjectLabel?: string;
  contextDetails?: string;
  onSuccess?: () => void;
}

export default function ReportAbuseModal({
  visible,
  onClose,
  targetType,
  targetId,
  subjectLabel,
  contextDetails,
  onSuccess,
}: ReportAbuseModalProps) {
  const colors = useThemeColors();
  const [selectedReason, setSelectedReason] = useState<string>(REPORT_REASON_OPTIONS[0].value);
  const [otherDetails, setOtherDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setSelectedReason(REPORT_REASON_OPTIONS[0].value);
    setOtherDetails("");
    setError(null);
    setSubmitting(false);
  }, [visible, targetId]);

  const handleSubmit = async () => {
    if (!targetId?.trim()) {
      setError("Không xác định được đối tượng báo cáo.");
      return;
    }
    if (selectedReason === "Khác" && !otherDetails.trim()) {
      setError("Vui lòng mô tả thêm lý do báo cáo.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const detailsParts = [
        contextDetails?.trim(),
        selectedReason === "Khác" ? otherDetails.trim() : undefined,
      ].filter(Boolean);

      await reportService.submitReport({
        targetType,
        targetId: targetId.trim(),
        reason: selectedReason,
        details: detailsParts.length > 0 ? detailsParts.join("\n") : undefined,
      });
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không thể gửi báo cáo. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  const targetLabel = targetType === "GROUP" ? "nhóm" : "người dùng";

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {}}
          style={[styles.card, { backgroundColor: colors.card || colors.modalBg || "#fff" }]}
        >
          <View style={[styles.header, { borderBottomColor: colors.separator }]}>
            <Text style={[styles.title, { color: colors.text }]}>Báo xấu</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel="Đóng">
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={[styles.desc, { color: colors.textSecondary }]}>
              Báo cáo {targetLabel}
              {subjectLabel ? ` «${subjectLabel}»` : ""} sẽ được gửi tới bộ phận kiểm duyệt để xử lý.
            </Text>

            <Text style={[styles.sectionLabel, { color: colors.text }]}>Lý do báo cáo</Text>
            {REPORT_REASON_OPTIONS.map((opt) => {
              const active = selectedReason === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  activeOpacity={0.7}
                  onPress={() => setSelectedReason(opt.value)}
                  style={[
                    styles.reasonRow,
                    {
                      borderColor: active ? colors.primary : colors.separator,
                      backgroundColor: active ? `${colors.primary}12` : "transparent",
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.radio,
                      { borderColor: active ? colors.primary : colors.textSecondary },
                    ]}
                  >
                    {active ? (
                      <View style={[styles.radioDot, { backgroundColor: colors.primary }]} />
                    ) : null}
                  </View>
                  <Text style={[styles.reasonText, { color: colors.text }]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}

            {selectedReason === "Khác" ? (
              <TextInput
                value={otherDetails}
                onChangeText={setOtherDetails}
                placeholder="Mô tả chi tiết..."
                placeholderTextColor={colors.textSecondary}
                multiline
                maxLength={500}
                style={[
                  styles.textArea,
                  {
                    color: colors.text,
                    borderColor: colors.separator,
                    backgroundColor: colors.searchBg || colors.background,
                  },
                ]}
              />
            ) : null}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: colors.separator }]}>
            <TouchableOpacity
              onPress={onClose}
              disabled={submitting}
              style={[styles.btn, styles.btnSecondary, { backgroundColor: colors.searchBg || "#f1f5f9" }]}
            >
              <Text style={[styles.btnTextSecondary, { color: colors.text }]}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => void handleSubmit()}
              disabled={submitting}
              style={[styles.btn, styles.btnPrimary, { backgroundColor: colors.primary }]}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.btnTextPrimary}>Gửi báo cáo</Text>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    maxHeight: "88%",
    borderRadius: 16,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 17, fontWeight: "700" },
  body: { paddingHorizontal: 16, paddingVertical: 12, maxHeight: 420 },
  desc: { fontSize: 14, lineHeight: 20, marginBottom: 14 },
  sectionLabel: { fontSize: 14, fontWeight: "600", marginBottom: 8 },
  reasonRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 8,
    gap: 10,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: { width: 8, height: 8, borderRadius: 4 },
  reasonText: { fontSize: 14, flex: 1 },
  textArea: {
    minHeight: 88,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    textAlignVertical: "top",
    marginTop: 4,
    marginBottom: 8,
  },
  errorText: { color: "#ef4444", fontSize: 13, marginTop: 4, marginBottom: 8 },
  footer: {
    flexDirection: "row",
    gap: 10,
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  btnSecondary: {},
  btnPrimary: {},
  btnTextSecondary: { fontSize: 15, fontWeight: "600" },
  btnTextPrimary: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
