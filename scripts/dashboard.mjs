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
  stats: { account: stats.account || null, history: (stats.history || []).slice(-180), reels: stats.reels || [] },
  engage: ["new", "done", "skip"].reduce((o, s) => (o[s] = (Array.isArray(inbox) ? inbox : []).filter(x => x.status === s).length, o), {}),
  posted_total: posted.length,
};
fs.mkdirSync("dashboard", { recursive: true });
fs.writeFileSync("dashboard/state.json", JSON.stringify(state, null, 2) + "\n");
console.log(`state.json: ${state.brands.length} Brands, ${pipeline.length} Pipeline-Karten, ${state.stats.reels.length} Reels mit Insights`);
