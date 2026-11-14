// Kommentar-Triage: beantwortet harmlose Kommentare sofort selbst, alles
// Inhaltliche bleibt in engage/inbox.json zur Freigabe liegen.
//
// Die Trennlinie ist bewusst eng: automatisch geht nur, was eindeutig KEINE
// Aussage ueber den Islam enthaelt - Emojis, kurzes Lob, Dank. Alles andere,
// auch jede Frage, wird einem Menschen vorgelegt. Unter diesem Kanal steht
// ein Name; eine automatisch erzeugte Glaubensaussage darf dort nicht stehen.
import fs from "node:fs";

const HOST  = process.env.IG_API_HOST || "graph.instagram.com";
const VER   = process.env.IG_API_VERSION || "v23.0";
const TOKEN = process.env.IG_TOKEN;
const TROCKEN = process.env.TRIAGE_DRY === "1";
// Deckel, damit unter einem Beitrag nie ein Schwall gleichartiger Antworten steht.
const MAX_AUTO = Number(process.env.TRIAGE_MAX || 8);
if (!TOKEN && !TROCKEN) { console.error("FEHLT: IG_TOKEN"); process.exit(1); }

const read  = (f, d) => fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : d;
const write = (f, v) => fs.writeFileSync(f, JSON.stringify(v, null, 2) + "\n");

const inbox  = read("engage/inbox.json", []);
const outbox = read("engage/outbox.json", []);
const log    = read("engage/triage-log.json", []);
const now    = new Date().toISOString();

// --- Was gilt als harmlos ----------------------------------------------------
const EMOJI = /[\p{Extended_Pictographic}\p{Emoji_Presentation}️‍]/gu;
const LOB = /^(ma\s?sha\s?a?ll?ah|subhan\s?allah|allahu\s?akbar|baraka\s?ll?ahu?\s?fik|jazak\s?all?ah(u)?\s?khair(an)?|amin|ameen|top|stark|krass|wow|respekt|sehr\s?(gut|sch(oe|ö)n|interessant)|gut|sch(oe|ö)n|interessant|danke(\s?dir)?|dankesch(oe|ö)n|vielen\s?dank|super|perfekt|genau|richtig|wahr|bravo)$/i;

// Begriffe, bei denen nie automatisch geantwortet wird - auch nicht, wenn der
// Kommentar sonst kurz und freundlich wirkt.
const HEIKEL = /(haram|halal|s[uü]nde|kufr|bid'?ah|shirk|hadith|koran|quran|sure|vers|allah\s+(sagt|hat|verbietet|erlaubt)|prophet|scheich|imam|fatwa|zins|riba|madhhab|sunnit|schiit|ahmadi|salafi|wahhab|l[uü]ge|falsch|stimmt\s+nicht|haltet?\s+ihr|warum|wieso|wie\s+kann|quelle|beleg|beweis)/i;

const harmlos = (text) => {
  const roh = String(text || "");
  if (!roh.trim()) return false;
  if (roh.includes("?")) return false;            // jede Frage geht an einen Menschen
  if (HEIKEL.test(roh)) return false;
  if (/@\w/.test(roh)) return false;              // markiert jemanden -> Mensch
  const ohneEmoji = roh.replace(EMOJI, "").trim();
  if (!ohneEmoji) return true;                    // reine Emojis
  if (ohneEmoji.length > 30) return false;
  const kern = ohneEmoji.replace(/[.!,;:\-–—"„“”'’\s]+$/u, "").replace(/^[\s"„“”'’]+/u, "").trim();
  return LOB.test(kern);
};

// Stabile Auswahl, damit derselbe Kommentar nie zwei verschiedene Antworten bekommt
const DANK = [
  "Danke dir 🙏",
  "Freut mich, dass es ankommt 🙏",
  "Danke fürs Mitlesen 🙏",
  "Danke dir — freut mich 🙏",
];
const wahl = (id) => {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return DANK[h % DANK.length];
};

// --- API ---------------------------------------------------------------------
const antworten = async (commentId, text) => {
  if (TROCKEN) { console.log(`[trocken] -> ${commentId}: ${text}`); return "trocken"; }
  const url = new URL(`https://${HOST}/${VER}/${commentId}/replies`);
  const r = await fetch(url, { method: "POST", body: new URLSearchParams({ message: text, access_token: TOKEN }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(JSON.stringify(j.error || j).slice(0, 200));
  return j.id;
};

// --- Lauf --------------------------------------------------------------------
let auto = 0, vorlage = 0, fehler = 0, vertagt = 0;
for (const e of inbox) {
  if (e.status !== "new") continue;
  if (e.type !== "comment") { e.status = "review"; vorlage++; continue; }
  if (!harmlos(e.text)) { e.status = "review"; vorlage++; continue; }
  if (auto >= MAX_AUTO) { vertagt++; continue; }   // bleibt "new", kommt im naechsten Lauf dran
  const text = wahl(e.id);
  try {
    const id = await antworten(e.id, text);
    e.status = "done"; e.auto_reply = text; e.auto_reply_id = id; e.auto_at = now;
    log.push({ at: now, comment_id: e.id, username: e.username, kommentar: e.text, antwort: text });
    auto++;
    await new Promise(r => setTimeout(r, 1500));
  } catch (err) {
    e.status = "review"; e.auto_error = String(err.message).slice(0, 200);
    console.log("Auto-Antwort fehlgeschlagen:", err.message);
    fehler++;
  }
}

write("engage/inbox.json", inbox.filter(i => i.status !== "done").slice(-300));
write("engage/outbox.json", outbox);
write("engage/triage-log.json", log.slice(-500));

const offen = inbox.filter(i => i.status === "review");
console.log(`Triage: ${auto} automatisch beantwortet, ${vorlage} zur Freigabe, ${fehler} Fehler`
  + (vertagt ? `, ${vertagt} auf den naechsten Lauf vertagt (Deckel ${MAX_AUTO})` : "") + ".");
if (offen.length) {
  console.log(`\n=== ${offen.length} Kommentare warten auf eine Antwort ===`);
  for (const o of offen.slice(-20)) {
    console.log(`- @${o.username}: ${String(o.text).replace(/\s+/g, " ").slice(0, 160)}`);
  }
}
