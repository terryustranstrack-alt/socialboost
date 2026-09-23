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

async function graphGet(path: string, params: Record<string, string>) {
  const url = new URL(`${GRAPH_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const res = await fetch(url.toString());
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

// ---------------------------------------------------------------------------
// "Connect with Facebook" login — lets an Admin approve access with one
// click instead of typing in a Page ID and access token by hand. Meta's
// docs: https://developers.facebook.com/docs/facebook-login/guides/access-tokens
// ---------------------------------------------------------------------------

const META_LOGIN_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_content_publish",
].join(",");

function requireMetaAppId(): string {
  const id = process.env.META_APP_ID;
  if (!id) throw new Error("META_APP_ID is not set.");
  return id;
}

function requireMetaAppSecret(): string {
  const secret = process.env.META_APP_SECRET;
  if (!secret) throw new Error("META_APP_SECRET is not set.");
  return secret;
}

// Builds the link that sends someone to Facebook's own login + permission
// screen. `state` is a one-time code we hand back to ourselves afterwards,
// to prove the person coming back is the same one who left.
export function buildMetaLoginUrl(redirectUri: string, state: string): string {
  const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  url.searchParams.set("client_id", requireMetaAppId());
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", META_LOGIN_SCOPES);
  return url.toString();
}

// Facebook's login screen hands us a short-lived, one-time "code" — this
// trades it for an access token we can actually use.
async function exchangeCodeForUserToken(code: string, redirectUri: string): Promise<string> {
  const json = await graphGet("/oauth/access_token", {
    client_id: requireMetaAppId(),
    client_secret: requireMetaAppSecret(),
    redirect_uri: redirectUri,
    code,
  });
  return json.access_token as string;
}

// The token from the step above expires in about an hour. Trading it for a
// long-lived one (~60 days) means the connection keeps working without
// someone having to redo this every day.
async function exchangeForLongLivedUserToken(shortLivedToken: string): Promise<string> {
  const json = await graphGet("/oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: requireMetaAppId(),
    client_secret: requireMetaAppSecret(),
    fb_exchange_token: shortLivedToken,
  });
  return json.access_token as string;
}

export type ConnectedPage = {
  pageId: string;
  pageName: string;
  pageAccessToken: string;
  /** Set only if this Facebook Page has an Instagram Business account linked. */
  instagramBusinessAccountId: string | null;
};

// Lists every Facebook Page the person allowed us to see, plus which
// Instagram account (if any) is linked to each one. Facebook's own login
// screen is where the person actually picks which Pages to share — by the
// time we call this, that choice has already been made.
async function fetchConnectedPages(userAccessToken: string): Promise<ConnectedPage[]> {
  const json = await graphGet("/me/accounts", {
    fields: "id,name,access_token,instagram_business_account",
    access_token: userAccessToken,
  });
  const pages = (json.data ?? []) as Array<{
    id: string;
    name: string;
    access_token: string;
    instagram_business_account?: { id: string };
  }>;
  return pages.map((p) => ({
    pageId: p.id,
    pageName: p.name,
    pageAccessToken: p.access_token,
    instagramBusinessAccountId: p.instagram_business_account?.id ?? null,
  }));
}

// Turns the one-time code from Facebook's login redirect into the finished
// list of Pages (and linked Instagram accounts) ready to save. This is the
// single function the OAuth callback route needs to call.
export async function resolvePagesFromOAuthCode(
  code: string,
  redirectUri: string,
): Promise<ConnectedPage[]> {
  const shortLivedToken = await exchangeCodeForUserToken(code, redirectUri);
  const userToken = await exchangeForLongLivedUserToken(shortLivedToken);
  return fetchConnectedPages(userToken);
}

export type EngagementMetrics = {
  likeCount: number | null;
  commentCount: number | null;
  shareCount: number | null;
};

// Only asks for data we already have permission to read. "Reach" and
// "impressions" numbers need extra Meta permissions we haven't requested
// yet, so they're left out here on purpose instead of failing every time
// someone refreshes metrics. Adding them is planned for a later phase.
export async function fetchInstagramMetrics(
  mediaId: string,
  accessToken: string,
): Promise<EngagementMetrics> {
  try {
    const json = await graphGet(`/${mediaId}`, {
      fields: "like_count,comments_count",
      access_token: accessToken,
    });
    return {
      likeCount: json.like_count ?? null,
      commentCount: json.comments_count ?? null,
      shareCount: null,
    };
  } catch (err) {
    throw new MetaPublishError(extractErrorMessage(err), "INSTAGRAM", err);
  }
}

export async function fetchFacebookMetrics(
  postId: string,
  accessToken: string,
): Promise<EngagementMetrics> {
  try {
    const json = await graphGet(`/${postId}`, {
      fields: "likes.summary(true),comments.summary(true),shares",
      access_token: accessToken,
    });
    return {
      likeCount: json.likes?.summary?.total_count ?? null,
      commentCount: json.comments?.summary?.total_count ?? null,
      shareCount: json.shares?.count ?? null,
    };
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
