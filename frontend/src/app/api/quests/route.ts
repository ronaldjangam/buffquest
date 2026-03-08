import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface QuestModerationRequest {
  title?: string;
  description?: string;
  creatorId?: string;
  skipDb?: boolean;
}

interface ModerationDecision {
  is_approved?: boolean;
  reason?: string;
}

// Initialize Gemini Client
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is missing");
    return null;
  }
  return new GoogleGenerativeAI(apiKey);
};

export async function POST(request: Request) {
  try {
    const body = await request.json() as QuestModerationRequest;
    const { title, description, creatorId, skipDb } = body;

    // Basic Validation
    if (!title || !description || !creatorId) {
      return NextResponse.json(
        { error: 'Missing required fields: title, description, and creatorId are mandatory.' },
        { status: 400 }
      );
    }

    // 1. AI Moderation Check
    const genAI = getGeminiClient();
    if (!genAI) {
      return NextResponse.json({ error: "AI Moderation service unavailable (Missing API Key)." }, { status: 500 });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
      }
    });

    const prompt = `You are the automated moderator for 'BuffQuest'. Analyze reasonable requests such as grabbing items from across campus. 
Analyze this quest submission:
Title: ${title}
Description: ${description}

Return ONLY valid JSON in this exact format:
{
  "is_approved": true/false,
  "reason": "If false, one short user-friendly reason why."
}`;

    // Standard contents format: pass prompt directly or as a Content object
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const decision = JSON.parse(responseText || "{}") as ModerationDecision;

    if (decision.is_approved !== true) {
      return NextResponse.json(
        { error: decision.reason || "Quest flagged by moderation filter." },
        { status: 400 }
      );
    }

    // 2. Database Insertion (NEXT.js ROUTE SHOULD NOT WRITE TO DB)
    // We strictly use the FastAPI backend for all database writes to ensure 
    // consistency across Enums, rewards, and constraints.
    if (!skipDb) {
      console.warn("DB write attempted via /api/quests route. Redirecting to FastAPI logic is recommended.");
    }

    return NextResponse.json({ 
      success: true, 
      moderation: { is_approved: true },
      note: "Quest approved by AI. Final insertion should be handled by the FastAPI backend."
    }, { status: 201 });

  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Critical API Error in /api/quests:", error);
    return NextResponse.json(
      {
        error: "Internal server error processing quest.",
        detail,
      },
      { status: 500 }
    );
  }
}
