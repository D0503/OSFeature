import { FunctionComponent } from '@kit.AgentFrameworkKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { hilog } from '@kit.PerformanceAnalysisKit';

// 宿主须先通过运行 API（应用 20 / 元服务 21）及 SysCap 门禁。
// Function 参数仅初始化生效；参数变化时由宿主销毁并重建本组件。
@Component
export struct AgentFunctionEntry {
  agentId: string = '';
  title: string = '';
  queryText: string = '';

  build() {
    if (this.agentId.length > 0 && this.agentId.length <= 64) {
      FunctionComponent({
        agentId: this.agentId,
        onError: (error: BusinessError): void => {
          hilog.error(0x0001, 'AgentFunctionEntry', 'Function error: %{public}d', error.code);
        },
        options: {
          title: this.title,
          queryText: this.queryText
        }
      })
    }
  }
}
