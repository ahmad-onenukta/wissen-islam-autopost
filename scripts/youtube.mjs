// YouTube-Shorts-Upload — YouTube Data API v3 (OAuth Refresh-Token, kein Drittanbieter)
// Wird von post.mjs nach dem Instagram-Post aufgerufen (gleiches Video, gleiche Caption).
// Manuell: node scripts/youtube.mjs <id>   (laedt videos/<datei> des Queue-Eintrags <id>)
import fs from "node:fs";

const CID  = process.env.YT_CLIENT_ID, CSEC = process.env.YT_CLIENT_SECRET, RTOK = process.env.YT_REFRESH_TOKEN;
export const ytEnabled = () => !!(CID && CSEC && RTOK);

async function accessToken() {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CID, client_secret: CSEC, refresh_token: RTOK, grant_type: "refresh_token" }),
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error("YouTube-Token: " + JSON.stringify(j));
  return j.access_token;
}

// Titel: Script-Titel (scripts/<id>-*.json) oder erster Satz der Caption, max. 100 Zeichen, + #Shorts
export function buildMeta(entry) {
  let title = "";
  try {
    const f = fs.readdirSync("scripts").find(x => x.startsWith(entry.id + "-") && x.endsWith(".json"));
    if (f) title = JSON.parse(fs.readFileSync(`scripts/${f}`, "utf8")).title || "";
  } catch {}
  if (!title) title = (entry.caption || "").split(/\n/)[0].split(/(?<=[.!?])\s/)[0];
  title = title.replace(/[*"<>]/g, "").trim();
  if (title.length > 90) title = title.slice(0, 87).replace(/\s+\S*$/, "") + "…";
  title += " #Shorts";
  const tags = [...new Set(((entry.caption || "").match(/#\w+/g) || []).map(t => t.slice(1)))].slice(0, 15);
  const description = (entry.caption || "").replace(/#\w+\s*/g, "").trim()
    + "\n\nInstagram: @nurwissen_official\n\n" + tags.map(t => "#" + t).join(" ");
  return { title, description, tags: [...tags, "Shorts", "Islam", "Wissen"] };
}

export async function uploadShort(localPath, entry) {
  const token = await accessToken();
  const meta = buildMeta(entry);
  const size = fs.statSync(localPath).size;
  const body = {
    snippet: { title: meta.title, description: meta.description, tags: meta.tags, categoryId: "27", defaultLanguage: "de", defaultAudioLanguage: "de" },
    status:  { privacyStatus: process.env.YT_PRIVACY || "public", selfDeclaredMadeForKids: false, madeForKids: false, containsSyntheticMedia: true },
  };
  const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Length": String(size), "X-Upload-Content-Type": "video/mp4" },
    body: JSON.stringify(body),
  });
  if (!init.ok) throw new Error(`YouTube init ${init.status}: ${await init.text()}`);
  const loc = init.headers.get("location");
  const up = await fetch(loc, { method: "PUT", headers: { "Content-Type": "video/mp4", "Content-Length": String(size) }, body: fs.readFileSync(localPath) });
  const j = await up.json().catch(() => ({}));
  if (!up.ok || !j.id) throw new Error(`YouTube upload ${up.status}: ${JSON.stringify(j).slice(0, 300)}`);
  console.log(`YOUTUBE SHORT: https://youtube.com/shorts/${j.id}  (${j.status?.privacyStatus}${j.status?.uploadStatus ? ", " + j.status.uploadStatus : ""})`);
  return j.id;
}

// --- CLI ------------------------------------------------------------------------
if (process.argv[1] && process.argv[1].endsWith("youtube.mjs")) {
  const id = process.argv[2];
  if (!id) { console.error("Aufruf: node scripts/youtube.mjs <id>"); process.exit(1); }
  if (!ytEnabled()) { console.error("FEHLT: YT_CLIENT_ID / YT_CLIENT_SECRET / YT_REFRESH_TOKEN"); process.exit(1); }
  const queue = JSON.parse(fs.readFileSync("queue.json", "utf8"));
  const entry = queue.find(q => q.id === id);
  if (!entry) { console.error("Nicht in queue.json:", id); process.exit(1); }
  if (entry.youtube_id) { console.log("Schon auf YouTube:", entry.youtube_id); process.exit(0); }
  const file = `videos/${entry.file}`;
  if (!fs.existsSync(file)) { console.error("Video fehlt:", file); process.exit(1); }
  entry.youtube_id = await uploadShort(file, entry);
  fs.writeFileSync("queue.json", JSON.stringify(queue, null, 2) + "\n");
}
