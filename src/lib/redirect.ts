export function safeRedirect(value: unknown, fallback = "/my-bookings") {
  if (
    typeof value !== "string" ||
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u001f\u007f]/.test(value)
  )
    return fallback;
  try {
    const url = new URL(value, "https://ascent.invalid");
    return url.origin === "https://ascent.invalid" &&
      !url.pathname.startsWith("//")
      ? `${url.pathname}${url.search}${url.hash}`
      : fallback;
  } catch {
    return fallback;
  }
}

export function authRedirect(value: unknown, staff: boolean) {
  return safeRedirect(value, staff ? "/admin" : "/my-bookings");
}
