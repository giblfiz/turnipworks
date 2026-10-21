// THE RULES CARD AND ITS HELP PAGES (rewritten 2026-10-20, experiments/2026-10-20-llm-api/). The card is what a person
// pastes into a chat window, so it is built for the weakest one there is (a free ChatGPT, no tools): SHORT (the whole
// card has to fit in its window with room to play), one copy-paste address per common task with only CAPITALISED words
// to replace, one worked example, and everything else on /help/<topic> pages the card links to (each is plain text,
// with this seat's own addresses in it). Every line is filtered by what THIS seat may do: a player's advisor is never
// shown a command it cannot send, and nothing here names a thing the seat may not see (areas come from canSee).
// Before the rewrite the card was one 22.5k-character page for a GM's assistant (the registry's every argument).
import { REGISTRY } from '../core/commands.js';
import { CLASSES, can, canSee, effectiveClasses, isGmSide, visibilityOf } from '../core/perms.js';
import { RULE_KEYS } from '../core/state.js';
import { MARK_KEYS } from '../core/pawn.js';
import { LIGHT_RADII, DARKVISION_DEFAULT } from '../core/darkness.js';
import { CHAT_RATE, LOOP_MAX, LOOP_HOLD } from './campaign.js';
import { FIGURES } from './figures.js';
import { MINT } from './llm.js';

export const CONDITIONS = ['blinded', 'charmed', 'frightened', 'grappled', 'invisible', 'poisoned', 'prone', 'restrained', 'stunned', 'unconscious']; // (client/commands.js: the ring's list; any short word is allowed)
// arguments the card never offers: legacy (hp), the browser's own (solved layouts, recordings, asset paths), bookkeeping
const NOT_FOR_AI = new Set(['hp', 'hpMax', 'layout', 'plan', 'engine', 'engineVersion', 'throw', 'factionMissing', 'factionWasHidden', 'keepSession', 'fromEdge', 'rule', 'orient', 'url', 'sku', 'flat', 'layer', 'yaw', 's', 'swaps', 'gen', 'wallSeed', 'def', 'src', 'tiltZ', 'rolls', 'total', 'grants']);

function kit(rt, seat, base, token) {
  const s = rt.state.seats[seat], creator = s.kind === 'llm' ? rt.state.seats[s.creator] : null;
  const areas = rt.state.areaOrder.filter(t => canSee(rt.state, seat, t)).map(t => rt.state.areas[t]);
  const A = areas[0]?.id || 'AREA_ID', c = `${base}/c/${rt.id}`, tok = `seat=${token}`;
  const may = (cls) => CLASSES[cls] && (['area.admin', 'transfer', 'travel', 'campaign.admin'].includes(cls) ? can(rt.state, seat, cls, null).ok : areas.some(t => can(rt.state, seat, cls, t.id).ok));
  const gm = isGmSide(rt.state, seat);
  // an address with this seat's token: do('token.move', 'id=PAWN_ID&x=FEET') -> .../a/<area>/do?cmd=token.move&id=...&nonce=NEW_WORD&seat=...
  const at = (p, qs = '') => `${c}/a/${A}/${p}?${qs ? qs + '&' : ''}${tok}`;
  const camp = (p, qs = '') => `${c}/${p}?${qs ? qs + '&' : ''}${tok}`;
  const doA = (cmd, qs = '') => at('do', `cmd=${cmd}${qs ? '&' + qs : ''}&nonce=NEW_WORD`);
  const doC = (cmd, qs = '') => camp('do', `cmd=${cmd}${qs ? '&' + qs : ''}&nonce=NEW_WORD`);
  const help = (t) => camp(`help/${t}`);
  const whose = creator ? `${creator.name}'s ${s.role === 'gm' || gm ? 'GM assistant' : 'agent'}` : null;
  return { s, creator, whose, areas, A, c, tok, may, gm, at, camp, doA, doC, help };
}

