#!/usr/bin/env node
/**
 * session-tax (free edition) — what your Claude Code setup costs you before
 * you type anything.
 *
 * Reads your own session transcripts off your own disk. No network calls, no
 * account, nothing sent anywhere. Check the source: it imports fs, path and os
 * and that is the whole list.
 *
 * The free edition measures and totals. The paid edition names the specific
 * skills, servers and hooks that never fire and tells you what to do about
 * each one: https://operator-shop.pages.dev
 *
 * Usage: node session-tax-free.mjs [--days 90] [--rate 3]
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i === -1 ? d : argv[i + 1]; };

const HOME = os.homedir();
const C = path.join(HOME, '.claude');
const DAYS = Number(flag('days', 90)) || 90;
const RATE = Number(flag('rate', 3)) || 3;
const TOK = (s) => Math.round(s.length / 3.7);

// ---------------------------------------------------------------- installed
function findSkills(root) {
  const out = [];
  const rec = (d) => {
    let e = []; try { e = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const f of e) {
      if (f.name === 'node_modules' || f.name === '_retired') continue;
      const p = path.join(d, f.name);
      if (f.isDirectory()) { rec(p); continue; }
      if (f.name !== 'SKILL.md') continue;
      let raw = ''; try { raw = fs.readFileSync(p, 'utf8'); } catch { continue; }
      const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!m) continue;
      const name = ((m[1].match(/^name:\s*(.+)$/m) || [])[1] || path.basename(d)).trim();
      const desc = ((m[1].match(/^description:\s*([\s\S]*?)(?=\n[a-z_-]+:|$)/m) || [])[1] || '')
        .trim().replace(/\s+/g, ' ');
      const firedBy = (raw.match(/^\s*fired-by:\s*(.+)$/m) || [])[1] || null;
      let age = 999;
      try {
        const st = fs.statSync(p);
        age = (Date.now() - Math.min(st.birthtimeMs || Infinity, st.mtimeMs)) / 864e5;
      } catch { /* treat as old */ }
      out.push({ name, tok: TOK(name + desc) + 12, firedBy, age });
    }
  };
  rec(root);
  return out;
}

const skills = findSkills(path.join(C, 'skills'));
let settings = {}; try { settings = JSON.parse(fs.readFileSync(path.join(C, 'settings.json'), 'utf8')); } catch { }
const totalHooks = Object.values(settings.hooks || {})
  .reduce((s, gs) => s + gs.reduce((n, g) => n + (g.hooks || []).length, 0), 0);
const agentsDir = path.join(C, 'agents');
const agents = fs.existsSync(agentsDir) ? fs.readdirSync(agentsDir).filter((f) => f.endsWith('.md')).length : 0;
let servers = 0;
try { servers = Object.keys(JSON.parse(fs.readFileSync(path.join(HOME, '.claude.json'), 'utf8')).mcpServers || {}).length; } catch { }

// ---------------------------------------------------------------- used
const cutoff = Date.now() - DAYS * 864e5;
const skillUse = {}, injections = {};
const startCtx = [];
const mix = { inp: 0, cr: 0, cc: 0 };
let sessions = 0, injSessions = 0;

let dirs = []; try { dirs = fs.readdirSync(path.join(C, 'projects')); } catch { }
for (const d of dirs) {
  const dp = path.join(C, 'projects', d);
  let files = []; try { files = fs.readdirSync(dp).filter((f) => f.endsWith('.jsonl')); } catch { continue; }
  for (const f of files) {
    const fp = path.join(dp, f);
    let st; try { st = fs.statSync(fp); } catch { continue; }
    if (st.mtimeMs < cutoff) continue;
    sessions++;
    let txt; try { txt = fs.readFileSync(fp, 'utf8'); } catch { continue; }
    const lines = txt.split('\n');
    let gotCtx = false, sawInj = false;
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      if (!ln) continue;
      if (!(ln.includes('"tool_use"') || (!gotCtx && ln.includes('"usage"')) ||
            (i < 40 && ln.includes('"attachment"')))) continue;
      let o; try { o = JSON.parse(ln); } catch { continue; }
      if (i < 40 && o.type === 'attachment') {
        const a = o.attachment || o;
        const key = (a.type || 'unknown') + (a.source ? ':' + a.source : '');
        (injections[key] = injections[key] || { tok: 0 }).tok += TOK(JSON.stringify(a));
        sawInj = true;
      }
      if (!gotCtx && o.type === 'assistant' && o.message?.usage) {
        const u = o.message.usage;
        const inp = u.input_tokens || 0, cr = u.cache_read_input_tokens || 0, cc = u.cache_creation_input_tokens || 0;
        if (inp + cr + cc > 1000) { startCtx.push(inp + cr + cc); mix.inp += inp; mix.cr += cr; mix.cc += cc; gotCtx = true; }
      }
      const content = o.message?.content;
      if (!Array.isArray(content)) continue;
      for (const b of content) {
        if (b.type === 'tool_use' && b.name === 'Skill' && b.input?.skill)
          skillUse[b.input.skill] = (skillUse[b.input.skill] || 0) + 1;
      }
    }
    if (sawInj) injSessions++;
  }
}

