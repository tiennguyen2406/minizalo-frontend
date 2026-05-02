import React, { useState } from "react";
import { View, Text, Modal, TouchableOpacity, ActivityIndicator, ScrollView, Clipboard, ToastAndroid, Platform, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useThemeColors } from "@/shared/theme/colors";
import { chatService, ChatSummary } from "@/shared/services/chatService";

interface AiSummaryModalProps {
    visible: boolean;
    onClose: () => void;
    onSummarize: (startTime: string, endTime: string) => Promise<string>;
    roomId: string;
    initialStartDate?: Date;
    initialEndDate?: Date;
    autoSummarize?: boolean;
    isUnreadMode?: boolean;
}

export default function AiSummaryModal({ visible, onClose, onSummarize, roomId, initialStartDate, initialEndDate, autoSummarize, isUnreadMode }: AiSummaryModalProps) {
    const colors = useThemeColors();
    const [startDate, setStartDate] = useState(new Date(Date.now() - 86400000)); // Hôm qua
    const [endDate, setEndDate] = useState(new Date()); // Hôm nay

    const [loading, setLoading] = useState(false);
    const [summary, setSummary] = useState("");

    React.useEffect(() => {
        if (visible) {
            if (initialStartDate) setStartDate(initialStartDate);
            if (initialEndDate) setEndDate(initialEndDate);
            
            // Nếu có cờ tự động, chờ một chút để date state cập nhật rồi chạy
            if (autoSummarize && !summary && !loading) {
                setTimeout(() => {
                    handleSummarize();
                }, 300);
            }
        }
    }, [visible, initialStartDate, initialEndDate, autoSummarize]);
    
    const [showPicker, setShowPicker] = useState<"start" | "end" | null>(null);
    const [view, setView] = useState<"summary" | "history">("summary");
    const [history, setHistory] = useState<ChatSummary[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
            const data = await chatService.getSummaryHistory(roomId);
            // Sắp xếp mới nhất lên đầu
            setHistory(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        } catch (error) {
            console.error("Fetch history error:", error);
        } finally {
            setLoadingHistory(false);
        }
    };

    const toggleHistory = () => {
        if (view === "summary") {
            setView("history");
            fetchHistory();
        } else {
            setView("summary");
        }
    };

    const handleSummarize = async () => {
        setLoading(true);
        setSummary("");
        try {
            const startIso = startDate.toISOString();
            const endIso = endDate.toISOString();
            const result = await onSummarize(startIso, endIso);
            setSummary(result);
        } catch (error: any) {
            console.error('Summary error:', error);
            const msg = error?.message || "";
            if (msg.includes("503") || msg.includes("UNAVAILABLE")) {
                setSummary("Hệ thống AI đang bận (503). Bạn vui lòng đợi khoảng 30 giây rồi thử lại nhé.");
            } else if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
                setSummary("Bạn đã hết hạn mức sử dụng AI cho model này (429). Vui lòng thử lại vào ngày mai hoặc kiểm tra lại gói dịch vụ.");
            } else {
                setSummary("Có lỗi xảy ra khi tóm tắt. Vui lòng thử lại sau.");
            }
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        if (!summary) return;
        Clipboard.setString(summary);
        if (Platform.OS === 'android') {
            ToastAndroid.show("Đã sao chép nội dung tóm tắt", ToastAndroid.SHORT);
        } else {
            Alert.alert("Thông báo", "Đã sao chép nội dung tóm tắt");
        }
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString("vi-VN");
    };

    const formatDateTime = (dateStr: string) => {
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString("vi-VN") + " " + d.toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' });
        } catch {
            return dateStr;
        }
    }

    const renderFormattedText = (text: string) => {
        if (!text) return null;
        
        const lines = text.split('\n');
        return lines.map((line, index) => {
            const trimmedLine = line.trim();
            if (!trimmedLine) return <View key={index} style={{ height: 12 }} />;
            
            // Render Heading (starts with [0-9]. or emoji)
            const isMainHeading = trimmedLine.match(/^[0-9]\./) || trimmedLine.match(/^[📌💬✅🚀💡]/);
            
            // Check if bullet point
            const isBullet = trimmedLine.startsWith('-') || trimmedLine.startsWith('•') || trimmedLine.startsWith('*');
            
            const content = isBullet ? trimmedLine.substring(1).trim() : trimmedLine;

            // Simple parser for bold text within a line
            const parts = content.split(/(\*\*.*?\*\*)/g);
            const renderedContent = parts.map((part, pIdx) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return (
                        <Text key={pIdx} style={{ fontWeight: 'bold', color: isMainHeading ? "#0068FF" : colors.text }}>
                            {part.slice(2, -2)}
                        </Text>
                    );
                }
                return <Text key={pIdx}>{part}</Text>;
            });

            if (isMainHeading) {
                return (
                    <View key={index} style={{ marginTop: 16, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: "#0068FF", paddingLeft: 12 }}>
                        <Text 
                            style={{ 
                                color: "#0068FF", 
                                fontWeight: "bold", 
                                fontSize: 18,
                                lineHeight: 26
                            }}
                        >
                            {renderedContent}
                        </Text>
                    </View>
                );
            }
            
            if (isBullet) {
                return (
                    <View key={index} style={{ flexDirection: 'row', paddingLeft: 12, marginBottom: 8, alignItems: 'flex-start' }}>
                        <Text style={{ color: "#0068FF", marginRight: 10, fontSize: 18, marginTop: -2 }}>•</Text>
                        <Text style={{ color: colors.text, flex: 1, fontSize: 15, lineHeight: 24 }}>
                            {renderedContent}
                        </Text>
                    </View>
                );
            }
            
            return (
                <Text key={index} style={{ color: colors.text, lineHeight: 24, fontSize: 15, marginBottom: 8, paddingLeft: 4 }}>
                    {renderedContent}
                </Text>
            );
        });
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
                <View style={{ 
                    backgroundColor: colors.background, 
                    borderTopLeftRadius: 24, 
                    borderTopRightRadius: 24, 
                    height: "85%", 
                    paddingTop: 12,
                    paddingHorizontal: 20,
                    paddingBottom: 20
                }}>
                    <View style={{ width: 40, height: 5, backgroundColor: colors.border, borderRadius: 2.5, alignSelf: 'center', marginBottom: 15 }} />
                    
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                            <View style={{ backgroundColor: '#FFF9E6', padding: 8, borderRadius: 10, marginRight: 12 }}>
                                <Ionicons name="sparkles" size={24} color="#FFD700" />
                            </View>
                            <View>
                                <Text style={{ fontSize: 20, fontWeight: "bold", color: colors.text }}>
                                    {isUnreadMode ? "Tóm tắt tin nhắn mới" : "AI Tóm Tắt Chat"}
                                </Text>
                                <Text style={{ fontSize: 12, color: colors.textSecondary }}>Hỗ trợ bởi Google Gemini</Text>
                            </View>
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                            <TouchableOpacity 
                                onPress={toggleHistory}
                                style={{ 
                                    backgroundColor: view === "history" ? "#0068FF" : colors.border, 
                                    padding: 8, 
                                    borderRadius: 12, 
                                    marginRight: 8 
                                }}
                            >
                                <Ionicons 
                                    name={view === "history" ? "book" : "time-outline"} 
                                    size={20} 
                                    color={view === "history" ? "white" : colors.textSecondary} 
                                />
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={onClose}
                                style={{ backgroundColor: colors.border, padding: 8, borderRadius: 20 }}
                            >
                                <Ionicons name="close" size={20} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {!isUnreadMode && (
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 20 }}>
                            <TouchableOpacity 
                                style={{ flex: 1, backgroundColor: colors.card, padding: 14, borderRadius: 12, marginRight: 8, borderWidth: 1, borderColor: colors.border }}
                                onPress={() => setShowPicker("start")}
                            >
                                <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 4, textTransform: 'uppercase' }}>Từ ngày</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons name="calendar-outline" size={16} color="#0068FF" style={{ marginRight: 6 }} />
                                    <Text style={{ color: colors.text, fontWeight: "600", fontSize: 15 }}>{formatDate(startDate)}</Text>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={{ flex: 1, backgroundColor: colors.card, padding: 14, borderRadius: 12, marginLeft: 8, borderWidth: 1, borderColor: colors.border }}
                                onPress={() => setShowPicker("end")}
                            >
                                <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 4, textTransform: 'uppercase' }}>Đến hết</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons name="calendar" size={16} color="#0068FF" style={{ marginRight: 6 }} />
                                    <Text style={{ color: colors.text, fontWeight: "600", fontSize: 15 }}>{formatDate(endDate)}</Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    {showPicker && (
                        <DateTimePicker
                            value={showPicker === "start" ? startDate : endDate}
                            mode="date"
                            display="default"
                            maximumDate={new Date()}
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

                    {!summary && view === "summary" && (
                        <TouchableOpacity 
                            style={{ 
                                backgroundColor: "#0068FF", 
                                paddingVertical: 16, 
                                borderRadius: 12, 
                                alignItems: "center",
                                marginBottom: 20,
                                shadowColor: "#0068FF",
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.3,
                                shadowRadius: 8,
                                elevation: 5
                            }}
                            onPress={handleSummarize}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons name="flash" size={18} color="white" style={{ marginRight: 8 }} />
                                    <Text style={{ color: "white", fontWeight: "bold", fontSize: 16 }}>Bắt đầu tóm tắt ngay</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    )}

                    <View style={{ flex: 1, position: 'relative' }}>
                        {view === "summary" ? (
                            <>
                                <ScrollView 
                                    style={{ 
                                        flex: 1, 
                                        backgroundColor: colors.card, 
                                        borderRadius: 16, 
                                        padding: 16,
                                        borderWidth: 1,
                                        borderColor: colors.border
                                    }}
                                    showsVerticalScrollIndicator={false}
                                >
                                    {summary ? (
                                        <View style={{ paddingBottom: 20 }}>
                                            {renderFormattedText(summary)}
                                        </View>
                                    ) : (
                                        <View style={{ alignItems: "center", justifyContent: "center", marginTop: 60 }}>
                                            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                                                <Ionicons name="chatbubbles-outline" size={40} color={colors.textSecondary} style={{ opacity: 0.5 }} />
                                            </View>
                                            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16, marginBottom: 8 }}>Chưa có bản tóm tắt</Text>
                                            <Text style={{ color: colors.textSecondary, textAlign: "center", lineHeight: 22, paddingHorizontal: 20 }}>
                                                Hãy chọn khoảng thời gian mà bạn muốn AI tổng hợp thông tin, sau đó bấm nút để xem kết quả nhé!
                                            </Text>
                                        </View>
                                    )}
                                </ScrollView>

                                {summary && !loading && (
                                    <View style={{ 
                                        flexDirection: 'row', 
                                        position: 'absolute', 
                                        bottom: 12, 
                                        right: 12, 
                                        gap: 8 
                                    }}>
                                        <TouchableOpacity 
                                            onPress={copyToClipboard}
                                            style={{ 
                                                backgroundColor: '#0068FF', 
                                                width: 44, 
                                                height: 44, 
                                                borderRadius: 22, 
                                                justifyContent: 'center', 
                                                alignItems: 'center',
                                                elevation: 4,
                                                shadowColor: '#000',
                                                shadowOffset: { width: 0, height: 2 },
                                                shadowOpacity: 0.25,
                                                shadowRadius: 3.84,
                                            }}
                                        >
                                            <Ionicons name="copy-outline" size={20} color="white" />
                                        </TouchableOpacity>
                                        <TouchableOpacity 
                                            onPress={() => { setSummary(""); }}
                                            style={{ 
                                                backgroundColor: 'white', 
                                                width: 44, 
                                                height: 44, 
                                                borderRadius: 22, 
                                                justifyContent: 'center', 
                                                alignItems: 'center',
                                                borderWidth: 1,
                                                borderColor: '#eee',
                                                elevation: 2,
                                            }}
                                        >
                                            <Ionicons name="refresh-outline" size={20} color="#666" />
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </>
                        ) : (
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 12 }}>Lịch sử tóm tắt (5 ngày gần đây)</Text>
                                {loadingHistory ? (
                                    <ActivityIndicator color="#0068FF" style={{ marginTop: 40 }} />
                                ) : history.length > 0 ? (
                                    <ScrollView showsVerticalScrollIndicator={false}>
                                        {history.map((item) => (
                                            <TouchableOpacity 
                                                key={item.summaryId}
                                                style={{ 
                                                    backgroundColor: colors.card, 
                                                    padding: 16, 
                                                    borderRadius: 12, 
                                                    marginBottom: 12,
                                                    borderWidth: 1,
                                                    borderColor: colors.border
                                                }}
                                                onPress={() => {
                                                    setSummary(item.content);
                                                    setView("summary");
                                                }}
                                            >
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                        <Ionicons name="calendar-outline" size={14} color="#0068FF" style={{ marginRight: 4 }} />
                                                        <Text style={{ fontSize: 13, color: "#0068FF", fontWeight: '600' }}>
                                                            {formatDateTime(item.createdAt)}
                                                        </Text>
                                                    </View>
                                                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>Hết hạn sau 5 ngày</Text>
                                                </View>
                                                <Text style={{ color: colors.text, fontSize: 14 }} numberOfLines={3}>
                                                    {item.content.replace(/\*\*/g, "").replace(/\n/g, " ")}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                ) : (
                                    <View style={{ alignItems: "center", justifyContent: "center", marginTop: 60 }}>
                                        <Ionicons name="time-outline" size={48} color={colors.textSecondary} style={{ opacity: 0.3, marginBottom: 16 }} />
                                        <Text style={{ color: colors.textSecondary }}>Chưa có lịch sử tóm tắt nào.</Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
}
