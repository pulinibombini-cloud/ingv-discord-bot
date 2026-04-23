import { Client, GatewayIntentBits, EmbedBuilder } from "discord.js";
import http from "node:http";

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const PORT = Number(process.env.PORT) || 3000;
const POLL_INTERVAL_MS = 30_000;
const INGV_BASE = "https://webservices.ingv.it/fdsnws/event/1/query";

if (!TOKEN) { console.error("Missing DISCORD_BOT_TOKEN"); process.exit(1); }
if (!CHANNEL_ID) { console.error("Missing DISCORD_CHANNEL_ID"); process.exit(1); }

let botStatus = "starting";
let lastPostedAt = null;
let totalPosted = 0;

http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: botStatus, lastPostedAt, totalPosted, uptimeSeconds: Math.floor(process.uptime()) }));
}).listen(PORT, () => console.log(`Keepalive HTTP server in ascolto su porta ${PORT}`));

const seenEventIds = new Set();
let lastSeenTime = null;

function magnitudeColor(mag) {
  if (mag >= 5) return 0xff0000;
  if (mag >= 4) return 0xff6600;
  if (mag >= 3) return 0xffaa00;
  if (mag >= 2) return 0xffee00;
  return 0x66cc66;
}
function magnitudeEmoji(mag) {
  if (mag >= 5) return "🔴";
  if (mag >= 4) return "🟠";
  if (mag >= 3) return "🟡";
  if (mag >= 2) return "🟢";
  return "⚪";
}

async function fetchLatestEarthquakes() {
  const params = new URLSearchParams({ format: "geojson", limit: "20", orderby: "time" });
  if (lastSeenTime) params.set("starttime", new Date(lastSeenTime.getTime() + 1000).toISOString());
  const res = await fetch(`${INGV_BASE}?${params.toString()}`, {
    headers: { Accept: "application/json", "User-Agent": "ingv-discord-bot/1.0" },
  });
  if (res.status === 204) return [];
  if (!res.ok) throw new Error(`INGV ${res.status} ${res.statusText}`);
  const data = await res.json();
  return data.features ?? [];
}

function buildEmbed(f) {
  const p = f.properties;
  const [lon, lat, depthKm] = f.geometry.coordinates;
  const mag = p.mag ?? 0;
  const magType = p.magType ?? "M";
  const place = p.place ?? "Località sconosciuta";
  const time = new Date(p.time);
  const unix = Math.floor(time.getTime() / 1000);
  const eventId = String(p.eventId ?? f.id);
  return new EmbedBuilder()
    .setColor(magnitudeColor(mag))
    .setTitle(`${magnitudeEmoji(mag)} ${magType} ${mag.toFixed(1)} — ${place}`)
    .setURL(`https://terremoti.ingv.it/event/${eventId}`)
    .addFields(
      { name: "Orario", value: `<t:${unix}:F> (<t:${unix}:R>)`, inline: false },
      { name: "Magnitudo", value: `${magType} ${mag.toFixed(1)}`, inline: true },
      { name: "Profondità", value: `${depthKm.toFixed(1)} km`, inline: true },
      { name: "Coordinate", value: `[${lat.toFixed(3)}, ${lon.toFixed(3)}](https://www.google.com/maps?q=${lat},${lon})`, inline: true },
    )
    .setFooter({ text: `INGV • Ev
