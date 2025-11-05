import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// This route runs on the server. It uses the SUPABASE_SERVICE_ROLE_KEY which must
// never be exposed to the client. Add SUPABASE_SERVICE_ROLE_KEY to your .env.local.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  // If this is missing, return a 500 when the route is invoked.
  // We don't throw at import time to avoid crashing dev server until route is used.
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { bucket, path, expires = 3600 } = body || {};

    if (!bucket || !path) {
      return NextResponse.json(
        { error: "Missing bucket or path" },
        { status: 400 }
      );
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Server not configured with Supabase service role key" },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false,
        },
      }
    );

    // createSignedUrl returns { publicUrl, data } in older versions; use createSignedUrl
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(path, expires);

    if (error) {
      return NextResponse.json(
        { error: error.message || error },
        { status: 500 }
      );
    }

    // data.signedURL contains the URL
    return NextResponse.json({ url: data?.signedUrl ?? data }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
