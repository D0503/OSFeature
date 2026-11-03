# 可选 App Linking 链接直达

仅在需要“接收分享后直达应用或元服务指定内容”时接入。文件传送、普通链接分享可跳过，已有可用链接时复用现有配置。隔空传送本身沿用工程原有签名方式；本页手动签名提醒仅适用于 App Linking 链接直达。

先确认**接收目标**是应用还是元服务，再加载对应步骤；不能仅按发送端工程类型选配置。下述链接配置不改变隔空传送监听的 SDK、设备与应用类型门禁，元服务作为接收目标也不等于已确认可在元服务内订阅 `gesturesShare`。

## 接入完成后向开发者展示

完成隔空传送的工程内接入和具备条件的验证后，在交付回复中主动展示以下指导。按接收目标只展示对应步骤，并列明已完成项和仍需开发者操作的配置；不能只给出本地文档路径或笼统要求“自行配置 App Linking”。

交付时先展示[手机设置和真机操作步骤](compatibility.md#系统设置和信任)，提醒双端开启华为分享、在手机设置中开启隔空传送、按提示确认信任，再进入本次目标页面完成“一抓一放”；随后展示本页适用的链接配置。手机设置不因 App Linking 为可选项而省略。

平台开通、域名部署、链接创建与发布由开发者操作，不因这些外部配置未完成而中断可独立完成的工程接入。真实链接尚未提供时如实说明待配置项，不能用示例地址声称直达已完成。已有配置时说明本次复用项，并展示尚需核对的步骤。文件传送、普通链接分享没有选择直达时，仅说明 App Linking 为可选项，不要求完成无关的平台操作。

### 接收目标为应用

1. 在 AGC 应用所属项目开通 App Linking 服务，准备真实 HTTPS 域名。官网：[开通 App Linking 服务](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/applinking-enable-applinking)。
2. 在域名的 `/.well-known/applinking.json` 配置真实 APP ID，在 AGC 创建并发布域名关联。核对接收 UIAbility 的独立链接 skill、`domainVerify`、域名与路径，以及 `onCreate/onNewWant` 的内容接收。官网：[应用链接配置指导](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/app-linking-startupapp)。
3. **App Linking 只能使用手动签名，不能使用自动签名。** 完成签名后编译、安装，检查目标应用的域名校验结果。官网：[手动签名](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/ide-signing-manual)。
4. 将真实业务链接用于分享，验证接收端冷启动、暖启动打开同一内容，以及应用未安装时的 Web 内容；配置未完成前将链接直达标为待验证。

### 接收目标为元服务

1. 使用企业开发者账号，在开发者中心选择目标元服务，进入“基础服务 > 元服务链接”，创建链接并设置有效期，发布后确认已生效。官网：[元服务链接配置指导](https://developer.huawei.com/consumer/cn/doc/doccenter-atomic-service/atomic-applinking)。
2. 按实际路由配置静态参数或拼接动态参数，核对 `Want.parameters` 与 `Want.uri` 的接收位置；有分包时核对 `subPackageName` 与目标页面。通过浏览器或 ArkWeb 拉起时使用静态参数方案，不能依赖动态参数。
3. 将平台真实链接用于隔空分享。**App Linking 链接直达联调只能使用手动签名，不能使用自动签名。** 官网：[手动签名](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/ide-signing-manual)。
4. 验证目标元服务冷暖启动、实际参数和主包/子包页面，检查链接过期或无效时的处理；记录浏览器入口的档案页引导行为。平台配置或签名未完成时，明确链接直达尚未验收。

交付时区分“隔空传送代码已接入”和“App Linking 已配置并验证”，分别报告实际结果。接入 App Linking 时，其手动签名提醒须出现在面向开发者的交付回复中，不能只留在能力包内部。

资料核对日期：2026-11-02。依据官方[应用链接指南](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/app-linking-startupapp)（页面更新：2026-10-21）与[元服务链接指南](https://developer.huawei.com/consumer/cn/doc/doccenter-atomic-service/atomic-applinking)（页面更新：2026-10-14）。应用服务的开通、地区与签名补充依据[App Linking 简介](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/applinking-introduction)及[开通服务](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/applinking-enable-applinking)。

## 选择配置

| 项目 | 接收目标为应用 | 接收目标为元服务 |
|---|---|---|
| 版本与设备 | API12 起支持 Phone、Tablet、PC/2in1；API19 起增加 TV | API12 起支持 Phone、Tablet |
| 链接来源 | 开发者自己的 HTTPS 域名与业务路径 | 平台创建并发布的元服务链接，域名前缀由平台固定 |
| 平台配置 | AGC 开通 App Linking，创建并发布关联域名 | 企业开发者账号、已创建元服务，在开发者中心创建元服务链接 |
| 网站配置 | 发布 `/.well-known/applinking.json` | 按元服务链接流程配置，不套用应用自有域名关联步骤 |
| 客户端接收 | 独立 browsable/viewData skill、域名校验及 `Want.uri` 解析 | 动态参数解析 `Want.uri`；静态参数读取 `Want.parameters` |
| 有效期 | 按域名关联与实际业务链接管理 | 平台配置有效期，生效时间段为1～90天 |

这些是链接能力的条件，不能用于推定对应设备支持隔空手势。

## 应用配置

### 1. 建立域名关联

在 AGC 选择应用所属项目，进入“增长 > App Linking > 应用链接”，首次使用先开通服务。准备真实 HTTPS 域名和对应内容的 Web 页面，供应用未安装时访问。

在网站发布以下 `applinking.json`，地址固定为 `https://<真实域名>/.well-known/applinking.json`：

```json
{
  "applinking": {
    "apps": [
      { "appIdentifier": "<真实APP ID>" }
    ]
  }
}
```

`appIdentifier` 填平台创建应用时生成的 APP ID，不能填 bundleName。同一域名可关联多个应用。需要多应用优先级时可选 `index`（API23起，-100～100），按需求添加，不默认引入。

在 AGC 创建精确关联域名，例如 `https://<真实域名>`，不带末尾 `/`，不使用模糊域名。发布后确认关联成功，不能把“发布中”视为完成。开发者负责网站部署、平台开通与发布，未具备条件时记录具体缺项。

### 2. 配置接收 UIAbility

在实际接收 UIAbility 的 `module.json5` 配置中设置 `exported: true`，并在 `skills` 数组新增独立的链接 skill：

```json5
{
  entities: ["entity.system.browsable"],
  actions: ["ohos.want.action.viewData"],
  uris: [{
    scheme: "https",
    host: "<真实域名>",
    pathStartWith: "<实际业务路径前缀>"
  }],
  domainVerify: true
}
```

替换域名与路径，按实际需求选择 `path`、`pathStartWith` 或 `pathRegex`。保留原有 home skill；链接、推送、NFC 等不同跳转场景分别配置 skill，不把链接规则混进 home skill，也不覆盖已有数组。

以新闻详情分享为例，以下为 `module.json5` 的相关配置结构，将链接 skill 合并到实际接收 UIAbility，保留其已有配置：

```json5
{
  module: {
    abilities: [
      {
        name: "PhoneAbility",
        srcEntry: "./ets/phoneability/PhoneAbility.ets",
        exported: true,
        skills: [
          {
            // ...
          },
          {
            entities: ["entity.system.browsable"],
            actions: ["ohos.want.action.viewData"],
            uris: [
              {
                scheme: "https",
                host: "<真实关联域名>",
                path: "newsDetail"
              }
            ],
            domainVerify: true
          }
        ]
      }
    ]
  }
}
```

`PhoneAbility` 和 `srcEntry` 替换为工程实际接收入口；`host` 只填写已完成平台关联的域名，不包含 `https://`、路径或查询参数。`path: "newsDetail"` 对应链接路径 `/newsDetail`。例如分享 `https://<真实关联域名>/newsDetail?id=1001&type=0`，在接收端解析 `id` 和 `type`；该业务约定中 `type=0` 表示图文、`type=1` 表示视频。查询参数不写入 `path`，实际参数名与取值沿用工程已有业务规则。

### 3. 解析应用链接参数

从 `Want.uri` 解析 `/newsDetail?id=1001&type=0`，`type=0` 为图文、`type=1` 为视频。解析后返回目的页与业务参数，后续使用[共用处理调用链](#共用处理调用链)。

UIAbility 导入 `Want`（`@kit.AbilityKit`）、`url`（`@kit.ArkTS`）和 `hilog`（`@kit.PerformanceAnalysisKit`），合入以下解析方法：

```typescript
private parseAppLinking(want: Want): AppLinkingParams | undefined {
  if (!want.uri) {
    return undefined;
  }
  try {
    const link = url.URL.parseURL(want.uri);
    const newsId = link.params.get('id');
    const newsType = link.params.get('type') ?? '0';
    if (link.protocol !== 'https:' || link.hostname !== '<真实关联域名>' ||
      link.pathname !== '/newsDetail' || !newsId ||
      (newsType !== '0' && newsType !== '1')) {
      return undefined;
    }
    return {
      pageUrl: 'NewsDetail',
      params: { newsId: newsId, type: Number(newsType) }
    };
  } catch {
    hilog.error(0x0000, 'AppLinking', 'Invalid application link');
    return undefined;
  }
}
```

域名与路径对应第二步的配置。`NewsDetail` 是详情路由示意名，替换为工程实际的 Navigation 目的页名称；若既有业务按 `type` 区分图文与视频，沿用其路由映射。`newsId`、`type` 按目标详情页已有的参数约定传递。

### 4. 签名与验证

应用 App Linking 调试必须使用手动签名，核对签名身份、APP ID 与平台关联一致；不能用自动签名安装后直接判定域名配置失败。当前 App Linking 服务地区限制为中国境内（不含港澳台）。

安装应用后给域名校验留出至少20秒，使用以下命令检查目标应用与域名对应的结果：

```sh
hdc shell hidumper -s AppDomainVerifyManager
```

目标域名应为 `success`。`client-error` 时检查 APP ID 和 AGC 发布状态；`http_unknown` 时检查网络并按官方步骤重新安装验证。弱网或断网导致校验失败后，系统会在24小时内重试，不通过反复改配置代替定位。

## 元服务配置

### 1. 创建并发布元服务链接

前提为企业开发者账号，且已创建目标元服务。进入 HarmonyOS 开发者中心“应用管理”，选择目标元服务，再进入“基础服务 > 元服务链接”，点击“立即使用”，然后创建链接。

| 配置项 | 填写要求 |
|---|---|
| 名称 | 填写便于识别业务用途的链接名称 |
| 链接 URL | 使用平台固定域名前缀；后缀可自动生成或自行指定，须唯一、最长100位，仅允许字母、数字、`_`、`-` |
| 元服务 | 核对目标元服务，不能把应用链接当作元服务链接 |
| 静态自定义参数（可选） | 平台填写 `key=value`，多项以 `&` 分隔；用于业务参数和指定页面 |
| 是否关联二维码 | 本流程使用元服务链接时选“不关联”；普通链接二维码属于另一接入流程 |
| 有效期 | 生效时间段1～90天，结束时间须晚于当前时间 |

“保存”仅生成草稿；“发布”后按时间显示待生效、已生效或已失效。分享时确认链接已生效，并记录有效期，不能长期使用过期链接。已发布链接不支持编辑，草稿可修改；维护操作按平台当前状态处理，不自动创建替代链接。

元服务链接的域名前缀不由开发者自定义。本流程不要求按应用方案部署自有域名的 `applinking.json` 或把自有域名 skill 加到元服务；若使用普通链接二维码，另按其官方流程处理。

### 2. 配置元服务参数

静态参数在平台创建链接时填写，以服务详情为例：

```text
navRouterName=GoodDetail
```

客户端从 `Want.parameters` 读取静态参数。需要指定业务内容时，可增加实际业务参数，例如 `navRouterName=GoodDetail&goodId=1001`；目的页与业务参数名按工程已有约定配置。

| 目标 | 平台参数示例 | 含义 |
|---|---|---|
| Router 页面 | `pagePath=pages/SubPage` | 目标页面路径 |
| Navigation 目的页 | `navRouterName=GoodDetail` | pageMap 或 routerMap 中的目的页 name |
| Navigation 按需子包 | `subPackageName=product&navRouterName=ProductDetail` | 子包名称与目的页 name |

`subPackageName` 是系统保留 KEY，用于子包提前安装，不能另定义为业务字段。随元服务安装的共享模块沿用现有加载方式，不直接把模块名称当作按需子包名称。目标路由须在实际模块声明，例如：

```json
{
  "routerMap": [
    {
      "name": "GoodDetail",
      "pageSourceFile": "src/main/ets/pages/GoodDetail.ets",
      "buildFunction": "GoodDetailBuilder"
    }
  ]
}
```

动态参数可直接拼在平台真实链接后，例如 `?navRouterName=GoodDetail&goodId=1001`，多个键值以 `&` 分隔，值按 URL 规则编码；客户端从 `Want.uri` 解析。**浏览器或 ArkWeb 拉起元服务时不支持动态参数**，需要覆盖该入口时采用平台静态参数。

### 3. 解析元服务链接参数

以下示例采用平台静态参数，返回与应用解析相同的目的页、业务参数结构。合入现有 UIAbility，后续使用[共用处理调用链](#共用处理调用链)：

```typescript
private parseAppLinking(want: Want): AppLinkingParams | undefined {
  if (!want.uri) {
    return undefined;
  }
  const pageUrl = want.parameters?.['navRouterName'];
  const goodId = want.parameters?.['goodId'];
  if (pageUrl !== 'GoodDetail' ||
    (goodId !== undefined && typeof goodId !== 'string')) {
    return undefined;
  }
  return {
    pageUrl: pageUrl,
    params: goodId ? { goodId: goodId } : {}
  };
}
```

`GoodDetail` 是当前业务允许的目的页，替换为实际路由白名单。链接只指定页面时按已有默认展示规则处理；需要直达具体服务时传入业务 ID，不以默认列表第一项替代该服务。

如果选用动态参数，解析方法中改为从 URI 读取，校验后仍返回相同结构：

```typescript
const link = url.URL.parseURL(want.uri);
const pageUrl = link.params.get('navRouterName');
const goodId = link.params.get('goodId');
```

导入与应用解析片段相同，URI 解析须捕获异常。静态与动态参数按所选方案处理，不能相互冒充。Router 页面使用 `pagePath`；分包页面读取保留参数 `subPackageName`，交给工程既有分包加载和导航逻辑。元服务系统分享的 `custShareParam` 属于另一接收流程，不代替这里的链接参数。

### 4. 拉起行为与失败处理

用已有 `UIAbilityContext` 验证平台真实链接，无需创建全局上下文工具或测试页面：

```typescript
context.openLink(actualLink, { appLinkingOnly: true })
  .catch(() => {
    hilog.error(0x0000, 'AppLinking', 'Failed to open target link');
  });
```

`appLinkingOnly: true` 时要求匹配的目标可被拉起；元服务链接失效时可返回 `16000019`。设置为 false 或省略时，非法/失效元服务链接可能打开 Web 异常页，不能把浏览器出现当作跳转成功。

从系统浏览器或 ArkWeb 点击元服务链接，会先进入元服务档案页，引导用户点击“打开元服务”；该入口不支持动态参数。不要把档案页中转误认为必然配置失败，也不要承诺所有入口都直接进入业务页面。

## 共用处理调用链

**必需的是冷暖启动使用链接处理入口。** 接收 UIAbility 的 `onCreate` 与 `onNewWant` 都须调用同一处理方法，确保两条启动路径使用一致的参数解析和业务处理规则。

后续如何传递参数、等待页面就绪和执行导航，由工程已有实现决定。下面的 `AppStorageV2`、共享模型、`@Monitor` 和 NavPathStack 代码仅展示一条完整参考链路；可以使用现有 VM、事件通知或其他状态管理与路由方式，验收不以采用这些具体类型、字段或 API 为条件。

### 1. 冷暖启动共用一个处理入口（必需）

UIAbility 导入 `AbilityConstant`、`Want`（`@kit.AbilityKit`），保留其他初始化、卡片和分享 Want 处理，在 `onCreate` 和 `onNewWant` 两个生命周期中合入同一调用：

```typescript
onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
  this.handleAppLinking(want);
}

onNewWant(want: Want, launchParam: AbilityConstant.LaunchParam): void {
  this.handleAppLinking(want);
}
```

`handleAppLinking` 的名称可沿用工程已有方法，内部按接收类型解析参数，然后进入既有业务处理。冷启动时若页面尚未就绪，按现有机制暂存或延后导航；暖启动时处理当前请求。无需为满足统一入口而新增共享状态模型。

### 2. 参考：共享状态传参与请求写入

以下以状态管理 V2 展示完整过程：

`handleAppLinking` → `parseAppLinking` → 写入共享路由状态 → 首页就绪或状态变化 → 业务导航 → 清理请求。

参考参数类型和模型放在工程公共类型文件，由 UIAbility 与首页使用同一份类型：

```typescript
export interface AppLinkingParams {
  pageUrl: string;
  params: Record<string, string | number>;
}

@ObservedV2
export class AppLinkingRouter {
  @Trace id: number = 0;
  @Trace pageUrl: string = '';
  @Trace params: Record<string, string | number> = {};
}
```

在这个示例中，`pageUrl` 与 `params` 保存校验后的目的页和业务参数，`id` 通知新请求并在消费后清零。字段和类型按实际工程调整，业务 ID 的格式、存在性与访问权限沿用已有规则。

采用该参考方案时，UIAbility 导入 `AppStorageV2`（`@kit.ArkUI`）及公共类型，将前文所选的解析方法接到统一入口：

```typescript
private handleAppLinking(want: Want): void {
  const target = this.parseAppLinking(want);
  if (!target) {
    return;
  }
  const routerState = AppStorageV2.connect(
    AppLinkingRouter, () => new AppLinkingRouter()
  );
  if (routerState) {
    routerState.pageUrl = target.pageUrl;
    routerState.params = target.params;
    routerState.id = new Date().getTime();
  }
}
```

`parseAppLinking` 按接收工程类型选择一份实现，其返回类型可映射到工程已有业务参数类型。此处用共享状态暂存请求，其他方案可在相同位置使用已有机制。

### 3. 参考：首页就绪后消费并跳转

采用上述 V2 参考方案时，以下成员放入现有首页组件，`pathStack` 复用当前 Navigation 实际使用的 NavPathStack；若在 VM 中处理，则沿用该 VM 访问真实导航栈的方式。

```typescript
@Local appLinkRouter: AppLinkingRouter = AppStorageV2.connect(
  AppLinkingRouter, () => new AppLinkingRouter()
)!;

@Monitor('appLinkRouter.id')
onAppLinkingChange(): void {
  this.checkAppLinkingScene();
}

checkAppLinkingScene(): void {
  if (!this.appLinkRouter.id || !this.appLinkRouter.pageUrl) {
    return;
  }
  try {
    this.pathStack.pushPathByName(
      this.appLinkRouter.pageUrl, this.appLinkRouter.params
    );
    this.appLinkRouter.id = 0;
  } catch {
    hilog.error(0x0000, 'AppLinking', 'Failed to open linked page');
  }
}

aboutToAppear(): void {
  this.checkAppLinkingScene();
}
```

该示例在首页导航及必要初始化就绪后消费冷启动请求，通过监听处理暖启动请求。其他方案可使用自身的就绪通知与分发机制。无论具体方式如何，都须保留登录、隐私与返回栈规则，并将当前业务参数传给目标页。

`pushPathByName` 演示最终导航位置。工程已有新闻详情路由、服务详情查询或分包导航封装时，在此处调用现有接口，并按其要求转换业务参数；需要完整详情对象时先按传入 ID 查询，不能直接把原始 ID 当作详情对象。Router 工程在同一消费位置使用现有 Router 入口。

参考方案在路由成功后清理请求标记，失败沿用已有反馈与重试处理。采用其他实现时，同样验证冷暖启动、当前内容一致性、无效参数与重复进入行为，不要求使用相同的标记或清理代码。

## 接入隔空传送与验收

发送端把已配置的真实应用链接或元服务链接放入 `SharedData` 的 HYPERLINK 记录 `content`，沿用[实现文档](implementation.md)的 `target.share(data)`；`openLink` 片段用于独立验证链接，不替代隔空分享回调。

| 验证项 | 应用 | 元服务 |
|---|---|---|
| 配置有效 | 域名关联发布、手动签名、目标域名校验成功 | 平台目标正确、链接已发布且处于有效期 |
| 冷/暖启动 | `Want.uri` 解析后打开同一业务内容 | 按动态 URI 或静态 parameters 解析，打开实际主包/子包目标 |
| 负向场景 | 未安装时打开对应 Web；无效域名/路径/内容按业务处理 | 草稿、待生效、过期、错误路由/子包、非法参数不能判为成功 |
| 浏览器入口 | 同域名页面内点击链接可能留在浏览器；跨域名入口按指南验证 | 档案页引导打开，动态参数不生效，验证所选静态参数 |
| 分享验收 | 核对发送内容与接收端内容一致 | 核对平台真实链接、目标元服务和业务参数一致 |

链接配置验证与双端隔空手势验证分别记录；模拟器可做的链接检查不能证明“一抓一放”成功。缺少账号、域名发布、平台链接或双端设备时如实记录未完成项，证据按[验证方案](performance-validation.md)归档。
