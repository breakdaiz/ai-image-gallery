import { createClient } from "npm:@supabase/supabase-js@2.28.0";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
Deno.serve(async req => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
    const SUPABASE_SERVICE_ROLE_KEY =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_ANON_KEY") ||
      "";
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing Supabase environment variables",
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
          status: 500,
        }
      );
    }
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing OPENAI_API_KEY environment variable",
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
          status: 500,
        }
      );
    }
    const supabaseClient = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      {
        global: {
          headers: {
            "X-Edge-Function": "analyze-image",
          },
        },
      }
    );
    const body = await req.json().catch(() => ({}));
    const { imageUrl, imageId } = body;
    if (!imageUrl || typeof imageUrl !== "string") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "imageUrl is required",
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
          status: 400,
        }
      );
    }
    // Ask OpenAI to return strict JSON with description, tags (array), colors (array of hex strings)
    const prompt = `Analyze the image at the following URL and return STRICT JSON only (no surrounding text or markdown):{
  "description": "...",          // 2-3 sentence detailed description
  "tags": ["tag1","tag2",...], // 5-10 relevant tags
  "colors": ["#hex1","#hex2"]  // dominant colors as hex strings
}
Image URL: ${imageUrl}
Respond only with the JSON object in the exact shape above.`;
    const openAIResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          max_tokens: 500,
          temperature: 0.0,
        }),
      }
    );
    if (!openAIResponse.ok) {
      const errText = await openAIResponse.text();
      return new Response(
        JSON.stringify({
          success: false,
          error: `OpenAI API error: ${errText}`,
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
          status: 502,
        }
      );
    }
    const openAIData = await openAIResponse.json();
    const rawContent =
      openAIData?.choices?.[0]?.message?.content ??
      openAIData?.choices?.[0]?.text ??
      JSON.stringify(openAIData);
    // Extract JSON from markdown code block or raw object
    let analysisData;
    try {
      const codeBlockMatch = rawContent.match(
        /```(?:json)?\s*([\s\S]*?)\s*```/i
      );
      const jsonMatch = codeBlockMatch
        ? codeBlockMatch[1]
        : rawContent.match(/\{[\s\S]*\}/)?.[0];
      const jsonString = jsonMatch || rawContent;
      analysisData = JSON.parse(jsonString);
    } catch (parseError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to parse AI response",
          raw: rawContent,
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
          status: 502,
        }
      );
    }
    // Validate structure minimally
    if (
      !analysisData ||
      typeof analysisData.description !== "string" ||
      !Array.isArray(analysisData.tags)
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "AI response missing required fields",
          analysisData,
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
          status: 502,
        }
      );
    }
    const updateData = {
      description: analysisData.description,
      tags: analysisData.tags,
      dominant_colors: Array.isArray(analysisData.colors)
        ? analysisData.colors
        : analysisData.colors
        ? [analysisData.colors]
        : [],
      analyzed_at: new Date().toISOString(),
    };
    if (imageId) {
      const { data, error } = await supabaseClient
        .from("images")
        .update(updateData)
        .eq("id", imageId)
        .select();
      if (error) {
        return new Response(
          JSON.stringify({
            success: false,
            error: error.message || error,
          }),
          {
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
            status: 500,
          }
        );
      }
      return new Response(
        JSON.stringify({
          success: true,
          data: data?.[0] ?? null,
          analysis: analysisData,
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
          status: 200,
        }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: true,
          analysis: analysisData,
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
          status: 200,
        }
      );
    }
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || String(error),
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        status: 500,
      }
    );
  }
});
