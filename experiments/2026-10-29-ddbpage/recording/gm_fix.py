S = gmpg.evaluate("tw.sync.campaign.seats"); sam = [s['id'] for s in S if s['name'] == 'Sam'][0]
gmpg.evaluate("tw.registry.run('turn.end')"); time.sleep(1)
gmpg.evaluate('(c) => tw.batch(c)', [{'type': 'token.owner', 'args': {'id': 'tok_lolajani01', 'owner': sam}}, {'type': 'token.set', 'args': {'id': 'tok_lolajani01', 'main': True}}]); time.sleep(1.5)
gmpg.evaluate("tw.registry.run('turn.start')"); time.sleep(2)
print(gmpg.evaluate("tw.sync.campaign.id"), gmpg.evaluate("JSON.stringify(tw.view().turns)"), gmpg.evaluate("Object.values(tw.entities()).filter(e=>e.kind==='token').map(e=>[e.id,e.owner,e.main,e.sheet||null])"))
# a lit table with no fog of war, as a GM would run a demo fight (a die is drawn only where the player can see)
gmpg.evaluate("tw.registry.run('area.light.day')"); time.sleep(1); gmpg.evaluate("tw.registry.run('area.fogOfWar.off')"); time.sleep(1.5)
print('area settings', gmpg.evaluate("JSON.stringify(tw.sync.campaign.areas.map(a => a.settings))"))
