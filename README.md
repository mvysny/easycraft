# EasyCraft

EasyCraft is a block-building game for young kids that runs in a web browser: walk around a
small island, take blocks away and build with twenty kinds of block, and find flowers, shells,
apples and thirteen minerals, in caves, a desert and sunken ruins, to keep in your bag. There
are no monsters, no damage and nothing to install — double-click `index.html` and play.

## Playing

**Play it online: https://mvysny.github.io/easycraft/**

Or open `index.html` in a browser (Chrome, Firefox, Edge or Safari); no internet is needed. Click
**Play!**, then:

| | Keyboard | Controller |
|---|---|---|
| Look around | mouse, ← → | right stick |
| Walk | W A S D, ↑ ↓ | left stick |
| Jump, swim up | Space | A |
| Take a block away | left click | RT |
| Put a block down | right click | LT |
| Pick a block | 1–0, mouse wheel | LB / RB |
| Open / close the bag | E | X |
| Fly on/off | F | Y |
| Fly down | Shift | B |
| Go back home | H | Back |
| Menu | Esc | Start |

Walking into a one-block step hops up it. The world saves itself in the browser; **New world** in
the menu starts over.

## Things to find

The island hides red and yellow flowers in the grass, seashells on the beach and apples in the
trees. Take one and it goes into your bag; picking an apple leaves the tree's leaves where they
were. The building blocks never run out, but finds do: each one you put down uses one up.

Thirteen minerals, drawn for the game by a young player, hide in ore rocks — take an ore and
its mineral goes into your bag:

| Mineral | How rare | Where to look |
|---|---|---|
| Coal, Copper | common | anywhere in the stone, and a few on the grass |
| Iron | common | in the stone |
| Lapis Lazuli | rare | deep in the stone |
| Gold Nugget | rare | in the caves, and in and under the desert |
| Redstone | rare | in the caves |
| Emerald | rare | on the mountain tops |
| Diamond, Ruby, Rainbow Stone | very rare | deep in the caves |
| Fire Ember | very rare | next to the lava pools, deep in the caves |
| Water Ember | very rare | in the treasure chests of the sunken houses in the sea |
| Celestium | extremely rare | at the very bottom of the caves |

The caves start as holes in the hillsides and wind down to the deep stone. Their lava is warm
and harmless: you can swim in it. A world saved before the minerals existed gets their ores in
its stone, but the caves, desert, lava and sunken houses only come with **New world**.

The bag (**E**, or **X** on a controller) shows every block and every find, with how many you
have; finds you haven't found yet show a hint about where to look. Move with the arrow keys or
the stick and press **Space** / **A** to put the item into the hotbar slot you have picked.
Everyone has their own bag and hotbar, and both are saved.

## Playing together

Up to four players share one screen, split into a view each. One player can use the keyboard and
mouse; everyone else plugs a controller in with USB (Xbox-style and PlayStation pads work, as
anything the browser sees as a standard gamepad does).

In the menu, press **A** (✕ on PlayStation) on a controller to join, **B** to leave, and **Start**
to play. **👥 Players** shows who is in and lets the keyboard player join or leave. Each player
has a colour and a name tag that shows through walls, so friends can find each other.

## Copying it

The game is `index.html` plus the `vendor/` folder beside it; copy both. three.js (MIT, its
licence in `vendor/three/LICENSE`) is the only third-party code.

## See also

- [Simplecraft](https://vesanieminen.github.io/Simplecraft/) — a similar block-building game
  that runs in the browser.
