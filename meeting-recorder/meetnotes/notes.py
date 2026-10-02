"""Genera apuntes estructurados y feedback personal con la API de Claude."""
from __future__ import annotations

import os

DEFAULT_MODEL = os.environ.get("MEETNOTES_MODEL", "claude-sonnet-5-5")

SYSTEM_PROMPT = """\
Eres mi asistente personal de reuniones. Recibes la transcripción automática de una \
reunión (puede tener errores de reconocimiento). "Yo" soy el usuario; "Otros" son los \
demás participantes (no se distinguen entre sí). Responde en español, en Markdown, \
conciso y sin inventar nada que no esté en la transcripción. Si algo no está claro, \
dilo explícitamente.

Usa exactamente estas secciones:

## Resumen
3-5 líneas con el objetivo y el resultado de la reunión.

## Decisiones tomadas
Lista. Si no hubo, escribe "Ninguna".

## Acciones pendientes
Tabla con columnas: Acción | Responsable | Fecha límite. Marca con ⭐ las que me \
corresponden a mí. Usa "—" si falta el dato.

## Preguntas abiertas / riesgos
Lista.

## Temas tratados
Viñetas cronológicas con la marca de tiempo aproximada [hh:mm:ss].

## Mejoras para mí
Feedback honesto y accionable, SOLO sobre mis intervenciones ("Yo"): claridad, \
estructura, momentos en que hablé demasiado o muy poco, preguntas que debí hacer, \
compromisos que asumí sin precisar fecha, y 2-3 cosas concretas para probar en la \
próxima reunión. Cita brevemente el momento [hh:mm:ss] cuando sea posible.
"""


def build_user_message(transcript: str, title: str | None, stats_md: str | None) -> str:
    parts = []
    if title:
        parts.append(f"Título de la reunión: {title}")
    if stats_md:
        parts.append("Métricas calculadas localmente:\n" + stats_md)
    parts.append("Transcripción:\n\n" + transcript)
    return "\n\n".join(parts)


def generate_notes(
    transcript: str,
    title: str | None = None,
    stats_md: str | None = None,
    model: str = DEFAULT_MODEL,
    _client=None,
) -> str:
    if _client is None:
        if not os.environ.get("ANTHROPIC_API_KEY"):
            raise RuntimeError("Falta la variable de entorno ANTHROPIC_API_KEY")
        try:
            import anthropic
        except ImportError as e:  # pragma: no cover
            raise RuntimeError("Instala con: pip install 'meetnotes[notes]'") from e
        _client = anthropic.Anthropic()
    resp = _client.messages.create(
        model=model,
        max_tokens=4000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": build_user_message(transcript, title, stats_md)}],
    )
    return "".join(b.text for b in resp.content if getattr(b, "type", "") == "text")