export function ruleCard(rt, seat, base, token) {
  const K = kit(rt, seat, base, token), { s, may, gm, at, camp, doA, help } = K, L = [];
  L.push(`TURNIP WORKS — rules card for ${s.name}${K.whose ? ` (${K.whose})` : ''}`);
  L.push(`Campaign "${rt.state.name}". You play by opening web addresses (plain GET; no tools needed). Every address below already holds your seat token (seat=...): keep it secret.`);
  L.push('HOW: copy an address, replace each CAPITALISED word (ROOM_ID, PAWN_ID, THING_ID, FEET, TEXT, NEW_WORD...) with a real value, open it, read the JSON answer. {"ok":true} = it happened; {"ok":false,"why":"..."} says why not. Write a space in a value as %20.');
  L.push('');
  L.push('YOUR AREAS (the addresses below use the first; put another area\'s id in its place):');
  for (const t of K.areas) L.push(`  - ${t.name}  id=${t.id}  ${visibilityOf(t) === 'open' ? 'open to players' : 'HIDDEN from players'}`);
  if (!K.areas.length) L.push('  (none right now)');
  L.push(`YOU MAY: ${[...new Set(K.areas.flatMap(t => effectiveClasses(rt.state, seat, t.id)))].join(', ') || 'look only'} (what each means: ${help('commands')}).`);
  L.push('');
  L.push('1. LOOK FIRST (every id you need is in these answers; feet everywhere: x grows east, z grows south, y is height):');
  L.push(`   THE SCENE (rooms, pawns, lights, doors, turn order, recent chat): ${at('scene')}`);
  L.push(`   ONE ROOM, everything in it: ${at('room/ROOM_ID')}`);
  L.push(`   NEAR A POINT: ${at('look', 'x=FEET&z=FEET&r=15')}   (everything at once, larger: ${at('state')})`);
  L.push(`2. ACT: ${doA('COMMAND', 'ARGUMENTS')}`);
  L.push('   nonce: a new made-up word for each action (the same word again is a retry: it never happens twice). Optional based_on=SEQ (the "seq" you read): if someone changed that same thing since, the answer is "stale" with the changes; read again and retry.');
  const allowed = (type) => { const d = REGISTRY[type]; if (!d) return type === 'turn.roll' && may('turn'); const cls = typeof d.cls === 'string' ? d.cls : type === 'entity.flag' ? 'reveal' : null; return !!cls && may(cls); };
  L.push('3. COMMON TASKS (one address each):');
  if (allowed('dice.roll')) {
    L.push(`   ROLL DICE (the relay rolls fairly and answers with the numbers; everyone sees the dice tumble): ${doA('dice.roll', 'expr=d20&bonus=0&why=REASON')}`);
    L.push('     expr: d20, 2d6, 3d8, 4d6kh3 (keep highest 3), d20adv, d20dis. bonus: a number added to the total (bonus=-1 subtracts). why: what the roll is for.');
  }
  if (allowed('chat.say')) L.push(`   SAY SOMETHING: ${doA('chat.say', 'text=TEXT')}`);
  if (allowed('token.create')) L.push(`   ADD A CREATURE TO A ROOM: find a figure: ${camp('figures', 'q=WORDS')} (q=goblin, q=owlbear, q=elf+wizard), then ${doA('token.create', 'fig=FIGURE_ID&room=ROOM_ID')}  (it stands on a free square of that room; or give x=FEET&z=FEET; name=NAME is optional; hidden=true keeps it from the players)`);
  if (allowed('token.move')) L.push(`   MOVE A PAWN: ${doA('token.move', 'id=PAWN_ID&x=FEET&z=FEET')}  (or room=ROOM_ID: a free square there)${s.kind === 'llm' && !gm ? '. Only your own pawns ("yours": true).' : ''}`);
  if (allowed('object.light')) L.push(`   LIGHT OR PUT OUT a candle, lamp, torch or fire ("lights" in the scene): ${doA('object.light', 'id=THING_ID&lit=true')}  (lit=false puts it out)`);
  if (allowed('object.open')) L.push(`   OPEN OR CLOSE a door, chest or shutter ("doors" in the scene): ${doA('object.open', 'id=THING_ID&open=true')}  (open=false closes it)`);
  if (allowed('token.damage')) L.push(`   DAMAGE: ${doA('token.damage', 'id=PAWN_ID&damage=NEW_TOTAL')}  (damage counts UP from 0 = unhurt; a pawn at 12 hit for 7: damage=19)`);
  if (allowed('token.set')) L.push(`   CONDITIONS: ${doA('token.set', 'id=PAWN_ID&conditions=prone,poisoned')}  (conditions= with nothing clears them; ${CONDITIONS.join(', ')})`);
  if (allowed('entity.flag')) L.push(`   HIDE FROM PLAYERS / REVEAL: ${doA('entity.flag', 'ids=ID&hidden=true')}  (hidden=false reveals; a room id hides the whole room and everything in it)`);
  if (allowed('room.set')) {
    L.push(`   RENAME A ROOM (its label): ${doA('room.set', 'id=ROOM_ID&name=NAME')}  (name= with nothing goes back to its type's name)`);
    L.push('   ROOM LABELS (a room\'s name) are ALREADY hidden from the players: only the GM side ever receives them. So "hide a room\'s label from the players" needs NO command: say that it already is. Do NOT use entity.flag for it: that hides the WHOLE room (walls, floor, everything in it). Each person shows or hides labels on their own screen ("Hide room labels" in the command bar); no command here does that.');
  }
  if (allowed('room.spawn')) L.push(`   BUILD A ROOM: ${doA('room.spawn', 'type=TYPE&x=FEET&z=FEET&w=FEET&d=FEET')}  (x, z, w, d in FEET, multiples of 5, 5..80 a side; types like common, kitchen, temple-nave, cult-sanctum, mkt-square, min-tunnel: ${help('rooms')})`);
  if (allowed('turn.roll')) L.push(`   THE TURN ORDER is "turns" in the scene. ROLL INITIATIVE for a pawn: ${doA('turn.roll', 'id=PAWN_ID')}${gm ? '' : '  (your own pawns)'}`);
  if (allowed('undo')) L.push(`   UNDO your last action: ${doA('undo')}`);
  if (may('travel')) L.push(`   SEND A PAWN TO ANOTHER AREA: ${K.doC('travel', `id=PAWN_ID&from=${K.A}&to=AREA_ID`)}`);
  if (may('area.admin')) L.push(`   OPEN AN AREA TO THE PLAYERS, OR HIDE IT: ${K.doC('area.visibility', 'area=AREA_ID&visibility=open')}  (visibility=hidden)`);
  L.push('');
  L.push('4. WORKED EXAMPLE (the start of each address, up to "do?", is the same as above; every address ends with your &seat=...):');
  L.push('   You open the scene. It answers {"area":{"seq":12,...},"rooms":[{"id":"room_ab12cd34ef","type":"common","label":"Common room",...}],"lights":[{"id":"obj_77aa88bb99","name":"candlestick","room":"room_ab12cd34ef","lit":false}],...}');
  if (allowed('dice.roll')) L.push('   "Roll for the goblin\'s stealth, +6" -> do?cmd=dice.roll&expr=d20&bonus=6&why=Goblin%20stealth&nonce=roll1 -> {"ok":true,"expr":"d20+6","rolls":[13],"total":19}');
  if (allowed('token.create')) L.push('   "Put a goblin in the common room" -> figures?q=goblin -> {"figures":[{"id":"foe-goblin-club",...}]} -> do?cmd=token.create&fig=foe-goblin-club&room=room_ab12cd34ef&nonce=gob1 -> {"ok":true,"id":"tok_..."}');
  if (allowed('object.light')) L.push('   "Light the candle" -> do?cmd=object.light&id=obj_77aa88bb99&lit=true&nonce=light1 -> {"ok":true,...}');
  L.push('   Then say in one line what you did. If an answer is {"ok":false}, read its "why", fix that one thing and try again with a NEW nonce.');
  L.push('');
  if (s.kind === 'llm') {
    L.push('ETIQUETTE FOR AI SEATS (the table is for the humans):');
    L.push(`  - Act or speak only when someone addresses you ("@${s.name}", "${s.name}"${K.whose ? `, "${K.whose}"` : ''}), when ${K.creator ? K.creator.name : 'your creator'} asked you to handle something, or for a clear rules question nobody else is answering. Woken by a say or roll? Usually do nothing and wait again.`);
    L.push('  - Never reply to your own messages ("you": true). Never reply to another AI seat ("byKind": "ai") unless it addressed YOU by name.');
    L.push(`  - Keep it short: at most 2 messages a minute. Prefer doing (commands) over chatting. Unsure? Ask the GM in one line; the GM can undo anything you do. (The relay enforces ${CHAT_RATE.min} a minute and ${CHAT_RATE.hour} an hour, and pauses two AI seats that answer each other ${LOOP_MAX} times for ${LOOP_HOLD / 1000} s.)`);
    L.push(`  - To wait for talk (says and rolls only; waits up to 25 s; pass back the "cursor" you got): ${camp('changes', 'kinds=chat,roll&after=CURSOR&wait=25')}`);
    L.push('');
  }
  L.push(`5. MORE, when you need it (plain text, your own addresses inside): ${help('TOPIC')} with TOPIC one of:`);
  for (const t of helpTopics(rt, seat)) L.push(`   ${t.id} — ${t.title.replace(/^[A-Z ]+: /, '').replace(/^EVERY COMMAND/, 'every command')}`);
  return L.join('\n');
}

