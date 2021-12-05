import { addDays, subDays } from 'date-fns';

import Debug from 'debug';
import { Shift } from '../../model';
import { google } from 'googleapis';
import { zonedTimeToUtc } from 'date-fns-tz';

const debug = Debug('schedule');

// eslint-disable-next-line @typescript-eslint/naming-convention
const { OAuth2 } = google.auth;
const oauth2Client = new OAuth2(
  '333459176218-imasigdo2ubci5c2fh0a3j7abtgmgi1r.apps.googleusercontent.com',
  'TbLZ4OCLFcRWZ-fwnS0_RHod'
);
oauth2Client.setCredentials({
  refresh_token:
    '1//04HzYfkJ196j7CgYIARAAGAQSNwF-L9IrokR-Giov1XOXVTFSVZtiTxWlR4nVSo5O9tC6XGaU2TobZiWk2u-8fxkwVZ8WC46G1YY'
});

const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
const calendarId = 'ufm0tike6e5dkvis3vhm2sr50c@group.calendar.google.com';
const shiftToFriendlyTitle = (shift: string) => {
  switch (shift) {
    case 'A':
      return 'Morning shift';
    case 'P':
      return 'Afternoon shift';
    case 'N':
      return 'Night shift';
    default:
      return shift;
  }
};

const sydneyTz = 'Australia/Sydney';

export class GoogleCal {
  async saveSchedule(options: { add: Shift[]; remove: Shift[] }) {
    const { add: toAdd, remove: toRemove } = options;
    if (!toAdd.length && !toRemove.length) {
      return;
    }
    debug({ toAdd, toRemove });

    const now = Date.now();
    const earliest = subDays(now, 45);
    const latest = addDays(now, 90);

    debug({ earliest, latest });
    const listResult = await calendar.events.list({
      calendarId,
      timeMin: zonedTimeToUtc(earliest, sydneyTz),
      timeMax: zonedTimeToUtc(latest, sydneyTz)
    });
    let saved = listResult.data.items?.map((i) => ({
      id: i.id,
      title: i.summary,
      start: new Date(i.start.dateTime).toISOString(),
      end: new Date(i.end?.dateTime).toISOString()
    }));
    debug(JSON.stringify(saved));


    debug(
      JSON.stringify(
        saved?.find((s) => s.title == 'XX'),
        undefined,
        2
      )
    );
    const removeIds = toRemove
      .map(
        (s) =>
          saved?.find(
            (s2) =>
              s2.start &&
              s2.end &&
              zonedTimeToUtc(s.start, sydneyTz).toISOString() === s2.start &&
              zonedTimeToUtc(s.end, sydneyTz).toISOString() === s2.end
          )?.id
      )
      .filter((i) => !!i);

    if (toAdd.length >= removeIds.length) {
      await Promise.all(
        toAdd.slice(removeIds.length).map((s) =>
          calendar.events.insert({
            calendarId,
            requestBody: {
              summary: shiftToFriendlyTitle(s.title),
              start: { dateTime: zonedTimeToUtc(s.start, sydneyTz) },
              end: { dateTime: zonedTimeToUtc(s.end, sydneyTz) }
            }
          })
        )
      );
    } else {
      debug('remove ' + removeIds.slice(toAdd.length));
      await Promise.all(
        removeIds.slice(toAdd.length).map((id) =>
          calendar.events.delete({
            calendarId,
            eventId: id
          })
        )
      );
    }
    const min = Math.min(toAdd.length, removeIds.length);
    for (let i = 0; i < min; i++) {
      debug(`update ${removeIds[i]} to ${toAdd[i]}`);
      await Promise.all(
        removeIds.map((id) =>
          calendar.events.update({
            calendarId,
            eventId: id,
            requestBody: {
              summary: shiftToFriendlyTitle(toAdd[i].title),
              start: { dateTime: zonedTimeToUtc(toAdd[i].start, sydneyTz) },
              end: { dateTime: zonedTimeToUtc(toAdd[i].end, sydneyTz) }
            }
          })
        )
      );
    }
  }
}
