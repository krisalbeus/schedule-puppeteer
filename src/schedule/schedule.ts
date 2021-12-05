import 'source-map-support/register';

import Debug from 'debug';
import { GoogleCal } from './service';
import { Handler } from 'aws-lambda';
import { ScheduleStorage } from './service/schedule-storage.service';
import { Shift } from '../model';
import chromium from 'chrome-aws-lambda';

const puppeteer = chromium.puppeteer;
const debug = Debug('schedule');
const googleCal = new GoogleCal();

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const shiftDiff = (schedule: Shift[], saved: Shift[]) => {
  const isSameShift = (s1: Shift, s2: Shift) => s1.start === s2.start && s1.end == s2.end && s1.title === s2.title;
  const toAdd = schedule.filter((s) => !saved.some((s2) => isSameShift(s, s2)));
  const toDelete = saved.filter((s) => !schedule.some((s2) => isSameShift(s, s2)));
  debug({ schedule, saved, toAdd, toDelete });
  return { toAdd, toDelete };
};

export const handler: Handler = async () => {
  let browser;

  try {
    browser = await puppeteer.launch({
      defaultViewport: { width: 1200, height: 800 },
      headless: true,
      executablePath:
        process.env.IS_OFFLINE || process.env.IS_LOCAL
          ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
          : await chromium.executablePath,
      args: chromium.args
    });

    const page = await browser.newPage();
    await page.goto('https://nbmeol.ros.health.nsw.gov.au/EmployeeOnlineHealth/NBM/Login?forceDesktopVersion=False', {
      waitUntil: ['domcontentloaded', 'networkidle0']
    });

    debug('page loaded');

    const userId = process.env.DEFAULT_USER_ID as string;
    const name = 'Naguna, J';

    await page.type('#Username', userId);
    await page.type('#Password', 'R3gist3r3d');
    await page.click('#btnLogin');

    await page.waitForResponse((response) => response.url().endsWith('GetApprovedRoster'));
    await page.click('#btnPrev');

    let schedule: Shift[] = [],
      duties = [];
    do {
      const finalResponse = await page.waitForResponse((response) => response.url().endsWith('GetApprovedRoster'));
      const responseJson = await finalResponse.json();
      duties = responseJson.duties;
      const thisMonth = duties
        .filter((d: any) =>
          d.assignedStaffGroupings.some((a: any) => a.alsoAssignedPersons.some((aa: any) => aa.displayName === name))
        )
        .map((d: any) => ({ start: d.dutyStart, end: d.dutyEnd, title: d.title }));
      const others = responseJson.nonEffectives.map((d: any) => ({ start: d.start, end: d.end, title: d.title }));

      await sleep(1000);
      await page.click('#btnNext');
      schedule = [...schedule, ...thisMonth, ...others];
    } while (duties.length > 0);

    const storage = new ScheduleStorage();
    // const saved = (await storage.getSchedule(userId)).schedule as Shift[];
    await storage.saveSchedule(userId, { schedule });

    // const { toAdd, toDelete } = shiftDiff(schedule, saved);
    // debug({ toAdd, toDelete });
    // await googleCal.saveSchedule({ add: toAdd, remove: toDelete });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error })
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};
