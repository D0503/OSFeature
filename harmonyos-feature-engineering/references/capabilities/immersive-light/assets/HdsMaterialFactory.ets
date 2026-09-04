import { hdsMaterial, SystemMaterialParams } from '@kit.UIDesignKit';

/** HDS 6.1.0(23)+ 使用。按需合并到现有 HdsNavigation 或 HdsTabs 配置。 */
export class HdsMaterialFactory {
  static adaptive(): SystemMaterialParams {
    return {
      materialType: hdsMaterial.MaterialType.ADAPTIVE,
      materialLevel: hdsMaterial.MaterialLevel.ADAPTIVE
    };
  }

  static deviceAware(): SystemMaterialParams {
    try {
      const types: Array<hdsMaterial.MaterialType> = hdsMaterial.getSystemMaterialTypes();
      return {
        materialType: hdsMaterial.MaterialType.ADAPTIVE,
        materialLevel: types.indexOf(hdsMaterial.MaterialType.IMMERSIVE) >= 0
          ? hdsMaterial.MaterialLevel.EXQUISITE
          : hdsMaterial.MaterialLevel.SMOOTH
      };
    } catch (_) {
      return HdsMaterialFactory.adaptive();
    }
  }

  static none(): SystemMaterialParams {
    return {
      materialType: hdsMaterial.MaterialType.NONE,
      materialLevel: hdsMaterial.MaterialLevel.ADAPTIVE
    };
  }
}
