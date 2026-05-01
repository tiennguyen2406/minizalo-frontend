import React, { useState } from "react";
import { View, Text, Modal, TouchableOpacity, ActivityIndicator, ScrollView, TextInput, KeyboardAvoidingView, Platform, Keyboard } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/shared/theme/colors";
import { chatService } from "@/shared/services/chatService";

interface AiPersonaBotModalProps {
    visible: boolean;
    onClose: () => void;
}

const PERSONAS = [
    { id: "the_thao", name: "Thể Thao", icon: "football", prompt: "Thể thao (Bóng đá, quần vợt, v.v.)", color: "#3b82f6" },
    { id: "am_thuc", name: "Ẩm Thực", icon: "restaurant", prompt: "Ẩm thực và gợi ý quán ăn", color: "#f59e0b" },
    { id: "lap_trinh", name: "Lập Trình", icon: "code-slash", prompt: "Lập trình và Công nghệ thông tin", color: "#10b981" },
    { id: "suc_khoe", name: "Sức Khỏe", icon: "fitness", prompt: "Sức khỏe và Thể hình", color: "#ef4444" },
    { id: "tai_chinh", name: "Tài Chính", icon: "cash", prompt: "Tài chính và Đầu tư", color: "#8b5cf6" },
];

export default function AiPersonaBotModal({ visible, onClose }: AiPersonaBotModalProps) {
    const colors = useThemeColors();
    const [selectedPersona, setSelectedPersona] = useState(PERSONAS[0]);
    const [question, setQuestion] = useState("");
    const [answer, setAnswer] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAsk = async () => {
        if (!question.trim()) return;
        Keyboard.dismiss();
        setLoading(true);
        setError(null);
        setAnswer("");
        
        try {
            const res = await chatService.askPersona(selectedPersona.prompt, question);
            setAnswer(res);
        } catch (err: any) {
            console.error("Persona Bot Error:", err);
            setError("Có lỗi xảy ra khi kết nối với AI. Vui lòng thử lại.");
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
            
            // Bullet points
            const isBullet = trimmedLine.startsWith('-') || trimmedLine.startsWith('•') || trimmedLine.startsWith('*');
            const content = isBullet ? trimmedLine.replace(/^[-•*]\s*/, '') : trimmedLine;

            // Simple bold parser
            const parts = content.split(/(\*\*.*?\*\*)/g);
            const renderedContent = parts.map((part, pIdx) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return (
                        <Text key={pIdx} style={{ fontWeight: 'bold', color: colors.text }}>
                            {part.slice(2, -2)}
                        </Text>
                    );
                }
                return <Text key={pIdx}>{part}</Text>;
            });

            if (isBullet) {
                return (
                    <View key={index} style={{ flexDirection: 'row', marginBottom: 6, paddingLeft: 8 }}>
                        <Text style={{ color: selectedPersona.color, marginRight: 8, fontSize: 18, marginTop: -2 }}>•</Text>
                        <Text style={{ color: colors.text, flex: 1, fontSize: 15, lineHeight: 22 }}>
                            {renderedContent}
                        </Text>
                    </View>
                );
            }
            
            return (
                <Text key={index} style={{ color: colors.text, lineHeight: 24, fontSize: 15, marginBottom: 8 }}>
                    {renderedContent}
                </Text>
            );
        });
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
                <KeyboardAvoidingView 
                    behavior={Platform.OS === "ios" ? "padding" : undefined}
                    style={{ width: '100%', maxHeight: '90%' }}
                >
                    <View style={{ 
                        backgroundColor: colors.background, 
                        borderTopLeftRadius: 24, 
                        borderTopRightRadius: 24, 
                        height: '100%',
                        paddingTop: 12,
                        paddingBottom: Platform.OS === 'ios' ? 34 : 20
                    }}>
                        <View style={{ width: 40, height: 5, backgroundColor: colors.border, borderRadius: 2.5, alignSelf: 'center', marginBottom: 15 }} />
                        
                        {/* Header */}
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 16 }}>
                            <View style={{ flexDirection: "row", alignItems: "center" }}>
                                <View style={{ backgroundColor: selectedPersona.color + '20', padding: 8, borderRadius: 12, marginRight: 12 }}>
                                    <Ionicons name={selectedPersona.icon as any} size={24} color={selectedPersona.color} />
                                </View>
                                <View>
                                    <Text style={{ fontSize: 18, fontWeight: "bold", color: colors.text }}>Bot Chuyên Gia</Text>
                                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>Hỏi đáp theo chủ đề chuyên biệt</Text>
                                </View>
                            </View>
                            <TouchableOpacity 
                                onPress={onClose}
                                style={{ backgroundColor: colors.border, padding: 8, borderRadius: 20 }}
                            >
                                <Ionicons name="close" size={20} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        {/* Persona Selector */}
                        <View style={{ marginBottom: 16 }}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
                                {PERSONAS.map(p => {
                                    const isSelected = selectedPersona.id === p.id;
                                    return (
                                        <TouchableOpacity
                                            key={p.id}
                                            onPress={() => {
                                                setSelectedPersona(p);
                                                setAnswer("");
                                                setError(null);
                                            }}
                                            style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                backgroundColor: isSelected ? p.color : colors.card,
                                                paddingHorizontal: 16,
                                                paddingVertical: 10,
                                                borderRadius: 20,
                                                marginRight: 10,
                                                borderWidth: 1,
                                                borderColor: isSelected ? p.color : colors.border,
                                            }}
                                        >
                                            <Ionicons name={p.icon as any} size={16} color={isSelected ? 'white' : colors.textSecondary} style={{ marginRight: 6 }} />
                                            <Text style={{ color: isSelected ? 'white' : colors.text, fontWeight: isSelected ? 'bold' : 'normal', fontSize: 14 }}>
                                                {p.name}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>

                        {/* Chat Area */}
                        <ScrollView style={{ flex: 1, paddingHorizontal: 20 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                            {/* Intro Message */}
                            <View style={{ marginBottom: 20, flexDirection: 'row' }}>
                                <View style={{ backgroundColor: selectedPersona.color, width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                                    <Ionicons name={selectedPersona.icon as any} size={20} color="white" />
                                </View>
                                <View style={{ flex: 1, backgroundColor: colors.card, padding: 12, borderRadius: 16, borderTopLeftRadius: 4, borderWidth: 1, borderColor: colors.border }}>
                                    <Text style={{ color: colors.text, lineHeight: 22 }}>
                                        Xin chào! Tôi là Bot chuyên gia về <Text style={{ fontWeight: 'bold', color: selectedPersona.color }}>{selectedPersona.name}</Text>. Hãy đặt câu hỏi cho tôi!
                                    </Text>
                                </View>
                            </View>

                            {/* User Question */}
                            {loading || answer || error ? (
                                <View style={{ marginBottom: 20, flexDirection: 'row', justifyContent: 'flex-end' }}>
                                    <View style={{ backgroundColor: '#0068FF', padding: 12, borderRadius: 16, borderTopRightRadius: 4, maxWidth: '85%' }}>
                                        <Text style={{ color: 'white', lineHeight: 22 }}>{question}</Text>
                                    </View>
                                </View>
                            ) : null}

                            {/* Bot Answer */}
                            {loading ? (
                                <View style={{ flexDirection: 'row', marginBottom: 20 }}>
                                    <View style={{ backgroundColor: selectedPersona.color, width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                                        <Ionicons name={selectedPersona.icon as any} size={20} color="white" />
                                    </View>
                                    <View style={{ backgroundColor: colors.card, padding: 16, borderRadius: 16, borderTopLeftRadius: 4, borderWidth: 1, borderColor: colors.border, justifyContent: 'center' }}>
                                        <ActivityIndicator color={selectedPersona.color} size="small" />
                                    </View>
                                </View>
                            ) : error ? (
                                <View style={{ flexDirection: 'row', marginBottom: 20 }}>
                                    <View style={{ backgroundColor: '#ef4444', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                                        <Ionicons name="alert" size={20} color="white" />
                                    </View>
                                    <View style={{ backgroundColor: '#fee2e2', padding: 12, borderRadius: 16, borderTopLeftRadius: 4, flex: 1 }}>
                                        <Text style={{ color: '#b91c1c' }}>{error}</Text>
                                    </View>
                                </View>
                            ) : answer ? (
                                <View style={{ flexDirection: 'row', marginBottom: 20 }}>
                                    <View style={{ backgroundColor: selectedPersona.color, width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                                        <Ionicons name={selectedPersona.icon as any} size={20} color="white" />
                                    </View>
                                    <View style={{ flex: 1, backgroundColor: colors.card, padding: 16, borderRadius: 16, borderTopLeftRadius: 4, borderWidth: 1, borderColor: colors.border }}>
                                        {renderFormattedText(answer)}
                                    </View>
                                </View>
                            ) : null}
                            <View style={{ height: 20 }} />
                        </ScrollView>

                        {/* Input Area */}
                        <View style={{ paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 24, paddingLeft: 16, paddingRight: 8, paddingVertical: 6, borderWidth: 1, borderColor: colors.border }}>
                                <TextInput
                                    value={question}
                                    onChangeText={setQuestion}
                                    placeholder={`Hỏi chuyên gia ${selectedPersona.name}...`}
                                    placeholderTextColor={colors.textSecondary}
                                    style={{ flex: 1, color: colors.text, fontSize: 15, paddingVertical: 8 }}
                                    multiline
                                    maxLength={300}
                                />
                                <TouchableOpacity 
                                    onPress={handleAsk}
                                    disabled={loading || !question.trim()}
                                    style={{ 
                                        backgroundColor: !question.trim() ? colors.border : selectedPersona.color, 
                                        width: 36, 
                                        height: 36, 
                                        borderRadius: 18, 
                                        justifyContent: 'center', 
                                        alignItems: 'center',
                                        marginLeft: 8
                                    }}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="white" size="small" />
                                    ) : (
                                        <Ionicons name="send" size={16} color={!question.trim() ? colors.textSecondary : "white"} style={{ marginLeft: 2 }} />
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}
