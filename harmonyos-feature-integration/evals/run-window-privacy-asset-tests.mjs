import assert from "node:assert/strict"
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

// Node 22.7+ transforms TypeScript in the copied asset; no package is installed.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const work = await mkdtemp(join(tmpdir(), "anti-peep-asset-tests-"))
const source = await readFile(join(root, "references/features/dlp-anti-peep/assets/AntiPeepSession.ets"), "utf8")
await writeFile(join(work, "session.ts"), source.replace(/^import .*;\r?\n/gm, "") + "\n")
await writeFile(join(work, "session.ts"), "import { dlpAntiPeep, deviceInfo } from './mock.mjs';\n" + await readFile(join(work, "session.ts"), "utf8"))
await writeFile(join(work, "mock.mjs"), `
export const deviceInfo = { sdkApiVersion: 26 };
export const state = { opened: true, status: 0, query: null, infoError: false, onError: false, offError: false, mask: null, calls: [], listeners: new Set() };
export const dlpAntiPeep = {
  DlpAntiPeepStatus: { PASS: 0, HIDE: 1 },
  async isDlpAntiPeepSwitchOn() { if (state.query) return state.query(); return state.opened; },
  getDlpAntiPeepInfo() { if (state.infoError) throw Error('query failed'); return state.status; },
  on(type, callback) { if (state.onError) throw Error('on failed'); state.listeners.add(callback); },
  off(type, callback) { if (state.offError) throw Error('off failed'); state.listeners.delete(callback); },
  async setAntiPeepMaskLayer(id) { state.calls.push(id); if (state.mask) return state.mask(id); }
};
export function emit(status) { state.status = status; for (const cb of state.listeners) cb(status); }
export function reset() { Object.assign(state, { opened:true, status:0, query:null, infoError:false, onError:false, offError:false, mask:null, calls:[], listeners:new Set() }); deviceInfo.sdkApiVersion=26; }
`)
await writeFile(join(work, "test.mjs"), `
import assert from 'node:assert/strict';
import { AntiPeepSession } from './session.ts';
import { state, reset, emit, deviceInfo } from './mock.mjs';
globalThis.canIUse = () => true;
const tick = async () => { for(let i=0;i<10;i++) await Promise.resolve(); };
let observations=[];
const create=(mask=true)=>new AntiPeepSession(mask, value=>observations.push(value));
const last=()=>observations.at(-1);

reset(); let s=create(); state.opened=false; await s.start();
assert.equal(last().state,'unknown'); assert.equal(last().maskApplied,false); assert.equal(state.listeners.size,0);
reset(); s=create(); state.query=()=>Promise.reject(Error('switch failed')); await s.start();
assert.equal(last().state,'unknown'); assert.match(last().error,/switch failed/);
reset(); s=create(); state.infoError=true; await s.start(); assert.equal(last().state,'unknown');
s.stop(); assert.equal(state.listeners.size,0);
reset(); s=create(); state.onError=true; await s.start(); assert.equal(last().state,'unknown'); assert.equal(state.listeners.size,0);
reset(); s=create(); deviceInfo.sdkApiVersion=20; await s.start(); assert.equal(state.listeners.size,0);
reset(); s=create(false); deviceInfo.sdkApiVersion=20; state.status=1; await s.start();
assert.equal(last().state,'hide'); assert.deepEqual(state.calls,[]); s.stop();

reset(); s=create(); s.setTargetWindow(10); await s.start(); emit(1); emit(1); await tick();
assert.deepEqual(state.calls,[10]); assert.equal(last().maskApplied,true);
emit(0); assert.equal(last().state,'pass'); assert.equal(last().maskApplied,false);
emit(1); await tick(); assert.deepEqual(state.calls,[10,10]);
s.setTargetWindow(undefined); emit(1); await tick(); assert.deepEqual(state.calls,[10,10]);
assert.equal(last().maskApplied,false); s.stop(); assert.equal(last().state,'unknown'); assert.equal(state.listeners.size,0);
await s.start(); emit(1); await tick(); assert.deepEqual(state.calls,[10,10]); s.stop();

reset(); s=create(); s.setTargetWindow(11); state.mask=()=>Promise.reject(Error('mask failed'));
await s.start(); emit(1); await tick(); assert.equal(last().maskApplied,false); assert.match(last().error,/mask failed/);
emit(1); await tick(); assert.deepEqual(state.calls,[11]); s.stop();

reset(); s=create(); let finish; state.query=()=>new Promise(resolve=>finish=resolve);
const starting=s.start(); s.stop(); finish(true); await starting;
assert.equal(state.listeners.size,0); assert.equal(last().state,'unknown');

reset(); s=create(); s.setTargetWindow(12); let resolveMask;
state.mask=()=>new Promise(resolve=>resolveMask=resolve); await s.start(); emit(1);
s.setTargetWindow(undefined); s.stop(); resolveMask(); await tick();
assert.equal(last().maskApplied,false); assert.equal(last().state,'unknown'); assert.deepEqual(state.calls,[12]);

reset(); s=create(); s.setTargetWindow(13); let first;
state.mask=id=>id===13?new Promise(resolve=>first=resolve):Promise.resolve();
await s.start(); emit(1); s.setTargetWindow(14); first(); await tick();
assert.deepEqual(state.calls,[13,14]); assert.equal(last().maskApplied,true); s.stop();

reset(); const a=create(false),b=create(false); await a.start(); await b.start();
assert.equal(state.listeners.size,2); a.stop(); assert.equal(state.listeners.size,1);
emit(1); assert.equal(last().state,'hide'); state.offError=true; assert.throws(()=>b.stop(),/off failed/);
assert.equal(last().state,'unknown'); state.offError=false; b.stop(); assert.equal(state.listeners.size,0);
reset(); s=create(); s.setTargetWindow(0); await s.start(); emit(1); await tick(); assert.deepEqual(state.calls,[]); s.stop();
console.log(JSON.stringify({status:'passed',asset:'AntiPeepSession.ets'}));
`)
const result = spawnSync(process.execPath, ["--experimental-transform-types", join(work, "test.mjs")], { encoding: "utf8" })
assert.equal(result.status, 0, result.stdout + result.stderr)
process.stdout.write(result.stdout)
