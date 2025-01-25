import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch("http://localhost:11434/api/tags");
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching Ollama models:", error);
    return NextResponse.json(
      { error: "Failed to fetch Ollama models" },
      { status: 500 }
    );
  }
}
