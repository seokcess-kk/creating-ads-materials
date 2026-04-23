const KST = "Asia/Seoul";

const DEFAULT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
};

export function formatKst(
  date: Date | string | number,
  options: Intl.DateTimeFormatOptions = DEFAULT_OPTIONS,
): string {
  return new Date(date).toLocaleString("ko-KR", { ...options, timeZone: KST });
}
