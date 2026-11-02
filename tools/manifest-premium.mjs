// Tables from the DELUXE edition of Worlds Without Number (2021) that the app can use.
// These are NOT shipped with the repository. Users extract them from their own PDF
// with `npm run premium -- path/to/Deluxe.pdf`.

const t = (id, page, title, opts = {}) => ({ id, page, title, ...opts });

export const premiumTables = [
  // Infernal Iterum tools (p371)
  t('iterum.infernal.wants', 371, 'What Do They Want'),
  t('iterum.infernal.how', 371, 'How Do They Make It Happen'),
  t('iterum.infernal.structure', 371, "What's the Structure"),
  t('iterum.infernal.why', 371, 'Why Do They Want It'),
  t('iterum.infernal.hellish', 371, "What's Hellish"),
  // Summoned Iterum creatures (p373)
  t('iterum.summoned.start', 373, 'How Did They Start'),
  t('iterum.summoned.goodFor', 373, 'What Are They Mostly Good For'),
  t('iterum.summoned.role', 373, 'What Is Their Function'),
  t('iterum.summoned.summoners', 373, 'Who Are Their Most Famous'),
  t('iterum.summoned.gain', 373, 'What Do They Get Out'),
  // Adventure hooks (p376) and oracular adjustments (p377)
  t('hooks.bait', 376, 'Bait for Adventure Hooks'),
  t('hooks.intro', 376, 'Ways of Introducing'),
  t('oracle.mistake', 377, 'This Mistake'),
  t('oracle.theme', 377, 'This Theme'),
  t('oracle.reality', 377, 'This Reality'),
  t('oracle.affirm', 377, 'Idea Affirmation'),
  t('oracle.npc', 377, 'How Do I Change'),
  t('oracle.event', 377, 'Throw This Event'),
  // Architecture (p378-379)
  t('arch.adjectives', 378, 'Architectural Adjectives'),
  t('arch.materials', 378, 'Favorite Materials'),
  t('arch.colors', 378, 'Favorite Color Schemes'),
  t('arch.motifs', 379, 'Common Visual Motifs'),
  t('arch.adornment', 379, 'Structure Adornment'),
  t('arch.features', 379, 'Favorite Structural Features'),
  t('arch.patterns', 379, 'Settlement Design Patterns'),
  // Random NPCs (p384-385)
  t('npc.underclass', 384, 'Underclass', { full: true, col: 0, label: 'Underclass' }),
  t('npc.commoners', 384, 'Underclass', { full: true, col: 1, label: 'Commoners' }),
  t('npc.gentry', 384, 'Underclass', { full: true, col: 2, label: 'Gentry' }),
  t('npc.twists', 384, 'NPC Characteristic Twists'),
  t('npc.criminals', 385, 'Specific Criminals'),
  t('npc.nobility', 385, 'Specific Nobility'),
  t('npc.villagers', 385, 'Specific Villagers'),
  t('npc.merchants', 385, 'Specific Merchants'),
  t('npc.tribals', 385, 'Specific Tribals'),
  t('npc.warriors', 385, 'Specific Warriors'),
  // One-roll characterization (p387-391)
  t('npc.look.move', 387, 'The Way They Move'),
  t('npc.look.clothing', 387, 'Clothing'),
  t('npc.look.first', 387, 'The First Thing'),
  t('npc.look.build', 387, 'General Physical Build'),
  t('npc.look.differ', 387, 'One Way They Differ'),
  t('npc.look.mannerisms', 387, 'Visible Mannerisms'),
  t('npc.ambition.who', 388, 'Who Knows'),
  t('npc.ambition.tools', 388, 'What Tools'),
  t('npc.ambition.form', 388, "What's the Basic Ambition"),
  t('npc.ambition.when', 388, 'When Was the Ambition'),
  t('npc.ambition.obstacle', 388, "What's the Biggest"),
  t('npc.ambition.things', 388, 'Things to Help'),
  t('npc.friendship.met', 389, 'How Did They Meet'),
  t('npc.friendship.done', 389, 'What Have They Done'),
  t('npc.friendship.tie', 389, 'What Tie'),
  t('npc.friendship.age', 389, 'How Old is the Relationship'),
  t('npc.friendship.threat', 389, 'What Threatens'),
  t('npc.friendship.things', 389, 'Things Between Friends'),
  t('npc.tragedy.responsibility', 390, 'What Was Their Responsibility'),
  t('npc.tragedy.coping', 390, 'How Did They Try'),
  t('npc.tragedy.form', 390, 'What Was Its Basic Form'),
  t('npc.tragedy.when', 390, 'When Did It Happen'),
  t('npc.tragedy.consequences', 390, 'What Ugly Consequences'),
  t('npc.tragedy.scars', 390, 'What Scars'),
  t('npc.romance.met', 391, 'How Did They Meet'),
  t('npc.romance.spark', 391, 'What Sparked'),
  t('npc.romance.problem', 391, 'What Problem'),
  t('npc.romance.length', 391, 'Past Length'),
  t('npc.romance.issue', 391, "What's the Current Issue"),
  t('npc.romance.quirks', 391, 'Quirks or Traits'),
];

// Fractal adventure seeds, p380-383: 1-20 Enemy, 21-40 Friend, 41-60 Complication, 61-80 Thing, 81-100 Place.
export const premiumSeeds = { from: 380, to: 383 };
