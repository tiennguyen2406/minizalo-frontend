import React, { useState, useEffect } from 'react';
import { Avatar } from 'zmp-ui';
import AgoraRTC, { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack, IAgoraRTCRemoteUser } from 'agora-rtc-sdk-ng';
import { useCallStore } from '@/shared/store/useCallStore';
import { useAuthStore } from '@/shared/store/authStore';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';
import { CallType } from '@/shared/services/callService';

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
    const { activeCall, callStatus, resetCall, endCall } = useCallStore();
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
    const [remoteUser, setRemoteUser] = useState<IAgoraRTCRemoteUser | null>(null);

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
            console.log('[WebAgora] Initializing for call:', activeCall.callSessionId);
            initializedRef.current = true;
            
            const rtcClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
            setClient(rtcClient);
            clientRef.current = rtcClient;

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
                await rtcClient.subscribe(remUser, mediaType);
                if (mediaType === 'video') {
                    setRemoteUser(remUser);
                    remUser.videoTrack?.play('remote-video-container');
                }
                if (mediaType === 'audio') {
                    remUser.audioTrack?.play();
                    setRemoteUser((prev) => prev || remUser);
                }
                cancelRemoteGoneTimer();
            });

            rtcClient.on('user-unpublished', (remUser, mediaType) => {
                if (mediaType === 'video') {
                    setRemoteUser((prev) => prev?.uid === remUser.uid ? null : prev);
                }
            });

            rtcClient.on('user-left', () => {
                setRemoteUser(null);
                scheduleEndIfRemoteGone();
            });

            try {
                // IMPORTANT: Backend uses buildTokenWithUserAccount (String),
                // so we MUST join using the User UUID String, not a number.
                const userUid = user?.id || 'anonymous';
                console.log('[WebAgora] Joining with User Account (String):', userUid);

                await rtcClient.join(
                    activeCall.appId, 
                    activeCall.channelName, 
                    activeCall.token, 
                    userUid
                );
                
                // Create local tracks
                const audio = await AgoraRTC.createMicrophoneAudioTrack();
                setLocalAudioTrack(audio);
                audioTrackRef.current = audio;

                if (finalCallType === 'VIDEO') {
                    try {
                        const video = await AgoraRTC.createCameraVideoTrack();
                        setLocalVideoTrack(video);
                        videoTrackRef.current = video;
                        await rtcClient.publish([audio, video]);
                        video.play('local-video-pip');
                    } catch (camErr) {
                        console.warn('[WebAgora] Camera unavailable, continuing audio-only:', camErr);
                        await rtcClient.publish([audio]);
                    }
                } else {
                    await rtcClient.publish([audio]);
                }

                // Subscribe to already-published remote tracks (fix case remote published before we joined)
                setTimeout(async () => {
                    try {
                        for (const ru of rtcClient.remoteUsers) {
                            if ((ru as any).hasAudio) {
                                await rtcClient.subscribe(ru, 'audio');
                                ru.audioTrack?.play();
                                setRemoteUser((prev) => prev || ru);
                            }
                            if ((ru as any).hasVideo) {
                                await rtcClient.subscribe(ru, 'video');
                                setRemoteUser(ru);
                                ru.videoTrack?.play('remote-video-container');
                            }
                        }
                    } catch (e) {
                        console.warn('[WebAgora] subscribe existing remote tracks failed', e);
                    }
                }, 250);
            } catch (err) {
                console.error('[WebAgora] Join failed', err);
            }
        };

        init();

        return () => {
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
        console.log('[WebAgora] Cleaning up tracks and leaving...');
        
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
        setRemoteUser(null);
        initializedRef.current = false;
    };

    // Ensure remote video starts playing even if DOM isn't ready at the exact publish moment.
    useEffect(() => {
        if (finalCallType !== 'VIDEO') return;
        if (!remoteUser?.videoTrack) return;

        const tryPlay = (attempt: number) => {
            const el = document.getElementById('remote-video-container');
            if (el) {
                remoteUser.videoTrack?.play('remote-video-container');
                return;
            }
            if (attempt >= 5) return;
            remotePlayRetryRef.current = window.setTimeout(() => tryPlay(attempt + 1), 150);
        };

        tryPlay(0);
        return () => {
            if (remotePlayRetryRef.current) {
                window.clearTimeout(remotePlayRetryRef.current);
                remotePlayRetryRef.current = null;
            }
        };
    }, [finalCallType, remoteUser?.uid, !!remoteUser?.videoTrack]);

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
    const isConnectedForTimer = callStatus === 'connected' || !!remoteUser;
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

    const handleEndCall = async () => {
        if (activeCall) {
            await endCall(activeCall.callSessionId);
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
                video.play('local-video-pip');
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

    const isConnected = callStatus === 'connected' || !!remoteUser;
    const isWaiting = !isConnected;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center transition-all">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-md"
                onClick={(e) => {
                    if (e.target === e.currentTarget) handleEndCall();
                }}
            />

            {/* Modal Content */}
            <div 
                className={`relative ${finalCallType === 'VIDEO' ? 'bg-zinc-900 w-[1000px] h-[700px]' : 'w-[400px] h-[580px]'} rounded-3xl shadow-2xl flex flex-col items-center overflow-hidden border border-white/10 transition-all duration-500`}
                style={finalCallType === 'VOICE' ? { background: 'linear-gradient(180deg, #0068FF 0%, #004BBB 100%)' } : undefined}
            >
                {/* --- VIDEO LAYER (WEB) --- */}
                {finalCallType === 'VIDEO' && (
                    <div className="absolute inset-0 bg-black">
                        {/* Remote Video Container */}
                        <div id="remote-video-container" className="w-full h-full" />

                        {/* Local Video PIP */}
                        <div 
                            id="local-video-pip" 
                            className={`absolute top-6 right-6 w-48 h-64 rounded-2xl border-2 border-white/20 shadow-2xl overflow-hidden bg-zinc-800 z-10 transition-opacity ${isVideoOff ? 'opacity-0' : 'opacity-100'}`}
                        />
                    </div>
                )}

                {/* --- UI OVERLAY --- */}
                <div className="relative z-20 w-full h-full flex flex-col items-center">
                    {/* Header */}
                    <div className="mt-12 text-center bg-black/20 backdrop-blur-sm px-6 py-2 rounded-full">
                        <p className="text-white/60 text-[10px] uppercase tracking-[0.2em] font-medium">
                            {isConnected ? `Cuộc gọi ${finalCallType === 'VIDEO' ? 'Video' : 'Thoại'}` : 'Đang kết nối...'}
                        </p>
                        {isConnected && (
                            <p className="text-white text-xl font-semibold tabular-nums">
                                {formatDuration(duration)}
                            </p>
                        )}
                    </div>

                    {/* Profile (Only for VOICE or when waiting for remote video) */}
                    {(finalCallType === 'VOICE' || (finalCallType === 'VIDEO' && !remoteUser)) && (
                        <div className="flex-1 flex flex-col items-center justify-center w-full px-8">
                            <div className="relative mb-6">
                                {isWaiting && (
                                    <div className="absolute inset-0 -m-4 border-4 border-blue-500/20 rounded-full animate-ping" />
                                )}
                                <div className="relative z-10">
                                    <Avatar 
                                        src={finalAvatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(finalUserName)}&background=0068FF&color=fff&size=128`} 
                                        size={128}
                                        className="w-32 h-32 ring-4 ring-white/10 shadow-2xl"
                                    />
                                </div>
                            </div>
                            <h2 className="text-white text-2xl font-bold truncate max-w-full mb-2">{finalUserName}</h2>
                            <p className="text-white/40 text-sm">{isWaiting ? 'Đang chờ đối phương...' : ''}</p>
                        </div>
                    )}
                    
                    {/* Spacer for Video call to push actions to bottom */}
                    {finalCallType === 'VIDEO' && remoteUser && <div className="flex-1" />}

                    {/* Actions */}
                    <div className="w-full pb-14 px-10 flex flex-col items-center">
                        <div className="flex items-center justify-center gap-12 w-full max-w-md bg-black/40 backdrop-blur-md p-6 rounded-3xl border border-white/5">
                            {/* Mic Button */}
                            <button
                                onClick={toggleMute}
                                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 ${
                                    isMuted ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
                                }`}
                            >
                                {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                            </button>

                            {/* End Call Button */}
                            <button
                                onClick={handleEndCall}
                                className="w-16 h-16 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 shadow-xl shadow-red-900/40"
                            >
                                <PhoneOff size={32} />
                            </button>

                            {/* Video Toggle (Only for VIDEO type) */}
                            {finalCallType === 'VIDEO' && (
                                <button
                                    onClick={toggleVideo}
                                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 ${
                                        isVideoOff ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
                                    }`}
                                >
                                    {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CallModal;
