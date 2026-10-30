/*
 * Copyright (c) 2025 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { floatingBall } from '@kit.ArkUI';
import { Want } from '@kit.AbilityKit';
import { deviceInfo, BusinessError } from '@kit.BasicServicesKit';
import { hilog } from '@kit.PerformanceAnalysisKit';

const DOMAIN: number = 0xF811;
const TAG: string = 'FloatingBallController';

function logError(operation: string, error: BusinessError): void {
  hilog.error(DOMAIN, TAG, '%{public}s failed: %{public}s, %{public}s',
    operation, String(error.code), error.message);
}

export class FloatingBallController {
  public static floatingBallController: floatingBall.FloatingBallController | undefined = undefined;
  public static state: floatingBall.FloatingBallState | undefined = undefined;

  public static canUseFloatingBall(): boolean {
    try {
      if (!deviceInfo.apiAvailable(20)) { return false; }
      if (!canIUse('SystemCapability.Window.SessionManager')) { return false; }
      return floatingBall.isFloatingBallEnabled();
    } catch (err) {
      logError('Check capability', err as BusinessError);
      return false;
    }
  }

  public static createFloatingBall(
    config: floatingBall.FloatingBallConfiguration,
    onClick?: () => void,
    onStateChange?: (state: floatingBall.FloatingBallState) => void,
    want?: Want,
    retainControllerOnStopped: boolean = false): Promise<void> {
    if (FloatingBallController.floatingBallController) {
      return Promise.reject(new Error('FloatingBall controller already exists'));
    }
    return floatingBall.create(config).then((controller: floatingBall.FloatingBallController) => {
      hilog.debug(DOMAIN, TAG, 'Succeed in creating FloatingBall controller');
      FloatingBallController.floatingBallController = controller;
      FloatingBallController.state = undefined;
      try {
        controller.on('click', () => {
          hilog.debug(DOMAIN, TAG, 'FloatingBall onClickEvent');
          if (want !== undefined) {
            controller.restoreMainWindow(want).then(() => {
              hilog.debug(DOMAIN, TAG, 'Success in restoring FloatingBall main window');
            }).catch((err: BusinessError) => {
              logError('Restore FloatingBall main window', err);
            });
          }
          onClick?.();
        });
        controller.on('stateChange', (state: floatingBall.FloatingBallState) => {
          hilog.debug(DOMAIN, TAG, 'FloatingBall stateChange: %{public}d', state);
          FloatingBallController.state = state;
          if (state === floatingBall.FloatingBallState.STOPPED) {
            controller.off('click');
            controller.off('stateChange');
            // 绑定场景在解绑完成后释放引用，监听仍在 STOPPED 时清理。
            if (!retainControllerOnStopped) { FloatingBallController.floatingBallController = undefined; }
            hilog.debug(DOMAIN, TAG, 'FloatingBall stopped and listeners removed');
          }
          onStateChange?.(state);
        });
        hilog.debug(DOMAIN, TAG, 'Succeed in registering FloatingBall listeners');
      } catch (err) {
        logError('Register FloatingBall listeners', err as BusinessError);
        controller.off('click');
        controller.off('stateChange');
        FloatingBallController.floatingBallController = undefined;
        throw new Error('Register FloatingBall listeners failed');
      }
    }).catch((err: BusinessError) => {
      logError('Create FloatingBall controller or listeners', err);
      throw new Error('Create FloatingBall controller or listeners failed');
    });
  }

  public static startFloatingBall(startParams: floatingBall.FloatingBallParams): Promise<void> {
    const controller = FloatingBallController.floatingBallController;
    if (!controller) { return Promise.reject(new Error('FloatingBall controller is not initialized')); }
    return controller.startFloatingBall(startParams).then(() => {
      hilog.debug(DOMAIN, TAG, 'FloatingBall start request completed');
    }).catch((err: BusinessError) => {
      logError('Start FloatingBall', err);
      throw new Error('Start FloatingBall failed');
    });
  }

  public static updateFloatingBall(updateParams: floatingBall.FloatingBallParams): Promise<void> {
    const controller = FloatingBallController.floatingBallController;
    if (!controller) { return  Promise.reject(new Error('FloatingBall controller is not initialized')); }
    return controller.updateFloatingBall(updateParams).then(() => {
      hilog.debug(DOMAIN, TAG, 'Succeed in updating FloatingBall');
    }).catch((err: BusinessError) => {
      logError('Update FloatingBall', err);
      throw new Error('Update FloatingBall failed');
    });
  }

  public static stopFloatingBall(): Promise<void> {
    const controller = FloatingBallController.floatingBallController;
    if (!controller) { return Promise.reject(new Error('FloatingBall controller is not initialized')); }
    // 停止请求完成不代表球已销毁，引用由 STOPPED 回调清理。
    return controller.stopFloatingBall().then(() => {
      hilog.debug(DOMAIN, TAG, 'FloatingBall stop request completed');
    }).catch((err: BusinessError) => {
      logError('Stop FloatingBall', err);
      throw new Error('Stop FloatingBall failed');
    });
  }
}
