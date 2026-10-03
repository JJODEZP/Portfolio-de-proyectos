"""Utilidades de audio puras (sin dependencias de hardware)."""
from __future__ import annotations

import wave
from pathlib import Path

import numpy as np

SAMPLE_RATE = 16_000  # Whisper trabaja a 16 kHz mono


class WavWriter:
    """Escribe PCM int16 mono de forma incremental, para no perder la grabación si algo falla."""

    def __init__(self, path: Path, sample_rate: int = SAMPLE_RATE):
        self.path = Path(path)
        self._wav = wave.open(str(self.path), "wb")
        self._wav.setnchannels(1)
        self._wav.setsampwidth(2)
        self._wav.setframerate(sample_rate)
        self.frames = 0

    def write(self, samples: np.ndarray) -> None:
        pcm = to_int16(samples)
        self._wav.writeframes(pcm.tobytes())
        self.frames += len(pcm)

    def close(self) -> None:
        self._wav.close()

    def __enter__(self) -> "WavWriter":
        return self

    def __exit__(self, *exc) -> None:
        self.close()


def to_int16(samples: np.ndarray) -> np.ndarray:
    """float32 en [-1, 1] (o multicanal) -> int16 mono."""
    arr = np.asarray(samples)
    if arr.ndim > 1:
        arr = arr.mean(axis=1)
    if arr.dtype.kind == "f":
        arr = np.clip(arr, -1.0, 1.0) * 32767.0
    return arr.astype(np.int16)


def read_wav(path: Path) -> tuple[np.ndarray, int]:
    """Lee un WAV int16 mono y devuelve (float32 en [-1, 1], sample_rate)."""
    with wave.open(str(path), "rb") as w:
        if w.getsampwidth() != 2 or w.getnchannels() != 1:
            raise ValueError(f"{path}: se esperaba WAV int16 mono")
        rate = w.getframerate()
        data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
    return data.astype(np.float32) / 32768.0, rate


def duration_seconds(path: Path) -> float:
    with wave.open(str(path), "rb") as w:
        return w.getnframes() / w.getframerate()
