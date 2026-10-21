// Friendly defaults only: these names are not credentials or wallet mnemonics.
import { BIP39_ENGLISH } from './bip39-english.js';

// Avoid insulting or unpleasant automatic titles. Keep the upstream list intact.
export const TITLE_EXCLUSIONS = Object.freeze([
  'abuse', 'addict', 'crack', 'crime', 'cruel', 'dumb', 'fatal',
  'insane', 'naive', 'nasty', 'neglect', 'ugly', 'useless',
]);
const excluded = new Set(TITLE_EXCLUSIONS);
const words = BIP39_ENGLISH.filter(word => !excluded.has(word));
const title = word => word[0].toUpperCase() + word.slice(1);
const format = (a, b) => `The ${title(words[a])} ${title(words[b])} Campaign`;

// Drawing the second index from n-1 choices avoids repeats without retry loops.
// A dice click passes its current value, guaranteeing a visible change even if
// the random source repeats (or a test supplies a constant source).
export function campaignName(previous = '', random = Math.random) {
  const a = Math.floor(random() * words.length);
  let b = Math.floor(random() * (words.length - 1));
  if (b >= a) b++;
  if (format(a, b) === previous) {
    b = (b + 1) % words.length;
    if (b === a) b = (b + 1) % words.length;
  }
  return format(a, b);
}
