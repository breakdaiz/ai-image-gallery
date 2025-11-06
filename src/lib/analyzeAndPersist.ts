import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_PROJ_URL || "";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_API_KEY || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini"; // override via env if needed

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  // This helper is meant to run on the server (Node or Edge) where service role key is available.
  // Throwing here helps surface a clear error during development.
  throw new Error(
    "Missing Supabase service role configuration. Set SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in your environment."
  );
}

if (!OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY in environment.");
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

type AnalysisResult = {
  description: string;
  tags: string[];
  colors?: string[];
};

async function callOpenAI(imageBase64: string): Promise<AnalysisResult> {
  const prompt = `Analyze this image and return STRICT JSON only (no surrounding text or markdown):
{
  "description": "...",          // 2-3 sentence detailed description
  "tags": ["tag1","tag2",...], // 5-10 relevant tags
  "colors": ["#hex1","#hex2"]  // dominant colors as hex strings
}
Respond only with the JSON object in the exact shape above.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
            },
          ],
        },
      ],
      max_tokens: 700,
      temperature: 0.0,
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${t}`);
  }

  const data = await res.json();
  const rawContent =
    data?.choices?.[0]?.message?.content ??
    data?.choices?.[0]?.text ??
    JSON.stringify(data);

  // Try to extract JSON from the response (handle code fences)
  try {
    const codeBlockMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const jsonMatch = codeBlockMatch
      ? codeBlockMatch[1]
      : rawContent.match(/\{[\s\S]*\}/)?.[0];
    const jsonString = jsonMatch || rawContent;
    const parsed = JSON.parse(jsonString);

    // Basic normalization
    const description =
      typeof parsed.description === "string" ? parsed.description : "";
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags.map((t: any) => String(t))
      : [];
    const colors = Array.isArray(parsed.colors)
      ? parsed.colors.map((c: any) => String(c))
      : [];

    return { description, tags, colors };
  } catch (err) {
    throw new Error(
      `Failed to parse OpenAI response: ${String(err)}\nraw: ${rawContent}`
    );
  }
}

/**
 * Analyze an image using OpenAI and persist results to Supabase.
 * - Updates the `images` table with description, tags, dominant_colors, analyzed_at
 * - Inserts a row into `image_metadata` (if table exists) with raw analysis
 *
 * NOTE: This function MUST be called from server-side code where SUPABASE_SERVICE_ROLE_KEY
 * is available (API route, server action, or a secure worker). It should not be called from the browser.
 */
export async function analyzeAndPersist(
  imageBase64: string,
  imageId?: number | string | null
) {
  if (!imageBase64) throw new Error("imageBase64 is required");

  const analysis = await callOpenAI(imageBase64);

  const updatePayload: Record<string, any> = {
    description: analysis.description,
    tags: analysis.tags,
    dominant_colors: analysis.colors || [],
    analyzed_at: new Date().toISOString(),
  };

  let updatedImage: any = null;

  if (imageId) {
    try {
      const { data, error } = await supabaseAdmin
        .from("images")
        .update(updatePayload)
        .eq("id", imageId)
        .select("*");

      if (error) {
        throw new Error(error.message || String(error));
      }

      updatedImage = data?.[0] || null;
    } catch (err: any) {
      throw new Error(
        `Failed to update images table: ${err?.message || String(err)}`
      );
    }

    // Try to insert into image_metadata table (if it exists). This is optional.
    try {
      await supabaseAdmin.from("image_metadata").insert([
        {
          image_id: imageId,
          metadata: updatePayload,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (metaErr) {
      // Non-fatal: metadata table may not exist.
      // Log or ignore depending on your preference.
      // eslint-disable-next-line no-console
      console.warn(
        "image_metadata insert failed (table may not exist)",
        metaErr
      );
    }
  }

  return {
    success: true,
    analysis,
    image: updatedImage,
  };
}

export default analyzeAndPersist;
