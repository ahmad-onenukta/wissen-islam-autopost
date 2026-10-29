# Content-Factory v6 — Multi-Brand Architektur (Stand 29.10.2026)

Ziel: pro Monat eine neue Brand starten, ohne etwas neu zu bauen. Ein Dashboard, 24/7 autonom.

## Prinzip
Alles Kanal-Spezifische steckt in `brands/<slug>/brand.json`. Code, Renderer und Workflows sind generisch.

| Datei | Zweck |
|---|---|
| `brands/<slug>/brand.json` | Nische, Palette, Stimme, Plattformen, Slot, Hashtags, Fakten-Policy, `env_prefix` |
| `brands/_template/brand.json` | Vorlage |
| `lib/brand.mjs` | Registry + Secret-Auflösung (`IG_TOKEN_<PREFIX>` → Fallback `IG_TOKEN`) |
| `scripts/newbrand.mjs` | neue Brand anlegen + SETUP.md mit Secret-Checkliste |
| `scripts/plan_produce.mjs` | plant pro Brand, bis `MIN_RUNWAY` (Default 3) Tage Vorlauf stehen |
| `scripts/produce.mjs` | Voice-Over + Wort-Timestamps (ElevenLabs API) |
| `render/make_reel.sh` | Align → Events → Bett → Remotion → Transcode |
| `scripts/enqueue.mjs` | Video + Queue-Eintrag im nächsten freien Slot **dieser** Brand |
| `scripts/post.mjs` | postet auf alle `targets` des Eintrags |
| `scripts/youtube.mjs` · `tiktok.mjs` · `facebook.mjs` | Plattform-Module |
| `scripts/dashboard.mjs` | erzeugt `dashboard/state.json` (Datenquelle des Dashboards) |
| `scripts/apply_commands.mjs` | wendet `dashboard/commands.json` auf die Queue an |
| `index.html` | Dashboard (GitHub Pages, liest `dashboard/state.json` same-origin) |

## Plattformen
| Plattform | Weg | Secrets |
|---|---|---|
| Instagram Reels | Instagram API mit Instagram-Login, `video_url` | `IG_TOKEN`, `IG_USER_ID` |
| YouTube Shorts | Data API v3, resumable Upload | `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN` |
| Facebook Reels | Graph API `video_reels` (start → rupload → finish) | `FB_PAGE_ID`, `FB_PAGE_TOKEN` |
| TikTok | Content Posting API `PULL_FROM_URL` | `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REFRESH_TOKEN`; **ohne App-Audit nur Entwurfsordner**, mit Audit `TIKTOK_DIRECT=1` |

Secrets gelten global oder pro Brand mit Suffix, z. B. `IG_TOKEN_GELDWISSEN`.
Instagram ist Leitplattform: schlägt IG fehl, schlägt der Lauf fehl. Nebenplattformen schreiben Fehler nach `queue[].results` und brechen nichts ab.

## Autonomie-Loop (GitHub Actions — ohne Mac, ohne Claude)
| Workflow | Cron (UTC) | Tut |
|---|---|---|
| `produce.yml` | `0 4 * * *` | pro Brand fehlende Reels rendern → Queue |
| `post-reel.yml` | `0 11` + `0 14`, wartet bis 18:00 | postet das fällige Reel auf alle Ziele |
| `post-story.yml` | 19:00 | Reel zusätzlich als Story |
| `engage.yml` | `17 */2` | Kommentare/DMs → inbox/outbox, Insights |
| `dashboard.yml` | `*/30` | Dashboard-Befehle anwenden + `state.json` neu bauen |

Claude wird nur noch gebraucht für: neue Scripts + Fakten-Check, Kommentar-Antworten (inbox→outbox), neue Brand anlegen.

## Neue Brand in 4 Schritten
1. `node scripts/newbrand.mjs <slug> "<Name>" "<Nische>" instagram,youtube,tiktok 19:00 "#AkzentFarbe"` (Befehl baut das Dashboard-Tab „Neue Brand")
2. Secrets aus `brands/<slug>/SETUP.md` im Repo setzen
3. 10–15 geprüfte Scripts nach `brands/<slug>/scripts/`
4. Fertig — `produce.yml` und `post-reel.yml` greifen automatisch

## Agenten-Rollen (Claude-Subagents)
| Agent | Input | Output |
|---|---|---|
| trend-scout | Nische | Hooks, Formate, Sounds |
| topic-miner | Nische + Quellenlage | 10 Themen |
| script-writer | Thema + brand.json | `scripts/<id>.json` |
| fact-checker | Script | `sources[]`, `fact_check = ok` (Gate) |
| engager | `engage/inbox.json` | `engage/outbox.json` |
| analyst | `engage/stats.json` | Hook-Learnings → brand.json |

## Offene Punkte
- GitHub Pages aktivieren (Settings → Pages → Branch `main`, Ordner `/`), danach Dashboard unter `https://ahmad-onenukta.github.io/wissen-islam-autopost/`
- `pending-workflows/produce.yml` + `dashboard.yml` nach `.github/workflows/` kopieren
- `GH_PAT` setzen (Token-Refresh, sonst IG-Token-Ende 18.12.2026)
- TikTok-App anlegen + Audit beantragen; Facebook-Seite + Page-Token
- ElevenLabs Starter-Plan (≈1.400 Credits/Reel; 2 Brands × 1/Tag ≈ 84k Credits/Monat)
- `dashboard.mjs`: `stats.history` wächst unbegrenzt → später auf letzte 200 Punkte kappen
