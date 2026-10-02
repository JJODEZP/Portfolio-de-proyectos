"""Métricas personales 100 % locales (no usan ningún LLM ni red)."""
from __future__ import annotations

import re

from .transcribe import Segment

# Muletillas frecuentes en español e inglés. Se cuentan como palabra/frase completa.
FILLERS = [
    "este", "o sea", "eh", "em", "mmm", "básicamente", "digamos", "tipo", "como que",
    "la verdad", "en realidad", "no sé", "¿no?", "um", "uh", "like", "you know",
    "basically", "actually", "kind of", "sort of",
]


def _words(text: str) -> list[str]:
    return re.findall(r"[\wáéíóúñü']+", text.lower())


def count_fillers(text: str) -> dict[str, int]:
    lowered = text.lower()
    out = {}
    for f in FILLERS:
        n = len(re.findall(rf"(?<![\wáéíóúñü]){re.escape(f)}(?![\wáéíóúñü])", lowered))
        if n:
            out[f] = n
    return dict(sorted(out.items(), key=lambda kv: -kv[1]))


def compute_stats(segments: list[Segment]) -> dict:
    mine = [s for s in segments if s.speaker == "Yo"]
    others = [s for s in segments if s.speaker == "Otros"]
    my_time = sum(s.end - s.start for s in mine)
    other_time = sum(s.end - s.start for s in others)
    total = my_time + other_time
    my_text = " ".join(s.text for s in mine)
    my_words = len(_words(my_text))
    longest = max((s.end - s.start for s in mine), default=0.0)
    return {
        "total_speaking_seconds": round(total, 1),
        "my_speaking_seconds": round(my_time, 1),
        "others_speaking_seconds": round(other_time, 1),
        "my_talk_ratio": round(my_time / total, 2) if total else 0.0,
        "my_words": my_words,
        "my_words_per_minute": round(my_words / (my_time / 60), 1) if my_time else 0.0,
        "my_longest_turn_seconds": round(longest, 1),
        "my_interventions": len(mine),
        "my_fillers": count_fillers(my_text),
        "my_questions": my_text.count("?"),
    }


def format_stats(stats: dict) -> str:
    fillers = ", ".join(f"{k} ×{v}" for k, v in stats["my_fillers"].items()) or "ninguna"
    return (
        "## Métricas de mi participación\n"
        f"- Tiempo hablando: {stats['my_speaking_seconds']} s "
        f"({int(stats['my_talk_ratio'] * 100)} % de la conversación)\n"
        f"- Ritmo: {stats['my_words_per_minute']} palabras/min · "
        f"{stats['my_words']} palabras en {stats['my_interventions']} intervenciones\n"
        f"- Intervención más larga: {stats['my_longest_turn_seconds']} s\n"
        f"- Preguntas formuladas: {stats['my_questions']}\n"
        f"- Muletillas: {fillers}\n"
    )
