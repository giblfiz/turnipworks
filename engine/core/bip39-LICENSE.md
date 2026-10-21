# BIP-39 English word list

`bip39-english.js` contains the complete, unchanged 2,048-word English list from
[bitcoin/bips, bip-0039/english.txt](https://github.com/bitcoin/bips/blob/ce1862ac6bcffa1dd20aad858380e51e66e949ea/bip-0039/english.txt).
Retrieved 2026-10-13; last source-file commit `ce1862ac6bcffa1dd20aad858380e51e66e949ea`.
Original text SHA-256: `2f5eed53a4727b4bf8880d8f3f199efc90e58503646d9ff8eff3a2ed3b24dbda`.
Only an ES module wrapper was added so browsers and the relay use the same data.

[BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) explicitly
declares **MIT** in its License header and Copyright section. Its listed authors
are Marek Palatinus, Pavol Rusnak, Aaron Voisine and Sean Bowe. The word-list file
has no separate copyright notice. The MIT terms are reproduced below.

The generator excludes these 13 words from automatic titles: **abuse, addict,
crack, crime, cruel, dumb, fatal, insane, naive, nasty, neglect, ugly, useless**.
They can read as insults or unpleasant accidental titles. The vendored list itself
is unchanged. Names use two distinct remaining words and are not credentials.

## MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
