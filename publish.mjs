#!/usr/bin/env node
/* Publish this plugin publicly, under the company account.
 *
 *   node publish.mjs
 *
 * Everything is staged: history is authored as the company, and no personal
 * name appears in any file, any commit, or the remote URL. The target owner
 * (craniusmaximusllc) is a second GitHub account, so publishing needs gh to be
 * signed in as that account — this says so plainly if it is not.
 *
 * It creates the repo, pushes, and then checks that a stranger can actually
 * fetch the files the plugin installer needs. A push is not a publication.
 *
 * Two Windows traps are handled here, both of which made earlier versions print
 * a correct result and then exit 127:
 *   - `gh` is a .cmd, so it needs a shell; passing (cmd, args[]) alongside
 *     shell:true trips a deprecation warning and crashes libuv on exit. One
 *     command string avoids it.
 *   - calling process.exit() while fetch still holds open handles trips a libuv
 *     assertion. Set process.exitCode and return instead.
 */
import { spawnSync } from 'node:child_process';

const ORG = 'craniusmaximusllc';
const REPO = 'session-tax-plugin';

const run = (line) => spawnSync(line, { encoding: 'utf8', shell: true });
const q = (s) => (/[^A-Za-z0-9._\-/:@]/.test(s) ? JSON.stringify(s) : s);
const gh = (path) => fetch('https://api.github.com/' + path, { headers: { 'User-Agent': 'publish' } });

async function main() {
  const me = (run('gh api user --jq .login').stdout || '').trim();
  if (!/^[A-Za-z0-9-]{1,39}$/.test(me)) {
    console.error('\nCould not read the signed-in GitHub account. Check `gh auth status`.\n');
    return 1;
  }
  const orgs = (run('gh api user/orgs --jq .[].login').stdout || '').trim().split('\n').filter(Boolean);

  const probe = await gh('users/' + ORG);
  if (!probe.ok) {
    console.error(`\n"${ORG}" does not exist on GitHub, as either an account or an organisation.\n`);
    return 1;
  }
  const ownerKind = (await probe.json()).type.toLowerCase();

  if (me !== ORG && !orgs.includes(ORG)) {
    console.error(`\n"${ORG}" exists as a ${ownerKind} account, but gh is signed in as "${me}",`);
    console.error('which has no rights to publish there.\n');
    console.error('Run these two yourself — the first opens a browser to confirm:\n');
    console.error(`  gh auth login              # choose GitHub.com, and sign in as ${ORG}`);
    console.error(`  gh auth switch -u ${ORG}\n`);
    console.error('Then run this script again. Both accounts stay; switch back any time with:\n');
    console.error(`  gh auth switch -u ${me}\n`);
    console.error(`(Or, without switching: create an empty public repo named "${REPO}" under`);
    console.error(`${ORG} in the browser, add ${me} as a collaborator, then rerun this.)\n`);
    return 1;
  }

  console.log(`Signed in as ${me}. Publishing to ${ORG}/${REPO} …\n`);
  const desc = q('Measure what your Claude Code setup costs on every session before you type anything.');
  const create = run(`gh repo create ${ORG}/${REPO} --public --source=. --remote=origin --push --description ${desc}`);
  if (create.status !== 0) {
    if (!/already exists|Name already exists/i.test(create.stderr || '')) {
      console.error(create.stderr || create.stdout);
      return 1;
    }
    const push = run('git push -u origin main');
    if (push.status !== 0) { console.error(push.stderr); return 1; }
  }

  console.log('Checking what a stranger can fetch, unauthenticated:');
  const base = `https://raw.githubusercontent.com/${ORG}/${REPO}/main/`;
  const needed = ['.claude-plugin/marketplace.json', '.claude-plugin/plugin.json',
                  'commands/session-tax.md', 'scripts/session-tax-free.mjs', 'README.md'];
  let bad = 0;
  for (const f of needed) {
    const r = await fetch(base + f);
    if (!r.ok) bad++;
    console.log(`  ${r.ok ? 'ok  ' : 'FAIL'} ${f} (${r.status})`);
  }
  const meta = await (await gh(`repos/${ORG}/${REPO}`)).json();
  const isPublic = meta.private === false;
  console.log(`  ${isPublic ? 'ok  ' : 'FAIL'} repository is public`);
  if (!isPublic) bad++;

  if (bad) {
    console.error(`\n${bad} check(s) failed — do not submit this anywhere yet.\n`);
    return 1;
  }

  console.log(`\nLive: https://github.com/${ORG}/${REPO}`);
  console.log('\nWhat anyone can now run:');
  console.log(`  /plugin marketplace add ${ORG}/${REPO}`);
  console.log(`  /plugin install session-tax@${ORG}`);
  console.log('\nNext: submit it to Anthropic\'s directory —');
  console.log('  https://clau.de/plugin-directory-submission');
  console.log('  (the exact text to paste is in claude-code-autonomy-pack/MARKETPLACES.md)\n');
  return 0;
}

process.exitCode = await main();
