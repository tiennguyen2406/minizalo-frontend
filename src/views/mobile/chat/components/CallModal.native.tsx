import React, { useState, useEffect, useRef } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Image,
    Animated,
    Easing,
    Platform,
    InteractionManager,
    StatusBar,
    Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { IRtcEngine } from "react-native-agora";

let AgoraEngine: any = null;
let AgoraRtcSurfaceView: any = null;
let AgoraChannelProfileType: any = null;
let AgoraAudioProfileType: any = null;
let AgoraAudioScenarioType: any = null;
let AgoraAudioAinsMode: any = null;
let AgoraRtcTextureView: any = null;
let AgoraRenderModeType: any = null;

try {
    const AgoraNative = require("react-native-agora");
    AgoraEngine = AgoraNative.createAgoraRtcEngine;
    AgoraRtcSurfaceView = AgoraNative.RtcSurfaceView;
    AgoraRtcTextureView = AgoraNative.RtcTextureView;
    AgoraChannelProfileType = AgoraNative.ChannelProfileType;
    AgoraAudioProfileType = AgoraNative.AudioProfileType;
    AgoraAudioScenarioType = AgoraNative.AudioScenarioType;
    AgoraAudioAinsMode = AgoraNative.AudioAinsMode;
    AgoraRenderModeType = AgoraNative.RenderModeType;
} catch (e) {

}
import { useCallStore } from "@/shared/store/useCallStore";
import { useAuthStore } from "@/shared/store/authStore";
import { Camera } from "expo-camera";
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";

const BLUE = "#0068FF";

/** Âm remote: loa ngoài / video. Mặc định SDK = 100, max 400 */
const PLAYBACK_VOLUME_SPEAKER = 230;
/** Tai nghe / loa thoại — boost thêm vì thường rất nhỏ */
const PLAYBACK_VOLUME_EARPIECE = 380;

function renderModeFit() {
    return AgoraRenderModeType ? AgoraRenderModeType.RenderModeFit : 2;
}

function renderModeCover() {
    return AgoraRenderModeType ? AgoraRenderModeType.RenderModeHidden : 1;
}

/** Android: TextureView — cùng cây view bình thường, không “đè” layer như SurfaceView (touch tới được header). */
function LocalPreviewView(props: React.ComponentProps<any>) {
    const V =
        Platform.OS === "android" && AgoraRtcTextureView ? AgoraRtcTextureView : AgoraRtcSurfaceView;
    return V ? <V {...props} /> : null;
}

function RemoteVideoView(props: React.ComponentProps<any>) {
    const V =
        Platform.OS === "android" && AgoraRtcTextureView ? AgoraRtcTextureView : AgoraRtcSurfaceView;
    return V ? <V {...props} /> : null;
}

