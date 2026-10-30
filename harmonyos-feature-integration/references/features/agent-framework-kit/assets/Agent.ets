import { common } from '@kit.AbilityKit';
import { BusinessError, deviceInfo } from '@kit.BasicServicesKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { FunctionComponent, FunctionController } from '@kit.AgentFrameworkKit';
import { UIContext } from '@ohos.arkui.UIContext';

// 查询成功才显示入口，适用于已完成小艺隐私授权的用户。
@Entry
@ComponentV2
export struct Agent {
  @Local isAgentSupport: boolean = false;
  private controller: FunctionController | undefined = undefined;
  private readonly minAgentApi: number = 20; // 元服务或 ICON_ABOVE_TITLE 改为 21。
  private agentId: string = ''; // 填写已关联当前应用的真实 Agent ID。

  private isRuntimeSupported(): boolean {
    return deviceInfo.apiAvailable(this.minAgentApi) && canIUse('SystemCapability.AI.Agent.AgentKit');
  }

  aboutToAppear(): void {
    this.isAgentSupport = false;
    if (!this.isRuntimeSupported() || this.agentId.length === 0 || this.agentId.length > 64) {
      return;
    }
    try {
      if (!this.controller) {
        this.controller = new FunctionController();
      }
    } catch (err) {
      this.logError('create controller', err as BusinessError);
      return;
    }
    this.checkAgentSupport(this.getUIContext());
    this.initListeners();
  }

  async checkAgentSupport(uiContext: UIContext): Promise<void> {
    const controller = this.controller;
    if (!this.isRuntimeSupported() || !controller) {
      return;
    }
    try {
      const context = uiContext.getHostContext() as common.UIAbilityContext | undefined;
      if (!context) {
        return;
      }
      this.isAgentSupport = await controller.isAgentSupport(context, this.agentId);
    } catch (err) {
      this.isAgentSupport = false;
      const error = err as BusinessError;
      hilog.error(0x0000, 'AgentExample', 'check agent support failed, code: %{public}d, message: %{public}s', error.code, error.message);
    }
  }

  initListeners(): void {
    const controller = this.controller;
    if (!this.isRuntimeSupported() || !controller) {
      return;
    }
    try {
      controller.on('agentDialogOpened', this.onAgentOpenedCallback);
      controller.on('agentDialogClosed', this.onAgentClosedCallback);
    } catch (err) {
      this.logError('subscribe', err as BusinessError);
    }
  }

  private logError(operation: string, error: BusinessError): void {
    hilog.error(0x0000, 'AgentExample', '%{public}s failed, code: %{public}d, message: %{public}s', operation, error.code, error.message);
  }

  private onAgentOpenedCallback = (): void => {
    hilog.info(0x0001, 'AgentExample', 'agent dialog opened callback');
  };

  private onAgentClosedCallback = (): void => {
    hilog.info(0x0001, 'AgentExample', 'agent dialog closed callback');
  };

  aboutToDisappear(): void {
    this.isAgentSupport = false;
    const controller = this.controller;
    if (!this.isRuntimeSupported() || !controller) {
      return;
    }
    try {
      controller.off('agentDialogOpened', this.onAgentOpenedCallback);
      controller.off('agentDialogClosed', this.onAgentClosedCallback);
    } catch (err) {
      this.logError('unsubscribe', err as BusinessError);
    }
  }

  build() {
    Column() {
      if (this.isRuntimeSupported() && this.controller && this.isAgentSupport) {
        FunctionComponent({
          agentId: this.agentId,
          onError: (err: BusinessError): void => {
            hilog.error(0x0001, 'AgentExample', 'Function error, code: %{public}d, message: %{public}s', err.code, err.message);
          },
          options: {
            title: '智能创建',
            queryText: '创建一个新的情景',
            isShowShadow: true
          },
          controller: this.controller
        })
      }
    }
  }
}