// ---- the help pages: /c/<campaign>/help/<topic>?seat=TOKEN (and /help for the list) ----
const TOPICS = [
  ['rooms', 'ROOMS: build, room types, labels, factions, fog height, roofs, walls and doors', (m) => m('room')],
  ['things', 'THINGS: put furniture down, move, turn, tip over, lift, replace with similar, lock, delete', (m) => m('object')],
  ['pawns', 'PAWNS: creatures and characters, figures, moving, damage, conditions, indicators, owners', (m) => m('token.move') || m('pawn') || m('token.edit')],
  ['light', 'LIGHT AND DARKNESS: lights, darkness per area, darkvision, carried lights, fog of war', (m) => true],
  ['dice', 'DICE AND TALK: rolls, say, what the others are pointing at, following along', (m) => m('chat')],
  ['turns', 'THE TURN ORDER: initiative, whose turn, next turn', (m) => m('turn')],
  ['height', 'HEIGHT AND STOREYS: upstairs, cellars, stairs and ladders', (m) => true],
  ['areas', 'AREAS: open or hidden areas, travel, sending things between areas, area rules', (m) => true],
  ['commands', 'EVERY COMMAND you may send, with its arguments', (m) => true],
];
export const helpTopics = (rt, seat) => { const m = kit(rt, seat, '', '').may; return TOPICS.filter(([, , f]) => f(m)).map(([id, title]) => ({ id, title })); };

