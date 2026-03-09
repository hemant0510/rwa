import { NextRequest, NextResponse } from "next/server";

import { parseBody, successResponse, internalError } from "@/lib/api-helpers";
import { generateSocietyId } from "@/lib/fee-calculator";
import { prisma, type TransactionClient } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSocietySchema } from "@/lib/validations/society";
import { isVerificationRequired, sendVerificationEmail, autoVerifyUser } from "@/lib/verification";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const where: Record<string, unknown> = {};
    if (status && status !== "ALL") {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { societyCode: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.society.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: {
            select: { users: { where: { role: "RESIDENT" } } },
          },
        },
      }),
      prisma.society.count({ where }),
    ]);

    const serialized = data.map((s) => ({
      ...s,
      joiningFee: Number(s.joiningFee),
      annualFee: Number(s.annualFee),
    }));

    return successResponse({ data: serialized, total, page, limit });
  } catch {
    return internalError("Failed to fetch societies");
  }
}

export async function POST(request: NextRequest) {
  try {
    const { data, error } = await parseBody(request, createSocietySchema);
    if (error) return error;
    if (!data) return internalError();

    // Check code uniqueness
    const existing = await prisma.society.findUnique({
      where: { societyCode: data.societyCode },
    });
    if (existing) {
      return NextResponse.json(
        { error: { code: "DUPLICATE_CODE", message: "Society code already exists", status: 409 } },
        { status: 409 },
      );
    }

    // Create Supabase Auth user for the admin
    const supabaseAdmin = createAdminClient();
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.adminEmail,
      password: data.adminPassword,
      email_confirm: true,
    });

    if (authError) {
      return NextResponse.json(
        { error: { code: "AUTH_ERROR", message: authError.message, status: 400 } },
        { status: 400 },
      );
    }

    // Generate city code (first 3 consonants uppercase)
    const cityCode = data.city
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .replace(/[AEIOU]/g, "")
      .slice(0, 3)
      .padEnd(
        3,
        data.city
          .toUpperCase()
          .replace(/[^A-Z]/g, "")
          .charAt(0),
      );

    // Generate society ID
    const pincodeCount = await prisma.society.count({ where: { pincode: data.pincode } });
    const societyId = generateSocietyId(data.state, cityCode, data.pincode, pincodeCount + 1);

    try {
      // Create society + admin in transaction
      const result = await prisma.$transaction(async (tx: TransactionClient) => {
        const society = await tx.society.create({
          data: {
            societyId,
            societyCode: data.societyCode,
            name: data.name,
            state: data.state,
            city: data.city,
            cityCode,
            pincode: data.pincode,
            type: data.type,
            joiningFee: data.joiningFee,
            annualFee: data.annualFee,
          },
        });

        // Create primary admin user linked to Supabase Auth
        const admin = await tx.user.create({
          data: {
            societyId: society.id,
            authUserId: authData.user.id,
            name: data.adminName,
            email: data.adminEmail,
            mobile: data.adminMobile,
            role: "RWA_ADMIN",
            adminPermission: "FULL_ACCESS",
            status: "ACTIVE_PAID",
            consentWhatsapp: true,
          },
        });

        // Create admin term
        const now = new Date();
        const termEnd = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
        await tx.adminTerm.create({
          data: {
            userId: admin.id,
            societyId: society.id,
            position: "PRIMARY",
            permission: "FULL_ACCESS",
            termStart: now,
            termEnd,
          },
        });

        // Seed default designations for governing body
        const defaultDesignations = [
          { name: "President", sortOrder: 1 },
          { name: "Vice-President", sortOrder: 2 },
          { name: "Secretary", sortOrder: 3 },
          { name: "Joint Secretary", sortOrder: 4 },
          { name: "Treasurer", sortOrder: 5 },
        ];
        await tx.designation.createMany({
          data: defaultDesignations.map((d) => ({
            societyId: society.id,
            name: d.name,
            sortOrder: d.sortOrder,
          })),
        });

        return { society, admin };
      });

      // Handle email verification for the new admin
      const requiresVerification = await isVerificationRequired(result.society.id);
      if (requiresVerification) {
        await sendVerificationEmail(result.admin.id, data.adminEmail, data.adminName);
      } else {
        await autoVerifyUser(result.admin.id);
      }

      return NextResponse.json({ ...result.society, requiresVerification }, { status: 201 });
    } catch (err) {
      // Rollback: delete Supabase auth user if DB transaction fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      console.error("Society creation error:", err);
      return internalError("Failed to create society");
    }
  } catch (err) {
    console.error("Society creation error:", err);
    return internalError("Failed to create society");
  }
}
