// Capability tokens: base64url(claims) + '.' + base64url(HMAC-SHA256(secret, claims)).
// claims = { c: campaign, s: seat, cr: creator (null for humans the system or GM made), sc: scope (LLM) or role (human) }
// A token is minted deterministically from the seat record, so it can be re-issued (invite links) without storage.
// It is not a session: the relay re-checks the seat on every use, so revocation is instant and cascades
// (core/perms.js liveSeat), and a token whose claims no longer match the seat record is refused.
import crypto from 'node:crypto';
import { stableStringify } from '../core/hash.js';
import { migrateClaims } from '../core/migrate.js';

const b64 = (buf) => Buffer.from(buf).toString('base64url');

export function makeTokens(secret) {
  const mac = (s) => b64(crypto.createHmac('sha256', secret).update(s).digest());
  function claimsFor(campaignId, seat) {
    return { c: campaignId, s: seat.id, cr: seat.creator || null, sc: seat.kind === 'llm' ? seat.scope : seat.role };
  }
  return {
    claimsFor,
    mint(campaignId, seat) {
      const body = b64(stableStringify(claimsFor(campaignId, seat)));
      return `${body}.${mac(body)}`;
    },
    // returns claims or null; constant-time signature compare
    verify(token) {
      if (typeof token !== 'string' || token.length > 2000) return null;
      const [body, sig] = token.split('.');
      if (!body || !sig) return null;
      const want = Buffer.from(mac(body)), got = Buffer.from(sig);
      if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
      try { return JSON.parse(Buffer.from(body, 'base64url').toString()); } catch { return null; }
    },
    // THE SHORT FORM (2026-10-20, for chat-window LLMs: a small model copying a 200-character token into every address
    // got it wrong in a live trial, experiments/2026-10-20-llm-api/): `<seat id>.<22 characters of the MAC of the full
    // token's claims>`. It names no campaign, so it is only good on a /c/<campaign>/... path, checked against that
    // campaign's seat record as it is NOW: a changed scope or role, or another campaign, gives another MAC, exactly as
    // the full token's `matches` does. 22 base64url characters are 132 bits of the HMAC.
    short(campaignId, seat) { return `${seat.id}.${mac('short|' + b64(stableStringify(claimsFor(campaignId, seat)))).slice(0, 22)}`; },
    verifyShort(token, campaignId, seatsOf) {
      const m = typeof token === 'string' && token.match(/^([a-z]{2,8}_[0-9a-z]{4,24})\.([A-Za-z0-9_-]{22})$/);
      const seat = m && campaignId && seatsOf(campaignId)?.[m[1]];
      if (!seat) return null;
      const want = Buffer.from(this.short(campaignId, seat)), got = Buffer.from(token);
      return want.length === got.length && crypto.timingSafeEqual(want, got) ? claimsFor(campaignId, seat) : null;
    },
    // do the claims still describe this seat exactly?
    matches(claims, campaignId, seat) {
      // a token minted before the table → area rename says `tables` in an LLM scope; it still describes the same seat
      return !!seat && (stableStringify(claims) === stableStringify(claimsFor(campaignId, seat)) || stableStringify(migrateClaims(claims)) === stableStringify(claimsFor(campaignId, seat)));
    },
  };
}
