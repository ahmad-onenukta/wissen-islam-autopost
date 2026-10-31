#!/bin/bash
# make_reel.sh <id> <script.json> <words.json> <vo.mp3> [cut_sec] [tempo]
# Vollautomatischer Weg von VO+Timestamps zum fertigen IG-Video.
set -eo pipefail
ID=$1; SCRIPT=$2; WORDS=$3; VOSRC=$4; CUT=${5:-0}; TEMPO=${6:-1.0}
cd "$(dirname "$0")/.."
mkdir -p build dashboard remotion/public/audio remotion/out
LOG="build/$ID-render.log"
exec > >(tee -a "$LOG") 2>&1
fail() {
  code=$?
  { echo "== Render-Fehler Reel $ID (exit $code) $(date -u +%FT%TZ) =="; tail -150 "$LOG"; } > dashboard/produce-error.log
  git config user.name  "reel-bot"  || true
  git config user.email "reel-bot@users.noreply.github.com" || true
  git add -A dashboard/produce-error.log >/dev/null 2>&1 || true
  git commit -m "produce-fehler: $ID" >/dev/null 2>&1 || true
  git pull --rebase -q >/dev/null 2>&1 || true
  git push -q origin HEAD:main >/dev/null 2>&1 || true
  # Zweiter Weg: ueber die Contents-API (funktioniert auch, wenn git push scheitert)
  AUTH=$(git config --get http.https://github.com/.extraheader || true)
  if [ -n "$AUTH" ] && [ -n "$GITHUB_REPOSITORY" ]; then
    B64=$(base64 -w0 dashboard/produce-error.log)
    SHA=$(curl -s -H "$AUTH" "https://api.github.com/repos/$GITHUB_REPOSITORY/contents/dashboard/produce-error.log?ref=main" \
      | python3 -c "import json,sys; print(json.load(sys.stdin).get('sha',''))" 2>/dev/null || true)
    python3 -c "import json,sys; d={'message':'produce-fehler: '+sys.argv[1],'content':sys.argv[2],'branch':'main'}; d.update({'sha':sys.argv[3]} if sys.argv[3] else {}); print(json.dumps(d))" "$ID" "$B64" "$SHA" > /tmp/err-body.json
    curl -s -X PUT -H "$AUTH" -H "Accept: application/vnd.github+json" --data @/tmp/err-body.json \
      "https://api.github.com/repos/$GITHUB_REPOSITORY/contents/dashboard/produce-error.log" >/dev/null || true
  fi
  exit $code
}
trap fail ERR
if [ "$CUT" != "0" ] || [ "$TEMPO" != "1.0" ]; then
  ffmpeg -v error -y -ss "$CUT" -i "$VOSRC" -af "atempo=$TEMPO,afade=t=in:st=0:d=0.08" -c:a libmp3lame -q:a 2 "remotion/public/audio/$ID-vo.mp3"
  python3 - "$WORDS" "$CUT" "$TEMPO" "scripts/$ID-words.json" <<'PY'
import json,sys
w=json.load(open(sys.argv[1])); w=w['words'] if isinstance(w,dict) else w
cut=float(sys.argv[2]); tempo=float(sys.argv[3])
w=[x for x in w if not (x['text'].startswith('[') or x['text'].endswith(']'))]
w=[x for x in w if x['end']>cut]
json.dump([{**x,'start':round((x['start']-cut)/tempo,3),'end':round((x['end']-cut)/tempo,3)} for x in w],open(sys.argv[4],'w'),ensure_ascii=False)
PY
else
  cp "$VOSRC" "remotion/public/audio/$ID-vo.mp3"; cp "$WORDS" "scripts/$ID-words.json"
fi
python3 render/align_essay.py "$SCRIPT" "scripts/$ID-words.json" "audio/$ID-vo.mp3" "remotion/public/$ID-props.json" | head -1
python3 render/events_essay.py "remotion/public/$ID-props.json" "render/$ID-events.json"
DUR=$(python3 -c "import json;print(json.load(open('remotion/public/$ID-props.json'))['script']['duration'])")
python3 render/audio.py "render/$ID-events.json" "$(python3 -c "print($DUR+3)")" "remotion/public/audio/$ID-mix.wav" >/dev/null
python3 - "$ID" <<'PY'
import json,sys
f=f"remotion/public/{sys.argv[1]}-props.json"; d=json.load(open(f)); d['script']['audio']=f"audio/{sys.argv[1]}-mix.wav"
json.dump(d,open(f,'w'),ensure_ascii=False,indent=1)
PY
cd remotion
npx remotion browser ensure >/dev/null 2>&1 || true
npx remotion render Essay "out/$ID.mp4" --props="public/$ID-props.json" --codec=h264 --crf=22 --concurrency=2 --log=error
ffmpeg -v error -y -i "out/$ID.mp4" -c:v libx264 -preset slow -crf 27 -maxrate 1400k -bufsize 2800k -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 128k "out/$ID-ig.mp4"
ffmpeg -v error -y -i "out/$ID-ig.mp4" -vf "fps=1/5,scale=216:-1,tile=6x6" -frames:v 1 "out/$ID-strip.jpg"
ls -la "out/$ID-ig.mp4"
rm -f ../dashboard/produce-error.log
