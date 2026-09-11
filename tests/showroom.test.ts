import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SHOWROOM_ASSETS } from '../app/showroom-model';
import { VEHICLES } from '../app/vehicles';
test('every selectable replacement has an intact attributed compressed asset and paint mapping', () => {
  const manifest = JSON.parse(
    readFileSync('public/models/showroom/manifest.json', 'utf8'),
  );
  for (const v of VEHICLES.filter((v) => v.id !== 'ferrari')) {
    const entry = manifest.find((a: any) => a.id === v.id);
    assert.ok(entry);
    const b = readFileSync(`public/models/showroom/${entry.file}`);
    assert.equal(b.toString('ascii', 0, 4), 'glTF');
    assert.equal(b.length, b.readUInt32LE(8));
    assert.equal(createHash('sha256').update(b).digest('hex'), entry.sha256);
    const doc = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
    assert.equal(doc.asset.extras.source, entry.source);
    assert.ok(entry.license.startsWith('CC-BY'));
    assert.ok(doc.meshes.length > 0);
    assert.ok(b.length < 5_000_000);
    assert.ok(SHOWROOM_ASSETS[v.id].paint.length);
    for (const name of SHOWROOM_ASSETS[v.id].paint)
      assert.ok(
        doc.materials.some((m: any) => m.name === name),
        `${v.id}: ${name}`,
      );
  }
  assert.equal(manifest.length, 9);
});
