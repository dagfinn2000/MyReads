import { describe, expect, it } from "vitest";
import { ReadingStatus } from "@prisma/client";
import { settleReadingState } from "@/lib/reading-state";

const now = new Date("2026-10-11T12:00:00.000Z");
const earlier = new Date("2026-09-01T00:00:00.000Z");
const blank = { dateStarted: null, dateFinished: null, currentPage: null };

describe("settleReadingState", () => {
  it("dates and counts a book marked Read without a finish date", () => {
    const s = settleReadingState(ReadingStatus.READING, { ...blank, status: ReadingStatus.READ }, 2, now);
    expect(s.dateFinished).toBe(now);
    expect(s.timesRead).toBe(3);
  });

  it("keeps a finish date that was given", () => {
    const s = settleReadingState(
      null,
      { ...blank, status: ReadingStatus.READ, dateFinished: earlier },
      0,
      now,
    );
    expect(s.dateFinished).toBe(earlier);
    expect(s.timesRead).toBe(1);
  });

  it("uncounts the current pass when a book leaves Read", () => {
    const s = settleReadingState(
      ReadingStatus.READ,
      { ...blank, status: ReadingStatus.WANT_TO_READ, dateFinished: earlier },
      1,
      now,
    );
    expect(s.timesRead).toBe(1);
  });

  it("starts today when a book moves from Want to Read (or is new) to Reading", () => {
    for (const prev of [ReadingStatus.WANT_TO_READ, null]) {
      const s = settleReadingState(prev, { ...blank, status: ReadingStatus.READING }, 0, now);
      expect(s.dateStarted).toBe(now);
    }
  });

  it("does not move the start date of a book resumed from Did Not Finish", () => {
    // Its log entries are placed relative to the start date; moving it to
    // today would re-credit them.
    const s = settleReadingState(ReadingStatus.DNF, { ...blank, status: ReadingStatus.READING }, 0, now);
    expect(s.dateStarted).toBeNull();
  });

  it("leaves a book marked Read undated when asked to, and still counts the read", () => {
    const s = settleReadingState(
      ReadingStatus.WANT_TO_READ,
      { ...blank, status: ReadingStatus.READ },
      0,
      now,
      { undatedFinish: true },
    );
    expect(s.dateFinished).toBeNull();
    expect(s.timesRead).toBe(1);
  });

  it("keeps a given finish date over an undated finish", () => {
    const s = settleReadingState(
      null,
      { ...blank, status: ReadingStatus.READ, dateFinished: earlier },
      0,
      now,
      { undatedFinish: true },
    );
    expect(s.dateFinished).toBe(earlier);
  });

  it("keeps an already-Read book undated when it is saved without a date", () => {
    // A later save (a new rating) must not stamp today on it.
    const s = settleReadingState(ReadingStatus.READ, { ...blank, status: ReadingStatus.READ }, 0, now);
    expect(s.dateFinished).toBeNull();
    expect(s.timesRead).toBe(1);
  });

  it("still finishes today when a book moves to Read without a date", () => {
    const s = settleReadingState(ReadingStatus.READING, { ...blank, status: ReadingStatus.READ }, 0, now, {});
    expect(s.dateFinished).toBe(now);
  });

  it("ignores an undated finish for the other statuses", () => {
    for (const status of [ReadingStatus.READING, ReadingStatus.DNF, ReadingStatus.WANT_TO_READ]) {
      const s = settleReadingState(
        ReadingStatus.WANT_TO_READ,
        { ...blank, status, dateFinished: earlier },
        0,
        now,
        { undatedFinish: true },
      );
      expect(s.dateFinished).toBe(earlier);
      expect(s.timesRead).toBe(0);
    }
    const reading = settleReadingState(null, { ...blank, status: ReadingStatus.READING }, 0, now, {
      undatedFinish: true,
    });
    expect(reading.dateStarted).toBe(now);
  });

  it("keeps the page for Reading and Did Not Finish only", () => {
    const page = { ...blank, currentPage: 120 };
    expect(settleReadingState(null, { ...page, status: ReadingStatus.READING }, 0, now).currentPage).toBe(120);
    expect(settleReadingState(null, { ...page, status: ReadingStatus.DNF }, 0, now).currentPage).toBe(120);
    expect(settleReadingState(null, { ...page, status: ReadingStatus.READ }, 0, now).currentPage).toBeNull();
    expect(settleReadingState(null, { ...page, status: ReadingStatus.WANT_TO_READ }, 0, now).currentPage).toBeNull();
  });
});
