import type { GameState } from "./types";
import type { Scene, Choice } from "./scene";
import { RACES, CLASSES, getItem } from "./content";
import { pick, chance, rollRange } from "./dice";

// "The Dungeon Crawl" — a LitRPG game-show dungeon. A snarky System narrates,
// the surface is gone, and the only way out is down. Original homage; not based
// on any specific property.

const scale = (s: GameState) => Math.max(0, s.character.level - 1);

function go(id: string, label: string, target: string, hint?: string): Choice {
  return { id, label, hint, run: (ctx) => ctx.goto(target) };
}

const favor = (s: GameState) => (typeof s.flags.favor === "number" ? (s.flags.favor as number) : 0);

// A loot box: themed random reward, scaled to be helpful but never broken.
function openLootBox(ctx: { give: (id: string, q?: number) => void; gold: (n: number) => void; say: (t: string) => void; log: (t: string) => void }) {
  const table = [
    "energy_drink",
    "energy_drink",
    "nano_serum",
    "foam_bat",
    "hazmat_suit",
    "riot_baton",
    "stim_pack",
    "loot_token",
  ];
  const item = pick(table);
  const coins = rollRange([5, 20]);
  ctx.log(`The box hisses open with entirely unnecessary fanfare.`);
  ctx.give(item, 1);
  ctx.gold(coins);
  ctx.say(`Loot: ${getItem(item).name} + ${coins} gold.`);
  if (chance(0.25)) {
    ctx.give("loot_token", 1);
    ctx.say(`Bonus: a Bronze Loot Token rattles out.`);
  }
}

