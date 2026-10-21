Rules card (GM's AI seat, every class): 9265 characters, 903 words; with its 9 help pages 37302 characters.
Rules card (a player's AI seat): 6811 characters, 681 words.

| command | level | class | player's AI | GET (GM's AI) | explained (card / help) | AI read shows it |
|---|---|---|---|---|---|---|
| fog.explore | area | pawn | - | skip: the browser sends the cells its pawns see (a raster); an AI seat has no eyes to explore with | NO | - |
| fog.reveal | area | room | - | skip: the browser sends a raster of explored cells (the GM's "Reveal explored here") | NO | - |
| fog.reset | campaign | campaign.admin | no | ok | help | NO |
| token.create | area | token.edit | no | ok | card | yes |
| token.move | area | token.move | no (Goblin, club belongs to someone else) | ok | card | yes |
| token.set | area | pawn | no (Goblin, club belongs to someone else) | ok | card | yes |
| token.damage | area | pawn | yes | ok | card | yes |
| token.mark | area | pawn | yes | ok | help | yes |
| token.owner | area | token.edit | no | ok | help | yes |
| token.delete | area | token.edit | no | ok | help | yes |
| template.place | area | template | no (id tpl_audit00001 already exists) | ok | help | yes |
| template.set | area | template | no (that template is someone else's (its owner or the GM changes) | ok | help | yes |
| template.delete | area | template | no (no tpl_audit00001 in this area) | ok | help | yes |
| template.clear | area | template | no (clearing every template is the GM's) | ok | help | yes |
| turn.start | area | turn | no (starting a fight is the GM's) | ok | help | yes |
| turn.next | area | turn | yes | ok | help | yes |
| turn.prev | area | turn | no (going back a turn is the GM's) | ok | help | yes |
| turn.end | area | turn | no (ending a fight is the GM's) | ok | help | yes |
| turn.order | area | turn | no (the turn order is the GM's) | ok | help | yes |
| turn.at | area | turn | no (the turn marker is the GM's) | ok | help | yes |
| turn.roll | area | turn | yes | ok | card | yes |
| turn.init | area | turn | yes | ok | help | yes |
| object.place | area | object | no | ok | help | yes |
| object.move | area | object | no | ok | help | yes |
| object.set | area | object | no | ok | help | yes |
| object.open | area | open | yes | ok | card | yes |
| object.light | area | open | yes | ok | card | yes |
| object.replace | area | object | no | ok | help | yes |
| stair.flip | area | object | - | skip: needs a stair (see the storeys tests) | help | - |
| object.delete | area | object | no | ok | help | yes |
| entity.flag | area | by args | no | ok | card | yes |
| water.set | area | object | no | ok | help | yes |
| water.remove | area | object | no | ok | help | yes |
| room.spawn | area | room | no | ok | card | yes |
| room.reroll | area | room | no (missing seed (int)) | ok | help | yes |
| room.tall | area | room | no | ok | help | yes |
| room.set | area | room | no | ok | card | yes |
| room.delete | area | room | no | ok | help | yes |
| room.move | area | room | no | ok | help | yes |
| room.rotate | area | room | no | ok | help | yes |
| edge.set | area | room | no | ok | help | yes |
| edge.reset | area | room | no | ok | help | yes |
| building.set | area | room | no | ok | help | yes |
| faction.set | area | room | no (outside this agent's scope (room on area_8mrc6mmcqo)) | ok | help | yes |
| batch | area | per op | yes | ok | NO | yes |
| chat.say | area | chat | yes | ok | card | yes |
| dice.roll | area | chat | yes | ok | card | yes |
| entities.set | area | undo | - | skip: the undo machinery (quiet) | NO | - |
| undo | area | undo | yes | ok | card | yes |
| redo | area | undo | yes | ok | help | yes |
| area.create | campaign | area.admin | no | ok | help | yes |
| area.visibility | campaign | area.admin | no | ok | card | yes |
| seat.create | campaign | by args | - | skip: agents never make seats (AGENTS_NEVER); a human does | NO | - |
| seat.revoke | campaign | by args | - | skip: agents never revoke seats (AGENTS_NEVER) | NO | - |
| seat.locate | campaign | by args | - | skip: agents never move people (AGENTS_NEVER) | NO | - |
| seat.set | campaign | by args | - | skip: agents never rename seats (AGENTS_NEVER) | NO | - |
| area.set | campaign | area.admin | no | ok | help | yes |
| area.delete | campaign | area.admin | - | skip: would delete the fixture area (tested in areas.test.mjs) | help | - |
| campaign.set | campaign | campaign.admin | no | ok | help | yes |
| request.create | campaign | request | - | skip: agents never file requests (AGENTS_NEVER) | NO | - |
| request.resolve | campaign | campaign.admin | - | skip: needs a request (a person files it) | help | - |
| transfer | campaign | transfer | no | ok | card | yes |
| travel | campaign | travel | no (no pawn tok_2f1ad5ca7134 in that area) | ok | card | yes |
| token.lend | area | pawn | yes | REFUSED: Brakka is not yours to lend | help | - |
| pawn.bring | area | pawn | - | skip: needs a player's pawn definition (a person defines it) | help | - |
| pawn.bench | area | pawn | - | skip: needs a brought pawn | help | - |
| pawn.define | campaign | pawn | no (that pawn belongs to someone else) | ok | help | yes |
| pawn.forget | campaign | pawn | no (no such pawn pdef_audit0001) | ok | help | yes |
| cast.save | campaign | token.edit | no | ok | help | yes |
| cast.use | campaign | token.edit | no | ok | help | NO |
| cast.forget | campaign | token.edit | no | ok | help | yes |
| party.set | campaign | chat | yes | ok | help | yes |

72 commands: 58 work over GET with the fixture, 63 explained, 56 visible in the AI's reads (of 58 that ran).
