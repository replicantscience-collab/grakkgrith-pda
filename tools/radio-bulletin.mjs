#!/usr/bin/env node
// Radio Sewers daily bulletin for Discord.
// Builds today's bulletin from the same living-city day every PDA builds (apps/cityday.js), voiced by whichever
// DJ is on shift in Adyta right now (data/radio.json), and posts it to the Discord webhook in DISCORD_WEBHOOK_URL.
// No webhook, or --dry-run: it prints the bulletin and posts nothing. Run by .github/workflows/radio-bulletin.yml.
//   node tools/radio-bulletin.mjs --dry-run            today's bulletin
//   node tools/radio-bulletin.mjs --dry-run --at 2026-11-09T21:00:00Z   the bulletin at that real moment
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('..', import.meta.url);
const json = p => JSON.parse(readFileSync(new URL(p, root), 'utf8'));
const sb = { window: {} };
vm.runInNewContext(readFileSync(new URL('apps/cityday.js', root), 'utf8'), sb);
const CD = sb.window.GRAKK_CITYDAY;

export function bulletin(realMs) {
  const PL = json('data/places.json'), D = json('data/cityday.json'), R = json('data/radio.json');
  const ST = CD.stickerList(json('art/pda-v1/imports/manifest.json'));
  const aMs = realMs + (Date.parse(PL.clock.anchorAdyta + 'Z') - Date.parse(PL.clock.anchorReal));   // Adyta time, read as UTC
  const T = CD.today(D, PL, ST, aMs), hour = new Date(aMs).getUTCHours();
  const slot = R.slots.find(s => (s.from < s.to ? hour >= s.from && hour < s.to : hour >= s.from || hour < s.to)) || R.slots[0];
  const intro = CD.rotate(R.lines[slot.id] || [''], aMs, `${slot.id}|bulletin`);
  // Three districts a day, rotating, so every district gets air time.
  const ids = Object.keys(T.districts), n = Math.min(3, ids.length), start = Math.floor(aMs / 86400000) % ids.length;
  const picks = Array.from({ length: n }, (_, i) => ids[(start + i) % ids.length]);
  const rumorDistrict = PL.districts[ids[(start + n) % ids.length]].name;
  const rumor = CD.rotate(R.rumors || [], aMs, 'bulletin|rumor').replace('{district}', rumorDistrict);
  const date = new Date(aMs).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' });
  const lines = [
    `📻 **${R.station.name}** · ${slot.dj}, *${slot.show}*${slot.mia ? ' (from the archives)' : ''}`,
    `${date} in Adyta`,
    '',
    `> ${intro}`,
    '',
    ...picks.map(id => `**${PL.districts[id].name}:** ${T.districts[id].mood}`),
    '',
    `🗣️ ${rumor}`,
    T.sticker ? `🩹 ${T.sticker.hint} Go find it.` : '',
    '',
    R.station.listenUrl ? `Listen live: <${R.station.listenUrl}>` : ''
  ];
  return { content: lines.join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 1900), dj: slot.dj, day: T.day };
}

async function main() {
  const args = process.argv.slice(2), at = args.includes('--at') ? Date.parse(args[args.indexOf('--at') + 1]) : Date.now();
  if (!Number.isFinite(at)) { console.error('--at needs an ISO date'); process.exit(2); }
  const b = bulletin(at), url = process.env.DISCORD_WEBHOOK_URL;
  console.log(b.content);
  if (args.includes('--dry-run') || !url) { console.log(url ? '\n(dry run: not posted)' : '\n(no DISCORD_WEBHOOK_URL set: not posted)'); return; }
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'Radio Sewers', content: b.content, allowed_mentions: { parse: [] } }) });
  if (!r.ok) { console.error(`Discord said ${r.status}: ${await r.text()}`); process.exit(1); }
  console.log(`\nPosted ${b.dj}'s bulletin for ${b.day}.`);
}
if (import.meta.url === `file://${process.argv[1]}`) main();
