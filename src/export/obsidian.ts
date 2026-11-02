// Builds a ready-to-open Obsidian vault (zip) for the Obsidian Leaflet plugin:
//   <Region>.md              overview note with the interactive map (```leaflet block)
//   Maps/<Region>.png        the rendered hex map
//   Locations/<kind>/*.md    one note per site; frontmatter `location` and `mapmarker` place it on the map
//   Nations, Factions, Gods, Geography, Dungeons, Adventures   linked notes
//   world.json               the full world, for re-import into the app
//   .obsidian/plugins/obsidian-leaflet-plugin/   the Leaflet plugin itself (from public/), enabled
import JSZip from 'jszip';
import type { Adventure, Dungeon, Extra, Fact, Faction, Site, World } from '../types';
import { free, tablePage, tag } from '../data';
import { center, Grid, hexLabel, mapPixelSize, SQRT3 } from '../gen/hex';
import { TERRAIN_INFO } from '../gen/terrain';
import { nameOf } from '../gen/world';
import { DEFAULT_LAYERS, renderMapSvg, SITE_STYLE } from '../render/map';
import { renderDungeonSvg } from '../render/dungeon';
import { COURT_LABEL } from '../gen/sites';
import { income } from '../gen/factions';

const MAP_HEX = 40;

export const LEAFLET_PLUGIN_ID = 'obsidian-leaflet-plugin';
export const LEAFLET_PLUGIN_FILES = ['main.js', 'manifest.json', 'styles.css'];

