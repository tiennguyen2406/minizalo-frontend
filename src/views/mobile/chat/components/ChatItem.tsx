import React from "react";
import { View, Text, Image, TouchableOpacity, TextStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/shared/theme/colors";

function MessageLineWithHighlight({
    message,
    highlightQuery,
    baseStyle,
}: {
    message: string;
    highlightQuery?: string;
    baseStyle: TextStyle;
}) {
    const q = highlightQuery?.trim();
    if (!q) {
        return (
            <Text style={baseStyle} numberOfLines={1} ellipsizeMode="tail">
                {message}
            </Text>
        );
    }
    const lower = message.toLowerCase();
    const ql = q.toLowerCase();
    const parts: React.ReactNode[] = [];
    let start = 0;
    let idx = lower.indexOf(ql, start);
    let key = 0;
    while (idx !== -1) {
        if (idx > start) {
            parts.push(message.slice(start, idx));
        }
        parts.push(
            <Text key={`h-${key++}`} style={{ backgroundColor: "#fef08a" }}>
                {message.slice(idx, idx + ql.length)}
            </Text>,
        );
        start = idx + ql.length;
        idx = lower.indexOf(ql, start);
    }
    if (start < message.length) {
        parts.push(message.slice(start));
    }
    return (
        <Text style={baseStyle} numberOfLines={1} ellipsizeMode="tail">
            {parts}
        </Text>
    );
}

interface ChatItemProps {
    avatar?: any;
    avatarComponent?: React.ReactNode; 
    name: string;
    message: string;
    time: string;
    unreadCount?: number;
    isVerified?: boolean;
    isGroup?: boolean;
    isPinned?: boolean;
    isMuted?: boolean;
    /** Tô vàng các đoạn khớp khi tìm kiếm tin nhắn */
    highlightQuery?: string;
    onPress?: () => void;
    onLongPress?: () => void;
}

export const ChatItem = ({ avatar, avatarComponent, name, message, time, unreadCount, isVerified, onPress, onLongPress, isPinned, isMuted, highlightQuery }: ChatItemProps) => {
    const colors = useThemeColors();
    const hasUnread = !!(unreadCount && unreadCount > 0);
    const badgeBg = isMuted ? '#9ca3af' : '#ef4444';

    return (
        <TouchableOpacity
            onPress={onPress}
            onLongPress={onLongPress}
            delayLongPress={250}
            activeOpacity={0.7}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.background,
                paddingHorizontal: 16,
                paddingVertical: 10,
            }}
        >
            {/* Avatar Container */}
            <View style={{ position: 'relative', marginRight: 12 }}>
                {avatarComponent ? (
                    avatarComponent
                ) : (
                    <Image
                        source={avatar}
                        style={{
                            width: 52,
                            height: 52,
                            borderRadius: 26,
                            backgroundColor: colors.avatarBg,
                        }}
                        resizeMode="cover"
                    />
                )}
                {isVerified && (
                    <View style={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        backgroundColor: colors.background,
                        borderRadius: 999,
                        padding: 1.5,
                    }}>
                        <View style={{
                            width: 12,
                            height: 12,
                            backgroundColor: colors.background,
                            borderRadius: 999,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 1,
                            borderColor: '#555',
                        }}>
                            <Text style={{ fontSize: 7, fontWeight: 'bold', color: '#f1c40f' }}>v</Text>
                        </View>
                    </View>
                )}
                {hasUnread && (
                    <View style={{
                        position: 'absolute',
                        top: -2,
                        right: -2,
                        width: 14,
                        height: 14,
                        borderRadius: 7,
                        backgroundColor: badgeBg,
                        borderWidth: 2,
                        borderColor: colors.background,
                    }} />
                )}
            </View>

            {/* Content Container */}
            <View style={{
                flex: 1,
                borderBottomWidth: 0.5,
                borderBottomColor: colors.border,
                paddingBottom: 10,
                justifyContent: 'center',
                height: 60,
            }}>
                {/* Top Row: Name + indicators + Time */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                        <Text style={{ fontSize: 16, color: colors.text, fontWeight: hasUnread ? '700' : '400', flexShrink: 1 }} numberOfLines={1}>{name}</Text>
                        {isVerified && (
                            <View style={{
                                marginLeft: 4,
                                backgroundColor: '#f1c40f',
                                borderRadius: 999,
                                width: 12,
                                height: 12,
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}>
                                <Text style={{ fontSize: 8, color: 'white' }}>✓</Text>
                            </View>
                        )}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        {isPinned && (
                            <Ionicons name="pin" size={12} color="#60a5fa" />
                        )}
                        {isMuted && (
                            <Ionicons name="volume-mute" size={13} color="#9ca3af" />
                        )}
                        <Text style={{ fontSize: 12, color: hasUnread ? '#6b7280' : '#7f8c8d', fontWeight: hasUnread ? '600' : '400' }}>{time}</Text>
                    </View>
                </View>

                {/* Bottom Row: Message + Badge */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1, marginRight: 16 }}>
                    <MessageLineWithHighlight
                        message={message}
                        highlightQuery={highlightQuery}
                        baseStyle={{
                            fontSize: 14,
                            color: hasUnread ? colors.text : colors.textSecondary,
                            fontWeight: hasUnread ? '700' : 'normal',
                        }}
                    />
                    </View>

                    {unreadCount && unreadCount > 0 ? (
                        <View style={{
                            backgroundColor: badgeBg,
                            borderRadius: 999,
                            minWidth: 20,
                            height: 20,
                            alignItems: 'center',
                            justifyContent: 'center',
                            paddingHorizontal: 5,
                        }}>
                            <Text style={{ color: 'white', fontSize: 11, fontWeight: 'bold' }}>
                                {unreadCount! > 99 ? '99+' : unreadCount}
                            </Text>
                        </View>
                    ) : null}
                </View>
            </View>
        </TouchableOpacity>
    );
};
