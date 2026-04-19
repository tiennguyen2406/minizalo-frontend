import React, { useState } from "react";
import { View, Text, Modal, TouchableOpacity, ActivityIndicator, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useThemeColors } from "@/shared/theme/colors";

interface AiSummaryModalProps {
    visible: boolean;
    onClose: () => void;
    onSummarize: (startTime: string, endTime: string) => Promise<string>;
}

export default function AiSummaryModal({ visible, onClose, onSummarize }: AiSummaryModalProps) {
    const colors = useThemeColors();
    const [startDate, setStartDate] = useState(new Date(Date.now() - 86400000)); // Hôm qua
    const [endDate, setEndDate] = useState(new Date()); // Hôm nay
    
    const [showPicker, setShowPicker] = useState<"start" | "end" | null>(null);
    const [loading, setLoading] = useState(false);
    const [summary, setSummary] = useState("");

    const handleSummarize = async () => {
        setLoading(true);
        setSummary("");
        try {
            const startIso = startDate.toISOString();
            const endIso = endDate.toISOString();
            const result = await onSummarize(startIso, endIso);
            setSummary(result);
        } catch (error) {
            setSummary("Có lỗi xảy ra khi tóm tắt. Vui lòng thử lại sau.");
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString("vi-VN");
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
                <View style={{ 
                    backgroundColor: colors.background, 
                    borderTopLeftRadius: 20, 
                    borderTopRightRadius: 20, 
                    height: "80%", 
                    padding: 20 
                }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                            <Ionicons name="sparkles" size={24} color="#FFD700" style={{ marginRight: 8 }} />
                            <Text style={{ fontSize: 18, fontWeight: "bold", color: colors.text }}>AI Tóm Tắt Chat</Text>
                        </View>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color={colors.text} />
                        </TouchableOpacity>
                    </View>

                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 15 }}>
                        <TouchableOpacity 
                            style={{ flex: 1, backgroundColor: colors.border, padding: 12, borderRadius: 8, marginRight: 8 }}
                            onPress={() => setShowPicker("start")}
                        >
                            <Text style={{ fontSize: 12, color: colors.textSecondary }}>Từ ngày</Text>
                            <Text style={{ color: colors.text, fontWeight: "500", marginTop: 4 }}>{formatDate(startDate)}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={{ flex: 1, backgroundColor: colors.border, padding: 12, borderRadius: 8, marginLeft: 8 }}
                            onPress={() => setShowPicker("end")}
                        >
                            <Text style={{ fontSize: 12, color: colors.textSecondary }}>Đến hết ngày</Text>
                            <Text style={{ color: colors.text, fontWeight: "500", marginTop: 4 }}>{formatDate(endDate)}</Text>
                        </TouchableOpacity>
                    </View>

                    {showPicker && (
                        <DateTimePicker
                            value={showPicker === "start" ? startDate : endDate}
                            mode="date"
                            display="default"
                            onChange={(event, selectedDate) => {
                                setShowPicker(null);
                                if (selectedDate) {
                                    if (showPicker === "start") {
                                        selectedDate.setHours(0, 0, 0, 0);
                                        setStartDate(selectedDate);
                                    } else {
                                        selectedDate.setHours(23, 59, 59, 999);
                                        setEndDate(selectedDate);
                                    }
                                }
                            }}
                        />
                    )}

                    <TouchableOpacity 
                        style={{ 
                            backgroundColor: "#0068FF", 
                            padding: 14, 
                            borderRadius: 10, 
                            alignItems: "center",
                            marginBottom: 20
                        }}
                        onPress={handleSummarize}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text style={{ color: "white", fontWeight: "bold", fontSize: 16 }}>Bắt đầu tóm tắt</Text>
                        )}
                    </TouchableOpacity>

                    <ScrollView style={{ flex: 1, backgroundColor: colors.card, borderRadius: 12, padding: 16 }}>
                        {summary ? (
                            <Text style={{ color: colors.text, lineHeight: 24, fontSize: 15 }}>{summary}</Text>
                        ) : (
                            <View style={{ alignItems: "center", justifyContent: "center", marginTop: 40 }}>
                                <Ionicons name="chatbubbles-outline" size={48} color={colors.textSecondary} style={{ opacity: 0.5 }} />
                                <Text style={{ color: colors.textSecondary, textAlign: "center", marginTop: 12, lineHeight: 22 }}>
                                    Chọn khoảng thời gian và bấm nút để AI lọc các tin nhắn nhé.
                                </Text>
                            </View>
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}