export function safe(name: string): string {
  return name.replace(/[\\/:*?"<>|#^[\]]/g, '').replace(/\s+/g, ' ').trim() || 'Untitled';
}

const FOLDER: Record<Site['kind'], string> = {
  capital: 'Locations/Cities', city: 'Locations/Cities', community: 'Locations/Communities',
  court: 'Locations/Courts', ruin: 'Locations/Ruins', wilderness: 'Locations/Wilderness',
};

function factLines(facts: Fact[]): string {
  return facts.map((f) => {
    const p = f.ref ? tablePage(f.ref) : undefined;
    return `- **${f.label}:** ${f.text}${p ? ` *(WWN p. ${p})*` : ''}`;
  }).join('\n');
}

function extraBlocks(extras: Extra[] | undefined): string {
  if (!extras?.length) return '';
  return extras.map((e) => `\n## ${e.title}\n\n${factLines(e.facts)}\n`).join('');
}

function yamlStr(s: string): string {
  return JSON.stringify(s);
}

/** Renders the map SVG into a PNG blob in the browser. */
export async function svgToPng(svg: string, width: number, height: number): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.decoding = 'sync';
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('Map image failed to render')); img.src = url; });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width);
    canvas.height = Math.round(height);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('PNG encoding failed'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface VaultFile { path: string; content: string | Blob }

/** Every note in the vault, without the map image. Pure, so it can be tested. */
export function buildVaultNotes(world: World): VaultFile[] {
  const g: Grid = { cols: world.settings.cols, rows: world.settings.rows };
  const [W, H] = mapPixelSize(g, MAP_HEX);
  const region = safe(world.regionName);
  const files: VaultFile[] = [];
  const name = (id: string, fallback: string) => safe(nameOf(world, id, fallback));

  // Unique note names across the vault.
  const used = new Set<string>([region]);
  const noteName = new Map<string, string>();
  const claim = (id: string, base: string, kind?: string) => {
    if (kind && used.has(base.toLowerCase())) base = `${base} (${kind})`;
    let n = base, k = 2;
    while (used.has(n.toLowerCase())) n = `${base} (${k++})`;
    used.add(n.toLowerCase());
    noteName.set(id, n);
    return n;
  };
  world.nations.forEach((n) => claim(n.id, name(n.id, n.name)));
  world.sites.forEach((s) => claim(s.id, name(s.id, s.name)));
  world.factions.forEach((f) => claim(f.id, name(f.id, f.name), 'faction'));
  world.gods.forEach((x) => claim(x.id, name(x.id, x.name), 'god'));
  world.features.forEach((x) => claim(x.id, name(x.id, x.name), 'region'));
  world.dungeons.forEach((d) => claim(d.id, `${name(d.id, d.name)} (dungeon)`));
  world.adventures.forEach((a) => claim(a.id, name(a.id, a.name), 'adventure'));
  const link = (id?: string) => (id && noteName.has(id) ? `[[${noteName.get(id)}]]` : '');

  const loc = (hex: number): [number, number] => {
    const [x, y] = center(g, hex, MAP_HEX);
    return [Math.round((H - y) * 10) / 10, Math.round(x * 10) / 10];
  };
  const notes = (id: string) => (world.overrides[id]?.notes ? `\n## Notes\n\n${world.overrides[id]!.notes}\n` : '');
  const terrainOf = (hex: number) => TERRAIN_INFO[world.hexes[hex].terrain].label;

  // Overview note with the Leaflet map.
  const milesPerUnit = world.settings.hexMiles / (MAP_HEX * SQRT3);
  const overview = `---
tags: [wwn/region]
seed: ${yamlStr(world.master)}
---
# ${world.regionName}

\`\`\`leaflet
id: wwn-${safe(world.master).replace(/\s/g, '-')}
image: [[Maps/${region}.png]]
bounds: [[0, 0], [${Math.round(H)}, ${Math.round(W)}]]
lat: ${Math.round(H / 2)}
long: ${Math.round(W / 2)}
height: 720px
minZoom: -2
maxZoom: 2
defaultZoom: -1
zoomDelta: 0.5
unit: miles
scale: ${milesPerUnit.toFixed(5)}
markerFolder: Locations
\`\`\`

Coasts: ${world.oceanSides.length ? world.oceanSides.join(', ') : 'none (landlocked)'}. One hex is ${world.settings.hexMiles} miles across.

## Nations
${world.nations.map((n) => `- ${link(n.id)} (population about ${n.population.toLocaleString('en-US')})`).join('\n')}

## Factions
${world.factions.map((f) => `- ${link(f.id)}: ${f.kind}, ${f.size}`).join('\n')}

## Gods
${world.gods.map((x) => `- ${link(x.id)}: ${x.domain}`).join('\n')}

## Geography
${world.features.map((x) => `- ${link(x.id)}: ${x.kind}`).join('\n')}

## Sites
${(['capital', 'city', 'community', 'court', 'ruin', 'wilderness'] as const).map((k) => {
  const list = world.sites.filter((s) => s.kind === k);
  return list.length ? `### ${SITE_STYLE[k].label}s\n${list.map((s) => `- ${link(s.id)} (hex ${hexLabel(g, s.hex)}): ${s.subtitle}`).join('\n')}` : '';
}).filter(Boolean).join('\n\n')}
${world.dungeons.length ? `\n## Dungeons\n${world.dungeons.map((d) => `- ${link(d.id)}`).join('\n')}\n` : ''}${world.adventures.length ? `\n## Adventures\n${world.adventures.map((a) => `- ${link(a.id)}`).join('\n')}\n` : ''}
## Generation
- Master seed: \`${world.master}\`
- Layer seeds: terrain \`${world.seeds.terrain}\`, nations \`${world.seeds.nations}\`, sites \`${world.seeds.sites}\`, factions \`${world.seeds.factions}\`
- Map: ${world.settings.cols}×${world.settings.rows} hexes, site density d${world.settings.density}
- Load \`world.json\` in the WWN World Builder to continue editing.

Content from *Worlds Without Number* (free edition) by Kevin Crawford, Sine Nomine Publishing. Page references are to the 2021 edition.
`;
  files.push({ path: `${region}.md`, content: overview });

  // Nations
  for (const n of world.nations) {
    const cap = world.sites.find((s) => s.id === n.capital);
    const [lat, lng] = loc(n.seat);
    files.push({
      path: `Nations/${noteName.get(n.id)}.md`,
      content: `---
tags: [wwn/nation]
location: [${lat}, ${lng}]
---
# ${nameOf(world, n.id, n.name)}

- **Capital:** ${link(cap?.id) || 'none'}
- **Population:** about ${n.population.toLocaleString('en-US')} (${n.hexes.length} hexes)
- **Gods:** ${n.gods.map(link).join(', ')}

## Character
${factLines(n.facts)}

## Neighbors
${n.relations.map((r) => `- ${link(r.nation)}: ${r.kind === 'dispute' ? 'Dispute' : 'Positive tie'}: ${r.text}`).join('\n') || '- No direct neighbors'}

## Cities and sites
${world.sites.filter((s) => s.nation === n.id).map((s) => `- ${link(s.id)}: ${s.subtitle}`).join('\n')}

## Factions
${world.factions.filter((f) => f.nation === n.id).map((f) => `- ${link(f.id)}`).join('\n') || '- None'}
${extraBlocks(world.extras[n.id])}${notes(n.id)}`,
    });
  }

  // Sites
  for (const s of world.sites) {
    const [lat, lng] = loc(s.hex);
    const st = SITE_STYLE[s.kind];
    const tagText = s.tags.map((t) => {
      const d = tag(s.tagKind, t);
      if (!d) return `### ${t}`;
      return `### ${t}\n\n${d.description}\n\n- **Enemies:** ${d.enemies.join('; ')}\n- **Friends:** ${d.friends.join('; ')}\n- **Complications:** ${d.complications.join('; ')}\n- **Things:** ${d.things.join('; ')}\n- **Places:** ${d.places.join('; ')}\n\n*(WWN p. ${d.page})*`;
    }).join('\n\n');
    const sameHex = world.sites.filter((o) => o.hex === s.hex && o.id !== s.id);
    const dungeons = world.dungeons.filter((d) => d.siteId === s.id);
    files.push({
      path: `${FOLDER[s.kind]}/${noteName.get(s.id)}.md`,
      content: `---
tags: [wwn/${s.kind}${s.nation ? `, wwn/nation/${safe(nameOf(world, s.nation, world.nations.find((n) => n.id === s.nation)?.name ?? '')).replace(/\s/g, '-')}` : ''}]
location: [${lat}, ${lng}]
mapmarker:
  icon: ${st.icon}
  color: ${yamlStr(st.color.replace('#', ''))}
hex: ${yamlStr(hexLabel(g, s.hex))}
---
# ${nameOf(world, s.id, s.name)}

*${s.subtitle}*

- **Kind:** ${st.label}${s.meta.courtType ? ` (${COURT_LABEL[s.meta.courtType as keyof typeof COURT_LABEL]})` : ''}
- **Hex:** ${hexLabel(g, s.hex)}, ${terrainOf(s.hex).toLowerCase()}
- **Nation:** ${link(s.nation) || 'unclaimed wilderness'}${s.population ? `\n- **Population:** about ${s.population.toLocaleString('en-US')}` : ''}${sameHex.length ? `\n- **Also here:** ${sameHex.map((o) => link(o.id)).join(', ')}` : ''}${dungeons.length ? `\n- **Dungeon:** ${dungeons.map((d) => link(d.id)).join(', ')}` : ''}

## Details
${factLines(s.facts)}

## Tags
${tagText}
${extraBlocks(world.extras[s.id])}${notes(s.id)}`,
    });
  }

  // Factions
  for (const f of world.factions) files.push({ path: `Factions/${noteName.get(f.id)}.md`, content: factionNote(world, f, link, notes) });

  // Gods
  for (const x of world.gods) {
    const worshippers = world.nations.filter((n) => n.gods.includes(x.id));
    files.push({
      path: `Gods/${noteName.get(x.id)}.md`,
      content: `---\ntags: [wwn/god]\n---\n# ${nameOf(world, x.id, x.name)}\n\n*${x.domain}*\n\n${factLines(x.facts)}\n\n## Worshipped in\n${worshippers.map((n) => `- ${link(n.id)}`).join('\n') || '- Hidden cults across the region'}\n${extraBlocks(world.extras[x.id])}${notes(x.id)}`,
    });
  }

  // Terrain features
  for (const x of world.features) {
    const [lat, lng] = loc(x.center);
    files.push({
      path: `Geography/${noteName.get(x.id)}.md`,
      content: `---\ntags: [wwn/geography]\nlocation: [${lat}, ${lng}]\n---\n# ${nameOf(world, x.id, x.name)}\n\n**${x.kind}.** ${x.description} *(WWN p. ${tablePage('geo.terrain')})*\n\nCovers ${x.hexes.length} hexes, centered on hex ${hexLabel(g, x.center)}.\n\n## Details\n${factLines(x.facts)}\n\n## Sites inside\n${world.sites.filter((s) => x.hexes.includes(s.hex)).map((s) => `- ${link(s.id)}`).join('\n') || '- None'}\n${notes(x.id)}`,
    });
  }

  // Dungeons
  for (const d of world.dungeons) {
    const svgName = `${safe(noteName.get(d.id)!)}.svg`;
    files.push({ path: `Dungeons/${svgName}`, content: renderDungeonSvg(d) });
    files.push({ path: `Dungeons/${noteName.get(d.id)}.md`, content: dungeonNote(d, svgName, link(d.siteId)) });
  }

  // Adventures
  for (const a of world.adventures) {
    files.push({ path: `Adventures/${noteName.get(a.id)}.md`, content: adventureNote(a, nameOf(world, a.id, a.name), link(a.anchor?.id)) + notes(a.id) });
  }

  files.push({ path: 'world.json', content: JSON.stringify(world) });
  files.push({ path: '.obsidian/community-plugins.json', content: JSON.stringify([LEAFLET_PLUGIN_ID], null, 2) });
  return files;
}

