"""Captura de audio a nivel de sistema operativo.

Al escuchar la salida de audio (loopback) y el micrófono del equipo, funciona igual
con Teams, Meet, Zoom, Webex..., en cualquier navegador y en modo incógnito: no depende
del navegador ni de la plataforma, solo de lo que suena en tu computadora.

Se guardan DOS pistas separadas:
  - system.wav -> lo que dicen los demás participantes (salida de audio)
  - mic.wav    -> lo que dices tú (micrófono)
Separarlas permite etiquetar quién habla y calcular métricas personales.
"""
from __future__ import annotations

import sys
import threading
import time
from dataclasses import dataclass
from pathlib import Path

from .audio import SAMPLE_RATE, WavWriter

CHUNK_SECONDS = 0.5


def _soundcard():
    try:
        import soundcard as sc
    except ImportError as e:  # pragma: no cover - depende del entorno
        raise SystemExit(
            "Falta la dependencia de captura. Instala con: pip install 'meetnotes[capture]'"
        ) from e
    return sc


class AudioUnavailable(RuntimeError):
    """No hay servidor/dispositivos de audio utilizables en este equipo."""


def _audio_guard(fn):
    """Convierte los fallos internos de soundcard (p. ej. sin PulseAudio) en un error claro."""
    def wrapper(*a, **kw):
        try:
            return fn(*a, **kw)
        except (AssertionError, OSError, RuntimeError) as e:
            if isinstance(e, AudioUnavailable):
                raise
            raise AudioUnavailable(
                "No pude acceder al audio del equipo (¿hay servidor de audio activo? "
                f"En Linux se necesita PulseAudio/PipeWire). Detalle: {type(e).__name__}: {e}"
            ) from e
    return wrapper


@_audio_guard
def list_devices() -> dict[str, list[str]]:
    sc = _soundcard()
    return {
        "microphones": [m.name for m in sc.all_microphones(include_loopback=False)],
        "loopback (audio del sistema)": [
            m.name for m in sc.all_microphones(include_loopback=True) if m.isloopback
        ],
    }


def _find(devices, name: str | None):
    if not name:
        return None
    for d in devices:
        if name.lower() in d.name.lower():
            return d
    raise SystemExit(f"No encontré un dispositivo que contenga '{name}'. Usa: meetnotes devices")


@_audio_guard
def resolve_system_device(name: str | None):
    """Dispositivo de loopback: por defecto, el monitor de la salida predeterminada."""
    sc = _soundcard()
    loopbacks = [m for m in sc.all_microphones(include_loopback=True) if m.isloopback]
    chosen = _find(loopbacks, name)
    if chosen:
        return chosen
    default_name = sc.default_speaker().name
    for m in loopbacks:
        if default_name.lower() in m.name.lower():
            return m
    if loopbacks:
        return loopbacks[0]
    hint = ""
    if sys.platform == "darwin":
        hint = (" En macOS instala un dispositivo virtual (p. ej. BlackHole) y "
                "pasa su nombre con --system.")
    raise SystemExit("No hay dispositivo de loopback disponible." + hint)


@_audio_guard
def resolve_mic_device(name: str | None):
    sc = _soundcard()
    mics = sc.all_microphones(include_loopback=False)
    return _find(mics, name) or sc.default_microphone()


@dataclass
class Track:
    label: str
    path: Path
    device_name: str
    started_at: float = 0.0  # time.monotonic() del primer chunk
    frames: int = 0


def _record_loop(device, track: Track, stop: threading.Event, errors: list) -> None:
    chunk = int(SAMPLE_RATE * CHUNK_SECONDS)
    try:
        with WavWriter(track.path) as wav, device.recorder(
            samplerate=SAMPLE_RATE, channels=1
        ) as rec:
            track.started_at = time.monotonic()
            while not stop.is_set():
                wav.write(rec.record(numframes=chunk))
            track.frames = wav.frames
    except Exception as e:  # noqa: BLE001 - se reporta al hilo principal
        errors.append(f"{track.label}: {e}")


class Recorder:
    """Graba sistema + micrófono en hilos paralelos hasta llamar a stop()."""

    def __init__(self, session_dir: Path, system_name=None, mic_name=None, use_mic=True):
        self.session_dir = Path(session_dir)
        self.session_dir.mkdir(parents=True, exist_ok=True)
        sys_dev = resolve_system_device(system_name)
        self.tracks: list[tuple[object, Track]] = [
            (sys_dev, Track("system", self.session_dir / "system.wav", sys_dev.name))
        ]
        if use_mic:
            mic_dev = resolve_mic_device(mic_name)
            self.tracks.append(
                (mic_dev, Track("mic", self.session_dir / "mic.wav", mic_dev.name))
            )
        self._stop = threading.Event()
        self._threads: list[threading.Thread] = []
        self.errors: list[str] = []

    def start(self) -> None:
        for dev, track in self.tracks:
            t = threading.Thread(
                target=_record_loop, args=(dev, track, self._stop, self.errors), daemon=True
            )
            t.start()
            self._threads.append(t)

    def stop(self) -> list[Track]:
        self._stop.set()
        for t in self._threads:
            t.join(timeout=5)
        return [t for _, t in self.tracks]

    def offsets(self) -> dict[str, float]:
        """Segundos de desfase de cada pista respecto a la que empezó primero."""
        starts = {t.label: t.started_at for _, t in self.tracks if t.started_at}
        if not starts:
            return {}
        base = min(starts.values())
        return {k: v - base for k, v in starts.items()}
