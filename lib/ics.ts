// lib/ics.ts
// Generates an .ics calendar file for AtomQuest check-in window deadlines.
// Pure client-side — zero server cost.

export interface ICSEvent {
  title: string;
  description: string;
  start: Date;
  end: Date;
  uid: string;
}

function pad(n: number) { return String(n).padStart(2, "0"); }

function toICSDate(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

export function generateICS(events: ICSEvent[]): string {
  const now = toICSDate(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AtomQuest Portal//AtomQuest//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:AtomQuest Check-in Schedule",
    "X-WR-TIMEZONE:Asia/Kolkata",
  ];

  for (const ev of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${ev.uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${toICSDate(ev.start)}`,
      `DTEND:${toICSDate(ev.end)}`,
      `SUMMARY:${ev.title}`,
      `DESCRIPTION:${ev.description.replace(/\n/g, "\\n")}`,
      "STATUS:CONFIRMED",
      "BEGIN:VALARM",
      "TRIGGER:-P1D",
      "ACTION:DISPLAY",
      `DESCRIPTION:Reminder: ${ev.title}`,
      "END:VALARM",
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadICS(events: ICSEvent[], filename = "atomquest-checkins.ics") {
  const content = generateICS(events);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function cycleToICSEvents(cycle: {
  name: string;
  goalSettingOpen: string; goalSettingClose: string;
  q1Open: string; q1Close: string;
  q2Open: string; q2Close: string;
  q3Open: string; q3Close: string;
  q4Open: string; q4Close: string;
}): ICSEvent[] {
  const windows = [
    { label: "Goal Setting Window", open: cycle.goalSettingOpen, close: cycle.goalSettingClose, q: "GS" },
    { label: "Q1 Check-in Window",  open: cycle.q1Open,          close: cycle.q1Close,          q: "Q1" },
    { label: "Q2 Check-in Window",  open: cycle.q2Open,          close: cycle.q2Close,          q: "Q2" },
    { label: "Q3 Check-in Window",  open: cycle.q3Open,          close: cycle.q3Close,          q: "Q3" },
    { label: "Q4 Check-in Window",  open: cycle.q4Open,          close: cycle.q4Close,          q: "Q4" },
  ];

  return windows.map((w) => ({
    uid: `atomquest-${cycle.name.replace(/\s+/g, "-")}-${w.q}@atomberg.com`,
    title: `AtomQuest ${cycle.name} — ${w.label}`,
    description: `${w.label} for ${cycle.name}.\nSubmit your progress update in AtomQuest before the window closes.`,
    start: new Date(w.open),
    end: new Date(w.close),
  }));
}
