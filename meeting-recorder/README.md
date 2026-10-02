# meetnotes — apuntes de reuniones desde tu propia computadora

Graba el audio **del sistema operativo** (no del navegador ni de la plataforma), así que
funciona igual con **Teams, Meet, Zoom, Webex…**, en cualquier navegador y en **modo incógnito**.
Después transcribe en local y genera apuntes + **mejoras personales**.

```
 Audio del sistema (loopback) ─┐                       ┌─> transcript.md   (quién dijo qué, con hora)
                               ├─> Whisper local ─────┼─> stats.json      (métricas locales)
 Tu micrófono ─────────────────┘                       └─> notes.md        (resumen, decisiones, acciones,
                                                                            "Mejoras para mí")
```

Dos pistas separadas (`system.wav` = los demás, `mic.wav` = tú) permiten etiquetar **Yo / Otros** y
que el feedback sea solo sobre tu participación.

## Instalación

```bash
cd meeting-recorder
pip install -e '.[all]'          # o solo: '.[capture,transcribe]' si no usarás IA para los apuntes
export ANTHROPIC_API_KEY=...     # opcional: apuntes con Claude (sin clave, obtienes transcripción + métricas)
```

Whisper se ejecuta en tu equipo (la primera vez descarga el modelo). El audio nunca sale de tu
computadora; a Claude solo se envía el **texto** de la transcripción.

### Requisitos por sistema operativo

| SO | Audio del sistema | Nota |
|----|-------------------|------|
| Windows | Loopback WASAPI nativo | Funciona sin nada extra |
| Linux | Monitor de PulseAudio/PipeWire | Funciona sin nada extra |
| macOS | Requiere un dispositivo virtual como [BlackHole](https://github.com/ExistentialAudio/BlackHole) | Crea un "Dispositivo de salida múltiple" (altavoces + BlackHole) y usa `--system BlackHole` |

## Uso

```bash
meetnotes devices                         # ver dispositivos disponibles
meetnotes record -n "Sync de producto"    # graba; Ctrl+C para terminar y generar apuntes
meetnotes record --no-process             # solo grabar; procesar después
meetnotes process ~/MeetNotes/2026-10-02_1000_sync-de-producto -n "Sync de producto"
```

Opciones útiles: `--language es`, `--whisper-model medium` (más preciso, más lento),
`--no-llm` (sin IA), `--system/--mic <nombre parcial>`, `--no-mic`.

Las sesiones se guardan en `~/MeetNotes/<fecha>_<nombre>/`.

## Qué incluye `notes.md`

Resumen · Decisiones · Acciones (⭐ las mías) · Preguntas abiertas/riesgos · Temas con hora ·
**Mejoras para mí** (feedback accionable sobre mis intervenciones) · **Métricas** locales: % de tiempo
hablando, palabras/min, turno más largo, preguntas hechas y muletillas.

## Consejos

- Usa **audífonos** si puedes. Con altavoces el micrófono recoge a los demás; el programa descarta
  ese eco por similitud de texto, pero no es perfecto.
- Se puede grabar sin aviso técnico (no es un bot que se une a la reunión), por eso:

> ⚠ **Consentimiento.** Grabar a otras personas puede requerir su permiso según tu país
> (en varios lugares todas las partes deben consentir), la política de tu empresa y la de la
> reunión. Avisa a los participantes. La herramienta lo recuerda cada vez que empiezas a grabar.

## Estado y límites

- Probado con pruebas unitarias (`pytest`) usando audio sintético y un transcriptor simulado.
  **La captura con hardware real no se probó** en este entorno: si algún SO falla, revisa
  `meetnotes devices` y pasa el nombre del dispositivo con `--system` / `--mic`.
- No distingue entre varios participantes (todos son "Otros").
- Ideas siguientes: detección automática de reunión, atajo global de inicio/fin, diarización,
  exportar a Notion/Drive.

## Desarrollo

```bash
pip install -e '.[dev]' && pytest
```