function factionNote(world: World, f: Faction, link: (id?: string) => string, notes: (id: string) => string): string {
  const assetDesc = (n: string) => free.factions.assets.find((a) => a.name === n);
  const tagDesc = f.tags.map((t) => free.factions.tags.find((x) => x.name === t)).filter(Boolean);
  const goal = free.factions.goals.find((x) => x.name === f.goal);
  return `---
tags: [wwn/faction]
---
# ${nameOf(world, f.id, f.name)}

*${f.kind}, ${f.size} faction*

| Cunning | Force | Wealth | Magic | HP | Treasure |
|---|---|---|---|---|---|
| ${f.cunning} | ${f.force} | ${f.wealth} | ${f.magic} | ${f.hp} | ${f.treasure} |

- **Base of Influence:** ${link(f.homeSite) || 'unknown'}
- **Nation:** ${link(f.nation) || 'none'}
- **Income per faction turn:** ${income(f)} Treasure (WWN p. 324)
- **Rivals:** ${f.rivals.map(link).join(', ') || 'none'}

## Goal: ${f.goal}
${goal ? `${goal.text} *(WWN p. ${goal.page})*` : ''}

## Tags
${tagDesc.map((t) => `- **${t!.name}:** ${t!.text} *(WWN p. ${t!.page})*`).join('\n')}

## Assets
| Asset | Attribute | HP | Location |
|---|---|---|---|
${f.assets.map((a) => `| ${a.name} | ${a.attribute} | ${a.hp}/${a.maxHp} | ${link(a.site) || a.location} |`).join('\n')}

${f.assets.filter((a) => assetDesc(a.name)).map((a) => {
  const d = assetDesc(a.name)!;
  return `- **${d.name}** (${d.attribute} ${d.rating}, cost ${d.cost}, attack ${d.attack}, counter ${d.counter}, ${d.qualities.join(', ')}): ${d.text ?? ''}`;
}).join('\n')}

## Recent doings
${factLines(f.facts)}
${extraBlocks(world.extras[f.id])}${notes(f.id)}`;
}

