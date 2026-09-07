const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const nativeRoot = path.resolve(__dirname, '../src-tauri');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(nativeRoot, file), 'utf8'));
const app = readJson('gen/schemas/acl-manifests.json')['__app-acl__'];
assert.ok(app, 'Build the Rust crate first to generate its command ACL');
const source = fs.readFileSync(path.join(nativeRoot, 'src/lib.rs'), 'utf8');
const handler = source.split('tauri::generate_handler![')[1].split('])')[0];
const registered = [...handler.matchAll(/commands::(?:\w+::)*(\w+),/g)].map((match) => match[1]);
const main = app.permissions['main-commands'].commands.allow;
assert.deepEqual(
  [...main].sort(),
  registered.sort(),
  'Every registered command needs an explicit main-window grant',
);

for (const [file, label, role] of [
  ['default.json', 'main', 'main-commands'],
  ['mini-player.json', 'mini', 'mini-commands'],
  ['mini-confirm.json', 'mini-confirm', 'confirmation-commands'],
]) {
  const capability = readJson(`capabilities/${file}`);
  assert.deepEqual(capability.windows, [label]);
  const grants = capability.permissions.filter(
    (permission) => typeof permission === 'string' && permission in app.permissions,
  );
  assert.deepEqual(grants, [role], 'Each window must retain its own command group');
  if (label !== 'main') {
    assert.ok(
      !app.permissions[role].commands.allow.some((command) =>
        /library|metadata|cover|tracks|playback/.test(command),
      ),
      'Auxiliary windows must not receive file commands',
    );
  }
}
console.log(
  `Compiled command ACL verified: ${main.length} main commands and separate auxiliary grants.`,
);
