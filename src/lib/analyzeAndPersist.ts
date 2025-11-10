import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_PROJ_URL || "";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_API_KEY || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing Supabase service role configuration. Set SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in your environment."
  );
} else {
  console.log("OPENAI_API_KEY: ", OPENAI_API_KEY);
}

if (!OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY in environment.");
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

interface ImageRecord {
  id: number;
  user_id: string;
  description?: string;
  tags?: string[];
  dominant_colors?: string[];
  analyzed_at?: string;
}

interface AnalysisResult {
  description: string;
  tags: string[];
  colors?: string[];
}

interface ImageMetadataPayload {
  image_id: string | number;
  user_id: string;
  description: string;
  tags: string[];
  colors: string[];
  ai_processing_status: string;
  created_at: string;
}

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

  try {
    const codeBlockMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const jsonMatch = codeBlockMatch
      ? codeBlockMatch[1]
      : rawContent.match(/\{[\s\S]*\}/)?.[0];
    const jsonString = jsonMatch || rawContent;
    const parsed = JSON.parse(jsonString);

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
 */
export async function analyzeAndPersist(
  imageBase64: string,
  imageId?: number | string | null
) {
  if (!imageBase64) throw new Error("imageBase64 is required");
  if (!imageId) throw new Error("imageId is required");

  try {
    // Step 1: Analyze the image with AI
    const analysis = await callOpenAI(imageBase64);

    // Step 2: Get the image record to verify it exists and get user_id
    const { data: imageData, error: imageError } = await supabaseAdmin
      .from("images")
      .select("id, user_id")
      .eq("id", imageId)
      .single();

    if (imageError || !imageData) {
      throw new Error(
        imageError?.message || `Image with id ${imageId} not found`
      );
    }

    // Step 3: Update the image record with analysis results
    const imageUpdate = {
      description: analysis.description,
      tags: analysis.tags,
      dominant_colors: analysis.colors || [],
      analyzed_at: new Date().toISOString(),
    };

    const { data: updatedImage, error: updateError } = await supabaseAdmin
      .from("images")
      .update(imageUpdate)
      .eq("id", imageId)
      .select()
      .single();

    if (updateError || !updatedImage) {
      throw new Error(updateError?.message || "Failed to update image record");
    }

    // Step 4: Save metadata using the confirmed image data
    const metadata = {
      image_id: imageId,
      user_id: imageData.user_id,
      description: analysis.description,
      tags: analysis.tags,
      colors: Array.isArray(analysis.colors)
        ? analysis.colors
        : analysis.colors
        ? [analysis.colors]
        : [],
      ai_processing_status: "completed",
      created_at: new Date().toISOString(),
    };

    // Upsert metadata. .upsert(...).select() may return an array when rows are returned,
    // so avoid using .single() which fails when multiple rows are returned.
    const { data: metaDataArray, error: metadataError } = await supabaseAdmin
      .from("image_metadata")
      .upsert(metadata, {
        onConflict: "image_id",
      })
      .select();

    if (metadataError) {
      console.warn("Failed to save metadata:", metadataError);
      throw new Error("Failed to save metadata: " + metadataError.message);
    }

    // Normalize returned metadata: either an array (take first) or an object
    const savedMetadata = Array.isArray(metaDataArray)
      ? metaDataArray[0] ?? null
      : metaDataArray ?? null;

    return {
      success: true,
      data: savedMetadata,
      analysis: {
        description: analysis.description,
        tags: analysis.tags,
        colors: analysis.colors || [],
      },
    };
  } catch (err: any) {
    throw new Error(
      `Failed to update image and metadata: ${err?.message || String(err)}`
    );
  }
}

export default analyzeAndPersist;