export function dungeonNote(d: Dungeon, svgName: string, siteLink: string): string {
  const mermaid = [
    'graph TD',
    ...d.rooms.map((r) => `  R${r.n}["${r.n}. ${r.name.replace(/"/g, "'")}"]`),
    ...d.links.map((l) => `  R${l.a} ${l.kind === 'secret' ? '-.-' : l.kind === 'hazard' ? '===' : '---'} R${l.b}`),
  ].join('\n');
  return `---
tags: [wwn/dungeon]
seed: ${JSON.stringify(d.seed)}
---
# ${d.name}

${siteLink ? `Site: ${siteLink}\n\n` : ''}*${d.siteType}: ${d.example}. Inhabitants typical of: ${d.inhabitantKind}.*

![[${svgName}]]

\`\`\`mermaid
${mermaid}
\`\`\`

## Overview
${factLines(d.facts)}

## Inhabitants
${d.groups.map((x) => `- **${x.name}.** Came here: ${x.came}. Staying because: ${x.staying}.`).join('\n') || '- No major inhabitant groups'}
${d.relations.map((r) => `- ${r}`).join('\n')}

## Map features
${d.features.map((x) => `- ${x}`).join('\n') || '- None'}

## Rooms
${d.rooms.map((r) => {
  const exits = d.links.filter((l) => l.a === r.n || l.b === r.n).map((l) => {
    const o = l.a === r.n ? l.b : l.a;
    return `${o}${l.kind === 'secret' ? ' (secret)' : l.kind === 'hazard' ? ' (obstacle)' : ''}`;
  });
  return `### ${r.n}. ${r.name}\n- **Function:** ${r.function}\n- **Contents:** ${r.contents}${r.detail ? `: ${r.detail}` : ''}${r.treasure ? `\n- **Treasure:** ${r.treasure}` : ''}${r.notes.map((n) => `\n- ${n}`).join('')}\n- **Exits to:** ${exits.join(', ')}`;
}).join('\n\n')}

