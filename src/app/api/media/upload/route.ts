import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/auth";

// The biggest files Instagram accepts — no point storing anything larger,
// since it couldn't be published anyway.
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
const MAX_VIDEO_BYTES = 300 * 1024 * 1024; // 300 MB

// Photos and videos are sent straight from the person's browser to our file
// storage, instead of passing through this app's server (which can only
// accept a few MB at a time). This route's only job is to say "yes, this
// signed-in person may upload this kind of file, up to this size".
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const session = await auth();
        if (!session) throw new Error("Please log in again before uploading.");

        const isVideo = clientPayload === "VIDEO";
        return {
          allowedContentTypes: isVideo ? ["video/*"] : ["image/*"],
          maximumSizeInBytes: isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
