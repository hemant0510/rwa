import { vi } from "vitest";

export const mockSupabaseUser = {
  id: "auth-user-123",
  email: "test@example.com",
};

export const mockSupabaseClient = {
  auth: {
    getUser: vi.fn().mockResolvedValue({
      data: { user: mockSupabaseUser },
      error: null,
    }),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
  },
};

export const mockStorageBucket = {
  remove: vi.fn().mockResolvedValue({ error: null }),
  upload: vi.fn().mockResolvedValue({ error: null }),
  createSignedUrl: vi.fn().mockResolvedValue({
    data: { signedUrl: "https://example.com/signed-url" },
    error: null,
  }),
  getPublicUrl: vi.fn().mockReturnValue({
    data: { publicUrl: "https://example.com/public-url" },
  }),
};

export const mockSupabaseAdmin = {
  auth: {
    admin: {
      createUser: vi.fn(),
      deleteUser: vi.fn(),
      updateUserById: vi.fn(),
    },
  },
  storage: {
    from: vi.fn().mockReturnValue(mockStorageBucket),
  },
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabaseClient),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn().mockReturnValue(mockSupabaseAdmin),
}));
