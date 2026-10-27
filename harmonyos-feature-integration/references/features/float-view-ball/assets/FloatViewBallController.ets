import { floatView, floatingBall, window } from '@kit.ArkUI';
import { BusinessError } from '@kit.BasicServicesKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { FloatViewController } from './FloatViewController';
import { FloatingBallController } from './FloatingBallController';

const DOMAIN: number = 0xF811;
const TAG: string = 'FloatViewBallController';

export interface FloatViewBallCallbacks {
  onViewStateChange?: (info: floatView.FloatViewStateChangeInfo) => void;
  onBallStateChange?: (state: floatingBall.FloatingBallState) => void;
  onLimitsChange?: (limits: floatView.FloatViewLimits) => void;
  onRectChange?: (info: floatView.FloatViewRectChangeInfo) => void;
}

function logError(operation: string, error: BusinessError): void {
  hilog.error(DOMAIN, TAG, '%{public}s failed: %{public}s, %{public}s',
    operation, String(error.code), error.message);
}

export class FloatViewBallController {
  private static ballParams: floatingBall.FloatingBallParams | undefined = undefined;
  private static ownsControllers: boolean = false;
  private static startRequested: boolean = false;

  public static async prepare(viewConfig: floatView.FloatViewConfiguration,
    ballConfig: floatingBall.FloatingBallConfiguration, page: string, size: window.Size,
    storage?: LocalStorage, callbacks?: FloatViewBallCallbacks): Promise<void> {
    if (FloatViewController.floatViewController || FloatingBallController.floatingBallController) {
      throw new Error('Controllers already exist');
    }
    try {
      FloatViewBallController.ownsControllers = true;
      await FloatViewController.createFloatView(viewConfig, callbacks?.onViewStateChange,
        callbacks?.onLimitsChange, callbacks?.onRectChange, true);
      await FloatingBallController.createFloatingBall(ballConfig, undefined,
        callbacks?.onBallStateChange, undefined, true);
      await FloatViewController.prepareFloatView(page, size, storage);
      hilog.debug(DOMAIN, TAG, 'Succeed in preparing float view and floating ball');
    } catch (error) {
      logError('Prepare', error as BusinessError);
      throw new Error('Prepare float view and floating ball failed');
    }
  }

  public static async bind(ballParams: floatingBall.FloatingBallParams): Promise<void> {
    const view = FloatViewController.floatViewController;
    const ball = FloatingBallController.floatingBallController;
    if (!view || !ball) { throw new Error('Controllers are not initialized'); }
    try {
      await floatView.bind(view, ball, ballParams);
      FloatViewBallController.ballParams = ballParams;
      hilog.debug(DOMAIN, TAG, 'Succeed in binding float view and floating ball');
    } catch (error) {
      logError('Bind', error as BusinessError);
      throw new Error('Bind float view and floating ball failed');
    }
  }

  public static async start(initialDisplay: 'view' | 'ball'): Promise<void> {
    if (!FloatViewBallController.ballParams) { throw new Error('Bind before starting'); }
    try {
      // 启动失败也可能已改变系统状态，需确认双端停止后再释放。
      FloatViewBallController.startRequested = true;
      if (initialDisplay === 'view') {
        await FloatViewController.startFloatView();
      } else {
        await FloatingBallController.startFloatingBall(FloatViewBallController.ballParams);
      }
      hilog.debug(DOMAIN, TAG, 'Float view/ball start request completed');
    } catch (error) {
      logError('Start', error as BusinessError);
      throw new Error('Start float view/ball failed');
    }
  }

  public static async stop(): Promise<void> {
    try {
      if (FloatViewController.state !== floatView.FloatViewState.STOPPED) {
        await FloatViewController.stopFloatView();
      } else if (FloatingBallController.state !== floatingBall.FloatingBallState.STOPPED) {
        await FloatingBallController.stopFloatingBall();
      }
      hilog.debug(DOMAIN, TAG, 'Float view/ball stop request completed');
    } catch (error) {
      logError('Stop', error as BusinessError);
      throw new Error('Stop float view/ball failed');
    }
  }

  public static async unbind(): Promise<void> {
    const view = FloatViewController.floatViewController;
    const ball = FloatingBallController.floatingBallController;
    if (!view || !ball) { throw new Error('Controllers are not initialized'); }
    if (FloatViewBallController.startRequested &&
      (FloatViewController.state !== floatView.FloatViewState.STOPPED ||
        FloatingBallController.state !== floatingBall.FloatingBallState.STOPPED)) {
      throw new Error('Wait for both STOPPED notifications before unbinding');
    }
    try {
      await floatView.unbind(view, ball);
      FloatViewBallController.ballParams = undefined;
      await FloatViewBallController.release();
      hilog.debug(DOMAIN, TAG, 'Succeed in unbinding float view and floating ball');
    } catch (error) {
      logError('Unbind', error as BusinessError);
      throw new Error('Unbind float view and floating ball failed');
    }
  }

  public static async release(): Promise<void> {
    if (!FloatViewBallController.ownsControllers) { return; }
    if (FloatViewBallController.ballParams &&
      (FloatViewController.state !== floatView.FloatViewState.STOPPED ||
        FloatingBallController.state !== floatingBall.FloatingBallState.STOPPED)) {
      throw new Error('Wait for both STOPPED notifications or unbind before releasing');
    }
    try {
      const view = FloatViewController.floatViewController;
      const ball = FloatingBallController.floatingBallController;
      if (view && FloatViewController.state !== floatView.FloatViewState.STOPPED) {
        view.offStateChange();
        view.offLimitsChange();
        view.offRectChange();
      }
      if (ball && FloatingBallController.state !== floatingBall.FloatingBallState.STOPPED) {
        ball.off('click');
        ball.off('stateChange');
      }
      FloatViewController.unRegisterStateChangeCallback();
      FloatViewController.floatViewController = undefined;
      FloatViewController.state = undefined;
      FloatingBallController.floatingBallController = undefined;
      FloatingBallController.state = undefined;
      FloatViewBallController.ballParams = undefined;
      FloatViewBallController.ownsControllers = false;
      FloatViewBallController.startRequested = false;
      hilog.debug(DOMAIN, TAG, 'Succeed in releasing float view and floating ball');
    } catch (error) {
      logError('Release', error as BusinessError);
      throw new Error('Release float view and floating ball failed');
    }
  }
}
