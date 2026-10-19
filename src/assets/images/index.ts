// Optimised WebP assets, bundled and hashed by Vite (never reference /src/... paths directly:
// they only resolve in the dev server and 404 in production builds).
import hero from './hero_gym_apex.webp';
import facilityWeights from './facility_weights.webp';
import facilityTurf from './facility_functional_turf.webp';
import facilityMachines from './facility_machines_jungle.webp';
import facilitySauna from './facility_recovery_sauna.webp';
import coachHendra from './coach_hendra.webp';
import coachSarah from './coach_sarah.webp';
import coachDimas from './coach_dimas.webp';
import coachMaya from './coach_maya.webp';
import coachBambang from './coach_bambang.webp';
import coachRio from './coach_rio.webp';

export const IMAGES = {
  hero,
  facilityWeights,
  facilityTurf,
  facilityMachines,
  facilitySauna,
  coachHendra,
  coachSarah,
  coachDimas,
  coachMaya,
  coachBambang,
  coachRio,
} as const;
