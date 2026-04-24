// Chat bot edge function — routes to Helper (Gemma) or ClueBot (Gemini Flash 2.5)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type BotType = "helper" | "cluebot";

const BOT_CONFIG: Record<BotType, { model: string; systemPrompt: string }> = {
  helper: {
    model: "gemma-3-27b-it",
    systemPrompt:
      "You are Helper, a warm and encouraging AI study assistant for Quizify. " +
      "You help students understand quiz concepts, clarify confusing topics, and break down " +
      "difficult material into digestible steps. Keep responses concise, friendly, and educational. " +
      "When a student seems stuck, guide them with questions rather than just giving the answer.",
  },
  cluebot: {
    model: "gemini-2.5-flash",
    systemPrompt:
      "You are ClueBot, an analytical AI assistant for Quizify. " +
      "You specialise in strategic hints, spotting patterns in exam questions, and coaching " +
      "test-taking technique. Be concise, precise, and insightful. Help users think critically " +
      "and develop reasoning skills rather than handing them direct answers. " +
      "Highlight key clues hidden inside questions and explain why distractors are wrong.",
  },
};

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { bot, messages } = (await req.json()) as { bot: BotType; messages: ChatMessage[] };

    if (!bot || !Object.keys(BOT_CONFIG).includes(bot)) {
      return jsonError("Invalid bot type. Use 'helper' or 'cluebot'.", 400);
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return jsonError("messages array is required and must not be empty.", 400);
    }

    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY is not configured in Edge Function secrets.");

    const { model, systemPrompt } = BOT_CONFIG[bot];

    // Google AI OpenAI-compatible endpoint supports both Gemma and Gemini models
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GOOGLE_AI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          // Send last 12 turns for context without ballooning token usage
          ...messages.slice(-12),
        ],
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return jsonError("Rate limit exceeded — please wait a moment and try again.", 429);
      if (response.status === 401) return jsonError("Invalid Google AI API key.", 401);
      const raw = await response.text();
      console.error("Google AI error", response.status, raw);
      return jsonError("AI service error. Please try again shortly.", 502);
    }

    const data = await response.json();
    const content: string | undefined = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty response from AI model.");

    return new Response(JSON.stringify({ content, model, bot }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("chat-bot error:", e);
    return jsonError(e instanceof Error ? e.message : "Unknown error", 500);
  }
});
