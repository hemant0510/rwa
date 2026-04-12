import { NextResponse } from "next/server";

import { z } from "zod";

import { getActiveSocietyId } from "@/lib/active-society-server";
import { internalError, parseBody, unauthorizedError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

const directorySettingsSchema = z
  .object({
    showInDirectory: z.boolean(),
    showPhoneInDirectory: z.boolean(),
  })
  .strict();

async function getResidentUser() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;

  const activeSocietyId = await getActiveSocietyId();
  const where: Record<string, unknown> = { authUserId: authUser.id, role: "RESIDENT" };
  if (activeSocietyId) where.societyId = activeSocietyId;

  return prisma.user.findFirst({ where, select: { id: true } });
}

/** PATCH /api/v1/residents/me/settings/directory — update directory opt-in preferences */
export async function PATCH(request: Request) {
  try {
    const resident = await getResidentUser();
    if (!resident) return unauthorizedError();

    const { data, error } = await parseBody(request, directorySettingsSchema);
    if (error) return error;

    // Business rule: if not in directory, phone visibility must be false
    const updates = {
      showInDirectory: data!.showInDirectory,
      showPhoneInDirectory: data!.showInDirectory ? data!.showPhoneInDirectory : false,
    };

    const updated = await prisma.user.update({
      where: { id: resident.id },
      data: updates,
      select: { showInDirectory: true, showPhoneInDirectory: true },
    });

    return NextResponse.json({
      showInDirectory: updated.showInDirectory,
      showPhoneInDirectory: updated.showPhoneInDirectory,
    });
  } catch (err) {
    console.error("Directory settings PATCH error:", err);
    return internalError("Failed to update directory settings");
  }
}
