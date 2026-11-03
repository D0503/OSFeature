import assert from "node:assert/strict"
import { readManifest } from "../scripts/lib/easygo-tools.mjs"

let cases = 0
const parses = (source, expected) => { assert.deepEqual(readManifest(source), expected, source); cases++ }
const value = (source, expected) => { assert.deepEqual(readManifest(`{value:${source}}`).value, expected, source); cases++ }
const rejects = (source, pattern) => { assert.throws(() => readManifest(source), pattern, source); cases++ }

for (const [source, expected] of [
  [String.raw`'\v'`, "\v"], [String.raw`'\0'`, "\0"],
  [String.raw`'\b\f\n\r\t'`, "\b\f\n\r\t"],
  [String.raw`'\'\"\\\/'`, "'\"\\/"],
  [String.raw`'\x41\u4E2D\uD83D\uDE00'`, "A中😀"],
  [String.raw`'\x5c\u005c'`, "\\\\"],
  [String.raw`'\q\A'`, "qA"], [String.raw`'C:\\workspace\\module'`, "C:\\workspace\\module"],
  ["'https://example.com/*literal*/'", "https://example.com/*literal*/"],
  ["'中文 { [ : , ] }'", "中文 { [ : , ] }"],
  ["'a\u2028b\u2029c'", "a\u2028b\u2029c"]
]) value(source, expected)

for (const newline of ["\n", "\r", "\r\n", "\u2028", "\u2029"]) {
  for (const quote of ["'", '"']) value(`${quote}first\\${newline}second${quote}`, "firstsecond")
  parses(`// comment${newline}42`, 42)
}
for (const quote of ["'", '"']) for (const newline of ["\n", "\r", "\r\n"]) rejects(`{value:${quote}first${newline}second${quote}}`, /Unescaped line break/)
for (const escape of ["\\1", "\\9", "\\01", "\\08", "\\00", "\\x0G", "\\x1", "\\u123", "\\uZZZZ", "\\u{41}"]) rejects(`{value:'${escape}'}`, /Invalid/)
rejects("{value:'unfinished\\", /Unterminated string escape/)
rejects("{value:'unfinished}", /Unterminated string/)

for (const [source, expected] of [
  ["0", 0], ["-0", -0], ["+20", 20], ["-20", -20],
  [".5", .5], ["-.5", -.5], ["+1.", 1], ["1.e2", 100], ["2.5e-2", .025],
  ["0x20", 32], ["+0Xff", 255], ["-0x20", -32], ["-0x0", -0],
  ["true", true], ["false", false], ["null", null]
]) value(source, expected)
for (const source of ["01", "00", "-01", "+01", "1e", "1e+", "0x", "0xGG", "0x1.2", "+", "--1", "truefalse", "undefined", "Infinity", "NaN", "1e400"]) rejects(`{value:${source}}`, /Unsupported|Expected/)

const nested = readManifest(`/* prefix */ {module: {
  name: 'entry', requestPermissions: [{name:'p', usedScene:{abilities:['A',], when:'inuse',},},],
  object: {}, array: [], text:'not // a comment /* either */',
},} // suffix`)
assert.equal(nested.module.requestPermissions[0].usedScene.abilities[0], "A")
assert.equal(nested.module.text, "not // a comment /* either */")
assert.equal(Object.getPrototypeOf(nested.module), null)
cases++
let deep = "0"
for (let i = 0; i < 100; i++) deep = `{child:[${deep},],}`
let result = readManifest(deep)
for (let i = 0; i < 100; i++) result = result.child[0]
assert.equal(result, 0)
cases++
for (const source of ["{", "[", "{a:}", "{a:1 b:2}", "[1 2]", "[1,,2]", "{a:1,,}", "{a:[1,2}", "/* unfinished", "{} trailing", "{} {}", "{a: process.exit()}", "{a: (()=>1)()}", "{a:`template`}", "{a:1+2}", "{非ASCII:1}"]) rejects(source, /Unterminated|Unsupported|Expected|Unexpected/)
for (const source of ["{a:1,a:2}", String.raw`{a:1,'\u0061':2}`, "{outer:{a:1,a:2}}"]) rejects(source, /Duplicate/)
const prototype = readManifest("{__proto__:{polluted:true},constructor:'data'}")
assert.equal(Object.getPrototypeOf(prototype), null)
assert.equal(prototype.__proto__.polluted, true)
assert.equal({}.polluted, undefined)
cases++
for (const sample of [{ a: [true, false, null, 1, -2.5, { text: "换行\n引号\"反斜杠\\" }] }, [[], {}, "😀", 0]]) {
  assert.deepEqual(JSON.parse(JSON.stringify(readManifest(JSON.stringify(sample)))), sample)
  cases++
}
console.log(`Manifest parser tests passed: ${cases} cases`)
