#!/usr/bin/env python3
"""Read-only browser decode of the live manifest and all unique primary variants."""
import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright
B=Path(__file__).resolve().parents[1]
BASE='https://implausible.enterprises/projects/turnip-works/tuner/assets/ui-icons/'
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,args=['--no-sandbox'])
  try:
   page=await browser.new_page(viewport={'width':1400,'height':1000},device_scale_factor=1)
   response=await page.goto(BASE+'manifest.json',wait_until='domcontentloaded')
   assert response.status==200
   await page.set_content('<body style="background:#1c1f24;color:#eee8da;font:12px sans-serif"><h1>Turnip Works — live delivered images at 31px</h1><main style="display:grid;grid-template-columns:repeat(6,1fr);gap:16px"></main></body>')
   result=await page.evaluate('''async (base) => {
    const m=await (await fetch(base+'manifest.json')).json();
    const variants=[...new Map(Object.values(m.actions).flatMap(a=>a.variants).map(v=>[v.file,v])).values()];
    const results=await Promise.all(variants.map(async v=>{
      const img=new Image(); img.src=new URL(v.file,base); await img.decode();
      if(img.naturalWidth!==128||img.naturalHeight!==128)throw Error('wrong base size '+v.file);
      const small=new Image();small.src=new URL(v.sizes['31'],base);await small.decode();
      if(small.naturalWidth!==31||small.naturalHeight!==31)throw Error('wrong small size '+v.file);
      const card=document.createElement('div');card.style='height:76px;display:flex;gap:8px;align-items:center';
      card.append(small,document.createTextNode(v.file));document.querySelector('main').append(card);
      return {file:v.file,base:img.naturalWidth,small:small.naturalWidth,ok:true};
    }));return {actions:Object.keys(m.actions).length,sets:m.sets.length,variants:results};
   }''',BASE)
   await page.screenshot(path=str(B/'validation/browser-live-31.png'),full_page=True)
   (B/'validation/browser-live.json').write_text(json.dumps(result,indent=2)+'\n')
   print(f"Browser decoded {len(result['variants'])} base+31px pairs across {result['actions']} manifest entries",flush=True)
  finally:await browser.close()
asyncio.run(main())
