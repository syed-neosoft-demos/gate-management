import { AdminUser } from "@/lib/admin-types";

export class AdminRequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function adminRequest<T>(
  action: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`/api/admin/${action}`, {
    method: body === undefined ? "GET" : "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok)
    throw new AdminRequestError(
      data.error || "Admin request failed",
      response.status,
    );
  return data as T;
}
export type PasswordResult = { user?: AdminUser; generatedPassword?: string };
