#!/usr/bin/env python3
"""Align essay script blocks to word-level VO timings.
usage: align_essay.py script.json words.json vo_rel_path out_props.json [audio_rel_path]
words.json: list of {text,start,end} (ElevenLabs Scribe) or {"words":[...]}
"""
import json, re, sys, difflib

script = json.load(open(sys.argv[1]))
wj = json.load(open(sys.argv[2]))
words = wj["words"] if isinstance(wj, dict) else wj
words = [w for w in words if w.get("type", "word") == "word" and not w["text"].startswith("[") and not w["text"].endswith("]")]
vo_rel, out_path = sys.argv[3], sys.argv[4]
audio_rel = sys.argv[5] if len(sys.argv) > 5 else None

norm = lambda s: re.sub(r"[^\w]", "", s.lower().replace("ß", "ss"))

# flatten block text into tokens with (block idx, line, accent)
toks = []
for bi, b in enumerate(script["blocks"]):
    for line in ("top", "big"):
        txt = b.get(line) or ""
        acc = False
        for raw in txt.split():
            t = raw
            if "*" in t:
                # toggle accent at each asterisk
                starts = t.startswith("*"); ends = t.endswith("*") or t.rstrip(".,:;!?“”„\"").endswith("*")
                if starts: acc = True
                toks.append({"w": t.replace("*", ""), "bi": bi, "line": line, "accent": acc})
                if ends or t.count("*") == 2: acc = False
            else:
                toks.append({"w": t, "bi": bi, "line": line, "accent": acc})

A = [norm(t["w"]) for t in toks]
B = [norm(w["text"]) for w in words]
sm = difflib.SequenceMatcher(a=A, b=B, autojunk=False)
# map each token to a word index (or None)
m = [None] * len(A)
for tag, i1, i2, j1, j2 in sm.get_opcodes():
    if tag == "equal":
        for k in range(i2 - i1): m[i1 + k] = j1 + k
    elif tag == "replace":
        # distribute proportionally
        for k in range(i2 - i1):
            m[i1 + k] = j1 + min(j2 - j1 - 1, int(k * (j2 - j1) / max(1, i2 - i1)))
# fill gaps by interpolation between neighbours
last = None
for i in range(len(m)):
    if m[i] is None:
        # find next known
        nxt = next((m[j] for j in range(i + 1, len(m)) if m[j] is not None), None)
        m[i] = last if last is not None else (nxt if nxt is not None else 0)
    last = m[i]

for t, wi in zip(toks, m):
    t["s"] = words[wi]["start"]; t["e"] = words[wi]["end"]

dur = words[-1]["end"]
blocks = script["blocks"]
for bi, b in enumerate(blocks):
    bt = [t for t in toks if t["bi"] == bi]
    b["words"] = [{"w": t["w"], "s": round(t["s"], 3), "e": round(t["e"], 3), "line": t["line"], **({"accent": True} if t["accent"] else {})} for t in bt]
    b["_first"] = min((t["s"] for t in bt), default=None)
# block boundaries: start = first word - 0.25 s lead (but not before previous block's last word end), end = next block start
prev_end = 0.0
for bi, b in enumerate(blocks):
    if b["_first"] is None:
        b["start"] = prev_end  # text-less block (sources): starts after previous
    else:
        b["start"] = round(max(prev_end, b["_first"] - 0.25), 3)
    if bi > 0: blocks[bi - 1]["end"] = b["start"]
    lastw = max((w["e"] for w in b["words"]), default=b["start"])
    prev_end = lastw
tail = 3.2 if blocks[-1]["_first"] is None else 1.6
blocks[-1]["end"] = round(max(prev_end, blocks[-1]["start"]) + tail, 3)
for b in blocks: b.pop("_first", None)

out = {"id": script["id"], "handle": script["handle"], "align": script.get("align", "left"), "palette": script.get("palette"), "blocks": blocks, "vo": vo_rel, "duration": blocks[-1]["end"]}
if audio_rel: out["audio"] = audio_rel
json.dump({"script": out}, open(out_path, "w"), ensure_ascii=False, indent=1)
unmatched = sum(1 for a, b_ in zip(A, [B[i] for i in m]) if a != b_)
print(f"blocks={len(blocks)} words={len(words)} tokens={len(toks)} mismatched={unmatched} duration={out['duration']:.2f}s")
for b in blocks: print(f"  {b['start']:7.2f}-{b['end']:7.2f} {b.get('visual','')[:9]:9} {(b.get('top') or '')[:28]:28} | {(b.get('big') or '')[:40]}")
