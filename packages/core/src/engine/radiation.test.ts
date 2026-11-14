import { describe, expect, it } from 'vitest';
import type { Environment, Mission } from '../contracts';
import { radiationDose, timeOutsideShelter } from './radiation';
import { NOW, reading } from './test-fixtures';

const mission: Mission = {
  code: 'ARES01',
  environment: 'transit',
  day: 142,
  currentDelayMin: 11,
  linkDown: false,
  crew: [],
};
const transit = { id: 'transit', dailyDoseMSv: 1.6 } as Environment;

describe('radiationDose', () => {
  it('fills days without data with the environment reference and projects linearly', () => {
    const rs = Array.from({ length: 30 }, (_, i) => reading('radiation-dose', 1.8, i * 1440));
    const d = radiationDose(rs, mission, transit, NOW);
    expect(d.estimatedDays).toBe(112);
    expect(d.cumulativeMSv).toBeCloseTo(30 * 1.8 + 112 * 1.6, 1);
    expect(d.dailyMeanMSv).toBeCloseTo(1.8);
    expect(d.projectedMSv).toBeCloseTo(d.cumulativeMSv + 1.8 * (540 - 142), 0);
    expect(d.careerLimitPercent).toBeCloseTo((d.cumulativeMSv / 600) * 100, 0);
    expect(d.estimate).toBe(true);
    expect(d.watch).toBe(false);
  });

  it('averages several readings of the same day and flags watch at 70 %', () => {
    const rs = [reading('radiation-dose', 1, 10), reading('radiation-dose', 3, 5)];
    const d = radiationDose(rs, { ...mission, day: 1 }, transit, NOW, { careerLimitMSv: 2.5 });
    expect(d.cumulativeMSv).toBe(2);
    expect(d.watch).toBe(true);
  });
});

describe('timeOutsideShelter', () => {
  it('(budget − today) / (rate × shielding) in minutes', () => {
    expect(timeOutsideShelter({ todayDoseMSv: 5, localRateMSvH: 10, shielding: 0.5 })).toBe(240);
  });
  it('null without rate or shielding', () => {
    expect(timeOutsideShelter({ todayDoseMSv: 5 })).toBeNull();
    expect(timeOutsideShelter({ todayDoseMSv: 5, localRateMSvH: 10 })).toBeNull();
  });
});
