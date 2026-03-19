import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { compressImage } from "@/lib/utils/compress-image";

// ---------------------------------------------------------------------------
// Mock URL browser APIs (jsdom doesn't provide these)
// ---------------------------------------------------------------------------

Object.defineProperty(URL, "createObjectURL", {
  configurable: true,
  writable: true,
  value: vi.fn().mockReturnValue("blob:mock-url"),
});
Object.defineProperty(URL, "revokeObjectURL", {
  configurable: true,
  writable: true,
  value: vi.fn(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFile(name = "photo.jpg", type = "image/jpeg", sizeBytes = 256): File {
  return new File([new Uint8Array(sizeBytes).fill(0)], name, { type });
}

// Save the real Image constructor once so we can restore it
const realImage = window.Image;

function mockImageLoad(width: number, height: number) {
  const fakeImg = {
    width,
    height,
    onload: null as (() => void) | null,
    onerror: null as (() => void) | null,
  };
  Object.defineProperty(fakeImg, "src", {
    configurable: true,
    set() {
      setTimeout(() => fakeImg.onload?.(), 0);
    },
  });
  // Replace the global Image constructor
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).Image = function () {
    return fakeImg;
  };
}

function mockImageError() {
  const fakeImg = {
    onload: null as (() => void) | null,
    onerror: null as (() => void) | null,
  };
  Object.defineProperty(fakeImg, "src", {
    configurable: true,
    set() {
      setTimeout(() => fakeImg.onerror?.(), 0);
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).Image = function () {
    return fakeImg;
  };
}

function mockCanvas(blobResult: Blob | null, ctxNull = false) {
  const mockCtx = { drawImage: vi.fn() };
  const mockCanvasEl = {
    width: 0,
    height: 0,
    getContext: vi.fn().mockReturnValue(ctxNull ? null : mockCtx),
    toBlob: vi.fn().mockImplementation((cb: (b: Blob | null) => void) => cb(blobResult)),
  };
  const originalCreate = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
    if (tag === "canvas") return mockCanvasEl as unknown as HTMLElement;
    return originalCreate(tag);
  });
  return { mockCtx, mockCanvasEl };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.restoreAllMocks();
  // Restore the real Image constructor before each test
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).Image = realImage;
});

afterEach(() => {
  vi.restoreAllMocks();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).Image = realImage;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("compressImage", () => {
  it("PDF file returns the exact same File object (pass-through)", async () => {
    const file = makeFile("doc.pdf", "application/pdf");
    const result = await compressImage(file);
    expect(result).toBe(file);
  });

  it("non-image type (text/plain) returns the exact same File object", async () => {
    const file = makeFile("note.txt", "text/plain");
    const result = await compressImage(file);
    expect(result).toBe(file);
  });

  it("JPEG within bounds (800×600) does not resize — canvas gets 800×600", async () => {
    const blob = new Blob(["data"], { type: "image/jpeg" });
    mockImageLoad(800, 600);
    const { mockCanvasEl } = mockCanvas(blob);
    await compressImage(makeFile("photo.jpg", "image/jpeg"));
    expect(mockCanvasEl.width).toBe(800);
    expect(mockCanvasEl.height).toBe(600);
  });

  it("JPEG too wide (2400×800) scales to width=1200, height=400", async () => {
    const blob = new Blob(["data"], { type: "image/jpeg" });
    mockImageLoad(2400, 800);
    const { mockCanvasEl } = mockCanvas(blob);
    await compressImage(makeFile("photo.jpg", "image/jpeg"));
    expect(mockCanvasEl.width).toBe(1200);
    expect(mockCanvasEl.height).toBe(400);
  });

  it("JPEG too tall (800×2400) scales to width=400, height=1200", async () => {
    const blob = new Blob(["data"], { type: "image/jpeg" });
    mockImageLoad(800, 2400);
    const { mockCanvasEl } = mockCanvas(blob);
    await compressImage(makeFile("photo.jpg", "image/jpeg"));
    expect(mockCanvasEl.width).toBe(400);
    expect(mockCanvasEl.height).toBe(1200);
  });

  it("square large image (2000×2000) scales to 1200×1200", async () => {
    const blob = new Blob(["data"], { type: "image/jpeg" });
    mockImageLoad(2000, 2000);
    const { mockCanvasEl } = mockCanvas(blob);
    await compressImage(makeFile("photo.jpg", "image/jpeg"));
    expect(mockCanvasEl.width).toBe(1200);
    expect(mockCanvasEl.height).toBe(1200);
  });

  it("PNG converts to JPEG: returned file type is image/jpeg, name ends with .jpg", async () => {
    const blob = new Blob(["data"], { type: "image/jpeg" });
    mockImageLoad(400, 300);
    mockCanvas(blob);
    const result = await compressImage(makeFile("photo.png", "image/png"));
    expect(result.type).toBe("image/jpeg");
    expect(result.name).toMatch(/\.jpg$/);
  });

  it("JPEG stays JPEG: output type remains image/jpeg", async () => {
    const blob = new Blob(["data"], { type: "image/jpeg" });
    mockImageLoad(400, 300);
    mockCanvas(blob);
    const result = await compressImage(makeFile("photo.jpg", "image/jpeg"));
    expect(result.type).toBe("image/jpeg");
  });

  it("WebP stays WebP: output type remains image/webp", async () => {
    const blob = new Blob(["data"], { type: "image/webp" });
    mockImageLoad(400, 300);
    mockCanvas(blob);
    const result = await compressImage(makeFile("photo.webp", "image/webp"));
    expect(result.type).toBe("image/webp");
  });

  it("ctx is null falls back to returning original file unchanged", async () => {
    mockImageLoad(400, 300);
    mockCanvas(null, true); // ctxNull = true
    const file = makeFile("photo.jpg", "image/jpeg");
    const result = await compressImage(file);
    expect(result).toBe(file);
  });

  it("canvas.toBlob returns null falls back to returning original file unchanged", async () => {
    mockImageLoad(400, 300);
    mockCanvas(null); // blob = null, ctx not null
    const file = makeFile("photo.jpg", "image/jpeg");
    const result = await compressImage(file);
    expect(result).toBe(file);
  });

  it("img.onerror rejects with 'Failed to load image' error", async () => {
    mockImageError();
    await expect(compressImage(makeFile("photo.jpg", "image/jpeg"))).rejects.toThrow(
      "Failed to load image",
    );
  });

  it("successful compression returns a new File instance (not the original)", async () => {
    const blob = new Blob(["compressed"], { type: "image/jpeg" });
    mockImageLoad(400, 300);
    mockCanvas(blob);
    const original = makeFile("photo.jpg", "image/jpeg");
    const result = await compressImage(original);
    expect(result).not.toBe(original);
    expect(result).toBeInstanceOf(File);
  });

  it("drawImage is called with the (possibly rescaled) dimensions", async () => {
    const blob = new Blob(["data"], { type: "image/jpeg" });
    mockImageLoad(800, 600);
    const { mockCtx } = mockCanvas(blob);
    await compressImage(makeFile("photo.jpg", "image/jpeg"));
    expect(mockCtx.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 800, 600);
  });
});
