"""Render original, deterministic chiptune loops. Requires NumPy only at authoring time."""
from pathlib import Path
import wave
import numpy as np

RATE = 22050
ROOT = Path(__file__).resolve().parents[1] / "public" / "assets"
# Each score uses its own harmony, melodic phrase, tempo and instrumentation.
SCORES = {
    "boss": dict(bpm=144, meter=4, roots=[45, 41, 48, 43], triad=[0, 3, 7],
                 motif=[12, 7, 12, 15, 14, 7, 10, 7], gain=.85),
    "bio": dict(bpm=100, meter=4, roots=[38, 34, 41, 33], triad=[0, 3, 7],
                motif=[12, None, 19, None, 15, None, 13, None], gain=.62),
    "survivor": dict(bpm=132, meter=4, roots=[48, 43, 45, 41], triad=[0, 4, 7],
                     motif=[12, 16, 19, 21, 19, 16, 14, 16], gain=.8),
    "water": dict(bpm=112, meter=3, roots=[50, 45, 47, 43], triad=[0, 4, 7],
                  motif=[12, 16, 19, 16, 14, 7], gain=.75),
}

def render(name, score):
    beat = 60 / score["bpm"]
    length = 16 * score["meter"] * beat
    n = round(length * RATE)
    out = np.zeros((n, 2), dtype=np.float64)
    rng = np.random.default_rng(20260930)

    def add(start, samples, pan=0):
        idx = (round(start * RATE) + np.arange(len(samples))) % n
        out[idx, 0] += samples * np.sqrt((1-pan)/2)
        out[idx, 1] += samples * np.sqrt((1+pan)/2)

    def note(start, midi, duration, volume, voice="lead", pan=0):
        t = np.arange(max(1, round(duration * RATE))) / RATE
        f = 440 * 2 ** ((midi - 69) / 12)
        phase = 2 * np.pi * f * t
        if voice == "bell":
            signal = np.sin(phase) + .32*np.sin(phase*2) + .12*np.sin(phase*3)
            env = np.exp(-t/max(.08, duration*.35))
        elif voice == "bass":
            signal = np.sin(phase) + .22*np.sin(phase*3)
            env = np.exp(-t/max(.1, duration))
        elif voice == "pad":
            signal = np.sin(phase) + .12*np.sin(phase*2)
            env = np.sin(np.pi*t/duration)**.7
        else:
            signal = np.sin(phase) + .24*np.sin(phase*3) + .09*np.sin(phase*5)
            env = np.exp(-t/max(.1, duration*.9))
        env *= np.minimum(1,t/.008)*np.minimum(1,(duration-t)/.018)
        samples = signal*env*volume
        add(start,samples,pan)
        if voice in ("bell", "lead"):
            add(start+beat*.75,samples*.16,-pan)
            add(start+beat*1.5,samples*.06,pan)

    def drum(start, kind, volume):
        duration = .16 if kind != "hat" else .045
        t = np.arange(round(duration*RATE))/RATE
        if kind == "kick":
            signal = np.sin(2*np.pi*(48*t+1.9*(1-np.exp(-t*28))))*np.exp(-t*28)
        else:
            noise = rng.uniform(-1,1,len(t))
            signal = (noise-np.roll(noise,1))*.45*np.exp(-t*(65 if kind=="hat" else 28))
            if kind == "snare": signal += .25*np.sin(2*np.pi*180*t)*np.exp(-t*35)
        signal *= np.minimum(1,t/.002)*np.minimum(1,(duration-t)/.01)
        add(start,signal*volume,.22 if kind=="hat" else 0)

    for bar in range(16):
        root = score["roots"][bar%4]
        # Relative minor on the third harmony for the two major themes.
        triad = [0,3,7] if name in ("water","survivor") and bar%4==2 else score["triad"]
        start = bar*score["meter"]*beat
        for pitch in triad:
            note(start,root+12+pitch,score["meter"]*beat,.055,"pad",(pitch-3)/12)
        for pulse in range(score["meter"]):
            at = start+pulse*beat
            note(at,root+(7 if pulse%2 else 0),beat*.78,.23,"bass")
            if name=="bio":
                if pulse in (0,2): drum(at,"kick",.28)
                if pulse==3: drum(at,"hat",.05)
            else:
                drum(at,"kick" if pulse%2==0 else "snare",.30 if name=="boss" else .20)
                drum(at+beat*.5,"hat",.08)
            for half in range(2):
                index=pulse*2+half
                pitch=score["motif"][index%len(score["motif"])]
                if pitch is None: continue
                offset = 12 if bar>=8 and bar%4 in (1,3) else 0
                note(at+half*beat*.5,root+pitch+offset,beat*(.7 if name=="water" else .42),
                     .16 if name=="bio" else .20,"bell" if name in ("water","bio") else "lead",.25)
                if name=="boss" and bar>=8:
                    note(at+half*beat*.5,root+triad[index%3]+12,beat*.2,.065,"bell",-.4)
    # Echoes wrap across the loop boundary; remove the remaining DC bias.
    out -= out.mean(axis=0)
    peak=np.max(np.abs(out))
    out *= .82*score["gain"]/max(peak,.001)
    pcm=np.round(out*32767).astype('<i2')
    with wave.open(str(ROOT/f"music-{name}.wav"),'wb') as file:
        file.setnchannels(2);file.setsampwidth(2);file.setframerate(RATE);file.writeframes(pcm.tobytes())
    print(f"{name}: {length:.2f}s, peak={np.max(np.abs(out)):.3f}, RMS={np.sqrt(np.mean(out*out)):.3f}")

if __name__ == '__main__':
    for name, score in SCORES.items(): render(name,score)
