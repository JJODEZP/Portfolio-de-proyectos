#!/usr/bin/env bash
# Instala `meetnotes` como comando global en macOS/Linux.
# Uso: ./install.sh            (captura + transcripción + apuntes con Claude)
#      EXTRAS=capture,transcribe ./install.sh   (sin IA para los apuntes)
set -euo pipefail

EXTRAS="${EXTRAS:-all}"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PREFIX="${MEETNOTES_HOME:-$HOME/.meetnotes}"
BIN="${MEETNOTES_BIN:-$HOME/.local/bin}"

PY="$(command -v python3 || true)"
[ -n "$PY" ] || { echo "Necesitas Python 3.10+ (https://www.python.org/downloads/)"; exit 1; }
"$PY" -c 'import sys; sys.exit(sys.version_info < (3, 10))' \
  || { echo "Se requiere Python >= 3.10 (tienes $("$PY" -V))"; exit 1; }

case "$(uname -s)" in
  Linux)  command -v pactl >/dev/null 2>&1 \
            || echo "Aviso: no encuentro 'pactl' (PulseAudio/PipeWire). Instala pulseaudio-utils o pipewire-pulse para capturar el audio del sistema." ;;
  Darwin) echo "Aviso macOS: para capturar el audio del sistema instala BlackHole (brew install blackhole-2ch) y usa --system BlackHole." ;;
esac

echo "→ Creando entorno en $PREFIX"
"$PY" -m venv "$PREFIX/venv"
"$PREFIX/venv/bin/pip" install --quiet --upgrade pip
"$PREFIX/venv/bin/pip" install --quiet "$SRC[$EXTRAS]"

mkdir -p "$BIN"
ln -sf "$PREFIX/venv/bin/meetnotes" "$BIN/meetnotes"
echo "✔ Instalado: $BIN/meetnotes"
case ":$PATH:" in *":$BIN:"*) ;; *) echo "Añade $BIN a tu PATH:  export PATH=\"$BIN:\$PATH\"" ;; esac
echo "Prueba con:  meetnotes devices"
