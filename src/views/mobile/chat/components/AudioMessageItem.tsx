import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useThemeColors } from '@/shared/theme/colors';

interface AudioMessageItemProps {
    url: string;
    isMe: boolean;
}

export default function AudioMessageItem({ url, isMe }: AudioMessageItemProps) {
    const colors = useThemeColors();
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [durationMillis, setDurationMillis] = useState<number>(0);
    const [positionMillis, setPositionMillis] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    
    // Waveform dummy lines
    const waveformLines = useRef(Array.from({ length: 20 }).map(() => Math.max(0.3, Math.random()))).current;

    const loadSound = async () => {
        setIsLoading(true);
        setLoadError(false);
        try {
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
                playThroughEarpieceAndroid: false,
                shouldDuckAndroid: true,
            });
            
            if (sound) {
                await sound.unloadAsync();
            }

            const { sound: newSound } = await Audio.Sound.createAsync(
                { uri: url },
                { shouldPlay: false },
                (status) => {
                    if (status.isLoaded) {
                        setDurationMillis(status.durationMillis || 0);
                        setPositionMillis(status.positionMillis || 0);
                        setIsPlaying(status.isPlaying);
                        if (status.didJustFinish) {
                            setIsPlaying(false);
                            setPositionMillis(0);
                            newSound.setPositionAsync(0);
                        }
                    } else if (status.error) {
                        console.error(`Error loading sound: ${status.error}`);
                        setLoadError(true);
                    }
                }
            );

            setSound(newSound);
            setIsLoading(false);
        } catch (err) {
            console.error("Failed to load audio from URL:", url, err);
            setLoadError(true);
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadSound();
        return () => {
            if (sound) {
                sound.unloadAsync();
            }
        };
    }, [url]);

    const handlePlayPause = async () => {
        if (!sound) {
            if (loadError) loadSound();
            return;
        }
        try {
            if (isPlaying) {
                await sound.pauseAsync();
            } else {
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: false,
                    playsInSilentModeIOS: true,
                    playThroughEarpieceAndroid: false,
                });
                if (positionMillis >= durationMillis && durationMillis > 0) {
                    await sound.setPositionAsync(0);
                }
                await sound.playAsync();
            }
        } catch (err) {
            console.error("Playback error:", err);
        }
    };

    const formatTime = (millis: number) => {
        const totalSeconds = Math.floor(millis / 1000);
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const progressPercent = durationMillis > 0 ? positionMillis / durationMillis : 0;
    const highlightedBarsCount = Math.floor(progressPercent * waveformLines.length);

    return (
        <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: isMe ? colors.primary + '20' : '#e5e5ea50',
            padding: 10,
            borderRadius: 16,
            minWidth: 220,
        }}>
            <TouchableOpacity 
                onPress={handlePlayPause} 
                disabled={isLoading}
                style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: isMe ? colors.primary : '#fff',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 10,
                    elevation: 1,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.1,
                    shadowRadius: 2,
                }}
            >
                {isLoading ? (
                    <ActivityIndicator size="small" color={isMe ? "#fff" : colors.primary} />
                ) : loadError ? (
                    <Ionicons name="alert-circle" size={24} color={isMe ? "#fff" : "#ff3b30"} />
                ) : (
                    <Ionicons name={isPlaying ? "pause" : "play"} size={22} color={isMe ? "#fff" : colors.primary} style={!isPlaying ? { marginLeft: 2 } : {}} />
                )}
            </TouchableOpacity>

            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', height: 24, paddingBottom: 4 }}>
                {waveformLines.map((height, index) => (
                    <View
                        key={index}
                        style={{
                            width: 3,
                            height: `${height * 100}%`,
                            maxHeight: 20,
                            backgroundColor: index < highlightedBarsCount ? colors.primary : (isMe ? colors.primary + '40' : '#ccc'),
                            marginHorizontal: 1,
                            borderRadius: 1.5,
                        }}
                    />
                ))}
            </View>

            <Text style={{
                marginLeft: 10,
                fontSize: 12,
                color: isMe ? colors.text : colors.textSecondary,
                fontFamily: 'System',
                minWidth: 40,
            }}>
                {formatTime(isPlaying || positionMillis > 0 ? positionMillis : durationMillis)}
            </Text>
        </View>
    );
}
