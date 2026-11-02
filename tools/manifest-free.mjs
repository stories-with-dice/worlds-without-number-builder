// Tables from the FREE edition of Worlds Without Number (2021) that the app uses.
// Page numbers are book pages (the printed number), not PDF pages.

const t = (id, page, title, opts = {}) => ({ id, page, title, ...opts });

// Village, city, and enclave pages share one layout.
function community(prefix, page, extra) {
  return [
    t(`${prefix}.ruler`, page, 'Who Runs It', { full: true, col: 0 }),
    t(`${prefix}.notables`, page, 'Who Runs It', { full: true, col: 1 }),
    t(`${prefix}.problem`, page, 'Who Runs It', { full: true, col: 2 }),
    t(`${prefix}.contact`, page, 'Local Likely', { full: true, col: 0 }),
    t(`${prefix}.offer`, page, 'Local Likely', { full: true, col: 1 }),
    t(`${prefix}.${extra[0]}`, page, extra[1]),
  ];
}

// The five court types share one layout plus one special table each.
function court(type, page, special) {
  return [
    t(`court.${type}.major`, page, 'Major Figure', { full: true, col: 0 }),
    t(`court.${type}.minor`, page, 'Major Figure', { full: true, col: 1 }),
    t(`court.${type}.power`, page, 'Major Figure', { full: true, col: 2 }),
    t(`court.${type}.internal`, page, 'Internal Conflicts', { full: true, col: 0 }),
    t(`court.${type}.external`, page, 'Internal Conflicts', { full: true, col: 1 }),
    t(`court.${type}.${special[0]}`, page, special[1]),
  ];
}

