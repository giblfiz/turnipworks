Rules card (GM's AI seat, every class): 22519 characters, 2985 words; with its 0 help pages 22519 characters.
Rules card (a player's AI seat): 13213 characters, 1740 words.

| command | level | class | player's AI | GET (GM's AI) | explained (card / help) | AI read shows it |
|---|---|---|---|---|---|---|
| fog.explore | area | pawn | - | skip: the browser sends the cells its pawns see (a raster); an AI seat has no eyes to explore with | NO | - |
| fog.reveal | area | room | - | skip: the browser sends a raster of explored cells (the GM's "Reveal explored here") | card | - |
| fog.reset | campaign | campaign.admin | no | ok | NO | NO |
| token.create | area | token.edit | no | ok | card | yes |
| token.move | area | token.move | no (Goblin, club belongs to someone else) | ok | card | yes |
| token.set | area | pawn | no (Goblin, club belongs to someone else) | ok | card | yes |
| token.damage | area | pawn | yes | ok | card | yes |
| token.mark | area | pawn | yes | ok | card | yes |
| token.owner | area | token.edit | no | ok | card | yes |
| token.delete | area | token.edit | no | ok | card | yes |
| template.place | area | template | no (id tpl_audit00001 already exists) | ok | card | NO |
| template.set | area | template | no (that template is someone else's (its owner or the GM changes) | ok | card | NO |
| template.delete | area | template | no (no tpl_audit00001 in this area) | ok | card | NO |
| template.clear | area | template | no (clearing every template is the GM's) | ok | card | NO |
| turn.start | area | turn | no (starting a fight is the GM's) | ok | card | yes |
| turn.next | area | turn | yes | ok | card | yes |
| turn.prev | area | turn | no (going back a turn is the GM's) | ok | card | yes |
| turn.end | area | turn | no (ending a fight is the GM's) | ok | card | yes |
| turn.order | area | turn | no (the turn order is the GM's) | ok | card | yes |
| turn.at | area | turn | no (the turn marker is the GM's) | ok | card | yes |
| turn.roll | area | turn | yes | ok | card | yes |
| turn.init | area | turn | yes | ok | card | yes |
| object.place | area | object | no | ok | card | yes |
| object.move | area | object | no | ok | card | yes |
| object.set | area | object | no | ok | card | yes |
| object.open | area | open | yes | ok | card | NO |
| object.light | area | open | yes | ok | card | NO |
| object.replace | area | object | no | ok | card | NO |
| stair.flip | area | object | - | skip: needs a stair (see the storeys tests) | card | - |
| object.delete | area | object | no | ok | card | yes |
| entity.flag | area | by args | no | ok | card | yes |
| water.set | area | object | no | ok | card | NO |
| water.remove | area | object | no | ok | card | NO |
| room.spawn | area | room | no | ok | card | yes |
| room.reroll | area | room | no (missing seed (int)) | REFUSED: missing seed (int) | card | - |
| room.tall | area | room | no | ok | card | yes |
| room.set | area | room | no | ok | card | yes |
| room.delete | area | room | no | ok | card | yes |
| room.move | area | room | no | ok | card | yes |
| room.rotate | area | room | no | ok | card | yes |
| edge.set | area | room | no | ok | card | NO |
| edge.reset | area | room | no | ok | card | NO |
| building.set | area | room | no | ok | card | yes |
| faction.set | area | room | no (outside this agent's scope (room on area_f89nq65t11)) | ok | card | NO |
| batch | area | per op | yes | ok | NO | yes |
| chat.say | area | chat | yes | ok | card | yes |
| dice.roll | area | chat | no (missing rolls (list)) | REFUSED: missing rolls (list) | card | - |
| entities.set | area | undo | - | skip: the undo machinery (quiet) | NO | - |
| undo | area | undo | yes | ok | card | yes |
| redo | area | undo | yes | ok | card | yes |
| area.create | campaign | area.admin | no | ok | NO | yes |
| area.visibility | campaign | area.admin | no | ok | card | yes |
| seat.create | campaign | by args | - | skip: agents never make seats (AGENTS_NEVER); a human does | NO | - |
| seat.revoke | campaign | by args | - | skip: agents never revoke seats (AGENTS_NEVER) | NO | - |
| seat.locate | campaign | by args | - | skip: agents never move people (AGENTS_NEVER) | NO | - |
| seat.set | campaign | by args | - | skip: agents never rename seats (AGENTS_NEVER) | NO | - |
| area.set | campaign | area.admin | no | ok | NO | yes |
| area.delete | campaign | area.admin | - | skip: would delete the fixture area (tested in areas.test.mjs) | NO | - |
| campaign.set | campaign | campaign.admin | no | ok | NO | yes |
| request.create | campaign | request | - | skip: agents never file requests (AGENTS_NEVER) | NO | - |
| request.resolve | campaign | campaign.admin | - | skip: needs a request (a person files it) | NO | - |
| transfer | campaign | transfer | no | ok | card | yes |
| travel | campaign | travel | no (no pawn tok_908ce6916350 in that area) | ok | card | yes |
| token.lend | area | pawn | yes | REFUSED: Brakka is not yours to lend | card | - |
| pawn.bring | area | pawn | - | skip: needs a player's pawn definition (a person defines it) | card | - |
| pawn.bench | area | pawn | - | skip: needs a brought pawn | card | - |
| pawn.define | campaign | pawn | no (that pawn belongs to someone else) | ok | NO | yes |
| pawn.forget | campaign | pawn | no (no such pawn pdef_audit0001) | ok | NO | yes |
| cast.save | campaign | token.edit | no | ok | NO | yes |
| cast.use | campaign | token.edit | no | ok | NO | NO |
| cast.forget | campaign | token.edit | no | ok | NO | yes |
| party.set | campaign | chat | yes | ok | NO | yes |

72 commands: 56 work over GET with the fixture, 52 explained, 42 visible in the AI's reads (of 56 that ran).
