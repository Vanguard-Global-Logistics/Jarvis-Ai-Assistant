#!/bin/bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="$DIR/live_voice_loop_r13_3.py"
EXPECTED="c2def17750c7c0262f6b13ec2d55c222074727a290192ebbe40cd88dd1469888"

cat \
  "$DIR/live_voice_loop.parts/00.py.part" \
  "$DIR/live_voice_loop.parts/01.py.part" \
  "$DIR/live_voice_loop.parts/02.py.part" \
  "$DIR/live_voice_loop.parts/03.py.part" \
  "$DIR/live_voice_loop.parts/04.py.part" \
  "$DIR/live_voice_loop.parts/05.py.part" \
  > "$OUT"

ACTUAL="$(shasum -a 256 "$OUT" | awk '{print $1}')"
if [ "$ACTUAL" != "$EXPECTED" ]; then
  echo "R13.3 live voice loop reconstruction FAILED" >&2
  echo "expected: $EXPECTED" >&2
  echo "actual:   $ACTUAL" >&2
  rm -f "$OUT"
  exit 1
fi

chmod 700 "$OUT"
echo "R13.3 live voice loop reconstruction: PASS"
echo "SHA-256: $ACTUAL"
