export type AnalysisResult = {
  error?: Error;
  tags?: string[];
  description?: string;
};

export async function analyzeImage(
  base64: string,
  imageId: string | number
): Promise<AnalysisResult> {
  try {
    const analyzeRes = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: base64, imageId }),
    });

    const analyzeJson = await analyzeRes.json();

    return {
      tags: Array.isArray(analyzeJson?.analysis?.tags)
        ? analyzeJson.analysis.tags.map((t: any) => String(t))
        : [],
      description:
        typeof analyzeJson?.analysis?.description === "string"
          ? analyzeJson.analysis.description
          : undefined,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
