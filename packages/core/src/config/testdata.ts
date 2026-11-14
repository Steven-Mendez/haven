// Test data (EQUIPOS.md, «Producto real» §4–5): scripted readings for seeds, tests and dev tools.
// No screen imports this. Note for Vega: import `scenarios` from '../config/testdata' in
// src/testdata; once you do, remove the re-export at the end of ./index.ts.
import cabinAtmosphere from '../../config/testdata/scenarios/cabin-atmosphere.json';
import nominal from '../../config/testdata/scenarios/nominal.json';
import sleepMood from '../../config/testdata/scenarios/sleep-mood.json';
import solarStorm from '../../config/testdata/scenarios/solar-storm.json';
import video from '../../config/testdata/scenarios/video.json';
import type { Scenario } from '../contracts';

/**
 * Test scenarios (P04). Add every new file from config/testdata/scenarios here. Files may carry an
 * optional extra `categorical` array (heart rhythm and symptoms) that the `Scenario` contract does
 * not type; see config/README.md.
 */
export const scenarios: Scenario[] = [
  nominal as unknown as Scenario,
  video as unknown as Scenario,
  solarStorm as unknown as Scenario,
  cabinAtmosphere as unknown as Scenario,
  sleepMood as unknown as Scenario,
];
