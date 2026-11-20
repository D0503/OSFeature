# 静态快捷方式

## 配置与资产

在工程根目录下的 `entry/src/main/resources/base/profile/shortcuts_config.json` 合并以下结构，替换为真实包名、模块、Ability、既有名称、图标资源与业务标识。静态配置基于 API9 Stage 模型，以下示例通过 `wants.parameters` 携带业务参数：

```json
{
  "shortcuts": [{
    "shortcutId": "open_feature",
    "label": "$string:shortcut_label",
    "icon": "$media:shortcut_icon",
    "wants": [{
      "bundleName": "com.example.application",
      "moduleName": "entry",
      "abilityName": "EntryAbility",
      "parameters": {
        "shortcutTarget": "open_feature"
      }
    }]
  }]
}
```

打开工程根目录下的 `entry/src/main/module.json5`，在 `module.abilities` 数组中找到需要配置快捷方式的入口 UIAbility（本例为 `name: "EntryAbility"` 的对象），在该对象的 `metadata` 数组中追加以下配置。已有同名 `ohos.ability.shortcuts` 项时合并其 `resource`，不要重复添加。

具体配置层级为：`module` → `abilities[]` → `name: "EntryAbility"` 对应对象 → `metadata[]`。包含层级的示例如下，仅将相关配置合并到原文件：

```json
{
  "module": {
    "abilities": [{
      "name": "EntryAbility",
      "metadata": [{
        "name": "ohos.ability.shortcuts",
        "resource": "$profile:shortcuts_config"
      }]
    }]
  }
}
```

`$profile:shortcuts_config` 对应同一模块下的 `entry/src/main/resources/base/profile/shortcuts_config.json`。若入口模块实际目录名不是 `entry`，以上两个文件路径均替换为该入口模块的真实目录。

保留其他 metadata 与现有快捷方式；不要在 module 根部替代 Ability 的 metadata。多个入口分别定位，不能随意改变 `mainElement` 或创建新的 Ability 来绕过现有导航。

