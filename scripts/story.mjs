// Story-Poster fuer NurWissen — laeuft 1 h nach dem Reel.
//
// Holt das zuletzt veroeffentlichte Reel ueber die API (media_url zeigt auf
// Instagrams eigene CDN) und stellt dasselbe Video als Story ein. Dadurch muss
// im Repo nichts liegen bleiben und post.mjs bleibt unveraendert.
//
// Grenzen: Stories sind auf 60 s begrenzt. Laengere Reels werden uebersprungen.
import fs from "node:fs";

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

if (!reel.media_url) { console.log("Kein media_url – uebersprungen."); process.exit(0); }
if (DRY) { console.log(`DRY RUN: wuerde Reel ${reel.id} (${ageH.toFixed(1)} h alt) als Story posten.`); process.exit(0); }

// --- als Story veroeffentlichen ---------------------------------------------
// video_url nimmt Instagrams eigene CDN-Adresse direkt an.
const container = await api(`${USER}/media`, { media_type: "STORIES", video_url: reel.media_url }, "POST");

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
