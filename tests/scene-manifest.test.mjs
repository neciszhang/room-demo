import assert from 'node:assert/strict';
import fs from 'node:fs';
import {prepareManifest} from '../src/scene-runtime/manifest.js';
for (const id of ['original-room', 'star-reading']) {
  const raw=JSON.parse(fs.readFileSync(`public/${id}/scene.manifest.json`));
  const config=prepareManifest(raw, `https://example.test/room-demo/${id}/scene.manifest.json`);
  assert(config.model.url.startsWith('https://example.test/room-demo/'));
  assert(config.assets.every(a=>a.thumbnail.startsWith('https://example.test/room-demo/')));
  const reordered=structuredClone(raw);reordered.assets[0].order=999;
  assert.equal(prepareManifest(reordered,`https://example.test/${id}/scene.manifest.json`).assets.at(-1).id,raw.assets[0].id);
  const duplicate=structuredClone(raw);duplicate.assets[1].id=duplicate.assets[0].id;
  assert.throws(()=>prepareManifest(duplicate,'https://example.test/scene.json'),/ID 重复/);
}
console.log('PASS: both material profiles, base-relative URLs, order-independent IDs, duplicate ID rejection');
