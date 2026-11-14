import 'server-only';
import { type Language, translate } from '@/lib/i18n';
import type { CrewResponse } from '@/server/types';
import type { RosterMember } from './components/crew-roster';
import { joinLink, joinQrSvg } from './server';

/**
 * The roster as Earth manages it: everyone in the mission, `waiting` until their first packet arrives, each
 * with their personal join link and QR (mission + who they are + where Earth is).
 */
export async function rosterOf(
  crew: CrewResponse['crew'],
  mission: string,
  earthUrl: string,
  lang: Language,
): Promise<RosterMember[]> {
  return Promise.all(
    crew.map(async (m) => {
      const link = joinLink(mission, m.id, earthUrl);
      return {
        id: m.id,
        name: m.name,
        ...(m.role ? { role: translate(m.role, lang) } : {}),
        waiting: m.lastPacket === null,
        lastPacketAt: m.lastDataAt,
        hasWatch: m.hasWatch,
        invite: { link, qr: await joinQrSvg(link) },
      };
    }),
  );
}
