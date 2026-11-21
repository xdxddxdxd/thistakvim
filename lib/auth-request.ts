import { NextResponse } from "next/server";

export function isNativeAuthForm(request: Request) {
  return request.headers.get("content-type")?.split(";", 1)[0].trim() === "application/x-www-form-urlencoded";
}

export async function readAuthInput(request: Request, native: boolean): Promise<Record<string, unknown> | null> {
  try {
    if (native) return Object.fromEntries(await request.formData());
    const body: unknown = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export function authResponse(native: boolean, location: string, data: Record<string, unknown>, status: number) {
  const headers = { "Cache-Control": "private, no-store" };
  return native
    ? new NextResponse(null, { status: 303, headers: { ...headers, Location: location } })
    : NextResponse.json(data, { status, headers });
}
