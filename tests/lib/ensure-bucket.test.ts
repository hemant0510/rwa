import { describe, expect, it, vi } from "vitest";

import { ensureBucket } from "@/lib/supabase/ensure-bucket";

function makeClient(
  opts: {
    listError?: { message: string } | null;
    buckets?: { name: string }[];
    createError?: { message: string } | null;
  } = {},
) {
  return {
    storage: {
      listBuckets: vi.fn().mockResolvedValue({
        data: opts.buckets ?? [],
        error: opts.listError ?? null,
      }),
      createBucket: vi.fn().mockResolvedValue({
        data: {},
        error: opts.createError ?? null,
      }),
    },
  };
}

describe("ensureBucket", () => {
  it("returns without calling createBucket when bucket already exists (name match)", async () => {
    const client = makeClient({ buckets: [{ name: "id-proofs" }] });
    await ensureBucket(client as never, "id-proofs");
    expect(client.storage.createBucket).not.toHaveBeenCalled();
  });

  it("calls createBucket with correct name when bucket missing", async () => {
    const client = makeClient({ buckets: [] });
    await ensureBucket(client as never, "id-proofs");
    expect(client.storage.createBucket).toHaveBeenCalledWith("id-proofs", expect.any(Object));
  });

  it("creates bucket as private by default (public: false)", async () => {
    const client = makeClient({ buckets: [] });
    await ensureBucket(client as never, "id-proofs");
    expect(client.storage.createBucket).toHaveBeenCalledWith(
      "id-proofs",
      expect.objectContaining({ public: false }),
    );
  });

  it("creates bucket as public when isPublic=true passed", async () => {
    const client = makeClient({ buckets: [] });
    await ensureBucket(client as never, "id-proofs", true);
    expect(client.storage.createBucket).toHaveBeenCalledWith(
      "id-proofs",
      expect.objectContaining({ public: true }),
    );
  });

  it("createBucket called with fileSizeLimit 10*1024*1024", async () => {
    const client = makeClient({ buckets: [] });
    await ensureBucket(client as never, "id-proofs");
    expect(client.storage.createBucket).toHaveBeenCalledWith(
      "id-proofs",
      expect.objectContaining({ fileSizeLimit: 10 * 1024 * 1024 }),
    );
  });

  it("createBucket called with allowedMimeTypes array containing jpeg/png/webp/pdf", async () => {
    const client = makeClient({ buckets: [] });
    await ensureBucket(client as never, "id-proofs");
    expect(client.storage.createBucket).toHaveBeenCalledWith(
      "id-proofs",
      expect.objectContaining({
        allowedMimeTypes: expect.arrayContaining([
          "image/jpeg",
          "image/png",
          "image/webp",
          "application/pdf",
        ]),
      }),
    );
  });

  it("throws when listBuckets returns an error (message includes 'Failed to list storage buckets')", async () => {
    const client = makeClient({ listError: { message: "network error" } });
    await expect(ensureBucket(client as never, "id-proofs")).rejects.toThrow(
      "Failed to list storage buckets",
    );
  });

  it("throws when createBucket returns an error (message includes bucket name and 'Failed to create')", async () => {
    const client = makeClient({ createError: { message: "permission denied" } });
    await expect(ensureBucket(client as never, "id-proofs")).rejects.toThrow("id-proofs");
    const client2 = makeClient({ createError: { message: "permission denied" } });
    await expect(ensureBucket(client2 as never, "id-proofs")).rejects.toThrow("Failed to create");
  });

  it("does NOT call createBucket when bucket already exists", async () => {
    const client = makeClient({ buckets: [{ name: "id-proofs" }, { name: "other-bucket" }] });
    await ensureBucket(client as never, "id-proofs");
    expect(client.storage.createBucket).not.toHaveBeenCalled();
  });
});
