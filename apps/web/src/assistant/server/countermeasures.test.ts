import { fatigueReading, loadConfig, motionReading, workHoursReading } from '@haven/core';
import { describe, expect, it, vi } from 'vitest';
import { texts } from '@/features/extras/i18n';
import { motionRow } from '@/features/extras/logic/motion';
import { workloadRow } from '@/features/extras/logic/workload';
import { commsCard, commsStatus, motionCard, workloadCard } from './countermeasures';

vi.mock('server-only', () => ({}));

const NOW = new Date('2026-03-10T15:00:00Z');
const member = { id: 'omar', name: 'Omar', lastDataAt: null, noRecentData: false };
const opts = (takenAt: string) => ({ crewMember: 'omar', takenAt, newId: () => takenAt });

describe('comms area', () => {
  it('says the crew acts alone with 12 minutes one way, and when a message arrives', () => {
    const status = commsStatus({ name: 'Ares', currentDelayMin: 12, linkDown: false }, NOW);
    expect(status).toMatchObject({
      mode: 'autonomous',
      oneWayMin: 12,
      roundTripMin: 24,
      sentNowArrivesAt: '2026-03-10T15:12:00.000Z',
      earliestReplyAt: '2026-03-10T15:24:00.000Z',
      crewActsAlone: true,
    });
    const [row] = commsCard({ code: 'DEMOMA', name: 'Ares' }, status, 'es');
    expect(row).toMatchObject({ id: 'DEMOMA', tone: 'amber', label: 'Autónoma · 12 min' });
  });

  it('has no arrival time without a link and is live with the Moon', () => {
    const down = commsStatus({ name: 'Ares', currentDelayMin: 3, linkDown: true }, NOW);
    expect(down).toMatchObject({ mode: 'offline', sentNowArrivesAt: null, crewActsAlone: true });
    const moon = commsStatus({ name: 'Luna', currentDelayMin: 0.0213, linkDown: false }, NOW);
    expect(moon.mode).toBe('realtime');
    expect(commsCard({ code: 'DEMOCN', name: 'Luna' }, moon, 'en')[0]).toMatchObject({
      tone: 'green',
      label: 'Live',
    });
  });
});

describe('crew cards', () => {
  it('shows motion sickness in the words of the tab', () => {
    const { environments } = loadConfig();
    const row = motionRow(
      member,
      [motionReading(7, opts('2026-03-10T09:00:00Z'))],
      { day: 6, environment: 'moon' },
      environments,
      NOW,
    );
    expect(motionCard([row], texts.es)).toEqual([
      { id: 'omar', name: 'Omar', tone: 'red', label: 'Náusea', detail: '7/10' },
    ]);
  });

  it('shows the workload state with the hours of the week', () => {
    const readings = ['04', '05', '06', '07', '08', '09', '10'].map((d) =>
      workHoursReading(11, opts(`2026-03-${d}T19:00:00Z`)),
    );
    const row = workloadRow(
      member,
      [...readings, fatigueReading(5, opts('2026-03-10T19:30:00Z'))],
      NOW,
    );
    expect(workloadCard([row], texts.en)).toEqual([
      { id: 'omar', name: 'Omar', tone: 'red', label: 'Rest', detail: '77 h' },
    ]);
  });
});
