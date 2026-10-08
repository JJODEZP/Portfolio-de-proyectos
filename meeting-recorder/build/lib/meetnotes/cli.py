"""CLI: meetnotes devices | record | process"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from datetime import datetime
from pathlib import Path

from . import __version__
from .audio import duration_seconds
from .notes import DEFAULT_MODEL, generate_notes
from .stats import compute_stats, format_stats
from .transcribe import (
    SPEAKER_LABELS,
    format_transcript,
    merge_tracks,
    transcribe_file,
)

CONSENT = (
    "⚠  Recuerda: grabar a otras personas puede requerir su consentimiento según tu país, "
    "tu empresa y la política de la reunión. Avisa a los participantes.\n"
)


def default_root() -> Path:
    return Path.home() / "MeetNotes"


def _slug(text: str) -> str:
    return re.sub(r"[^\w-]+", "-", text.strip().lower()).strip("-") or "reunion"


def new_session_dir(root: Path, name: str | None) -> Path:
    stamp = datetime.now().strftime("%Y-%m-%d_%H%M")
    return Path(root) / f"{stamp}_{_slug(name or 'reunion')}"


def process_session(
    session: Path,
    whisper_model: str = "small",
    language: str | None = None,
    llm: bool = True,
    llm_model: str = DEFAULT_MODEL,
    title: str | None = None,
    offsets: dict[str, float] | None = None,
) -> None:
    session = Path(session)
    if offsets is None:
        meta = session / "meta.json"
        offsets = json.loads(meta.read_text()).get("offsets", {}) if meta.exists() else {}

    tracks = []
    for label, speaker in SPEAKER_LABELS.items():
        wav = session / f"{label}.wav"
        if wav.exists() and duration_seconds(wav) > 0.5:
            print(f"→ Transcribiendo {wav.name} ({speaker})...")
            tracks.append(
                transcribe_file(
                    wav, speaker, whisper_model, language, offset=offsets.get(label, 0.0)
                )
            )
    if not tracks:
        raise SystemExit(f"No hay audio utilizable en {session}")

    segments = merge_tracks(*tracks)
    transcript = format_transcript(segments)
    (session / "transcript.md").write_text(transcript, encoding="utf-8")

    stats = compute_stats(segments)
    (session / "stats.json").write_text(json.dumps(stats, ensure_ascii=False, indent=2))
    stats_md = format_stats(stats)

    body = f"# {title or session.name}\n\n"
    if llm:
        try:
            print("→ Generando apuntes con Claude...")
            body += generate_notes(transcript, title, stats_md, llm_model) + "\n\n"
        except RuntimeError as e:
            print(f"  (sin apuntes con IA: {e}). Se guardan transcripción y métricas.")
    body += stats_md
    (session / "notes.md").write_text(body, encoding="utf-8")
    print(f"✔ Listo: {session / 'notes.md'}")


def cmd_devices(_args) -> None:
    from .capture import AudioUnavailable, list_devices

    try:
        devices = list_devices()
    except AudioUnavailable as e:
        raise SystemExit(str(e)) from e
    for group, names in devices.items():
        print(f"{group}:")
        for n in names:
            print(f"  - {n}")


def cmd_record(args) -> None:
    from .capture import AudioUnavailable, Recorder

    print(CONSENT)
    session = new_session_dir(Path(args.output), args.name)
    try:
        rec = Recorder(session, args.system, args.mic, use_mic=not args.no_mic)
    except AudioUnavailable as e:
        raise SystemExit(str(e)) from e
    for _, t in rec.tracks:
        print(f"  {t.label}: {t.device_name}")
    rec.start()
    start = time.monotonic()
    print("● Grabando. Pulsa Ctrl+C para terminar.")
    try:
        while True:
            time.sleep(1)
            if rec.errors:
                print("Error de captura:", "; ".join(rec.errors), file=sys.stderr)
                break
            print(f"\r  {int(time.monotonic() - start) // 60:02d}:"
                  f"{int(time.monotonic() - start) % 60:02d}", end="", flush=True)
    except KeyboardInterrupt:
        pass
    print("\n■ Deteniendo...")
    rec.stop()
    offsets = rec.offsets()
    (session / "meta.json").write_text(
        json.dumps({"name": args.name, "offsets": offsets}, ensure_ascii=False)
    )
    if args.no_process:
        print(f"Audio guardado en {session}. Procesa luego con: meetnotes process {session}")
        return
    process_session(
        session, args.whisper_model, args.language, not args.no_llm, args.llm_model,
        args.name, offsets,
    )


def cmd_process(args) -> None:
    process_session(
        Path(args.session), args.whisper_model, args.language, not args.no_llm,
        args.llm_model, args.name,
    )


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="meetnotes", description=__doc__)
    p.add_argument("--version", action="version", version=__version__)
    sub = p.add_subparsers(dest="cmd", required=True)

    def add_processing(sp):
        sp.add_argument("--whisper-model", default="small",
                        help="tiny/base/small/medium/large-v3 (más grande = más preciso y lento)")
        sp.add_argument("--language", default=None, help="p. ej. es, en (por defecto autodetecta)")
        sp.add_argument("--no-llm", action="store_true", help="solo transcripción y métricas")
        sp.add_argument("--llm-model", default=DEFAULT_MODEL)

    sub.add_parser("devices", help="lista micrófonos y dispositivos de loopback").set_defaults(
        func=cmd_devices)

    r = sub.add_parser("record", help="graba la reunión y genera apuntes al terminar")
    r.add_argument("-n", "--name", help="nombre de la reunión")
    r.add_argument("-o", "--output", default=str(default_root()))
    r.add_argument("--system", help="nombre (parcial) del dispositivo de loopback")
    r.add_argument("--mic", help="nombre (parcial) del micrófono")
    r.add_argument("--no-mic", action="store_true", help="solo audio del sistema")
    r.add_argument("--no-process", action="store_true", help="solo grabar, procesar después")
    add_processing(r)
    r.set_defaults(func=cmd_record)

    pr = sub.add_parser("process", help="transcribe y genera apuntes de una sesión grabada")
    pr.add_argument("session", help="carpeta con system.wav y/o mic.wav")
    pr.add_argument("-n", "--name", help="título de la reunión")
    add_processing(pr)
    pr.set_defaults(func=cmd_process)
    return p


def main(argv: list[str] | None = None) -> None:
    args = build_parser().parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
