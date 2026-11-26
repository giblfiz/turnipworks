// UPLOADED MODELS: what the relay and the browser share (2026-11-06; docs/UPLOADS.md; the relay side is relay/uploads.js,
// the converter relay/upload-worker/, the browser client/uploads.js, safe harbour relay/dmca.js and docs/legal/).
import { UPLOAD_ID_RE } from './commands.js';
export { UPLOAD_ID_RE };

// THE ATTESTATION a GM gives with every upload, recorded with it (version, the exact words' hash, who, when). The words
// are a DRAFT for Harry and counsel (docs/legal/UPLOAD_TERMS.md); a new wording gets a new version, and the relay takes
// only the current one, so every record says exactly which words were agreed to.
// (b: 2026-11-06, after the adversarial review: 'I own this model' read as owning a purchased COPY; the words now say rights.)
export const ATTEST_VERSION = 'upload-attest-draft-2026-11-06b';
export const ATTEST_TEXT = 'I hold the rights to this model, or its rights holder has allowed me to upload it to an online service, have it converted, and show it to the people in this campaign. (Buying a model, or a copy of it, does not by itself give that right.) I have read the upload terms and the copyright policy, and I understand that a model can be removed after a copyright notice and that repeat infringers lose the ability to upload.';

// PUBLIC SHARING of uploads (a share link, or a library, that carries an uploaded mesh to other campaigns) is OFF. The
// relay turns it on only when its environment says TW_UPLOAD_PUBLIC=1 AND the safe-harbour record is complete and says
// counsel has reviewed it (relay/dmca.js publicSharing). Until then an uploaded thing in a shared build travels as a
// plain box with its name (core/share.js never carries `upload`). Nothing reads the flag as ON yet: no public path is built.
export const PUBLIC_FLAG = 'TW_UPLOAD_PUBLIC';
// uploads themselves: on by default on a dev relay (TW_UPLOADS=0 turns them off); on a prod relay only with TW_UPLOADS=1 AND
// the hosting record (a registered designated agent, the policy and terms published, a working notice address: relay/dmca.js
// hostingReady). docs/UPLOADS.md "Where it is on"
export const UPLOADS_FLAG = 'TW_UPLOADS';

// the tier a Graphics detail draws (the library's faces dial: 10000 / 5000 / 1500)
export const tierFor = (faces) => { const f = Number(faces) || 10000; return f >= 10000 ? 't0' : f >= 5000 ? 't1' : 't2'; };
export const TIER_NAMES = ['t0', 't1', 't2'];

// a GM's height for a model, feet: what the upload window takes (a mouse is 0.25 ft, a dragon 60)
export const HEIGHT_MIN = 0.1, HEIGHT_MAX = 200;
export const heightProblem = (h) => Number.isFinite(h) && h >= HEIGHT_MIN && h <= HEIGHT_MAX ? null : `a height in feet from ${HEIGHT_MIN} to ${HEIGHT_MAX}`;
// an upload's name: plain words (it is shown in menus and labels, always escaped, and never a link)
export const NAME_MAX = 60;
export const cleanName = (s) => String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);

// the thing's box from the model's own box (the longest side 1, as the converter leaves it) and the GM's height in feet,
// turned by `yaw` quarter turns (its front): the s (uniform scale) and dims an object.place carries
export function sizeOf(bounds, height, yawDeg = 0) {
  const [w, h, d] = bounds, k = height / (h || 1), q = ((Math.round(yawDeg / 90) % 2) + 2) % 2;
  const r = (x) => Math.round(x * 1000) / 1000;
  return { s: [r(k), r(k), r(k)], dims: q ? [r(d * k), r(h * k), r(w * k)] : [r(w * k), r(h * k), r(d * k)] };
}
