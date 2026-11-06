"""Quiet blend weights must survive the renderer instead of being floored loud."""
import pytest
from src.audio_engine.synth import synthesize_event

def test_blend_velocity_is_not_floored_and_zero_is_silent():
    def render(velocity):
        return synthesize_event({'role':'lead','patch_id':'warm_keys','duration_sec':.25,'velocity':velocity,'concrete':{'freq_hz':440}},sample_rate=22050)[0]
    zero,quiet,loud=render(0),render(.05),render(.5)
    assert max(abs(x) for x in zero)==0
    assert max(abs(x) for x in quiet)/max(abs(x) for x in loud)==pytest.approx(.1,rel=.05)

def test_style_sidechain_scales_and_combines_at_actual_onsets_without_changing_legacy():
    from src.audio_engine.synth import _sidechain_events
    assert _sidechain_events({'sidechain_duck_steps':[0,4]},.15)==[(0,1),(0.6,1)]
    events=[{'patch_id':'kick','step':4,'start_sec':.625,'velocity':.025,'style_weight':.05},
            {'patch_id':'snare','step':8,'start_sec':1.2,'velocity':.21,'style_weight':.5},
            {'patch_id':'clap','step':8,'start_sec':1.2,'velocity':.21,'style_weight':.5}]
    assert _sidechain_events({'events':events,'sidechain_duck_steps':[4,8]},.15)==[(.625,.05),(1.2,1)]
