import type { ModuleCode } from '../../api/types';

/** Module select options in SRS order (module 1, module 2 areas). */
export const MODULE_OPTIONS: ModuleCode[] = ['specialty', 'tech_safety', 'industrial_safety'];

/** Shared `common.modules.*` translation keys per module code. */
export const MODULE_LABEL_KEYS: Record<ModuleCode, string> = {
  specialty: 'common.modules.specialty',
  tech_safety: 'common.modules.techSafety',
  industrial_safety: 'common.modules.industrialSafety',
};