const SCENE_LIST: Scene[] = [
  // ───────────────────────── PROLOGUE ─────────────────────────
  {
    id: "dc_intro",
    title: "Patch Notes: The Apocalypse",
    region: "The Surface (formerly)",
    text: (s) => {
      const klass = CLASSES[s.character.klass].name;
      const race = RACES[s.character.race].name;
      return [
        `The buildings went first — folded into the ground like a magician's trick, except the magician hated you specifically. Then a voice the size of the sky cleared its throat.`,
        `"GREETINGS, SURVIVOR. Earth has been condemned for redevelopment. The good news: there's a dungeon. The better news: it's monetized."`,
        `A glowing menu assigns you, ${s.character.name}, the role of CRAWLER — a ${race} ${klass}, apparently, because the System read your soul and made some assumptions.`,
        `The floor opens beneath you. Down you go.`,
      ];
    },
    choices: () => [
      { id: "dc_fall", label: "Fall with dignity", run: (ctx) => ctx.goto("dc_floor1") },
      {
        id: "dc_scream",
        label: "Fall while screaming (it's free)",
        run: (ctx) => {
          ctx.log(`"BOLD CHOICE," booms the System. "The audience appreciates commitment." Your Crowd Favor ticks upward.`);
          ctx.bumpFlag("favor", 2);
          ctx.goto("dc_floor1");
        },
      },
    ],
  },

  // ───────────────────────── FLOOR 1 ─────────────────────────
  {
    id: "dc_floor1",
    title: "Floor 1 — Welcome Wagon",
    region: "The Dungeon · Floor 1",
    text: (s) => {
      const lines = [
        `You land in a concrete corridor lit by fluorescent tubes that flicker in a rhythm best described as "ominous jazz."`,
      ];
      if (!s.flags.met_beans) {
        lines.push(
          `Something rummages in a vending alcove. An opossum the size of a beagle pokes its head out, wearing a tiny salvaged headset. "Oh thank god, a person," it says. "Name's Beans. I'll be your emotional support marsupial and tactical advisor. Mostly I yell."`
        );
      } else {
        lines.push(`Beans the opossum trots beside you, narrating your life uncharitably under his breath.`);
      }
      lines.push(`A door marked SAFE ROOM glows green. Two unmarked doors do not.`);
      return lines;
    },
    onEnter: (ctx) => {
      if (!ctx.getFlag("met_beans")) {
        ctx.setFlag("met_beans", true);
      }
    },
    choices: (s) => {
      const cs: Choice[] = [
        go("dc_s1", "Enter the Safe Room (shop & loot box)", "dc_safe1"),
      ];
      if (!s.flags.dc_room1_done) cs.push(go("dc_r1", "Open the left door", "dc_room1"));
      if (!s.flags.dc_room2_done) cs.push(go("dc_r2", "Open the right door", "dc_room2"));
      if (s.flags.dc_room1_done && s.flags.dc_room2_done && !s.flags.dc_boss1_done) {
        cs.push({ id: "dc_b1", label: "⚔ The big steel door rumbles open — go through", hint: "Floor boss", run: (ctx) => ctx.goto("dc_boss1") });
      }
      if (s.flags.dc_boss1_done) {
        cs.push(go("dc_desc1", "Take the elevator DOWN to Floor 2", "dc_floor2"));
      }
      return cs;
    },
  },
  {
    id: "dc_safe1",
    title: "Safe Room — The Black Market",
    region: "The Dungeon · Floor 1",
    text: (s) => [
      `A grimy terminal blinks BLACK MARKET in a font that screams "trust me." Beans hops onto the counter. "Buy stuff. Don't read the fine print, it's load-bearing." You have ${s.character.gold} gold. Crowd Favor: ${favor(s)}.`,
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
          ctx.say(`Purchased: ${label}.`);
        },
      });
      return [
        { id: "dc_box1", label: "Open a Loot Box (free, daily-ish)", hint: "Random reward", run: (ctx) => openLootBox(ctx) },
        buy("dc_buy_drink", "energy_drink", 12, "an Energy Drink"),
        buy("dc_buy_stim", "stim_pack", 30, "a Stim-Pack"),
        buy("dc_buy_nano", "nano_serum", 15, "Nano-Serum (mana)"),
        buy("dc_buy_kev", "kevlar_vest", 35, "a Kevlar Vest (armor)"),
        buy("dc_buy_power", "power_armor", 90, "Knockoff Power Armor"),
        buy("dc_buy_baton", "riot_baton", 18, "a Riot Baton"),
        {
          id: "dc_rest1",
          label: "Nap in the safe room (full HP & mana)",
          enabled: (s) => s.character.hp < s.character.maxHp || s.character.mp < s.character.maxMp,
          run: (ctx) => {
            ctx.heal(9999);
            ctx.restoreMp(9999);
            ctx.log(`You sleep on a beanbag of dubious origin. Beans keeps watch, allegedly.`);
          },
        },
        go("dc_back1", "Back to the corridor", "dc_floor1"),
      ];
    },
  },
  {
    id: "dc_room1",
    title: "Left Door — Block Party",
    region: "The Dungeon · Floor 1",
    text: () => [
      `The room is a horrifying recreation of a suburban cul-de-sac. The former residents turn toward you with the dead-eyed zeal of people who really want to discuss your parking.`,
    ],
    choices: () => [
      {
        id: "dc_fight1",
        label: "Fight the welcome committee",
        run: (ctx) => ctx.combat(["feral_neighbor", "camera_drone"], { onWin: "dc_room1_win", scale: scale(ctx.state), intro: "A Feral HOA Treasurer brandishes a clipboard. A Camera Drone zooms in for the angle." }),
      },
      {
        id: "dc_charm1",
        label: "Compliment the lawn (Charisma)",
        run: (ctx) => {
          const r = ctx.check("cha", 13);
          if (r.success) {
            ctx.log(`"Finally, someone who GETS IT." The treasurer weeps with joy and waves you through. The crowd eats it up.`);
            ctx.bumpFlag("favor", 3);
            ctx.xp(30);
            ctx.setFlag("dc_room1_done", true);
            ctx.goto("dc_floor1");
          } else {
            ctx.say(`Your flattery lands flat.`);
            ctx.combat(["feral_neighbor"], { onWin: "dc_room1_win", scale: scale(ctx.state) });
          }
        },
      },
      go("dc_flee1", "Nope back out the door", "dc_floor1"),
    ],
  },
  {
    id: "dc_room1_win",
    title: "Left Door — Cleared",
    region: "The Dungeon · Floor 1",
    text: () => [`The cul-de-sac is quiet. Property values plummet. Beans gives a slow clap.`],
    onEnter: (ctx) => {
      if (!ctx.getFlag("dc_room1_done")) {
        ctx.setFlag("dc_room1_done", true);
        ctx.bumpFlag("favor", 2);
      }
    },
    choices: () => [go("dc_b1", "Back to the corridor", "dc_floor1")],
  },
  {
    id: "dc_room2",
    title: "Right Door — Loot & Hazards",
    region: "The Dungeon · Floor 1",
    text: () => [
      `A storeroom stacked with crates, half of them too eager to be opened. One crate, in particular, has teeth.`,
    ],
    choices: () => [
      {
        id: "dc_loot2",
        label: "Pry open the nearest crate (Perception first)",
        run: (ctx) => {
          const r = ctx.check("wis", 12);
          if (r.success) {
            ctx.log(`You spot the toothy one and pop a safe crate instead.`);
            openLootBox(ctx);
            ctx.setFlag("dc_room2_done", true);
            ctx.goto("dc_floor1");
          } else {
            ctx.say(`You pick the wrong crate. It picks you back.`);
            ctx.combat(["vending_mimic"], { onWin: "dc_room2_win", scale: scale(ctx.state), intro: "The crate unfolds into a Mimic Vending Machine!" });
          }
        },
      },
      {
        id: "dc_smash2",
        label: "Just smash the toothy crate (it's asking for it)",
        run: (ctx) => ctx.combat(["vending_mimic"], { onWin: "dc_room2_win", scale: scale(ctx.state), intro: "The Mimic Vending Machine lunges, dispensing pain." }),
      },
      go("dc_flee2", "Leave the crates alone", "dc_floor1"),
    ],
  },
  {
    id: "dc_room2_win",
    title: "Right Door — Cleared",
    region: "The Dungeon · Floor 1",
    text: () => [`The mimic coughs up its hoard. Beans immediately tries to eat a coin.`],
    onEnter: (ctx) => {
      if (!ctx.getFlag("dc_room2_done")) {
        ctx.setFlag("dc_room2_done", true);
        ctx.give("keycard", 1);
        ctx.say("Picked up: Maintenance Keycard.");
      }
    },
    choices: () => [go("dc_b2", "Back to the corridor", "dc_floor1")],
  },
  {
    id: "dc_boss1",
    title: "Floor 1 Boss — The Floor Manager",
    region: "The Dungeon · Floor 1",
    text: () => [
      `The steel door opens onto a room-sized office. Behind a desk welded from rebar sits THE FLOOR MANAGER, a bloated thing in a dented hardhat. "You're behind on your quota," it gurgles, standing. "Performance review time."`,
    ],
    choices: () => [
      {
        id: "dc_fightb1",
        label: "Decline the performance review (violently)",
        run: (ctx) => ctx.combat(["floor_manager"], { onWin: "dc_boss1_win", scale: 0, intro: "The Floor Manager hefts a stapler the size of a car." }),
      },
      go("dc_runb1", "Step back to the corridor first", "dc_floor1", "Heal up, gear up, return"),
    ],
  },
  {
    id: "dc_boss1_win",
    title: "Floor 1 Cleared",
    region: "The Dungeon · Floor 1",
    text: () => [
      `The Floor Manager deflates with a sad bureaucratic wheeze. The System chimes: "FLOOR 1 COMPLETE. The audience is mildly entertained. An elevator is now available. It only goes down."`,
    ],
    onEnter: (ctx) => {
      if (!ctx.getFlag("dc_boss1_done")) {
        ctx.setFlag("dc_boss1_done", true);
        ctx.bumpFlag("favor", 5);
        ctx.say("⬇ The elevator to Floor 2 is unlocked.");
      }
    },
    choices: () => [go("dc_godown", "Back to the corridor", "dc_floor1")],
  },

  // ───────────────────────── FLOOR 2 ─────────────────────────
  {
    id: "dc_floor2",
    title: "Floor 2 — Brand Activation Zone",
    region: "The Dungeon · Floor 2",
    text: (s) => {
      const lines = [
        `The elevator doors part on a neon shopping concourse gone feral. Holographic ads beg for your attention and your blood. "FLOOR 2," purrs the System. "Now with sponsors!"`,
      ];
      lines.push(`Crowd Favor: ${favor(s)}.${favor(s) >= 8 ? " A sponsor has taken notice of you." : ""}`);
      return lines;
    },
    choices: (s) => {
      const cs: Choice[] = [go("dc_s2", "Duck into the Safe Room", "dc_safe2")];
      if (!s.flags.dc_room3_done) cs.push(go("dc_r3", "Hit the food court (it hits back)", "dc_room3"));
      if (favor(s) >= 8 && !s.flags.dc_sponsor_claimed) {
        cs.push({
          id: "dc_sponsor",
          label: "★ Claim your Sponsor Reward",
          hint: "Crowd favor has its perks",
          run: (ctx) => {
            ctx.setFlag("dc_sponsor_claimed", true);
            ctx.give("sponsor_pin", 1);
            ctx.give("stim_pack", 1);
            ctx.gold(40);
            ctx.log(`A drone airdrops a glittering care package. "BROUGHT TO YOU BY A BRAND," the System announces. Beans is incandescent with jealousy.`);
          },
        });
      }
      if (s.flags.dc_room3_done && !s.flags.dc_boss2_done) {
        cs.push({ id: "dc_b2go", label: "⚔ Approach the executive suite", hint: "Floor boss", run: (ctx) => ctx.goto("dc_boss2") });
      }
      if (s.flags.dc_boss2_done) {
        cs.push(go("dc_desc2", "Take the final elevator DOWN", "dc_floor3"));
      }
      return cs;
    },
  },
  {
    id: "dc_safe2",
    title: "Safe Room — Premium Black Market",
    region: "The Dungeon · Floor 2",
    text: (s) => [
      `Same terminal, fancier font. "WELCOME BACK, VALUED CRAWLER." You have ${s.character.gold} gold.`,
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
          ctx.say(`Purchased: ${label}.`);
        },
      });
      return [
        { id: "dc_box2", label: "Open a Loot Box", hint: "Random reward", run: (ctx) => openLootBox(ctx) },
        buy("dc_buy_stim2", "stim_pack", 30, "a Stim-Pack"),
        buy("dc_buy_power2", "power_armor", 90, "Knockoff Power Armor"),
        buy("dc_buy_rail", "railgun_pistol", 120, "a Railgun Pistol"),
        buy("dc_buy_nail", "nail_bat", 26, "a Bat With Nails In It"),
        {
          id: "dc_rest2",
          label: "Rest (full HP & mana)",
          enabled: (s) => s.character.hp < s.character.maxHp || s.character.mp < s.character.maxMp,
          run: (ctx) => {
            ctx.heal(9999);
            ctx.restoreMp(9999);
            ctx.log(`You rest. The ads keep playing. You dream in jingles.`);
          },
        },
        go("dc_back2", "Back to the concourse", "dc_floor2"),
      ];
    },
  },
  {
    id: "dc_room3",
    title: "Food Court of the Damned",
    region: "The Dungeon · Floor 2",
    text: () => [
      `Grease, neon, and a Roid-Rage Gym Bro doing curls with a fire extinguisher. A vending machine three feet away is definitely also a problem.`,
    ],
    choices: () => [
      {
        id: "dc_fight3",
        label: "Throw down in the food court",
        run: (ctx) => ctx.combat(["gym_bro", "vending_mimic"], { onWin: "dc_room3_win", scale: scale(ctx.state), intro: "The Gym Bro flexes. The vending machine sprouts teeth. Combo encounter!" }),
      },
      {
        id: "dc_hype3",
        label: "Hype up the crowd before the fight (showmanship)",
        run: (ctx) => {
          const r = ctx.check("cha", 12);
          if (r.success) {
            ctx.log(`You play to the cameras. The audience roars; you fight buoyed by adoration.`);
            ctx.bumpFlag("favor", 3);
          } else {
            ctx.say(`You trip over a chair. Humiliating, but the cameras love it anyway.`);
            ctx.bumpFlag("favor", 1);
          }
          ctx.combat(["gym_bro", "vending_mimic"], { onWin: "dc_room3_win", scale: scale(ctx.state) });
        },
      },
      go("dc_flee3", "Back out for now", "dc_floor2"),
    ],
  },
  {
    id: "dc_room3_win",
    title: "Food Court — Cleared",
    region: "The Dungeon · Floor 2",
    text: () => [`Silence, finally. Beans loots a pretzel. "Five-second rule," he says, from the floor.`],
    onEnter: (ctx) => {
      if (!ctx.getFlag("dc_room3_done")) {
        ctx.setFlag("dc_room3_done", true);
        ctx.bumpFlag("favor", 3);
      }
    },
    choices: () => [go("dc_b3", "Back to the concourse", "dc_floor2")],
  },
  {
    id: "dc_boss2",
    title: "Floor 2 Boss — Compliance Officer",
    region: "The Dungeon · Floor 2",
    text: () => [
      `The executive suite is all chrome and silence. A COMPLIANCE OFFICER unfolds from a wall — sleek, armored, smiling without a face. "Your enthusiasm is noted," it says. "Unfortunately, you are out of compliance."`,
    ],
    choices: () => [
      {
        id: "dc_fightb2",
        label: "Become noncompliant on purpose",
        run: (ctx) => ctx.combat(["compliance_officer"], { onWin: "dc_boss2_win", scale: 0, intro: "The Compliance Officer extends a chrome arm. It hums with lethal customer service." }),
      },
      go("dc_runb2", "Pull back and prep first", "dc_floor2", "Heal up, gear up, return"),
    ],
  },
  {
    id: "dc_boss2_win",
    title: "Floor 2 Cleared",
    region: "The Dungeon · Floor 2",
    text: () => [
      `The Compliance Officer collapses into a tidy chrome cube, helpfully self-packaging. "FLOOR 2 COMPLETE," the System announces. "Ratings are spiking. The Showrunner would like to meet you. This is rarely good."`,
    ],
    onEnter: (ctx) => {
      if (!ctx.getFlag("dc_boss2_done")) {
        ctx.setFlag("dc_boss2_done", true);
        ctx.bumpFlag("favor", 6);
        ctx.say("⬇ The final elevator is unlocked.");
      }
    },
    choices: () => [go("dc_godown2", "Back to the concourse", "dc_floor2")],
  },

  // ───────────────────────── FINALE ─────────────────────────
  {
    id: "dc_floor3",
    title: "The Green Room",
    region: "The Dungeon · The Studio",
    text: (s) => [
      `The elevator opens not on a floor but a stage — blinding lights, a studio audience of a billion unseen eyes, and a man in a headset and an unsettlingly perfect smile.`,
      `"There you are!" beams THE SHOWRUNNER. "Our breakout star. The crowd adores you${favor(s) >= 12 ? " — frankly, your numbers are obscene" : ""}. So here's the pitch: beat me on live broadcast, or sign here and become part of the show forever."`,
    ],
    choices: () => [
      {
        id: "dc_final_fight",
        label: "⚔ Go off-script — fight the Showrunner",
        run: (ctx) => ctx.combat(["the_showrunner"], { onWin: "dc_victory", scale: 0, intro: "The Showrunner snaps his fingers. The stage becomes an arena. 'We're LIVE!'" }),
      },
      {
        id: "dc_sign",
        label: "Read the contract first (Investigation)",
        hint: "Knowledge is power",
        run: (ctx) => {
          const r = ctx.check("int", 13);
          if (r.success) {
            ctx.log(`The fine print is damning — and it reveals the Showrunner's broadcast rig is also his weak point. You step into the fight already knowing where to hit.`);
            ctx.xp(40);
            ctx.bumpFlag("favor", 2);
          } else {
            ctx.say(`The contract is forty thousand pages of legalese. You get a headache and a vague sense of doom.`);
          }
          ctx.combat(["the_showrunner"], { onWin: "dc_victory", scale: 0, intro: "The Showrunner spreads his arms. 'Then let's give them a SHOW.'" });
        },
      },
      go("dc_final_back", "Step back to the concourse", "dc_floor2", "Not yet"),
    ],
  },
  {
    id: "dc_victory",
    title: "And We're Clear",
    region: "The Dungeon · The Studio",
    text: () => [
      `The Showrunner shorts out mid-monologue, sparks raining from his headset, and the impossible audience falls silent. A new prompt blinks in the air: the show needs someone to run it. Or end it.`,
    ],
    choices: () => [
      {
        id: "dc_end_free",
        label: "Pull the plug — end the broadcast for everyone",
        run: (ctx) => {
          ctx.log(`You rip the broadcast rig out by the roots. Across a thousand floors, the cameras die and the doors unlock. Somewhere far above, the survivors blink up at a sky nobody is selling. Beans sheds a single, theatrical tear.`);
          ctx.say("★ ENDING: CANCELLED — You ended the show and freed every Crawler. No sponsors. No host. Just people, and a way out.");
          ctx.setFlag("ending", "cancelled");
          ctx.state.phase = "victory";
        },
      },
      {
        id: "dc_end_host",
        label: "Pick up the headset — become the new Showrunner",
        run: (ctx) => {
          ctx.log(`You lift the headset. It fits perfectly, which is the most frightening part. The audience roars back to life — for you now. You could be a kinder host. You could be a worse one. The ratings are, regrettably, incredible.`);
          ctx.say("★ ENDING: NEW MANAGEMENT — You took the headset and the throne of the show. Beans demands a producer credit.");
          ctx.setFlag("ending", "host");
          ctx.state.phase = "victory";
        },
      },
    ],
  },
];

export const CRAWL_SCENES: Scene[] = SCENE_LIST;
export const CRAWL_START = "dc_intro";
