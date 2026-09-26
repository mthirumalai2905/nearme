export class SessionError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "SessionError";
  }
}

export function messageFrom(error: unknown) {
  if (error instanceof SessionError) return error.message;
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return "You're offline. We'll reconnect automatically.";
  }
  return "Something went wrong. Try again.";
}
