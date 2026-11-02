# WWN World Builder

A hex-map world builder for *Worlds Without Number*, in the style of *Sectors Without Number*. It generates a region with terrain, nations, cities, ruins, courts, wilderness sites, gods, and factions. It also generates dungeons with the book's exploration-site procedure, and exports everything as an Obsidian vault with an interactive map.

All generation follows the procedures and random tables in *Worlds Without Number* (Kevin Crawford, Sine Nomine Publishing, 2021). Page numbers in the app refer to that book. This is an unofficial fan tool.

## Quick start

Requirements: Node.js 20 or later.

```bash
npm install
```

```bash
npm run dev
```

Open the address that Vite prints (usually http://localhost:5173).

To make a static build (for example, for GitHub Pages):

```bash
npm run build
```

The output is in `dist/`.

## What the app does

| Feature | Book procedure |
|---|---|
| Hex map in four sizes (16×12 to 40×30) or a custom size | Hex maps, p120-122 |
| Ocean sides, about six significant terrain features, 1d4+2 rivers, 1-3 lakes | Making the Regional Map, p120-121 |
| One-roll details for each terrain feature | p123 |
| Nations with borders that follow rivers and mountains, population, cities, and urbanization | Nation Construction, p124 |
| Society, government, history, current problems, and relations with neighbors | p125-139 |
| Regional and local gods, plus one sinister cult | p140-145 |
| Cities, villages, and enclaves with two community tags each | p148-166 |
| Courts of five types with two court tags each | p166-186 |
| Ruins with two ruin tags each | p187-204 |
| Wilderness sites with two wilderness tags each | p205-221 |
| Site density: one die per hex, a 1-2 means a site (d6 dense to d12 sparse; d20 is an extra option) | Hex Points of Interest, p242 |
| Factions with attributes, hit points, assets, tags, goals, and rivals | Factions, p322-335 |
| Dungeons: site type, inhabitants, rooms, exits and egresses, map features, stocking, wandering encounters | Creating Exploration Challenges, p234-247 |

### Seeds and regeneration

Every world has a master seed. The master seed makes four layer seeds: terrain, nations, sites, and factions. The same seed and settings always make the same world.

The ↻ buttons give one layer a new seed. A layer depends only on the layers above it:

- Regenerate **sites** to get new points of interest. The terrain and nations stay.
- Regenerate **factions** to get new factions. Everything else stays.
- Regenerate **nations** to redraw borders, gods, sites, and factions on the same terrain.
- Regenerate **terrain** to rebuild everything.

### Dungeon maps

Each dungeon page shows a small room map. Click **⤢ Pop out map**, or click a room on the small map, to open the map in a full-window view:

- Drag to pan. Scroll, or use **+** and **−**, to zoom. **Fit** shows the whole map.
- Click a room to read it in the side card. The map marks the room and the rooms next to it.
- Click an exit number in the side card to move to that room.
- Press **Esc** or **✕** to close the view.

The app saves the current world in the browser. Use **Save JSON** and **Load JSON** to keep worlds as files. You can rename any entity and add notes. Renames and notes are saved and exported.

### Obsidian export

**Export to Obsidian** downloads a zip. Unzip it and open the `WWN <region>` folder as a vault in Obsidian.

The vault contains:

- `<Region>.md`: the overview note with a `leaflet` map block.
- `Maps/<Region>.png` and `.svg`: the rendered hex map.
- `Locations/Cities`, `Communities`, `Courts`, `Ruins`, `Wilderness`: one note per site. Each note has `location` and `mapmarker` frontmatter, so it shows as a marker on the map.
- `Nations`, `Factions`, `Gods`, `Geography`, `Dungeons`: linked notes. Dungeon notes include an SVG map and a Mermaid diagram.
- `world.json`: the full world. Load it in the app to continue work.
- `.obsidian/plugins/obsidian-leaflet-plugin/`: the community plugin **Obsidian Leaflet**, which draws the map. `.obsidian/community-plugins.json` enables it.

When Obsidian asks if you trust the vault, select **Trust author and enable plugins**. You do not need to install the plugin yourself.

The app bundles Obsidian Leaflet (MIT license, [javalent/obsidian-leaflet](https://github.com/javalent/obsidian-leaflet)) in `public/obsidian-leaflet-plugin/`. To update it to the latest release, run `npm run plugin:leaflet`. To get a specific release, run `npm run plugin:leaflet -- 6.0.5`.

## Premium (Deluxe) content

The free edition of *Worlds Without Number* is the source of all bundled data (`src/data/free.json`). The Deluxe edition adds more GM tools. The app does not ship that content. These tools are locked until you load your own data:

- NPC generator (Random NPC Types, One-Roll Characterization Tables)
- Fractal adventure seeds, filled from each site's tags
- Architectural styles for nations
- Infernal Iterums and summoned Iterum creatures
- Adventure hooks and oracle tables

To unlock them, extract the data from **your own copy** of the Deluxe PDF:

```bash
npm run premium -- path/to/WorldsWithoutNumber_DeluxePDF.pdf
```

The command checks that the file is the Deluxe edition and writes `premium/premium.json`.

- With `npm run dev`, the app loads that file on start. Only the dev server serves it; `npm run build` never copies it into `dist/`.
- With a hosted copy of the app, click **Load premium.json** in the sidebar. The data stays in your browser.

`premium/` is in `.gitignore`. Do not commit or share the file.

Use `--out <file>` to write somewhere else.

## Project layout

```text
src/
  data/free.json      tables and tags from the free edition (generated, committed)
  data.ts             table lookup and dice rolls; premium data loading
  rng.ts              seeded random numbers
  names.ts            invented name styles ("linguistic touchstones")
  gen/                terrain, nations, sites, factions, dungeons, premium tools
  render/             SVG for the hex map and dungeon maps
  export/obsidian.ts  vault export
  main.ts             user interface
public/
  obsidian-leaflet-plugin/  Obsidian Leaflet plugin files, copied into exported vaults
tools/
  lib/                PDF text, table, and tag parsers (shared)
  manifest-free.mjs   which free-edition tables to extract
  manifest-premium.mjs which Deluxe tables to extract
  build-free-data.mjs maintainer tool: free PDF -> src/data/free.json
  premium-cli.mjs     user tool: Deluxe PDF -> premium/premium.json
  fetch-leaflet-plugin.mjs maintainer tool: GitHub release -> public/obsidian-leaflet-plugin/
test/                 Vitest tests
```

### Rebuild the free data

Maintainers only. You need the free-edition PDF from Sine Nomine or DriveThruRPG:

```bash
npm run data:free -- path/to/WorldsWithoutNumber_FreePDF.pdf
```

The tool refuses the Deluxe PDF, so Deluxe content cannot go into `src/data/free.json` by mistake. It prints a warning for each table whose rows do not cover the full die range.

### Tests

```bash
npm test
```

## Assumptions where the book gives no rule

- Small factions get one asset in their best attribute and one other. The book gives asset counts only for medium and large factions.
- A faction's starting Treasure is one turn of income.
- Each nation rolls one dark theme (1d10) and one bright theme (1d10+10).
- Site names, region names, and the name styles are invented by this app, not taken from the book.
- The d20 site density is an extra option. The book lists d6 to d12.

## Legal

*Worlds Without Number* is © 2021 Sine Nomine Publishing, Inc. This project is not affiliated with or endorsed by Sine Nomine Publishing. The repository includes only text from the free edition. Do not add PDFs or Deluxe-only content to the repository.
