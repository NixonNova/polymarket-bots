import fs from "fs";

const icaoList = JSON.parse(fs.readFileSync("src/IcaoList.json", "utf8"));
const enumText = fs.readFileSync("src/RegionWeatherSeriesIds.enum.ts", "utf8");

// Map seriesId -> enum key (e.g. "10005" -> "NEW_YORK")
const re = /^\s*([A-Z0-9_]+)\s*=\s*"([0-9]+)"/gm;
const idToKey = new Map();
let m;
while ((m = re.exec(enumText))) idToKey.set(m[2], m[1]);

function prettyCity(enumKey) {
  if (!enumKey) return "";
  return enumKey
    .split("_")
    .map((w) => w.slice(0, 1) + w.slice(1).toLowerCase())
    .join(" ");
}

function formatInTz(now, tz) {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);
  return { date, time };
}

const now = new Date();
const rows = icaoList
  .map((x) => {
    const key = idToKey.get(x.seriesId);
    const city = prettyCity(key) || `SeriesId ${x.seriesId}`;
    const { date, time } = formatInTz(now, x.timezone);
    return { city, date, time };
  })
  .sort((a, b) => {
    const dateCmp = b.date.localeCompare(a.date);
    if (dateCmp !== 0) return dateCmp;
    const timeCmp = b.time.localeCompare(a.time);
    if (timeCmp !== 0) return timeCmp;
    return a.city.localeCompare(b.city);
  });

process.stdout.write("| City name | Current local date | Current local time |\n");
process.stdout.write("|---|---|---|\n");
for (const r of rows) {
  process.stdout.write(`| ${r.city} | ${r.date} | ${r.time} |\n`);
}

