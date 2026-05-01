import React, { useState, useEffect } from "react";
import { View, Text, Modal, TouchableOpacity, ActivityIndicator, ScrollView, Platform, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useThemeColors } from "@/shared/theme/colors";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface UnreadAiSummaryModalProps {
    visible: boolean;
    onClose: () => void;
    onSummarize: () => Promise<string>;
    unreadCount: number;
}

export default function UnreadAiSummaryModal({ visible, onClose, onSummarize, unreadCount }: UnreadAiSummaryModalProps) {
    const colors = useThemeColors();
    const [loading, setLoading] = useState(false);
    const [summary, setSummary] = useState("");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (visible) {
            handleSummarize();
        } else {
            // Reset state when closing
            setSummary("");
            setError(null);
        }
    }, [visible]);

    const handleSummarize = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await onSummarize();
            setSummary(result);
        } catch (err: any) {
            console.error("Unread summary error:", err);
            setError("Không thể tóm tắt lúc này. Vui lòng thử lại sau.");
        } finally {
            setLoading(false);
        }
    };

    const renderFormattedText = (text: string) => {
        if (!text) return null;
        
        const lines = text.split('\n');
        return lines.map((line, index) => {
            const trimmedLine = line.trim();
            if (!trimmedLine) return <View key={index} style={{ height: 8 }} />;
            
            // Check if bullet point
            const isBullet = trimmedLine.startsWith('-') || trimmedLine.startsWith('•') || trimmedLine.startsWith('*');
            const content = isBullet ? trimmedLine.replace(/^[-•*]\s*/, '') : trimmedLine;

            // Simple parser for bold text (**bold**)
            const parts = content.split(/(\*\*.*?\*\*)/g);
            const renderedContent = parts.map((part, pIdx) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return (
                        <Text key={pIdx} style={{ fontWeight: '800', color: colors.primary }}>
                            {part.slice(2, -2)}
                        </Text>
                    );
                }
                return <Text key={pIdx}>{part}</Text>;
            });

            if (isBullet) {
                return (
                    <View key={index} style={{ flexDirection: 'row', marginBottom: 12, paddingLeft: 8 }}>
                        <Text style={{ color: colors.primary, marginRight: 8, fontSize: 16 }}>•</Text>
                        <Text style={{ color: colors.text, flex: 1, fontSize: 16, lineHeight: 24 }}>
                            {renderedContent}
                        </Text>
                    </View>
                );
            }
            
            return (
                <Text key={index} style={{ color: colors.text, lineHeight: 24, fontSize: 16, marginBottom: 12, fontWeight: '500' }}>
                    {renderedContent}
                </Text>
            );
        });
    };

    return (
        <Modal visible={visible} animationType="fade" transparent>
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center" }}>
                <BlurView intensity={30} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                
                <View style={{ 
                    backgroundColor: colors.background, 
                    borderRadius: 32, 
                    width: SCREEN_WIDTH * 0.88,
                    maxHeight: SCREEN_HEIGHT * 0.7,
                    padding: 24,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 10 },
                    shadowOpacity: 0.3,
                    shadowRadius: 20,
                    elevation: 15,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.2)'
                }}>
                    {/* Header */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                        <View style={{ 
                            backgroundColor: '#FFEBEE', 
                            padding: 10, 
                            borderRadius: 16,
                            marginRight: 12 
                        }}>
                            <Ionicons name="flash" size={24} color="#FF5252" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 18, fontWeight: "bold", color: colors.text }}>Điểm tin nhanh</Text>
                            <Text style={{ fontSize: 12, color: colors.textSecondary }}>{unreadCount} tin nhắn mới được tóm lược</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
                            <Ionicons name="close-circle" size={28} color={colors.border} />
                        </TouchableOpacity>
                    </View>

                    {/* Content */}
                    <ScrollView style={{ marginBottom: 20 }} showsVerticalScrollIndicator={false}>
                        {loading ? (
                            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                                <ActivityIndicator size="large" color={colors.primary} />
                                <Text style={{ marginTop: 16, color: colors.textSecondary, fontWeight: '500' }}>AI đang đọc tin...</Text>
                            </View>
                        ) : error ? (
                            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                                <Ionicons name="alert-circle" size={48} color="#FF5252" style={{ marginBottom: 12 }} />
                                <Text style={{ color: colors.text, textAlign: 'center', fontSize: 16 }}>{error}</Text>
                            </View>
                        ) : (
                            <View>
                                {renderFormattedText(summary)}
                            </View>
                        )}
                    </ScrollView>

                    {/* Footer */}
                    <TouchableOpacity 
                        onPress={onClose}
                        style={{ 
                            backgroundColor: colors.primary, 
                            paddingVertical: 14, 
                            borderRadius: 16, 
                            alignItems: 'center',
                            shadowColor: colors.primary,
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 8,
                            elevation: 4
                        }}
                    >
                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Đã hiểu</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}
