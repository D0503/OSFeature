/*
 * Copyright (C) 2026 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { floatView, window } from '@kit.ArkUI';
import { deviceInfo, BusinessError } from '@kit.BasicServicesKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { abilityAccessCtrl, common, Permissions } from '@kit.AbilityKit';

const DOMAIN: number = 0xF811;
const TAG: string = 'FloatViewController';
const PERMISSION_ARRAY: Permissions[] = ['ohos.permission.FLOAT_VIEW'];

function logError(operation: string, error: BusinessError): void {
  hilog.error(DOMAIN, TAG, '%{public}s failed: %{public}s, %{public}s',
    operation, String(error.code), error.message);
}

export async function requestFloatViewPermission(context: common.UIAbilityContext): Promise<boolean> {
  try {
    const atManager: abilityAccessCtrl.AtManager = abilityAccessCtrl.createAtManager();
    const requestStatus =
      await atManager.requestPermissionsFromUser(context, PERMISSION_ARRAY);
    const results = requestStatus?.authResults ?? [];
    return results.length > 0 && results.every(item => item === 0);
  } catch (error) {
    logError('Request FLOAT_VIEW permission', error as BusinessError);
  }
  return false;
}

export class FloatViewController {
  public static floatViewController: floatView.FloatViewController | undefined = undefined;
  public static state: floatView.FloatViewState | undefined = undefined;

  public static canUseFloatView(): boolean {
    try {
      if (deviceInfo.sdkApiVersion < 26) { return false; }
      if (!canIUse('SystemCapability.Window.SessionManager')) { return false; }
      return floatView.isFloatViewEnabled();
    } catch (err) {
      logError('Check capability', err as BusinessError);
      return false;
    }
  }

  public static async createFloatView(
    config: floatView.FloatViewConfiguration,
    onStateChange?: (info: floatView.FloatViewStateChangeInfo) => void,
    onLimitsChange?: (limits: floatView.FloatViewLimits) => void,
    onRectChange?: (info: floatView.FloatViewRectChangeInfo) => void): Promise<void> {
    if (FloatViewController.floatViewController) {
      throw new Error('Float view controller already exists');
    }
    try {
      const controller = await floatView.create(config);
      hilog.debug(DOMAIN, TAG, 'Succeed in creating float view controller');
      FloatViewController.floatViewController = controller;
      FloatViewController.state = undefined;
      try {
        controller.onStateChange((info: floatView.FloatViewStateChangeInfo) => {
          FloatViewController.state = info.state;
          hilog.debug(DOMAIN, TAG, 'Float view state: %{public}d, reason: %{public}s', info.state, info.stopReason);
          if (info.state === floatView.FloatViewState.STOPPED) {
            controller.offStateChange();
            controller.offLimitsChange();
            if (onRectChange) { controller.offRectChange(); }
            FloatViewController.floatViewController = undefined;
            hilog.debug(DOMAIN, TAG, 'Float view stopped and listeners removed');
          }
          onStateChange?.(info);
        });
        controller.onLimitsChange((limits: floatView.FloatViewLimits) => {
          hilog.debug(DOMAIN, TAG, 'Float view limits: %{public}s', JSON.stringify(limits));
          onLimitsChange?.(limits);
        });
        if (onRectChange) {
          controller.onRectChange((info: floatView.FloatViewRectChangeInfo) => {
            hilog.debug(DOMAIN, TAG, 'Float view rect: %{public}s', JSON.stringify(info));
            onRectChange(info);
          });
        }
        hilog.debug(DOMAIN, TAG, 'Succeed in registering float view listeners');
      } catch (err) {
        controller.offStateChange();
        controller.offLimitsChange();
        if (onRectChange) { controller.offRectChange(); }
        FloatViewController.floatViewController = undefined;
        throw err;
      }
    } catch (err) {
      logError('Create float view controller or listeners', err as BusinessError);
      throw err;
    }
  }

  public static async startFloatView(page: string, size: window.Size,
    storage?: LocalStorage): Promise<void> {
    const controller = FloatViewController.floatViewController;
    if (!controller) { throw new Error('Float view controller is not initialized'); }
    try {
      await controller.setUIContext(page, storage);
      hilog.debug(DOMAIN, TAG, 'Succeed in loading float view page');
      await controller.setWindowSize(size);
      hilog.debug(DOMAIN, TAG, 'Succeed in setting float view size');
      await controller.start();
      hilog.debug(DOMAIN, TAG, 'Float view start request completed');
    } catch (err) {
      logError('Prepare and start float view', err as BusinessError);
      throw err;
    }
  }

  public static async setWindowSize(size: window.Size): Promise<void> {
    const controller = FloatViewController.floatViewController;
    if (!controller) { throw new Error('Float view controller is not initialized'); }
    try {
      await controller.setWindowSize(size);
      hilog.debug(DOMAIN, TAG, 'Succeed in setting float view size');
    } catch (err) {
      logError('Set float view size', err as BusinessError);
      throw err;
    }
  }

  public static async switchTemplate(property: floatView.TemplateProperty): Promise<void> {
    const controller = FloatViewController.floatViewController;
    if (!controller) { throw new Error('Float view controller is not initialized'); }
    try {
      await controller.switchTemplate(property);
      hilog.debug(DOMAIN, TAG, 'Succeed in switching float view template');
    } catch (err) {
      logError('Switch float view template', err as BusinessError);
      throw err;
    }
  }

  public static async restoreMainWindow(wantParameters?: Record<string, Object>): Promise<void> {
    const controller = FloatViewController.floatViewController;
    if (!controller || FloatViewController.state !== floatView.FloatViewState.STARTED) {
      throw new Error('Float view is not in STARTED state');
    }
    try {
      await controller.restoreMainWindow(wantParameters);
      hilog.debug(DOMAIN, TAG, 'Succeed in restoring float view main window');
    } catch (err) {
      logError('Restore main window', err as BusinessError);
      throw err;
    }
  }

  public static getWindowProperties(): floatView.FloatViewProperties {
    const controller = FloatViewController.floatViewController;
    const state = FloatViewController.state;
    if (!controller || state === undefined || state === floatView.FloatViewState.STOPPED ||
      state === floatView.FloatViewState.ERROR) {
      throw new Error('Float view window is not available');
    }
    return controller.getWindowProperties();
  }

  public static async stopFloatView(): Promise<void> {
    const controller = FloatViewController.floatViewController;
    if (!controller) { throw new Error('Float view controller is not initialized'); }
    // 停止请求完成不代表窗口已销毁，引用由 STOPPED 回调清理。
    try {
      await controller.stop();
      hilog.debug(DOMAIN, TAG, 'Float view stop request completed');
    } catch (err) {
      logError('Stop float view', err as BusinessError);
      throw err;
    }
  }
}
