import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Validate API key early with a helpful error
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY. Add it to your environment/.env and restart the server." },
        { status: 500 }
      );
    }

    // Allow overriding the realtime model via env, with a sensible default
    const model = process.env.OPENAI_REALTIME_MODEL || "gpt-4o-realtime-preview";

    const response = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
        }),
      }
    );
    // If OpenAI returns a non-2xx, forward the error and status to the client for easier debugging
    if (!response.ok) {
      let errorBody: any = null;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = { error: await response.text() };
      }
      return NextResponse.json(
        {
          error: "Failed to create realtime session",
          details: errorBody,
          hint: "Check OPENAI_API_KEY validity and OPENAI_REALTIME_MODEL access/typo.",
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in /session:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
