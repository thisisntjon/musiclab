/**
 * Heavy Bass & Glitch Sound Sculptor & 2D X/Y Sound Pad
 */

export const PATCH_META = [
  { id: "monster_growl", name: "FM Monster Growl", color: "#f43f5e", role: "hocket", defaultHz: 55.0 },
  { id: "talking_yoi", name: "Talking 'Yoi' Bass", color: "#a855f7", role: "hocket", defaultHz: 65.4 },
  { id: "wobble_bass", name: "Sync Wobble Bass", color: "#eab308", role: "hocket", defaultHz: 49.0 },
  { id: "sub_drop_808", name: "808 Sub Anchor", color: "#10b981", role: "bass", defaultHz: 49.0 },
  { id: "laser_screech", name: "Laser Pitch Whip", color: "#06b6d4", role: "hocket", defaultHz: 293.66 },
  { id: "vocal_chop", name: "Glitch Vocal Chop", color: "#ec4899", role: "hocket", defaultHz: 392.0 },
  { id: "supersaw_stab", name: "Supersaw Stab", color: "#38bdf8", role: "harmony", defaultHz: 196.0 },
];

export const GESTURE_BADGES = [
  {
    id: "vowel_yoi",
    short: "YOI",
    label: "Yoi Talk (O -> I)",
    why: "Sweeps the 2nd vocal formant from 840 Hz ('O') to 2290 Hz ('I'), mimicking a vocal shout.",
    gesture: {
      preset_id: "vowel_yoi",
      shape: "ramp_up_down",
      vowel_start: "O",
      vowel_end: "I",
      lfo_rate: "1/8",
      grit: 0.82,
      pitch_bend_st: 0,
      stutter_div: "off",
      ott_punch: 0.85,
      xy_pad: { x: 0.78, y: 0.82 },
    },
  },
  {
    id: "wah_bite",
    short: "GROWL",
    label: "Monster Growl (U -> A)",
    why: "Drives 3-operator harmonic FM and asymmetric wavefolding while opening the throat formant from 'U' to 'A'.",
    gesture: {
      preset_id: "wah_bite",
      shape: "ramp_up_down",
      vowel_start: "U",
      vowel_end: "A",
      lfo_rate: "1/4",
      grit: 0.88,
      pitch_bend_st: 0,
      stutter_div: "off",
      ott_punch: 0.88,
      xy_pad: { x: 0.42, y: 0.88 },
    },
  },
  {
    id: "wobble_1_16",
    short: "WOB 16",
    label: "1/16 Sync Wobble",
    why: "Locks filter cutoff LFO to 16th-note subdivisions while keeping the <110 Hz sub-bass clean.",
    gesture: {
      preset_id: "wobble_1_16",
      shape: "lfo_sync",
      vowel_start: "A",
      vowel_end: "U",
      lfo_rate: "1/16",
      grit: 0.74,
      pitch_bend_st: 0,
      stutter_div: "off",
      ott_punch: 0.82,
      xy_pad: { x: 0.88, y: 0.74 },
    },
  },
  {
    id: "laser_drop",
    short: "LASER",
    label: "+12st Laser Whip",
    why: "Starts one octave above the target note and whips down exponentially in the first 35% of the hit.",
    gesture: {
      preset_id: "laser_drop",
      shape: "laser_attack",
      vowel_start: "E",
      vowel_end: "I",
      lfo_rate: "off",
      grit: 0.85,
      pitch_bend_st: 12,
      stutter_div: "off",
      ott_punch: 0.90,
      xy_pad: { x: 0.92, y: 0.85 },
    },
  },
  {
    id: "stutter_32",
    short: "CHOP",
    label: "32nd Glitch Chop",
    why: "Slices the vocal formant into rapid 1/32 micro-gates to propel bar turnarounds into the next downbeat.",
    gesture: {
      preset_id: "stutter_32",
      shape: "stutter_gate",
      vowel_start: "A",
      vowel_end: "I",
      lfo_rate: "1/16",
      grit: 0.65,
      pitch_bend_st: 3,
      stutter_div: "1/32",
      ott_punch: 0.84,
      xy_pad: { x: 0.84, y: 0.65 },
    },
  },
];

export class NoiseSculptorUI {
  constructor({ onGestureChange, onPatchSelect, onAudition, onWhyUpdate }) {
    this.onGestureChange = onGestureChange;
    this.onPatchSelect = onPatchSelect;
    this.onAudition = onAudition;
    this.onWhyUpdate = onWhyUpdate;

    this.activePatchId = "monster_growl";
    this.gesture = structuredClone(GESTURE_BADGES[0].gesture);
    this.isDraggingXY = false;

    this._initDOM();
    this.render();
  }

