import { APP_URL } from "@/lib/constants";

type GenerateLinkProperties = {
  hashed_token?: string;
  verification_type?: string;
};

type GenerateLinkResponse = {
  data?: {
    properties?: GenerateLinkProperties | null;
  } | null;
  error?: {
    message?: string;
  } | null;
};

type AdminLinkClient = {
  auth: {
    admin: {
      generateLink: (args: {
        type: "invite" | "recovery";
        email: string;
        options: { redirectTo: string };
      }) => Promise<GenerateLinkResponse>;
    };
  };
};

type SetupLinkResult =
  | { actionLink: string; errorMessage: null }
  | { actionLink: null; errorMessage: string };

const COUNSELLOR_SETUP_NEXT = "/counsellor/set-password";

function buildConfirmUrl(tokenHash: string, verificationType: string): string {
  const params = new URLSearchParams({
    token_hash: tokenHash,
    type: verificationType,
    next: COUNSELLOR_SETUP_NEXT,
  });
  return `${APP_URL}/auth/confirm?${params.toString()}`;
}

function extractConfirmUrl(props: GenerateLinkProperties | null | undefined): string | null {
  if (!props?.hashed_token || !props?.verification_type) return null;
  return buildConfirmUrl(props.hashed_token, props.verification_type);
}

export async function generateCounsellorSetupLink(
  supabaseAdmin: AdminLinkClient,
  email: string,
): Promise<SetupLinkResult> {
  const redirectTo = `${APP_URL}${COUNSELLOR_SETUP_NEXT}`;

  const invite = await supabaseAdmin.auth.admin.generateLink({
    type: "invite",
    email,
    options: { redirectTo },
  });

  const inviteLink = extractConfirmUrl(invite.data?.properties);
  if (inviteLink) {
    return { actionLink: inviteLink, errorMessage: null };
  }

  // Any invite failure (user exists, rate limit, etc.) falls through to recovery,
  // which is the correct flow for a user already present in Supabase Auth.
  const recovery = await supabaseAdmin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  });

  const recoveryLink = extractConfirmUrl(recovery.data?.properties);
  if (recoveryLink) {
    return { actionLink: recoveryLink, errorMessage: null };
  }

  return {
    actionLink: null,
    errorMessage:
      recovery.error?.message ?? invite.error?.message ?? "Failed to generate invite link",
  };
}
