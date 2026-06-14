import type { GameState } from "./types";
import type { Scene, Choice } from "./scene";
import { RACES, CLASSES } from "./content";

const scale = (s: GameState) => Math.max(0, s.character.level - 1);

// Small helper to build a "travel" choice.
function go(id: string, label: string, target: string, hint?: string): Choice {
  return { id, label, hint, run: (ctx) => ctx.goto(target) };
}

const SCENE_LIST: Scene[] = [
  // ────────────────────────────── PROLOGUE ──────────────────────────────
  {
    id: "intro",
    title: "The Edge of the World",
    region: "The Sundering",
    aiEmbellish: true,
    text: (s) => {
      const race = RACES[s.character.race].name.toLowerCase();
      const klass = CLASSES[s.character.klass].name.toLowerCase();
      return [
        `You wake on cold ground beneath a sky split like cracked glass. Threads of pale light bleed between the fractures — the wound the Sundering left when the world broke apart.`,
        `You are ${s.character.name}, a ${race} ${klass}, and you remember almost nothing but a single certain thing: you are meant to be here.`,
        `A thin trail of smoke rises from a hollow in the hills. Someone keeps a fire nearby.`,
      ];
    },
    choices: () => [
      go("c_fire", "Follow the smoke", "oracle"),
      {
        id: "c_look",
        label: "Search your surroundings first",
        run: (ctx) => {
          const r = ctx.check("wis", 12);
          if (r.success) {
            ctx.say(`Perception ${r.total} vs 12 — success.`);
            ctx.log("Half-buried in the ash you find a pouch of coin and a healing draught left by some earlier traveler who did not make it.");
            ctx.gold(15);
            ctx.give("potion_minor", 1);
          } else {
            ctx.say(`Perception ${r.total} vs 12 — nothing but ash and broken stone.`);
          }
          ctx.goto("oracle");
        },
      },
    ],
  },
  {
    id: "oracle",
    title: "The Last Oracle",
    region: "The Sundering",
    aiEmbellish: true,
    text: () => [
      `In the hollow sits an old woman wrapped in grey, feeding a fire that gives more light than heat. She does not seem surprised to see you.`,
      `"Another one woken by the cracks," she says. "Good. The realm is dying, child. When the Sundered King shattered the world, the Heart of Aethyr broke into shards and scattered. Three remain within reach: in the Hollow Wood, the Ashen Wastes, and the drowned Sunken Keep."`,
      `"Gather all three and you may stand before the King himself — and choose whether to mend this world, or take it for your own."`,
    ],
    choices: () => [
      go("c_road", "Set out for the Crossroads", "crossroads"),
      {
        id: "c_ask",
        label: "Ask the Oracle what awaits you",
        run: (ctx) => {
          ctx.log(`"Pain, mostly," she says, almost kindly. "But also Hearthford, a village still clinging to the road. Its merchant and its inn may keep you alive. Spend your coin well." She presses a warm trinket into your palm.`);
          if (!ctx.has("lumen_charm")) ctx.give("lumen_charm", 1);
          ctx.setFlag("oracle_gift", true);
        },
      },
    ],
  },

  // ────────────────────────────── HUB ──────────────────────────────
  {
    id: "crossroads",
    title: "The Crossroads",
    region: "Heartlands",
    aiEmbellish: true,
    text: (s) => {
      const shards = s.character.shards;
      const lines = [
        `Four broken roads meet beneath a leaning signpost. The air hums faintly, the way the world does now near places where the Heart once was.`,
      ];
      if (shards === 0) lines.push(`You carry no Shards yet. The signpost points toward the Hollow Wood, the Ashen Wastes, and the Sunken Keep.`);
      else if (shards < 3) lines.push(`You carry ${shards} Shard${shards > 1 ? "s" : ""} of Aethyr. They pull gently toward the others, and toward something darker to the north.`);
      else lines.push(`Three Shards burn in your pack. To the north, the sky tears open above the Sundered Throne. It is time.`);
      return lines;
    },
    choices: (s) => {
      const cs: Choice[] = [
        go("c_town", "Visit Hearthford village", "hearthford"),
        s.flags.shard_wood ? go("c_wood2", "Return to the Hollow Wood", "wood_entrance") : go("c_wood", "Travel to the Hollow Wood", "wood_entrance"),
        s.flags.shard_wastes ? go("c_waste2", "Return to the Ashen Wastes", "wastes_entrance") : go("c_waste", "Travel to the Ashen Wastes", "wastes_entrance"),
        s.flags.shard_keep ? go("c_keep2", "Return to the Sunken Keep", "keep_entrance") : go("c_keep", "Travel to the Sunken Keep", "keep_entrance"),
      ];
      if (s.character.shards >= 3) {
        cs.push({
          id: "c_throne",
          label: "⚜ March north to the Sundered Throne",
          hint: "The final confrontation",
          run: (ctx) => ctx.goto("throne_approach"),
        });
      }
      return cs;
    },
  },

  // ────────────────────────────── VILLAGE ──────────────────────────────
  {
    id: "hearthford",
    title: "Hearthford",
    region: "Heartlands",
    text: () => [
      `Hearthford endures: a huddle of timber houses behind a palisade, lanterns lit against the fractured dark. A merchant's stall and a low-roofed inn face the muddy square.`,
    ],
    choices: () => [
      go("c_shop", "Visit the merchant", "shop"),
      go("c_inn", "Rest at the Cracked Tankard inn", "inn"),
      {
        id: "c_rumors",
        label: "Listen for rumors in the square",
        run: (ctx) => {
          const r = ctx.check("cha", 11);
          if (r.success) {
            ctx.log(`A drunk leans close: "The Wardens guarding the Shards can be staggered — hit hard and fast, don't trade blows." You feel readier for what's coming.`);
            ctx.xp(20);
          } else {
            ctx.log(`The villagers eye you warily and say nothing useful.`);
          }
        },
      },
      go("c_back", "Return to the Crossroads", "crossroads"),
    ],
  },
  {
    id: "shop",
    title: "The Merchant",
    region: "Heartlands",
    text: (s) => [
      `A sharp-eyed trader spreads wares across a battered counter. "Coin first, questions never," she says. You have ${s.character.gold} gold.`,
    ],
    choices: () => {
      const buy = (id: string, itemId: string, cost: number, label: string): Choice => ({
        id,
        label: `Buy ${label} — ${cost}g`,
        enabled: (s) => s.character.gold >= cost,
        run: (ctx) => {
          if (ctx.state.character.gold < cost) return;
          ctx.gold(-cost);
          ctx.give(itemId, 1);
          ctx.say(`You purchase ${label}.`);
        },
      });
      return [
        buy("b_pot", "potion_minor", 12, "a Minor Healing Draught"),
        buy("b_pot2", "potion_greater", 30, "a Greater Healing Draught"),
        buy("b_mana", "potion_mana", 15, "a Vial of Weave"),
        buy("b_chain", "chainmail", 35, "Chainmail (armor)"),
        buy("b_plate", "plate_armor", 90, "Riven Plate (armor)"),
        buy("b_charm", "lumen_charm", 40, "a Lumen Charm"),
        go("c_back", "Stop shopping", "hearthford"),
      ];
    },
  },
  {
    id: "inn",
    title: "The Cracked Tankard",
    region: "Heartlands",
    text: (s) => [
      `Warmth, woodsmoke, and the murmur of folk who have decided to live another night. A room costs 10 gold. You have ${s.character.gold}.`,
    ],
    choices: () => [
      {
        id: "c_rest",
        label: "Take a room and rest (10g) — full HP & Weave",
        enabled: (s) => s.character.gold >= 10 && (s.character.hp < s.character.maxHp || s.character.mp < s.character.maxMp),
        run: (ctx) => {
          ctx.gold(-10);
          ctx.heal(9999);
          ctx.restoreMp(9999);
          ctx.log(`You sleep without dreams for the first time since you woke. You rise restored.`);
        },
      },
      {
        id: "c_meal",
        label: "Buy a hot meal (3g) — restore some HP",
        enabled: (s) => s.character.gold >= 3,
        run: (ctx) => {
          ctx.gold(-3);
          ctx.heal(10);
          ctx.say(`The stew is mostly turnip, but it helps. (+10 HP)`);
        },
      },
      go("c_back", "Leave the inn", "hearthford"),
    ],
  },

  // ────────────────────────────── HOLLOW WOOD ──────────────────────────────
  {
    id: "wood_entrance",
    title: "The Hollow Wood",
    region: "Hollow Wood",
    aiEmbellish: true,
    text: (s) =>
      s.flags.shard_wood
        ? [`The Hollow Wood is quiet now, its shrine dark and emptied. You have already claimed what you came for here.`]
        : [
            `Trees rise like grey ribs, their leaves long fallen. Something watched you the moment you crossed the treeline — and now it pads closer through the undergrowth.`,
          ],
    choices: (s) =>
      s.flags.shard_wood
        ? [go("c_back", "Return to the Crossroads", "crossroads")]
        : [
            {
              id: "c_press",
              label: "Press deeper toward the old shrine",
              run: (ctx) => {
                ctx.combat(["wolf"], { onWin: "wood_shrine", scale: scale(ctx.state), intro: "A Shadowmane Wolf bursts from the brush!" });
              },
            },
            {
              id: "c_sneak",
              label: "Try to slip past the watchers (Stealth)",
              run: (ctx) => {
                const r = ctx.check("dex", 14);
                if (r.success) {
                  ctx.say(`Stealth ${r.total} vs 14 — success.`);
                  ctx.log(`You move like smoke between the trees and reach the shrine unseen.`);
                  ctx.goto("wood_shrine");
                } else {
                  ctx.say(`Stealth ${r.total} vs 14 — a twig cracks underfoot.`);
                  ctx.combat(["wolf"], { onWin: "wood_shrine", scale: scale(ctx.state), intro: "A wolf lunges from the dark!" });
                }
              },
            },
            go("c_leave", "Leave the wood", "crossroads"),
          ],
  },
  {
    id: "wood_shrine",
    title: "The Overgrown Shrine",
    region: "Hollow Wood",
    aiEmbellish: true,
    text: () => [
      `A ring of moss-eaten stones surrounds a pedestal where a Shard of Aethyr floats, slowly turning, throwing splinters of light across the clearing.`,
      `As you approach, the stones grind and rise. A Warden of the Shard unfolds itself — stone and shardglass, eyes kindling with cold fire.`,
    ],
    choices: () => [
      {
        id: "c_fight",
        label: "Face the Warden",
        run: (ctx) => ctx.combat(["shard_warden"], { onWin: "wood_claim", scale: 0, intro: "The Warden raises a fist of grinding stone." }),
      },
      {
        id: "c_attune",
        label: "Attempt to attune to the Shard instead (Arcana)",
        hint: "Risky — failure provokes the Warden",
        run: (ctx) => {
          const r = ctx.check("int", 16);
          if (r.success) {
            ctx.say(`Arcana ${r.total} vs 16 — success.`);
            ctx.log(`You match the Shard's resonance. The Warden stills, judging you worthy, and sinks back into stone. The Shard drifts into your hands.`);
            ctx.goto("wood_claim");
          } else {
            ctx.say(`Arcana ${r.total} vs 16 — the resonance shatters.`);
            ctx.hurt(8);
            ctx.log(`Backlash sears you (-8 HP) and the Warden attacks!`);
            ctx.combat(["shard_warden"], { onWin: "wood_claim", scale: 0 });
          }
        },
      },
      go("c_withdraw", "Withdraw — you are not ready", "crossroads", "Live to fight another day"),
    ],
  },
  {
    id: "wood_claim",
    title: "First Shard",
    region: "Hollow Wood",
    aiEmbellish: true,
    text: (s) =>
      s.flags.shard_wood
        ? [`The shrine is quiet. You have what you came for.`]
        : [`The Shard of Aethyr settles into your pack, warm as a heartbeat. One of three.`],
    onEnter: (ctx) => {
      if (!ctx.getFlag("shard_wood")) {
        ctx.setFlag("shard_wood", true);
        ctx.addShard();
        ctx.say("⚜ You have claimed the Shard of the Hollow Wood!");
      }
    },
    choices: () => [go("c_back", "Return to the Crossroads", "crossroads")],
  },

  // ────────────────────────────── ASHEN WASTES ──────────────────────────────
  {
    id: "wastes_entrance",
    title: "The Ashen Wastes",
    region: "Ashen Wastes",
    aiEmbellish: true,
    text: (s) =>
      s.flags.shard_wastes
        ? [`The wastes stretch grey and empty. The cultists' fires are cold; their idol toppled. Nothing remains for you here.`]
        : [
            `A plain of ash and slag rolls to a sky the color of a bruise. Ahead, firelight flickers around a crude camp — Shard Cultists, chanting before a half-buried idol that cradles a Shard.`,
          ],
    choices: (s) =>
      s.flags.shard_wastes
        ? [go("c_back", "Return to the Crossroads", "crossroads")]
        : [
            {
              id: "c_charge",
              label: "Charge the cultist camp",
              run: (ctx) => ctx.combat(["cultist"], { onWin: "wastes_idol", scale: scale(ctx.state), intro: "A cultist turns, blade drawn, eyes empty." }),
            },
            {
              id: "c_parley",
              label: "Approach and parley (Persuasion)",
              run: (ctx) => {
                const r = ctx.check("cha", 15);
                if (r.success) {
                  ctx.say(`Persuasion ${r.total} vs 15 — success.`);
                  ctx.log(`You speak of the Sundering and the cost of clinging to a broken god. Doubt cracks their faith. They withdraw, leaving the idol unguarded.`);
                  ctx.xp(40);
                  ctx.goto("wastes_idol");
                } else {
                  ctx.say(`Persuasion ${r.total} vs 15 — they answer with steel.`);
                  ctx.combat(["cultist", "bandit"], { onWin: "wastes_idol", scale: scale(ctx.state) });
                }
              },
            },
            go("c_leave", "Leave the wastes", "crossroads"),
          ],
  },
  {
    id: "wastes_idol",
    title: "The Buried Idol",
    region: "Ashen Wastes",
    aiEmbellish: true,
    text: () => [
      `The idol's stone hands cradle a Shard, but the ground trembles as you reach for it. The ash heaves and a Wasteland Ogre claws its way up, roaring, its skin grey as the slag it slept in.`,
    ],
    choices: () => [
      {
        id: "c_fight",
        label: "Fight the Ogre",
        run: (ctx) => ctx.combat(["ogre"], { onWin: "wastes_claim", scale: 0, intro: "The Ogre swings a fist like a falling boulder." }),
      },
      {
        id: "c_trap",
        label: "Lure it onto the cracked ground (Survival)",
        run: (ctx) => {
          const r = ctx.check("wis", 14);
          if (r.success) {
            ctx.say(`Survival ${r.total} vs 14 — success.`);
            ctx.log(`You bait the brute toward a fissure. The ground gives way and it crashes down, half-buried and dazed — easy to finish.`);
            ctx.combat(["ogre"], { onWin: "wastes_claim", scale: 0 });
          } else {
            ctx.say(`Survival ${r.total} vs 14 — it doesn't take the bait.`);
            ctx.combat(["ogre"], { onWin: "wastes_claim", scale: 0 });
          }
        },
      },
      go("c_withdraw", "Withdraw — you are not ready", "crossroads", "Live to fight another day"),
    ],
  },
  {
    id: "wastes_claim",
    title: "Second Shard",
    region: "Ashen Wastes",
    aiEmbellish: true,
    text: (s) =>
      s.flags.shard_wastes
        ? [`The idol stands empty-handed now.`]
        : [`You pry the Shard from the idol's cold grip. Two of three. The pull northward grows stronger.`],
    onEnter: (ctx) => {
      if (!ctx.getFlag("shard_wastes")) {
        ctx.setFlag("shard_wastes", true);
        ctx.addShard();
        ctx.say("⚜ You have claimed the Shard of the Ashen Wastes!");
      }
    },
    choices: () => [go("c_back", "Return to the Crossroads", "crossroads")],
  },

  // ────────────────────────────── SUNKEN KEEP ──────────────────────────────
  {
    id: "keep_entrance",
    title: "The Sunken Keep",
    region: "Sunken Keep",
    aiEmbellish: true,
    text: (s) =>
      s.flags.shard_keep
        ? [`The drowned keep lies still, its depths emptied of their guardian. Water laps at silent stone.`]
        : [
            `A fortress half-swallowed by black water leans against the hillside. Its gate hangs open like a missing tooth. Cold air breathes out from within, and bones rattle in the dark.`,
          ],
    choices: (s) =>
      s.flags.shard_keep
        ? [go("c_back", "Return to the Crossroads", "crossroads")]
        : [
            {
              id: "c_enter",
              label: "Enter the flooded hall",
              run: (ctx) => ctx.combat(["skeleton"], { onWin: "keep_hall", scale: scale(ctx.state), intro: "A Risen Skeleton drags itself from the water." }),
            },
            go("c_leave", "Leave the keep", "crossroads"),
          ],
  },
  {
    id: "keep_hall",
    title: "The Flooded Hall",
    region: "Sunken Keep",
    text: (s) => [
      `Bone fragments float in knee-deep water. At the far end, a heavy iron door bars the way to the depths.${
        s.flags.keep_door
          ? " It stands open where you forced it."
          : " It is locked."
      }`,
    ],
    choices: (s) => {
      const cs: Choice[] = [];
      if (s.flags.keep_door) {
        cs.push(go("c_down", "Descend into the depths", "keep_depths"));
      } else {
        if (s.character.inventory.some((i) => i.itemId === "iron_key")) {
          cs.push({
            id: "c_key",
            label: "Open the door with the Iron Key",
            run: (ctx) => {
              ctx.take("iron_key", 1);
              ctx.setFlag("keep_door", true);
              ctx.log(`The Iron Key turns with a groan of rust. The door swings inward onto a stair descending into black water.`);
            },
          });
        }
        cs.push({
          id: "c_pick",
          label: "Pick the lock (Sleight of Hand)",
          hint: (s) => (s.character.inventory.some((i) => i.itemId === "lockpicks") ? "You have lockpicks" : "Harder without lockpicks"),
          run: (ctx) => {
            const bonus = ctx.has("lockpicks") ? 2 : -2;
            const r = ctx.check("dex", 15, bonus);
            if (r.success) {
              ctx.say(`Sleight of Hand ${r.total} vs 15 — the lock yields.`);
              ctx.setFlag("keep_door", true);
              ctx.log(`The tumblers click. The iron door drifts open.`);
            } else {
              ctx.say(`Sleight of Hand ${r.total} vs 15 — you can't crack it. Perhaps something in this keep holds the key.`);
            }
          },
        });
        cs.push({
          id: "c_search",
          label: "Search the hall for another way",
          run: (ctx) => {
            const r = ctx.check("wis", 12);
            if (r.success && !ctx.has("iron_key")) {
              ctx.log(`Among the bones you find an Iron Key, green with age.`);
              ctx.give("iron_key", 1);
            } else {
              ctx.combat(["skeleton"], { onWin: "keep_hall", scale: scale(ctx.state), intro: "Disturbed bones reassemble into a skeleton!" });
            }
          },
        });
      }
      cs.push(go("c_out", "Retreat from the keep", "keep_entrance"));
      return cs;
    },
  },
  {
    id: "keep_depths",
    title: "The Drowned Vault",
    region: "Sunken Keep",
    aiEmbellish: true,
    text: () => [
      `The stair opens into a vault where a Shard hangs above black, still water, its light swallowed rather than reflected. The cold here is grief made physical.`,
      `From that grief a Hollow Wraith gathers itself — a wound in the air shaped like someone who is gone.`,
    ],
    choices: () => [
      {
        id: "c_fight",
        label: "Banish the Wraith",
        run: (ctx) => ctx.combat(["wraith"], { onWin: "keep_claim", scale: 0, intro: "The Wraith keens and surges forward." }),
      },
      go("c_withdraw", "Retreat up the stair", "keep_hall", "Live to fight another day"),
    ],
  },
  {
    id: "keep_claim",
    title: "Third Shard",
    region: "Sunken Keep",
    aiEmbellish: true,
    text: (s) =>
      s.flags.shard_keep
        ? [`The vault is silent. The water is only water now.`]
        : [`The last Shard drops into your hands as the Wraith unravels into nothing. Three of three. North, the sky is tearing.`],
    onEnter: (ctx) => {
      if (!ctx.getFlag("shard_keep")) {
        ctx.setFlag("shard_keep", true);
        ctx.addShard();
        ctx.say("⚜ You have claimed the Shard of the Sunken Keep!");
      }
    },
    choices: () => [go("c_back", "Return to the Crossroads", "crossroads")],
  },

  // ────────────────────────────── FINALE ──────────────────────────────
  {
    id: "throne_approach",
    title: "The Sundered Throne",
    region: "The Throne",
    aiEmbellish: true,
    text: () => [
      `North of the Crossroads the land simply ends, and floating stairs of broken stone climb into the tear in the sky. At their summit waits a throne of suspended rubble.`,
      `The Sundered King rises from it, a crown of drifting shards orbiting his head. "You gathered my Heart for me," he says, almost grateful. "Come. Give it back — or try to take everything."`,
    ],
    choices: () => [
      {
        id: "c_final",
        label: "⚜ Confront the Sundered King",
        run: (ctx) => ctx.combat(["sundered_king"], { onWin: "victory", scale: 0, intro: "The crown of shards blazes. The world holds its breath." }),
      },
      go("c_prep", "Step back and prepare a moment longer", "crossroads"),
    ],
  },
  {
    id: "victory",
    title: "The Choice",
    region: "The Throne",
    aiEmbellish: true,
    text: () => [
      `The Sundered King kneels, then scatters — and his crown of shards drifts down into your hands, joining your three. The Heart of Aethyr is whole again, pulsing with the power to remake the world.`,
      `You feel the realm waiting on your decision.`,
    ],
    choices: () => [
      {
        id: "c_mend",
        label: "Mend the realm — give the Heart back to the world",
        run: (ctx) => {
          ctx.log(`You release the Heart. Light pours from your hands and runs along the cracks in the sky like water finding old riverbeds. The fractures close. Somewhere, birdsong — a sound the realm had forgotten.`);
          ctx.say("⚜ ENDING: THE MENDER — You healed the Shattered Realm and asked nothing for yourself. Legends will be told of you for as long as there are mouths to tell them.");
          ctx.setFlag("ending", "mender");
          ctx.state.phase = "victory";
        },
      },
      {
        id: "c_claim",
        label: "Claim the Heart — take the throne for yourself",
        run: (ctx) => {
          ctx.log(`You close your hand around the Heart and the crown of shards rises to orbit your own head. The realm reforms around your will, beautiful and terrible and yours. The throne is warm beneath you.`);
          ctx.say("⚜ ENDING: THE NEW KING — You took the Heart and remade the realm in your image. Whether that mercy or tyranny, only the centuries will decide.");
          ctx.setFlag("ending", "king");
          ctx.state.phase = "victory";
        },
      },
    ],
  },
];

export const SHATTERED_SCENES: Scene[] = SCENE_LIST;
export const SHATTERED_START = "intro";
