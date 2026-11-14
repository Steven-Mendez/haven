import cabinAtmosphere from '../../config/testdata/scenarios/cabin-atmosphere.json';
import nominal from '../../config/testdata/scenarios/nominal.json';
import sleepMood from '../../config/testdata/scenarios/sleep-mood.json';
import solarStorm from '../../config/testdata/scenarios/solar-storm.json';
import video from '../../config/testdata/scenarios/video.json';
import type { Scenario } from '../contracts';

export const scenarios: Scenario[] = [
  nominal as unknown as Scenario,
  video as unknown as Scenario,
  solarStorm as unknown as Scenario,
  cabinAtmosphere as unknown as Scenario,
  sleepMood as unknown as Scenario,
];
