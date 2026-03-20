import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { unauthorizedError, notFoundError } from "@/lib/api-helpers";
import { getCurrentUser } from "@/lib/get-current-user";
import { buildSocietyContext, processSingleRecord } from "@/lib/migration-processor";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

const importRecordSchema = z.object({
  fullName: z.string().min(2).max(100),
  email: z.string().email(),
  mobile: z.string().regex(/^[6-9]\d{9}$/),
  ownershipType: z.enum(["OWNER", "TENANT"]),
  feeStatus: z.enum(["PAID", "PENDING"]),
  unitFields: z.record(z.string(), z.string()).optional().default({}),
});

const importBodySchema = z.object({
  records: z.array(importRecordSchema).min(1).max(200),
});

type SSEEvent =
  | {
      type: "progress";
      rowIndex: number;
      total: number;
      processed: number;
      imported: number;
      failed: number;
    }
  | { type: "result"; rowIndex: number; success: boolean; rwaid?: string; error?: string }
  | { type: "done"; summary: { total: number; imported: number; failed: number } }
  | { type: "error"; message: string };

function sseChunk(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

// POST /api/v1/societies/[id]/migration/import-stream
// Returns an SSE stream — call with fetch + ReadableStream reader (not EventSource)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: societyId } = await params;

  const currentUser = await getCurrentUser("RWA_ADMIN");
  if (!currentUser || currentUser.societyId !== societyId) {
    return unauthorizedError("Not authorized");
  }

  const body = await request.json();
  const parsed = importBodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request body",
          details: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 422 },
    );
  }

  const society = await prisma.society.findUnique({
    where: { id: societyId },
    select: {
      id: true,
      societyId: true,
      name: true,
      type: true,
      annualFee: true,
      feeSessionStartMonth: true,
    },
  });

  if (!society) return notFoundError("Society not found");

  const ctx = buildSocietyContext(society);
  const supabaseAdmin = createAdminClient();
  const { records } = parsed.data;
  const total = records.length;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let imported = 0;
      let failed = 0;

      for (let i = 0; i < records.length; i++) {
        const result = await processSingleRecord(records[i], i, ctx, supabaseAdmin);

        if (result.success) {
          imported++;
        } else {
          failed++;
        }

        // Emit individual result
        controller.enqueue(encoder.encode(sseChunk({ type: "result", ...result })));

        // Emit progress after each record
        controller.enqueue(
          encoder.encode(
            sseChunk({
              type: "progress",
              rowIndex: i,
              total,
              processed: i + 1,
              imported,
              failed,
            }),
          ),
        );
      }

      // Final done event
      controller.enqueue(
        encoder.encode(
          sseChunk({
            type: "done",
            summary: { total, imported, failed },
          }),
        ),
      );

      controller.close();
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
