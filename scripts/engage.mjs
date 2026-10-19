// NurWissen Engagement-Loop — laeuft in GitHub Actions (erreicht graph.instagram.com)
// 1. holt neue Kommentare + DMs  -> engage/inbox.json   (Claude liest, schreibt Antworten)
// 2. sendet Antworten aus         engage/outbox.json    (Claude schreibt, Action postet)
// 3. zieht Insights               -> engage/stats.json   (KPI-Report)
import fs from "node:fs";

const HOST  = process.env.IG_API_HOST || "graph.instagram.com";
const VER   = process.env.IG_API_VERSION || "v23.0";
const USER  = process.env.IG_USER_ID || "me";
const TOKEN = process.env.IG_TOKEN;
const OWN   = (process.env.IG_USERNAME || "nurwissen_official").toLowerCase();
if (!TOKEN) { console.error("FEHLT: IG_TOKEN"); process.exit(1); }

const api = async (path, params = {}, method = "GET", json = null) => {
  const url = new URL(`https://${HOST}/${VER}/${path}`);
  if (method === "GET") {
    url.search = new URLSearchParams({ ...params, access_token: TOKEN });
    const r = await fetch(url); const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw new Error(`${path}: ${JSON.stringify(j.error || j)}`);
    return j;
  }
  const opts = json
    ? { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` }, body: JSON.stringify(json) }
    : { method, body: new URLSearchParams({ ...params, access_token: TOKEN }) };
  const r = await fetch(url, opts); const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(`${path}: ${JSON.stringify(j.error || j)}`);
  return j;
};

const read  = (f, d) => fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : d;
const write = (f, v) => fs.writeFileSync(f, JSON.stringify(v, null, 2) + "\n");
fs.mkdirSync("engage", { recursive: true });

const state  = read("engage/state.json",  { seen: [], last_run: null });
const inbox  = read("engage/inbox.json",  []);
const outbox = read("engage/outbox.json", []);
const seen   = new Set(state.seen);
const now    = new Date().toISOString();

// ---------- 2. OUTBOX senden (zuerst, damit Antworten raus sind) -----------
let sent = 0;
for (const o of outbox) {
  if (o.status !== "pending") continue;
  try {
    if (o.type === "comment_reply") {
      const r = await api(`${o.comment_id}/replies`, { message: o.text }, "POST");
      o.reply_id = r.id;
    } else if (o.type === "dm") {
      await api(`${USER}/messages`, {}, "POST", { recipient: { id: o.recipient_id }, message: { text: o.text } });
    } else if (o.type === "comment") {            // eigener Kommentar unter eigenem Reel (Pin-Kommentar)
      const r = await api(`${o.media_id}/comments`, { message: o.text }, "POST");
      o.comment_id = r.id;
    }
    o.status = "sent"; o.sent_at = now; sent++;
  } catch (e) { o.status = "error"; o.error = e.message; console.log("Outbox-Fehler:", e.message); }
  await new Promise(r => setTimeout(r, 1500));   // sanftes Tempo
}
console.log(`Outbox: ${sent} gesendet`);

// ---------- 1. INBOX: neue Kommentare ---------------------------------------
const media = (await api(`${USER}/media`, {
  fields: "id,caption,timestamp,permalink,media_type,comments_count,like_count", limit: 25 })).data || [];

let newComments = 0;
for (const m of media) {
  if (!m.comments_count) continue;
  let url = `${m.id}/comments`, params = { fields: "id,text,username,timestamp,replies{id,text,username,timestamp}", limit: 50 };
  const comments = (await api(url, params)).data || [];
  for (const c of comments) {
    const all = [c, ...((c.replies && c.replies.data) || []).map(r => ({ ...r, parent_id: c.id }))];
    for (const x of all) {
      if (seen.has(x.id)) continue;
      seen.add(x.id);
      if ((x.username || "").toLowerCase() === OWN) continue;
      inbox.push({ type: "comment", id: x.id, parent_id: x.parent_id || null, media_id: m.id,
        permalink: m.permalink, username: x.username, text: x.text, timestamp: x.timestamp,
        caption_start: (m.caption || "").slice(0, 80), status: "new" });
      newComments++;
    }
  }
}

// ---------- 1b. INBOX: neue DMs ---------------------------------------------
let newDMs = 0;
try {
  const convs = (await api(`${USER}/conversations`, { platform: "instagram",
    fields: "id,updated_time,participants,messages.limit(5){id,from,message,created_time}" })).data || [];
  for (const cv of convs) {
    for (const msg of (cv.messages && cv.messages.data) || []) {
      if (seen.has(msg.id)) continue;
      seen.add(msg.id);
      const from = msg.from || {};
      if ((from.username || "").toLowerCase() === OWN) continue;
      if (!msg.message) continue;
      inbox.push({ type: "dm", id: msg.id, conversation_id: cv.id, recipient_id: from.id,
        username: from.username, text: msg.message, timestamp: msg.created_time, status: "new" });
      newDMs++;
    }
  }
} catch (e) { console.log("DM-Abfrage uebersprungen:", e.message); }
console.log(`Inbox: +${newComments} Kommentare, +${newDMs} DMs`);

// ---------- 3. STATS ----------------------------------------------------------
const stats = read("engage/stats.json", { history: [] });
try {
  const acc = await api(USER, { fields: "username,followers_count,follows_count,media_count" });
  const reels = [];
  for (const m of media) {
    let ins = {};
    try {
      const r = await api(`${m.id}/insights`, { metric: "views,reach,likes,comments,shares,saved,total_interactions" });
      for (const d of r.data || []) ins[d.name] = d.values?.[0]?.value ?? d.total_value?.value ?? null;
    } catch (e) { ins.error = e.message.slice(0, 120); }
    reels.push({ id: m.id, permalink: m.permalink, posted: m.timestamp, caption: (m.caption || "").slice(0, 60), ...ins });
  }
  stats.account = { ...acc, at: now };
  stats.reels = reels;
  stats.history.push({ at: now, followers: acc.followers_count, views_total: reels.reduce((s, r) => s + (r.views || 0), 0) });
  stats.history = stats.history.slice(-500);
} catch (e) { console.log("Stats-Fehler:", e.message); }

// ---------- speichern --------------------------------------------------------
state.seen = [...seen].slice(-5000);
state.last_run = now;
write("engage/state.json", state);
write("engage/inbox.json", inbox.filter(i => i.status !== "done").slice(-300));
write("engage/outbox.json", outbox.filter(o => o.status === "pending" || (o.sent_at && o.sent_at > new Date(Date.now() - 7 * 864e5).toISOString())));
write("engage/stats.json", stats);
console.log("Follower:", stats.account?.followers_count, "| Reels:", stats.reels?.length);