## Wandering encounters (1d6)
Roll 1d6 after each scene or move between rooms; on a 1, roll here.

${d.wandering.map((w, i) => `${i + 1}. ${w}`).join('\n')}
`;
}

export function adventureNote(a: Adventure, title: string, anchorLink: string): string {
  return `---
tags: [wwn/adventure]
seed: ${JSON.stringify(a.seed)}
---
# ${title}

${anchorLink ? `Anchor: ${anchorLink}\n\n` : ''}${a.prompts.length ? `## Prompts from the anchor\n${factLines(a.prompts)}\n\n` : ''}${a.sections.map((x) => `## ${x.title} *(WWN p. ${x.page})*\n${factLines(x.facts)}`).join('\n\n')}
`;
}

/** Fetches the bundled Leaflet plugin files (served from public/obsidian-leaflet-plugin/). */
async function leafletPluginFiles(): Promise<VaultFile[]> {
  return Promise.all(LEAFLET_PLUGIN_FILES.map(async (f) => {
    const res = await fetch(`${import.meta.env.BASE_URL}${LEAFLET_PLUGIN_ID}/${f}`);
    if (!res.ok) throw new Error(`Leaflet plugin file ${f} returned ${res.status}`);
    return { path: `.obsidian/plugins/${LEAFLET_PLUGIN_ID}/${f}`, content: await res.blob() };
  }));
}

/** Builds the zip: notes, the map PNG, and the Leaflet plugin. Runs in the browser. */
export async function exportVault(world: World): Promise<Blob> {
  const g: Grid = { cols: world.settings.cols, rows: world.settings.rows };
  const [W, H] = mapPixelSize(g, MAP_HEX);
  const zip = new JSZip();
  const root = `WWN ${safe(world.regionName)}`;
  for (const f of [...buildVaultNotes(world), ...await leafletPluginFiles()]) zip.file(`${root}/${f.path}`, f.content);
  const svg = renderMapSvg(world, { ...DEFAULT_LAYERS, coords: false }, MAP_HEX);
  zip.file(`${root}/Maps/${safe(world.regionName)}.png`, await svgToPng(svg, W, H));
  zip.file(`${root}/Maps/${safe(world.regionName)}.svg`, svg);
  return zip.generateAsync({ type: 'blob' });
}
