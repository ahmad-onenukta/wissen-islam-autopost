#!/bin/bash
# make_reel.sh <id> <script.json> <words.json> <vo.mp3> [cut_sec] [tempo]
# Vollautomatischer Weg von VO+Timestamps zum fertigen IG-Video.
set -eo pipefail
ID=$1; SCRIPT=$2; WORDS=$3; VOSRC=$4; CUT=${5:-0}; TEMPO=${6:-1.0}
cd "$(dirname "$0")/.."
mkdir -p build dashboard remotion/public/audio remotion/out
LOG="build/$ID-render.log"
exec > >(tee -a "$LOG") 2>&1
melde() {
  code=${1:-$?}
  { echo "== Render-Fehler Reel $ID (exit $code) $(date -u +%FT%TZ) =="; echo "Schritt: ${2:-unbekannt}"; tail -150 "$LOG"; } > dashboard/produce-error.log
  AUTH=$(git config --get http.https://github.com/.extraheader || true)
  if [ -n "$AUTH" ] && [ -n "$GITHUB_REPOSITORY" ]; then
    B64=$(base64 -w0 dashboard/produce-error.log)
    SHA=$(curl -s -H "$AUTH" "https://api.github.com/repos/$GITHUB_REPOSITORY/contents/dashboard/produce-error.log?ref=main" \
      | python3 -c "import json,sys; print(json.load(sys.stdin).get('sha',''))" 2>/dev/null || true)
    python3 -c "import json,sys; d={'message':'produce-fehler: '+sys.argv[1],'content':sys.argv[2],'branch':'main'}; d.update({'sha':sys.argv[3]} if sys.argv[3] else {}); print(json.dumps(d))" "$ID" "$B64" "$SHA" > /tmp/err-body.json
    curl -s -X PUT -H "$AUTH" -H "Accept: application/vnd.github+json" --data @/tmp/err-body.json \
      "https://api.github.com/repos/$GITHUB_REPOSITORY/contents/dashboard/produce-error.log" >/dev/null || true
    echo "Fehler nach dashboard/produce-error.log geschrieben."
  fi
}
fail() {
  code=$?
  melde "$code" "Trap"
  git config user.name  "reel-bot"  || true
  git config user.email "reel-bot@users.noreply.github.com" || true
  git add -A dashboard/produce-error.log >/dev/null 2>&1 || true
  git commit -m "produce-fehler: $ID" >/dev/null 2>&1 || true
  git pull --rebase -q >/dev/null 2>&1 || true
  git push -q origin HEAD:main >/dev/null 2>&1 || true
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
echo "--- Browser bereitstellen ---"
npx remotion browser ensure || echo "WARNUNG: browser ensure fehlgeschlagen, Remotion laedt beim Render selbst"
echo "--- Speicher ---"; free -m | head -2 || true

# In Bloecken rendern: ein langer Remotion-Lauf stirbt auf dem GitHub-Runner
# (kein Fehler, kein Log - der Prozess wird hart beendet). Jeder Block startet
# frisch, meldet seinen Fortschritt ins Repo und wird danach zusammengefuegt.
TOTAL=$(python3 -c "import json;print(int(round(json.load(open('public/$ID-props.json'))['script']['duration']*30)))")
SEG=${SEG_FRAMES:-900}
echo "--- Render: $TOTAL Frames in Bloecken von $SEG ($(date -u +%T)) ---"
rm -f out/$ID-p*.mp4 out/$ID-concat.txt
i=0
start=0
while [ "$start" -lt "$TOTAL" ]; do
  i=$((i+1))
  end=$((start+SEG-1)); [ "$end" -ge "$TOTAL" ] && end=$((TOTAL-1))
  echo "--- Block $i: Frames $start-$end ($(date -u +%T)) ---"
  if ! npx remotion render Essay "out/$ID-p$i.mp4" --props="public/$ID-props.json" \
       --codec=h264 --crf=22 --concurrency=1 --frames=$start-$end --log=error; then
    cd ..; melde 1 "Render Block $i (Frames $start-$end)"; exit 1
  fi
  echo "file '$ID-p$i.mp4'" >> out/$ID-concat.txt
  (cd .. && node --input-type=module -e "const m=await import('./lib/report.mjs'); m.markProduced(process.env.BRAND||'nurwissen','$ID','block_$i');" >/dev/null 2>&1) || true
  start=$((end+1))
done
echo "--- Bloecke zusammenfuegen ---"
ffmpeg -v error -y -f concat -safe 0 -i "out/$ID-concat.txt" -c copy "out/$ID.mp4"
rm -f out/$ID-p*.mp4 out/$ID-concat.txt
ffmpeg -v error -y -i "out/$ID.mp4" -c:v libx264 -preset slow -crf 27 -maxrate 1400k -bufsize 2800k -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 128k "out/$ID-ig.mp4"
ffmpeg -v error -y -i "out/$ID-ig.mp4" -vf "fps=1/5,scale=216:-1,tile=6x6" -frames:v 1 "out/$ID-strip.jpg"
ls -la "out/$ID-ig.mp4"
rm -f ../dashboard/produce-error.log
