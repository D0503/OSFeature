import { FunctionComponent, ButtonType as Shape } from '@kit.AgentFrameworkKit';
import { BusinessError } from '@kit.BasicServicesKit';

// Static fixture only; this identifier is not a real published Agent.
@Entry
@Component
struct Index {
  build() {
    Column() {
      FunctionComponent({
        agentId: 'fixture-agent-id',
        onError: (error: BusinessError): void => {},
        options: { title: '查询进度', buttonType: Shape.ICON_ABOVE_TITLE }
      })
    }
  }
}
