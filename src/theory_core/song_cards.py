"""Guided arrangement expansion, mirroring the browser song-card contract.

The existing compiler remains responsible for individual musical material. This
module handles card ordering, local material, layer switches and arrangement FX.
"""
from __future__ import annotations

import copy
import math
from typing import Any, Callable


MATERIAL_FIELDS = (
    "notes", "drum_kit", "lead_patch_id", "underneath", "chord_progressions",
    "active_progression_id", "sound_seed", "beat_fill", "harmony_style",
    "harmony_patch_id", "auto_harmony_stabs", "stereo_jux",
    "pinned_chord_bars", "note_dial", "tune_grid_state", "band_id",
)


def _capture_segment(value):
    return (isinstance(value, dict) and value.get("version") == 1
            and isinstance(value.get("take_id"), str) and len(value["take_id"]) <= 256
            and type(value.get("start_step")) is int and type(value.get("end_step")) is int
            and 0 <= value["start_step"] < value["end_step"] <= 256)


def compile_song_cards(doc: dict[str, Any], options: dict | None, compiler: Callable) -> dict:
    base = copy.deepcopy(doc)
    cards = base.pop("song_cards")[:8]
    base.pop("sections", None)
    base["arrangement_mode"] = "loop"
    loop = compiler(base, options)
    steps = loop["total_steps"]
    steps_per_bar = loop.get("steps_per_bar", 16)
    step_sec = 60 / loop["bpm"] / 4
    events, sections, gravity = [], [], []
    offset = 0

    for index, raw in enumerate(cards):
        card = raw if isinstance(raw, dict) else {}
        material_doc = copy.deepcopy(base)
        material = card.get("material")
        if isinstance(material, dict):
            for field in MATERIAL_FIELDS:
                material_doc.pop(field, None)
                if field in material:
                    material_doc[field] = copy.deepcopy(material[field])
        source = compiler(material_doc, options) if isinstance(material, dict) else loop
        bars = card.get("bars", 4)
        if type(bars) is not int or not 1 <= bars <= 4:
            bars = 4
        card_steps = min(steps, bars * steps_per_bar)
        duration = card_steps * step_sec
        sec_offset = offset * step_sec
        sec_id = f"card-{index}"
        next_card = cards[index + 1] if index + 1 < len(cards) else {}
        next_big = card["pre_big_breath"] if type(card.get("pre_big_breath")) is bool else isinstance(next_card, dict) and bool(next_card.get("big"))
        fx = card.get("fx")
        for original in source["events"]:
            role = original["role"]
            layer = "beat" if role == "drums" else "tune" if role == "lead" else "under"
            if card.get(layer) is False:
                continue
            local_step = original["step"]
            if not 0 <= local_step < card_steps:
                continue
            if fx == "beat_drop" and local_step >= card_steps - steps_per_bar and role in ("drums", "bass", "hocket"):
                continue
            if next_big and local_step >= card_steps - 3 and role != "lead":
                continue
            event = copy.deepcopy(original)
            event.update(step=local_step + offset, start_sec=round(original["start_sec"] + sec_offset, 4), card=index, section_id=sec_id)
            event["bar"] = event["step"] // steps_per_bar
            performance = original.get("performance")
            performed_duration = original.get("duration_steps")
            keeps_final_tail = ((card.get("preserve_performed_holds") is True or (index == len(cards) - 1 and not _capture_segment(card.get("capture_segment")))) and isinstance(performance, dict)
                                and type(performance.get("version")) in (int, float) and performance.get("version") == 1
                                and type(performed_duration) in (int, float)
                                and 0 < performed_duration <= 64 and math.isfinite(performed_duration))
            available_steps = card_steps
            segment = card.get("capture_segment")
            if isinstance(performance, dict) and performance.get("version") == 1 and type(original.get("capture_occurrence")) is int and _capture_segment(segment) and not fx and not card.get("big") and not card.get("tune_variant"):
                previous = card
                for following in cards[index + 1:]:
                    a = previous.get("capture_segment", {})
                    b = following.get("capture_segment", {}) if isinstance(following, dict) else {}
                    if (not _capture_segment(b) or b.get("take_id") != a.get("take_id")
                        or b.get("start_step") != a.get("end_step") or following.get(layer) is False
                        or following.get("fx") or following.get("big") or following.get("tune_variant")
                        or a.get("end_step", 0) - a.get("start_step", 0) != previous.get("bars", 4) * steps_per_bar
                        or b.get("end_step", 0) - b.get("start_step", 0) != following.get("bars", 4) * steps_per_bar):
                        break
                    available_steps += following.get("bars", 4) * steps_per_bar
                    previous = following
            event["duration_sec"] = (original.get("duration_sec", step_sec) if keeps_final_tail else
                                     min(original.get("duration_sec", step_sec), max(0, available_steps * step_sec - original["start_sec"])))
            if role == "lead" and card.get("tune_variant") == "lift":
                pitch = event.setdefault("concrete", {})
                midi = pitch.get("midi", pitch.get("midi_pitch", 60))
                lifted = midi + 12 if midi <= 115 else midi
                ratio = 2 ** ((lifted - midi) / 12)
                pitch["midi"] = lifted
                if "midi_pitch" in pitch:
                    pitch["midi_pitch"] = lifted
                pitch["freq_hz"] = round(pitch.get("freq_hz", 440 * 2 ** ((midi - 69) / 12)) * ratio, 3)
                if isinstance(event.get("voiced_freqs"), list):
                    event["voiced_freqs"] = [round(f * ratio, 3) for f in event["voiced_freqs"]]
                event["id"] = f"{event['id']}-variation-c{index}"
            events.append(event)
            if role == "lead" and card.get("under") is not False and (fx == "high_lift" or card.get("big")):
                pitch = original.get("concrete", {})
                midi = pitch.get("midi", pitch.get("midi_pitch", 60))
                lifted = midi + 12 if midi <= 115 else midi
                freq = round(440 * 2 ** ((lifted - 69) / 12), 3)
                companion = copy.deepcopy(event)
                companion.pop("source_note_id", None)
                companion.pop("capture_occurrence", None)
                companion.update(id=f"{original['id']}-lift-c{index}", role="harmony", concrete={"midi": lifted, "freq_hz": freq}, voiced_freqs=[freq], velocity=round((original.get("velocity") or .8) * .45, 3),
                                 provenance="generator_default", generated_by="song_card_lift",
                                 response_to=[original.get("source_note_id") or original["id"]])
                events.append(companion)
        if fx == "drum_roll" and card.get("beat") is not False:
            for step in range(card_steps - 8, card_steps):
                if next_big and step >= card_steps - 3:
                    continue
                events.append(dict(id=f"fx-roll-c{index}-s{step}", role="drums", patch_id="snare", step=offset + step, bar=(offset + step) // steps_per_bar, start_sec=round(sec_offset + step * step_sec, 4), duration_sec=round(step_sec, 4), velocity=round(.38 + (step - (card_steps - 8)) / 7 * .48, 3), provenance="generator_default", concrete={"midi": 38, "freq_hz": 200.0}, card=index, section_id=sec_id))
        gravity.extend(copy.deepcopy(source.get("gravity_by_step", [])[:card_steps]))
        sections.append(dict(id=sec_id, index=index, name=card.get("role_name") or f"Part {index + 1}", type="guided", bars=card_steps // steps_per_bar, start_bar=offset // steps_per_bar, end_bar=(offset + card_steps) // steps_per_bar, start_step=offset, end_step=offset + card_steps, start_sec=sec_offset, end_sec=sec_offset + duration, active_event_count=sum(e["card"] == index for e in events)))
        offset += card_steps

    events.sort(key=lambda event: event["start_sec"])
    result = copy.deepcopy(loop)
    result.update(arrangement_mode="song", cards_count=len(cards), loop_steps=steps, total_steps=offset, total_duration_sec=round(offset * step_sec, 4), bars=offset // steps_per_bar, sections=sections, events=events, gravity_by_step=gravity, sidechain_duck_steps=sorted({e["step"] for e in events if e.get("patch_id") in ("kick", "snare")}))
    return result
