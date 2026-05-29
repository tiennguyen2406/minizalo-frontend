import React, { useEffect, useRef } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Image, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCallStore } from '@/shared/store/useCallStore';

const BLUE = '#0068FF';

const IncomingCallModal = () => {
    const { incomingCall, incomingCallKind, acceptCall, acceptCallNoCamera, joinGroupCall, joinGroupCallNoCamera, rejectCall } = useCallStore();
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const opacityAnim = useRef(new Animated.Value(0.4)).current;

    useEffect(() => {
        if (incomingCall) {
            const pulse = Animated.loop(
                Animated.parallel([
                    Animated.sequence([
                        Animated.timing(pulseAnim, { toValue: 1.15, duration: 1200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
                        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, easing: Easing.in(Easing.ease), useNativeDriver: true }),
                    ]),
                    Animated.sequence([
                        Animated.timing(opacityAnim, { toValue: 0, duration: 1200, useNativeDriver: true }),
                        Animated.timing(opacityAnim, { toValue: 0.4, duration: 1200, useNativeDriver: true }),
                    ]),
                ])
            );
            pulse.start();
            return () => pulse.stop();
        }
    }, [incomingCall]);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (incomingCall) {
            timer = setTimeout(() => {
                rejectCall(incomingCall.callSessionId);
            }, 30000);
        }
        return () => clearTimeout(timer);
    }, [incomingCall]);

    if (!incomingCall) return null;

    const { caller, callType } = incomingCall;
    const avatarUri = caller.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(caller.name)}&background=0068FF&color=fff&size=256`;

    return (
        <Modal transparent={false} animationType="fade" visible={!!incomingCall}>
            <View style={styles.container}>
                <View style={styles.content}>
                    <View style={styles.avatarSection}>
                        <Animated.View style={[styles.ring, { transform: [{ scale: pulseAnim }], opacity: opacityAnim }]} />
                        <Image source={{ uri: avatarUri }} style={styles.avatar} />
                    </View>

                    <Text style={styles.callerName}>{caller.name}</Text>
                    <Text style={styles.subtitle}>
                        MiniZalo: {callType === 'VIDEO' ? 'Cuộc gọi video đến' : 'Cuộc gọi thoại đến'}
                    </Text>
                </View>

                <View style={styles.actionsContainer}>
                    {callType === 'VIDEO' && (
                        <TouchableOpacity
                            style={styles.secondaryAction}
                            onPress={() => (incomingCallKind === 'group'
                                ? joinGroupCallNoCamera(incomingCall.callSessionId)
                                : acceptCallNoCamera(incomingCall.callSessionId))}
                        >
                            <Ionicons name="videocam-off-outline" size={18} color="rgba(255,255,255,0.8)" />
                            <Text style={styles.secondaryText}>Trả lời không mở camera</Text>
                        </TouchableOpacity>
                    )}
                    <View style={styles.actions}>
                        <View style={styles.actionItem}>
                            <TouchableOpacity style={styles.rejectBtn} onPress={() => rejectCall(incomingCall.callSessionId)}>
                                <Ionicons name="call" size={32} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
                            </TouchableOpacity>
                            <Text style={styles.actionLabel}>Từ chối</Text>
                        </View>

                        <View style={styles.actionItem}>
                            <TouchableOpacity
                                style={styles.acceptBtn}
                                onPress={() => (incomingCallKind === 'group'
                                    ? joinGroupCall(incomingCall.callSessionId)
                                    : acceptCall(incomingCall.callSessionId))}
                            >
                                <Ionicons name={callType === 'VIDEO' ? 'videocam' : 'call'} size={32} color="#fff" />
                            </TouchableOpacity>
                            <Text style={styles.actionLabel}>Trả lời</Text>
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: BLUE,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 40,
    },
    avatarSection: {
        width: 180,
        height: 180,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 28,
    },
    ring: {
        position: 'absolute',
        width: 180,
        height: 180,
        borderRadius: 90,
        borderWidth: 3,
        borderColor: 'rgba(255,255,255,0.4)',
    },
    avatar: {
        width: 150,
        height: 150,
        borderRadius: 75,
        borderWidth: 3,
        borderColor: 'rgba(255,255,255,0.5)',
    },
    callerName: {
        color: '#fff',
        fontSize: 28,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 16,
        textAlign: 'center',
    },
    actionsContainer: {
        paddingBottom: 80,
        alignItems: 'center',
    },
    secondaryAction: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 24,
        marginBottom: 36,
        gap: 8,
    },
    secondaryText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 80,
    },
    actionItem: {
        alignItems: 'center',
        gap: 10,
    },
    rejectBtn: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: '#FF3B30',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    acceptBtn: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: '#34C759',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    actionLabel: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
});

export default IncomingCallModal;
