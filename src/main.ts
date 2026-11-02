import './style.css';
import type { Dungeon, Extra, Fact, Settings, Site, World } from './types';
import { Rng, randomSeed } from './rng';
import { free, getPremium, loadPremium, setPremium, tablePage, tag, validatePremium, matrix } from './data';
import { buildWorld, DEFAULT_SETTINGS, nameOf, reroll, SIZE_PRESETS, seedsFrom } from './gen/world';
import { center, Grid, hexLabel, mapPixelSize } from './gen/hex';
import { TERRAIN_INFO } from './gen/terrain';
import { DEFAULT_LAYERS, hexPolygon, MapLayers, renderMapSvg, SITE_STYLE } from './render/map';
import { renderDungeonSvg, ROOM_COLORS } from './render/dungeon';
import { generateDungeon, INHABITANT_KINDS } from './gen/dungeon';
import { DENSITY_LABEL, COURT_LABEL } from './gen/sites';
import { income } from './gen/factions';
import { adventureSeed, architecture, hook, iterum, npc, premiumReady } from './gen/premium';
import { exportVault, safe } from './export/obsidian';

// ---------------------------------------------------------------- state

type Tab = 'details' | 'nations' | 'sites' | 'factions' | 'gods' | 'dungeons' | 'lore' | 'premium';
type Sel = { kind: 'hex'; id: number } | { kind: 'site' | 'nation' | 'faction' | 'god' | 'feature' | 'dungeon'; id: string } | null;

const WORLD_KEY = 'wwn.world';
const LAYERS_KEY = 'wwn.layers';
const HEX = 30;

let world: World;
let layers: MapLayers = { ...DEFAULT_LAYERS };
let sel: Sel = null;
let tab: Tab = 'details';
let siteFilter = '';
let view = { x: 0, y: 0, w: 1, h: 1 };

const $ = <T extends HTMLElement = HTMLElement>(q: string) => document.querySelector(q) as T;
const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const grid = (): Grid => ({ cols: world.settings.cols, rows: world.settings.rows });

function save(): void {
  try { localStorage.setItem(WORLD_KEY, JSON.stringify(world)); } catch { toast('Could not save in this browser. Use "Save JSON".'); }
}

