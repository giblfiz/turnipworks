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
import { MARK_KEYS, CONDITIONS } from '../core/pawn.js';
import { LIGHT_RADII, DARKVISION_DEFAULT } from '../core/darkness.js';
import { CHAT_RATE, LOOP_MAX, LOOP_HOLD } from './campaign.js';
import { FIGURES } from './figures.js';
import { MINT } from './llm.js';
import { botOf } from '../core/agentname.js';

export { CONDITIONS } from '../core/pawn.js'; // the ring's list, each with its own look on the table (core/conditions.js); any other short word shows as a text label
// arguments the card never offers: legacy (hp), the browser's own (solved layouts, recordings, asset paths), bookkeeping
const NOT_FOR_AI = new Set(['hp', 'hpMax', 'layout', 'plan', 'engine', 'engineVersion', 'throw', 'factionMissing', 'factionWasHidden', 'keepSession', 'walk', 'fromEdge', 'rule', 'orient', 'url', 'sku', 'flat', 'layer', 'yaw', 's', 'swaps', 'gen', 'wallSeed', 'def', 'src', 'tiltZ', 'rolls', 'total', 'grants']);

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
  // a seat named "<owner>'s <bot>" (core/agentname.js) needs no "(Harry's agent)" after its name, and answers to its botname too
  const bot = creator ? botOf(creator.name, s.name) : null;
  return { s, creator, whose, bot, areas, A, c, tok, may, gm, at, camp, doA, doC, help };
}

