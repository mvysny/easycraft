// The kinds of block, the starting hotbar and the things to find.
'use strict';

// ---------------------------------------------------------------------------
// Blocks. Order matters: ids are stored in saved worlds, so only ever append.
// ---------------------------------------------------------------------------
const BLOCKS = [null];
const B = {};
/**
 * Adds a block. `opts.shape` is 'cube' (the default), 'cross' (two crossed pictures, like a
 * flower) or 'flat' (a picture lying on the ground); only cubes are solid. Taking a block with
 * `opts.drop` (a block key) puts that block into the player's bag, and `opts.becomes` is what is
 * left in its place (air if not given) — an apple tree's leaves stay leaves when you pick the apple.
 * A liquid is see-through like water unless `opts.opaque`.
 */
function defBlock(key, name, tex, opts = {}) {
  const t = typeof tex === 'string' ? { top: tex, side: tex, bottom: tex } : tex;
  const id = BLOCKS.length;
  const shape = opts.shape ?? 'cube';
  BLOCKS.push({
    id, key, name, shape,
    top: T[t.top], side: T[t.side], bottom: T[t.bottom],
    liquid: !!opts.liquid, unbreakable: !!opts.unbreakable,
    opaque: !!opts.opaque,
    seeThrough: !!opts.seeThrough || shape !== 'cube',
    solid: !opts.liquid && shape === 'cube',
    drop: opts.drop ?? null, becomes: opts.becomes ?? null,
    pitch: opts.pitch ?? 1,
    color: tileAverageColor(T[t.side]),
  });
  B[key] = id;
}
defBlock('grass', 'Grass', { top: 'grass_top', side: 'grass_side', bottom: 'dirt' }, { pitch: 0.9 });
defBlock('dirt', 'Dirt', 'dirt', { pitch: 0.8 });
defBlock('stone', 'Stone', 'stone', { pitch: 0.7 });
defBlock('planks', 'Wood Planks', 'planks', { pitch: 1.1 });
defBlock('log', 'Tree Trunk', { top: 'log_top', side: 'log_side', bottom: 'log_top' }, { pitch: 1.0 });
defBlock('leaves', 'Leaves', 'leaves', { pitch: 1.4 });
defBlock('sand', 'Sand', 'sand', { pitch: 1.2 });
defBlock('glass', 'Glass', 'glass', { seeThrough: true, pitch: 1.8 });
defBlock('brick', 'Bricks', 'brick', { pitch: 0.85 });
defBlock('water', 'Water', 'water', { liquid: true, pitch: 1.5 });
defBlock('snow', 'Snow', 'snow', { pitch: 1.6 });
defBlock('bedrock', 'Bottom Rock', 'bedrock', { unbreakable: true });
defBlock('gold', 'Gold', 'gold', { pitch: 2.0 });
for (const [key, name, p] of [
  ['red', 'Red', 1.0], ['orange', 'Orange', 1.12], ['yellow', 'Yellow', 1.26], ['lime', 'Green', 1.33],
  ['blue', 'Blue', 1.5], ['purple', 'Purple', 1.68], ['pink', 'Pink', 1.78], ['white', 'White', 2.0],
]) defBlock(key, name, key, { pitch: p });
// Things to find. Each one is counted in the player's bag; the building blocks above are endless.
defBlock('flower_red', 'Red Flower', 'flower_red', { shape: 'cross', drop: 'flower_red', pitch: 1.6 });
defBlock('flower_yellow', 'Yellow Flower', 'flower_yellow', { shape: 'cross', drop: 'flower_yellow', pitch: 1.7 });
defBlock('shell', 'Seashell', 'shell', { shape: 'flat', drop: 'shell', pitch: 1.9 });
defBlock('apple', 'Apple', 'apple', { shape: 'cross', drop: 'apple', pitch: 1.3 });
defBlock('diamond', 'Diamond', 'diamond', { drop: 'diamond', pitch: 2.2 });
defBlock('diamond_ore', 'Diamond Ore', 'diamond_ore', { drop: 'diamond', pitch: 0.75 });
defBlock('apple_leaves', 'Apple Leaves', 'apple_leaves', { drop: 'apple', becomes: 'leaves', pitch: 1.4 });
// Minerals, drawn for the game by a young player. Each one hides in its ore, a rock that gives
// it up when taken; scatterMinerals puts the ores where the drawings say to look.
for (const [key, name, ore, oreName, p] of [
  ['coal', 'Coal', 'coal_ore', 'Coal Ore', 0.9], ['copper', 'Copper', 'copper_ore', 'Copper Ore', 1.15],
  ['iron', 'Iron', 'iron_ore', 'Iron Ore', 1.05], ['lapis', 'Lapis Lazuli', 'lapis_ore', 'Lapis Lazuli Ore', 1.7],
  ['nugget', 'Gold Nugget', 'gold_ore', 'Gold Ore', 2.0], ['redstone', 'Redstone', 'redstone_ore', 'Redstone Ore', 1.25],
  ['emerald', 'Emerald', 'emerald_ore', 'Emerald Ore', 1.9], ['ruby', 'Ruby', 'ruby_ore', 'Ruby Ore', 1.8],
  ['water_ember', 'Water Ember', 'water_ember_ore', 'Water Ember Ore', 1.6],
  ['fire_ember', 'Fire Ember', 'fire_ember_ore', 'Fire Ember Ore', 1.4],
  ['rainbow', 'Rainbow Stone', 'rainbow_ore', 'Rainbow Ore', 2.4], ['celestium', 'Celestium', 'celestium_ore', 'Celestium Ore', 2.6],
]) {
  defBlock(key, name, key, { drop: key, pitch: p });
  defBlock(ore, oreName, ore, { drop: key, pitch: 0.75 });
}
// Lava is warm and harmless: you swim in it like water (gentle for young kids).
defBlock('lava', 'Lava', 'lava', { liquid: true, opaque: true, pitch: 0.6 });
defBlock('chest', 'Treasure Chest', { top: 'chest_top', side: 'chest_side', bottom: 'chest_top' },
  { drop: 'water_ember', becomes: 'chest_open', pitch: 1.2 });
