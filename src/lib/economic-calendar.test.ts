import { describe, expect, it } from 'vitest';
import {
  isUsEasternDst,
  parseForexDateTime,
  parseForexFactoryXml,
} from './economic-calendar';

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<weeklyevents>
  <event>
    <title><![CDATA[Non-Farm Employment Change]]></title>
    <country>USD</country>
    <date>11-15-2024</date>
    <time>8:30am</time>
    <impact>High</impact>
    <forecast>200K</forecast>
    <previous>180K</previous>
    <url></url>
  </event>
  <event>
    <title><![CDATA[Bank Holiday]]></title>
    <country>EUR</country>
    <date>11-11-2024</date>
    <time>All Day</time>
    <impact>Low</impact>
    <forecast></forecast>
    <previous></previous>
  </event>
  <event>
    <title>ECB Press Conference</title>
    <country>EUR</country>
    <date>06-12-2025</date>
    <time>2:45pm</time>
    <impact>Medium</impact>
    <forecast></forecast>
    <previous></previous>
  </event>
</weeklyevents>`;

describe('parseForexFactoryXml', () => {
  it('parses 3 events from sample XML', () => {
    const events = parseForexFactoryXml(SAMPLE_XML);
    expect(events).toHaveLength(3);
  });

  it('handles CDATA in title', () => {
    const events = parseForexFactoryXml(SAMPLE_XML);
    expect(events[0]?.title).toBe('Non-Farm Employment Change');
  });

  it('normalizes impact to lowercase enum values', () => {
    const events = parseForexFactoryXml(SAMPLE_XML);
    expect(events[0]?.impact).toBe('high');
    expect(events[1]?.impact).toBe('low');
    expect(events[2]?.impact).toBe('medium');
  });

  it('builds notes from forecast and previous', () => {
    const events = parseForexFactoryXml(SAMPLE_XML);
    expect(events[0]?.notes).toContain('200K');
    expect(events[0]?.notes).toContain('180K');
    expect(events[1]?.notes).toBeNull();
    expect(events[2]?.notes).toBeNull();
  });

  it('returns null eventAtUtc for All Day events', () => {
    const events = parseForexFactoryXml(SAMPLE_XML);
    expect(events[1]?.eventAtUtc).toBeNull();
  });

  it('converts 8:30am EST → 13:30 UTC (Nov 15 = EST winter, UTC-5)', () => {
    const events = parseForexFactoryXml(SAMPLE_XML);
    const nfp = events[0]?.eventAtUtc;
    expect(nfp).toBeInstanceOf(Date);
    expect(nfp?.getUTCHours()).toBe(13);
    expect(nfp?.getUTCMinutes()).toBe(30);
    expect(nfp?.getUTCDate()).toBe(15);
    expect(nfp?.getUTCMonth()).toBe(10);
  });

  it('converts 2:45pm EDT → 18:45 UTC (Jun 12 = EDT summer, UTC-4)', () => {
    const events = parseForexFactoryXml(SAMPLE_XML);
    const ecb = events[2]?.eventAtUtc;
    expect(ecb).toBeInstanceOf(Date);
    expect(ecb?.getUTCHours()).toBe(18);
    expect(ecb?.getUTCMinutes()).toBe(45);
  });
});

describe('isUsEasternDst', () => {
  it('returns false in January (winter)', () => {
    expect(isUsEasternDst(2024, 1, 15)).toBe(false);
  });

  it('returns true in July (full summer)', () => {
    expect(isUsEasternDst(2024, 7, 15)).toBe(true);
  });

  it('returns false in December', () => {
    expect(isUsEasternDst(2024, 12, 25)).toBe(false);
  });

  it('returns true on March 10, 2024 (2nd Sunday)', () => {
    expect(isUsEasternDst(2024, 3, 10)).toBe(true);
  });

  it('returns false on March 9, 2024 (day before DST)', () => {
    expect(isUsEasternDst(2024, 3, 9)).toBe(false);
  });

  it('returns false on November 3, 2024 (1st Sunday → DST ends)', () => {
    expect(isUsEasternDst(2024, 11, 3)).toBe(false);
  });

  it('returns true on November 2, 2024 (day before DST ends)', () => {
    expect(isUsEasternDst(2024, 11, 2)).toBe(true);
  });
});

describe('parseForexDateTime', () => {
  it('returns null for empty time', () => {
    expect(parseForexDateTime('11-15-2024', null)).toBeNull();
    expect(parseForexDateTime('11-15-2024', '')).toBeNull();
  });

  it('returns null for "Tentative"', () => {
    expect(parseForexDateTime('11-15-2024', 'Tentative')).toBeNull();
  });

  it('returns null for "All Day"', () => {
    expect(parseForexDateTime('11-15-2024', 'All Day')).toBeNull();
  });

  it('parses 12:00am as midnight', () => {
    const d = parseForexDateTime('11-15-2024', '12:00am')!;
    expect(d).not.toBeNull();
    // 00:00 EST = 05:00 UTC
    expect(d.getUTCHours()).toBe(5);
  });

  it('parses 12:00pm as noon EST → 17:00 UTC', () => {
    const d = parseForexDateTime('11-15-2024', '12:00pm')!;
    expect(d.getUTCHours()).toBe(17);
  });
});
