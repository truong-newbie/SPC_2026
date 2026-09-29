/**
 * SPC_2026 Web Audio API Synthesizer
 * Generates pure harmonic notification chimes (0 bytes MP3, 100% offline, zero latency)
 */

class SoundManager {
    private ctx: AudioContext | null = null;
    private soundEnabled: boolean = true;

    constructor() {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('filebridge_sound_enabled');
            this.soundEnabled = saved !== 'false';
        }
    }

    private getContext(): AudioContext | null {
        if (typeof window === 'undefined') return null;
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioCtx) {
                this.ctx = new AudioCtx();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
        return this.ctx;
    }

    public isEnabled(): boolean {
        return this.soundEnabled;
    }

    public toggleSound(): boolean {
        this.soundEnabled = !this.soundEnabled;
        if (typeof window !== 'undefined') {
            localStorage.setItem('filebridge_sound_enabled', String(this.soundEnabled));
        }
        if (this.soundEnabled) {
            this.playSuccess();
        }
        return this.soundEnabled;
    }

    /**
     * Play an elegant, modern success chime:
     * High harmonic major arpeggio (C5 -> E5 -> G5 -> C6) with soft exponential decay
     */
    public playSuccess(): void {
        if (!this.soundEnabled) return;
        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            const chords = [
                { freq: 523.25, time: 0.00, dur: 0.35, gain: 0.12 }, // C5
                { freq: 659.25, time: 0.07, dur: 0.40, gain: 0.14 }, // E5
                { freq: 783.99, time: 0.14, dur: 0.50, gain: 0.16 }, // G5
                { freq: 1046.50, time: 0.22, dur: 0.75, gain: 0.18 }, // C6
            ];

            chords.forEach(({ freq, time, dur, gain }) => {
                const osc = ctx.createOscillator();
                const gainNode = ctx.createGain();

                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + time);

                // Smooth bell-like envelope
                gainNode.gain.setValueAtTime(0.0001, now + time);
                gainNode.gain.exponentialRampToValueAtTime(gain, now + time + 0.02);
                gainNode.gain.exponentialRampToValueAtTime(0.00001, now + time + dur);

                osc.connect(gainNode);
                gainNode.connect(ctx.destination);

                osc.start(now + time);
                osc.stop(now + time + dur);
            });
        } catch {
            // Silently ignore if browser audio autoplay policy restricts
        }
    }
}

export const soundManager = new SoundManager();
