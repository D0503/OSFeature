import { readFile, realpath } from "node:fs/promises"
import { basename, isAbsolute, join, relative, resolve } from "node:path"
import { createHash } from "node:crypto"
import { readManifest } from "./easygo-tools.mjs"
import { parseDevecoJson } from "./deveco-json.mjs"

const digest = (data) => createHash("sha256").update(data).digest("hex")
const read = async (path) => readManifest(await readFile(path, "utf8"))
const safeName = (value) => typeof value === "string" && /^[\w.-]+$/.test(value) && ![".", ".."].includes(value)

async function inside(root, path) {
  const actual = await realpath(path)
  const rel = relative(root, actual)
  if (rel.startsWith("..") || isAbsolute(rel)) throw new Error(`部署路径超出工程：${path}`)
  return actual
}

// Select the product's complete local runtime module set, including dynamically routed HSPs.
export async function planDeployment(project, run) {
  const root = await realpath(project)
  const profile = await read(join(root, "build-profile.json5"))
  const product = profile.app?.products?.find((p) => p.name === run.product)
  if (!product || !safeName(run.product)) throw new Error(`部署产品不存在或无效：${run.product}`)
  const app = (await read(join(root, "AppScope", "app.json5"))).app
  const bundle = product.bundleName ?? app?.bundleName
  if (typeof bundle !== "string" || !/^[\w.]+$/.test(bundle) || !Number.isInteger(app?.versionCode)) throw new Error("无法确定部署 bundleName/versionCode")
  const modules = []
  for (const item of profile.modules ?? []) {
    const targets = (item.targets?.length ? item.targets : [{ name: "default" }]).filter((t) => !t.applyToProducts || t.applyToProducts.includes(run.product))
    if (!targets.length) continue
    if (!safeName(item.name) || typeof item.srcPath !== "string") throw new Error("部署模块配置无效")
    const directory = await inside(root, resolve(root, item.srcPath))
    const manifest = (await read(join(directory, "src", "main", "module.json5"))).module
    if (manifest?.type === "har") continue
    if (!["entry", "feature", "shared"].includes(manifest?.type)) throw new Error(`无法确定运行模块类型：${item.name}`)
    if (targets.length !== 1 || !safeName(targets[0].name)) throw new Error(`模块 ${item.name} 在产品 ${run.product} 下的 target 不唯一或无效，需明确部署配置`)
    if (!safeName(manifest.name)) throw new Error(`模块 ${item.name} 的 module.name 无效`)
    const target = targets[0].name
    const shared = manifest.type === "shared"
    const metadataPath = await inside(root, join(directory, "build", run.product, "intermediates", shared ? "hsp_metadata" : "hap_metadata", target, "output_metadata.json"))
    const metadata = await read(metadataPath)
    const entries = Array.isArray(metadata) ? metadata : [metadata]
    const names = [...new Set(entries.map((e) => e[shared ? "hspName" : "hapName"]).filter(Boolean))]
    if (entries.some((e) => e.dependRemoteHsps?.length)) throw new Error(`模块 ${item.name} 包含外部 HSP；尚不能核实外部模块部署清单，停止安装，需明确对应产物与模块身份`)
    if (names.length !== 1 || basename(names[0]) !== names[0] || !names[0].endsWith(shared ? ".hsp" : ".hap")) throw new Error(`模块 ${item.name} 的产物元数据不唯一或无效`)
    let packageName = names[0]
    if (packageName.includes("-unsigned.") && run.deviceKind !== "emulator") packageName = packageName.replace("-unsigned.", "-signed.")
    if (run.deviceKind !== "emulator" && !entries.some((e) => e.isSigned === true) && !packageName.includes("-signed.")) throw new Error(`模块 ${item.name} 缺少已签名部署产物`)
    const path = await inside(root, join(directory, "build", run.product, "outputs", target, packageName))
    const content = await readFile(path)
    if (!content.length) throw new Error(`模块 ${item.name} 的部署产物为空`)
    modules.push({ name: manifest.name, projectName: item.name, type: manifest.type, target, path, sha256: digest(content), metadataPath, abilities: manifest.abilities ?? [], mainElement: manifest.mainElement })
  }
  if (!modules.length || new Set(modules.map((m) => m.name)).size !== modules.length) throw new Error("部署模块清单为空或 module.name 重复")
  const candidates = run.module ? modules.filter((m) => m.projectName === run.module && m.type !== "shared") : modules.filter((m) => m.type === "entry")
  if (candidates.length !== 1) throw new Error("启动模块无法唯一确定，请指定 entry/feature 模块；启动选择不限制部署范围")
  const selected = candidates[0]
  const ability = run.ability ?? selected.mainElement ?? (selected.abilities.length === 1 ? selected.abilities[0].name : undefined)
  if (!ability || !selected.abilities.some((a) => a.name === ability)) throw new Error(`模块 ${selected.projectName} 的启动 Ability 无法确认`)
  if (modules.filter((m) => m.abilities.some((a) => a.name === ability)).length !== 1) throw new Error(`启动 Ability ${ability} 在部署模块中重名，无法唯一启动目标页面`)
  return { product: run.product, buildMode: run.buildMode, bundle, versionCode: app.versionCode, ability, launchModule: selected.name, modules }
}

export function verifyInstalledModules(plan, info) {
  if ((info.name ?? info.bundleName) !== plan.bundle || info.versionCode !== plan.versionCode) throw new Error("部署核验失败：设备上的应用身份或版本与本轮产物不一致")
  if (!Array.isArray(info.hapModuleInfos)) throw new Error("部署核验失败：设备未返回 hapModuleInfos，无法确认模块完整性")
  const installed = new Map(info.hapModuleInfos.map((m) => [m.name ?? m.moduleName, m]))
  const missing = plan.modules.filter((m) => !installed.has(m.name)).map((m) => m.name)
  if (missing.length) throw new Error(`部署核验失败：缺少模块 ${missing.join("、")}`)
  const extra = [...installed.keys()].filter((name) => !plan.modules.some((m) => m.name === name))
  if (extra.length) throw new Error(`部署核验失败：设备残留当前产品之外的模块 ${extra.join("、")}；需核对旧安装，不自动卸载或清除应用数据`)
  for (const module of plan.modules) {
    const actual = installed.get(module.name)
    if (actual.versionCode !== undefined && actual.versionCode !== plan.versionCode) throw new Error(`部署核验失败：模块 ${module.name} 仍为旧版本`)
  }
}

export async function deployProduct(project, run, call, record) {
  const plan = await planDeployment(project, run)
  await record("deployment_manifest", JSON.stringify(plan, null, 2), "json")
  for (const module of plan.modules) {
    if (digest(await readFile(module.path)) !== module.sha256) throw new Error(`部署产物已变化：${module.name}，请重新构建验证`)
  }
  const install = await call(["device", "app", "install", "--device", run.device, "--replace", ...plan.modules.map((m) => m.path)], "install_log")
  if (install.exitCode !== 0) throw new Error("完整模块集安装失败，请检查安装日志中的签名、版本或依赖错误")
  const info = await call(["device", "app", "info", plan.bundle, "--device", run.device, "--format", "json"], "installed_modules")
  if (info.exitCode !== 0) throw new Error("部署核验失败：无法查询设备上的应用模块清单")
  verifyInstalledModules(plan, parseDevecoJson(info.stdout, "app"))
  const launchArgs = ["device", "app", "start", "--device", run.device, "--bundle", plan.bundle, "--ability", plan.ability]
  if ((await call(launchArgs, "install_log")).exitCode !== 0) throw new Error("模块安装已核验，但应用启动失败")
  return { plan, launchArgs }
}
