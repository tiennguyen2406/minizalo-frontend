import React, { useState, useEffect, useRef } from "react";
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    StyleSheet,
    Image,
    Animated,
    Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { IRtcEngine } from "react-native-agora";

let AgoraEngine: any = null;
let AgoraRtcSurfaceView: any = null;
let AgoraChannelProfileType: any = null;

try {
    const AgoraNative = require("react-native-agora");
    AgoraEngine = AgoraNative.createAgoraRtcEngine;
    AgoraRtcSurfaceView = AgoraNative.RtcSurfaceView;
    AgoraChannelProfileType = AgoraNative.ChannelProfileType;
} catch (e) {
    console.log("[Agora] Native module not found (Expo Go). Feature disabled.");
}
import { useCallStore } from "@/shared/store/useCallStore";
import { useAuthStore } from "@/shared/store/authStore";
import { Camera } from "expo-camera";
import { Audio } from "expo-av";

const BLUE = "#0068FF";

export default function CallModal() {
    const { activeCall, callStatus, endCall, resetCall } = useCallStore();
    const user = useAuthStore((state) => state.user);

    const visible = !!activeCall && (callStatus === "calling" || callStatus === "connected");
    const callType = activeCall?.callType || "VOICE";
    const userName = activeCall?.partnerName || "Đang kết nối...";
    const avatarUrl = activeCall?.partnerAvatar;
    const avatarUri = avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=0068FF&color=fff&size=256`;

    const [engine, setEngine] = useState<IRtcEngine | null>(null);
    const [remoteUid, setRemoteUid] = useState<number>(0);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [isSpeakerOn, setIsSpeakerOn] = useState(callType === "VIDEO");
    const [duration, setDuration] = useState(0);
    const engineRef = useRef<IRtcEngine | null>(null);
    const initializedRef = useRef(false);

    const pulseAnim = useRef(new Animated.Value(1)).current;
    const opacityAnim = useRef(new Animated.Value(0.4)).current;

    // Ring animation when waiting
    useEffect(() => {
        if (visible && remoteUid === 0) {
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
    }, [visible, remoteUid]);

    useEffect(() => {
        if (!visible || !activeCall || initializedRef.current) return;

        const init = async () => {
            if (!AgoraEngine) {
                console.warn("[Agora] Native module is NOT linked. Cannot start call on Expo Go.");
                return;
            }
            try {
                const audioPerm = await Audio.requestPermissionsAsync();
                console.log("[Agora] Audio permission:", audioPerm.status);
                if (callType === "VIDEO") {
                    const camPerm = await Camera.requestCameraPermissionsAsync();
                    console.log("[Agora] Camera permission:", camPerm.status);
                }

                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: true,
                    playsInSilentModeIOS: true,
                    staysActiveInBackground: true,
                    shouldDuckAndroid: false,
                });
                console.log("[Agora] Audio mode configured for recording + playback");

                initializedRef.current = true;
                const agEngine = AgoraEngine();
                agEngine.initialize({ appId: activeCall.appId });
                setEngine(agEngine);
                engineRef.current = agEngine;

                agEngine.addListener("onJoinChannelSuccess", (connection: any, uid: any) => {
                    console.log("[Agora] Joined channel:", connection.channelId);
                });
                agEngine.addListener("onUserJoined", (_: any, uid: any) => {
                    console.log("[Agora] Remote user joined:", uid);
                    setRemoteUid(uid);
                });
                agEngine.addListener("onUserOffline", () => {
                    setRemoteUid(0);
                });
                agEngine.addListener("onError", (err: any, msg: any) => {
                    console.error("[Agora] Error:", err, msg);
                });

                agEngine.enableAudio();
                agEngine.muteLocalAudioStream(false);
                agEngine.setChannelProfile(AgoraChannelProfileType.ChannelProfileCommunication);
                agEngine.setDefaultAudioRouteToSpeakerphone(callType === "VIDEO");

                if (callType === "VIDEO") {
                    agEngine.enableVideo();
                    agEngine.startPreview();
                    agEngine.setEnableSpeakerphone(true);
                } else {
                    agEngine.setEnableSpeakerphone(false);
                }

                agEngine.joinChannelWithUserAccount(activeCall.token, activeCall.channelName, user?.id || "");
                console.log("[Agora] Joining channel:", activeCall.channelName, "as", user?.id, "type:", callType);
            } catch (error) {
                console.error("[Agora] Init Failed:", error);
                initializedRef.current = false;
            }
        };
        init();
    }, [visible, activeCall?.callSessionId]);

    const cleanupAgora = () => {
        if (engineRef.current) {
            try { engineRef.current.leaveChannel(); engineRef.current.release(); } catch (e) { /* */ }
            engineRef.current = null;
        }
        Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: false,
            staysActiveInBackground: false,
        }).catch(() => {});
        setEngine(null);
        setRemoteUid(0);
        setIsMuted(false);
        setIsVideoOff(false);
        setIsSpeakerOn(callType === "VIDEO");
        setDuration(0);
        initializedRef.current = false;
    };

    useEffect(() => {
        if (callStatus === "idle" && initializedRef.current) cleanupAgora();
    }, [callStatus]);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (remoteUid !== 0) {
            timer = setInterval(() => setDuration((p) => p + 1), 1000);
        }
        return () => clearInterval(timer);
    }, [remoteUid]);

    const fmt = (s: number) => {
        const m = Math.floor(s / 60), ss = s % 60;
        return `${m < 10 ? "0" : ""}${m}:${ss < 10 ? "0" : ""}${ss}`;
    };

    const handleEndCall = async () => {
        if (activeCall) await endCall(activeCall.callSessionId);
        cleanupAgora();
        resetCall();
    };

    const toggleMute = () => { if (engineRef.current) { engineRef.current.muteLocalAudioStream(!isMuted); setIsMuted(!isMuted); } };
    const toggleVideo = () => { if (engineRef.current && callType === "VIDEO") { engineRef.current.muteLocalVideoStream(!isVideoOff); setIsVideoOff(!isVideoOff); } };
    const toggleSpeaker = () => { if (engineRef.current) { engineRef.current.setEnableSpeakerphone(!isSpeakerOn); setIsSpeakerOn(!isSpeakerOn); } };
    const switchCamera = () => { if (engineRef.current && callType === "VIDEO") engineRef.current.switchCamera(); };

    if (!visible) return null;

    const isConnected = remoteUid !== 0;
    const isVideo = callType === "VIDEO";

    return (
        <Modal animationType="slide" transparent={false} visible={visible} onRequestClose={handleEndCall}>
            <View style={styles.container}>
                {/* VIDEO MODE */}
                {isVideo ? (
                    <View style={StyleSheet.absoluteFill}>
                        {isConnected && AgoraRtcSurfaceView ? (
                            <AgoraRtcSurfaceView canvas={{ uid: remoteUid }} style={StyleSheet.absoluteFill} />
                        ) : (
                            <View style={[StyleSheet.absoluteFill, { backgroundColor: BLUE }]}>
                                <View style={styles.voiceContent}>
                                    <View style={styles.avatarSection}>
                                        <Animated.View style={[styles.ring, { transform: [{ scale: pulseAnim }], opacity: opacityAnim }]} />
                                        <Image source={{ uri: avatarUri }} style={styles.avatar} />
                                    </View>
                                    <Text style={styles.userName}>{userName}</Text>
                                    <Text style={styles.statusText}>Đang đổ chuông</Text>
                                </View>
                            </View>
                        )}

                        {!isVideoOff && isConnected && (
                            <View style={styles.localVideoContainer}>
                                {AgoraRtcSurfaceView ? (
                                    <AgoraRtcSurfaceView canvas={{ uid: 0 }} style={styles.localVideo} zOrderMediaOverlay={true} />
                                ) : (
                                    <View style={[styles.localVideo, { backgroundColor: "#333", justifyContent: "center", alignItems: "center" }]}>
                                        <Text style={{ color: "white", fontSize: 10 }}>No Preview</Text>
                                    </View>
                                )}
                                <TouchableOpacity style={styles.switchCameraBtn} onPress={switchCamera}>
                                    <Ionicons name="camera-reverse" size={18} color="white" />
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                ) : (
                    /* VOICE MODE */
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: BLUE }]}>
                        <View style={styles.voiceContent}>
                            <View style={styles.avatarSection}>
                                {!isConnected && (
                                    <Animated.View style={[styles.ring, { transform: [{ scale: pulseAnim }], opacity: opacityAnim }]} />
                                )}
                                <Image source={{ uri: avatarUri }} style={styles.avatar} />
                            </View>
                            <Text style={styles.userName}>{userName}</Text>
                            <Text style={styles.statusText}>
                                {isConnected ? fmt(duration) : "Đang đổ chuông"}
                            </Text>
                        </View>
                    </View>
                )}

                {/* CONTROLS OVERLAY */}
                <SafeAreaView style={styles.controlsOverlay} pointerEvents="box-none">
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={handleEndCall} style={styles.headerBtn}>
                            <Ionicons name="chevron-back" size={28} color="#fff" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>MiniZalo</Text>
                        {isVideo ? (
                            <TouchableOpacity onPress={switchCamera} style={styles.headerBtn}>
                                <Ionicons name="camera-reverse-outline" size={24} color="#fff" />
                            </TouchableOpacity>
                        ) : (
                            <View style={styles.headerBtn} />
                        )}
                    </View>

                    {/* Timer badge for video connected */}
                    {isVideo && isConnected && (
                        <View style={styles.timerBadge}>
                            <Text style={styles.timerText}>{fmt(duration)}</Text>
                        </View>
                    )}

                    {/* Bottom actions */}
                    <View style={styles.footer}>
                        <View style={styles.actionRow}>
                            {isVideo ? (
                                <>
                                    <ActionButton
                                        icon={isMuted ? "mic-off" : "mic"}
                                        label={isMuted ? "Bật mic" : "Mic"}
                                        active={isMuted}
                                        onPress={toggleMute}
                                    />
                                    <View style={styles.endBtnWrapper}>
                                        <TouchableOpacity onPress={handleEndCall} style={styles.endBtn}>
                                            <Ionicons name="call" size={32} color="#fff" style={{ transform: [{ rotate: "135deg" }] }} />
                                        </TouchableOpacity>
                                        <Text style={styles.actionLabel}>Kết thúc</Text>
                                    </View>
                                    <ActionButton
                                        icon={isVideoOff ? "videocam-off" : "videocam"}
                                        label={isVideoOff ? "Bật cam" : "Camera"}
                                        active={isVideoOff}
                                        onPress={toggleVideo}
                                    />
                                </>
                            ) : (
                                <>
                                    <ActionButton
                                        icon={isSpeakerOn ? "volume-high" : "volume-medium"}
                                        label="Loa"
                                        active={!isSpeakerOn}
                                        onPress={toggleSpeaker}
                                    />
                                    <View style={styles.endBtnWrapper}>
                                        <TouchableOpacity onPress={handleEndCall} style={styles.endBtn}>
                                            <Ionicons name="call" size={32} color="#fff" style={{ transform: [{ rotate: "135deg" }] }} />
                                        </TouchableOpacity>
                                        <Text style={styles.actionLabel}>Kết thúc</Text>
                                    </View>
                                    <ActionButton
                                        icon={isMuted ? "mic-off" : "mic"}
                                        label="Mic"
                                        active={isMuted}
                                        onPress={toggleMute}
                                    />
                                </>
                            )}
                        </View>
                    </View>
                </SafeAreaView>
            </View>
        </Modal>
    );
}

function ActionButton({ icon, label, active, onPress }: { icon: string; label: string; active: boolean; onPress: () => void }) {
    return (
        <View style={styles.actionItem}>
            <TouchableOpacity onPress={onPress} style={[styles.smallBtn, active && styles.activeBtn]}>
                <Ionicons name={icon as any} size={26} color={active ? "#000" : "#fff"} />
            </TouchableOpacity>
            <Text style={styles.actionLabel}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: BLUE },
    controlsOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 100 },

    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 12,
        paddingTop: 8,
        height: 52,
    },
    headerBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
    headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },

    voiceContent: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingBottom: 120,
    },
    avatarSection: {
        width: 180,
        height: 180,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 28,
    },
    ring: {
        position: "absolute",
        width: 180,
        height: 180,
        borderRadius: 90,
        borderWidth: 3,
        borderColor: "rgba(255,255,255,0.4)",
    },
    avatar: {
        width: 150,
        height: 150,
        borderRadius: 75,
        borderWidth: 3,
        borderColor: "rgba(255,255,255,0.5)",
    },
    userName: { color: "#fff", fontSize: 28, fontWeight: "bold", textAlign: "center", marginBottom: 8 },
    statusText: { color: "rgba(255,255,255,0.7)", fontSize: 16, textAlign: "center" },

    timerBadge: {
        alignSelf: "center",
        backgroundColor: "rgba(0,0,0,0.4)",
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
        marginTop: 8,
    },
    timerText: { color: "#fff", fontSize: 16, fontWeight: "600" },

    footer: { position: "absolute", bottom: 80, left: 0, right: 0, paddingHorizontal: 40 },
    actionRow: { flexDirection: "row", justifyContent: "space-around", alignItems: "flex-start" },
    actionItem: { alignItems: "center", gap: 8 },
    smallBtn: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: "rgba(255,255,255,0.2)",
        justifyContent: "center",
        alignItems: "center",
    },
    activeBtn: { backgroundColor: "#fff" },
    endBtnWrapper: { alignItems: "center", gap: 8 },
    endBtn: {
        width: 68,
        height: 68,
        borderRadius: 34,
        backgroundColor: "#FF3B30",
        justifyContent: "center",
        alignItems: "center",
        elevation: 6,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
    },
    actionLabel: { color: "#fff", fontSize: 13, fontWeight: "500" },

    localVideoContainer: {
        position: "absolute",
        top: 100,
        right: 16,
        width: 110,
        height: 160,
        borderRadius: 14,
        overflow: "hidden",
        borderWidth: 2,
        borderColor: "rgba(255,255,255,0.4)",
        backgroundColor: "#222",
        zIndex: 100,
    },
    localVideo: { flex: 1 },
    switchCameraBtn: {
        position: "absolute",
        bottom: 6,
        right: 6,
        backgroundColor: "rgba(0,0,0,0.5)",
        padding: 5,
        borderRadius: 16,
    },
});
