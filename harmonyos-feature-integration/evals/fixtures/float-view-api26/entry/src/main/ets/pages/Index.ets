import { floatView } from '@kit.ArkUI';
import { common } from '@kit.AbilityKit';
export async function openView(context: common.UIAbilityContext): Promise<void> {
  const view = await floatView.create({ context, templateType: floatView.FloatViewTemplateType.ROUNDED_RECTANGLE });
  await view.setUIContext('pages/FloatContent');
  view.onStateChange(stateChanged);
  await view.start();
  const id = view.getWindowProperties().windowId;
  await view.stop();
  view.offStateChange(stateChanged);
}
function stateChanged(info: floatView.FloatViewStateChangeInfo): void {}
