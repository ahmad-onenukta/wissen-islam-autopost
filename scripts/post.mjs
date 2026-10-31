// Multi-Brand / Multi-Platform Auto-Poster — Instagram, YouTube Shorts, TikTok, Facebook
// Laeuft in GitHub Actions. Kein Metricool, kein Drittanbieter.
// Queue-Eintrag: {id, brand, file, caption, publish_at, status, targets[], first_comment, thumb_offset}
import fs from "node:fs";
import { loadBrand, secret, DEFAULT_BRAND } from "../lib/brand.mjs";

const REPO   = process.env.GITHUB_REPOSITORY;
const BRANCH = process.env.GITHUB_REF_NAME || "main";
const DRY    = process.env.DRY_RUN === "true";
const VER    = process.env.IG_API_VERSION || "v23.0";
const HOST   = process.env.IG_API_HOST || "graph.instagram.com";
const sleep  = ms => new Promise(r => setTimeout(r, ms));

// --- 0. Dashboard-Befehle anwenden (pause/move/retarget/delete) -------------
try { const m = await import("./apply_commands.mjs"); } catch (e) { console.log("Befehle-Fehler:", e.message); }

// --- 1. naechstes faelliges Reel -------------------------------------------
const queue = JSON.parse(fs.readFileSync("queue.json", "utf8"));
const now = new Date();
const next = queue.find(r => r.status === "ready" && new Date(r.publish_at) <= now);
if (!next) {
  console.log(`Nichts faellig. ${queue.filter(r => r.status === "ready").length} Reel(s) warten.`);
  process.exit(0);
}
const brand = loadBrand(next.brand || DEFAULT_BRAND);
const targets = next.targets || brand.targets || ["instagram"];
console.log(`Reel ${next.id} | Brand ${brand.slug} | Ziele: ${targets.join(", ")} | ${next.file}`);

// --- 2. oeffentliche Video-URL ---------------------------------------------
const base = secret(brand, "VIDEO_BASE_URL") || `https://raw.githubusercontent.com/${REPO}/${BRANCH}/videos`;
const videoUrl = `${base.replace(/\/$/, "")}/${encodeURIComponent(next.file)}`;
console.log("video_url ->", videoUrl);
const head = await fetch(videoUrl, { method: "HEAD" });
if (!head.ok) throw new Error(`video_url nicht erreichbar (${head.status}). Repo public oder VIDEO_BASE_URL setzen.`);

if (DRY) { console.log("DRY_RUN – nichts veroeffentlicht."); process.exit(0); }

next.results = next.results || {};
const save = () => fs.writeFileSync("queue.json", JSON.stringify(queue, null, 2) + "\n");
const step = async (name, fn) => {
  try { next.results[name] = await fn(); }
  catch (e) { next.results[name] = { error: e.message.slice(0, 300) }; console.log(`${name} fehlgeschlagen:`, e.message.slice(0, 300)); }
  save();
};

// --- 3. Instagram (Leitplattform: schlaegt fehl => Lauf schlaegt fehl) -----
let igOk = !targets.includes("instagram");
if (targets.includes("instagram")) {
  const TOKEN = secret(brand, "IG_TOKEN");
  const USER  = secret(brand, "IG_USER_ID") || "me";
  if (!TOKEN) throw new Error(`Secret IG_TOKEN(_${brand.env_prefix}) fehlt`);
  const api = async (path, params, method = "GET") => {
    const url = new URL(`https://${HOST}/${VER}/${path}`);
    const body = new URLSearchParams({ ...params, access_token: TOKEN });
    const res = method === "GET" ? await fetch(`${url}?${body}`) : await fetch(url, { method, body });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) throw new Error(`${path}: ${JSON.stringify(json.error || json)}`);
    return json;
  };
  try {
    const lim = await api(`${USER}/content_publishing_limit`, { fields: "quota_usage,config" });
    console.log("Limit:", JSON.stringify(lim.data?.[0] ?? lim));
  } catch (e) { console.log("Limit-Abfrage uebersprungen:", e.message.slice(0, 120)); }

  const p = { media_type: "REELS", video_url: videoUrl, caption: next.caption, share_to_feed: "true" };
  const thumb = Number.isFinite(+next.thumb_offset) ? String(+next.thumb_offset) : "3000";
  let container;
  try { container = await api(`${USER}/media`, { ...p, thumb_offset: thumb }, "POST"); }
  catch (e) { console.log("thumb_offset abgelehnt:", e.message.slice(0, 120)); container = await api(`${USER}/media`, p, "POST"); }
  console.log("Container:", container.id);

  let status = "IN_PROGRESS";
  for (let i = 0; i < 30 && status === "IN_PROGRESS"; i++) {
    await sleep(10000);
    const s = await api(container.id, { fields: "status_code,status" });
    status = s.status_code; console.log(`  [${i + 1}] ${status}`);
    if (status === "ERROR" || status === "EXPIRED") throw new Error(`Upload fehlgeschlagen: ${s.status || status}`);
  }
  if (status !== "FINISHED") throw new Error("Timeout beim Video-Upload");

  const published = await api(`${USER}/media_publish`, { creation_id: container.id }, "POST");
  console.log("INSTAGRAM LIVE. Media-ID:", published.id);
  next.media_id = published.id; next.results.instagram = { media_id: published.id }; igOk = true; save();

  if (next.first_comment) {
    try {
      await sleep(20000);
      const c = await api(`${published.id}/comments`, { message: next.first_comment }, "POST");
      next.first_comment_id = c.id; console.log("Erstkommentar:", c.id); save();
    } catch (e) { console.log("Erstkommentar fehlgeschlagen:", e.message.slice(0, 160)); }
  }
}

// --- 4. Nebenplattformen (Fehler brechen den Lauf nicht ab) ----------------
if (targets.includes("youtube")) await step("youtube", async () => {
  const yt = await import("./youtube.mjs");
  if (!yt.ytEnabled()) return { skipped: "keine YT_* Secrets" };
  const vid = await yt.uploadShort(`videos/${next.file}`, next);
  next.youtube_id = vid; return { video_id: vid };
});
if (targets.includes("tiktok")) await step("tiktok", async () => {
  const tt = await import("./tiktok.mjs");
  if (!tt.tiktokEnabled(brand)) return { skipped: "keine TIKTOK_* Secrets" };
  return await tt.uploadTikTok(videoUrl, next, brand);
});
if (targets.includes("facebook")) await step("facebook", async () => {
  const fb = await import("./facebook.mjs");
  if (!fb.fbEnabled(brand)) return { skipped: "keine FB_* Secrets" };
  return { video_id: await fb.uploadFacebookReel(videoUrl, next, brand) };
});

// --- 5. Queue + Log -------------------------------------------------------
if (!igOk && !Object.values(next.results).some(r => r && !r.error && !r.skipped)) {
  throw new Error("Keine Plattform erfolgreich – Queue bleibt auf ready.");
}
next.status = "posted";
next.posted_at = now.toISOString();
save();
const log = fs.existsSync("posted.json") ? JSON.parse(fs.readFileSync("posted.json", "utf8")) : [];
log.push({ id: next.id, brand: brand.slug, file: next.file, media_id: next.media_id, posted_at: next.posted_at, results: next.results });
fs.writeFileSync("posted.json", JSON.stringify(log, null, 2) + "\n");

// Video erst loeschen, wenn alle Pull-from-URL-Ziele durch sind
try { fs.unlinkSync(`videos/${next.file}`); console.log(`videos/${next.file} geloescht.`); } catch {}
console.log("Fertig:", JSON.stringify(next.results));
