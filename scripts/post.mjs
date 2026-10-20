// Instagram Reel Auto-Poster — Instagram Graph API (kostenlos)
// Läuft in GitHub Actions. Kein Metricool, kein Drittanbieter.
import fs from "node:fs";

const HOST   = process.env.IG_API_HOST || "graph.instagram.com";
const VER    = process.env.IG_API_VERSION || "v23.0";
const USER   = process.env.IG_USER_ID || "me";
const TOKEN  = process.env.IG_TOKEN;
const REPO   = process.env.GITHUB_REPOSITORY;          // owner/repo
const BRANCH = process.env.GITHUB_REF_NAME || "main";
const DRY    = process.env.DRY_RUN === "true";

if (!TOKEN) { console.error("FEHLT: Secret IG_TOKEN"); process.exit(1); }

const api = async (path, params, method = "GET") => {
  const url = new URL(`https://${HOST}/${VER}/${path}`);
  const body = new URLSearchParams({ ...params, access_token: TOKEN });
  const res = method === "GET"
    ? await fetch(`${url}?${body}`)
    : await fetch(url, { method, body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(`${path}: ${JSON.stringify(json.error || json)}`);
  return json;
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

// --- 1. nächstes fälliges Reel aus der Queue holen ---------------------------
const queue = JSON.parse(fs.readFileSync("queue.json", "utf8"));
const now = new Date();
const next = queue.find(r => r.status === "ready" && new Date(r.publish_at) <= now);

if (!next) {
  const pending = queue.filter(r => r.status === "ready").length;
  console.log(`Nichts faellig. ${pending} Reel(s) warten in der Queue.`);
  process.exit(0);
}
console.log(`Reel ${next.id}: ${next.file}`);

// --- 2. Tageslimit pruefen ---------------------------------------------------
try {
  const lim = await api(`${USER}/content_publishing_limit`, { fields: "quota_usage,config" });
  console.log("Limit:", JSON.stringify(lim.data?.[0] ?? lim));
} catch (e) { console.log("Limit-Abfrage uebersprungen:", e.message); }

if (DRY) { console.log("DRY_RUN – es wird nichts veroeffentlicht."); process.exit(0); }

// --- 3. Container anlegen ----------------------------------------------------
// Die "Instagram API mit Instagram-Login" (graph.instagram.com) kennt KEINEN
// resumable Upload -> video_url ist Pflicht. Repo muss dafuer oeffentlich sein.
// Optional: VIDEO_BASE_URL (z.B. Supabase-Bucket) statt raw.githubusercontent.
const base = process.env.VIDEO_BASE_URL
  || `https://raw.githubusercontent.com/${REPO}/${BRANCH}/videos`;
const videoUrl = `${base.replace(/\/$/, "")}/${encodeURIComponent(next.file)}`;
console.log("video_url ->", videoUrl);

// Erreichbarkeit pruefen, sonst klare Fehlermeldung
const head = await fetch(videoUrl, { method: "HEAD" });
if (!head.ok) throw new Error(`video_url nicht oeffentlich erreichbar (${head.status}). Repo auf Public stellen oder VIDEO_BASE_URL setzen.`);

// Cover-Frame: Standard ist Frame 0 (bei uns Fade-in = dunkel). thumb_offset (ms) nimmt
// einen Frame, auf dem der Hook-Text schon steht -> bessere Klickrate im Profil-Grid.
const baseParams = { media_type: "REELS", video_url: videoUrl, caption: next.caption, share_to_feed: "true" };
const thumbOffset = Number.isFinite(+next.thumb_offset) ? String(+next.thumb_offset) : "3000";
let container;
try {
  container = await api(`${USER}/media`, { ...baseParams, thumb_offset: thumbOffset }, "POST");
} catch (e) {
  console.log("thumb_offset abgelehnt, ohne Cover-Frame weiter:", e.message.slice(0, 160));
  container = await api(`${USER}/media`, baseParams, "POST");
}
console.log("Container:", container.id);

// --- 4. auf FINISHED warten (max. 5 Min) ------------------------------------
let status = "IN_PROGRESS";
for (let i = 0; i < 30 && status === "IN_PROGRESS"; i++) {
  await sleep(10000);
  const s = await api(container.id, { fields: "status_code,status" });
  status = s.status_code;
  console.log(`  [${i + 1}] ${status}`);
  if (status === "ERROR" || status === "EXPIRED") throw new Error(`Upload fehlgeschlagen: ${s.status || status}`);
}
if (status !== "FINISHED") throw new Error("Timeout beim Video-Upload");

// --- 5. veroeffentlichen -----------------------------------------------------
const published = await api(`${USER}/media_publish`, { creation_id: container.id }, "POST");
console.log("VEROEFFENTLICHT. Media-ID:", published.id);

// --- 5b. Erstkommentar (Frage) – startet die Unterhaltung, Reichweiten-Signal --
// Text kommt aus queue.json (`first_comment`). Fehler hier brechen den Post nicht ab.
if (next.first_comment) {
  try {
    await sleep(20000);                       // Reel kurz "ankommen" lassen
    const c = await api(`${published.id}/comments`, { message: next.first_comment }, "POST");
    next.first_comment_id = c.id;
    console.log("Erstkommentar gesetzt:", c.id);
  } catch (e) { console.log("Erstkommentar fehlgeschlagen:", e.message.slice(0, 160)); }
}

// --- 6. Queue + Log zurueckschreiben ----------------------------------------
next.status = "posted";
next.posted_at = now.toISOString();
next.media_id = published.id;
fs.writeFileSync("queue.json", JSON.stringify(queue, null, 2) + "\n");

const log = fs.existsSync("posted.json") ? JSON.parse(fs.readFileSync("posted.json", "utf8")) : [];
log.push({ id: next.id, file: next.file, media_id: published.id, posted_at: next.posted_at });
fs.writeFileSync("posted.json", JSON.stringify(log, null, 2) + "\n");

// Video loeschen – Instagram hat es jetzt, das Repo bleibt klein
try { fs.unlinkSync(`videos/${next.file}`); console.log(`videos/${next.file} geloescht.`); } catch {}
console.log("Queue aktualisiert.");
