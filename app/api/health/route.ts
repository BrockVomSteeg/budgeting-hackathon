import { NextResponse } from "next/server";
import { MODEL } from "@/lib/claude";

export const dynamic = "force-dynamic";

// Reports which keys are configured (true/false only, never values).
export function GET() {
  return NextResponse.json(
    {
      anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
      model: MODEL,
      elevenlabsKey: Boolean(process.env.ELEVENLABS_API_KEY),
      elevenlabsAgent: Boolean(process.env.ELEVENLABS_AGENT_ID),
      voiceOverride: process.env.ELEVENLABS_VOICE_OVERRIDE === "1",
    },
    { headers: { "cache-control": "no-store" } },
  );
}
