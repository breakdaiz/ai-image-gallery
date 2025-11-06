import supabase from "@/lib/supabase-config";

export async function analyzeImage(
  imageUrl: string,
  imageId: string | number | null = null
) {
  try {
    const { data, error } = await supabase.functions.invoke("ai-analyze", {
      method: "POST",
      body: JSON.stringify({ imageUrl, imageId }),
    });

    if (error) throw error;

    return data;
  } catch (err: any) {
    console.error("Function call failed:", err.message);
    throw new Error(err.message);
  }
}
