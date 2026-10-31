// Aggregiert den Fabrik-Zustand in dashboard/state.json (Datenquelle des Dashboards, same-origin via GitHub Pages)
import fs from "node:fs";
import { listBrands, DEFAULT_BRAND } from "../lib/brand.mjs";

const j = (p, d) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return d; } };
const queue  = j("queue.json", []);
const posted = j("posted.json", []);
const stats  = j("engage/stats.json", {});
const inbox  = j("engage/inbox.json", []);
const brands = listBrands();

const scriptDirs = slug => [`brands/${slug}/scripts`, ...(slug === DEFAULT_BRAND ? ["scripts"] : [])].filter(d => fs.existsSync(d));
const orderOf = slug => scriptDirs(slug).flatMap(d => fs.existsSync(`${d}/ORDER.txt`)
  ? (fs.readFileSync(`${d}/ORDER.txt`, "utf8").match(/^\d{3}/gm) || []) : []);

const reelById = new Map((stats.reels || []).map(r => [r.id, r]));
const qOf = (slug, id) => queue.find(x => x.id === id && (x.brand || DEFAULT_BRAND) === slug);

const pipeline = [];
for (const b of brands) {
  const order = orderOf(b.slug);
  const seen = new Set();
  for (const d of scriptDirs(b.slug)) {
    for (const f of fs.readdirSync(d).filter(f => /^\d{3}.*\.json$/.test(f))) {
      const id = f.slice(0, 3);
      if (seen.has(id)) continue; seen.add(id);
      const s = j(`${d}/${f}`, {});
      const src = Array.isArray(s.sources) ? s.sources : [];
      const verified = src.filter(x => x.verified).length;
      const ok = src.length > 0 && verified === src.length;
      const q = qOf(b.slug, id);
      const stage = q ? (q.status === "posted" ? "live" : q.status === "paused" ? "paused" : "queued")
                      : (ok ? "checked" : "script");
      const m = q?.media_id ? reelById.get(q.media_id) : null;
      pipeline.push({
        brand: b.slug, id, title: s.title || "", thema: s.thema || "", hook: (s.hook || "").slice(0, 180),
        voice: s.voice || b.voice?.default || "", stage,
        fact_check: ok ? "ok" : (src.length ? "offen" : "fehlt"),
        sources: { total: src.length, verified },
        source_list: src.slice(0, 12).map(x => ({ claim: (x.claim || "").slice(0, 160), ref: (x.ref || "").slice(0, 120), url: x.url || "", verified: !!x.verified })),
        publish_at: q?.publish_at || q?.posted_at || null,
        targets: q?.targets || b.targets || ["instagram"],
        results: q?.results || null,
        media_id: q?.media_id || null,
        permalink: m?.permalink || null,
        metrics: m ? { views: m.views, reach: m.reach, likes: m.likes, comments: m.comments, shares: m.shares, saved: m.saved } : null,
        order_rank: order.indexOf(id) < 0 ? 999 : order.indexOf(id),
      });
    }
  }
}

// Queue-Eintraege ohne Script-Datei (aeltere Reels) nachtragen
for (const q of queue) {
  const slug = q.brand || DEFAULT_BRAND;
  if (pipeline.some(p => p.brand === slug && p.id === q.id)) continue;
  const m = q.media_id ? reelById.get(q.media_id) : null;
  pipeline.push({ brand: slug, id: q.id, title: (q.caption || "").split("\n")[0].slice(0, 90), thema: "", hook: "",
    voice: "", stage: q.status === "posted" ? "live" : q.status === "paused" ? "paused" : "queued",
    fact_check: "–", sources: { total: 0, verified: 0 }, source_list: [],
    publish_at: q.publish_at || q.posted_at || null, targets: q.targets || ["instagram"], results: q.results || null,
    media_id: q.media_id || null, permalink: m?.permalink || null,
    metrics: m ? { views: m.views, reach: m.reach, likes: m.likes, comments: m.comments, shares: m.shares, saved: m.saved } : null,
    order_rank: 999 });
}

const state = {
  generated_at: new Date().toISOString(),
  brands: brands.map(b => {
    const p = pipeline.filter(x => x.brand === b.slug);
    const live = p.filter(x => x.stage === "live" && x.metrics);
    const views = live.reduce((s, x) => s + (x.metrics.views || 0), 0);
    const inter = live.reduce((s, x) => s + (x.metrics.likes + x.metrics.shares + x.metrics.saved + x.metrics.comments || 0), 0);
    const reach = live.reduce((s, x) => s + (x.metrics.reach || 0), 0);
    return {
      slug: b.slug, name: b.name, niche: b.niche, active: b.active !== false,
      accent: b.palette?.accent, bg: b.palette?.bg, targets: b.targets, slot: b.schedule?.slot_berlin,
      handle: b.handle, voice: b.voice?.default,
      followers: b.slug === DEFAULT_BRAND ? (stats.account?.followers_count ?? null) : null,
      counts: ["script", "checked", "queued", "paused", "live"].reduce((o, s) => (o[s] = p.filter(x => x.stage === s).length, o), {}),
      runway_days: p.filter(x => x.stage === "queued").length,
      next: p.filter(x => x.stage === "queued").map(x => x.publish_at).sort()[0] || null,
      views_total: views, avg_views: live.length ? Math.round(views / live.length) : 0,
      engagement_rate: reach ? +(inter / reach * 100).toFixed(1) : null,
    };
  }),
  pipeline: pipeline.sort((a, b) => (a.order_rank - b.order_rank) || a.id.localeCompare(b.id)),
  stats: { account: stats.account || null, history: (stats.history || []).slice(-200), reels: stats.reels || [] },
  engage: ["new", "done", "skip"].reduce((o, s) => (o[s] = (Array.isArray(inbox) ? inbox : []).filter(x => x.status === s).length, o), {}),
  posted_total: posted.length,
};
// ---------- Health / Alarme (Fabrik-Waechter) --------------------------------
const engState = j("engage/state.json", {});
const produceErr = fs.existsSync("dashboard/produce-error.log") ? fs.readFileSync("dashboard/produce-error.log", "utf8") : "";
const MIN_RUNWAY = Number(process.env.MIN_RUNWAY || 3);
const lastPost = posted.map(p => p.posted_at || p.at || null).filter(Boolean).sort().pop()
  || queue.filter(q => q.status === "posted").map(q => q.posted_at || q.publish_at).filter(Boolean).sort().pop() || null;
