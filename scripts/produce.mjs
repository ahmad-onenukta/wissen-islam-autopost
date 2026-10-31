// NurWissen Produktion — Schritt 1: Voice-Over + Wort-Timestamps per ElevenLabs-API
// Aufruf: node scripts/produce.mjs <id>   (liest scripts/<id>.json, schreibt build/<id>-vo.mp3 + build/<id>-words.json)
import fs from "node:fs";
import { reportError, clearError } from "../lib/report.mjs";

const id  = process.argv[2];
const KEY = process.env.ELEVENLABS_API_KEY;
if (!id || !KEY) { console.error("Aufruf: node scripts/produce.mjs <id>  (ELEVENLABS_API_KEY noetig)"); process.exit(1); }

const VOICES = {
  robert:  process.env.VOICE_ROBERT  || "ML23UVoFL5mI6APbRAeR",   // Robert Ranger – Deep & Cool Storytelling
  sabrina: process.env.VOICE_SABRINA || "cqPdIo76zSHFDcSZpFov",   // Sabrina – Authentic, Expressive, Engaging
};
const MODEL = process.env.ELEVEN_MODEL || "eleven_v3";

const scriptPath = fs.existsSync(`scripts/${id}.json`) ? `scripts/${id}.json`
  : fs.readdirSync("scripts").filter(f => f.startsWith(id + "-") && f.endsWith(".json")).map(f => `scripts/${f}`)[0];
if (!scriptPath) { console.error("Script nicht gefunden:", id); process.exit(1); }
const script = JSON.parse(fs.readFileSync(scriptPath, "utf8"));
const voiceId = VOICES[(script.voice || "robert").toLowerCase()] || VOICES.robert;

// [pause] -> SSML-Break (eleven_v3 versteht <break>), Direktiven-Tags raus
const text = (script.vo_full || script.blocks.map(b => `${b.top || ""} ${b.big || ""}`).join(" "))
  .replace(/\[pause\]/gi, '<break time="0.7s" />')
  .replace(/\*/g, "")
  .replace(/\s+/g, " ").trim();

fs.mkdirSync("build", { recursive: true });

// --- TTS ---------------------------------------------------------------------
console.log(`TTS ${id}: voice=${script.voice} model=${MODEL} chars=${text.length}`);
const tts = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
  method: "POST",
  headers: { "xi-api-key": KEY, "Content-Type": "application/json" },
  body: JSON.stringify({
    text, model_id: MODEL, language_code: "de",
    voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true },
  }),
});
if (!tts.ok) {
  const body = await tts.text();
  console.error("TTS-Fehler", tts.status, body);
  reportError("produce", new Error(`ElevenLabs TTS ${tts.status} bei Reel ${id}: ${body.slice(0, 600)}`));
  process.exit(1);
}
const mp3 = Buffer.from(await tts.arrayBuffer());
fs.writeFileSync(`build/${id}-vo.mp3`, mp3);
console.log(`VO: ${(mp3.length / 1048576).toFixed(2)} MB`);

// --- STT fuer Wort-Timestamps (gleiches Format wie Connector-Transkription) ------
const form = new FormData();
form.append("file", new Blob([mp3], { type: "audio/mpeg" }), `${id}-vo.mp3`);
form.append("model_id", "scribe_v1");
form.append("language_code", "deu");
form.append("timestamps_granularity", "word");
const stt = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": KEY }, body: form });
if (!stt.ok) {
  const body = await stt.text();
  console.error("STT-Fehler", stt.status, body);
  reportError("produce", new Error(`ElevenLabs STT ${stt.status} bei Reel ${id}: ${body.slice(0, 600)}`));
  process.exit(1);
}
const words = await stt.json();
fs.writeFileSync(`build/${id}-words.json`, JSON.stringify(words, null, 2));
console.log(`Words: ${(words.words || []).filter(w => w.type === "word").length} | Dauer ~${(words.words?.at(-1)?.end ?? 0).toFixed(1)} s`);
fs.writeFileSync(`build/${id}-script.json`, JSON.stringify(script, null, 2));
clearError("produce");
