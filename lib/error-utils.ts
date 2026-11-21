export function formatErrorMessage(err: unknown): string {
  if (!err) return "অজানা সমস্যা হয়েছে।";
  if (typeof err === "string") return err;
  if (typeof err === "object") {
    const obj = err as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
      error_description?: string;
    };
    const parts: string[] = [];
    if (obj.message) parts.push(obj.message);
    else if (obj.error_description) parts.push(obj.error_description);

    if (obj.details) parts.push(`বিবরণ: ${obj.details}`);
    if (obj.hint) parts.push(`ইঙ্গিত: ${obj.hint}`);
    if (obj.code) parts.push(`কোড: ${obj.code}`);

    if (parts.length > 0) return parts.join("\n");
  }
  return String(err);
}
