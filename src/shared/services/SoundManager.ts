import { Platform } from "react-native";

type SoundKey = "ringback" | "ringtone" | "beep";

const SOUND_PATHS: Record<SoundKey, string> = {
    ringback: "/sounds/ringbacktone.mp3",
    ringtone: "/sounds/ringtone.mp3",
    beep: "/sounds/beep.m4a",
};

class SoundManager {
    private instances: Map<SoundKey, HTMLAudioElement> = new Map();
    private activeKey: SoundKey | null = null;

    private getOrCreate(key: SoundKey): HTMLAudioElement | null {
        if (Platform.OS !== "web") return null;
        if (typeof Audio === "undefined") return null;

        let audio = this.instances.get(key);
        if (!audio) {
            audio = new Audio(SOUND_PATHS[key]);
            audio.preload = "auto";
            this.instances.set(key, audio);
        }
        return audio;
    }

    private playLoop(key: SoundKey) {
        if (this.activeKey === key) return;
        this.stopAll();

        const audio = this.getOrCreate(key);
        if (!audio) return;

        audio.loop = true;
        audio.currentTime = 0;
        audio.volume = 0.6;
        audio.play().catch(() => {});
        this.activeKey = key;
    }

    playRingback() {
        this.playLoop("ringback");
    }

    playRingtone() {
        this.playLoop("ringtone");
    }

    playBeep() {
        this.stopAll();

        const audio = this.getOrCreate("beep");
        if (!audio) return;

        audio.loop = false;
        audio.currentTime = 0;
        audio.volume = 0.8;
        audio.play().catch(() => {});
        this.activeKey = "beep";

        audio.onended = () => {
            if (this.activeKey === "beep") this.activeKey = null;
        };
    }

    stopAll() {
        this.instances.forEach((audio) => {
            audio.pause();
            audio.currentTime = 0;
            audio.onended = null;
        });
        this.activeKey = null;
    }

    destroy() {
        this.stopAll();
        this.instances.clear();
    }
}

export const soundManager = new SoundManager();
