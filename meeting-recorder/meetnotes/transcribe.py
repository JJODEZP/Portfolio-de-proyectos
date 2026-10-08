"""Transcripción local con faster-whisper y unión de pistas por hablante."""
from __future__ import annotations

from dataclasses import dataclass
from difflib import SequenceMatcher
from pathlib import Path

from .audio import read_wav

SPEAKER_LABELS = {"mic": "Yo", "system": "Otros"}


@dataclass
class Segment:
    start: float
    end: float
    text: str
    speaker: str  # "Yo" | "Otros"


def transcribe_file(
    path: Path,
    speaker: str,
    model_size: str = "small",
    language: str | None = None,
    offset: float = 0.0,
    _model=None,
) -> list[Segment]:
    """Transcribe un WAV. `offset` corrige el desfase de inicio entre pistas."""
    if _model is None:
        try:
            from faster_whisper import WhisperModel
        except ImportError as e:  # pragma: no cover
            raise SystemExit(
                "Falta faster-whisper. Instala con: pip install 'meetnotes[transcribe]'"
            ) from e
        _model = WhisperModel(model_size, compute_type="int8")
    # Se pasa el audio ya decodificado (float32 16 kHz) en vez de la ruta: así faster-whisper
    # no usa PyAV para abrir el archivo, y no depende de la versión de `av` instalada.
    audio, rate = read_wav(Path(path))
    if rate != 16_000:
        raise ValueError(f"{path}: se esperaban 16 kHz, hay {rate} Hz")
    segments, _info = _model.transcribe(
        audio, language=language, vad_filter=True, beam_size=5
    )
    return [
        Segment(s.start + offset, s.end + offset, s.text.strip(), speaker)
        for s in segments
        if s.text.strip()
    ]


def _overlap(a: Segment, b: Segment) -> float:
    return max(0.0, min(a.end, b.end) - max(a.start, b.start))


def drop_echo(segments: list[Segment], threshold: float = 0.75) -> list[Segment]:
    """Si usas altavoces, el micrófono recoge a los demás y se duplica el texto.

    Elimina los segmentos "Yo" casi idénticos a un segmento "Otros" simultáneo.
    """
    others = [s for s in segments if s.speaker == "Otros"]
    kept = []
    for s in segments:
        if s.speaker == "Yo":
            echo = any(
                _overlap(s, o) > 0
                and SequenceMatcher(None, s.text.lower(), o.text.lower()).ratio() >= threshold
                for o in others
            )
            if echo:
                continue
        kept.append(s)
    return kept


def merge_tracks(*tracks: list[Segment]) -> list[Segment]:
    merged = [s for t in tracks for s in t]
    merged.sort(key=lambda s: (s.start, s.end))
    return drop_echo(merged)


def _ts(seconds: float) -> str:
    s = int(seconds)
    return f"{s // 3600:02d}:{s % 3600 // 60:02d}:{s % 60:02d}"


def format_transcript(segments: list[Segment]) -> str:
    """Une segmentos consecutivos del mismo hablante en un solo párrafo."""
    lines: list[str] = []
    cur: Segment | None = None
    for s in segments:
        if cur and cur.speaker == s.speaker and s.start - cur.end < 2.0:
            cur = Segment(cur.start, s.end, f"{cur.text} {s.text}", cur.speaker)
        else:
            if cur:
                lines.append(f"[{_ts(cur.start)}] {cur.speaker}: {cur.text}")
            cur = s
    if cur:
        lines.append(f"[{_ts(cur.start)}] {cur.speaker}: {cur.text}")
    return "\n".join(lines) + "\n"
