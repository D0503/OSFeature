import { floatView, floatingBall } from '@kit.ArkUI';
import { common } from '@kit.AbilityKit';
export async function openPair(context: common.UIAbilityContext): Promise<void> {
  const view = await floatView.create({ context, templateType: floatView.FloatViewTemplateType.ROUNDED_RECTANGLE });
  const ball = await floatingBall.create({ context });
  await view.setUIContext('pages/FloatContent');
  await floatView.bind(view, ball, { template: floatingBall.FloatingBallTemplate.NORMAL, title: '进度' });
  await view.start();
  await view.stop();
}
