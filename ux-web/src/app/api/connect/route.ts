import { NextResponse } from "next/server";

export async function POST() {
  const backendUrl = process.env.AI_REALTIME_URL || "http://server:8000";

  try {
    const res = await fetch(`${backendUrl}/api/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Backend error: ${text}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to connect to backend: ${err.message}` },
      { status: 502 }
    );
  }
}
