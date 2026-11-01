# a fresh demo table on DEV (Fauna's own throwaway, never Harry's campaign): room, Lola (Sam's, unlinked), two goblins, a fight
try: ctx2.close()
except Exception: pass
ctx2 = b.new_context(viewport={'width': 1280, 'height': 820}); pg2 = ctx2.new_page()
pg2.goto('https://dev.turnipworks.net/?nointro')
pg2.wait_for_selector('#newCampaign input[name=gm]', timeout=60000)
pg2.fill('#newCampaign input[name=gm]', 'GM'); pg2.fill('#newCampaign input[name=name]', 'The Goblin Cellar (Beyond20 demo)')
pg2.click('#newCampaign button')
pg2.wait_for_function('window.tw?.ready?.() && tw.fog && tw.dice && tw.b20', timeout=120000)
pg2.evaluate('tw.spawnRoom("common", 0, 0, 7, 5, 7711)')
pg2.wait_for_function('tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0', timeout=120000)
seat = pg2.evaluate("async () => { const s = await tw.createSeat({kind:'human',role:'player',name:'Sam',color:'#67aadd'}); return { id: s.id, link: tw.inviteLink(s) }; }")
inv = seat['link']; sam = None; assert len(inv) > 70, 'short invite'
open('/tmp/scratch/ddb/invite.url', 'w').write(inv)
toks = pg2.evaluate("Object.values(tw.entities()).filter(e=>e.kind==='token').map(e=>e.id)")
cmds = [{'type': 'token.delete', 'args': {'id': t}} for t in toks] + [
 {'type':'token.create','args':{'id':'tok_lolajani01','name':'Lola Jani','x':10,'z':12.5,'owner':sam,'main':True,'fig':'hero-fighter-human-f','color':'#67aadd'}},
 {'type':'token.create','args':{'id':'tok_goblin0001','name':'Goblin 1','x':22.5,'z':10,'fig':'foe-goblin-spear'}},
 {'type':'token.create','args':{'id':'tok_goblin0002','name':'Goblin 2','x':25,'z':17.5,'fig':'foe-goblin-club'}}]
pg2.evaluate('(c) => tw.batch(c)', cmds); time.sleep(2)
pg2.evaluate("tw.registry.run('turn.start')"); time.sleep(2)
print('campaign', pg2.evaluate("tw.sync.campaign.id"), 'sam', sam, 'turns', pg2.evaluate("JSON.stringify(tw.view().turns)"))
print(pg2.evaluate("Object.values(tw.entities()).filter(e=>e.kind==='token').map(e=>[e.id,e.name,e.owner])"))
gmpg = pg2
