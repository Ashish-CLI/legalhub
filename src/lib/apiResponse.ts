import { NextResponse } from "next/server";

export const ApiResponse = {
  success: (data: unknown, status = 200) =>
    NextResponse.json(data, { status }),

  error: (message: string, status = 500) =>
    NextResponse.json({ error: message }, { status }),

  unauthorized: () =>
    NextResponse.json({ error: "Authentication required." }, { status: 401 }),

  forbidden: (p0?: string) =>
    NextResponse.json({ error: "Access denied." }, { status: 403 }),

  notFound: (resource = "Resource") =>
    NextResponse.json({ error: `${resource} not found.` }, { status: 404 }),

  badRequest: (message: string) =>
    NextResponse.json({ error: message }, { status: 400 }),
};
