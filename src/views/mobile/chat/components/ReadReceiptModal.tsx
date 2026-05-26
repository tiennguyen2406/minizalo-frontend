import React from 'react';
import { View, Text, Modal, TouchableOpacity, Image, ScrollView, Platform, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/shared/theme/colors';
import { useThemeStore } from '@/shared/store/themeStore';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ReadReceiptModalProps {
    visible: boolean;
    onClose: () => void;
    readByIds: string[];
    participants: any[];
    currentUserId: string;
}

export default function ReadReceiptModal({
    visible,
    onClose,
    readByIds,
    participants,
    currentUserId
}: ReadReceiptModalProps) {
    const colors = useThemeColors();
    const theme = useThemeStore(s => s.theme);

    if (!visible) return null;

    const readers = participants.filter(
        p => p.id !== currentUserId && readByIds.includes(p.id)
    );

    const unreadUsers = participants.filter(
        p => p.id !== currentUserId && !readByIds.includes(p.id)
    );

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <TouchableOpacity 
                style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
                activeOpacity={1}
                onPress={onClose}
            >
                <View 
                    style={{
                        backgroundColor: colors.background,
                        borderTopLeftRadius: 20,
                        borderTopRightRadius: 20,
                        maxHeight: SCREEN_HEIGHT * 0.7,
                        paddingBottom: Platform.OS === 'ios' ? 40 : 20,
                    }}
                    onStartShouldSetResponder={() => true}
                    onTouchEnd={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border
                    }}>
                        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
                            Chi tiết tin nhắn
                        </Text>
                        <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
                            <Ionicons name="close" size={24} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={{ paddingHorizontal: 16, marginTop: 10 }}>
                        {/* Mục: Đã xem */}
                        <View style={{ marginBottom: 20 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                                <Ionicons name="checkmark-done" size={20} color={colors.primary} />
                                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.primary, marginLeft: 6 }}>
                                    Đã xem ({readers.length})
                                </Text>
                            </View>
                            {readers.length === 0 ? (
                                <Text style={{ color: colors.textSecondary, fontStyle: 'italic', marginLeft: 26 }}>
                                    Chưa ai xem tin nhắn này
                                </Text>
                            ) : (
                                readers.map(user => (
                                    <View key={user.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, marginLeft: 26 }}>
                                        <Image 
                                            source={{ uri: user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || user.username)}&size=40&background=random` }}
                                            style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12 }}
                                        />
                                        <Text style={{ fontSize: 16, color: colors.text, fontWeight: '500' }}>
                                            {user.fullName || user.username}
                                        </Text>
                                    </View>
                                ))
                            )}
                        </View>

                        {/* Mục: Chưa xem */}
                        {unreadUsers.length > 0 && (
                            <View style={{ marginBottom: 20 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                                    <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
                                    <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textSecondary, marginLeft: 6 }}>
                                        Chưa xem ({unreadUsers.length})
                                    </Text>
                                </View>
                                {unreadUsers.map(user => (
                                    <View key={user.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, marginLeft: 26, opacity: 0.5 }}>
                                        <Image 
                                            source={{ uri: user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || user.username)}&size=32&background=random` }}
                                            style={{ width: 32, height: 32, borderRadius: 16, marginRight: 12 }}
                                        />
                                        <Text style={{ fontSize: 15, color: colors.text, fontWeight: '400' }}>
                                            {user.fullName || user.username}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </ScrollView>
                </View>
            </TouchableOpacity>
        </Modal>
    );
}
