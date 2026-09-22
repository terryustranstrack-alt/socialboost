// Meta Graph API publishing — Instagram Business accounts and Facebook
// Pages. Built for Development Mode apps (PRD section 5 & 8): the app's own
// admins/testers can publish without a full App Review, which is enough for
// the MVP's two brands.
//
// Docs:
// - IG Content Publishing: https://developers.facebook.com/docs/instagram-platform/content-publishing
// - FB Page Publishing:    https://developers.facebook.com/docs/pages-api/posts

const GRAPH_API_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export class MetaPublishError extends Error {
  constructor(
    message: string,
    public readonly platform: "INSTAGRAM" | "FACEBOOK",
    public readonly raw?: unknown,
  ) {
    super(message);
    this.name = "MetaPublishError";
  }
}

async function graphFetch(path: string, params: Record<string, string>) {
  const url = new URL(`${GRAPH_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const res = await fetch(url.toString(), { method: "POST" });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw json;
  }
  return json;
}

export type PublishInput = {
  /** IG business account id or FB page id */
  externalAccountId: string;
  accessToken: string;
  caption: string;
  /** First media item's public URL — MVP supports single-image posts. */
  mediaUrl: string;
  mediaType: "IMAGE" | "VIDEO";
};

export async function publishToInstagram(
  input: PublishInput,
): Promise<{ platformPostId: string }> {
  try {
    const mediaField = input.mediaType === "VIDEO" ? "video_url" : "image_url";
    const container = await graphFetch(`/${input.externalAccountId}/media`, {
      [mediaField]: input.mediaUrl,
      caption: input.caption,
      access_token: input.accessToken,
      ...(input.mediaType === "VIDEO" ? { media_type: "REELS" } : {}),
    });

    const containerId = container.id as string;

    // Video containers need to finish processing before publish; poll a
    // few times with a short backoff.
    if (input.mediaType === "VIDEO") {
      await waitForContainerReady(containerId, input.accessToken);
    }

    const publish = await graphFetch(
      `/${input.externalAccountId}/media_publish`,
      {
        creation_id: containerId,
        access_token: input.accessToken,
      },
    );

    return { platformPostId: publish.id as string };
  } catch (err) {
    throw new MetaPublishError(
      extractErrorMessage(err),
      "INSTAGRAM",
      err,
    );
  }
}

async function waitForContainerReady(containerId: string, accessToken: string) {
  const maxAttempts = 10;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const url = new URL(`${GRAPH_BASE}/${containerId}`);
    url.searchParams.set("fields", "status_code");
    url.searchParams.set("access_token", accessToken);
    const res = await fetch(url.toString());
    const json = await res.json();
    if (json.status_code === "FINISHED") return;
    if (json.status_code === "ERROR") {
      throw new Error("Instagram media container failed to process.");
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error("Timed out waiting for Instagram media container.");
}

export async function publishToFacebook(
  input: PublishInput,
): Promise<{ platformPostId: string }> {
  try {
    if (input.mediaType === "VIDEO") {
      const result = await graphFetch(`/${input.externalAccountId}/videos`, {
        file_url: input.mediaUrl,
        description: input.caption,
        access_token: input.accessToken,
      });
      return { platformPostId: result.id as string };
    }

    const result = await graphFetch(`/${input.externalAccountId}/photos`, {
      url: input.mediaUrl,
      caption: input.caption,
      access_token: input.accessToken,
    });
    return { platformPostId: result.post_id ?? (result.id as string) };
  } catch (err) {
    throw new MetaPublishError(extractErrorMessage(err), "FACEBOOK", err);
  }
}

function extractErrorMessage(err: unknown): string {
  if (
    err &&
    typeof err === "object" &&
    "error" in err &&
    err.error &&
    typeof err.error === "object" &&
    "message" in err.error
  ) {
    return String((err.error as { message: unknown }).message);
  }
  return err instanceof Error ? err.message : "Unknown Meta Graph API error";
}
