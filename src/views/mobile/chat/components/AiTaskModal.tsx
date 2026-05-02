import React, { useState, useEffect } from "react";
import { View, Text, Modal, TouchableOpacity, ActivityIndicator, ScrollView, TextInput, KeyboardAvoidingView, Platform, Keyboard } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/shared/theme/colors";
import { chatService } from "@/shared/services/chatService";
import * as Clipboard from "expo-clipboard";

export type AiTaskMode = "translate" | "improve" | "extract";

interface AiTaskModalProps {
    visible: boolean;
    mode: AiTaskMode;
    roomId: string;
    onClose: () => void;
}

export default function AiTaskModal({ visible, mode, roomId, onClose }: AiTaskModalProps) {
    const colors = useThemeColors();
    const [inputText, setInputText] = useState("");
    const [result, setResult] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    // Metadata for modes
    const getModeData = () => {
        switch (mode) {
            case "translate": return { title: "Dịch Thuật Tự Động", icon: "language", color: "#10b981", desc: "Nhập văn bản cần dịch sang Tiếng Việt", btnText: "Dịch Ngay" };
            case "improve": return { title: "Cải Thiện Văn Phong", icon: "create", color: "#f59e0b", desc: "Nhập văn bản cần sửa lỗi và làm cho chuyên nghiệp hơn", btnText: "Cải Thiện" };
            case "extract": return { title: "Trích Xuất Lịch Hẹn", icon: "calendar", color: "#ef4444", desc: "AI đang quét lịch sử trò chuyện để tìm lịch hẹn...", btnText: "Quét Lại" };
            default: return { title: "AI Task", icon: "hardware-chip", color: "#3b82f6", desc: "", btnText: "Thực Hiện" };
        }
    };

    const data = getModeData();

    // Auto-run for extract mode
    useEffect(() => {
        if (visible && mode === "extract") {
            handleTask();
        } else if (!visible) {
            // Reset when closing
            setInputText("");
            setResult("");
            setError(null);
            setCopied(false);
        }
    }, [visible, mode]);

    const handleTask = async () => {
        if (mode !== "extract" && !inputText.trim()) return;
        
        Keyboard.dismiss();
        setLoading(true);
        setError(null);
        setResult("");
        setCopied(false);
        
        try {
            let res = "";
            if (mode === "translate") {
                res = await chatService.translateText(inputText);
            } else if (mode === "improve") {
                res = await chatService.improveText(inputText);
            } else if (mode === "extract") {
                // Lấy thời gian 7 ngày gần nhất để trích xuất
                const endTime = new Date().toISOString();
                const startTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
                res = await chatService.extractEvents(roomId, startTime, endTime);
            }
            setResult(res);
        } catch (err: any) {
            console.error("AI Task Error:", err);
            setError("Có lỗi xảy ra khi kết nối với AI. Vui lòng thử lại.");
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = async () => {
        if (result) {
            await Clipboard.setStringAsync(result);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const renderFormattedText = (text: string) => {
        if (!text) return null;
        
        const lines = text.split('\n');
        return lines.map((line, index) => {
            const trimmedLine = line.trim();
            if (!trimmedLine) return <View key={index} style={{ height: 8 }} />;
            
            const isBullet = trimmedLine.startsWith('-') || trimmedLine.startsWith('•') || trimmedLine.startsWith('*');
            const content = isBullet ? trimmedLine.replace(/^[-•*]\s*/, '') : trimmedLine;

            const parts = content.split(/(\*\*.*?\*\*)/g);
            const renderedContent = parts.map((part, pIdx) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <Text key={pIdx} style={{ fontWeight: 'bold', color: colors.text }}>{part.slice(2, -2)}</Text>;
                }
                return <Text key={pIdx}>{part}</Text>;
            });

            if (isBullet) {
                return (
                    <View key={index} style={{ flexDirection: 'row', marginBottom: 6, paddingLeft: 8 }}>
                        <Text style={{ color: data.color, marginRight: 8, fontSize: 18, marginTop: -2 }}>•</Text>
                        <Text style={{ color: colors.text, flex: 1, fontSize: 15, lineHeight: 22 }}>{renderedContent}</Text>
                    </View>
                );
            }
            
            return <Text key={index} style={{ color: colors.text, lineHeight: 24, fontSize: 15, marginBottom: 8 }}>{renderedContent}</Text>;
        });
    };

    return (
        <Modal visible={visible} animationType="fade" transparent>
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center" }}>
                <KeyboardAvoidingView 
                    behavior={Platform.OS === "ios" ? "padding" : undefined}
                    style={{ width: '90%', maxHeight: '80%' }}
                >
                    <View style={{ 
                        backgroundColor: colors.background, 
                        borderRadius: 24, 
                        padding: 20,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 10 },
                        shadowOpacity: 0.3,
                        shadowRadius: 20,
                        elevation: 10,
                    }}>
                        {/* Header */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                            <View style={{ backgroundColor: data.color + '20', padding: 10, borderRadius: 12, marginRight: 12 }}>
                                <Ionicons name={data.icon as any} size={24} color={data.color} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 18, fontWeight: "bold", color: colors.text }}>{data.title}</Text>
                                <Text style={{ fontSize: 12, color: colors.textSecondary }}>{data.desc}</Text>
                            </View>
                            <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
                                <Ionicons name="close-circle" size={26} color={colors.border} />
                            </TouchableOpacity>
                        </View>

                        {/* Input Area (Only for translate and improve) */}
                        {mode !== "extract" && !result && !loading && !error && (
                            <View style={{ marginBottom: 16 }}>
                                <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: colors.border }}>
                                    <TextInput
                                        value={inputText}
                                        onChangeText={setInputText}
                                        placeholder="Nhập hoặc dán đoạn văn bản vào đây..."
                                        placeholderTextColor={colors.textSecondary}
                                        style={{ color: colors.text, fontSize: 15, minHeight: 100, textAlignVertical: 'top' }}
                                        multiline
                                    />
                                </View>
                                <TouchableOpacity 
                                    onPress={handleTask}
                                    disabled={!inputText.trim()}
                                    style={{ 
                                        backgroundColor: inputText.trim() ? data.color : colors.border, 
                                        paddingVertical: 14, 
                                        borderRadius: 16, 
                                        alignItems: 'center',
                                        marginTop: 16
                                    }}
                                >
                                    <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>{data.btnText}</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Result Area */}
                        {(loading || result || error || mode === "extract") && (
                            <View>
                                {loading ? (
                                    <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                                        <ActivityIndicator size="large" color={data.color} />
                                        <Text style={{ marginTop: 16, color: colors.textSecondary, fontWeight: '500' }}>AI đang xử lý...</Text>
                                    </View>
                                ) : error ? (
                                    <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                                        <Ionicons name="alert-circle" size={48} color="#FF5252" style={{ marginBottom: 12 }} />
                                        <Text style={{ color: colors.text, textAlign: 'center', fontSize: 16 }}>{error}</Text>
                                    </View>
                                ) : result ? (
                                    <View>
                                        <ScrollView style={{ maxHeight: 300, backgroundColor: colors.card, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border }}>
                                            {renderFormattedText(result)}
                                        </ScrollView>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
                                            {(mode === "translate" || mode === "improve") && (
                                                <TouchableOpacity 
                                                    onPress={() => { setResult(""); }}
                                                    style={{ flex: 1, backgroundColor: colors.card, paddingVertical: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border, marginRight: 8 }}
                                                >
                                                    <Text style={{ color: colors.text, fontWeight: '600' }}>Thử Lại</Text>
                                                </TouchableOpacity>
                                            )}
                                            <TouchableOpacity 
                                                onPress={handleCopy}
                                                style={{ flex: 2, backgroundColor: copied ? "#10b981" : data.color, flexDirection: 'row', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}
                                            >
                                                <Ionicons name={copied ? "checkmark" : "copy"} size={18} color="white" style={{ marginRight: 8 }} />
                                                <Text style={{ color: 'white', fontWeight: 'bold' }}>{copied ? "Đã Sao Chép" : "Sao Chép"}</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ) : null}
                            </View>
                        )}
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}
