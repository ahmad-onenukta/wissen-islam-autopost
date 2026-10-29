// TikTok-Upload — Content Posting API (PULL_FROM_URL)
// Ohne Audit der App ist nur "Upload in den TikTok-Entwurfsordner" erlaubt
// (/v2/post/publish/inbox/video/init/). Mit Audit + Secret TIKTOK_DIRECT=1
// wird direkt veroeffentlicht (/v2/post/publish/video/init/).
import { secret } from "../lib/brand.mjs";

export const tiktokEnabled = brand => !!(secret(brand, "TIKTOK_CLIENT_KEY") && secret(brand, "TIKTOK_CLIENT_SECRET") && secret(brand, "TIKTOK_REFRESH_TOKEN"));

async function accessToken(brand) {
  const r = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: secret(brand, "TIKTOK_CLIENT_KEY"),
      client_secret: secret(brand, "TIKTOK_CLIENT_SECRET"),
      grant_type: "refresh_token",
      refresh_token: secret(brand, "TIKTOK_REFRESH_TOKEN"),
    }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error("TikTok-Token: " + JSON.stringify(j).slice(0, 300));
  return j.access_token;
}

// Titel = erste Caption-Zeile + Hashtags (TikTok max. 2200 Zeichen)
export function tiktokTitle(entry) {
  const cap = (entry.caption || "").trim();
  const first = cap.split("\n")[0];
  const tags = (cap.match(/#[\wäöüÄÖÜß]+/g) || []).slice(0, 8).join(" ");
  return `${first} ${tags}`.slice(0, 2190);
}

export async function uploadTikTok(videoUrl, entry, brand) {
  const token = await accessToken(brand);
  const direct = secret(brand, "TIKTOK_DIRECT") === "1";
  const url = direct
    ? "https://open.tiktokapis.com/v2/post/publish/video/init/"
    : "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/";
  const body = direct
    ? { post_info: { title: tiktokTitle(entry), privacy_level: "PUBLIC_TO_EVERYONE", disable_comment: false, disable_duet: false, disable_stitch: false },
        source_info: { source: "PULL_FROM_URL", video_url: videoUrl } }
    : { source_info: { source: "PULL_FROM_URL", video_url: videoUrl } };
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok || j.error?.code !== "ok") throw new Error(`TikTok ${r.status}: ${JSON.stringify(j.error || j).slice(0, 300)}`);
  console.log(direct ? "TikTok veroeffentlicht:" : "TikTok im Entwurfsordner:", j.data?.publish_id);
  return { publish_id: j.data?.publish_id, mode: direct ? "direct" : "inbox" };
}
