#!/usr/bin/env node
// Downloads the Obsidian Leaflet plugin (MIT, javalent/obsidian-leaflet) into public/obsidian-leaflet-plugin/.
// Maintainer tool: the files are committed, and the vault export copies them into
// .obsidian/plugins/obsidian-leaflet-plugin/ so the exported map works without a plugin install.
// Usage: npm run plugin:leaflet -- [version]   (default: latest release)
import fs from 'node:fs';
import path from 'node:path';

const FILES = ['main.js', 'manifest.json', 'styles.css'];
const out = path.resolve('public/obsidian-leaflet-plugin');
const repo = 'javalent/obsidian-leaflet';

let version = process.argv[2];
if (!version) {
  const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`);
  if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
  version = (await res.json()).tag_name;
}

fs.mkdirSync(out, { recursive: true });
for (const f of FILES) {
  const res = await fetch(`https://github.com/${repo}/releases/download/${version}/${f}`);
  if (!res.ok) throw new Error(`${f}: download returned ${res.status}`);
  fs.writeFileSync(path.join(out, f), Buffer.from(await res.arrayBuffer()));
}
console.log(`Wrote Leaflet plugin ${version} to ${path.relative(process.cwd(), out)}/`);
