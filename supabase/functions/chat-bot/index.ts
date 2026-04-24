// Chat bot edge function — routes to Helper (Gemma) or ClueBot (Gemini Flash 2.5)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type BotType = "helper" | "cluebot";

const BOT_CONFIG: Record<BotType, { model: string; systemPrompt: string }> = {
  helper: {
    model: "google/gemini-2.5-flash",
    systemPrompt:
      "You are Helper, a warm and encouraging AI study assistant for Quizify. " +
      "You help students understand quiz concepts, clarify confusing topics, and break down " +
      "difficult material into digestible steps. Keep responses concise, friendly, and educational. " +
      "When a student seems stuck, guide them with questions rather than just giving the answer.",
  },
  cluebot: {
    model: "google/gemini-3-flash-preview",
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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured.");

    const { model, systemPrompt } = BOT_CONFIG[bot];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.slice(-12),
        ],
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return jsonError("Rate limit exceeded — please wait a moment and try again.", 429);
      if (response.status === 402) return jsonError("AI credits are unavailable right now. Please top up Lovable AI usage and try again.", 402);
      if (response.status === 401) return jsonError("AI gateway authentication failed.", 401);
      const raw = await response.text();
      console.error("Lovable AI error", response.status, raw);
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