export default function CallModal() {
    const insets = useSafeAreaInsets();
    const { activeCall, callStatus, endCall, cancelCall, resetCall, leaveGroupCall, endGroupCall } = useCallStore();
    const user = useAuthStore((state) => state.user);

    const visible = !!activeCall && (callStatus === "calling" || callStatus === "connected");
    const callType = activeCall?.callType || "VOICE";
    const startWithCamera = activeCall?.startWithCamera ?? true;
    const isGroupCall = activeCall?.isGroupCall ?? false;
    const userName = activeCall?.partnerName || "Đang kết nối...";
    const avatarUrl = activeCall?.partnerAvatar;
    const avatarUri = avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=0068FF&color=fff&size=256`;

    const [engine, setEngine] = useState<IRtcEngine | null>(null);
    // Đếm số lần "đã có engine + đã startPreview" để force remount RtcTextureView → Agora bind lại canvas (uid: 0)
    const [previewTick, setPreviewTick] = useState(0);
    const [remoteUid, setRemoteUid] = useState<number>(0);
    // Group call: mảng uid của tất cả remote users
    const [remoteUids, setRemoteUids] = useState<number[]>([]);
    const [isRemoteVideoOff, setIsRemoteVideoOff] = useState(false);
    const [remoteReady, setRemoteReady] = useState(false);
    // Group call: map uid → đang tắt cam? (fix RtcSurfaceView freeze frame khi remote mute video)
    const [remoteVideoOffByUid, setRemoteVideoOffByUid] = useState<Record<number, boolean>>({});
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [isSpeakerOn, setIsSpeakerOn] = useState(callType === "VIDEO");
    const [duration, setDuration] = useState(0);
    // Kích thước video remote (nhận từ SDK) — dùng để set aspectRatio, phần thừa để nền xanh che chat.
    const [remoteSize, setRemoteSize] = useState<{ w: number; h: number } | null>(null);
    const engineRef = useRef<IRtcEngine | null>(null);
    const initializedRef = useRef(false);
    const isSpeakerOnRef = useRef(isSpeakerOn);
    isSpeakerOnRef.current = isSpeakerOn;
    const remoteUidRef = useRef<number>(0);
    remoteUidRef.current = remoteUid;

    const applyPlaybackVolume = (ag: IRtcEngine) => {
        try {
            const speakerRoute =
                callType === "VIDEO" || isSpeakerOnRef.current;
            ag.adjustPlaybackSignalVolume(
                speakerRoute ? PLAYBACK_VOLUME_SPEAKER : PLAYBACK_VOLUME_EARPIECE
            );
        } catch {
            /* */
        }
    };

    const pulseAnim = useRef(new Animated.Value(1)).current;
    const opacityAnim = useRef(new Animated.Value(0.4)).current;

    // Ring animation when waiting (cho cả group và 1-1)
    useEffect(() => {
        const noRemote = isGroupCall ? remoteUids.length === 0 : remoteUid === 0;
        if (visible && noRemote) {
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
    }, [visible, remoteUid, remoteUids.length, isGroupCall]);

    /** Preview khi đang đổ chuông: đôi khi view chưa gắn kịp — gọi lại startPreview & remount view */
    useEffect(() => {
        const noRemote = isGroupCall ? remoteUids.length === 0 : remoteUid === 0;
        if (
            !visible ||
            callType !== "VIDEO" ||
            !noRemote ||
            !initializedRef.current ||
            !engineRef.current
        ) {
            return;
        }
        const kick = () => {
            try {
                engineRef.current?.enableVideo?.();
                engineRef.current?.enableLocalVideo?.(true);
                engineRef.current?.startPreview?.();
            } catch { /* */ }
            // Tăng tick để TextureView remount → gắn lại canvas uid:0
            setPreviewTick((x) => x + 1);
        };
        kick();
        const a = setTimeout(kick, 400);
        const b = setTimeout(kick, 1200);
        const c = setTimeout(kick, 2400);
        return () => {
            clearTimeout(a);
            clearTimeout(b);
            clearTimeout(c);
        };
    }, [visible, callType, remoteUid, remoteUids.length, isGroupCall, activeCall?.callSessionId, engine]);

    useEffect(() => {
        if (!visible || !activeCall || initializedRef.current) return;

        const init = async () => {
            if (!AgoraEngine) {
                console.warn("[Agora] Native module is NOT linked. Cannot start call on Expo Go.");
                return;
            }
            try {
                const audioPerm = await Audio.requestPermissionsAsync();

                if (callType === "VIDEO") {
                    const camPerm = await Camera.requestCameraPermissionsAsync();

                }

                const userAccount = (user?.id || "").trim();
                if (!userAccount) {
                    console.error("[Agora] Missing user id — cannot join with User Account");
                    return;
                }

                // VoIP: giành audio focus Android/iOS để vừa thu mic vừa phát remote audio (tránh chỉ có video).
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: true,
                    playsInSilentModeIOS: true,
                    staysActiveInBackground: true,
                    interruptionModeIOS: InterruptionModeIOS.DoNotMix,
                    interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
                    shouldDuckAndroid: false,
                    playThroughEarpieceAndroid: callType !== "VIDEO",
                });


                initializedRef.current = true;
                const agEngine = AgoraEngine();
                agEngine.initialize({ appId: activeCall.appId });
                agEngine.registerLocalUserAccount(activeCall.appId, userAccount);
                setEngine(agEngine);
                engineRef.current = agEngine;

                agEngine.addListener("onJoinChannelSuccess", (connection: any, _uid: any) => {

                    try {
                        agEngine.muteAllRemoteAudioStreams(false);
                        applyPlaybackVolume(agEngine);
                    } catch {
                        /* */
                    }
                });
                agEngine.addListener("onUserJoined", (_: any, uid: any) => {
                    const numUid = Number(uid);
                    if (activeCall?.isGroupCall) {
                        setRemoteUids((prev) => prev.includes(numUid) ? prev : [...prev, numUid]);
                    } else {
                        setRemoteUid(numUid);
                        setIsRemoteVideoOff(false);
                        setRemoteReady(false);
                    }
                });
                agEngine.addListener("onUserOffline", (_: any, uid: any) => {
                    const numUid = Number(uid);
                    if (activeCall?.isGroupCall) {
                        setRemoteUids((prev) => prev.filter((u) => u !== numUid));
                        setRemoteVideoOffByUid((prev) => {
                            const next = { ...prev };
                            delete next[numUid];
                            return next;
                        });
                    } else {
                        setRemoteUid(0);
                        setRemoteSize(null);
                        setIsRemoteVideoOff(false);
                        setRemoteReady(false);
                    }
                });
                // Remote toggle camera (web/mobile). Event name differs by SDK versions; keep both.
                // Luôn cập nhật `remoteVideoOffByUid` cho group (per-uid) VÀ cập nhật `isRemoteVideoOff` cho 1-1.
                agEngine.addListener?.("onUserMuteVideo", (_: any, uid: any, muted: any) => {
                    const numUid = Number(uid);
                    const off = !!muted;
                    setRemoteVideoOffByUid((prev) => ({ ...prev, [numUid]: off }));
                    if (numUid === Number(remoteUidRef.current)) {
                        setIsRemoteVideoOff(off);
                        if (off) setRemoteReady(false);
                    }
                });
                agEngine.addListener?.("onRemoteVideoStateChanged", (_: any, uid: any, state: any) => {
                    // state: 0=STOPPED, 1=STARTING, 2=DECODING, 3=FROZEN, 4=FAILED
                    const numUid = Number(uid);
                    const s = Number(state);
                    const off = s === 0 || s === 3 || s === 4;
                    setRemoteVideoOffByUid((prev) => ({ ...prev, [numUid]: off }));
                    if (numUid === Number(remoteUidRef.current)) {
                        setIsRemoteVideoOff(off);
                        if (off) setRemoteReady(false);
                        if (!off && (s === 1 || s === 2)) {
                            setTimeout(() => setRemoteReady(true), 120);
                        }
                    }
                });
                // sourceType = 2 (Remote). Dùng size này để letterbox đúng tỷ lệ.
                agEngine.addListener(
                    "onVideoSizeChanged",
                    (_connection: any, sourceType: any, uid: any, width: any, height: any) => {
                        if (sourceType === 2 && width > 0 && height > 0) {
                            setRemoteSize({ w: width, h: height });
                            if (Number(uid) === Number(remoteUidRef.current)) {
                                // Đợi có size (thường sau frame đầu) rồi mới swap layout để tránh xanh lâu/chớp.
                                setTimeout(() => setRemoteReady(true), 120);
                            }

                        }
                    }
                );
                agEngine.addListener("onError", (err: any, msg: any) => {
                    console.error("[Agora] Error:", err, msg);
                });

                agEngine.enableAudio();
                if (AgoraAudioProfileType && AgoraAudioScenarioType) {
                    agEngine.setAudioProfile(
                        AgoraAudioProfileType.AudioProfileSpeechStandard,
                        AgoraAudioScenarioType.AudioScenarioMeeting
                    );
                    agEngine.setAudioScenario(AgoraAudioScenarioType.AudioScenarioMeeting);
                }
                agEngine.enableLocalAudio(true);
                agEngine.muteLocalAudioStream(false);
                if (AgoraAudioAinsMode) {
                    agEngine.setAINSMode(true, AgoraAudioAinsMode.AinsModeBalanced);
                }
                agEngine.setChannelProfile(AgoraChannelProfileType.ChannelProfileCommunication);
                agEngine.setDefaultAudioRouteToSpeakerphone(callType === "VIDEO");

                if (callType === "VIDEO") {
                    // Agora chuẩn: enableVideo → enableLocalVideo → startPreview để camera mở ngay lập tức (không chờ bên kia).
                    agEngine.enableVideo();
                    try { agEngine.enableLocalVideo?.(startWithCamera); } catch { /* */ }
                    if (startWithCamera) {
                        try { agEngine.startPreview(); } catch { /* */ }
                    } else {
                        try { agEngine.muteLocalVideoStream(true); } catch { /* */ }
                        setIsVideoOff(true);
                    }
                    agEngine.setEnableSpeakerphone(true);
                    // Bump tick để LocalPreviewView mount → Agora gắn canvas uid:0
                    setPreviewTick((x) => x + 1);
                    InteractionManager.runAfterInteractions(() => {
                        setTimeout(() => {
                            try {
                                engineRef.current?.enableVideo?.();
                                engineRef.current?.enableLocalVideo?.(startWithCamera);
                                if (startWithCamera) {
                                    engineRef.current?.startPreview?.();
                                }
                            } catch { /* */ }
                            setPreviewTick((x) => x + 1);
                        }, 120);
                    });
                } else {
                    agEngine.setEnableSpeakerphone(false);
                }

                const joinOptions = {
                    publishMicrophoneTrack: true,
                    // Quan trọng: vẫn publish camera track cho call VIDEO dù startWithCamera=false,
                    // để user có thể bật camera lại sau khi vào call.
                    publishCameraTrack: callType === "VIDEO",
                    autoSubscribeAudio: true,
                    autoSubscribeVideo: callType === "VIDEO",
                    enableAudioRecordingOrPlayout: true,
                };

                agEngine.joinChannelWithUserAccount(
                    activeCall.token,
                    activeCall.channelName,
                    userAccount,
                    joinOptions
                );

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
            interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
            interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
        }).catch(() => {});
        setEngine(null);
        setRemoteUid(0);
        setRemoteUids([]);
        setRemoteVideoOffByUid({});
        setIsRemoteVideoOff(false);
        setRemoteReady(false);
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
        const isActive = isGroupCall ? remoteUids.length > 0 : remoteUid !== 0;
        if (isActive) {
            timer = setInterval(() => setDuration((p) => p + 1), 1000);
        }
        return () => clearInterval(timer);
    }, [remoteUid, remoteUids.length, isGroupCall]);

    const fmt = (s: number) => {
        const m = Math.floor(s / 60), ss = s % 60;
        return `${m < 10 ? "0" : ""}${m}:${ss < 10 ? "0" : ""}${ss}`;
    };

    // Thực thi leave group (không hỏi lại — dùng cho cả host và non-host)
    const doLeaveGroup = async () => {
        if (!activeCall) return;
        await leaveGroupCall(activeCall.callSessionId).catch(() => {});
        cleanupAgora();
        resetCall();
    };

    // Host giải tán cuộc gọi cho tất cả
    const doEndGroupForAll = async () => {
        if (!activeCall) return;
        await endGroupCall(activeCall.callSessionId).catch(() => {});
        cleanupAgora();
        resetCall();
    };

    const handleEndCall = async () => {
        if (!activeCall) return;

        // Group call: host có 2 lựa chọn (Thoát / Kết thúc cho tất cả); non-host chỉ Thoát.
        if (isGroupCall) {
            const myId = String(user?.id || '');
            const isHost = !!myId && myId === String(activeCall.hostId);
            if (isHost) {
                Alert.alert(
                    "Kết thúc cuộc gọi?",
                    "Bạn muốn rời cuộc gọi hay kết thúc cho tất cả thành viên?",
                    [
                        { text: "Huỷ", style: "cancel" },
                        { text: "Thoát", onPress: () => { void doLeaveGroup(); } },
                        { text: "Kết thúc cho tất cả", style: "destructive", onPress: () => { void doEndGroupForAll(); } },
                    ],
                );
            } else {
                await doLeaveGroup();
            }
            return;
        }

        // 1-1 như cũ
        if (callStatus === 'calling') await cancelCall(activeCall.callSessionId);
        else await endCall(activeCall.callSessionId);
        cleanupAgora();
        resetCall();
    };

    const toggleMute = () => { if (engineRef.current) { engineRef.current.muteLocalAudioStream(!isMuted); setIsMuted(!isMuted); } };
    const toggleVideo = () => {
        if (!engineRef.current || callType !== "VIDEO") return;
        if (isVideoOff) {
            // Bật lại cam: kể cả trường hợp startWithCamera=false (cam chưa từng mở)
            try {
                engineRef.current.enableLocalVideo(true);
                engineRef.current.muteLocalVideoStream(false);
                engineRef.current.startPreview();
            } catch { /* */ }
            setIsVideoOff(false);
            setPreviewTick((x) => x + 1);
        } else {
            try {
                engineRef.current.muteLocalVideoStream(true);
            } catch { /* */ }
            setIsVideoOff(true);
        }
    };
    const toggleSpeaker = () => {
        if (!engineRef.current) return;
        const next = !isSpeakerOn;
        engineRef.current.setEnableSpeakerphone(next);
        setIsSpeakerOn(next);
        applyPlaybackVolume(engineRef.current);
        Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
            staysActiveInBackground: true,
            interruptionModeIOS: InterruptionModeIOS.DoNotMix,
            interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
            shouldDuckAndroid: false,
            playThroughEarpieceAndroid: !next,
        }).catch(() => {});
    };
    const switchCamera = () => { if (engineRef.current && callType === "VIDEO") engineRef.current.switchCamera(); };

    if (!visible) return null;

    const isConnected = isGroupCall ? remoteUids.length > 0 : remoteUid !== 0;
    const isVideo = callType === "VIDEO";
    const showRemoteVideo = isConnected && isVideo && !isRemoteVideoOff && remoteReady;
    const showLocalFull = isVideo && !isGroupCall && (remoteUid === 0 || isRemoteVideoOff);

    // Mobile grid — portrait-first, tile lẻ cuối sẽ span full width.
    //   1 → full
    //   2 → stack dọc (100% × 50%)                vì 2 tile ngang trên 390px quá nhỏ
    //   3 → [A][B] / [     C full     ]
    //   4 → 2×2
    //   5 → 2×2 / [     E full     ]
    //   6 → 2×3 (2 cột × 3 hàng)
    //   7+ → 2 cột tràn dần (ít dùng)
    const getGroupTileStyle = (idx: number, total: number): any => {
        const base = {
            backgroundColor: "#1a1a2e",
            overflow: "hidden" as const,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
        };
        if (total === 1) return { ...base, flex: 1, height: "100%" };
        if (total === 2) return { ...base, width: "100%", height: "50%" };
        if (total === 3) {
            if (idx < 2) return { ...base, width: "50%", height: "50%" };
            return { ...base, width: "100%", height: "50%" };
        }
        if (total === 4) return { ...base, width: "50%", height: "50%" };
        if (total === 5) {
            if (idx < 4) return { ...base, width: "50%", height: "33.334%" };
            return { ...base, width: "100%", height: "33.334%" };
        }
        if (total === 6) return { ...base, width: "50%", height: "33.334%" };
        return { ...base, width: "50%", height: "25%" };
    };

    return (
        <View
            style={[styles.rootOverlay, { backgroundColor: BLUE }]}
            // "auto": chặn touch xuyên xuống Stack bên dưới; các button vẫn nhận touch bình thường.
            pointerEvents="auto"
            collapsable={false}
        >
            <StatusBar barStyle="light-content" backgroundColor={BLUE} translucent={Platform.OS === "android"} />
            <View style={styles.container}>
                {/* GROUP CALL VIDEO MODE */}
                {isVideo && isGroupCall ? (
                    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                        <View style={[StyleSheet.absoluteFill, { backgroundColor: "#0d0d1a" }]} />
                        {/* Grid remote videos — KHÔNG dùng gap vì sẽ phá percentage width/height gây wrap sai */}
                        {remoteUids.length === 0 ? (
                            <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
                                <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 16 }}>Đang chờ người tham gia…</Text>
                            </View>
                        ) : (
                            <View
                                style={{
                                    ...StyleSheet.absoluteFillObject,
                                    flexDirection: "row",
                                    flexWrap: "wrap",
                                    alignContent: "flex-start",
                                }}
                            >
                                {remoteUids.map((uid, idx) => {
                                    // Unmount RtcSurfaceView khi remote tắt cam (fix freeze frame).
                                    // Mỗi lần remount (uid off/on) dùng key khác để Agora bind lại canvas mới → không còn frame cũ.
                                    const off = !!remoteVideoOffByUid[uid];
                                    return (
                                        <View key={uid} style={getGroupTileStyle(idx, remoteUids.length)}>
                                            {off || !RemoteVideoView ? (
                                                <View style={styles.tileAvatarFallback}>
                                                    <View style={styles.tileAvatarCircle}>
                                                        <Ionicons name="person" size={36} color="rgba(255,255,255,0.7)" />
                                                    </View>
                                                    <Text style={styles.tileAvatarLabel}>Đã tắt camera</Text>
                                                </View>
                                            ) : (
                                                <RemoteVideoView
                                                    key={`rvv-${uid}-${off ? 'off' : 'on'}`}
                                                    canvas={{ uid, renderMode: renderModeFit() }}
                                                    style={StyleSheet.absoluteFill}
                                                />
                                            )}
                                        </View>
                                    );
                                })}
                            </View>
                        )}
                        {/* Local PiP */}
                        {!isVideoOff && (
                            <View style={styles.localVideoContainer}>
                                {LocalPreviewView ? (
                                    <LocalPreviewView
                                        key={`local-pip-${previewTick}`}
                                        canvas={{ uid: 0, renderMode: renderModeCover() }}
                                        style={styles.localVideo}
                                        {...(Platform.OS === "ios" ? { zOrderMediaOverlay: true } : {})}
                                    />
                                ) : null}
                                <TouchableOpacity style={styles.switchCameraBtn} onPress={switchCamera}>
                                    <Ionicons name="camera-reverse" size={18} color="white" />
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                ) : isVideo && !isGroupCall ? (
                    /* 1-1 VIDEO MODE */
                    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                        {isConnected ? (
                            <>
                                {/* Lớp nền xanh che chat phía sau, cho cả các vùng letterbox quanh video remote */}
                                <View style={[StyleSheet.absoluteFill, { backgroundColor: BLUE }]} pointerEvents="none" />
                                {/* Remote video OR fallback when remote tắt cam */}
                                {showRemoteVideo ? (
                                    <View
                                        style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}
                                        pointerEvents="none"
                                        collapsable={false}
                                    >
                                        <View
                                            style={
                                                remoteSize
                                                    ? {
                                                        width: "100%",
                                                        aspectRatio: remoteSize.w / remoteSize.h,
                                                        maxHeight: "100%",
                                                        backgroundColor: "black",
                                                    }
                                                    : StyleSheet.absoluteFill
                                            }
                                            collapsable={false}
                                        >
                                            <RemoteVideoView
                                                canvas={{ uid: remoteUid, renderMode: renderModeFit() }}
                                                style={StyleSheet.absoluteFill}
                                            />
                                        </View>
                                    </View>
                                ) : (
                                    <View style={[StyleSheet.absoluteFill, { backgroundColor: BLUE }]} pointerEvents="none">
                                        <View style={styles.voiceContent}>
                                            <View style={styles.avatarSection}>
                                                <Image source={{ uri: avatarUri }} style={styles.avatar} />
                                            </View>
                                            <Text style={styles.userName}>{userName}</Text>
                                            <Text style={styles.statusText}>Đối phương đã tắt camera</Text>
                                        </View>
                                    </View>
                                )}

                                {/* Local preview: remote on -> PiP; remote off/connecting -> full */}
                                {!isVideoOff && (
                                    <>
                                        {showLocalFull ? (
                                            <View style={StyleSheet.absoluteFill} pointerEvents="none" collapsable={false}>
                                                <LocalPreviewView
                                                    key={`local-full-${previewTick}`}
                                                    canvas={{ uid: 0, renderMode: renderModeCover() }}
                                                    style={StyleSheet.absoluteFill}
                                                />
                                            </View>
                                        ) : (
                                            <View style={styles.localVideoContainer}>
                                                {LocalPreviewView ? (
                                                    <LocalPreviewView
                                                        key={`local-pip-${previewTick}`}
                                                        canvas={{ uid: 0, renderMode: renderModeCover() }}
                                                        style={styles.localVideo}
                                                        {...(Platform.OS === "ios"
                                                            ? { zOrderMediaOverlay: true }
                                                            : {})}
                                                    />
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
                                    </>
                                )}
                            </>
                        ) : (
                            <>
                                {/* Nền xanh luôn có để không lộ chat phía dưới khi preview chưa vẽ */}
                                <View style={[StyleSheet.absoluteFill, { backgroundColor: BLUE }]} />
                                {!isVideoOff && AgoraEngine && engine ? (
                                    <View
                                        style={StyleSheet.absoluteFill}
                                        pointerEvents="none"
                                        collapsable={false}
                                    >
                                        <LocalPreviewView
                                            key={`local-preview-${previewTick}`}
                                            canvas={{ uid: 0, renderMode: renderModeCover() }}
                                            style={StyleSheet.absoluteFill}
                                        />
                                        <View style={styles.connectingHintWrap} pointerEvents="none">
                                            <Text style={styles.connectingHintText}>Đang kết nối…</Text>
                                            <Text style={styles.connectingHintSub}>Đang mở camera…</Text>
                                        </View>
                                    </View>
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
                            </>
                        )}
                    </View>
                ) : isGroupCall ? (
                    /* VOICE GROUP CALL MODE */
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: "#0d0d1a" }]} pointerEvents="box-none">
                        <View style={styles.voiceContent}>
                            <View style={styles.avatarSection}>
                                {remoteUids.length === 0 && (
                                    <Animated.View style={[styles.ring, { transform: [{ scale: pulseAnim }], opacity: opacityAnim }]} />
                                )}
                                <Image source={{ uri: avatarUri }} style={styles.avatar} />
                            </View>
                            <Text style={styles.userName}>{userName}</Text>
                            <Text style={styles.statusText}>
                                {remoteUids.length > 0
                                    ? `${remoteUids.length + 1} người tham gia • ${fmt(duration)}`
                                    : "Đang đổ chuông…"}
                            </Text>
                        </View>
                    </View>
                ) : (
                    /* VOICE MODE (1-1) */
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: BLUE }]} pointerEvents="box-none">
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

                {/* box-none: PiP vẫn nhận touch; header/footer bọc riêng auto + width 100% để không miss vào layer video */}
                <View
                    style={[
                        styles.controlsOverlay,
                        {
                            paddingTop: insets.top,
                            paddingBottom: Math.max(insets.bottom, 8),
                            paddingLeft: insets.left,
                            paddingRight: insets.right,
                        },
                    ]}
                    pointerEvents="box-none"
                >
                    {/* Header */}
                    <View style={styles.headerChrome} pointerEvents="auto">
                        <View style={styles.header}>
                            <TouchableOpacity
                                onPress={handleEndCall}
                                style={styles.headerBtn}
                                hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                                activeOpacity={0.65}
                            >
                                <Ionicons name="chevron-back" size={28} color="#fff" />
                            </TouchableOpacity>
                            <Text style={styles.headerTitle}>MiniZalo</Text>
                            {isVideo ? (
                                <TouchableOpacity
                                    onPress={() => switchCamera()}
                                    style={styles.headerBtn}
                                    hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                                    activeOpacity={0.65}
                                >
                                    <Ionicons name="camera-reverse-outline" size={24} color="#fff" />
                                </TouchableOpacity>
                            ) : (
                                <View style={styles.headerBtn} />
                            )}
                        </View>
                    </View>

                    {/* Timer badge for video connected */}
                    {isVideo && isConnected && (
                        <View style={styles.timerBadge} pointerEvents="auto">
                            <Text style={styles.timerText}>{fmt(duration)}</Text>
                        </View>
                    )}

                    {/* Bottom actions */}
                    <View
                        style={[styles.footer, { bottom: Math.max(insets.bottom, 8) + 56 }]}
                        pointerEvents="auto"
                    >
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
                                        label="Loa ngoài"
                                        active={isSpeakerOn}
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
                </View>
            </View>
        </View>
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
    rootOverlay: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        // zIndex/elevation đủ cao để đè lên mọi screen đang render trong Stack.
        zIndex: 99999,
        elevation: Platform.OS === "android" ? 99999 : undefined,
    },
    container: { flex: 1, backgroundColor: BLUE },
    controlsOverlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 999,
        elevation: Platform.OS === "android" ? 999 : undefined,
    },

    headerChrome: {
        width: "100%",
        zIndex: 10000,
        elevation: Platform.OS === "android" ? 24 : undefined,
    },
    header: {
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 12,
        minHeight: 48,
    },
    headerBtn: {
        minWidth: 48,
        minHeight: 48,
        justifyContent: "center",
        alignItems: "center",
    },
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

    footer: {
        position: "absolute",
        left: 0,
        right: 0,
        paddingHorizontal: 40,
        width: "100%",
        zIndex: 10000,
        elevation: Platform.OS === "android" ? 24 : undefined,
    },
    actionRow: { flexDirection: "row", justifyContent: "space-around", alignItems: "flex-end" },
    actionItem: { alignItems: "center", gap: 4 },
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
    tileAvatarFallback: {
        ...StyleSheet.absoluteFillObject,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#1a1a2e",
    },
    tileAvatarCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: "rgba(255,255,255,0.12)",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 8,
    },
    tileAvatarLabel: {
        color: "rgba(255,255,255,0.7)",
        fontSize: 12,
    },
    connectingHintWrap: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 28,
        paddingTop: 72,
        paddingBottom: 200,
    },
    connectingHintText: {
        color: "#fff",
        fontSize: 17,
        fontWeight: "600",
        textAlign: "center",
        textShadowColor: "rgba(0,0,0,0.75)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    connectingHintSub: {
        color: "rgba(255,255,255,0.85)",
        fontSize: 14,
        marginTop: 6,
        textAlign: "center",
        textShadowColor: "rgba(0,0,0,0.6)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
});