export function helpPage(rt, seat, base, token, topic) {
  const K = kit(rt, seat, base, token), { may, gm, at, camp, doA, doC } = K, L = [];
  const t = TOPICS.find(x => x[0] === topic);
  if (!topic || !t) return [`TURNIP WORKS — help pages for ${K.s.name}${topic ? ` (no page "${String(topic).slice(0, 30)}")` : ''}:`, ...helpTopics(rt, seat).map(x => `  ${x.title}: ${K.help(x.id)}`), `The rules card: ${camp('card')}`].join('\n');
  L.push(`TURNIP WORKS — ${t[1]}`);
  L.push('Same rules as the card: replace the CAPITALISED words, a new nonce for each action, read "why" when an answer is {"ok":false}. Feet everywhere (x grows east, z grows south, y is height; rooms sit on a 5-ft grid).');
  L.push('');
  const no = (what) => L.push(`Your seat cannot ${what}. You can still read: ${at('scene')}`);
  if (topic === 'rooms') {
    if (!may('room')) no('build or change rooms');
    else {
      L.push(`BUILD: ${doA('room.spawn', 'type=TYPE&x=FEET&z=FEET&w=FEET&d=FEET')}`);
      L.push('  x, z, w, d in FEET on the 5-ft grid (multiples of 5; w=30 d=20 is a 30×20 ft room, 5..80 ft a side), exactly as rooms are reported. (Cells only if you name them cx, cz, cw, cd.) The relay furnishes it (seed=NUMBER picks another arrangement). A room may not overlap another. Add clip=1 to make whatever part of the rectangle does NOT overlap existing rooms (an L-shaped room, usually); or give outline=[[x,z],...] (feet, clockwise from the top-left corner) for a room that is not a rectangle. name=NAME gives it a label.');
      L.push('  Off the ground: y=FEET (10 = one storey up, -10 = a cellar or dungeon below; see help/height). tall=2 makes ONE room two storeys high (a great hall, a temple nave).');
      L.push(`ROOM TYPES (type=KEY), by kind:`);
      const groups = new Map(); for (const ty of rt.roomgen?.typeList || []) { const g = ty.group || 'Inn & home'; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(ty.key); }
      for (const [g, keys] of groups) L.push(`  ${g}: ${keys.join(', ')}`);
      L.push(`  (each type's name and size: ${camp('rooms')})`);
      L.push(`CHANGE A ROOM: ${doA('room.set', 'id=ROOM_ID&name=NAME')}`);
      L.push('  name: its LABEL (name= with nothing = its type\'s name). Labels are the GM side\'s only: a player or a player\'s agent never receives them, so a label never needs hiding from the players (hiding the room, entity.flag, hides the whole room). Each viewer shows or hides labels on their own screen ("Hide room labels" in the command bar); no command here does that.');
      L.push('  fog=FEET: that room\'s own fog height (0 = no fog, up to 8; -1 = back to its type\'s default: cellars and crypts fog, an inn\'s rooms don\'t). A room shows "fog" only when it has its own.');
      L.push('  roof={"style":"tile"} (thatch, tile, slate, shingle, flat), roof={"seed":7} re-rolls its dormers, roof={"off":true} removes it. A whole building: ' + doA('building.set', 'id=BUILDING_ID&roof=slate') + ' (roof=auto = by its walls; name=NAME renames the building). People see roofs only with "Roofs on".');
      L.push('  wallFamily=FAMILY and floor=FLOOR change its walls and floor.');
      L.push(`RE-ROLL OR CHANGE ITS TYPE: ${doA('room.reroll', 'id=ROOM_ID&type=TYPE')}  (type optional; pinned things stay; seed=NUMBER for a particular arrangement)`);
      L.push(`MOVE: ${doA('room.move', 'id=ROOM_ID&dx=FEET&dz=FEET')} (multiples of 5; dy=FEET to another height). TURN: ${doA('room.rotate', 'id=ROOM_ID&turns=1')} (quarter turns clockwise; -1 anticlockwise; everything in it turns with it). TALLER: ${doA('room.tall', 'id=ROOM_ID&tall=2')}. DELETE: ${doA('room.delete', 'id=ROOM_ID')}.`);
      L.push(`FACTIONS (the banners, idols, altars and sigils a temple, sanctum or hall is dressed in): ${doA('faction.set', 'id=ROOM_ID&flavor=FACTION')}  (a building id dresses all its rooms; flavor=inherit goes back). Factions: ${camp('factions')}`);
      L.push(`WALLS, DOORS AND WINDOWS: each wall segment has a key ("h:X:Z" along x at line z, "v:X:Z" along z at line x, in 5-ft cells; "@10" when off the ground). Open a gap: ${doA('edge.set', 'key=KEY&as=open')}; back to plain wall: as=wall; undo the edit: ${doA('edge.reset', 'key=KEY')}.`);
    }
    if (gm) L.push(`HIDE A ROOM FROM THE PLAYERS: ${doA('entity.flag', 'ids=ROOM_ID&hidden=true')} (walls, floor, everything in it, its label; hidden=false reveals; a building id hides its rooms).`);
  }
  if (topic === 'things') {
    if (!may('object')) no('place or change things');
    else {
      L.push(`FIND A PIECE in the library: ${camp('things', 'q=WORDS')} (q=candle, q=chest, q=barrel). Each hit: id, place (floor, wall, surface), and light / opens when it is one.`);
      L.push(`PUT IT DOWN: ${doA('object.place', 'cat=PIECE_ID&x=FEET&z=FEET')}  (y=FEET to raise it, e.g. on a table at 3; a wall piece hangs at 7 by itself; rot=RADIANS turns it; it belongs to the room it stands in)`);
      L.push(`MOVE OR LIFT: ${doA('object.move', 'id=THING_ID&x=FEET&z=FEET')}  (y=FEET lifts or lowers it; rot=RADIANS turns it: 1.5708 is a quarter turn)`);
      L.push(`TIP IT OVER (roll it onto its side): ${doA('object.set', 'id=THING_ID&quat=[0,0,0.7071,0.7071]')}  (a unit quaternion [x,y,z,w]; [0,0,0,1] stands it up again; not stairs, floor tiles or wall pieces). Rename: object.set&name=NAME.`);
      L.push(`REPLACE WITH SIMILAR (another look of the same piece, else a close cousin): ${doA('object.replace', 'id=THING_ID')}  (or cat=PIECE_ID for a particular piece)`);
      L.push(`LOCK (nobody moves it by accident) / PIN (a re-roll keeps it): ${doA('entity.flag', 'ids=ID&locked=true')}  (pinned=true; false undoes)`);
      L.push(`DELETE: ${doA('object.delete', 'id=THING_ID')}`);
    }
    if (may('open')) L.push(`OPEN / CLOSE: ${doA('object.open', 'id=THING_ID&open=true')}. LIGHT / PUT OUT: ${doA('object.light', 'id=THING_ID&lit=true')}. A locked thing refuses both.`);
    L.push(`WHAT IS IN A ROOM, with ids: ${at('room/ROOM_ID')}. Each thing says light, lit, radius (a light), open (a door, chest, shutter), locked, pinned, tilted, faction when they apply.`);
  }
  if (topic === 'pawns') {
    if (may('token.edit')) {
      L.push(`ADD: ${doA('token.create', 'fig=FIGURE_ID&room=ROOM_ID')} or with x=FEET&z=FEET (the middle of a 5-ft square: 2.5, 7.5, 12.5 ...; a large creature covers 2 x 2 squares and stands where four squares meet: 5, 10, 15 ...), y for an upper floor. name is optional (the figure's name is used); hidden=true keeps it from the players; owner=SEAT_ID gives it to a player.`);
      L.push(`  FIGURES: there are ${FIGURES.list.length} (heroes, townsfolk, foes, beasts, large creatures). Search: ${camp('figures', 'q=owlbear')} (q=elf+wizard, q=goblin, q=townsfolk). A pawn wears its "figure"; ${doA('token.set', 'id=PAWN_ID&fig=FIGURE_ID')} changes it (fig=none: the plain pawn).`);
      L.push(`REMOVE: ${doA('token.delete', 'id=PAWN_ID')}. GIVE TO A PLAYER: ${doA('token.owner', 'id=PAWN_ID&owner=SEAT_ID')} (owner= with nothing: back to the GM).`);
    }
    if (may('token.move')) L.push(`MOVE: ${doA('token.move', 'id=PAWN_ID&x=FEET&z=FEET')} (room=ROOM_ID: a free square in that room; y=FEET for its height, e.g. 10 upstairs; stair=STAIR_ID crosses a stair, see help/height).${gm ? '' : ' Only your own pawns ("yours": true).'}`);
    if (may('pawn')) {
      L.push(`DAMAGE: ${doA('token.damage', 'id=PAWN_ID&damage=NEW_TOTAL')} Damage counts UP from 0 (0 = unhurt; there are no hit points and no maximum). Send the new total: a pawn at 12 that takes 7 is damage=19. Any pawn you can see, not only yours.`);
      L.push(`CONDITIONS: ${doA('token.set', 'id=PAWN_ID&conditions=prone,poisoned')} (the whole list each time; conditions= with nothing clears them). The usual: ${CONDITIONS.join(', ')}; any short word works.`);
      L.push(`INDICATOR over a pawn, for everyone: ${doA('token.mark', 'id=PAWN_ID&mark=skull')} (${MARK_KEYS.join(', ')}; mark= with nothing clears).`);
      L.push(`RENAME, NOTES: token.set&id=PAWN_ID&name=NAME (notes=TEXT${gm ? ', gmNotes=TEXT the players never see' : ''}; initBonus=3 its initiative bonus; darkvision=FEET and lightCarried=FEET, see help/light).${gm ? '' : ' Your own pawns only.'}`);
    }
    L.push(`Each pawn in the scene: id, name, x, z, y, room, owner, yours, damage, conditions, mark, figure, squares, main${gm ? ', hidden' : ''}.`);
  }
  if (topic === 'light') {
    L.push('LIGHTS: candles, lamps, lanterns, torches, hearths, braziers, chandeliers, glowing things. The scene lists them under "lights": id, name, room, lit, kind, radius (feet a player can see by in the dark).');
    if (may('open')) L.push(`  LIGHT / PUT OUT: ${doA('object.light', 'id=THING_ID&lit=true')} (lit=false). Players may too, unless the GM has locked what players may touch.`);
    L.push(`  Reach by kind: ${Object.entries(rt?.roomgen?.lightTable || LIGHT_RADII).map(([k, r]) => `${k} ${r} ft`).join(', ')}.${may('object') ? ` The GM's own reach for one light: ${doA('object.set', 'id=THING_ID&lightRadius=FEET')} (lightRadius=none: by its kind).` : ''}`);
    L.push(`DARKNESS (per area, with fog of war): in a dark area a player sees a spot only if one of their pawns has line of sight to it AND it is within that pawn's darkvision or lit by a lit light. The scene's "rules" say whether the area is dark ("darkness") and uses fog of war ("fogOfWar").`);
    if (may('area.admin')) L.push(`  SWITCH IT: ${doC('area.set', `area=${K.A}&darkness=true`)} (false; default = the campaign's). Fog of war: fogOfWar=true. Time of day: light=day, night, deep-night, daylight or house. Atmosphere fog: fog=true.`);
    if (may('pawn')) L.push(`  A PAWN'S DARKVISION (feet; ${DARKVISION_DEFAULT} unless set) and A LIGHT IT CARRIES (feet): ${doA('token.set', 'id=PAWN_ID&darkvision=60&lightCarried=20')} (none = back to the default).`);
    L.push('FOG OF WAR: what players have explored is remembered by their browsers; there is no command to explore. The GM\'s "Reveal explored here" is in the GM\'s own menu.');
  }
  if (topic === 'dice') {
    L.push(`ROLL: ${doA('dice.roll', 'expr=d20&bonus=0&why=REASON')}`);
    L.push('  The relay rolls (fairly, never you) and answers {"ok":true,"expr":"d20+3","rolls":[14],"total":17}. Everyone sees the roll in chat, with dice tumbling on their table. expr: d20, 2d6, 3d8+2, 4d6kh3 (keep the highest 3), 2d20kl1, d20adv, d20dis, 1d8+1d6. Write a "+" inside expr as %2B, or use bonus=NUMBER. why: what it is for.');
    L.push(`SAY: ${doA('chat.say', 'text=TEXT')}`);
    L.push(`WAIT FOR TALK (says and rolls in every area you can see; waits up to 25 s; pass back the "cursor"): ${camp('changes', 'kinds=chat,roll&after=CURSOR&wait=25')}  (one area: ${at('changes', 'after=SEQ&kinds=chat,roll&wait=25')}). Each event: "by" (who), "byKind" (human or ai), "you": true for your own, the area, and the "text" or "roll".`);
    L.push(`FOLLOW EVERYTHING in one area (moves, builds...; waits up to 25 s): ${at('changes', 'after=SEQ&wait=25')}`);
    L.push(`WHO IS POINTING AT WHAT (each other seat's area, cursor in feet and selection with names), e.g. when someone asks "what do you think of this chair?": ${camp('presence')}`);
  }
  if (topic === 'turns') {
    L.push('"turns" in the scene while there is a turn order: round, current (the key whose turn it is; null while initiative is being gathered) and order (each entry: key, name, pawns, initiative, bonus, current, yours). An entry is one pawn (key = its id) or every pawn of a kind as one (key "kind:goblin").');
    L.push(`ROLL INITIATIVE: ${doA('turn.roll', 'id=PAWN_ID')} (the relay rolls d20 and adds the pawn's bonus; add n=17 to give a number rolled at the table). A pawn's bonus: token.set&id=PAWN_ID&initBonus=3.`);
    L.push(`END THE TURN: ${doA('turn.next')}${gm ? ` (turn.prev goes back). START A FIGHT: ${doA('turn.start')} (order=tok_a,kind:goblin is optional); turn.end ends it; turn.order&order=KEY,KEY sets the order; turn.at&key=KEY moves the marker; turn.init&key=KEY&n=NUMBER sets any entry's number.` : ' (only while "current" is your pawn). You may roll only for your own pawns.'}`);
  }
  if (topic === 'height') {
    L.push('Heights are feet, as "y", on everything: rooms (their floor), objects and pawns. 0 is the ground, negative is below ground. A storey is 10 ft unless its building says otherwise ("buildings" in state: base, storeyHeight).');
    L.push('Which floor: worked out from the height, never stored. Each room and pawn has "storey" (0 = its building\'s ground floor, 1 = the floor above, -1 = the first below) and "level" ("lv 1" is storey 0, "lv 2" storey 1, "lv -1" the first below; there is no lv 0). A pawn also has "room": the room it stands in.');
    L.push(`See one storey only: ${at('look', 'x=FEET&z=FEET&r=15&y=FEET')}`);
    if (may('room')) L.push('BUILD UPSTAIRS OR DOWN: room.spawn with y=10 (or -10). An upper room must stand on rooms below it (it may overhang them by at most 10 ft); below ground anything goes. Rooms at different heights may share x and z. A room off the ground floor gets a stair by itself (the answer has "stair"; stair=0 for none) and no outside door.');
    L.push(`STAIRS AND LADDERS ("stairs" in the scene and state: id, from and to rooms, bottom and top points [x, z, y], "works" or a "problem"). TAKE A PAWN ACROSS: ${doA('token.move', 'id=PAWN_ID&stair=STAIR_ID')} (to=top or to=bottom picks the end).`);
    if (may('object')) {
      L.push(`  ADD ONE: ${doA('object.place', 'place=stair&rise=10&x=FEET&z=FEET&rot=0&dims=[4.4,10,10]&room=LOWER_ROOM_ID')} (x, z: the middle of its squares; rot 0 climbs toward +z, quarter turns in radians).`);
      L.push(`  MAKE IT LEAD DOWN instead of up: ${doA('stair.flip', 'id=STAIR_ID&y=ITS_Y_MINUS_ITS_RISE&down=true')} (back: y=ITS_Y_PLUS_ITS_RISE&down=false). The hole and the railing move with it; edge.set&key=KEY&as=open removes one railing or bracket piece (edge.reset brings it back).`);
    }
    L.push('Something upstairs or downstairs missing? You only receive what your seat may see; a hidden floor is not sent at all.');
  }
  if (topic === 'areas') {
    L.push('A campaign has areas (a town, a dungeon, a tower). Each is OPEN (every player sees it) or HIDDEN (the GM side only). You only ever receive the areas you may see.');
    for (const t of K.areas) L.push(`  - ${t.name}  id=${t.id}  ${visibilityOf(t) === 'open' ? 'open' : 'HIDDEN'}  scene: ${K.c}/a/${t.id}/scene?${K.tok}`);
    if (may('travel')) L.push(`TRAVEL (a pawn goes to another area; the relay picks where it arrives): ${doC('travel', `id=PAWN_ID&from=${K.A}&to=AREA_ID`)}${gm ? ' Sending a PLAYER\'s pawn into a hidden area opens that area to the players (the answer has "opened": true); undo sends it back and hides it again.' : ' Your own pawns, to areas you can see; refused while the GM has travel locked.'}`);
    if (may('transfer')) L.push(`SEND A THING between areas: ${doC('transfer', `id=ID&from=${K.A}&to=AREA_ID`)}`);
    if (may('area.admin')) {
      L.push(`OPEN OR HIDE AN AREA: ${doC('area.visibility', 'area=AREA_ID&visibility=open')} (or hidden). The first area of a campaign is open; every area made after it starts hidden. NEW AREA: ${doC('area.create', 'name=NAME')}. RENAME: ${doC('area.set', 'area=AREA_ID&name=NAME')}.`);
      L.push(`AREA RULES: ${doC('area.set', 'area=AREA_ID&darkness=true')} — ${Object.entries(RULE_KEYS).map(([k, v]) => `${k}=${Array.isArray(v) ? v.join('|') : v === 'bool' ? 'true|false' : 'TEXT'}`).join(', ')}; =default goes back to the campaign's. The scene's "rules" shows them.`);
    }
  }
  if (topic === 'commands') {
    const all = Object.values(REGISTRY).filter(d => !d.internal && !d.quiet && !['fog.explore', 'fog.reveal', 'batch'].includes(d.type));
    const mine = all.filter(d => { const cls = typeof d.cls === 'string' ? d.cls : d.type === 'entity.flag' ? 'reveal' : null; return cls && may(cls); });
    L.push(`YOUR PERMISSIONS: ${[...new Set(K.areas.flatMap(t => effectiveClasses(rt.state, seat, t.id)))].map(c => `${c} (${CLASSES[c]})`).join('; ') || 'look only'}.`);
    L.push(`Area commands: ${at('do', 'cmd=COMMAND&...&nonce=NEW_WORD').replace(/&seat=.*/, '&seat=...')}; campaign commands (marked *): ${camp('do', 'cmd=COMMAND&...').replace(/&seat=.*/, '&seat=...')}. Lists: a,b,c or JSON. true/false for switches.`);
    const made = mine.filter(d => MINT[d.type]);
    if (made.length) L.push(`IDS: to create something (${made.map(d => d.type).join(', ')}) leave id out: the answer gives you the new "id". If you do send one it must look like ${[...new Set(made.map(d => `${MINT[d.type]}_ab12cd34ef`))].join(' / ')}.`);
    const GM_ONLY = new Set(['turn.start', 'turn.end', 'turn.prev', 'turn.order', 'turn.at', 'template.clear']); // (class turn / template, which players hold: these few are the GM's)
    for (const d of mine.filter(d => gm || !GM_ONLY.has(d.type))) {
      const args = Object.entries(d.args).filter(([k]) => !NOT_FOR_AI.has(k) && (gm || !['gmNotes', 'hidden', 'owner'].includes(k))).map(([k, v]) => `${k}${v.endsWith('?') || k === 'id' && d.type.match(/create|place|spawn|say|roll/) ? '?' : ''}`);
      L.push(`  ${d.type}${d.level === 'campaign' ? '*' : ''}: ${args.join(', ') || '(nothing)'}`);
    }
    if (may('turn')) L.push('  turn.roll: id (or key), n?   (GET only: the relay rolls initiative)');
    if (may('object')) L.push('  object.place: cat=PIECE_ID fills in the mesh and size; object.replace with no cat picks a similar piece   (GET only)');
    L.push(`  ("?" = optional. dice.roll: expr, bonus?, why? — the relay rolls.${may('token.move') ? ` ${may('token.edit') ? 'Pawn creation and moves take' : 'A move takes'} room=ROOM_ID for a free square there.` : ''})`);
    L.push(`  Not over GET (the browser's own): fog of war exploring and the GM's "Reveal explored here", whole-building generation, painting floor tiles cell by cell, water drawing by hand.`);
  }
  return L.join('\n');
}
