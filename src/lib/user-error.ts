/** Translate common infrastructure/validation failures while keeping existing
 * short business-rule messages (for example, "Add a rent schedule") useful. */
export function userErrorMessage(error: unknown): string {
  const fallback = "We couldn’t complete this request. Check whether your change was saved before trying again. If the problem continues, ask your administrator for help.";
  if (!(error instanceof Error)) return fallback;
  const message = error.message;
  if (/^Not authenticated\.|^Unauthorized$|session expired/i.test(message)) return "Your sign-in session has ended. Sign in again, then return to this page.";
  if (/^Access denied:|^Forbidden$/i.test(message)) return "Your account does not have permission to do this. Ask your administrator to check your access.";
  if (error.name === "ZodError") return validationMessage(error);
  if (/failed to fetch|fetch failed|networkerror|network request failed|load failed|econn|etimedout|enotfound|connection.*(closed|refused|reset)|timeout|timed out/i.test(message)) return "The connection was interrupted. Check your internet connection, then check whether your change was saved before trying again.";
  if (/failed query|\bSQL\b|postgres|supabase|constraint|duplicate key|violates|permission denied for|row.level security|invalid input syntax|relation .* does not exist|server components render|server action|digest|stack trace|TypeError|ReferenceError|Cannot read properties|undefined is not|ENOENT|EACCES|https?:\/\/|:\/\/|\bat .+\(.+:\d+:\d+\)|^\s*\[\s*\{|^\s*\{/i.test(message) || message.length > 400 || !message.trim()) return fallback;
  return message;
}

function validationMessage(error: Error): string {
  const issues = "issues" in error && Array.isArray(error.issues) ? error.issues : [];
  const labels: Record<string, string> = { notes: "Notes", reference: "Payment reference", paidDate: "Payment date", dueDate: "Rent due date", amount: "Amount", currency: "Currency", paymentMethod: "Payment method", startDate: "Start date", endDate: "End date", displayName: "Name", name: "Name", email: "Email address", size: "File size", reviewed: "Checklist review confirmation", rentConfirmed: "Collected rent confirmation" };
  const hints = issues.slice(0, 3).map((issue: { path?: unknown[]; code?: string; maximum?: unknown }) => {
    const field = issue.path?.at(-1);
    const label = typeof field === "string" ? labels[field] : undefined;
    if (!label) return "Check the required fields and the dates and amounts you entered.";
    const row = issue.path?.[0] === "receipts" && typeof issue.path?.[1] === "number" ? ` for selected payment ${issue.path[1] + 1}` : "";
    if (field === "reviewed" || field === "rentConfirmed") return `Tick the ${label.toLowerCase()} box after checking the details.`;
    if (issue.code === "too_big" && typeof issue.maximum === "number") {
      if (field === "size") return `Choose a file no larger than ${Math.round(issue.maximum / 1024 / 1024)} MB.`;
      if (["notes", "reference", "name", "displayName"].includes(field as string)) return `${label}${row} must be ${issue.maximum.toLocaleString("en-US")} characters or fewer.`;
    }
    return `Check ${label.toLowerCase()}${row} and enter a valid value.`;
  });
  return `Please check the details. ${[...new Set(hints)].join(" ") || "Complete the required fields, then try again."}`;
}
