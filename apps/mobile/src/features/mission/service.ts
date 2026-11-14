import { AppState } from 'react-native';
import { bus } from '@/shared/events';
import { syncCurrentMission } from './hooks/missions';

const POLL_MS = 15_000;
let started = false;

export function startMissionSync() {
  if (started) return;
  started = true;
  const sync = () => {
    syncCurrentMission().catch((error) => console.warn('[mission] sync failed', error));
  };
  sync();
  setInterval(sync, POLL_MS);
  AppState.addEventListener('change', (state) => {
    if (state === 'active') sync();
  });
  let linkDown: boolean | undefined;
  bus.on('mission:changed', (mission) => {
    if (linkDown === true && !mission.linkDown) sync();
    linkDown = mission.linkDown;
  });
}
