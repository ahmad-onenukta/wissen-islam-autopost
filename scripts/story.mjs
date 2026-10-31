// Story-Poster fuer NurWissen — laeuft 1 h nach dem Reel.
//
// Holt das zuletzt veroeffentlichte Reel ueber die API und stellt dasselbe Video
// als Story ein. Quelle ist zuerst die eigene mp4 im Repo, dann Instagrams CDN.
//
// Grenzen: Stories sind auf 60 s begrenzt. Laengere Reels werden uebersprungen.
import fs from "node:fs";
import { reportError, clearError } from "../lib/report.mjs";

const HOST  = process.env.IG_API_HOST || "graph.instagram.com";
const VER   = process.env.IG_API_VERSION || "v23.0";
const USER  = process.env.IG_USER_ID || "me";
const TOKEN = process.env.IG_TOKEN;
const DRY   = process.env.DRY_RUN === "true";
const MAXAGE_H = Number(process.env.STORY_MAX_AGE_H || 6);
if (!TOKEN) { console.error("FEHLT: IG_TOKEN"); process.exit(1); }

const api = async (path, params = {}, method = "GET") => {
  const url = new URL(`https://${HOST}/${VER}/${path}`);
  let opts = { method };
  if (method === "GET") url.search = new URLSearchParams({ ...params, access_token: TOKEN });
  else opts.body = new URLSearchParams({ ...params, access_token: TOKEN });
  const r = await fetch(url, opts);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(`${path}: ${JSON.stringify(j.error || j)}`);
  return j;
};

// --- juengstes eigenes Reel holen -------------------------------------------
const media = (await api(`${USER}/media`, {
  fields: "id,media_type,media_url,permalink,timestamp", limit: 5 })).data || [];
const reel = media.find(m => m.media_type === "VIDEO" || m.media_type === "REELS");
if (!reel) { console.log("Kein Reel gefunden."); process.exit(0); }

const ageH = (Date.now() - new Date(reel.timestamp).getTime()) / 36e5;
if (ageH > MAXAGE_H) {
  console.log(`Juengstes Reel ist ${ageH.toFixed(1)} h alt (Grenze ${MAXAGE_H} h) – heute wurde nichts gepostet, keine Story.`);
  process.exit(0);
}

// --- schon eine Story dafuer draussen? --------------------------------------
const log = fs.existsSync("engage/stories.json")
  ? JSON.parse(fs.readFileSync("engage/stories.json", "utf8")) : [];
if (log.some(s => s.reel_id === reel.id)) {
  console.log(`Fuer Reel ${reel.id} gibt es schon eine Story.`);
  process.exit(0);
}

// --- Video-Quellen: erst die eigene Repo-Datei, dann Instagrams CDN ----------
// Die CDN-Adresse ist signiert und wird beim Container-Bau oft abgelehnt; die
// raw.githubusercontent-Datei ist dieselbe mp4 und immer abrufbar.
const REPO   = process.env.GITHUB_REPOSITORY || "ahmad-onenukta/wissen-islam-autopost";
const BRANCH = process.env.GITHUB_REF_NAME || "main";
const posted = fs.existsSync("posted.json") ? JSON.parse(fs.readFileSync("posted.json", "utf8")) : [];
const lastPost = posted.filter(p => p.media_id === reel.id).pop() || posted[posted.length - 1] || null;
const candidates = [];
if (lastPost?.file) {
  const u = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/videos/${encodeURIComponent(lastPost.file)}`;
  try { if ((await fetch(u, { method: "HEAD" })).ok) candidates.push(u); } catch {}
}
if (reel.media_url) candidates.push(reel.media_url);
if (!candidates.length) { console.log("Keine Video-Quelle – uebersprungen."); process.exit(0); }
if (DRY) { console.log(`DRY RUN: wuerde Reel ${reel.id} (${ageH.toFixed(1)} h alt) als Story posten. Quelle: ${candidates[0]}`); process.exit(0); }

// --- als Story veroeffentlichen ---------------------------------------------
try {
  let container = null, lastErr = null;
  for (const video_url of candidates) {
    try {
      console.log("Versuche Quelle:", video_url.slice(0, 90));
      container = await api(`${USER}/media`, { media_type: "STORIES", video_url }, "POST");
      break;
    } catch (e) { lastErr = e; console.log("Quelle abgelehnt:", e.message.slice(0, 200)); }
  }
  if (!container) throw lastErr || new Error("Keine Quelle akzeptiert");

  let ok = false;
  for (let i = 0; i < 30; i++) {
    const st = await api(container.id, { fields: "status_code" });
    if (st.status_code === "FINISHED") { ok = true; break; }
    if (st.status_code === "ERROR") throw new Error("Instagram meldet ERROR beim Verarbeiten");
    await new Promise(r => setTimeout(r, 10000));
  }
  if (!ok) throw new Error("Container wurde nicht FINISHED (Timeout nach 5 Min)");

  const published = await api(`${USER}/media_publish`, { creation_id: container.id }, "POST");
  console.log(`Story veroeffentlicht: ${published.id} (aus Reel ${reel.id})`);

  fs.mkdirSync("engage", { recursive: true });
  log.push({ story_id: published.id, reel_id: reel.id, permalink: reel.permalink, at: new Date().toISOString() });
  fs.writeFileSync("engage/stories.json", JSON.stringify(log.slice(-200), null, 2) + "\n");
  clearError("story");
} catch (e) {
  reportError("story", e);
  throw e;
}
