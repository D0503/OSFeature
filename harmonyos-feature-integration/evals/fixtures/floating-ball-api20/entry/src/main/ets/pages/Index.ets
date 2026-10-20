import { floatingBall } from '@kit.ArkUI';
import { common } from '@kit.AbilityKit';
export async function openBall(context: common.UIAbilityContext): Promise<void> {
  const ball = await floatingBall.create({ context });
  ball.on('stateChange', stateChanged);
  await ball.startFloatingBall({ template: floatingBall.FloatingBallTemplate.NORMAL, title: '进度', content: '进行中' });
  await ball.updateFloatingBall({ template: floatingBall.FloatingBallTemplate.NORMAL, title: '进度', content: '已更新' });
  await ball.stopFloatingBall();
  ball.off('stateChange', stateChanged);
}
function stateChanged(state: floatingBall.FloatingBallState): void {}
