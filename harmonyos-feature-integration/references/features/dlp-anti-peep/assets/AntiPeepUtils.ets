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

import { dlpAntiPeep } from '@kit.DeviceSecurityKit';
import { JSON } from '@kit.ArkTS';
import { BusinessError } from '@kit.BasicServicesKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { common } from '@kit.AbilityKit';

const TAG = 'AntiPeepUtils';

export interface AntiPeepCallback {
  onStatusChanged: (status: dlpAntiPeep.DlpAntiPeepStatus) => Promise<void>;
}

/**
 * can use screen privacy capability
 * */
export function canUseAntiPeep(): boolean {
  return canIUse('SystemCapability.Security.DlpAntiPeep');
}

/**
 * is screen privacy enabled
 * */
export async function isAntiPeepOn(): Promise<boolean> {
  try {
    if (canUseAntiPeep()) {
      let result: boolean = await dlpAntiPeep.isDlpAntiPeepSwitchOn();
      hilog.info(0x0000, TAG, `[isAntiPeepOn] isDlpAntiPeepSwitchOn success. ${result}`);
      return result;
    } else {
      return false;
    }
  } catch (err) {
    hilog.error(0x0000, TAG, `[isAntiPeepOn] isDlpAntiPeepSwitchOn failed.${JSON.stringify(err)}`);
    return false;
  }
}

/**
 * get current screen privacy status
 * */
export function getAntiPeepInfo(): dlpAntiPeep.DlpAntiPeepStatus {
  try {
    if (canUseAntiPeep()) {
      let dlpAntiPeepStatus = dlpAntiPeep.getDlpAntiPeepInfo();
      hilog.info(0x0000, TAG, `getDlpHideInfo success. ${JSON.stringify(dlpAntiPeepStatus)}`);
      return dlpAntiPeepStatus;
    } else {
      return -1;
    }
  } catch (err) {
    hilog.info(0x0000, TAG, `getDlpHideInfo failed. ${JSON.stringify(err)}`);
    return -1;
  }
}

/**
 * listen on screen privacy
 * */
export function listenOnAntiPeepStatus(antiPeepCB: AntiPeepCallback): boolean {
  try {
    if (canUseAntiPeep()) {
      hilog.info(0x0000, TAG, `start on('dlpAntiPeep')`);
      dlpAntiPeep.on('dlpAntiPeep', (dlpAntiPeepStatus: dlpAntiPeep.DlpAntiPeepStatus) => {
        hilog.info(0x0000, TAG, `dlpAntiPeep callback: ${JSON.stringify(dlpAntiPeepStatus)}`);
        if (antiPeepCB) {
          antiPeepCB.onStatusChanged(dlpAntiPeepStatus);
        } else {
          hilog.warn(0x0000, TAG, `antiPeepCB is empty`);
        }
      });
      hilog.info(0x0000, TAG, `on('dlpAntiPeep') ok`);
      return true;
    } else {
      return false;
    }
  } catch (err) {
    hilog.error(0x0000, TAG, `dlpAntiPeep.on failed. ${JSON.stringify(err)}`);
    return false;
  }
}

/**a
 * listen off screen privacy
 * */
export function listenOffAntiPeepStatus() {
  try {
    if (canUseAntiPeep()) {
      hilog.info(0x0000, TAG, `start off('dlpAntiPeep')`);
      dlpAntiPeep.off('dlpAntiPeep');
      hilog.info(0x0000, TAG, `off('dlpAntiPeep') ok`);
    }
  } catch (err) {
    hilog.error(0x0000, TAG, `dlpAntiPeep.off failed. ${JSON.stringify(err)}`);
  }
}

/**
 * Sets the anti peep mask layer.
 * @param windowId The protection application window id.
 * */
export function showSystemMaskLayer(windowId: number): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      if (canUseAntiPeep()) {
        dlpAntiPeep.setAntiPeepMaskLayer(windowId).catch((err: BusinessError) => {
          hilog.error(0x0000, TAG, `Execute setAntiPeepMaskLayer failed. error code:${err.code}, error message:${err.message}`);
          resolve(false);
        }).then(() => {
          hilog.info(0x0000, TAG, `setAntiPeepMaskLayer success`);
          resolve(true);
        })
      } else {
        resolve(false);
      }
    } catch (err) {
      hilog.error(0x0000, TAG, `Call setAntiPeepMaskLayer failed. ${JSON.stringify(err)}`);
      resolve(false);
    }
  });
}

/**
 * 引导用户打开当前应用防窥开关。
 * 调用前由页面检查 API23 和设备能力。
 */
export async function requestAntiPeepOptions(
  context: common.UIAbilityContext): Promise<dlpAntiPeep.AntiPeepOptionsResult> {
  try {
    const result = await dlpAntiPeep.requestAntiPeepOptions(context);
    hilog.info(0x0000, TAG, `[requestAntiPeepOptions] requestAntiPeepOptions success. ${result}`);
    return result;
  } catch (err) {
    hilog.error(0x0000, TAG, `[requestAntiPeepOptions] requestAntiPeepOptions failed.${JSON.stringify(err)}`);
    return dlpAntiPeep.AntiPeepOptionsResult.FAIL;
  }
}