if (!sessions) {
  console.log('\nNo sessions found to read. Looked in ' + path.join(C, 'projects') + '\n');
  process.exit(0);
}

startCtx.sort((a, b) => a - b);
const p = (q) => startCtx[Math.floor(startCtx.length * q)] || 0;

const used = new Set();
for (const k of Object.keys(skillUse)) { used.add(k); used.add(k.split(':').pop()); }
const dead = skills.filter((s) => !used.has(s.name) && !s.firedBy && s.age >= 14);
const eventWired = skills.filter((s) => s.firedBy).length;
const wastedPerSession = dead.reduce((s, x) => s + x.tok, 0);

const sessionsPerDay = sessions / DAYS;
const openingPerYear = Math.round(p(0.5) * sessionsPerDay * 365);
const wastedPerYear = Math.round(wastedPerSession * sessionsPerDay * 365);
const mixTotal = mix.inp + mix.cr + mix.cc || 1;
const blended = RATE * ((mix.inp) + (mix.cr * 0.1) + (mix.cc * 1.25)) / mixTotal;
const money = (t) => '$' + ((t / 1e6) * blended).toFixed(2);
const cachedShare = Math.round(100 * mix.cr / mixTotal);

// ---------------------------------------------------------------- report
const H = (s) => '\n' + s + '\n' + '-'.repeat(s.length);
console.log(`\nsession-tax (free)  ·  ${sessions} sessions over the last ${DAYS} days`);

console.log(H('THE BILL'));
console.log(`  Every session opens at ${p(0.5).toLocaleString()} tokens before you type anything.`);
console.log(`  The worst tenth open at ${p(0.9).toLocaleString()}.`);
console.log(`  Over a year at your pace that is ${openingPerYear.toLocaleString()} tokens, about ${money(openingPerYear)}.`);
console.log('');
console.log(`  Rough guide. ${cachedShare}% of that is cache reads, which bill at a tenth of fresh`);
console.log(`  input, so it is priced at an effective $${blended.toFixed(2)} per million rather than the`);
console.log(`  $${RATE.toFixed(2)} list rate. On a subscription you pay it in room to think instead of cash.`);

console.log(H('WHAT EVERY SESSION LOADS'));
const inj = Object.entries(injections)
  .map(([k, v]) => [k, Math.round(v.tok / Math.max(injSessions, 1))])
  .filter(([, v]) => v > 20).sort((a, b) => b[1] - a[1]).slice(0, 8);
for (const [k, v] of inj) console.log(`  ${String(v.toLocaleString()).padStart(7)} tok  ${k}`);

console.log(H('INSTALLED vs ACTUALLY USED'));
console.log(`  skills           ${String(skills.length).padStart(4)} installed   ${String(skills.length - dead.length - eventWired).padStart(4)} fire from the work`);
if (eventWired) console.log(`                   ${String(eventWired).padStart(4)} wired to an event, so zero calls is correct`);
console.log(`  skill calls      ${String(Object.values(skillUse).reduce((a, b) => a + b, 0)).padStart(4)} total`);
console.log(`  custom agents    ${String(agents).padStart(4)} defined`);
console.log(`  servers          ${String(servers).padStart(4)} connected`);
console.log(`  hooks            ${String(totalHooks).padStart(4)} wired`);

console.log(H('WHAT THE FREE EDITION FOUND'));
if (dead.length) {
  console.log(`  ${dead.length} of your ${skills.length} skills wait on you to remember them, and have not`);
  console.log(`  fired once in ${DAYS} days. They cost ${wastedPerSession.toLocaleString()} tokens on every session you run —`);
  console.log(`  about ${money(wastedPerYear)} a year, for nothing.`);
} else {
  console.log('  Nothing obviously dead. What you have installed roughly matches how you work.');
}

console.log(H('WHAT THE FULL VERSION ADDS'));
console.log('  - names every dead skill, cold server and redundant hook, and what to do with each');
console.log('  - flags connected servers whose tool schemas load on every session but are never called');
console.log('  - machine-readable output, and auditing a profile other than your own');
console.log('  - a quiet monthly check, so this happens without you remembering to run it');
console.log('\n  $19, one seat:  https://operator-shop.pages.dev\n');
