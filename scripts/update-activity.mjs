#!/usr/bin/env node
// Node.js 22+, no packages or token required. Read GitHub's anonymous public
// contribution calendar, validate it, then publish only its daily aggregates.
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DAY = 86_400_000;
const ROOT = fileURLToPath(new URL('../', import.meta.url));

export function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[character]);
}

export function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('GitHub returned an invalid calendar date.');
  }
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    throw new Error('GitHub returned an invalid calendar date.');
  }
  return timestamp;
}

export function normalizeCalendar(input, login = 'Lutra11') {
  if (!Array.isArray(input) || !input.length) {
    throw new Error('GitHub returned an incomplete contribution calendar.');
  }
  const days = input.map((day) => {
    parseDate(day?.date);
    if (!Number.isSafeInteger(day.count) || day.count < 0 || !Number.isInteger(day.level)
        || day.level < 0 || day.level > 4 || (day.count === 0) !== (day.level === 0)) {
      throw new Error('GitHub returned an invalid contribution day.');
    }
    return { date: day.date, count: day.count, level: day.level };
  });
  days.sort((a, b) => a.date.localeCompare(b.date));
  if (days.length > 366) throw new Error('The contribution calendar exceeds one year.');
  for (let index = 1; index < days.length; index += 1) {
    if (parseDate(days[index].date) - parseDate(days[index - 1].date) !== DAY) {
      throw new Error('The contribution calendar contains duplicate or missing dates.');
    }
  }
  const total = days.reduce((sum, day) => sum + day.count, 0);
  if (!Number.isSafeInteger(total)) throw new Error('GitHub calendar total is invalid.');
  return { login, from: days[0].date, to: days.at(-1).date, total,
    activeDays: days.filter((day) => day.count > 0).length, days };
}

// GitHub's anonymous page exposes date cells and their accessible tooltip counts.
// If its markup changes, fail closed instead of publishing unverified data.
export function parsePublicCalendar(html) {
  const attributes = (tag) => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)]
    .map((match) => [match[1], match[2]]));
  const cellsById = new Map();
  for (const match of String(html).matchAll(/<(?:td|rect)\b[^>]*\bdata-date="[^>]*>/g)) {
    const attrs = attributes(match[0]);
    parseDate(attrs['data-date']);
    if (!attrs.id || cellsById.has(attrs.id) || !/^[0-4]$/.test(attrs['data-level'])) {
      throw new Error('Invalid public calendar cells.');
    }
    cellsById.set(attrs.id, { date: attrs['data-date'], level: Number(attrs['data-level']) });
  }
  const counts = new Map();
  for (const match of String(html).matchAll(/<tool-tip\b([^>]*)>([\s\S]*?)<\/tool-tip>/g)) {
    const cell = cellsById.get(attributes(match[1]).for);
    if (!cell) continue;
    const countMatch = match[2].trim().match(/^(No|[\d,]+) contributions? on /);
    if (!countMatch || counts.has(cell.date)) throw new Error('Invalid public calendar tooltip.');
    const count = countMatch[1] === 'No' ? 0 : Number(countMatch[1].replaceAll(',', ''));
    if (!Number.isSafeInteger(count) || count < 0) throw new Error('Invalid public contribution count.');
    counts.set(cell.date, { ...cell, count });
  }
  if (!counts.size || counts.size !== cellsById.size) throw new Error('GitHub public calendar could not be verified.');
  return [...counts.values()];
}

