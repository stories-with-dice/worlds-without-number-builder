# WWN World Builder

A hex-map world builder for *Worlds Without Number*, in the style of *Sectors Without Number*. It generates a region with terrain, nations, cities, ruins, courts, wilderness sites, gods, and factions. It also generates dungeons with the book's exploration-site procedure, and exports everything as an Obsidian vault with an interactive map.

All generation follows the procedures and random tables in *Worlds Without Number* (Kevin Crawford, Sine Nomine Publishing, 2021). Page numbers in the app refer to that book. This is an unofficial fan tool.

## Quick start

Requirements: Node.js 20 or later. For a step-by-step setup on Windows or Mac, see [docs/premium-setup.md](docs/premium-setup.md).

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
| Adventures: combat, investigation, and social challenges, with optional prompts from a site, faction, or nation | Creating Combat, Investigation, and Social Challenges, p230-233, p248-253 |
| Treasure for an adventure: silver piece value of the site, magic items, jewelry, and valuables | Placing Treasures, p256-257 |
| Premium only: fractal adventure seeds and oracular adventure adjustments in an adventure | Deluxe edition, Additional GM Tools, p376-383 |

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

### Adventures

The **Adventures** tab builds an adventure from the challenge tables in "Creating Adventures":

- **Combat challenge** (p230-233): a target, what is going on now, a problem, a twist, and a complication for an urban dwelling, wilderness lair, or Deep chamber. A bestial monster target uses "What's That Bestial Monster Doing?" instead.
- **Investigation challenge** (p248-251): the hook, the introduction, three investigation scenes with a complication each, the culprit's reaction, the failsafe cost, and a resolution twist.
- **Social challenge** (p252-253): the one-roll social challenge target.
- **Treasure** (p256-257): the total silver piece value (pick a site line, roll 2d6 for the column), magic items by owner type, and three valuables with a reason each is special.

With premium (Deluxe) data loaded, two more sections are available. Without it, they show a 🔒 and the app skips them:

- **Fractal adventure seed** (Deluxe p380-383): the anchor site's tags give one Enemy, Friend, Complication, Thing, and Place. A d100 roll gives the premise seed. Each **Fractal steps** step takes a component of the latest seed and rolls a d20 seed of that kind to complicate it. With no anchor, two random tags of one kind give the components.
- **Oracular adventure adjustments** (Deluxe p376-377): the hook bait and how it is introduced, a theme, a mistake, a reality that intrudes, a change to a key NPC, an event, and an affirmation or negation of your main idea.

Pick an anchor (a site, faction, or nation) to set the defaults and add prompts. A faction uses its Base of Influence and a nation uses its capital. The prompts are problems from the site, one element of each kind from its two tags, and a faction's goal or a nation's current problems. Each site page, faction page, and nation page also has a **Create adventure here** button.

Click ↻ next to a line to roll that table or seed again. Adventures are saved with the world and exported to `Adventures/` in the Obsidian vault. Regenerating a layer deletes the adventures whose anchor no longer exists.

The app saves the current world in the browser. Use **Save JSON** and **Load JSON** to keep worlds as files. You can rename any entity and add notes. Renames and notes are saved and exported.

### Obsidian export

**Export to Obsidian** downloads a zip. Unzip it and open the `WWN <region>` folder as a vault in Obsidian.

The vault contains:

- `<Region>.md`: the overview note with a `leaflet` map block.
- `Maps/<Region>.png` and `.svg`: the rendered hex map.
- `Locations/Cities`, `Communities`, `Courts`, `Ruins`, `Wilderness`: one note per site. Each note has `location` and `mapmarker` frontmatter, so it shows as a marker on the map.
- `Nations`, `Factions`, `Gods`, `Geography`, `Dungeons`, `Adventures`: linked notes. Dungeon notes include an SVG map and a Mermaid diagram.
- `world.json`: the full world. Load it in the app to continue work.
- `.obsidian/plugins/obsidian-leaflet-plugin/`: the community plugin **Obsidian Leaflet**, which draws the map. `.obsidian/community-plugins.json` enables it.

When Obsidian asks if you trust the vault, select **Trust author and enable plugins**. You do not need to install the plugin yourself.

The app bundles Obsidian Leaflet (MIT license, [javalent/obsidian-leaflet](https://github.com/javalent/obsidian-leaflet)) in `public/obsidian-leaflet-plugin/`. To update it to the latest release, run `npm run plugin:leaflet`. To get a specific release, run `npm run plugin:leaflet -- 6.0.5`.

## Premium (Deluxe) content

The free edition of *Worlds Without Number* is the source of all bundled data (`src/data/free.json`). The Deluxe edition adds more GM tools. The app does not ship that content. These tools are locked until you load your own data:

- NPC generator (Random NPC Types, One-Roll Characterization Tables)
- Fractal adventure seeds, filled from each site's tags, and as a section in the Adventures tab
- Oracular adventure adjustments, as a section in the Adventures tab
- Architectural styles for nations
- Infernal Iterums and summoned Iterum creatures
- Adventure hooks and oracle tables

New to the command line? Read the [step-by-step guide for Windows and Mac](docs/premium-setup.md). It shows how to download the app, install Node.js, and make the premium data file.

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
  gen/                terrain, nations, sites, factions, dungeons, adventures, premium tools
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
- An adventure's default treasure site line and magic item owner line come from its anchor site (for example, a business court uses "Merchant prince's estate"). The book says to pick the most appropriate line.
- "Three or More" magic items gives three items. Add more if it fits.
- A combat target in a wilderness lair or Deep chamber is a bestial monster 40% of the time, unless you pick one.
- An adventure's fractal seed uses the same tag components that its prompts show. Each fractal step complicates a component of the latest seed. The book lets you complicate any component of any seed.
- The site page's **Fractal adventure seed** button adds one complication step 60% of the time.

## Legal

*Worlds Without Number* is © 2021 Sine Nomine Publishing, Inc. This project is not affiliated with or endorsed by Sine Nomine Publishing. The repository includes only text from the free edition. Do not add PDFs or Deluxe-only content to the repository.
