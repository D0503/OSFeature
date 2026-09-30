import { readFile } from "node:fs/promises"

const matrixUrl = new URL("../../references/features/immersive-light/routes/arkui/component-profile.json", import.meta.url)
// Discovery rules identify usage without requiring an existing material setting.
export const discoveryRules = {
  "navigation-title": /\b(?:Navigation|NavDestination)\s*\(/g,
  "tabs-bottom-bar": /\bTabs\s*\(/g,
  "alphabet-indexer": /\bAlphabetIndexer\s*\(/g,
  toast: /\b(?:showToast|openToast)\s*\(|\bShowToastOptions\b/g,
  popup: /\.\s*bindPopup\s*\(|\b(?:PopupOptions|CustomPopupOptions)\b/g,
  tips: /\.\s*bindTips\s*\(|\bTipsOptions\b/g,
  menu: /\.\s*(?:bindMenu|bindContextMenu|showActionMenu)\s*\(|\b(?:Menu|MenuItem|MenuItemGroup)\s*\(|\b(?:ContextMenuOptions|MenuOptions)\b/g,
  "dialog-sheet": /\b(?:AlertDialog|ActionSheet|CalendarPickerDialog|DatePickerDialog|TimePickerDialog|TextPickerDialog)\s*\.\s*show\s*\(|\b(?:CustomDialogController|CustomDialogControllerOptions|AlertDialogParam|ActionSheetOptions|SheetOptions|CustomDialogOptions)\b|@CustomDialog\b|\.\s*(?:bindSheet|showDialog|openCustomDialog|presentCustomDialog)\s*\(/g,
  "selection-menu": /\bSelectionMenu\s*\(/g,
  "text-selection-menu": /\.\s*copyOption\s*\(/g,
  button: /\bButton\s*\(/g,
  select: /\bSelect\s*\(/g,
  toggle: /\bToggle\s*\(/g,
  slider: /\bSlider\s*\(/g,
  chip: /\bChip\s*\(/g,
  "chip-group": /\bChipGroup(?:V2)?\s*\(/g,
  "segment-button": /\b(?:SegmentButton(?:V2)?|MultiCapsuleSegmentButtonV2)\s*\(/g
}

export async function inspectMaterialInventory(files, maskComments) {
  const matrix = JSON.parse(await readFile(matrixUrl, "utf8"))
  const components = matrix.groups.flatMap((group) => group.components)
  const missing = components.filter((component) => !discoveryRules[component.id]).map((component) => component.id)
  if (missing.length) throw new Error(`组件矩阵缺少候选发现规则：${missing.join(", ")}`)
  const candidates = [], unresolvedEntrypoints = []
  for (const file of files.filter((item) => /\.(?:ets|ts)$/.test(item.path))) {
    const commentsMasked = maskComments(file.content)
    // Preserve source offsets while excluding string examples from candidates.
    let searchable = commentsMasked.replace(/(["'`])(?:\\[\s\S]|(?!\1)[^\\])*?\1/g, (value) => value.replace(/[^\r\n]/g, " "))
    const aliases = new Map()
    for (const match of commentsMasked.matchAll(/\bimport\s*\{([^}]+)\}\s*from\s*["'][^"']+["']/g)) {
      for (const alias of match[1].matchAll(/\b(\w+)\s+as\s+(\w+)\b/g)) aliases.set(alias[2], alias[1])
    }
    const evidence = (match, componentId, route) => ({
      id: `${route}:${componentId}:${file.path}:${match.index}`,
      componentId, route, path: file.path,
      line: file.content.slice(0, match.index).split(/\r?\n/).length,
      entry: match[0].trim(), status: "pending",
      kind: /Options|Param/.test(match[0]) ? "configuration-reference" : "usage-candidate"
    })
    for (const component of components) {
      let pattern = discoveryRules[component.id].source
      for (const [alias, original] of aliases) {
        if (component.names.includes(original)) pattern += `|\\b${alias}\\s*\\(`
      }
      for (const match of searchable.matchAll(new RegExp(pattern, "g"))) candidates.push(evidence(match, component.id, "arkui"))
    }
    for (const match of searchable.matchAll(/\bHds(?:Navigation|NavDestination|Tabs)\s*\(/g)) candidates.push(evidence(match, match[0].split(/\s*\(/)[0], "hds"))
    for (const match of searchable.matchAll(/\b(?:PromptAction|promptAction|ArkUI_NativeDialog\w*)\b/g)) unresolvedEntrypoints.push(evidence(match, "interface-or-wrapper", "review"))
  }
  return {
    status: "candidates-require-review", count: candidates.length, candidates, unresolvedEntrypoints,
    matrixComponents: components.map((c) => c.id),
    limitations: ["候选不是已确认可适配实例；配置类型引用与实际调用须沿调用链合并", "需要人工补查业务封装、动态调用、命名空间别名与原生接口", "逐项核对页面、父组件层级、类型、版本分支和背景配置；不能由未命中推断不存在"]
  }
}