defBlock('chest_open', 'Empty Chest', { top: 'chest_open_top', side: 'chest_side', bottom: 'chest_top' }, { pitch: 1.2 });

/** The building blocks a new player's hotbar starts with; you can always build with these. */
const HOTBAR = [
  'grass', 'dirt', 'stone', 'planks', 'log', 'leaves', 'sand', 'glass', 'brick', 'water',
  'snow', 'gold', 'red', 'orange', 'yellow', 'lime', 'blue', 'purple', 'pink', 'white',
].map(k => B[k]);
/** The things you find, in bag order, with where to look for them and, for a mineral, how rare it is. */
const FINDS = [
  ['flower_red', 'Look in the grass!'], ['flower_yellow', 'Look in the grass!'],
  ['shell', 'Look on the beach!'], ['apple', 'Look in the trees!'],
  ['coal', 'Dig anywhere!', 'common'], ['copper', 'Dig anywhere!', 'common'],
  ['iron', 'Dig into the stone!', 'common'], ['lapis', 'Dig deep into the stone!', 'rare'],
  ['nugget', 'Look in the caves and the desert!', 'rare'], ['redstone', 'Look in the caves!', 'rare'],
  ['emerald', 'Look on the mountain tops!', 'rare'],
  ['diamond', 'Look deep in the caves!', 'very rare'], ['ruby', 'Look deep in the caves!', 'very rare'],
  ['water_ember', 'Look for treasure chests in the sea!', 'very rare'],
  ['fire_ember', 'Look next to the lava, deep in the caves!', 'very rare'],
  ['rainbow', 'Look deep in the caves!', 'very rare'],
  ['celestium', 'Look at the very bottom of the caves!', 'extremely rare'],
].map(([k, hint, rarity]) => ({ id: B[k], hint, rarity }));
const isFind = id => FINDS.some(f => f.id === id);
/** Everything the bag screen shows: the building blocks, then the finds. */
const BAG_ITEMS = [...HOTBAR, ...FINDS.map(f => f.id)];

const isSolid = id => id !== 0 && BLOCKS[id].solid;
const isOccluder = id => id !== 0 && !BLOCKS[id].liquid && !BLOCKS[id].seeThrough;
const isLeaves = id => id === B.leaves || id === B.apple_leaves;
