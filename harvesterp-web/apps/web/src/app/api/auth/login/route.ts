import { type NextRequest, NextResponse } from "next/server";
import { login, UnauthorizedError, ValidationError } from "@harvesterp/sdk";
import { setSessionCookie, setRefreshCookie } from "@/lib/session";

/**
 * POST /api/auth/login
 *
 * Proxies the login request to FastAPI, sets an httpOnly session cookie on
 * success, and returns the user object. The raw JWT never touches the
 * browser — it lives only in the cookie.
 *
 * Body: { username: string; password: string }
 * Response 200: { user: LoginUserInfo }
 * Response 400: { error: string }   — missing/invalid body
 * Response 401: { error: string }   — bad credentials or FastAPI error
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Parse and validate the request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body — expected JSON" },
      { status: 400 },
    );
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { error: "username and password are required" },
      { status: 400 },
    );
  }

  const payload = body as Record<string, unknown>;
  const username = payload["username"];
  const password = payload["password"];

  if (typeof username !== "string" || username.trim().length === 0) {
    return NextResponse.json(
      { error: "username is required" },
      { status: 400 },
    );
  }
  if (typeof password !== "string" || password.length === 0) {
    return NextResponse.json(
      { error: "password is required" },
      { status: 400 },
    );
  }

  // Authenticate against FastAPI via the SDK
  try {
    const session = await login(username.trim(), password, {
      baseUrl: process.env.HARVESTERP_API_URL ?? "http://localhost:8000",
    });

    await setSessionCookie(session.access_token);
    await setRefreshCookie(session.refresh_token);

    return NextResponse.json({ user: session.user });
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 401 },
    );
  }
}
