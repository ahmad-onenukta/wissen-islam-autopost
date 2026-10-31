/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";
import fs from "node:fs";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);
// Lokal (Claude-Container) liegt ein Chromium bereit; auf GitHub-Runnern nicht –
// dort laedt Remotion sich selbst eine Headless-Shell. Pfad nur setzen, wenn vorhanden.
const BROWSER = process.env.REMOTION_BROWSER_EXECUTABLE
  || "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (fs.existsSync(BROWSER)) Config.setBrowserExecutable(BROWSER);
Config.setChromiumDisableWebSecurity(true);
