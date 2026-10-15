import { FunctionComponent as AgentButton, FunctionController as Controller } from '@kit.AgentFrameworkKit';
import { BusinessError } from '@kit.BasicServicesKit';

// Static fixture only; this identifier is not a real published Agent.
@Entry
@Component
struct Index {
  private agentId: string = 'fixture-agent-id';
  private controller: Controller = new Controller();
  private opened = (): void => {};
  private closed = (): void => {};

  aboutToAppear(): void {
    this.controller.on('agentDialogOpened', this.opened);
    this.controller.on('agentDialogClosed', this.closed);
  }

  aboutToDisappear(): void {
    this.controller.off('agentDialogOpened', this.opened);
    this.controller.off('agentDialogClosed', this.closed);
  }

  build() {
    Column() {
      AgentButton({
        agentId: this.agentId,
        onError: (error: BusinessError): void => {},
        controller: this.controller,
        options: { title: '查询进度', queryText: '查询当前进度' }
      })
    }
  }
}
