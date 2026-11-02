"""Core DSP primitives for heavy-bass synthesis: Cytomic SVF, Formant Vowel Tables, Wavefolder, 3-Band OTT & Spectral Metrics."""
from __future__ import annotations

import math
from typing import Any

# (F1_hz, F2_hz, F3_hz, F_notch_hz)
VOWEL_FORMANTS: dict[str, tuple[float, float, float, float]] = {
    "A": (730.0, 1090.0, 2440.0, 900.0),
    "E": (530.0, 1840.0, 2480.0, 1150.0),
    "I": (270.0, 2290.0, 3010.0, 1350.0),
    "O": (570.0, 840.0, 2410.0, 700.0),
    "U": (300.0, 870.0, 2240.0, 580.0),
}

LFO_DIVISIONS: dict[str, float] = {
    "off": 0.0,
    "1/2": 0.5,
    "1/4": 1.0,
    "1/8": 2.0,
    "1/8t": 3.0,
    "1/16": 4.0,
    "1/32": 8.0,
}


def interpolate_formants(
    vowel_start: str,
    vowel_end: str,
    g: float,
    vocal_shift: float = 1.0,
) -> tuple[float, float, float, float]:
    """Exponentially interpolate (F1, F2, F3, F_notch) between vowel_start and vowel_end for g in [0, 1]."""
    va = VOWEL_FORMANTS.get(vowel_start, VOWEL_FORMANTS["O"])
    vb = VOWEL_FORMANTS.get(vowel_end, VOWEL_FORMANTS["I"])
    clamped_g = max(0.0, min(1.0, float(g)))
    f1 = va[0] * math.pow(vb[0] / va[0], clamped_g) * vocal_shift
    f2 = va[1] * math.pow(vb[1] / va[1], clamped_g) * vocal_shift
    f3 = va[2] * math.pow(vb[2] / va[2], clamped_g) * vocal_shift
    fn = va[3] * math.pow(vb[3] / va[3], clamped_g) * vocal_shift
    return (f1, f2, f3, fn)


class CytomicSVF:
    """Andrew Simper's unconditionally stable Zero-Delay-Feedback State Variable Filter."""

    __slots__ = ("ic1eq", "ic2eq", "a1", "a2", "a3", "k")

    def __init__(self, cutoff_hz: float = 1000.0, q: float = 1.0, sample_rate: int = 22050) -> None:
        self.ic1eq = 0.0
        self.ic2eq = 0.0
        self.a1 = 0.0
        self.a2 = 0.0
        self.a3 = 0.0
        self.k = 1.0
        self.update_coeffs(cutoff_hz, q, sample_rate)

    def update_coeffs(self, cutoff_hz: float, q: float, sample_rate: int) -> None:
        nyquist_safe = max(25.0, min(sample_rate * 0.46, float(cutoff_hz)))
        g = math.tan(math.pi * nyquist_safe / float(sample_rate))
        k = 1.0 / max(0.5, float(q))
        a1 = 1.0 / (1.0 + g * (g + k))
        a2 = g * a1
        a3 = g * a2
        self.k = k
        self.a1 = a1
        self.a2 = a2
        self.a3 = a3

    def step(self, x: float) -> tuple[float, float, float, float]:
        """Process one sample and return (lp, bp_normalized, hp, notch)."""
        v3 = x - self.ic2eq
        v1 = self.a1 * self.ic1eq + self.a2 * v3
        v2 = self.ic2eq + self.a2 * self.ic1eq + self.a3 * v3
        self.ic1eq = 2.0 * v1 - self.ic1eq
        self.ic2eq = 2.0 * v2 - self.ic2eq
        lp = v2
        bp = v1 * self.k  # Unity peak gain (0 dB), matching Web Audio BiquadFilterNode bandpass
        hp = x - self.k * v1 - v2
        notch = lp + hp
        return (lp, bp, hp, notch)


def wavefolder(x: float, grit: float) -> float:
    """Asymmetric wavefolder + tube saturation generating even and odd harmonics."""
    drive = 1.4 + 4.2 * max(0.0, min(1.0, grit))
    asym = 0.18 * x * x
    return math.tanh(1.65 * math.sin(drive * x + asym) + 0.35 * math.tanh(2.8 * x))


def ott_transfer(x: float, ott_punch: float = 0.8) -> float:
    """Memoryless upward-lifting + downward-clamping OTT transfer curve."""
    ax = abs(x)
    if ax < 0.0008:
        return 0.0
    sign = 1.0 if x >= 0.0 else -1.0
    if ax < 0.005:
        wet = sign * (ax / 0.005) * math.tanh(1.5 * math.pow(0.005, 0.68))
    else:
        wet = sign * math.tanh(1.5 * math.pow(ax, 0.68) + 0.75 * ax)
    amt = max(0.0, min(1.0, ott_punch))
    return (1.0 - amt) * math.tanh(x) + amt * wet


def gesture_curve_at(shape: str, norm_t: float, lfo_rate: str, bpm: float, dur_sec: float) -> float:
    """Evaluate normalized Gesture Curve g(t) in [0, 1] at normalized note progress norm_t in [0, 1]."""
    nt = max(0.0, min(1.0, norm_t))
    div = LFO_DIVISIONS.get(lfo_rate, 0.0)
    if shape == "lfo_sync" and div > 0.0:
        freq_lfo = (bpm / 60.0) * div
        phase = (freq_lfo * (nt * dur_sec)) % 1.0
        return 0.5 - 0.5 * math.cos(2.0 * math.pi * phase)
    if shape == "ramp_up_down":
        # Fast swell to peak at 55% of note, then tight release (classic YOI / WAH sweep)
        if nt <= 0.65:
            return math.pow(nt / 0.65, 0.85)
        return max(0.0, 1.0 - ((nt - 0.65) / 0.35))
    if shape == "laser_attack":
        return math.exp(-nt * 8.0)
    if shape == "laser_dive":
        return 1.0 - nt
    if shape == "pluck_stab":
        return math.exp(-nt * 5.5)
    return nt


