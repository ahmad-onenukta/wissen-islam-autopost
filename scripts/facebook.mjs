// Facebook-Reel-Upload — Graph API, Page Access Token (nie ablaufend)
// Secrets: FB_PAGE_ID, FB_PAGE_TOKEN (optional mit Brand-Prefix)
import { secret } from "../lib/brand.mjs";

const VER = process.env.FB_API_VERSION || "v23.0";
export const fbEnabled = brand => !!(secret(brand, "FB_PAGE_ID") && secret(brand, "FB_PAGE_TOKEN"));

export async function uploadFacebookReel(videoUrl, entry, brand) {
  const page = secret(brand, "FB_PAGE_ID"), token = secret(brand, "FB_PAGE_TOKEN");
  const start = await (await fetch(`https://graph.facebook.com/${VER}/${page}/video_reels`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ upload_phase: "start", access_token: token }),
  })).json();
  if (!start.video_id) throw new Error("FB start: " + JSON.stringify(start).slice(0, 300));

  const up = await (await fetch(`https://rupload.facebook.com/video-upload/${VER}/${start.video_id}`, {
    method: "POST", headers: { Authorization: `OAuth ${token}`, file_url: videoUrl },
  })).json();
  if (!up.success) throw new Error("FB upload: " + JSON.stringify(up).slice(0, 300));

  const desc = (entry.caption || "").slice(0, 2190);
  const fin = await (await fetch(`https://graph.facebook.com/${VER}/${page}/video_reels?` + new URLSearchParams({
    upload_phase: "finish", video_id: start.video_id, video_state: "PUBLISHED",
    description: desc, access_token: token,
  }), { method: "POST" })).json();
  if (!fin.success) throw new Error("FB finish: " + JSON.stringify(fin).slice(0, 300));
  console.log("Facebook-Reel veroeffentlicht:", start.video_id);
  return start.video_id;
}
