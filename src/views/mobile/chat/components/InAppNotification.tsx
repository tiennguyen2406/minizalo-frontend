import React, { useEffect, useRef, useCallback } from "react";
import {
    View,
    Text,
    Animated,
    TouchableOpacity,
    Image,
    PanResponder,
    Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { create } from "zustand";

export interface InAppNotifData {
    id: string;
    title: string;
    body: string;
    avatarUrl?: string;
    roomId?: string;
    timestamp?: number;
}

interface NotifStore {
    current: InAppNotifData | null;
    show: (data: Omit<InAppNotifData, "id" | "timestamp">) => void;
    dismiss: () => void;
}

export const useInAppNotifStore = create<NotifStore>((set) => ({
    current: null,
    show: (data) =>
        set({
            current: {
                ...data,
                id: `notif-${Date.now()}`,
                timestamp: Date.now(),
            },
        }),
    dismiss: () => set({ current: null }),
}));

const DISPLAY_DURATION = 3500;
const SLIDE_DURATION = 250;

export function InAppNotificationBanner({
    onPress,
}: {
    onPress?: (roomId?: string) => void;
}) {
    const current = useInAppNotifStore((s) => s.current);
    const dismiss = useInAppNotifStore((s) => s.dismiss);
    const translateY = useRef(new Animated.Value(-120)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const timer = useRef<ReturnType<typeof setTimeout>>();
    const isVisible = useRef(false);

    const hideAnim = useCallback(() => {
        Animated.parallel([
            Animated.timing(translateY, {
                toValue: -120,
                duration: SLIDE_DURATION,
                useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 0,
                duration: SLIDE_DURATION,
                useNativeDriver: true,
            }),
        ]).start(() => {
            isVisible.current = false;
            dismiss();
        });
    }, [translateY, opacity, dismiss]);

    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
            onPanResponderMove: (_, g) => {
                if (g.dy < 0) translateY.setValue(g.dy);
            },
            onPanResponderRelease: (_, g) => {
                if (g.dy < -30) {
                    hideAnim();
                } else {
                    Animated.spring(translateY, {
                        toValue: 0,
                        useNativeDriver: true,
                    }).start();
                }
            },
        })
    ).current;

    useEffect(() => {
        if (!current) return;
        if (timer.current) clearTimeout(timer.current);

        isVisible.current = true;
        translateY.setValue(-120);
        opacity.setValue(0);

        Animated.parallel([
            Animated.spring(translateY, {
                toValue: 0,
                useNativeDriver: true,
                bounciness: 6,
            }),
            Animated.timing(opacity, {
                toValue: 1,
                duration: SLIDE_DURATION,
                useNativeDriver: true,
            }),
        ]).start();

        timer.current = setTimeout(hideAnim, DISPLAY_DURATION);

        return () => {
            if (timer.current) clearTimeout(timer.current);
        };
    }, [current?.id]);

    if (!current) return null;

    return (
        <Animated.View
            {...panResponder.panHandlers}
            style={{
                position: "absolute",
                top: Platform.OS === "ios" ? 50 : 10,
                left: 12,
                right: 12,
                zIndex: 9999,
                transform: [{ translateY }],
                opacity,
            }}
        >
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => {
                    if (timer.current) clearTimeout(timer.current);
                    hideAnim();
                    onPress?.(current.roomId);
                }}
                style={{
                    backgroundColor: "#fff",
                    borderRadius: 16,
                    padding: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 12,
                    elevation: 8,
                    borderWidth: 0.5,
                    borderColor: "rgba(0,0,0,0.06)",
                }}
            >
                {current.avatarUrl ? (
                    <Image
                        source={{ uri: current.avatarUrl }}
                        style={{
                            width: 42,
                            height: 42,
                            borderRadius: 21,
                            marginRight: 12,
                            backgroundColor: "#e5e7eb",
                        }}
                    />
                ) : (
                    <View
                        style={{
                            width: 42,
                            height: 42,
                            borderRadius: 21,
                            marginRight: 12,
                            backgroundColor: "#3b82f6",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <Ionicons name="chatbubble" size={20} color="#fff" />
                    </View>
                )}
                <View style={{ flex: 1 }}>
                    <Text
                        style={{
                            fontSize: 15,
                            fontWeight: "700",
                            color: "#111827",
                            marginBottom: 2,
                        }}
                        numberOfLines={1}
                    >
                        {current.title}
                    </Text>
                    <Text
                        style={{
                            fontSize: 13,
                            color: "#6b7280",
                        }}
                        numberOfLines={2}
                    >
                        {current.body}
                    </Text>
                </View>
                <TouchableOpacity
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    onPress={() => {
                        if (timer.current) clearTimeout(timer.current);
                        hideAnim();
                    }}
                    style={{ marginLeft: 8, padding: 4 }}
                >
                    <Ionicons name="close" size={18} color="#9ca3af" />
                </TouchableOpacity>
            </TouchableOpacity>
        </Animated.View>
    );
}