export const freeTables = [
  // Geography (p120-123)
  t('geo.terrain', 121, 'Significant Terrain Features'),
  t('geo.feature.danger', 123, 'How Dangerous'),
  t('geo.feature.use', 123, 'What Use'),
  t('geo.feature.event', 123, 'What Kind of Event'),
  t('geo.feature.population', 123, 'How Populated'),
  t('geo.feature.antagonists', 123, 'What Antagonists'),
  t('geo.feature.quirk', 123, 'Optional Quirk'),
  // Nations (p124-127)
  t('nation.disputes', 125, 'Disputes'),
  t('nation.problems', 125, 'Current National Problems'),
  t('nation.ties', 125, 'Positive Ties'),
  t('nation.goodThings', 125, 'Good Things'),
  t('nation.themes', 126, 'Thematic Element'),
  // Society (p128-131)
  t('society.skin', 129, 'Typical Skin'),
  t('society.hairColor', 129, 'Hair Color', { col: 0, label: 'Hair Color' }),
  t('society.hairTexture', 129, 'Hair Color', { col: 1, label: 'Hair Texture' }),
  t('society.eyes', 129, 'Eye'),
  t('society.build', 129, "What's the Typical Build"),
  t('society.adornment', 129, 'Optional Common Forms'),
  t('society.quirks', 129, 'Optional Physical Quirks'),
  t('society.values', 130, 'Values', { full: true, sideBySide: true }),
  t('society.identity', 131, 'Major Unit'),
  t('society.templates', 131, 'Example Template'),
  // Government (p132-135)
  t('gov.numRulers', 133, 'Number of Rulers'),
  t('gov.rulingClass', 133, 'Example Ruling Classes'),
  t('gov.legitimacy', 133, 'Sources of Legitimacy'),
  t('gov.institutions', 133, 'Institutions'),
  t('gov.singleRulers', 134, 'Single Rulers'),
  t('gov.multipleRulers', 134, 'Multiple Rulers'),
  t('gov.struggle', 134, 'Current Struggle'),
  t('gov.established', 135, 'How Established'),
  t('gov.ministers', 135, 'What Problems do their Ministers'),
  t('gov.strength', 135, 'A Strength'),
  t('gov.stability', 135, 'How Stable'),
  t('gov.officials', 135, 'Officials Recently'),
  t('gov.event', 135, 'Recent Governmental Event'),
  // History (p136-139)
  t('history.origin', 136, 'How Did They Originate'),
  t('history.originalInhabitants', 136, 'What Became of the Original'),
  t('history.crises', 136, 'Historical Crises'),
  t('history.overcome', 136, 'How Did They Overcome'),
  t('history.peak', 137, 'What Was Great'),
  t('history.failure', 137, 'Why Did It Fail'),
  t('history.survivors', 137, 'What Became of the Unabsorbed'),
  t('history.events', 139, 'Historical Event', { full: true, sideBySide: true }),
  // Religion (p140-145)
  t('religion.structure', 140, 'Church Structures'),
  t('religion.godOrigin', 140, 'Where Did The God'),
  t('religion.why', 140, 'Why Does The Faith'),
  t('religion.wants', 141, 'What Does The Faith Want'),
  t('religion.society', 141, 'What Does This God Do'),
  t('religion.humanConcern', 142, 'Human Concern', { col: 0, label: 'Human Concern' }),
  t('religion.naturalPrinciple', 142, 'Human Concern', { col: 1, label: 'Natural Principle' }),
  t('religion.requirements', 142, 'Particular Religious'),
  t('temple.opinion', 143, 'What Do The Locals'),
  t('temple.leader', 143, 'Who Is In Charge'),
  t('temple.help', 143, 'What Particular Help'),
  t('temple.size', 143, 'How Big'),
  t('temple.problems', 143, 'What Problems'),
  t('temple.quirks', 143, 'Particular Quirks'),
  t('cult.rewards', 144, 'Rewards'),
  t('cult.goal', 145, 'What General Goal'),
  t('cult.horror', 145, "What's So Horrible"),
  t('cult.enforce', 145, 'How Do the Clergy'),
  t('cult.unity', 145, 'How Unified'),
  t('cult.problems', 145, 'What Problems'),
  t('cult.traits', 145, 'Specific Traits'),
  t('places.latterEarth', 146, 'Places Specific'),
  t('places.general', 146, 'General Places'),
  // Communities (p148-151)
  ...community('village', 149, ['rationale', 'Rationale']),
  ...community('city', 150, ['rationale', 'Rationale']),
  ...community('enclave', 151, ['reason', 'Why Are They Staying']),
  // Courts (p166-171)
  ...court('aristocratic', 167, ['theme', 'Main Theme']),
  ...court('business', 168, ['market', 'Relations With Their Market']),
  ...court('criminal', 169, ['crime', 'Their Primary Mode']),
  ...court('clan', 170, ['neighbors', 'Relations With Their Neighbors']),
  ...court('religious', 171, ['faith', 'Their Relations With the Larger Faith']),
  // Ruins (p187-189)
  t('ruin.age', 187, 'How Old'),
  t('ruin.kind', 187, 'What Basic Kind'),
  t('ruin.locals', 187, 'What Do The Locals'),
  t('ruin.cause', 187, 'How Did It Become'),
  t('ruin.unplundered', 187, "Why Hasn't"),
  t('ruin.users', 187, "Who's Used"),
  t('ruin.deeps', 188, 'Major Types of Deeps'),
  t('ruin.culture.brass', 188, 'Characteristic Ruins', { nth: 0, label: 'Ruins of the Brass Hegemony' }),
  t('ruin.culture.jikegida', 188, 'Characteristic Ruins', { nth: 1, label: 'Ruins of the Jikegida' }),
  t('ruin.culture.shun', 189, 'Characteristic Ruins', { nth: 0, label: 'Ruins of the Rule of Shun' }),
  t('ruin.culture.vothiteEmpire', 189, 'Characteristic Ruins', { nth: 1, label: 'Ruins of the Vothite Empire' }),
  t('ruin.culture.vothiteRepublic', 189, 'Characteristic Ruins', { nth: 2, label: 'Ruins of the Vothite Republic' }),
  // Wilderness (p205)
  t('wild.human', 205, 'Human Encounters'),
  t('wild.nonhuman', 205, 'Nonhuman'),
  t('wild.beasts', 205, 'Beasts and Monsters'),
  t('wild.sapientsDoing', 205, "What's Happening with the Sapients"),
  t('wild.beastsDoing', 205, "What's Happening with the Beasts"),
  // Lairs (p232-233)
  t('lair.now', 232, "What's Going On"),
  t('lair.problems', 232, 'What Problems'),
  t('lair.twists', 232, 'Twists About'),
  t('lair.beast', 233, "What's That Bestial"),
  t('lair.urban', 233, 'Urban Dwelling'),
  t('lair.wild', 233, 'Wilderness Lair'),
  t('lair.deep', 233, 'Deep Chamber'),
  // Exploration sites / dungeons (p238-247)
  t('dungeon.inhabitants', 239, 'Important Inhabitants'),
  t('dungeon.hostility', 239, 'Potential Reasons'),
  t('dungeon.came', 239, 'Why Did They Come'),
  t('dungeon.alliances', 239, 'Possible Causes'),
  t('dungeon.staying', 239, 'Why Are They Staying'),
  t('dungeon.inhabitantTypes.ancient', 240, 'Ancient Sorcerer'),
  t('dungeon.inhabitantTypes.arratu', 240, 'Alien Arratu'),
  t('dungeon.inhabitantTypes.deep', 240, 'Subterranean Deep'),
  t('dungeon.inhabitantTypes.modern', 240, 'Modern Ruin'),
  t('dungeon.inhabitantTypes.wilderness', 240, 'Trackless'),
  t('hex.community', 242, 'Example Community'),
  t('hex.court', 242, 'Example Court'),
  t('hex.wilderness', 242, 'Example Wilderness'),
  t('dungeon.hazards', 245, 'Example Types of Hazards'),
  t('dungeon.distractors', 245, 'Example Distractors'),
  t('dungeon.enigmas', 245, 'Example Enigmas'),
  t('dungeon.treasureLocations', 245, 'Possible Treasure'),
  t('dungeon.encounterTemplate', 247, 'An Encounter Table'),
  t('dungeon.trying', 247, 'What Are They Trying'),
  t('dungeon.mood', 247, 'What Mood'),
  t('events.wilderness', 247, 'Example Wilderness Events'),
  t('events.dungeon', 247, 'Example Dungeon Events'),
  // Treasure (p257)
  t('treasure.jewelry', 257, 'Types of Jewelry'),
  t('treasure.valuables', 257, 'Valuable Objects'),
  t('treasure.whyValuable', 257, 'Why is the Object'),
  // Monsters (p284-293)
  t('monster.blightIntent', 284, 'What Was the Creator'),
  t('monster.blightQualities', 284, 'Example Blighted'),
  t('monster.hunt', 285, 'How Does It Usually Hunt'),
  t('monster.animal', 285, 'What Kind of Animal'),
  t('monster.bodyPlan', 285, 'What Is Its Basic Body Plan'),
  t('monster.whyAlive', 285, "Why Isn't It Dead"),
  t('monster.drives', 287, 'Monstrous Drives'),
  t('monster.arise', 293, 'How Did the Monster Arise'),
  t('monster.past', 293, 'What Is Its Connection'),
  t('monster.contact', 293, 'How Much Local Contact'),
  t('monster.reaction', 293, 'How Do the Locals React'),
  t('monster.scars', 293, 'What Scars'),
  t('monster.twist', 293, 'A Twist To Its Activities'),
  // Background actors (p334-335)
  t('actors.events', 334, 'General Actor Activities'),
  t('actors.party', 335, 'Adventuring Parties'),
  t('actors.nobles', 335, 'Nobles and Gentry'),
  t('actors.merchants', 335, 'Merchants and Oligarchs'),
  t('actors.zealots', 335, 'Demagogues'),
  t('actors.warlords', 335, 'Warlords'),
  t('actors.sorcerers', 335, 'Sorcerers'),
];

export const freeMatrices = [
  { page: 238, id: 'dungeon.siteTypes', title: 'Types of Ruin Sites' },
  { page: 241, id: 'dungeon.rooms', title: 'Rooms of Interest', groupMaxX: 120 },
];

export const freeTags = [
  { kind: 'community', from: 153, to: 166 },
  { kind: 'court', from: 173, to: 186 },
  { kind: 'ruin', from: 191, to: 204 },
  { kind: 'wilderness', from: 207, to: 221 },
];