export function renderActivity(calendar, { dark = false } = {}) {
  const theme = dark
    ? { bg: '#0d1117', border: '#303946', text: '#e6edf3', muted: '#a4b2c4', colors: ['#182330', '#173c56', '#235f87', '#3189bd', '#57b3e4'] }
    : { bg: '#ffffff', border: '#dce4ed', text: '#162033', muted: '#607089', colors: ['#edf2f7', '#c8dff2', '#84b9df', '#3c92ce', '#0e75b6'] };
  const first = parseDate(calendar.from);
  const firstSunday = first - new Date(first).getUTCDay() * DAY;
  const position = (date) => {
    const offset = Math.round((parseDate(date) - firstSunday) / DAY);
    return { x: 80 + Math.floor(offset / 7) * 18, y: 122 + (offset % 7) * 18 };
  };
  const cells = calendar.days.map((day) => {
    const { x, y } = position(day.date);
    return `<rect x="${x}" y="${y}" width="13" height="13" rx="3" fill="${theme.colors[day.level]}"><title>${escapeXml(day.date)}: ${day.count} contribution${day.count === 1 ? '' : 's'}</title></rect>`;
  }).join('\n  ');
  let previousMonth = '';
  let previousLabelX = -100;
  const monthLabels = [];
  for (const day of calendar.days) {
    const month = day.date.slice(0, 7);
    if (month === previousMonth) continue;
    previousMonth = month;
    const { x } = position(day.date);
    if (x - previousLabelX < 42) continue;
    previousLabelX = x;
    const label = new Date(parseDate(day.date)).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    monthLabels.push(`<text x="${x}" y="108">${label}</text>`);
  }
  const title = `${calendar.login} · GitHub activity`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="304" viewBox="0 0 1120 304" role="img" aria-labelledby="title description">
  <title id="title">${escapeXml(title)}</title>
  <desc id="description">${calendar.total} publicly visible contributions from ${escapeXml(calendar.from)} to ${escapeXml(calendar.to)}. ${calendar.activeDays} active days. Each square represents one day; stronger blue indicates more contributions.</desc>
  <rect x="0.5" y="0.5" width="1119" height="303" rx="16" fill="${theme.bg}" stroke="${theme.border}"/>
  <g font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif">
    <text x="40" y="49" font-size="22" font-weight="650" fill="${theme.text}">${escapeXml(title)}</text>
    <text x="40" y="74" font-size="13" fill="${theme.muted}">${escapeXml(calendar.from)} - ${escapeXml(calendar.to)}</text>
    <text x="1080" y="49" text-anchor="end" font-size="24" font-weight="650" fill="${dark ? '#57b3e4' : '#0e75b6'}">${calendar.total.toLocaleString('en-US')}</text>
    <text x="1080" y="74" text-anchor="end" font-size="13" fill="${theme.muted}">publicly visible contributions</text>
    <g fill="${theme.muted}" font-size="11">${monthLabels.join('')}<text x="40" y="149">Mon</text><text x="40" y="185">Wed</text><text x="40" y="221">Fri</text></g>
    ${cells}
    <text x="40" y="278" font-size="12" fill="${theme.muted}">${calendar.activeDays} active days · Source: GitHub contribution calendar</text>
    <g font-size="11" fill="${theme.muted}"><text x="888" y="278">Less</text>${theme.colors.map((color, index) => `<rect x="924" y="${267}" width="13" height="13" rx="3" transform="translate(${index * 18},0)" fill="${color}"/>`).join('')}<text x="1023" y="278">More</text></g>
  </g>
</svg>\n`;
}

export async function updateActivity({ login = 'Lutra11',
  now = new Date(), outputDir = resolve(ROOT, 'assets'), fetchImpl = fetch } = {}) {
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(login)) throw new Error('Invalid GitHub username.');
  const generatedAt = now.toISOString();
  const to = generatedAt.slice(0, 10);
  const from = new Date(parseDate(to) - 364 * DAY).toISOString().slice(0, 10);
  // The default page is the rolling year. from/to parameters select a calendar
  // year on GitHub and can include future dates, so trim the default view here.
  const publicUrl = `https://github.com/users/${encodeURIComponent(login)}/contributions`;
  let publicResponse;
  try {
    // Deliberately omit Authorization and cookies: this must be the public view.
    publicResponse = await fetchImpl(publicUrl, { signal: AbortSignal.timeout(30_000),
      headers: { Accept: 'text/html', 'Accept-Language': 'en-US', 'User-Agent': 'Lutra11-Resume-Activity' } });
  } catch { throw new Error('GitHub public calendar request failed; existing assets were kept.'); }
  if (!publicResponse.ok) throw new Error('GitHub public calendar is unavailable; existing assets were kept.');
  let html;
  try { html = await publicResponse.text(); } catch { throw new Error('GitHub public calendar response failed; existing assets were kept.'); }
  const days = parsePublicCalendar(html).filter((day) => day.date >= from && day.date <= to);
  const calendar = normalizeCalendar(days, login);
  if (calendar.from !== from || calendar.to !== to) {
    throw new Error('GitHub returned an unexpected date range; existing assets were kept.');
  }
  const data = { schemaVersion: 1, generatedAt,
    source: publicUrl,
    visibility: 'Publicly visible daily aggregates; no repository or commit details.', ...calendar };
  const files = new Map([
    ['activity.svg', renderActivity(calendar)],
    ['activity-dark.svg', renderActivity(calendar, { dark: true })],
    ['activity.json', `${JSON.stringify(data, null, 2)}\n`],
  ]);
  // No filesystem writes occur until the public response and all days pass.
  await mkdir(outputDir, { recursive: true });
  const staged = [];
  try {
    for (const [name, content] of files) {
      const temporary = resolve(outputDir, `.${name}.${process.pid}.tmp`);
      staged.push({ temporary, target: resolve(outputDir, name) });
      await writeFile(temporary, content, { encoding: 'utf8', flag: 'wx' });
    }
    for (const { temporary, target } of staged) await rename(temporary, target);
  } finally {
    await Promise.all(staged.map(({ temporary }) => rm(temporary, { force: true })));
  }
  return calendar;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  updateActivity().then((calendar) => {
    console.log(`Updated public activity for ${calendar.login}: ${calendar.total} contributions (${calendar.from} to ${calendar.to}).`);
  }).catch((error) => {
    // Errors never print a response body, request headers, or the token.
    console.error(error.message);
    process.exitCode = 1;
  });
}