def spectral_centroid(samples: list[float], sample_rate: int = 22050) -> float:
    """Compute spectral centroid in Hz using a discrete Fourier transform over a representative window."""
    n = min(len(samples), 1024)
    if n < 64:
        return 0.0
    # Use middle window of note where vowel/grit is fullest
    start = max(0, (len(samples) - n) // 2)
    windowed = [
        samples[start + i] * (0.5 - 0.5 * math.cos(2.0 * math.pi * i / (n - 1)))
        for i in range(n)
    ]
    num = 0.0
    den = 0.0
    max_k = n // 2
    for k in range(1, max_k):
        freq = k * sample_rate / n
        if freq > 7500.0:
            break
        re = 0.0
        im = 0.0
        two_pi_k_n = 2.0 * math.pi * k / n
        for idx, s in enumerate(windowed):
            angle = two_pi_k_n * idx
            re += s * math.cos(angle)
            im -= s * math.sin(angle)
        mag = math.hypot(re, im)
        num += freq * mag
        den += mag
    return round(num / den, 2) if den > 1e-9 else 0.0


def estimate_fundamental_hz(
    samples: list[float],
    sample_rate: int = 22050,
    expected_hz: float = 110.0,
) -> float:
    """Estimate fundamental frequency in Hz via fine-grained DFT peak search around expected fundamental."""
    n = min(len(samples), 4096)
    if n < 256:
        return 0.0
    start = max(0, (len(samples) - n) // 2)
    seg = [
        samples[start + i] * (0.5 - 0.5 * math.cos(2.0 * math.pi * i / (n - 1)))
        for i in range(n)
    ]
    low_hz = max(25.0, expected_hz * 0.75)
    high_hz = min(sample_rate * 0.4, expected_hz * 1.25)
    best_freq = low_hz
    best_mag = -1.0
    steps = 160
    for step_idx in range(steps + 1):
        cand_hz = low_hz + (high_hz - low_hz) * (step_idx / steps)
        omega = 2.0 * math.pi * cand_hz / sample_rate
        re = 0.0
        im = 0.0
        for idx, val in enumerate(seg):
            angle = omega * idx
            re += val * math.cos(angle)
            im -= val * math.sin(angle)
        mag = re * re + im * im
        if mag > best_mag:
            best_mag = mag
            best_freq = cand_hz
    return round(best_freq, 3)


def karplus_strong_pluck(
    freq_hz: float,
    n_samples: int,
    sample_rate: int = 22050,
    damping: float = 0.992,
    brightness: float = 0.65,
) -> list[float]:
    """Deterministic Karplus-Strong plucked string waveguide with fractional delay & lowpass loop (#18)."""
    n = max(16, int(n_samples))
    safe_freq = max(35.0, min(sample_rate * 0.42, float(freq_hz)))
    period = max(2, int(round(sample_rate / safe_freq)))
    buf = [0.0] * period
    # Deterministic velvet/pinkish excitation burst
    for k in range(period):
        noise = math.sin(k * 12.9898 + 4.1414) * math.cos(k * 78.233 + 1.618)
        window = math.sin(math.pi * (k + 0.5) / float(period))
        buf[k] = noise * window

    out = [0.0] * n
    alpha = max(0.20, min(0.92, float(brightness)))
    damp = max(0.95, min(0.998, float(damping)))
    prev = 0.0
    for i in range(n):
        idx = i % period
        nxt = (i + 1) % period
        cur = buf[idx]
        out[i] = cur
        avg = alpha * cur + (1.0 - alpha) * 0.5 * (cur + buf[nxt])
        prev = damp * (0.75 * avg + 0.25 * prev)
        buf[idx] = prev
    return out


def compute_wav_metrics(
    left: list[float],
    right: list[float],
    sample_rate: int = 22050,
) -> dict[str, Any]:
    """Compute peak dBFS, RMS dBFS, DC offset, clipping count, and stereo width dB."""
    n = min(len(left), len(right))
    if n == 0:
        return {
            "peak_dbfs": -120.0,
            "rms_dbfs": -120.0,
            "dc_offset": 0.0,
            "clipped_samples": 0,
            "stereo_diff_db": -120.0,
        }
    peak = 0.0
    sum_sq = 0.0
    sum_dc = 0.0
    diff_sq = 0.0
    clipped = 0

    for i in range(n):
        l_val = left[i]
        r_val = right[i]
        al = abs(l_val)
        ar = abs(r_val)
        if al > peak:
            peak = al
        if ar > peak:
            peak = ar
        if al >= 0.999 or ar >= 0.999:
            clipped += 1
        sum_sq += 0.5 * (l_val * l_val + r_val * r_val)
        sum_dc += 0.5 * (l_val + r_val)
        diff = l_val - r_val
        diff_sq += diff * diff

    rms = math.sqrt(sum_sq / n)
    diff_rms = math.sqrt(diff_sq / n)
    peak_dbfs = 20.0 * math.log10(max(1e-9, peak))
    rms_dbfs = 20.0 * math.log10(max(1e-9, rms))
    stereo_diff_db = 20.0 * math.log10(max(1e-9, diff_rms))

    return {
        "samples": n,
        "duration_sec": round(n / float(sample_rate), 3),
        "peak_dbfs": round(peak_dbfs, 3),
        "rms_dbfs": round(rms_dbfs, 3),
        "dc_offset": round(abs(sum_dc / n), 6),
        "clipped_samples": clipped,
        "stereo_diff_db": round(stereo_diff_db, 3),
    }