const hrs = t => t ? Math.round((Date.now() - new Date(t)) / 36e5) : null;
const alerts = [];
for (const b of state.brands) {
  const p = pipeline.filter(x => x.brand === b.slug);
  const checked = p.filter(x => x.stage === "checked").length;
  if (b.active && b.runway_days < MIN_RUNWAY)
    alerts.push({ level: b.runway_days <= 1 ? "error" : "warn", brand: b.slug,
      text: `Vorrat nur ${b.runway_days} Tag(e) in der Queue (Soll ${MIN_RUNWAY}). ${checked} gepruefte Scripts warten auf Produktion.`,
      action: "produce" });
  if (b.active && checked > 0 && b.runway_days < MIN_RUNWAY && !produceErr)
    alerts.push({ level: "error", brand: b.slug,
      text: "Produktion liefert nicht: gepruefte Scripts da, aber keine neuen Videos. Secret ELEVENLABS_API_KEY pruefen, dann Workflow »Reel produzieren« starten.",
      action: "secrets" });
}
if (hrs(lastPost) !== null && hrs(lastPost) > 36)
  alerts.push({ level: "error", text: `Letzter Post vor ${hrs(lastPost)} h – Posting-Workflow pruefen.`, action: "actions" });
if (hrs(engState.last_run) !== null && hrs(engState.last_run) > 12)
  alerts.push({ level: "warn", text: `Engagement-Lauf vor ${hrs(engState.last_run)} h – GitHub drosselt Cron.`, action: "actions" });
for (const [f, label] of [["dashboard/produce-error.log", "Produktion"], ["dashboard/story-error.log", "Story"]]) {
  if (!fs.existsSync(f)) continue;
  const txt = fs.readFileSync(f, "utf8");
  if (/quota_exceeded|credits remaining/i.test(txt)) {
    const left = (txt.match(/You have (\d+) credits remaining/i) || [])[1];
    alerts.push({ level: "error", action: "elevenlabs",
      text: `ElevenLabs-Guthaben aufgebraucht${left ? ` (${left} Credits uebrig)` : ""} – ohne Credits kein Voice-Over und damit kein neues Reel. Plan aufladen, danach laeuft die Produktion von selbst weiter.` });
    continue;
  }
  const line = (txt.split("\n").find(l => /error|Error|FEHLT|not found|failed/i.test(l)) || txt.split("\n")[0] || "").slice(0, 220);
  alerts.push({ level: "error", text: `${label} abgebrochen: ${line}`, action: "actions" });
}
const errCards = pipeline.filter(x => x.results && Object.values(x.results).some(r => r && r.error));
for (const x of errCards)
  alerts.push({ level: "error", brand: x.brand, text: `Reel ${x.id}: Posting-Fehler auf ${Object.entries(x.results).filter(([, r]) => r && r.error).map(([k]) => k).join(", ")}.`, action: "actions" });

state.health = {
  min_runway: MIN_RUNWAY,
  last_post: lastPost, last_post_hours: hrs(lastPost),
  last_engage: engState.last_run || null, last_engage_hours: hrs(engState.last_run),
  scripts_total: pipeline.length,
  videos_ready: queue.filter(q => q.status === "ready").length,
  alerts,
  status: alerts.some(a => a.level === "error") ? "error" : alerts.length ? "warn" : "ok",
};
state.jobs = [
  { name: "Reel produzieren", file: "produce.yml", cron: "0 4 * * *", does: "Script -> Voice-Over -> Remotion -> Queue" },
  { name: "Reel posten", file: "post-reel.yml", cron: "0 11,14 * * * (wartet auf 18:00 UTC)", does: "Instagram + YouTube + TikTok + Facebook" },
  { name: "Story posten", file: "post-story.yml", cron: "taeglich 20:00 Berlin", does: "Story zum Reel" },
  { name: "Engagement", file: "engage.yml", cron: "17 */2 * * *", does: "Kommentare/DMs/Insights + Dashboard-State" },
  { name: "Token erneuern", file: "refresh-token.yml", cron: "1. + 15.", does: "IG-Token verlaengern (braucht GH_PAT)" },
];

const out = JSON.stringify(state, null, 2) + "\n";
fs.mkdirSync("dashboard", { recursive: true });
fs.writeFileSync("dashboard/state.json", out);
// zweite Kopie im engage/-Pfad: dieser Ordner wird vom Engagement-Workflow alle 2 h committet,
// deshalb bleibt das Dashboard auch ohne eigenen dashboard.yml-Workflow aktuell.
fs.mkdirSync("engage", { recursive: true });
fs.writeFileSync("engage/dashboard.json", out);
console.log(`state.json: ${state.brands.length} Brands, ${pipeline.length} Pipeline-Karten, ${state.stats.reels.length} Reels mit Insights, Status ${state.health.status} (${alerts.length} Alarm(e))`);