  _initDOM() {
    this.patchGridEl = document.getElementById("patch-selector-grid");
    this.badgesRowEl = document.getElementById("gesture-badges-row");
    this.xyCanvas = document.getElementById("xy-monster-pad");
    this.xyReadout = document.getElementById("xy-readout");
    this.targetLabel = document.getElementById("sculptor-target-label");

    this.vowelStartEl = document.getElementById("macro-vowel-start");
    this.vowelEndEl = document.getElementById("macro-vowel-end");
    this.gritEl = document.getElementById("macro-grit");
    this.gritValEl = document.getElementById("macro-grit-val");
    this.lfoRateEl = document.getElementById("macro-lfo-rate");
    this.pitchBendEl = document.getElementById("macro-pitch-bend");
    this.pitchValEl = document.getElementById("macro-pitch-val");
    this.stutterEl = document.getElementById("macro-stutter");
    this.ottEl = document.getElementById("macro-ott");
    this.ottValEl = document.getElementById("macro-ott-val");

    document.getElementById("btn-audition-patch").addEventListener("click", () => {
      this.onAudition(this.activePatchId, this.gesture);
    });

    // Render 7 patch selector pills
    this.patchGridEl.innerHTML = "";
    for (const p of PATCH_META) {
      const btn = document.createElement("button");
      btn.className = "patch-pill";
      btn.dataset.patchId = p.id;
      btn.style.borderLeftColor = p.color;
      btn.textContent = p.name;
      btn.addEventListener("click", () => {
        this.activePatchId = p.id;
        this.onPatchSelect(p.id);
        this.onAudition(this.activePatchId, this.gesture);
        this.render();
      });
      this.patchGridEl.appendChild(btn);
    }

    // Render 5 gesture badges
    this.badgesRowEl.innerHTML = "";
    for (const b of GESTURE_BADGES) {
      const btn = document.createElement("button");
      btn.className = "gesture-badge-btn";
      btn.dataset.badgeId = b.id;
      btn.textContent = b.label;
      btn.title = b.why;
      btn.addEventListener("click", () => {
        this.gesture = structuredClone(b.gesture);
        this.onWhyUpdate(`Gesture [${b.label}]: ${b.why}`);
        this.onGestureChange(this.gesture, true);
        this.render();
      });
      this.badgesRowEl.appendChild(btn);
    }

    // Bind 2D X/Y Pad mouse/pointer events
    const handlePointer = (ev, commitAudition = false) => {
      const rect = this.xyCanvas.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, 1.0 - (ev.clientY - rect.top) / rect.height));
      this._applyXY(x, y, commitAudition);
    };

    this.xyCanvas.addEventListener("pointerdown", (ev) => {
      this.isDraggingXY = true;
      this.xyCanvas.setPointerCapture(ev.pointerId);
      handlePointer(ev, true);
    });
    this.xyCanvas.addEventListener("pointermove", (ev) => {
      if (!this.isDraggingXY) return;
      handlePointer(ev, false);
    });
    this.xyCanvas.addEventListener("pointerup", (ev) => {
      if (!this.isDraggingXY) return;
      this.isDraggingXY = false;
      handlePointer(ev, true);
    });

    // Bind 6 macro controls
    const updateFromMacros = () => {
      this.gesture.vowel_start = this.vowelStartEl.value;
      this.gesture.vowel_end = this.vowelEndEl.value;
      this.gesture.grit = Number(this.gritEl.value);
      this.gesture.lfo_rate = this.lfoRateEl.value;
      this.gesture.pitch_bend_st = Number(this.pitchBendEl.value);
      this.gesture.stutter_div = this.stutterEl.value;
      this.gesture.ott_punch = Number(this.ottEl.value);
      this.onGestureChange(this.gesture, true);
      this.render();
    };

    for (const el of [
      this.vowelStartEl,
      this.vowelEndEl,
      this.gritEl,
      this.lfoRateEl,
      this.pitchBendEl,
      this.stutterEl,
      this.ottEl,
    ]) {
      el.addEventListener("change", updateFromMacros);
      if (el.tagName === "INPUT") {
        el.addEventListener("input", () => {
          const gVal = Number(this.gritEl.value);
          this.gritValEl.textContent = gVal >= 0.7 ? "Strong" : gVal >= 0.35 ? "Warm" : "Gentle";
          this.pitchValEl.textContent = `${this.pitchBendEl.value} st`;
          const oVal = Number(this.ottEl.value);
          this.ottValEl.textContent = oVal >= 0.7 ? "Full" : oVal >= 0.35 ? "Balanced" : "Soft";
        });
      }
    }
  }

  _applyXY(x, y, commitAudition) {
    const gx = Math.round(x * 100) / 100;
    const gy = Math.round(y * 100) / 100;
    this.gesture.xy_pad = { x: gx, y: gy };
    this.gesture.grit = Math.round((0.15 + 0.85 * gy) * 100) / 100;
    this.gesture.ott_punch = Math.round((0.35 + 0.60 * gy) * 100) / 100;

    const pairs = [
      ["U", "O"],
      ["O", "A"],
      ["A", "E"],
      ["O", "I"],
      ["E", "I"],
    ];
    const idx = Math.min(pairs.length - 1, Math.floor(gx * pairs.length));
    this.gesture.vowel_start = pairs[idx][0];
    this.gesture.vowel_end = pairs[idx][1];

    if (this.activePatchId === "wobble_bass") {
      const rates = ["1/4", "1/8", "1/8t", "1/16", "1/32"];
      this.gesture.lfo_rate = rates[Math.min(rates.length - 1, Math.floor(gx * rates.length))];
    } else if (this.activePatchId === "laser_screech") {
      this.gesture.pitch_bend_st = gx >= 0.65 ? 24 : gx >= 0.3 ? 12 : -12;
    } else if (this.activePatchId === "vocal_chop") {
      this.gesture.stutter_div = gx >= 0.6 ? "1/32" : "1/16";
    }

    this.onWhyUpdate(
      `Sound Pad (X=${gx.toFixed(2)}, Y=${gy.toFixed(2)}) -> Tone ${this.gesture.vowel_start}->${this.gesture.vowel_end}, Drive & Punch updated.`
    );
    this.onGestureChange(this.gesture, commitAudition);
    this.render();
  }

  loadNoteContext(note, labelText) {
    if (note) {
      this.activePatchId = note.patch_id || this.activePatchId;
      if (note.gesture) {
        this.gesture = structuredClone(note.gesture);
      }
    }
    if (labelText) {
      this.targetLabel.textContent = labelText;
    }
    this.render();
  }

  render() {
    for (const btn of this.patchGridEl.querySelectorAll(".patch-pill")) {
      btn.classList.toggle("active", btn.dataset.patchId === this.activePatchId);
    }
    for (const btn of this.badgesRowEl.querySelectorAll(".gesture-badge-btn")) {
      btn.classList.toggle("active", btn.dataset.badgeId === this.gesture.preset_id);
    }

    this.vowelStartEl.value = this.gesture.vowel_start || "O";
    this.vowelEndEl.value = this.gesture.vowel_end || "I";
    this.gritEl.value = this.gesture.grit ?? 0.82;
    const gNum = Number(this.gesture.grit ?? 0.82);
    this.gritValEl.textContent = gNum >= 0.7 ? "Strong" : gNum >= 0.35 ? "Warm" : "Gentle";
    this.lfoRateEl.value = this.gesture.lfo_rate || "1/8";
    this.pitchBendEl.value = this.gesture.pitch_bend_st ?? 0;
    this.pitchValEl.textContent = `${this.gesture.pitch_bend_st ?? 0} st`;
    this.stutterEl.value = String(this.gesture.stutter_div || "off");
    this.ottEl.value = this.gesture.ott_punch ?? 0.85;
    const oNum = Number(this.gesture.ott_punch ?? 0.85);
    this.ottValEl.textContent = oNum >= 0.7 ? "Full" : oNum >= 0.35 ? "Balanced" : "Soft";

    const xy = this.gesture.xy_pad || { x: 0.78, y: 0.82 };
    this.xyReadout.textContent = `X: ${Number(xy.x).toFixed(2)} | Y: ${Number(xy.y).toFixed(2)}`;
    this._drawXYCanvas(Number(xy.x), Number(xy.y));
  }

  _drawXYCanvas(x, y) {
    const ctx = this.xyCanvas.getContext("2d");
    const w = this.xyCanvas.width;
    const h = this.xyCanvas.height;
    ctx.clearRect(0, 0, w, h);

    // Subtle grid + vowel zone labels
    ctx.strokeStyle = "rgba(148, 163, 184, 0.14)";
    ctx.lineWidth = 1;
    const zones = ["U->O", "O->A", "A->E", "O->I", "E->I"];
    for (let i = 1; i < zones.length; i++) {
      const gx = (w / zones.length) * i;
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, h);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(148, 163, 184, 0.55)";
    ctx.font = "10px Consolas, monospace";
    for (let i = 0; i < zones.length; i++) {
      ctx.fillText(zones[i], (w / zones.length) * i + 10, h - 8);
    }

    // Draw live wavefolder + formant contour preview curve across the pad
    const grit = this.gesture.grit ?? 0.82;
    ctx.strokeStyle = "rgba(6, 182, 212, 0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let px = 0; px < w; px++) {
      const normX = (px / w) * 2 - 1;
      const drive = 1.4 + 4.0 * grit;
      const waveY = Math.tanh(1.6 * Math.sin(drive * normX));
      const py = h * 0.5 - waveY * (h * 0.34);
      if (px === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Draw cursor orb
    const cx = x * w;
    const cy = (1.0 - y) * h;
    const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 22);
    grad.addColorStop(0, "rgba(244, 63, 94, 0.95)");
    grad.addColorStop(1, "rgba(244, 63, 94, 0.0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}
