export const BUSINESS_TIME_ZONE = "Asia/Dhaka";

const dateParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function businessDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = Object.fromEntries(
    dateParts.formatToParts(date).map(({ type, value: part }) => [type, part]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function businessMonthKey(value = new Date()) {
  return businessDateKey(value).slice(0, 7);
}
