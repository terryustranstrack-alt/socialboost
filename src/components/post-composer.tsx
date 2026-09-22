"use client";

import { useState } from "react";
import { createPost, uploadMedia } from "@/app/actions/posts";
import type { MediaType, Platform } from "@prisma/client";

type SocialAccountOption = {
  id: string;
  platform: Platform;
  displayName: string;
};

const PLATFORM_LABEL: Record<Platform, string> = {
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  LINKEDIN: "LinkedIn",
};

export default function PostComposer({
  brandId,
  accounts,
}: {
  brandId: string;
  accounts: SocialAccountOption[];
}) {
  const [caption, setCaption] = useState("");
  const [media, setMedia] = useState<{ url: string; type: MediaType } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const result = await uploadMedia(formData);
      setMedia(result);
    } catch {
      setUploadError("Upload failed. Try a smaller image/video.");
    } finally {
      setUploading(false);
    }
  }

  function toggleAccount(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  if (accounts.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        No social accounts connected for this brand yet. Ask an Admin to connect Instagram/Facebook
        under Settings → Connected accounts before creating a post.
      </div>
    );
  }

  return (
    <form action={createPost} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <input type="hidden" name="brandId" value={brandId} />
      <input type="hidden" name="mediaUrl" value={media?.url ?? ""} />
      <input type="hidden" name="mediaType" value={media?.type ?? "IMAGE"} />

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Caption</label>
          <textarea
            name="caption"
            required
            rows={6}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={2200}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            placeholder="Write your caption..."
          />
          <p className="mt-1 text-right text-xs text-slate-400">{caption.length}/2200</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Media (image or video)</label>
          <input
            type="file"
            accept="image/*,video/*"
            onChange={handleFileChange}
            className="mt-1 block w-full text-sm"
          />
          {uploading && <p className="mt-1 text-xs text-slate-500">Uploading…</p>}
          {uploadError && <p className="mt-1 text-xs text-red-600">{uploadError}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Publish to</label>
          <div className="mt-2 space-y-2">
            {accounts.map((account) => (
              <label key={account.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="targetAccountIds"
                  value={account.id}
                  checked={selected.includes(account.id)}
                  onChange={() => toggleAccount(account.id)}
                  className="rounded border-slate-300"
                />
                {PLATFORM_LABEL[account.platform]} — {account.displayName}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">
            Schedule for (leave blank to queue for immediate publish once approved)
          </label>
          <input
            type="datetime-local"
            name="scheduledAt"
            className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={uploading}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          Save draft
        </button>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">Preview</p>
        <div className="space-y-4">
          {selected.length === 0 && (
            <p className="text-sm text-slate-400">Select a platform to preview.</p>
          )}
          {accounts
            .filter((a) => selected.includes(a.id))
            .map((account) => (
              <PlatformPreview
                key={account.id}
                platform={account.platform}
                caption={caption}
                mediaUrl={media?.url}
                mediaType={media?.type}
              />
            ))}
        </div>
      </div>
    </form>
  );
}

function PlatformPreview({
  platform,
  caption,
  mediaUrl,
  mediaType,
}: {
  platform: Platform;
  caption: string;
  mediaUrl?: string;
  mediaType?: MediaType;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-3 py-2 text-xs font-medium text-slate-500">
        {PLATFORM_LABEL[platform]} preview
      </div>
      <div className="flex aspect-square items-center justify-center bg-slate-100">
        {mediaUrl ? (
          mediaType === "VIDEO" ? (
            <video src={mediaUrl} className="h-full w-full object-cover" controls />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl} alt="Post media" className="h-full w-full object-cover" />
          )
        ) : (
          <span className="text-xs text-slate-400">No media uploaded</span>
        )}
      </div>
      <p className="whitespace-pre-wrap px-3 py-2 text-sm text-slate-700">
        {caption || <span className="text-slate-400">Your caption will appear here…</span>}
      </p>
    </div>
  );
}
