import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_PROJ_URL || "";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_API_KEY || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing Supabase service role configuration. Set SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in your environment."
  );
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { q, userId } = body as { q?: string; userId?: string };

    if (!q || typeof q !== "string") {
      return NextResponse.json(
        { success: false, error: "q (query) is required" },
        { status: 400 }
      );
    }

    const qLower = q.trim().toLowerCase();

    // Start with user filter if provided (ensures we only search user's images)
    let metadataQuery = supabaseAdmin.from("image_metadata").select(`
      image_id,
      description,
      tags,
      colors,
      user_id,
      created_at
    `);

    // Log query parameters
    console.log("Search parameters:", {
      searchTerm: qLower,
      userId: userId || "not specified",
    });

    // First check if we have any metadata at all and log the table info
    const tables = ["image_metadata", "images_metadata", "metadata"]; // Try possible table names
    let tableExists = false;
    let totalCount = 0;

    for (const table of tables) {
      const { count, error } = await supabaseAdmin
        .from(table)
        .select("*", { count: "exact", head: true });

      console.log(`Checking table '${table}':`, {
        count: count || 0,
        error: error ? error.message : null,
      });

      if (count && !error) {
        tableExists = true;
        totalCount = count;
        console.log(`Found records in table '${table}'`);
        break;
      }
    }

    // Log connection details (without sensitive info)
    console.log("Database connection info:", {
      url: SUPABASE_URL ? "Configured" : "Missing",
      serviceRole: SUPABASE_SERVICE_ROLE_KEY ? "Configured" : "Missing",
      tableFound: tableExists,
    });

    // Only apply user filter if provided
    if (userId) {
      metadataQuery = metadataQuery.eq("user_id", userId);
      console.log("Applying user filter for:", userId);
    }

    // Order by created_at and limit results
    const { data: metaRows, error: metaErr } = await metadataQuery
      .order("created_at", { ascending: false })
      .limit(1000);

    // Log the full query details
    console.log("Query execution details:", {
      totalRecords: totalCount,
      filteredCount: metaRows?.length || 0,
      hasError: !!metaErr,
      errorDetails: metaErr ? JSON.stringify(metaErr) : null,
      userFilterApplied: !!userId,
    });

    if (metaErr) {
      console.error("Metadata search error:", metaErr);
      const errMsg = (metaErr as any)?.message || JSON.stringify(metaErr);
      return NextResponse.json(
        { success: false, error: errMsg },
        { status: 500 }
      );
    }

    console.log("Query search term:", qLower);
    console.log("Total metadata rows found:", metaRows?.length);
    if (metaRows?.length > 0) {
      // Log sample record for debugging
      console.log("Sample record:", JSON.stringify(metaRows[0], null, 2));
    }

    const matches = (metaRows ?? []).filter((r: any) => {
      if (!r) return false;

      // Search in description
      const desc =
        typeof r.description === "string" ? r.description.toLowerCase() : "";
      if (desc.includes(qLower)) {
        console.log("Match in description:", r.image_id);
        return true;
      }

      // Search in tags (stored as text[])
      let tags = r.tags;
      if (typeof tags === "string") {
        try {
          tags = JSON.parse(tags);
        } catch {
          tags = tags.split(",").map((t: string) => t.trim());
        }
      }
      tags = Array.isArray(tags) ? tags : [];

      if (
        tags.some((t: string | number) =>
          String(t).toLowerCase().includes(qLower)
        )
      ) {
        console.log("Match in tags:", r.image_id, "Matching tags:", tags);
        return true;
      }

      // Search in colors (stored as text[])
      let colors = r.colors;
      if (typeof colors === "string") {
        try {
          colors = JSON.parse(colors);
        } catch {
          colors = colors.split(",").map((c: string) => c.trim());
        }
      }
      colors = Array.isArray(colors) ? colors : [];

      if (
        colors.some((c: string | number) =>
          String(c).toLowerCase().includes(qLower)
        )
      ) {
        console.log("Match in colors:", r.image_id, "Matching colors:", colors);
        return true;
      }

      // Log non-matching record for debugging
      console.log("No match for record:", {
        id: r.image_id,
        desc: desc.slice(0, 50) + "...",
        tags,
        colors,
      });

      return false;
    });

    const imageIds = matches.map((m: any) => m.image_id).filter(Boolean);

    if (!imageIds.length) {
      return NextResponse.json({ success: true, images: [] }, { status: 200 });
    }

    // Fetch matching images; optionally restrict to the user's images
    let query = supabaseAdmin.from("images").select("*").in("id", imageIds);
    if (userId && typeof userId === "string") {
      query = query.eq("user_id", userId);
    }

    const { data: images, error: imgErr } = await query;

    if (imgErr) {
      const errMsg = (imgErr as any)?.message || JSON.stringify(imgErr);
      return NextResponse.json(
        { success: false, error: errMsg },
        { status: 500 }
      );
    }

    // Attach a public thumbnail URL for each image (if available)
    const imgs = (images ?? []) as any[];
    const results = await Promise.all(
      imgs.map(async img => {
        const thumb = img.thumbnail_path || img.original_path || "";
        let public_url = "";

        if (thumb) {
          const normalized = String(thumb || "")
            .replace(/^thumbnails\//, "")
            .replace(/^\//, "");
          try {
            const { data: urlData } = supabaseAdmin.storage
              .from("thumbnails")
              .getPublicUrl(normalized);
            public_url = urlData?.publicUrl ?? "";
          } catch (err) {
            // fallback: leave public_url empty
            public_url = "";
          }
        }

        return { ...img, public_url };
      })
    );

    return NextResponse.json(
      { success: true, images: results },
      { status: 200 }
    );
  } catch (err: any) {
    const errMsg = err?.message || JSON.stringify(err);
    return NextResponse.json(
      { success: false, error: errMsg },
      { status: 500 }
    );
  }
}