function toast(msg: string): void {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

function download(blob: Blob, filename: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------------------------------------------------------------- layout

function shell(): void {
  $('#app').innerHTML = `
  <div class="layout">
    <header>
      <h1>Worlds Without Number · World Builder</h1>
      <div class="seed">
        <label for="seed" class="muted">Seed</label>
        <input id="seed" spellcheck="false" />
        <button data-action="random-seed" title="New random seed">🎲</button>
        <button class="primary" data-action="generate">Generate world</button>
      </div>
      <span class="spacer"></span>
      <button data-action="export-vault" title="Download an Obsidian vault with the map, locations, nations, and factions">Export to Obsidian</button>
      <button data-action="save-json">Save JSON</button>
      <input type="file" id="load-json" accept=".json,application/json" hidden />
      <button data-action="load-json">Load JSON</button>
    </header>
    <aside class="sidebar" id="sidebar"></aside>
    <main class="mapwrap" id="mapwrap">
      <div id="map"></div>
      <div class="zoom">
        <button data-action="zoom-in" title="Zoom in">+</button>
        <button data-action="zoom-out" title="Zoom out">−</button>
        <button data-action="zoom-fit" title="Fit map">⤢</button>
      </div>
      <div class="status" id="status"></div>
    </main>
    <section class="panel">
      <nav class="tabs" id="tabs"></nav>
      <div class="body" id="panel"></div>
    </section>
  </div>`;
}

function renderSidebar(): void {
  const s = world.settings;
  const sizeKey = Object.entries(SIZE_PRESETS).find(([, [c, r]]) => c === s.cols && r === s.rows)?.[0] ?? 'custom';
  const p = getPremium();
  $('#sidebar').innerHTML = `
    <h2>Map</h2>
    <div class="field"><label for="size">Hex map size</label>
      <select id="size">${Object.keys(SIZE_PRESETS).map((k) => `<option ${k === sizeKey ? 'selected' : ''}>${k}</option>`).join('')}<option value="custom" ${sizeKey === 'custom' ? 'selected' : ''}>Custom</option></select></div>
    <div class="field" ${sizeKey === 'custom' ? '' : 'hidden'} id="custom-size"><span>Columns × rows</span>
      <span><input type="number" id="cols" min="8" max="60" value="${s.cols}" style="width:52px"> × <input type="number" id="rows" min="6" max="50" value="${s.rows}" style="width:52px"></span></div>
    <div class="field"><label for="density">Site density</label>
      <select id="density">${Object.entries(DENSITY_LABEL).map(([v, l]) => `<option value="${v}" ${+v === s.density ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="field"><label for="nations">Nations</label><input type="number" id="nations" min="1" max="12" value="${s.nations}"></div>
    <div class="field"><label for="factions">Factions</label><input type="number" id="factions" min="1" max="10" value="${s.factions}"></div>
    <div class="field"><label for="ocean">Ocean sides</label>
      <select id="ocean">${[[-1, 'Random (1-3)'], [0, 'None'], [1, 'One'], [2, 'Two'], [3, 'Three'], [4, 'Island (four)']].map(([v, l]) => `<option value="${v}" ${v === s.oceanSides ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="field"><label for="miles">Miles per hex</label><input type="number" id="miles" min="1" max="60" value="${s.hexMiles}"></div>
    <p class="muted" style="font-size:12px;margin:4px 0">Changes apply when you press <b>Generate world</b>.</p>

    <h2>Seeds</h2>
    <div class="seeds">
      ${(['terrain', 'nations', 'sites', 'factions'] as const).map((k) => `
        <div class="seed-row"><span>${k[0].toUpperCase() + k.slice(1)}<br><code>${esc(world.seeds[k])}</code></span>
        <button class="small" data-action="reroll" data-layer="${k}" title="New seed for ${k}${k === 'terrain' ? ' (rebuilds everything)' : k === 'nations' ? ' (also rebuilds sites and factions)' : k === 'sites' ? ' (also rebuilds factions)' : ''}">↻</button></div>`).join('')}
      <p class="muted" style="font-size:12px;margin:4px 0">↻ regenerates one layer and the layers below it. The terrain stays when you regenerate sites or factions.</p>
    </div>

    <h2>Layers</h2>
    ${([['tint', 'Nation colors'], ['borders', 'Borders'], ['rivers', 'Rivers'], ['roads', 'Roads'], ['sites', 'Sites'], ['siteLabels', 'Site names'], ['nationLabels', 'Nation names'], ['featureLabels', 'Feature names'], ['coords', 'Hex numbers']] as [keyof MapLayers, string][])
      .map(([k, l]) => `<label class="check"><input type="checkbox" data-layer-toggle="${k}" ${layers[k] ? 'checked' : ''}> ${l}</label>`).join('')}

    <h2>Legend</h2>
    <div class="legend">
      ${(Object.keys(SITE_STYLE) as Site['kind'][]).map((k) => `<span class="dot" style="background:${SITE_STYLE[k].color};border-radius:${k === 'city' ? '2px' : '50%'}"></span><span>${SITE_STYLE[k].label} (${world.sites.filter((x) => x.kind === k).length})</span>`).join('')}
    </div>

    <h2>Premium data</h2>
    ${p ? `<span class="badge ok">Deluxe tables loaded</span> <button class="small" data-action="unload-premium">Remove</button>` : `<span class="badge">Not loaded</span><p class="muted" style="font-size:12px">Some tools need tables from the Deluxe PDF. See the <a href="#" data-action="tab" data-tab="premium">Premium</a> tab.</p>`}
    <input type="file" id="load-premium" accept=".json,application/json" hidden>
    <div class="row"><button class="small" data-action="load-premium">Load premium.json</button></div>

    <h2>About</h2>
    <p class="muted" style="font-size:12px">Built on the free edition of <i>Worlds Without Number</i> by Kevin Crawford (Sine Nomine Publishing). Page numbers refer to the 2021 book. This is an unofficial fan tool.</p>
  `;
}

// ---------------------------------------------------------------- map

function renderMap(): void {
  const siteId = sel?.kind === 'site' ? sel.id : undefined;
  const svg = renderMapSvg(world, layers, HEX, siteId).replace('<svg ', '<svg class="map" ');
  $('#map').innerHTML = svg;
  const el = $('#map').querySelector('svg') as SVGSVGElement;
  el.removeAttribute('width');
  el.removeAttribute('height');
  applyView();
  highlight();
}

function fitView(): void {
  const [W, H] = mapPixelSize(grid(), HEX);
  const wrap = $('#mapwrap').getBoundingClientRect();
  const aspect = wrap.width / Math.max(1, wrap.height);
  let w = W + 20, h = H + 20;
  if (w / h < aspect) w = h * aspect; else h = w / aspect;
  view = { x: (W - w) / 2, y: (H - h) / 2, w, h };
  applyView();
}

function applyView(): void {
  const el = $('#map').querySelector('svg');
  el?.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
}

function zoom(factor: number, cx = view.x + view.w / 2, cy = view.y + view.h / 2): void {
  const w = Math.min(Math.max(view.w * factor, 150), 6000);
  const k = w / view.w;
  view = { x: cx - (cx - view.x) * k, y: cy - (cy - view.y) * k, w, h: view.h * k };
  applyView();
}

function selectedHex(): number | undefined {
  if (!sel) return undefined;
  if (sel.kind === 'hex') return sel.id;
  if (sel.kind === 'site') return world.sites.find((s) => s.id === sel!.id)?.hex;
  return undefined;
}

function highlight(): void {
  const h = selectedHex();
  const poly = $('#map').querySelector('#hex-highlight');
  poly?.setAttribute('points', h === undefined ? '' : hexPolygon(world, h, HEX));
}

function centerOn(hex: number): void {
  const [x, y] = center(grid(), hex, HEX);
  view = { ...view, x: x - view.w / 2, y: y - view.h / 2 };
  applyView();
}

function wireMap(): void {
  const wrap = $('#mapwrap');
  let drag: { x: number; y: number; vx: number; vy: number; moved: boolean } | null = null;
  const toWorld = (e: MouseEvent) => {
    const r = wrap.getBoundingClientRect();
    return [view.x + ((e.clientX - r.left) / r.width) * view.w, view.y + ((e.clientY - r.top) / r.height) * view.h];
  };
  wrap.addEventListener('wheel', (e) => {
    if ((e.target as HTMLElement).closest('.zoom')) return;
    e.preventDefault();
    const [x, y] = toWorld(e);
    zoom(e.deltaY > 0 ? 1.15 : 1 / 1.15, x, y);
  }, { passive: false });
  wrap.addEventListener('mousedown', (e) => {
    if ((e.target as HTMLElement).closest('.zoom')) return;
    drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
  });
  window.addEventListener('mousemove', (e) => {
    const r = wrap.getBoundingClientRect();
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) { drag.moved = true; wrap.classList.add('dragging'); }
      view.x = drag.vx - (dx / r.width) * view.w;
      view.y = drag.vy - (dy / r.height) * view.h;
      applyView();
    }
    const t = e.target as Element;
    const hexAttr = t.closest?.('[data-hex]')?.getAttribute('data-hex');
    if (hexAttr !== null && hexAttr !== undefined && wrap.contains(t)) {
      const h = world.hexes[+hexAttr];
      const n = world.nations.find((x) => x.id === h.nation);
      $('#status').textContent = `${hexLabel(grid(), h.i)} · ${TERRAIN_INFO[h.terrain].label}${h.river ? ' · river' : ''}${n ? ` · ${nameOf(world, n.id, n.name)}` : ''}`;
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    wrap.classList.remove('dragging');
    if (moved) return;
    const t = e.target as Element;
    const site = t.closest?.('[data-site]')?.getAttribute('data-site');
    const hex = t.closest?.('[data-hex]')?.getAttribute('data-hex');
    if (site) select({ kind: 'site', id: site });
    else if (hex !== null && hex !== undefined) {
      const sitesHere = world.sites.filter((s) => s.hex === +hex);
      select(sitesHere.length === 1 ? { kind: 'site', id: sitesHere[0].id } : { kind: 'hex', id: +hex });
    }
  });
}

function select(s: Sel, focus = false): void {
  sel = s;
  tab = 'details';
  if (focus) { const h = selectedHex() ?? (s?.kind === 'nation' ? world.nations.find((n) => n.id === s.id)?.seat : undefined); if (h !== undefined) centerOn(h); }
  if (s?.kind === 'site') renderMap(); else highlight();
  renderPanel();
}

// ---------------------------------------------------------------- panel helpers

function facts(list: Fact[]): string {
  return `<ul class="facts">${list.map((f) => {
    const p = f.ref ? tablePage(f.ref) : undefined;
    return `<li><b>${esc(f.label)}:</b> ${esc(f.text)}${p ? `<span class="page">p.${p}</span>` : ''}</li>`;
  }).join('')}</ul>`;
}

function tagBox(kind: Site['tagKind'], name: string): string {
  const t = tag(kind, name);
  if (!t) return '';
  const row = (k: string, v: string[]) => `<dt>${k}</dt><dd>${v.map(esc).join('; ')}</dd>`;
  return `<div class="tagbox"><h4>${esc(t.name)} <span class="page">${kind} tag, p.${t.page}</span></h4><p>${esc(t.description)}</p>
    <dl>${row('E', t.enemies)}${row('F', t.friends)}${row('C', t.complications)}${row('T', t.things)}${row('P', t.places)}</dl></div>`;
}

function extras(id: string): string {
  return (world.extras[id] ?? []).map((e) => `<div class="extra"><h4>${esc(e.title)} <button class="small" data-action="remove-extra" data-owner="${id}" data-extra="${esc(e.id)}" title="Remove">✕</button></h4>${facts(e.facts)}</div>`).join('');
}

function nameEditor(id: string, fallback: string): string {
  return `<input class="edit-name" data-rename="${id}" value="${esc(nameOf(world, id, fallback))}" title="Click to rename">`;
}

function notesEditor(id: string): string {
  return `<h2>Notes</h2><textarea data-notes="${id}" placeholder="Your notes. They are saved with the world and exported to Obsidian.">${esc(world.overrides[id]?.notes ?? '')}</textarea>`;
}

const link = (kind: string, id: string | undefined, label: string) => (id ? `<a href="#" data-action="select" data-kind="${kind}" data-id="${id}">${esc(label)}</a>` : esc(label));
const siteLink = (id?: string) => { const s = world.sites.find((x) => x.id === id); return s ? link('site', s.id, nameOf(world, s.id, s.name)) : ''; };
const nationLink = (id?: string) => { const n = world.nations.find((x) => x.id === id); return n ? link('nation', n.id, nameOf(world, n.id, n.name)) : ''; };

function premiumButton(action: string, label: string, data = ''): string {
  const ok = premiumReady();
  return `<button class="small" data-action="${action}" ${data} ${ok ? '' : 'disabled title="Needs Deluxe data. See the Premium tab."'}>${ok ? '' : '🔒 '}${label}</button>`;
}

// ---------------------------------------------------------------- panel views

function viewSite(s: Site): string {
  const n = world.nations.find((x) => x.id === s.nation);
  const st = SITE_STYLE[s.kind];
  const here = world.sites.filter((o) => o.hex === s.hex && o.id !== s.id);
  const dungeons = world.dungeons.filter((d) => d.siteId === s.id);
  const factions = world.factions.filter((f) => f.homeSite === s.id);
  const inRegion = world.features.find((f) => f.hexes.includes(s.hex));
  return `
    ${nameEditor(s.id, s.name)}
    <div class="subtitle">${esc(s.subtitle)}</div>
    <ul class="facts">
      <li><b>Kind:</b> <span class="dot" style="background:${st.color}"></span> ${st.label}${s.meta.courtType ? ` (${COURT_LABEL[s.meta.courtType as keyof typeof COURT_LABEL]})` : ''}</li>
      <li><b>Hex:</b> ${hexLabel(grid(), s.hex)}, ${TERRAIN_INFO[world.hexes[s.hex].terrain].label.toLowerCase()}${world.hexes[s.hex].river ? ', on a river' : ''}${inRegion ? ` in ${link('feature', inRegion.id, nameOf(world, inRegion.id, inRegion.name))}` : ''}</li>
      <li><b>Nation:</b> ${n ? nationLink(n.id) : 'Unclaimed wilderness'}</li>
      ${s.population ? `<li><b>Population:</b> about ${s.population.toLocaleString('en-US')}</li>` : ''}
      ${here.length ? `<li><b>Also here:</b> ${here.map((o) => siteLink(o.id)).join(', ')}</li>` : ''}
      ${factions.length ? `<li><b>Base of:</b> ${factions.map((f) => link('faction', f.id, nameOf(world, f.id, f.name))).join(', ')}</li>` : ''}
    </ul>
    <h2>Details</h2>${facts(s.facts)}
    <h2>Tags</h2>${s.tags.map((t) => tagBox(s.tagKind, t)).join('')}
    <h2>Dungeon</h2>
    ${dungeons.map((d) => `<div>${link('dungeon', d.id, d.name)} <span class="muted">(${d.rooms.length} rooms)</span></div>`).join('')}
    <div class="row">
      <select id="dungeon-rooms">${[10, 20, 30, 40].map((r) => `<option value="${r}" ${r === 20 ? 'selected' : ''}>${r} rooms</option>`).join('')}</select>
      <button class="small" data-action="site-dungeon" data-id="${s.id}">Generate ${s.kind === 'ruin' ? 'ruin' : 'exploration site'} dungeon</button>
    </div>
    <h2>Premium tools</h2>
    <div class="row">${premiumButton('site-npc', 'Generate NPC', `data-id="${s.id}"`)} ${premiumButton('site-seed', 'Fractal adventure seed', `data-id="${s.id}"`)}</div>
    ${extras(s.id)}
    ${notesEditor(s.id)}`;
}

function viewNation(id: string): string {
  const n = world.nations.find((x) => x.id === id)!;
  const sites = world.sites.filter((s) => s.nation === id);
  return `
    ${nameEditor(n.id, n.name)}
    <div class="subtitle"><span class="dot" style="background:${n.color}"></span> Nation · ${n.hexes.length} hexes · population about ${n.population.toLocaleString('en-US')}</div>
    <ul class="facts">
      <li><b>Capital:</b> ${siteLink(n.capital) || 'none'}</li>
      <li><b>Gods:</b> ${n.gods.map((g) => { const x = world.gods.find((y) => y.id === g)!; return link('god', x.id, nameOf(world, x.id, x.name)); }).join(', ')}</li>
    </ul>
    <h2>Character</h2>${facts(n.facts)}
    <h2>Neighbors</h2>
    <ul class="facts">${n.relations.map((r) => `<li><b>${r.kind === 'dispute' ? 'Dispute with' : 'Tie with'} ${nationLink(r.nation)}:</b> ${esc(r.text)}<span class="page">p.125</span></li>`).join('') || '<li class="muted">No direct neighbors.</li>'}</ul>
    <h2>Cities</h2>
    <ul class="list">${sites.filter((s) => s.kind === 'capital' || s.kind === 'city').map((s) => `<li data-action="select" data-kind="site" data-id="${s.id}">${esc(nameOf(world, s.id, s.name))}<span class="meta">${s.population?.toLocaleString('en-US') ?? ''}</span></li>`).join('')}</ul>
    <p class="muted">${sites.length} sites in total. ${world.factions.filter((f) => f.nation === id).map((f) => link('faction', f.id, nameOf(world, f.id, f.name))).join(', ')}</p>
    <h2>Premium tools</h2>
    <div class="row">${premiumButton('nation-arch', 'Architectural style', `data-id="${n.id}"`)} ${premiumButton('nation-npc', 'Notable NPC', `data-id="${n.id}"`)}</div>
    ${extras(n.id)}
    ${notesEditor(n.id)}`;
}

function viewFaction(id: string): string {
  const f = world.factions.find((x) => x.id === id)!;
  const goal = free.factions.goals.find((g) => g.name === f.goal);
  return `
    ${nameEditor(f.id, f.name)}
    <div class="subtitle">${esc(f.kind)} · ${f.size} faction</div>
    <div class="stats">
      <div>Cunning<b>${f.cunning}</b></div><div>Force<b>${f.force}</b></div><div>Wealth<b>${f.wealth}</b></div>
      <div>Magic<b style="font-size:13px;padding:3px 0">${f.magic}</b></div><div>HP<b>${f.hp}</b></div><div>Treasure<b>${f.treasure}</b></div>
    </div>
    <ul class="facts">
      <li><b>Base of Influence:</b> ${siteLink(f.homeSite) || 'none'}</li>
      <li><b>Nation:</b> ${nationLink(f.nation) || 'none'}</li>
      <li><b>Income:</b> ${income(f)} Treasure per faction turn<span class="page">p.324</span></li>
      <li><b>Rivals:</b> ${f.rivals.map((r) => { const o = world.factions.find((x) => x.id === r)!; return link('faction', o.id, nameOf(world, o.id, o.name)); }).join(', ') || 'none'}</li>
      <li><b>Goal: ${esc(f.goal)}.</b> ${esc(goal?.text ?? '')}<span class="page">p.327</span></li>
      ${f.tags.map((t) => { const d = free.factions.tags.find((x) => x.name === t); return `<li><b>Tag: ${esc(t)}.</b> ${esc(d?.text ?? '')}<span class="page">p.${d?.page}</span></li>`; }).join('')}
    </ul>
    <p class="muted" style="font-size:12px">Starting Treasure is one turn of income. The book does not give a starting value.</p>
    <h2>Assets</h2>
    <table class="assets"><tr><th>Asset</th><th>Attr.</th><th>HP</th><th>Location</th></tr>
    ${f.assets.map((a) => { const d = free.factions.assets.find((x) => x.name === a.name); return `<tr class="tip" data-tip="${esc(d ? `<b>${esc(d.name)}</b> · ${esc(d.attribute)} ${d.rating}, cost ${d.cost}, HP ${d.hp}<br>Attack: ${esc(d.attack)} · Counter: ${esc(d.counter)}<br><i>${esc(d.qualities.join(', '))}</i><br>${esc(d.text ?? '')}` : '<b>Base of Influence</b><br>The faction\'s headquarters.')}"><td>${esc(a.name)}</td><td>${esc(a.attribute)}${d ? ` ${d.rating}` : ''}</td><td>${a.hp}/${a.maxHp}</td><td>${a.site ? siteLink(a.site) : esc(a.location)}</td></tr>`; }).join('')}
    </table>
    <p class="muted" style="font-size:12px">Hover or tap an asset for its rules text.</p>
    <h2>Recent doings</h2>${facts(f.facts)}
    ${extras(f.id)}
    ${notesEditor(f.id)}`;
}

function viewGod(id: string): string {
  const g = world.gods.find((x) => x.id === id)!;
  return `${nameEditor(g.id, g.name)}<div class="subtitle">${esc(g.domain)}</div>${facts(g.facts)}
    <h2>Worshipped in</h2><p>${world.nations.filter((n) => n.gods.includes(id)).map((n) => nationLink(n.id)).join(', ') || 'Hidden cults across the region'}</p>${notesEditor(g.id)}`;
}

function viewFeature(id: string): string {
  const f = world.features.find((x) => x.id === id)!;
  return `${nameEditor(f.id, f.name)}<div class="subtitle">${esc(f.kind)} · ${f.hexes.length} hexes</div>
    <p>${esc(f.description)}<span class="page">p.121</span></p>${facts(f.facts)}
    <h2>Sites inside</h2><p>${world.sites.filter((s) => f.hexes.includes(s.hex)).map((s) => siteLink(s.id)).join(', ') || '<span class="muted">None</span>'}</p>${notesEditor(f.id)}`;
}

function viewHex(i: number): string {
  const h = world.hexes[i];
  const n = world.nations.find((x) => x.id === h.nation);
  const f = world.features.find((x) => x.hexes.includes(i));
  const sites = world.sites.filter((s) => s.hex === i);
  return `<h3>Hex ${hexLabel(grid(), i)}</h3><div class="subtitle">${TERRAIN_INFO[h.terrain].label}</div>
    <ul class="facts">
      <li><b>Nation:</b> ${n ? nationLink(n.id) : 'Unclaimed'}</li>
      ${f ? `<li><b>Feature:</b> ${link('feature', f.id, nameOf(world, f.id, f.name))}</li>` : ''}
      <li><b>River:</b> ${h.river ? 'yes' : 'no'} · <b>Road:</b> ${h.road ? 'yes' : 'no'}</li>
    </ul>
    ${sites.length ? `<h2>Sites</h2><ul class="list">${sites.map((s) => `<li data-action="select" data-kind="site" data-id="${s.id}">${esc(nameOf(world, s.id, s.name))}<span class="meta">${SITE_STYLE[s.kind].label}</span></li>`).join('')}</ul>` : '<p class="muted">Nothing of note in this hex.</p>'}`;
}

function viewDungeon(id: string): string {
  const d = world.dungeons.find((x) => x.id === id)!;
  return `${nameEditor(d.id, d.name)}
    <div class="subtitle">${esc(d.siteType)}: ${esc(d.example)} · inhabitants typical of ${esc(d.inhabitantKind.toLowerCase())}</div>
    ${d.siteId ? `<p>Site: ${siteLink(d.siteId)}</p>` : ''}
    <div class="row"><button class="small" data-action="reroll-dungeon" data-id="${d.id}">↻ Reroll</button><button class="small" data-action="delete-dungeon" data-id="${d.id}">Delete</button><span class="muted" style="font-size:12px">Seed <code>${esc(d.seed)}</code></span></div>
    <div class="row"><button class="small" data-action="dungeon-popout" data-id="${d.id}" title="Open the map in a full-window view with pan and zoom">⤢ Pop out map</button><span class="muted" style="font-size:12px">Or click a room on the map.</span></div>
    <div class="dungeon-map">${renderDungeonSvg(d)}</div>
    ${dungeonLegend()}
    ${facts(d.facts)}
    <h2>Inhabitants</h2>
    <ul class="facts">${d.groups.map((g) => `<li><b>${esc(g.name)}.</b> Came here: ${esc(g.came)}. Staying because: ${esc(g.staying)}.</li>`).join('')}${d.relations.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
    ${d.features.length ? `<h2>Map features</h2><ul class="facts">${d.features.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    <h2>Rooms</h2>
    ${d.rooms.map((r) => `<div class="room" id="room-${r.n}">${roomHtml(d, r)}</div>`).join('')}
    <h2>Wandering encounters (1d6)</h2>
    <p class="muted" style="font-size:12px">Roll 1d6 after each scene or move between rooms. On a 1, roll on this table.<span class="page">p.236</span></p>
    <ol>${d.wandering.map((w) => `<li>${esc(w)}</li>`).join('')}</ol>
    ${notesEditor(d.id)}`;
}

function dungeonLegend(): string {
  return `<div class="legend" style="grid-template-columns:repeat(5,auto 1fr)">${Object.entries(ROOM_COLORS).map(([k, c]) => `<span class="dot" style="background:${c};border-radius:2px"></span><span>${k}</span>`).join('')}</div>
    <p class="muted" style="font-size:12px">Circle: entrance. Thick border and ◆: treasure. ▼: way down. Dotted line: secret door. Blue line: river, crevasse, or other obstacle.</p>`;
}

/** One room's description. The exits are links that jump to the connected room. */
function roomHtml(d: Dungeon, r: Dungeon['rooms'][number]): string {
  const exits = d.links.filter((l) => l.a === r.n || l.b === r.n).map((l) => {
    const o = l.a === r.n ? l.b : l.a;
    return `<a href="#" data-action="dungeon-room" data-room="${o}">${o}</a>${l.kind === 'secret' ? ' (secret)' : l.kind === 'hazard' ? ' (obstacle)' : ''}`;
  });
  return `<b>${r.n}. ${esc(r.name)}</b> <span class="muted">(${esc(r.function)})</span><br>
      <span class="k" style="background:${ROOM_COLORS[r.contents]}">${r.contents}</span>${esc(r.detail)}
      ${r.treasure ? `<br>◆ <i>${esc(r.treasure)}</i>` : ''}${r.notes.map((x) => `<br><span class="muted">${esc(x)}</span>`).join('')}
      <br><span class="muted">Exits to ${exits.join(', ')}</span>`;
}

function listNations(): string {
  return `<ul class="list">${world.nations.map((n) => `<li data-action="select" data-kind="nation" data-id="${n.id}" data-focus="1"><span class="dot" style="background:${n.color}"></span>${esc(nameOf(world, n.id, n.name))}<span class="meta">${n.hexes.length} hexes<br>${n.population.toLocaleString('en-US')}</span></li>`).join('')}</ul>`;
}

function listSites(): string {
  const q = siteFilter.toLowerCase();
  const list = world.sites.filter((s) => !q || `${nameOf(world, s.id, s.name)} ${s.subtitle} ${s.kind} ${s.tags.join(' ')}`.toLowerCase().includes(q));
  return `<input id="site-filter" placeholder="Filter by name, kind, or tag" value="${esc(siteFilter)}" style="width:100%;margin-bottom:8px">
    <p class="muted" style="font-size:12px">${list.length} of ${world.sites.length} sites</p>
    <ul class="list">${list.map((s) => `<li data-action="select" data-kind="site" data-id="${s.id}" data-focus="1"><span class="dot" style="background:${SITE_STYLE[s.kind].color}"></span><span>${esc(nameOf(world, s.id, s.name))}<br><span class="muted" style="font-size:12px">${esc(s.subtitle)}</span></span><span class="meta">${hexLabel(grid(), s.hex)}</span></li>`).join('')}</ul>`;
}

function listFactions(): string {
  return `<div class="row"><button class="small" data-action="reroll" data-layer="factions">↻ Regenerate factions</button></div>
    <ul class="list">${world.factions.map((f) => `<li data-action="select" data-kind="faction" data-id="${f.id}"><span>${esc(nameOf(world, f.id, f.name))}<br><span class="muted" style="font-size:12px">${esc(f.kind)}, ${f.size}</span></span><span class="meta">C${f.cunning} F${f.force} W${f.wealth}<br>HP ${f.hp}</span></li>`).join('')}</ul>
    <p class="muted" style="font-size:12px">The book recommends three to six active factions (p.327).</p>`;
}

function listDungeons(): string {
  const groups = matrix('dungeon.siteTypes').groups;
  return `<p class="muted" style="font-size:13px">Generate a dungeon from a ruin's page, or make a standalone one here. The procedure follows "Creating Exploration Challenges" (p.234-247).</p>
    <div class="field"><label>Rooms</label><select id="sd-rooms">${[10, 20, 30, 40].map((r) => `<option ${r === 20 ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
    <div class="field"><label>Site type</label><select id="sd-group"><option value="">Random</option>${groups.map((g) => `<option>${esc(g.name)}</option>`).join('')}</select></div>
    <div class="field"><label>Inhabitants</label><select id="sd-kind"><option value="">Random</option>${Object.entries(INHABITANT_KINDS).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></div>
    <div class="row"><button class="primary" data-action="standalone-dungeon">Generate dungeon</button></div>
    <h2>Dungeons in this world</h2>
    <ul class="list">${world.dungeons.map((d) => `<li data-action="select" data-kind="dungeon" data-id="${d.id}">${esc(nameOf(world, d.id, d.name))}<span class="meta">${d.rooms.length} rooms</span></li>`).join('') || '<li class="muted">None yet.</li>'}</ul>`;
}

function listGods(): string {
  return `<ul class="list">${world.gods.map((g) => {
    const nations = world.nations.filter((n) => n.gods.includes(g.id)).map((n) => nameOf(world, n.id, n.name));
    return `<li data-action="select" data-kind="god" data-id="${g.id}"><span>${esc(nameOf(world, g.id, g.name))}<br><span class="muted" style="font-size:12px">${esc(g.domain)}</span></span><span class="meta" style="max-width:45%">${esc(nations.join(', ') || 'Hidden cults')}</span></li>`;
  }).join('')}</ul>
    <p class="muted" style="font-size:12px">Regional and local gods, plus one sinister cult (p.140-145).</p>`;
}

function listLore(): string {
  return `<h3>${esc(world.regionName)}</h3>
    <div class="subtitle">Region · coasts: ${world.oceanSides.join(', ') || 'none'} · ${world.settings.cols}×${world.settings.rows} hexes of ${world.settings.hexMiles} miles</div>
    <h2>Gods</h2>
    <ul class="list">${world.gods.map((g) => `<li data-action="select" data-kind="god" data-id="${g.id}">${esc(nameOf(world, g.id, g.name))}<span class="meta" style="max-width:60%">${esc(g.domain)}</span></li>`).join('')}</ul>
    <h2>Significant terrain features</h2>
    <ul class="list">${world.features.map((f) => `<li data-action="select" data-kind="feature" data-id="${f.id}">${esc(nameOf(world, f.id, f.name))}<span class="meta">${esc(f.kind)}</span></li>`).join('')}</ul>
    ${extras('world')}`;
}

function viewPremium(): string {
  const p = getPremium();
  const lockedList = `<ul>
      <li>NPC generator for sites and nations (Random NPC Types, One-Roll Characterization)</li>
      <li>Fractal adventure seeds filled from each site's tags</li>
      <li>Architectural style for nations</li>
      <li>Infernal Iterums and summoned Iterum creatures</li>
      <li>Adventure hooks and oracle tables</li></ul>`;
  if (!p) {
    return `<h3>Premium tools</h3>
      <div class="lock">
        <p>🔒 These tools use tables that exist only in the <b>Deluxe</b> edition of <i>Worlds Without Number</i>. This app does not ship that content.</p>
        ${lockedList}
        <p>To use them, extract the data from your own copy of the Deluxe PDF with the command-line tool in this repository:</p>
        <pre>npm install
npm run premium -- path/to/WorldsWithoutNumber_DeluxePDF.pdf</pre>
        <p>This writes <code>premium/premium.json</code>. If you run the app with <code>npm run dev</code>, it loads the file on start. If you use a hosted copy of the app, load the file here:</p>
        <div class="row"><button class="primary" data-action="load-premium">Load premium.json</button></div>
        <p class="muted" style="font-size:12px">The file stays in your browser. Do not share or commit it.</p>
      </div>`;
  }
  return `<h3>Premium tools</h3><p><span class="badge ok">Deluxe tables loaded</span> ${Object.keys(p.tables).length} tables, ${Object.values(p.seeds).flat().length} adventure seeds.</p>
    <p class="muted" style="font-size:13px">Site and nation tools are on each site's and nation's page. Region-wide tools:</p>
    <div class="row">
      <button class="small" data-action="world-extra" data-gen="iterum">Infernal Iterum</button>
      <button class="small" data-action="world-extra" data-gen="summoned">Summoned Iterum creatures</button>
      <button class="small" data-action="world-extra" data-gen="hook">Adventure hook</button>
      <button class="small" data-action="world-extra" data-gen="npc">Random NPC</button>
    </div>
    ${extras('world')}`;
}

function renderPanel(): void {
  hideTip();
  const tabs: [Tab, string][] = [['details', 'Details'], ['nations', 'Nations'], ['sites', 'Sites'], ['factions', 'Factions'], ['gods', 'Gods'], ['dungeons', 'Dungeons'], ['lore', 'Region'], ['premium', getPremium() ? 'Premium' : '🔒 Premium']];
  $('#tabs').innerHTML = tabs.map(([k, l]) => `<button class="${tab === k ? 'active' : ''}" data-action="tab" data-tab="${k}">${l}</button>`).join('');
  let html = '';
  if (tab === 'details') {
    if (!sel) html = `<h3>${esc(world.regionName)}</h3><p class="muted">Click a hex or a site on the map. Drag to pan, scroll to zoom.</p>${listLore()}`;
    else if (sel.kind === 'hex') html = viewHex(sel.id);
    else if (sel.kind === 'site') { const s = world.sites.find((x) => x.id === sel!.id); html = s ? viewSite(s) : ''; }
    else if (sel.kind === 'nation') html = viewNation(sel.id);
    else if (sel.kind === 'faction') html = viewFaction(sel.id);
    else if (sel.kind === 'god') html = viewGod(sel.id);
    else if (sel.kind === 'feature') html = viewFeature(sel.id);
    else if (sel.kind === 'dungeon') html = viewDungeon(sel.id);
  } else if (tab === 'nations') html = listNations();
  else if (tab === 'sites') html = listSites();
  else if (tab === 'factions') html = listFactions();
  else if (tab === 'gods') html = listGods();
  else if (tab === 'dungeons') html = listDungeons();
  else if (tab === 'lore') html = listLore();
  else html = viewPremium();
  $('#panel').innerHTML = html;
  if (tab === 'sites') {
    const inp = $<HTMLInputElement>('#site-filter');
    inp.addEventListener('input', () => {
      siteFilter = inp.value;
      const pos = inp.selectionStart;
      renderPanel();
      const again = $<HTMLInputElement>('#site-filter');
      again.focus();
      again.setSelectionRange(pos, pos);
    });
  }
}

function renderAll(): void {
  ($('#seed') as HTMLInputElement).value = world.master;
  renderSidebar();
  renderMap();
  renderPanel();
}

// ---------------------------------------------------------------- tooltips

// Instant tooltip for elements with data-tip (trusted HTML built by this app). Hover on desktop, tap on touch screens.
function showTip(el: HTMLElement): void {
  let tip = $('#tip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'tip';
    tip.className = 'tooltip';
    document.body.appendChild(tip);
  }
  tip.innerHTML = el.dataset.tip!;
  tip.hidden = false;
  const r = el.getBoundingClientRect(), t = tip.getBoundingClientRect();
  const left = Math.max(8, Math.min(window.innerWidth - t.width - 8, r.left));
  const below = r.bottom + 6 + t.height < window.innerHeight;
  tip.style.left = `${left}px`;
  tip.style.top = `${below ? r.bottom + 6 : Math.max(8, r.top - t.height - 6)}px`;
}

function hideTip(): void {
  const tip = $('#tip');
  if (tip) tip.hidden = true;
}

// ---------------------------------------------------------------- dungeon pop-out

// A full-window view of one dungeon map: drag to pan, wheel or buttons to zoom, click a room to read it.
let pop: { id: string; x: number; y: number; k: number; w: number; h: number } | null = null;

function openPopout(id: string, room = 1): void {
  closePopout();
  const d = world.dungeons.find((x) => x.id === id);
  if (!d) return;
  const el = document.createElement('div');
  el.className = 'popout';
  el.id = 'popout';
  el.innerHTML = `<div class="popout-head">
      <b>${esc(nameOf(world, d.id, d.name))}</b><span class="muted">${d.rooms.length} rooms · drag to pan, scroll to zoom, click a room</span>
      <span class="spacer"></span>
      <button data-action="popout-zoom" data-dir="in" title="Zoom in">+</button><button data-action="popout-zoom" data-dir="out" title="Zoom out">−</button>
      <button data-action="popout-fit" title="Fit the whole map">Fit</button><button data-action="popout-close" title="Close (Esc)">✕</button>
    </div>
    <div class="popout-body">
      <div class="popout-map" id="popout-map"><div class="popout-canvas" id="popout-canvas">${renderDungeonSvg(d)}</div></div>
      <aside class="popout-side"><div class="room" id="popout-room"></div>${dungeonLegend()}</aside>
    </div>`;
  document.body.appendChild(el);
  const svg = el.querySelector('svg')!;
  pop = { id, x: 0, y: 0, k: 1, w: +svg.getAttribute('width')!, h: +svg.getAttribute('height')! };
  wirePopout($('#popout-map'));
  fitPopout();
  popoutRoom(room, room !== 1);
}

function closePopout(): void {
  $('#popout')?.remove();
  pop = null;
}

function applyPopout(): void {
  if (pop) $('#popout-canvas').style.transform = `translate(${pop.x}px, ${pop.y}px) scale(${pop.k})`;
}

function fitPopout(): void {
  if (!pop) return;
  const r = $('#popout-map').getBoundingClientRect();
  pop.k = Math.min(3, (r.width - 40) / pop.w, (r.height - 40) / pop.h);
  pop.x = (r.width - pop.w * pop.k) / 2;
  pop.y = (r.height - pop.h * pop.k) / 2;
  applyPopout();
}

/** Zooms by a factor around a point in the map viewport (default: its center). */
function zoomPopout(f: number, px?: number, py?: number): void {
  if (!pop) return;
  const r = $('#popout-map').getBoundingClientRect();
  px ??= r.width / 2; py ??= r.height / 2;
  const k = Math.min(6, Math.max(0.2, pop.k * f));
  pop.x = px - (px - pop.x) * (k / pop.k);
  pop.y = py - (py - pop.y) * (k / pop.k);
  pop.k = k;
  applyPopout();
}

/** Shows one room in the side card, marks it and its neighbors on the map, and optionally centers it. */
function popoutRoom(n: number, centerOn = false): void {
  const d = pop && world.dungeons.find((x) => x.id === pop!.id);
  const r = d?.rooms[n - 1];
  if (!pop || !d || !r) return;
  $('#popout-room').innerHTML = roomHtml(d, r);
  const near = new Set(d.links.filter((l) => l.a === n || l.b === n).map((l) => (l.a === n ? l.b : l.a)));
  document.querySelectorAll<SVGGElement>('#popout-canvas g[data-room]').forEach((g) => {
    const m = +g.dataset.room!;
    g.classList.toggle('selected', m === n);
    g.classList.toggle('near', near.has(m));
  });
  if (centerOn) {
    const g = $('#popout-canvas').querySelector<SVGGElement>(`g[data-room="${n}"]`)!;
    const box = g.getBBox();
    const v = $('#popout-map').getBoundingClientRect();
    pop.x = v.width / 2 - (box.x + box.width / 2) * pop.k;
    pop.y = v.height / 2 - (box.y + box.height / 2) * pop.k;
    applyPopout();
  }
}

function wirePopout(mapEl: HTMLElement): void {
  let drag: { x: number; y: number; px: number; py: number; moved: boolean; room?: number } | null = null;
  mapEl.addEventListener('pointerdown', (e) => {
    if (!pop) return;
    const g = (e.target as Element).closest('g[data-room]') as SVGGElement | null;
    drag = { x: e.clientX, y: e.clientY, px: pop.x, py: pop.y, moved: false, room: g ? +g.dataset.room! : undefined };
    mapEl.setPointerCapture(e.pointerId);
  });
  mapEl.addEventListener('pointermove', (e) => {
    if (!drag || !pop) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true;
    mapEl.classList.add('dragging');
    pop.x = drag.px + dx;
    pop.y = drag.py + dy;
    applyPopout();
  });
  mapEl.addEventListener('pointerup', () => {
    if (drag && !drag.moved && drag.room) popoutRoom(drag.room);
    drag = null;
    mapEl.classList.remove('dragging');
  });
  mapEl.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = mapEl.getBoundingClientRect();
    zoomPopout(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
}

// ---------------------------------------------------------------- actions

function readSettings(): Settings {
  const v = (id: string) => ($(`#${id}`) as HTMLInputElement).value;
  const size = v('size');
  const [cols, rows] = size === 'custom' ? [Math.min(60, Math.max(8, +v('cols'))), Math.min(50, Math.max(6, +v('rows')))] : SIZE_PRESETS[size];
  return {
    cols, rows,
    density: +v('density') as Settings['density'],
    nations: Math.min(12, Math.max(1, +v('nations') || 1)),
    factions: Math.min(10, Math.max(1, +v('factions') || 1)),
    oceanSides: +v('ocean'),
    hexMiles: Math.max(1, +v('miles') || 6),
  };
}

function generate(master: string): void {
  world = buildWorld(readSettings(), master, seedsFrom(master));
  sel = null;
  tab = 'details';
  save();
  renderAll();
  fitView();
}

function addExtra(owner: string, e: Extra): void {
  (world.extras[owner] ??= []).push(e);
  save();
  renderPanel();
}

function addDungeon(d: Dungeon): void {
  world.dungeons = world.dungeons.filter((x) => x.id !== d.id);
  world.dungeons.push(d);
  save();
  select({ kind: 'dungeon', id: d.id });
}

async function handle(action: string, el: HTMLElement): Promise<void> {
  const id = el.dataset.id ?? '';
  const site = () => world.sites.find((s) => s.id === id)!;
  const styleOf = (s?: Site | { nation?: string }) => world.nations.find((n) => n.id === s?.nation)?.style ?? world.regionStyle;
  switch (action) {
    case 'generate': generate(($('#seed') as HTMLInputElement).value.trim() || randomSeed()); break;
    case 'random-seed': ($('#seed') as HTMLInputElement).value = randomSeed(); generate(($('#seed') as HTMLInputElement).value); break;
    case 'reroll': {
      const layer = el.dataset.layer as keyof World['seeds'];
      reroll(world, layer);
      if (sel && sel.kind !== 'hex' && !findEntity(sel)) sel = null;
      save();
      renderAll();
      if (layer === 'terrain') fitView();
      toast(`Regenerated ${layer}`);
      break;
    }
    case 'tab': tab = el.dataset.tab as Tab; renderPanel(); break;
    case 'select': select({ kind: el.dataset.kind as never, id: el.dataset.id as never }, el.dataset.focus === '1' || el.tagName === 'A'); break;
    case 'zoom-in': zoom(1 / 1.3); break;
    case 'dungeon-popout': openPopout(id); break;
    case 'popout-close': closePopout(); break;
    case 'popout-fit': fitPopout(); break;
    case 'popout-zoom': zoomPopout(el.dataset.dir === 'in' ? 1.3 : 1 / 1.3); break;
    case 'dungeon-room': {
      const n = +el.dataset.room!;
      if (pop) popoutRoom(n, true);
      else document.getElementById(`room-${n}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      break;
    }
    case 'zoom-out': zoom(1.3); break;
    case 'zoom-fit': fitView(); break;
    case 'site-dungeon': {
      const s = site();
      const rooms = +(($('#dungeon-rooms') as HTMLSelectElement)?.value ?? 20);
      const n = world.dungeons.filter((d) => d.siteId === s.id).length;
      const kind = s.meta.category ?? (s.kind === 'wilderness' ? 'wilderness' : world.hexes[s.hex].terrain === 'arratu' ? 'arratu' : 'modern');
      addDungeon(generateDungeon(`${world.seeds.sites}:${s.id}:${n}`, { rooms, inhabitantKind: kind, siteGroup: s.meta.siteGroup, siteExample: s.meta.siteExample, name: n ? `${s.name} ${n + 1}` : s.name }, s));
      break;
    }
    case 'standalone-dungeon': {
      const v = (q: string) => ($(q) as HTMLSelectElement).value;
      addDungeon(generateDungeon(randomSeed(), { rooms: +v('#sd-rooms'), siteGroup: v('#sd-group') || undefined, inhabitantKind: v('#sd-kind') || undefined }));
      break;
    }
    case 'reroll-dungeon': {
      const d = world.dungeons.find((x) => x.id === id)!;
      const s = world.sites.find((x) => x.id === d.siteId);
      const fresh = generateDungeon(randomSeed(), { rooms: d.rooms.length, inhabitantKind: Object.entries(INHABITANT_KINDS).find(([, l]) => l === d.inhabitantKind)?.[0], siteGroup: d.siteType, siteExample: s ? d.example : undefined, name: d.name }, s);
      world.dungeons = world.dungeons.filter((x) => x.id !== id);
      addDungeon(fresh);
      break;
    }
    case 'delete-dungeon': world.dungeons = world.dungeons.filter((x) => x.id !== id); save(); sel = null; tab = 'dungeons'; renderPanel(); break;
    case 'site-npc': { const s = site(); addExtra(s.id, npc(new Rng(randomSeed()), styleOf(s), s.meta.courtType === 'criminal' ? 'criminals' : s.kind === 'community' ? 'villagers' : undefined)); break; }
    case 'site-seed': addExtra(id, adventureSeed(new Rng(randomSeed()), site())); break;
    case 'nation-arch': addExtra(id, architecture(new Rng(randomSeed()))); break;
    case 'nation-npc': addExtra(id, npc(new Rng(randomSeed()), world.nations.find((n) => n.id === id)!.style, 'nobility')); break;
    case 'world-extra': {
      const rng = new Rng(randomSeed());
      const gen = el.dataset.gen;
      addExtra('world', gen === 'iterum' ? iterum(rng) : gen === 'summoned' ? iterum(rng, true) : gen === 'hook' ? hook(rng) : npc(rng, world.regionStyle));
      break;
    }
    case 'remove-extra': {
      const owner = el.dataset.owner!;
      world.extras[owner] = (world.extras[owner] ?? []).filter((e) => e.id !== el.dataset.extra);
      save();
      renderPanel();
      break;
    }
    case 'export-vault': {
      el.setAttribute('disabled', '');
      try {
        download(await exportVault(world), `WWN ${safe(world.regionName)}.zip`);
        toast('Vault downloaded. Unzip it, open the folder as a vault in Obsidian, and trust the vault to turn on the bundled Leaflet plugin.');
      } catch (e) { toast(`Export failed: ${(e as Error).message}`); } finally { el.removeAttribute('disabled'); }
      break;
    }
    case 'save-json': download(new Blob([JSON.stringify(world, null, 1)], { type: 'application/json' }), `wwn-${safe(world.master)}.json`); break;
    case 'load-json': ($('#load-json') as HTMLInputElement).click(); break;
    case 'load-premium': ($('#load-premium') as HTMLInputElement).click(); break;
    case 'unload-premium': setPremium(null); renderSidebar(); renderPanel(); toast('Premium data removed from this browser'); break;
  }
}

function findEntity(s: Exclude<Sel, null>): unknown {
  if (s.kind === 'hex') return true;
  const lists: Record<string, { id: string }[]> = { site: world.sites, nation: world.nations, faction: world.factions, god: world.gods, feature: world.features, dungeon: world.dungeons };
  return lists[s.kind].find((x) => x.id === s.id);
}

function wireEvents(): void {
  document.addEventListener('mouseover', (e) => {
    const el = (e.target as Element).closest('[data-tip]') as HTMLElement | null;
    if (el) showTip(el); else hideTip();
  });
  document.addEventListener('click', (e) => {
    const tipEl = (e.target as Element).closest('[data-tip]') as HTMLElement | null;
    if (tipEl && !(e.target as Element).closest('[data-action]')) { showTip(tipEl); return; }
    hideTip();
    const room = (e.target as Element).closest('.dungeon-map g[data-room]') as SVGGElement | null;
    if (room && sel?.kind === 'dungeon') { openPopout(sel.id, +room.dataset.room!); return; }
    const el = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
    if (!el || (el as HTMLButtonElement).disabled) return;
    e.preventDefault();
    void handle(el.dataset.action!, el);
  });
  document.addEventListener('change', async (e) => {
    const el = e.target as HTMLInputElement;
    if (el.id === 'size') { $('#custom-size').hidden = el.value !== 'custom'; return; }
    if (el.dataset.layerToggle) {
      layers[el.dataset.layerToggle as keyof MapLayers] = el.checked;
      try { localStorage.setItem(LAYERS_KEY, JSON.stringify(layers)); } catch { /* ignore */ }
      renderMap();
      return;
    }
    if (el.dataset.rename) {
      (world.overrides[el.dataset.rename] ??= {}).name = el.value.trim() || undefined;
      save(); renderMap(); return;
    }
    if (el.dataset.notes !== undefined) {
      (world.overrides[el.dataset.notes] ??= {}).notes = el.value;
      save(); return;
    }
    if (el.id === 'load-json' && el.files?.[0]) {
      try {
        const w = JSON.parse(await el.files[0].text()) as World;
        if (w.version !== 1 || !w.hexes || !w.seeds) throw new Error('not a world file from this app');
        world = { ...w, extras: w.extras ?? {}, overrides: w.overrides ?? {} };
        sel = null; save(); renderAll(); fitView();
        toast(`Loaded ${world.regionName}`);
      } catch (err) { toast(`Could not load: ${(err as Error).message}`); }
      el.value = '';
    }
    if (el.id === 'load-premium' && el.files?.[0]) {
      try {
        setPremium(validatePremium(JSON.parse(await el.files[0].text())));
        renderSidebar(); renderPanel();
        toast('Premium data loaded');
      } catch (err) { toast((err as Error).message); }
      el.value = '';
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && pop) { closePopout(); return; }
    if (e.key === 'Enter' && (e.target as HTMLElement).id === 'seed') generate((e.target as HTMLInputElement).value.trim() || randomSeed());
  });
  window.addEventListener('resize', () => { fitView(); fitPopout(); });
}

// ---------------------------------------------------------------- start

async function start(): Promise<void> {
  shell();
  try { layers = { ...DEFAULT_LAYERS, ...JSON.parse(localStorage.getItem(LAYERS_KEY) ?? '{}') }; } catch { /* defaults */ }
  let saved: World | null = null;
  try { saved = JSON.parse(localStorage.getItem(WORLD_KEY) ?? 'null'); } catch { saved = null; }
  world = saved && saved.version === 1 ? { ...saved, extras: saved.extras ?? {}, overrides: saved.overrides ?? {} } : buildWorld(DEFAULT_SETTINGS, randomSeed());
  wireEvents();
  wireMap();
  renderAll();
  fitView();
  save();
  if (await loadPremium()) { renderSidebar(); renderPanel(); }
}

void start();

