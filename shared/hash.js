// One tiny, dependency-free hash used everywhere so the browser and the Node
// scripts agree byte-for-byte:
//   - image ids / filenames:  hashBytes(fileContents)
//   - manifest answer tokens: answerToken(id, slug)
//
// cyrb53 (public domain, bryc). Not cryptographic — it only keeps answers out
// of URLs, the DOM and casual devtools browsing. See README "Spoiler model".

/**
 * @param {Uint8Array} bytes
 * @param {number} [seed]
 * @returns {string} 16 lowercase hex chars
 */
export function hashBytes(bytes, seed = 0) {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    h1 = Math.imul(h1 ^ b, 2654435761);
    h2 = Math.imul(h2 ^ b, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

/** @param {string} s */
export function hashString(s) {
  return hashBytes(new TextEncoder().encode(s));
}

/** Short id used for public/maps/<id>.<ext>. */
export function imageId(/** @type {Uint8Array} */ bytes) {
  return hashBytes(bytes).slice(-8);
}

/**
 * The token stored in manifest.json instead of the plain slug. A guess is
 * correct iff answerToken(entry.id, guessSlug) === entry.slug.
 * @param {string} id
 * @param {string} slug
 */
export function answerToken(id, slug) {
  return hashString(`zombles:${id}:${slug}`).slice(-10);
}
