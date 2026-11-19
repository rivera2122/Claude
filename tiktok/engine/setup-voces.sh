#!/usr/bin/env bash
# Instala Piper (voz neuronal offline) y descarga voces en español a tiktok/voices/
set -euo pipefail
cd "$(dirname "$0")/.."
pip install -q piper-tts
mkdir -p voices
for v in ${VOCES:-es_MX-claude-high es_MX-ald-medium es_ES-davefx-medium es_AR-daniela-high}; do
  [ -f "voices/$v.onnx" ] && continue
  echo "Descargando $v..."
  curl -sSL "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-$v.tar.bz2" \
    | tar xj -C voices --strip-components=1 "vits-piper-$v/$v.onnx" "vits-piper-$v/$v.onnx.json"
done
ls voices