- shortcutId 为字面字符串，不使用资源索引；不超过63字节且同一应用避免冲突。
- 静态 label 不超过255字节；优先字符串资源以保留本地化；icon 为有效媒体资源索引。按[图标资源规范](../assets-catalog.md#图标资源规范)核对 SVG/PNG 的尺寸、透明背景、圆角裁切及分层资源；SVG 另核对解析复杂度限制。复用工程现有图标。
- wants 推荐单个目标，指向实际 UIAbility。静态入口最多展示4个，超出时先与用户确认所需入口，不静默截断现有配置。
- parameters 为可选的业务参数对象，键值仅支持字符串，长度均≤1024；其中的业务标识需与 UIAbility 接收及页面分发逻辑一致。
- `visible` 为可选布尔配置，缺省为 true，API20 起生效。直接在快捷方式配置中声明，由系统处理低版本兼容，无需添加运行时版本守卫或拆分配置。

## 业务页面与参数分发

上述示例通过 `want.parameters?.['shortcutTarget']` 取得 `open_feature`，将其映射到已确认的业务目标。多个快捷方式可以复用同一 UIAbility，并配置不同的 `shortcutTarget` 值，由现有页面路由分发。

### UIAbility 接收参数

在 `entry/src/main/ets/entryability/EntryAbility.ets` 中，将以下方法与调用合并到现有 UIAbility。实际文件位置以 `entry/src/main/module.json5` 中该 Ability 的 `srcEntry` 为准；保留已有生命周期逻辑和 `onWindowStageCreate` 中的首页加载。

```typescript
import { AbilityConstant, UIAbility, Want } from '@kit.AbilityKit';

export default class EntryAbility extends UIAbility {
  private handleShortcutWant(want: Want): void {
    const target = want.parameters?.['shortcutTarget'];
    if (target === 'open_feature' || target === 'open_other_feature') {
      AppStorage.setOrCreate('shortcutTarget', target);
    }
  }

  onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    this.handleShortcutWant(want);
  }

  onNewWant(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    this.handleShortcutWant(want);
  }
}
```

冷启动在 `onCreate` 保存业务标识，仍按原流程创建窗口与加载首页；暖启动在 `onNewWant` 更新标识，由已存在的页面或 ViewModel 响应。只接收已确认的标识，普通启动与未知参数保留原行为。

### 页面按参数跳转

接入前先确认目标类型、当前页能否退出，以及按返回键应到哪里。仅对快捷方式请求应用以下规则，沿用工程已有导航框架和业务退出规则。

| 场景 | 默认处理 |
|---|---|
| 冷启动，或当前在目标的首页／列表 | 保留该页，待其就绪后进入目标详情，使返回键仍能回到首页或列表。 |
| 暖启动，当前是可退出的详情，目标为另一详情 | 若栈顶下方就是预期返回页，替换栈顶。若已经叠了多层详情，先返回约定的首页／列表，等导航完成后再打开目标。 |
| 已显示同一业务目标 | 按「路由＋业务 ID」判定同一目标；保持当前页，按业务需要刷新。 |
| 目标是首页内的 Tab | 返回承载 Tab 的根页面，再复用已有 Tab 切换逻辑。 |

当前页有未保存内容时沿用已有的退出确认；如果业务明确要求保留上一条详情，则按原有返回规则处理。详情页用自身的路由参数保存内容 ID 并取数，避免多个页面共享一个可被后续请求覆盖的「当前内容 ID」。

下面以 `Index → Feature` 两层 Router 工程为例，两个快捷方式可指向同一个 `Feature` 页面，示例用两个约定的 `shortcutTarget` 值分别作为内容 ID。第二个快捷方式在 `shortcuts_config.json` 中另设唯一 `shortcutId`，并将 `wants[0].parameters.shortcutTarget` 配为 `open_other_feature`。实际接入时映射为已有业务 ID。将代码合并到常驻的 `entry/src/main/ets/pages/Index.ets` 组件，保留原生命周期和 `build()`。使用实际首页、只读详情页及其唯一文件名，确认页面已在 `entry/src/main/resources/base/profile/main_pages.json` 注册。

```typescript
import { router } from '@kit.ArkUI';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { BusinessError } from '@kit.BasicServicesKit';

interface FeatureParams {
  contentId: string;
}

@StorageLink('shortcutTarget') @Watch('onShortcutTargetChange')
shortcutTarget: string = '';
private shortcutPageReady: boolean = false;
private shortcutNavigating: boolean = false;

onPageShow(): void {
  this.shortcutPageReady = true;
  this.onShortcutTargetChange();
}

onShortcutTargetChange(): void {
  const target = this.shortcutTarget;
  if (!this.shortcutPageReady || this.shortcutNavigating ||
    (target !== 'open_feature' && target !== 'open_other_feature')) {
    return;
  }
  this.shortcutNavigating = true;
  this.shortcutTarget = '';
  this.openShortcutDetail(target);
}

private async openShortcutDetail(target: string): Promise<void> {
  try {
    const params: FeatureParams = { contentId: target };
    const options: router.RouterOptions = { url: 'pages/Feature', params };
    const current = router.getState();
    if (current.name === 'Feature' && current.index === 2) {
      const active = router.getParams() as FeatureParams | undefined;
      if (active?.contentId !== target) {
        await router.replaceUrl(options);
      }
    } else if (current.name === 'Index' && current.index === 1) {
      await router.pushUrl(options);
    }
  } catch (error) {
    hilog.error(0x0000, 'DesktopShortcut', 'Failed to open target page: %{public}d', (error as BusinessError).code);
  } finally {
    this.shortcutNavigating = false;
    // 上一次导航期间收到新请求时，按完成后的栈顶状态重新判断。
    if (this.shortcutTarget !== '') {
      this.onShortcutTargetChange();
    }
  }
}
```

冷启动时页面首次显示后读取已保存的标识，暖启动时通过 `@Watch` 响应更新。处理请求前清空标识；导航进行中收到新请求时保留最新目标，等本次完成再判断。详情组件在自身的路由上下文读取 `contentId` 并按该 ID 加载数据。原有登录、隐私协议等前置流程完成、导航可用后再消费；存在鉴权时，应在工程实际就绪的位置触发处理。根页面或导航容器销毁时清理尚未消费的标识。

示例仅处理上述两层结构；实际工程用已有导航状态确认栈顶和返回位置，再按表中的规则接入其他分支。已有 Navigation 或 MVVM 工程复用其常驻根页面／ViewModel，在 `onCreate`、`onNewWant` 更新共享状态，由同一业务分支执行导航。栈顶替换沿用现有 Router 的 [`replaceUrl`](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/js-apis-router) 或现有 `NavPathStack` 的[替换方法](https://developer.huawei.com/consumer/cn/doc/HarmonyOS-Guides/arkts-navigation-jump/)，按工程 SDK 与路由框架选用。已有 AppStorageV2、`@Monitor` 等状态管理时沿用现有方式。

当目标位于根页面内的 Tab，且当前可能覆盖详情页时，不能只监听主 Tab 下标或目标字符串：重复点击同一入口时这些值可能不变，导致详情页没有退出。除保存目标外，在现有共享模型中维护单调递增的请求序号，由常驻根页面／ViewModel 监听每次合法请求，通过现有 Router 或 NavPathStack 返回目标根页面，再调用已有 Tab 切换逻辑。主 Tab 状态监听只同步状态，不再次出栈，避免重复导航。冷启动仍须等待首页和导航容器就绪，不在 UIAbility 中直接操作尚未就绪的路由栈。

## 验证

按[验收](../performance-validation.md)长按应用图标检查入口与文案，点击进入目标，拖动到桌面后再次点击；分别覆盖冷、暖启动，回到普通启动入口确认原首页和导航仍正常。配置或构建通过不能证明桌面展示成功。
