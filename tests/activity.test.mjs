import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { escapeXml, normalizeCalendar, parseDate, parsePublicCalendar,
  renderActivity, updateActivity } from '../scripts/update-activity.mjs';

const fixture = () => [
  { date: '2024-02-28', count: 0, level: 0 },
  { date: '2024-02-29', count: 1, level: 1 },
  { date: '2024-03-01', count: 3, level: 4 },
];

test('strict UTC dates accept leap days and reject malformed, missing or impossible dates', () => {
  assert.equal(new Date(parseDate('2024-02-29')).getUTCDay(), 4);
  for (const invalid of [null, undefined, '', '2023-02-29', '2024-02-30', '2024-13-01', '2024-2-01', '2024-01-01<script>']) {
    assert.throws(() => parseDate(invalid), /invalid calendar date/);
  }
});

test('normalization preserves actual dates, levels and counts across a leap day', () => {
  assert.deepEqual(normalizeCalendar(fixture()), {
    login: 'Lutra11', from: '2024-02-28', to: '2024-03-01', total: 4, activeDays: 2, days: fixture(),
  });
});

test('missing data, invalid counts, levels and gaps fail', () => {
  for (const input of [null, {}, [], [null]]) assert.throws(() => normalizeCalendar(input));
  const mutations = [
    (days) => { days[0].count = -1; },
    (days) => { days[0].count = null; },
    (days) => { days[0].level = 5; },
    (days) => { days[0].level = 1; },
    (days) => { days.splice(1, 1); },
    (days) => { days.push(days[0]); },
  ];
  for (const mutate of mutations) {
    const days = fixture();
    mutate(days);
    assert.throws(() => normalizeCalendar(days));
  }
});

test('SVG escapes XML text and positions calendar cells by real weekday', () => {
  assert.equal(escapeXml(`<script title="x">&'</script>`), '&lt;script title=&quot;x&quot;&gt;&amp;&apos;&lt;/script&gt;');
  const calendar = normalizeCalendar(fixture());
  calendar.login = '<script>&"';
  for (const dark of [false, true]) {
    const svg = renderActivity(calendar, { dark });
    assert.ok(!svg.includes('<script>'));
    assert.match(svg, /&lt;script&gt;&amp;&quot;/);
    assert.match(svg, /x="80" y="176" width="13"/); // Wednesday, not the first row.
    assert.match(svg, /2024-02-29: 1 contribution<\/title>/);
    assert.match(svg, /2024-03-01: 3 contributions<\/title>/);
    assert.match(svg, /4 publicly visible contributions/);
  }
});

test('anonymous calendar parser reads counts and levels and rejects missing tooltips', () => {
  const html = `<td id="day-a" data-date="2024-02-28" data-level="0"></td>
    <td data-date="2024-02-29" data-level="1" id="day-b"></td>
    <td id="day-c" data-date="2024-03-01" data-level="4"></td>
    <tool-tip for="day-a">No contributions on February 28th.</tool-tip>
    <tool-tip for="day-b">1 contribution on February 29th.</tool-tip>
    <tool-tip for="day-c">3 contributions on March 1st.</tool-tip>`;
  assert.deepEqual(normalizeCalendar(parsePublicCalendar(html)).days, fixture());
  assert.throws(() => parsePublicCalendar('<html>Service unavailable</html>'), /could not be verified/);
  assert.throws(() => parsePublicCalendar(html.replace('1 contribution on', 'Unknown count on')), /tooltip/);
  assert.throws(() => parsePublicCalendar(html.replace('data-level="1"', 'data-level="6"')), /cells/);
  assert.throws(() => parsePublicCalendar(html.replace(/<tool-tip for="day-b">.*?<\/tool-tip>/, '')), /could not be verified/);
});

test('network and invalid-response failures leave every existing asset untouched', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'resume-activity-test-'));
  const names = ['activity.svg', 'activity-dark.svg', 'activity.json'];
  try {
    for (const name of names) await writeFile(join(dir, name), `existing ${name}`);
    for (const fetchImpl of [
      async () => { throw new Error('internal request details'); },
      async () => ({ ok: false, status: 403 }),
      async () => ({ ok: true, text: async () => '<html>Service unavailable</html>' }),
      async () => ({ ok: true, text: async () => { throw new Error('internal stream details'); } }),
    ]) {
      await assert.rejects(updateActivity({ outputDir: dir, fetchImpl }),
        (error) => !error.message.includes('internal'));
      for (const name of names) assert.equal(await readFile(join(dir, name), 'utf8'), `existing ${name}`);
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});
