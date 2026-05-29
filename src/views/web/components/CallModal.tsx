import React, { useState, useEffect } from 'react';
import { Avatar } from 'zmp-ui';
import AgoraRTC, { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack, IAgoraRTCRemoteUser } from 'agora-rtc-sdk-ng';
import { useCallStore } from '@/shared/store/useCallStore';
import { useAuthStore } from '@/shared/store/authStore';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';
import { CallType } from '@/shared/services/callService';

/** Remote: contain để giữ tỉ lệ (mobile dọc → pillarbox); phần thừa do container bg-[#0068FF] */
const WEB_REMOTE_VIDEO_OPTS = { fit: 'contain' as const };
const WEB_LOCAL_PIP_OPTS = { fit: 'cover' as const };

interface CallModalProps {
    isOpen: boolean;
    callType?: CallType;
    userName?: string;
    avatarUrl?: string;
    onEnd?: () => void;
}

const CallModal: React.FC<CallModalProps> = ({
    isOpen,
    callType,
    userName,
    avatarUrl,
    onEnd,
}) => {
    const { activeCall, callStatus, resetCall, endCall, cancelCall, leaveGroupCall, endGroupCall } = useCallStore();
    const user = useAuthStore(state => state.user);
    const accessToken = useAuthStore(state => state.accessToken);

    // Use props or fallback to store data
    const finalCallType = callType || activeCall?.callType || 'VOICE';
    const finalUserName = userName || activeCall?.partnerName || 'Đang kết nối...';
    const finalAvatarUrl = avatarUrl || activeCall?.partnerAvatar;
    const finalOnEnd = onEnd || resetCall;

    const [client, setClient] = useState<IAgoraRTCClient | null>(null);
    const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
    const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
    const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([]);

    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [duration, setDuration] = useState(0);

    // Refs for cleanup & state management
    const clientRef = React.useRef<IAgoraRTCClient | null>(null);
    const audioTrackRef = React.useRef<IMicrophoneAudioTrack | null>(null);
    const videoTrackRef = React.useRef<ICameraVideoTrack | null>(null);
    const initializedRef = React.useRef(false);
    const remoteGoneRetryRef = React.useRef<number | null>(null);
    const remoteGoneAttemptsRef = React.useRef(0);
    const remotePlayRetryRef = React.useRef<number | null>(null);
    const webPointerResumeRef = React.useRef<(() => void) | null>(null);
    const webAutoplayFailedPrevRef = React.useRef<
        typeof AgoraRTC.onAutoplayFailed | undefined | null
    >(undefined);

    /**
     * Stable hash function to convert UUID string to a number for Agora UID
     */
    const hashStringToInt32 = (str: string): number => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0; // Convert to 32bit int
        }
        return Math.abs(hash);
    };

    // Agora Init
    useEffect(() => {
        if (!isOpen || !activeCall || initializedRef.current) return;

        const init = async () => {

            initializedRef.current = true;
            
            const rtcClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
            setClient(rtcClient);
            clientRef.current = rtcClient;

            const playAllRemoteAudio = () => {
                for (const ru of rtcClient.remoteUsers) {
                    try {
                        ru.audioTrack?.play();
                    } catch {
                        /* autoplay / transient */
                    }
                }
            };

            webAutoplayFailedPrevRef.current = AgoraRTC.onAutoplayFailed ?? null;
            const resumeRemoteAudio = () => playAllRemoteAudio();
            webPointerResumeRef.current = resumeRemoteAudio;

            AgoraRTC.onAutoplayFailed = () => {
                console.warn('[WebAgora] Autoplay blocked — tap/chạm màn hình một lần để nghe âm thanh');
                playAllRemoteAudio();
                const prev = webAutoplayFailedPrevRef.current;
                if (typeof prev === 'function') prev();
            };

            window.addEventListener('pointerdown', resumeRemoteAudio, { passive: true });

            const cancelRemoteGoneTimer = () => {
                if (remoteGoneRetryRef.current) {
                    window.clearTimeout(remoteGoneRetryRef.current);
                    remoteGoneRetryRef.current = null;
                }
                remoteGoneAttemptsRef.current = 0;
            };

            const scheduleEndIfRemoteGone = () => {
                cancelRemoteGoneTimer();
                const tick = async () => {
                    // If remote came back, stop
                    if (rtcClient.remoteUsers?.length) return;

                    remoteGoneAttemptsRef.current += 1;
                    if (remoteGoneAttemptsRef.current <= 2) {
                        remoteGoneRetryRef.current = window.setTimeout(tick, 2000);
                        return;
                    }

                    console.warn('[WebAgora] Remote still gone after retries → ending call');
                    try {
                        if (activeCall?.callSessionId) {
                            await endCall(activeCall.callSessionId);
                        }
                    } catch {
                        // ignore
                    }
                    await stopAndCloseTracks();
                    finalOnEnd();
                };

                remoteGoneRetryRef.current = window.setTimeout(tick, 2000);
            };

            rtcClient.on('user-published', async (remUser, mediaType) => {
                // Wrap try/catch: 1 user subscribe fail không được kéo cả handler chết (Edge nhạy hơn Chrome).
                try {
                    await rtcClient.subscribe(remUser, mediaType);
                } catch (e) {
                    console.warn('[WebAgora] subscribe failed for uid', remUser.uid, mediaType, e);
                    return;
                }
                if (mediaType === 'video') {
                    setRemoteUsers([...rtcClient.remoteUsers]);
                    // 1-1: play ngay vì container đã tồn tại sẵn
                    // Group: KHÔNG play ngay vì div chưa mount — useEffect sẽ retry sau khi React render
                    if (!activeCall?.isGroupCall) {
                        remUser.videoTrack?.play('remote-video-container', WEB_REMOTE_VIDEO_OPTS);
                    }
                }
                if (mediaType === 'audio') {
                    remUser.audioTrack?.play();
                    setRemoteUsers([...rtcClient.remoteUsers]);
                }
                cancelRemoteGoneTimer();
            });

            rtcClient.on('user-unpublished', (remUser, mediaType) => {
                if (mediaType === 'video') {
                    setRemoteUsers([...rtcClient.remoteUsers]);
                }
            });

            // Group VOICE call bug: Agora đôi khi auto-subscribe audio mà KHÔNG fire `user-published`
            // đúng flow (hoặc fire trước khi handler mount). Khi đó `setRemoteUsers` ở handler
            // `user-published` không chạy → UI stuck "Đang kết nối" dù nghe được nhau.
            // `user-joined` fire ngay khi peer vào channel (trước cả lúc họ publish) → đảm bảo state
            // `remoteUsers` populate để `isConnected` flip đúng.
            rtcClient.on('user-joined', () => {
                setRemoteUsers([...rtcClient.remoteUsers]);
            });

            rtcClient.on('user-left', () => {
                setRemoteUsers([...rtcClient.remoteUsers]);
                scheduleEndIfRemoteGone();
            });

            try {
                const userUid = user?.id || 'anonymous';


                // TẠO TRACK TRƯỚC để camera người gọi bật/hiển thị ngay, không chờ bên kia bắt máy.
                const audio = await AgoraRTC.createMicrophoneAudioTrack({
                    AEC: true,
                    AGC: true,
                    ANS: true,
                });
                setLocalAudioTrack(audio);
                audioTrackRef.current = audio;

                const startWithCamera = activeCall.startWithCamera ?? true;
                let video: ICameraVideoTrack | null = null;
                if (finalCallType === 'VIDEO' && startWithCamera) {
                    try {
                        video = await AgoraRTC.createCameraVideoTrack();
                        setLocalVideoTrack(video);
                        videoTrackRef.current = video;
                        // Play preview NGAY (trước cả join)
                        requestAnimationFrame(() => {
                            video?.play('local-video-pip', WEB_LOCAL_PIP_OPTS);
                        });
                    } catch (camErr) {
                        console.warn('[WebAgora] Camera unavailable, continuing audio-only:', camErr);
                    }
                }
                if (finalCallType === 'VIDEO' && !startWithCamera) {
                    setIsVideoOff(true);
                }

                await rtcClient.join(
                    activeCall.appId,
                    activeCall.channelName,
                    activeCall.token,
                    userUid
                );

                if (video) {
                    await rtcClient.publish([audio, video]);
                } else {
                    await rtcClient.publish([audio]);
                }

                // GROUP CALL: join xong Agora channel = đã "connected" ở phía mình.
                // Group call KHÔNG có khái niệm "đang đổ chuông chờ nhấc máy" như 1-1 — ngay khi
                // host khởi tạo là họ đã ở trong channel. Không dựa vào WS PARTICIPANT_JOINED
                // vì có trường hợp delivery delay hoặc host là người đầu tiên → UI stuck "Đang kết nối".
                // 1-1 giữ nguyên logic: callStatus flip qua WS event 'ACCEPTED'.
                if (activeCall.isGroupCall) {
                    useCallStore.getState().setCallStatus('connected');
                }

                // Subscribe to already-published remote tracks (fix case remote published before we joined).
                // LƯU Ý: 3 bước — render container TRƯỚC, subscribe ĐỘC LẬP từng user (Promise.allSettled),
                // rồi update state lần 2 để trigger useEffect replay.
                // Trước đây dùng `for...of await`: 1 user fail (Edge ↔ Mobile chậm hơn) → break loop →
                // setRemoteUsers không chạy → React state thiếu user đó → container không render → play() fail mãi
                // → gây bug "Edge không thấy camera user thứ 2, chỉ thấy khi có user thứ 3 join".
                setTimeout(async () => {
                    // Bước 1: Render container tất cả remote users NGAY.
                    setRemoteUsers([...rtcClient.remoteUsers]);

                    // Bước 2: Subscribe song song, 1 fail không ảnh hưởng user khác.
                    await Promise.allSettled(
                        rtcClient.remoteUsers.map(async (ru) => {
                            try {
                                if ((ru as any).hasAudio) {
                                    await rtcClient.subscribe(ru, 'audio');
                                    ru.audioTrack?.play();
                                }
                                if ((ru as any).hasVideo) {
                                    await rtcClient.subscribe(ru, 'video');
                                    if (!activeCall?.isGroupCall) {
                                        ru.videoTrack?.play('remote-video-container', WEB_REMOTE_VIDEO_OPTS);
                                    }
                                }
                            } catch (e) {
                                console.warn('[WebAgora] subscribe existing failed for uid', ru.uid, e);
                            }
                        }),
                    );

                    // Bước 3: Trigger useEffect chạy lại với tham chiếu mới → videoTrack giờ đã sẵn sàng.
                    setRemoteUsers([...rtcClient.remoteUsers]);
                }, 250);
            } catch (err) {
                console.error('[WebAgora] Join failed', err);
            }
        };

        init();

        return () => {
            AgoraRTC.onAutoplayFailed = webAutoplayFailedPrevRef.current ?? undefined;
            webAutoplayFailedPrevRef.current = undefined;
            if (webPointerResumeRef.current) {
                window.removeEventListener('pointerdown', webPointerResumeRef.current);
                webPointerResumeRef.current = null;
            }
            if (remoteGoneRetryRef.current) {
                window.clearTimeout(remoteGoneRetryRef.current);
                remoteGoneRetryRef.current = null;
            }
            if (remotePlayRetryRef.current) {
                window.clearTimeout(remotePlayRetryRef.current);
                remotePlayRetryRef.current = null;
            }
            stopAndCloseTracks();
        };
    }, [isOpen, activeCall?.callSessionId]);

    const stopAndCloseTracks = async () => {

        
        if (audioTrackRef.current) {
            audioTrackRef.current.stop();
            audioTrackRef.current.close();
            audioTrackRef.current = null;
        }
        if (videoTrackRef.current) {
            videoTrackRef.current.stop();
            videoTrackRef.current.close();
            videoTrackRef.current = null;
        }
        if (clientRef.current) {
            await clientRef.current.leave();
            clientRef.current = null;
        }
        
        setLocalAudioTrack(null);
        setLocalVideoTrack(null);
        setRemoteUsers([]);
        initializedRef.current = false;
    };

    // Đồng bộ remote video vào đúng container mỗi khi remoteUsers thay đổi (join/leave/publish video sau audio).
    // Quan trọng: depend vào `remoteUsers` (reference) chứ không phải `remoteUsers.length` — nếu không, trường hợp
    // user publish audio trước rồi publish video sau (cùng một remoteUser), length không đổi → effect không chạy → video không play.
    useEffect(() => {
        if (finalCallType !== 'VIDEO') return;
        const rtcClient = clientRef.current;
        if (!rtcClient) return;
        const isGroup = !!activeCall?.isGroupCall;

        if (remotePlayRetryRef.current) {
            window.clearTimeout(remotePlayRetryRef.current);
            remotePlayRetryRef.current = null;
        }

        const tryPlayAll = (attempt: number) => {
            if (!isGroup) {
                const el = document.getElementById('remote-video-container');
                const ru = rtcClient.remoteUsers?.[0];
                if (el && ru?.videoTrack) {
                    ru.videoTrack.play('remote-video-container', WEB_REMOTE_VIDEO_OPTS);
                    return;
                }
                if (attempt < 10) {
                    remotePlayRetryRef.current = window.setTimeout(() => tryPlayAll(attempt + 1), 120);
                }
                return;
            }
            // Group: cho mỗi remote user → nếu có videoTrack VÀ container đã mount → play
            let pending = false;
            for (const ru of rtcClient.remoteUsers) {
                const containerId = `remote-video-${ru.uid}`;
                const el = document.getElementById(containerId);
                if (!el) {
                    pending = true;
                    continue;
                }
                if (ru.videoTrack) {
                    // Agora SDK: play() là idempotent — nếu đã bind vào container này thì no-op.
                    // Nếu trước đó bị bind container khác hoặc chưa bind → tự gắn vào container đúng.
                    try {
                        ru.videoTrack.play(containerId, WEB_REMOTE_VIDEO_OPTS);
                    } catch (e) {
                        console.warn('[WebAgora] play remote video failed', e);
                    }
                } else {
                    // Track chưa subscribe xong (audio published trước, video đến sau) → chờ lần effect sau
                    pending = true;
                }
            }
            // Edge đôi khi commit DOM hoặc resolve videoTrack chậm hơn Chrome → nới retry để an toàn.
            if (pending && attempt < 30) {
                remotePlayRetryRef.current = window.setTimeout(() => tryPlayAll(attempt + 1), 200);
            }
        };

        // Delay 1 frame để React commit DOM mới
        const rafId = window.requestAnimationFrame(() => tryPlayAll(0));

        return () => {
            window.cancelAnimationFrame(rafId);
            if (remotePlayRetryRef.current) {
                window.clearTimeout(remotePlayRetryRef.current);
                remotePlayRetryRef.current = null;
            }
        };
    }, [finalCallType, activeCall?.isGroupCall, remoteUsers]);

    // Re-attach local preview khi DOM mount xong (fix: preview trắng đen vì track tạo trước element).
    useEffect(() => {
        if (finalCallType !== 'VIDEO') return;
        if (!localVideoTrack) return;
        let tries = 0;
        const retry = () => {
            const el = document.getElementById('local-video-pip');
            if (el) {
                try { localVideoTrack.play('local-video-pip', WEB_LOCAL_PIP_OPTS); } catch { /* */ }
                return;
            }
            if (tries++ < 8) window.setTimeout(retry, 120);
        };
        retry();
    }, [finalCallType, localVideoTrack]);

    // NOTE: không auto-end ngay khi reload/tab close.
    // Bên còn lại sẽ tự kết thúc sau 1–2 lần retry nếu remote rời kênh (event user-left).

    // When the other side ends/cancels and callStatus becomes 'idle',
    // clean up Agora and close the modal
    useEffect(() => {
        if (callStatus === 'idle' && initializedRef.current) {
            stopAndCloseTracks();
        }
    }, [callStatus]);

    // Timer logic
    const isConnectedForTimer = callStatus === 'connected' || remoteUsers.length > 0;
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isConnectedForTimer) {
            timer = setInterval(() => {
                setDuration((prev) => prev + 1);
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [isConnectedForTimer]);

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    // Thực thi leave (self only) cho group call
    const doLeaveGroup = async () => {
        if (!activeCall) return;
        await leaveGroupCall(activeCall.callSessionId).catch(() => {});
        await stopAndCloseTracks();
        finalOnEnd();
    };

    // Host giải tán group call cho tất cả
    const doEndGroupForAll = async () => {
        if (!activeCall) return;
        await endGroupCall(activeCall.callSessionId).catch(() => {});
        await stopAndCloseTracks();
        finalOnEnd();
    };

    const handleEndCall = async () => {
        // Group call: host có prompt chọn; non-host mặc định Thoát.
        if (activeCall?.isGroupCall) {
            const myId = String((user as any)?.id || '');
            const isHost = !!myId && myId === String(activeCall.hostId);
            if (isHost) {
                // eslint-disable-next-line no-alert
                const choice = window.confirm(
                    "Nhấn OK để KẾT THÚC cuộc gọi cho TẤT CẢ.\nNhấn Cancel để CHỈ THOÁT (cuộc gọi vẫn tiếp tục cho người khác).",
                );
                if (choice) await doEndGroupForAll();
                else await doLeaveGroup();
            } else {
                await doLeaveGroup();
            }
            return;
        }

        // 1-1 như cũ
        if (activeCall) {
            if (callStatus === 'calling') await cancelCall(activeCall.callSessionId);
            else await endCall(activeCall.callSessionId);
        }
        await stopAndCloseTracks();
        finalOnEnd();
    };

    const toggleMute = () => {
        const track = audioTrackRef.current;
        if (track) {
            track.setEnabled(isMuted);
            setIsMuted(!isMuted);
        }
    };

    const toggleVideo = async () => {
        if (finalCallType !== 'VIDEO') return;

        const rtcClient = clientRef.current;
        if (!rtcClient) return;

        const track = videoTrackRef.current;

        // If we don't have a local video track yet (camera failed earlier or user toggled on later),
        // create & publish on demand.
        if (!track && isVideoOff) {
            try {
                const video = await AgoraRTC.createCameraVideoTrack();
                setLocalVideoTrack(video);
                videoTrackRef.current = video;
                await rtcClient.publish([video]);
                video.play('local-video-pip', WEB_LOCAL_PIP_OPTS);
                setIsVideoOff(false);
            } catch (err) {
                console.warn('[WebAgora] Cannot enable camera:', err);
            }
            return;
        }

        if (track) {
            await track.setEnabled(isVideoOff);
            setIsVideoOff(!isVideoOff);
        }
    };

    const isConnected = callStatus === 'connected' || remoteUsers.length > 0;
    const isWaiting = !isConnected;

    if (!isOpen) return null;

    // Web grid — landscape-first, CSS grid thật + col-span cho tile lẻ cuối.
    //   1 → 1 ô full
    //   2 → [A][B]                  (2 cột × 1 hàng)
    //   3 → [A][B] / [C span 2]
    //   4 → 2×2
    //   5 → [A][B] / [C][D] / [E span 2]
    //   6+ → 3 cột × N hàng
    const groupTotal = remoteUsers.length;
    const groupCols = groupTotal <= 1 ? 1 : groupTotal <= 5 ? 2 : 3;
    const groupSpanIdx =
        groupTotal === 3 ? 2 : groupTotal === 5 ? 4 : -1; // index của tile span 2

    const videoStage = (
        <div className="relative flex min-h-0 flex-1 w-full flex-col bg-[#0068FF]">
            {activeCall?.isGroupCall ? (
                <div
                    className="relative grid min-h-0 flex-1 w-full gap-2 p-2 bg-[#0068FF]"
                    style={{
                        gridTemplateColumns: `repeat(${groupCols}, minmax(0, 1fr))`,
                        gridAutoRows: '1fr',
                    }}
                >
                    {remoteUsers.map((ru, idx) => (
                        <div
                            key={String(ru.uid)}
                            id={`remote-video-${ru.uid}`}
                            className="relative flex items-center justify-center overflow-hidden rounded-xl bg-black/25 [&_video]:h-full [&_video]:w-full [&_video]:object-contain"
                            style={idx === groupSpanIdx ? { gridColumn: 'span 2' } : undefined}
                        />
                    ))}
                    {remoteUsers.length === 0 ? (
                        <div
                            className="flex items-center justify-center text-white/70"
                            style={{ gridColumn: `span ${groupCols}` }}
                        >
                            Đang chờ người tham gia…
                        </div>
                    ) : null}
                </div>
            ) : (
                <div
                    id="remote-video-container"
                    className="relative flex min-h-0 flex-1 w-full items-center justify-center bg-[#0068FF] [&_video]:max-h-full [&_video]:max-w-full [&_video]:object-contain"
                />
            )}
            {!activeCall?.isGroupCall && remoteUsers.length === 0 && (
                <div className="pointer-events-none absolute inset-0 z-[5] flex flex-col items-center justify-center bg-[#0068FF]/55 px-6">
                    <div className="relative mb-5">
                        {isWaiting && (
                            <div className="absolute inset-0 -m-4 animate-ping rounded-full border-4 border-blue-400/25" />
                        )}
                        <Avatar
                            src={
                                finalAvatarUrl ||
                                `https://ui-avatars.com/api/?name=${encodeURIComponent(finalUserName)}&background=0068FF&color=fff&size=128`
                            }
                            size={128}
                            className="relative z-10 h-28 w-28 shadow-xl ring-4 ring-white/15 sm:h-32 sm:w-32"
                        />
                    </div>
                    <h2 className="max-w-full truncate text-center text-lg font-bold text-white sm:text-xl">{finalUserName}</h2>
                    <p className="mt-2 text-center text-sm text-white/60">{isWaiting ? 'Đang chờ đối phương…' : ''}</p>
                </div>
            )}
            <div
                id="local-video-pip"
                className={`absolute right-3 top-3 z-10 h-[min(28vh,220px)] w-[min(34vw,180px)] overflow-hidden rounded-xl border-2 border-white/25 bg-black/40 shadow-xl transition-opacity sm:right-5 sm:top-5 sm:h-[min(30vh,260px)] sm:w-[min(240px,22vw)] ${
                    isVideoOff ? 'pointer-events-none opacity-0' : 'opacity-100'
                }`}
            />
            <div className="pointer-events-none absolute left-0 right-0 top-3 z-20 flex justify-center px-4 pt-[env(safe-area-inset-top)]">
                <div className="pointer-events-auto rounded-full bg-black/45 px-5 py-2 text-center backdrop-blur-md">
                    <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/70">
                        {isConnected ? 'Cuộc gọi video' : 'Đang kết nối…'}
                    </p>
                    {isConnected && (
                        <p className="mt-0.5 text-lg font-semibold tabular-nums text-white">{formatDuration(duration)}</p>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[1000] h-[100dvh] max-h-[100dvh] w-full overflow-hidden bg-[#0068FF]">
            {finalCallType === 'VIDEO' ? (
                <>
                    {/* Video stage chiếm TOÀN màn hình; controls nổi floating ở đáy */}
                    <div className="absolute inset-0 flex flex-col">{videoStage}</div>

                    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                        <div className="pointer-events-auto flex items-end justify-center gap-10 rounded-full bg-black/45 px-8 py-3 shadow-xl backdrop-blur-md sm:gap-16">
                            <button
                                type="button"
                                onClick={toggleMute}
                                className={`flex flex-col items-center gap-1.5 ${isMuted ? 'text-white' : 'text-white/90'}`}
                            >
                                <span
                                    className={`flex h-14 w-14 items-center justify-center rounded-full transition-colors ${
                                        isMuted ? 'bg-red-500' : 'bg-white/15 hover:bg-white/25'
                                    }`}
                                >
                                    {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                                </span>
                                <span className="text-xs text-white/80">Mic</span>
                            </button>
                            <button type="button" onClick={handleEndCall} className="flex flex-col items-center gap-1.5 text-white">
                                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 shadow-lg shadow-red-900/50 transition-colors hover:bg-red-700 active:scale-95">
                                    <PhoneOff size={32} />
                                </span>
                                <span className="text-xs text-white/90">Kết thúc</span>
                            </button>
                            <button
                                type="button"
                                onClick={toggleVideo}
                                className={`flex flex-col items-center gap-1.5 ${isVideoOff ? 'text-white' : 'text-white/90'}`}
                            >
                                <span
                                    className={`flex h-14 w-14 items-center justify-center rounded-full transition-colors ${
                                        isVideoOff ? 'bg-red-500' : 'bg-white/15 hover:bg-white/25'
                                    }`}
                                >
                                    {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
                                </span>
                                <span className="text-xs text-white/80">Camera</span>
                            </button>
                        </div>
                    </div>
                </>
            ) : (
                <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-6">
                <div
                    className="relative flex h-[min(580px,85dvh)] w-[min(400px,calc(100vw-24px))] flex-col items-center overflow-hidden rounded-3xl border border-white/10 shadow-2xl"
                    style={{ background: 'linear-gradient(180deg, #0068FF 0%, #004BBB 100%)' }}
                >
                    <div className="mt-10 text-center">
                        <div className="rounded-full bg-black/20 px-6 py-2 backdrop-blur-sm">
                            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/70">
                                {isConnected ? 'Cuộc gọi thoại' : 'Đang kết nối…'}
                            </p>
                            {isConnected && (
                                <p className="mt-1 text-xl font-semibold tabular-nums text-white">{formatDuration(duration)}</p>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-1 flex-col items-center justify-center px-8">
                        <div className="relative mb-6">
                            {isWaiting && (
                                <div className="absolute inset-0 -m-4 animate-ping rounded-full border-4 border-blue-500/20" />
                            )}
                            <Avatar
                                src={
                                    finalAvatarUrl ||
                                    `https://ui-avatars.com/api/?name=${encodeURIComponent(finalUserName)}&background=0068FF&color=fff&size=128`
                                }
                                size={128}
                                className="relative z-10 h-32 w-32 ring-4 ring-white/10 shadow-2xl"
                            />
                        </div>
                        <h2 className="mb-2 max-w-full truncate text-center text-2xl font-bold text-white">{finalUserName}</h2>
                        <p className="text-sm text-white/40">{isWaiting ? 'Đang chờ đối phương...' : ''}</p>
                    </div>
                    <div className="w-full px-8 pb-10 pt-4">
                        <div className="mx-auto flex max-w-md items-center justify-center gap-12 rounded-3xl border border-white/10 bg-black/35 p-6 backdrop-blur-md">
                            <button
                                type="button"
                                onClick={toggleMute}
                                className={`flex h-14 w-14 items-center justify-center rounded-full transition-colors ${
                                    isMuted ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
                                }`}
                            >
                                {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                            </button>
                            <button
                                type="button"
                                onClick={handleEndCall}
                                className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-white shadow-xl shadow-red-900/40 transition-colors hover:bg-red-700 active:scale-95"
                            >
                                <PhoneOff size={32} />
                            </button>
                        </div>
                    </div>
                </div>
                </div>
            )}
        </div>
    );
};

export default CallModal;