export function ruleCard(rt, seat, base, token) {
  const K = kit(rt, seat, base, token), { s, may, gm, at, camp, doA, help } = K, L = [];
  L.push(`TURNIP WORKS — rules card for ${s.name}${K.whose && !K.bot ? ` (${K.whose})` : ''}`);
  L.push(`Campaign "${rt.state.name}". You play by opening web addresses (plain GET; no tools needed). Every address below already holds your seat token (seat=...): keep it secret.`);
  L.push('HOW: copy an address, replace each CAPITALISED word (ROOM_ID, PAWN_ID, THING_ID, FEET, TEXT, NEW_WORD...) with a real value, open it, read the JSON answer. {"ok":true} = it happened; {"ok":false,"why":"..."} says why not. Write a space in a value as %20.');
  L.push('');
  L.push('YOUR AREAS (the addresses below use the first; put another area\'s id in its place):');
  for (const t of K.areas) L.push(`  - ${t.name}  id=${t.id}  ${visibilityOf(t) === 'open' ? 'open to players' : 'HIDDEN from players'}`);
  if (!K.areas.length) L.push('  (none right now)');
  L.push(`YOU MAY: ${[...new Set(K.areas.flatMap(t => effectiveClasses(rt.state, seat, t.id)))].join(', ') || 'look only'} (what each means: ${help('commands')}).`);
  L.push('');
  L.push('1. LOOK FIRST (every id you need is in these answers; feet everywhere: x grows east, z grows south, y is height):');
  L.push(`   THE SCENE (rooms, buildings, pawns, lights, doors, turn order, recent chat): ${at('scene')}`);
  L.push(`   ONE ROOM, everything in it: ${at('room/ROOM_ID')}`);
  L.push(`   NEAR A POINT: ${at('look', 'x=FEET&z=FEET&r=15')}   (everything at once, larger: ${at('state')})`);
  L.push(`2. ACT: ${doA('COMMAND', 'ARGUMENTS')}`);
  L.push('   nonce: a new made-up word for each action (the same word again is a retry: it never happens twice).');
  const allowed = (type) => { const d = REGISTRY[type]; if (!d) return type === 'turn.roll' && may('turn'); const cls = typeof d.cls === 'string' ? d.cls : type === 'entity.flag' ? 'reveal' : null; return !!cls && may(cls); };
  L.push('3. COMMON TASKS (one address each):');
  if (allowed('dice.roll')) {
    L.push(`   ROLL DICE (the relay rolls fairly and answers with the numbers; everyone sees the dice tumble): ${doA('dice.roll', 'expr=d20&bonus=0&why=REASON')}`);
    L.push('     expr: d20, 2d6, 4d6kh3 (keep highest 3), d20adv, d20dis. bonus=-1 subtracts. why: what it is for.');
    L.push('     Other games\' dice (coc, v5, sr, duality, 4df, l5r, ex; the answer\'s "tally" counts them): help/dice.');
  }
  if (allowed('chat.say')) L.push(`   SAY SOMETHING: ${doA('chat.say', 'text=TEXT')}`);
  if (allowed('token.create')) L.push(`   ADD A CREATURE TO A ROOM: find a figure: ${camp('figures', 'q=WORDS')} (q=goblin, q=owlbear, q=elf+wizard), then ${doA('token.create', 'fig=FIGURE_ID&room=ROOM_ID')}  (it stands on a free square of that room; or give x=FEET&z=FEET; name=NAME is optional; hidden=true keeps it from the players)`);
  if (allowed('token.move')) L.push(`   MOVE A PAWN: ${doA('token.move', 'id=PAWN_ID&x=FEET&z=FEET')}  (or room=ROOM_ID: a free square there; stair=STAIR_ID crosses a stair, to=top its upper end, to=bottom its lower)${s.kind === 'llm' && !gm ? '. Only your own pawns ("yours": true).' : ''}`);
  L.push('   STAIRS ("stairs" in the scene): "ends" names the bottom and top, room and level; "from" is the bottom room, "to" the top, never a direction. room/ROOM_ID adds "goes": "up" or "down", from that room.');
  if (allowed('object.light')) L.push(`   LIGHT OR PUT OUT a candle, lamp, torch or fire ("lights" in the scene): ${doA('object.light', 'id=THING_ID&lit=true')}  (lit=false puts it out)`);
  if (allowed('object.open')) L.push(`   OPEN OR CLOSE a door, chest or shutter ("doors" in the scene): ${doA('object.open', 'id=THING_ID&open=true')}  (open=false closes it); one with a "key", no id: ${doA('door.open', 'key=KEY&open=true')}`);
  if (allowed('token.damage')) L.push(`   DAMAGE: ${doA('token.damage', 'id=PAWN_ID&damage=NEW_TOTAL')}  (damage counts UP from 0 = unhurt; a pawn at 12 hit for 7: damage=19)`);
  L.push('   TARGET: a pawn\'s "target" ("targetName") is the pawn its player is aiming at: "attack" means that one.' + (allowed('token.set') ? ` Set it: ${doA('token.set', 'id=PAWN_ID&target=TARGET_ID')} (target= with nothing clears).` : ''));
  if (allowed('token.set')) L.push(`   SAVED ATTACKS (names and dice only, 8 at most): ${doA('token.set', 'id=PAWN_ID&attacks=[{"name":"Longsword","hit":"+5","dmg":"1d8+3"}]')}  (attacks=[] clears; the whole list each time)`);
  if (allowed('token.set')) L.push(`   CONDITIONS: ${doA('token.set', 'id=PAWN_ID&conditions=prone,poisoned')}  (the whole list; conditions= clears. Any short text works; ${camp('conditions')} lists those drawn as pictures)`);
  if (allowed('entity.flag')) L.push(`   HIDE FROM PLAYERS / REVEAL: ${doA('entity.flag', 'ids=ID&hidden=true')}  (hidden=false reveals; a room id hides the whole room and everything in it)`);
  if (allowed('room.set')) {
    L.push(`   RENAME A ROOM (its label): ${doA('room.set', 'id=ROOM_ID&name=NAME')}  (name= with nothing goes back to its type's name)`);
    L.push('   ROOM AND BUILDING LABELS: "label" is what people read on the map. The scene\'s "buildings" pair each id with its label ("Building 3"); a room gives its "building" and "buildingLabel". Labels are ALREADY hidden from the players, so hiding one needs NO command. Do NOT use entity.flag for it: that hides the WHOLE room.');
  }
  if (gm && !may('room')) L.push('   LABELS: this seat has no "room" permission, so it reads no labels: every building is just "Building". A seat with Rooms ticked reads them.');
  if (allowed('room.spawn')) L.push(`   BUILD A ROOM: ${doA('room.spawn', 'type=TYPE&x=FEET&z=FEET&w=FEET&d=FEET')}  (x, z, w, d in FEET, multiples of 5, 5..80 a side; types like common, kitchen, temple-nave: ${help('rooms')}). Below ground, a cave, cellar, basement or crypt is a room too, never a thing: add y=-10 (type=cave, type=cellar, type=crypt-vault); upstairs y=10.`);
  else if (allowed('object.place')) L.push('   A cave, cellar or crypt is a ROOM, not a thing: this seat has no "room" permission, so it cannot build one. Ask the GM.');
  if (allowed('object.place')) L.push(`   PUT A THING DOWN: ${doA('object.place', 'cat=PIECE_ID&x=FEET&z=FEET')}  (find it: ${camp('things', 'q=WORDS')}; with no cat you get only a marker)`);
  if (allowed('room.spawn')) L.push(`   IMPORT A SHARED BUILD: ${doA('import', 'link=LINK')} (${help('sharing')})`);
  if (allowed('turn.roll')) L.push(`   THE TURN ORDER is "turns" in the scene. ROLL INITIATIVE for a pawn: ${doA('turn.roll', 'id=PAWN_ID')}${gm ? '' : '  (your own pawns)'}`);
  if (allowed('undo')) L.push(`   UNDO your last action: ${doA('undo')}`);
  if (may('travel')) L.push(`   SEND A PAWN TO ANOTHER AREA: ${K.doC('travel', `id=PAWN_ID&from=${K.A}&to=AREA_ID`)}`);
  if (may('area.admin')) L.push(`   OPEN AN AREA TO THE PLAYERS, OR HIDE IT: ${K.doC('area.visibility', 'area=AREA_ID&visibility=open')}  (visibility=hidden)`);
  L.push('');
  L.push('4. WORKED EXAMPLE (the start of each address, up to "do?", is the same as above; every address ends with your &seat=...):');
  L.push('   You open the scene. It answers {"area":{"seq":12,...},"rooms":[{"id":"room_ab12cd34ef","type":"common","label":"Common room",...}],"lights":[{"id":"obj_77aa88bb99","name":"candlestick","room":"room_ab12cd34ef","lit":false}],...}');
  if (allowed('dice.roll')) L.push('   "Roll for the goblin\'s stealth, +6" -> do?cmd=dice.roll&expr=d20&bonus=6&why=Goblin%20stealth&nonce=roll1 -> {"ok":true,"expr":"d20+6","rolls":[13],"total":19}');
  L.push('   Then say in one line what you did. If an answer is {"ok":false}, read its "why", fix that one thing and try again with a NEW nonce.');
  L.push('');
  if (s.kind === 'llm') {
    L.push('ETIQUETTE FOR AI SEATS (the table is for the humans):');
    L.push(`  - Act or speak only when someone addresses you ("@${s.name}", "${s.name}"${K.bot ? `, "${K.bot}"` : K.whose ? `, "${K.whose}"` : ''}), when ${K.creator ? K.creator.name : 'your creator'} asked you to handle something, or for a clear rules question nobody else is answering. Woken by a say or roll? Usually do nothing and wait again.`);
    L.push('  - Never reply to your own messages ("you": true). Never reply to another AI seat ("byKind": "ai") unless it addressed YOU by name.');
    L.push(`  - Keep it short: at most 2 messages a minute. Prefer doing (commands) over chatting. Unsure? Ask the GM in one line; the GM can undo anything you do. (The relay enforces ${CHAT_RATE.min} a minute, ${CHAT_RATE.hour} an hour.)`);
    L.push(`  - Whenever you are not actively working, hide your cursor: ${K.doC('cursor.hide')}  When you start again, show it: ${K.doC('cursor.show')}`);
    L.push(`  - To wait for talk (says, rolls, pings; waits up to 25 s; pass back the "cursor" you got): ${camp('changes', 'kinds=chat,roll&after=CURSOR&wait=25')}`);
    L.push('  - A person holding a click on the map makes a PING: it comes in that wait as kind "ping", with "by", x, z, y and "there" (the pawn, thing, room at that spot). It usually means "look at this".');
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
  ['sharing', 'SHARED BUILDS: import one, or export the area', (m) => m('room')],
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
      L.push('  A cave, a cellar, a basement, a crypt: rooms, one level down with y=-10 (type=cave has no command of its own, and goes below the ground by itself). No thing makes one: object.place makes one piece of furniture.');
      L.push('  x, z, w, d in FEET on the 5-ft grid (multiples of 5; w=30 d=20 is a 30×20 ft room, 5..80 ft a side), exactly as rooms are reported. (Cells only if you name them cx, cz, cw, cd.) The relay furnishes it (seed=NUMBER picks another arrangement). A room may not overlap another. Add clip=1 to make whatever part of the rectangle does NOT overlap existing rooms (an L-shaped room, usually); or give outline=[[x,z],...] (feet, clockwise from the top-left corner) for a room that is not a rectangle. name=NAME gives it a label.');
      L.push('  Off the ground: y=FEET (10 = one storey up, -10 = a cellar or dungeon below; see help/height). tall=2 makes ONE room two storeys high (a great hall, a temple nave).');
      L.push(`ROOM TYPES (type=KEY), by kind:`);
      const groups = new Map(); for (const ty of rt.roomgen?.typeList || []) { const g = ty.group || 'Inn & home'; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(ty.key); }
      for (const [g, keys] of groups) L.push(`  ${g}: ${keys.join(', ')}`);
      L.push(`  (each type's name and size: ${camp('rooms')})`);
      L.push(`CHANGE A ROOM: ${doA('room.set', 'id=ROOM_ID&name=NAME')}`);
      L.push('  name: its LABEL (name= with nothing = its type\'s name). Labels are the GM side\'s only: a player or a player\'s agent never receives them, so a label never needs hiding from the players (hiding the room, entity.flag, hides the whole room). Each viewer shows or hides labels on their own screen ("Hide room labels" in the command bar); no command here does that.');
      L.push('  fog=FEET: that room\'s own fog height (0 = no fog, up to 8; -1 = back to its type\'s default: cellars and crypts fog, an inn\'s rooms don\'t). A room shows "fog" only when it has its own.');
      L.push('  roof={"style":"tile"} (thatch, tile, slate, shingle, marble; flat ones: deck, flagstone, lead, turf, plaster), roof={"edge":"battlements"} (battlements, parapet, railing, none, auto: round a flat roof), roof={"turrets":true} (corner turrets on a flat roof), roof={"seed":7} re-rolls its dormers, roof={"off":true} removes it (the room is open to the sky), roof={"shape":"hip"} (gable, hip, flat, auto) its shape, roof={"axis":"z"} turns it so its ridge runs along z (x or z; auto = along the long side), roof={"trim":{"chimney:FIRE_ID":{"at":[10,5]}}} moves a piece of its trim (feet from the room\'s corner; {"gone":true} removes it, null puts it back). A whole building: ' + doA('building.set', 'id=BUILDING_ID&roof=slate') + ' (roof=auto = by its walls; roofShape=flat gives every roof of it that shape; name=NAME renames the building). People see roofs only with "Roofs on".');
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
      L.push('A thing is one piece of furniture. object.place with no cat leaves only a marker, a bare box with that name, and a word that names a room (cave, cellar, crypt) is refused with the room.spawn that makes the room.');
      L.push(`PUT IT DOWN: ${doA('object.place', 'cat=PIECE_ID&x=FEET&z=FEET')}  (y=FEET to raise it, e.g. on a table at 3; a wall piece hangs at 7 by itself; rot=RADIANS turns it; it belongs to the room it stands in)`);
      L.push(`MOVE OR LIFT: ${doA('object.move', 'id=THING_ID&x=FEET&z=FEET')}  (y=FEET lifts or lowers it; rot=RADIANS turns it: 1.5708 is a quarter turn)`);
      L.push(`TIP IT OVER (roll it onto its side): ${doA('object.set', 'id=THING_ID&quat=[0,0,0.7071,0.7071]')}  (a unit quaternion [x,y,z,w]; [0,0,0,1] stands it up again; not stairs, floor tiles or wall pieces). Rename: object.set&name=NAME.`);
      L.push(`REPLACE WITH SIMILAR (another look of the same piece, else a close cousin): ${doA('object.replace', 'id=THING_ID')}  (or cat=PIECE_ID for a particular piece)`);
      L.push(`LOCK (nobody moves it by accident) / PIN (a re-roll keeps it): ${doA('entity.flag', 'ids=ID&locked=true')}  (pinned=true; false undoes)`);
      L.push(`DELETE: ${doA('object.delete', 'id=THING_ID')}`);
    }
    if (may('open')) L.push(`OPEN / CLOSE: ${doA('object.open', 'id=THING_ID&open=true')}; a room's own doorway (a "doors" entry with a "key", no id yet): ${doA('door.open', 'key=KEY&open=true')} (it becomes a thing: the answer gives its id). LIGHT / PUT OUT: ${doA('object.light', 'id=THING_ID&lit=true')}. A locked thing refuses both.`);
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
      L.push(`CONDITIONS: ${doA('token.set', 'id=PAWN_ID&conditions=prone,poisoned')} (the whole list each time; conditions= with nothing clears them). These have their own look on the table: ${CONDITIONS.join(', ')}, and "exhaustion 1" to "exhaustion 6". Any other short text is allowed too (Hexed, Blessed, deafened: up to 12 words of 24 characters) and shows as a small text label over the pawn.`);
      L.push(`AURA, a light round a pawn everyone sees (a raging barbarian, a divine glow, an anima banner): ${doA('token.set', 'id=PAWN_ID&aura=3,blue')} (level 0-5: 0 none, 1 dim, 2 glowing, 3 burning, 4 bonfire, 5 iconic with its emblem; aura=up, aura=down, aura=off, or a colour alone: gold, silver, blue, green, red, violet; aura=5,gold,dragons hangs a faction's emblem in it).`);
      L.push(`INDICATOR over a pawn, for everyone: ${doA('token.mark', 'id=PAWN_ID&mark=skull')} (${MARK_KEYS.join(', ')}; mark= with nothing clears).`);
      L.push(`RENAME, NOTES: token.set&id=PAWN_ID&name=NAME (notes=TEXT${gm ? ', gmNotes=TEXT the players never see' : ''}; initBonus=3 its initiative bonus; darkvision=FEET and lightCarried=FEET, see help/light).${gm ? '' : ' Your own pawns only.'}`);
    }
    L.push(`Each pawn in the scene: id, name, x, z, y, room, owner, yours, damage, conditions, mark, figure, squares, main, target and targetName (the pawn it is aiming at: a player's "attack" means that one), attacks (its saved attacks: name, hit, dmg), aura (level, color)${gm ? ', hidden' : ''}.`);
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
    L.push('GAME DICE: the same command; the answer (and the roll in chat, state and changes) adds "tally", the dice counted by that game\'s rules. Judgement (what a messy critical costs, which dice to keep) is yours or the GM\'s. Spaces are fine in expr (a + can be a space).');
    L.push('  expr=coc [SKILL] [bonus N | penalty N]  Call of Cthulhu d100: N extra tens dice (max 2), best kept for bonus, worst for penalty. With a skill: critical (01), extreme (<= 1/5), hard (<= 1/2), regular, failure, fumble (100, or 96+ when the skill is under 50).');
    L.push('  expr=v5 POOL [hunger H] [diff D]  Vampire 5e: POOL d10s, H of them Hunger dice. 6+ is a success; each pair of 10s counts 4 (critical). "messy critical": a critical with a Hunger 10. A Hunger 1 means a bestial failure if the roll fails. diff gives the margin.');
    L.push('  expr=sr POOL [threshold T]  Shadowrun: POOL d6s, 5-6 are hits. "glitch": more than half the dice show 1; "CRITICAL GLITCH": that with no hits. threshold gives net hits.');
    L.push('  expr=duality [MOD] [diff D]  Daggerheart: a Hope d12 and a Fear d12 plus MOD; "with Hope" or "with Fear" by the higher die (that matters for your Hope / the GM\'s Fear); doubles are a critical success.');
    L.push('  expr=4df [MOD] [diff D]  Fate/Fudge: four dice of + / blank / -, total = sum + MOD, with its ladder word (+2 Fair); diff gives shifts.');
    L.push('  expr=l5r R ring S skill [tn N]  Legend of the Five Rings 5e: R ring d6s, S skill d12s with symbol faces (success, opportunity, strife, explosive = a success that may roll one more die). The tally lists every face and the totals if all were kept; the player keeps up to R dice (they or the GM choose).');
    L.push('  expr=ex POOL [tn T] [double D | nodouble] [diff N]  Exalted: POOL d10s; 7+ is a success, each 10 counts 2. "BOTCH": no successes and at least one 1. tn lowers or raises the target number, double 9 (or d9) doubles 9s too, nodouble for rolls that never double (damage); diff gives threshold successes. Charms change these: write them in.');
    L.push(`SAY: ${doA('chat.say', 'text=TEXT')}`);
    L.push(`WAIT FOR TALK (says, rolls and pings in every area you can see; waits up to 25 s; pass back the "cursor"): ${camp('changes', 'kinds=chat,roll&after=CURSOR&wait=25')}  (one area: ${at('changes', 'after=SEQ&kinds=chat,roll&wait=25')}). Each event: "by" (who), "byKind" (human or ai), "you": true for your own, the area, and the "text" or "roll".`);
    L.push('PINGS: a person holds a click on the map (or Alt/Option+click, or holds a finger still) to point at something. It usually means "look at this", and what they say next is about it. It reaches you once, in the same wait (any feed with kinds holding chat or ping), as kind "ping": "by", the area, x, z, y, "text" (one line) and "there": "level", and when there is one the "pawn", "thing", "room" and "building" at that spot, as your seat may see them. A ping you may not see never arrives. Nothing keeps it: it is not in the scene, state or chat, and after 2 minutes unread it is gone.');
    L.push(`FOLLOW EVERYTHING in one area (moves, builds...; waits up to 25 s): ${at('changes', 'after=SEQ&wait=25')}  (a ping comes beside the entries, as "pings")`);
    L.push(`WHO IS POINTING AT WHAT (each other seat's area, cursor in feet and selection with names), e.g. when someone asks "what do you think of this chair?": ${camp('presence')}`);
  }
  if (topic === 'turns') {
    L.push('"turns" in the scene while there is a turn order: round, current (the key whose turn it is; null while initiative is being gathered) and order (each entry: key, name, pawns, initiative, bonus, current, yours). An entry is one pawn (key = its id) or every pawn of a kind as one (key "kind:goblin").');
    L.push(`ROLL INITIATIVE: ${doA('turn.roll', 'id=PAWN_ID')} (the relay rolls d20 and adds the pawn's bonus; add n=17 to give a number rolled at the table). A pawn's bonus: token.set&id=PAWN_ID&initBonus=3.`);
    L.push(`END THE TURN: ${doA('turn.next')}${gm ? ` (turn.prev goes back). START A FIGHT: ${doA('turn.start')} (order=tok_a,kind:goblin is optional); turn.end ends it; turn.order&order=KEY,KEY sets the order; turn.at&key=KEY moves the marker; turn.init&key=KEY&n=NUMBER sets any entry's number.` : ' (only while "current" is your pawn). You may roll only for your own pawns.'}`);
  }
  if (topic === 'height') {
    L.push('Heights are feet, as "y", on everything: rooms (their floor), objects and pawns. 0 is the ground, negative is below ground. A storey is 10 ft everywhere.');
    L.push('Which floor: worked out from the height, never stored. The levels are the map\'s, the same everywhere: "level" "lv 1" is 0 to 9 ft, "lv 2" 10 to 19 ft, "lv -1" -10 to -1 ft (there is no lv 0); "storey" is the same as a number (0 = lv 1, 1 = lv 2, -1 = lv -1). A room on a hill is on the level of its floor (a shrine on a 10-ft hill is lv 2) and has "ground": true when its floor is the ground it stands on. A pawn also has "room": the room it stands in; a pawn on a stair stands on its treads, and is on the lower level until its feet reach the top.');
    L.push(`See one storey only: ${at('look', 'x=FEET&z=FEET&r=15&y=FEET')}`);
    if (may('room')) L.push('BUILD UPSTAIRS OR DOWN (a cellar, a cave, a crypt): room.spawn with y=10 (or -10). An upper room must stand on rooms below it (it may overhang them by at most 10 ft); below ground anything goes. Rooms at different heights may share x and z. A room off the ground floor gets a stair by itself (the answer has "stair"; stair=0 for none) and no outside door.');
    L.push(`STAIRS AND LADDERS ("stairs" in the scene, state and a room): "ends" names its bottom and its top, each with its room and level, and "says" puts it in words. "from" is always the room at the BOTTOM and "to" the room at the TOP, even for a stair switched to lead down: never a direction of travel. Read from one room (${at('room/ROOM_ID')}), or with y= in look, each adds "goes": "up" or "down", and "leadsTo": the room and level it reaches from there. "bottom" and "top" are the points [x, z, y] a pawn stands on. "kind": "ladder" for a ladder. "down" only records which floor it was put in for: it is no direction, so read "ends" and "goes". "works": false comes with "note" (the words over it on the table) and "why". A floor you may not see reads as nothing built.`);
    L.push(`TAKE A PAWN ACROSS: ${doA('token.move', 'id=PAWN_ID&stair=STAIR_ID')} (to=top: to its upper end; to=bottom: to its lower end; left out: the end it is not at). The answer to placing or switching a stair has "stairSays": which way it leads.`);
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
      L.push(`MUSIC (every seat hears it; each person sets their own volume): ${doC('music.set', 'area=AREA_ID&music=playlist')} — music=off, playlist (every track, shuffled) or a track by name: The Wizard's Roots, Buried in the Earth, Hymn of the Radiant Path, The Turnip Castle, The Black Mass, In the Dark Soil, The Tasty Turnip; music=default goes back to the campaign's. default=true&music=… sets the campaign default (built-in: off). next=TRACK skips to that track.`);
    }
  }
  if (topic === 'sharing') {
    if (!may('room')) no('import or export builds');
    else {
      L.push('A SHARED BUILD is a room, a building, a set of things or a whole area as a small file (.turnip.json): recipes and library pieces, never meshes. People share one as a link, https://turnipworks.net/s/ID (22 letters and digits).');
      L.push(`IMPORT ONE from its link (or just its ID): ${doA('import', 'link=LINK&x=FEET&z=FEET')}`);
      L.push('  x, z: the middle of where it lands (left out: just east of everything already here); y=FEET puts a single upper room or a set of things on that level. A building lands on the ground, on top of a hill if it lands on one. It is ONE step: undo takes it all away. A broken piece in the file is left out and the rest lands: "pieces" in the answer counts them, and "left" and "leftOut" say what went and why. Refused, with why, if it would overlap a room that is already there. The answer has the new ids ("ids"), and "standIns" when this library lacks some pieces (they show as plain boxes).');
      L.push(`EXPORT THE AREA as a file: ${at('share', 'strip=1')} (the whole area; a room, a building or some things alone cannot be exported for now). strip=1 leaves out what is hidden from players, the creatures, traps and GM notes; without it they travel. The answer IS the file. A player's pawn is never in it, nor seats, chat or fog.`);
      L.push('Making a share LINK is done by a person in the game (Settings ▸ Area settings ▸ "Export this area…", then "Copy share link").');
    }
  }
  if (topic === 'commands') {
    const all = Object.values(REGISTRY).filter(d => !d.internal && !d.quiet && !['fog.explore', 'fog.reveal', 'batch'].includes(d.type));
    const mine = all.filter(d => { const cls = typeof d.cls === 'string' ? d.cls : d.type === 'entity.flag' ? 'reveal' : null; return cls && may(cls) && (!d.aiOnly || K.s.kind === 'llm'); });
    L.push(`YOUR PERMISSIONS: ${[...new Set(K.areas.flatMap(t => effectiveClasses(rt.state, seat, t.id)))].map(c => `${c} (${CLASSES[c]})`).join('; ') || 'look only'}.`);
    L.push('Optional based_on=SEQ (the "seq" you read) on any command: if someone changed that same thing since, the answer is "stale" with the changes; read again and retry.');
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
    if (K.s.kind === 'llm') L.push('  (cursor.hide, cursor.show: your own cursor, for every seat that can see it, at once; every AI seat may, no permission needed, and they are not logged and not undone. Hidden, it stays off the table while you read a whole area (scene, state) or wait (changes); any command that happens, or reading one room or spot (room, look), shows it again. On an area\'s address, cursor.show puts it in that area.)');
    L.push(`  Not over GET (the browser's own): fog of war exploring and the GM's "Reveal explored here", whole-building generation, painting floor tiles cell by cell, water drawing by hand.`);
  }
  return L.join('\n');
}
