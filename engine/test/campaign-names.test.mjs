// node --test engine/test/campaign-names.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BIP39_ENGLISH } from '../core/bip39-english.js';
import { campaignName, TITLE_EXCLUSIONS } from '../core/campaign-names.js';
import { startRelay } from '../relay/server.js';

const pattern = /^The ([A-Z][a-z]+) ([A-Z][a-z]+) Campaign$/;
const allowed = BIP39_ENGLISH.filter(w => !TITLE_EXCLUSIONS.includes(w));

test('vendored data is the complete upstream English list, byte for byte', () => {
  assert.equal(BIP39_ENGLISH.length, 2048);
  assert.equal(new Set(BIP39_ENGLISH).size, 2048);
  assert.equal(createHash('sha256').update(BIP39_ENGLISH.join('\n') + '\n').digest('hex'),
    '2f5eed53a4727b4bf8880d8f3f199efc90e58503646d9ff8eff3a2ed3b24dbda');
});

test('every eligible first word yields two distinct title-cased BIP-39 words', () => {
  for (let i = 0; i < allowed.length; i++) {
    const name = campaignName('', () => (i + 0.5) / allowed.length);
    const parts = name.match(pattern);
    assert.ok(parts, name);
    assert.notEqual(parts[1], parts[2]);
    assert.equal(parts[1].toLowerCase(), allowed[i]);
    assert.ok(allowed.includes(parts[2].toLowerCase()));
  }
});

test('all exclusions are upstream words and cannot appear in generated titles', () => {
  for (const word of TITLE_EXCLUSIONS) assert.ok(BIP39_ENGLISH.includes(word));
  for (const value of [0, 0.5, 1 - Number.EPSILON]) {
    const parts = campaignName('', () => value).match(pattern);
    for (const part of parts.slice(1)) assert.ok(!TITLE_EXCLUSIONS.includes(part.toLowerCase()));
  }
});

test('dice changes an identical draw without a retry loop, at either end of the list', () => {
  for (const value of [0, 1 - Number.EPSILON]) {
    const random = () => value;
    const original = campaignName('', random), rerolled = campaignName(original, random);
    assert.notEqual(rerolled, original);
    const parts = rerolled.match(pattern);
    assert.ok(parts);
    assert.notEqual(parts[1], parts[2]);
  }
});

test('relay API defaults omitted, empty and blank names; preserves explicit throwaway names', async () => {
  // Isolated data, no live campaigns; the directory and all campaigns are removed even on failure.
  const dataDir = mkdtempSync(join(tmpdir(), 'tw-campaign-names-'));
  let relay;
  try {
    relay = await startRelay({ port: 0, dataDir, tunerDir: join(dataDir, 'no-tuner'), log: () => {} });
    for (const supplied of [undefined, '', '   ', 'TEST names (throwaway)']) {
      const r = await fetch(`http://127.0.0.1:${relay.port}/campaigns`, {
        method: 'POST', body: JSON.stringify({ name: supplied, gm: 'Test GM' }),
      });
      assert.equal(r.status, 200);
      const result = await r.json();
      assert.ok(result.ok);
      const name = relay.campaigns.get(result.campaign).state.name;
      if (supplied?.trim()) assert.equal(name, supplied);
      else assert.match(name, pattern);
    }
  } finally {
    await relay?.close();
    rmSync(dataDir, { recursive: true, force: true });
  }
});
