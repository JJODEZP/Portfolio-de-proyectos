import json
from types import SimpleNamespace

import numpy as np

from meetnotes import cli, notes
from meetnotes.audio import WavWriter, duration_seconds, read_wav, to_int16
from meetnotes.stats import compute_stats, count_fillers
from meetnotes.transcribe import Segment, drop_echo, format_transcript, merge_tracks


def test_wav_roundtrip_and_stereo_downmix(tmp_path):
    p = tmp_path / "a.wav"
    stereo = np.stack([np.full(16000, 0.5), np.full(16000, -0.5)], axis=1).astype(np.float32)
    with WavWriter(p) as w:
        w.write(stereo)
    assert duration_seconds(p) == 1.0
    data, rate = read_wav(p)
    assert rate == 16000 and abs(data).max() < 1e-3  # promedio de +0.5 y -0.5


def test_to_int16_clips():
    assert to_int16(np.array([2.0, -2.0], dtype=np.float32)).tolist() == [32767, -32767]


def test_drop_echo_removes_mic_duplicate_only():
    segs = [
        Segment(0, 3, "Necesitamos cerrar el presupuesto el viernes", "Otros"),
        Segment(0.2, 3.1, "necesitamos cerrar el presupuesto el viernes", "Yo"),
        Segment(4, 6, "Yo me encargo del borrador", "Yo"),
    ]
    out = drop_echo(segs)
    assert [(s.speaker, s.text) for s in out] == [
        ("Otros", "Necesitamos cerrar el presupuesto el viernes"),
        ("Yo", "Yo me encargo del borrador"),
    ]


def test_merge_orders_by_time_and_format_joins_turns():
    a = [Segment(0, 2, "Hola", "Otros"), Segment(2.5, 4, "¿cómo estás?", "Otros")]
    b = [Segment(5, 6, "Bien", "Yo")]
    text = format_transcript(merge_tracks(b, a))
    assert text.splitlines() == [
        "[00:00:00] Otros: Hola ¿cómo estás?",
        "[00:00:05] Yo: Bien",
    ]


def test_fillers_whole_word_only():
    f = count_fillers("Este, o sea, estesis no cuenta. Eh, o sea, básicamente sí")
    assert f == {"o sea": 2, "este": 1, "eh": 1, "básicamente": 1}


def test_stats():
    segs = [
        Segment(0, 30, "o sea hola ¿todo bien?", "Yo"),
        Segment(30, 90, "Todo bien", "Otros"),
    ]
    s = compute_stats(segs)
    assert s["my_talk_ratio"] == 0.33 and s["my_questions"] == 1
    assert s["my_fillers"] == {"o sea": 1}


def test_generate_notes_uses_client_and_prompt():
    captured = {}

    class FakeClient:
        class messages:  # noqa: N801
            @staticmethod
            def create(**kw):
                captured.update(kw)
                return SimpleNamespace(content=[SimpleNamespace(type="text", text="## Resumen\nok")])

    out = notes.generate_notes("[00:00:00] Yo: hola", "Sync", "stats", _client=FakeClient)
    assert out.startswith("## Resumen")
    assert "Mejoras para mí" in captured["system"]
    assert "Sync" in captured["messages"][0]["content"]


def test_process_session_end_to_end_without_llm(tmp_path, monkeypatch):
    for name in ("mic", "system"):
        with WavWriter(tmp_path / f"{name}.wav") as w:
            w.write(np.zeros(16000 * 2, dtype=np.float32))
    (tmp_path / "meta.json").write_text(json.dumps({"offsets": {"mic": 1.0}}))

    def fake_transcribe(path, speaker, model, lang, offset=0.0):
        return [Segment(offset, offset + 1, f"hola desde {speaker}", speaker)]

    monkeypatch.setattr(cli, "transcribe_file", fake_transcribe)
    cli.process_session(tmp_path, llm=False, title="Demo")
    assert "[00:00:01] Yo: hola desde Yo" in (tmp_path / "transcript.md").read_text()
    notes_md = (tmp_path / "notes.md").read_text()
    assert notes_md.startswith("# Demo") and "Métricas de mi participación" in notes_md
    assert json.loads((tmp_path / "stats.json").read_text())["my_interventions"] == 1


def test_session_dir_slug(tmp_path):
    d = cli.new_session_dir(tmp_path, "Reunión Q4 / Ventas!")
    assert d.name.endswith("reunión-q4-ventas")
