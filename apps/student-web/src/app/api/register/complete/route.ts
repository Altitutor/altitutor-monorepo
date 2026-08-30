import { captureApiError } from "@/lib/sentry/capture-api-error";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";
import {
  isRegistrationTokenRevoked,
  resolveRegistrationStudentId,
} from "@/features/registration/lib/public-registration-token";

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseServiceKey) {
      console.error(
        "Admin client not initialized - missing SUPABASE_SERVICE_ROLE_KEY",
      );
      return NextResponse.json(
        {
          error: "Server configuration error",
          code: "server_configuration_error",
        },
        { status: 500 },
      );
    }

    const supabaseAdmin = createClient<Database>(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const body = await request.json();
    const { token, student, parents, subject_ids, password, confirmPassword } =
      body;

    // Validate required fields
    const missingFields: string[] = [];
    if (!token) missingFields.push("token");
    if (!student) missingFields.push("student");

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          error: `Missing required fields: ${missingFields.join(", ")}`,
          code: "missing_request_data",
        },
        { status: 400 },
      );
    }

    // Validate student fields
    if (!student.first_name || !student.last_name || !student.email) {
      return NextResponse.json(
        {
          error: "Student first name, last name, and email are required",
          code: "invalid_student_details",
        },
        { status: 400 },
      );
    }

    // Validate parents
    if (!parents || !Array.isArray(parents) || parents.length === 0) {
      return NextResponse.json(
        { error: "At least one parent is required", code: "missing_parent" },
        { status: 400 },
      );
    }

    // Check if at least one parent has email and phone
    type ParentData = { email: string; phone: string };
    const hasValidParent = parents.some((p: unknown): p is ParentData => {
      if (typeof p !== "object" || p === null) return false;
      const parent = p as Record<string, unknown>;
      return (
        typeof parent.email === "string" &&
        typeof parent.phone === "string" &&
        parent.email.trim() !== "" &&
        parent.phone.trim() !== ""
      );
    });

    if (!hasValidParent) {
      return NextResponse.json(
        {
          error: "At least one parent must have both email and phone",
          code: "incomplete_parent_contact",
        },
        { status: 400 },
      );
    }

    // Validate availability (at least one day must be selected)
    const availabilityFields = [
      student.availability_monday,
      student.availability_tuesday,
      student.availability_wednesday,
      student.availability_thursday,
      student.availability_friday,
      student.availability_saturday_am,
      student.availability_saturday_pm,
      student.availability_sunday_am,
      student.availability_sunday_pm,
    ];

    const hasAvailability = availabilityFields.some((val) => val === true);

    if (!hasAvailability) {
      return NextResponse.json(
        {
          error: "At least one availability day must be selected",
          code: "missing_availability",
        },
        { status: 400 },
      );
    }

    if (await isRegistrationTokenRevoked(supabaseAdmin, token)) {
      return NextResponse.json(
        {
          error:
            "This registration link has been replaced. Please use the newest link from Altitutor.",
          code: "revoked_link",
        },
        { status: 410 },
      );
    }

    const registrationStudentId = await resolveRegistrationStudentId(
      supabaseAdmin,
      token,
    );
    if (!registrationStudentId) {
      return NextResponse.json(
        { error: "Invalid or revoked registration link", code: "invalid_link" },
        { status: 404 },
      );
    }

    const { data: studentCheck, error: studentCheckError } = await supabaseAdmin
      .from("students")
      .select("id, status, user_id")
      .eq("id", registrationStudentId)
      .maybeSingle();

    if (studentCheckError || !studentCheck) {
      return NextResponse.json(
        { error: "Invalid or expired token", code: "student_not_found" },
        { status: 404 },
      );
    }

    if (studentCheck.status === "ACTIVE") {
      return NextResponse.json(
        {
          error: "This student is already fully registered",
          code: "already_registered",
          alreadyRegistered: true,
        },
        { status: 400 },
      );
    }

    if (studentCheck.status !== "TRIAL") {
      return NextResponse.json(
        {
          error: "Registration is not available for this student",
          code: "registration_unavailable",
        },
        { status: 409 },
      );
    }

    // Account ownership is authoritative. Never let a bearer-token caller choose
    // whether this request creates another Auth user.
    const skipPassword = Boolean(studentCheck.user_id);

    if (!password) {
      return NextResponse.json(
        {
          error: "Missing required fields: password",
          code: "missing_password",
        },
        { status: 400 },
      );
    }

    if (!skipPassword && !confirmPassword) {
      return NextResponse.json(
        {
          error: "Missing required fields: confirmPassword",
          code: "missing_password_confirmation",
        },
        { status: 400 },
      );
    }

    if (!skipPassword && password !== confirmPassword) {
      return NextResponse.json(
        { error: "Passwords do not match", code: "password_mismatch" },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        {
          error: "Password must be at least 6 characters",
          code: "password_too_short",
        },
        { status: 400 },
      );
    }

    // Verify payment method exists before completing registration
    const { data: paymentMethods, error: pmError } = await supabaseAdmin
      .from("student_payment_methods")
      .select("id")
      .eq("student_id", studentCheck.id)
      .limit(1);

    if (pmError) {
      console.error("Error checking payment methods:", pmError);
      captureApiError(pmError, "/api/register/complete", {
        journey: "student_registration",
        registration_stage: "payment_verification",
        result_code: "payment_query_failed",
      });
      return NextResponse.json(
        {
          error: "Failed to verify payment method",
          code: "payment_query_failed",
        },
        { status: 500 },
      );
    }

    if (!paymentMethods || paymentMethods.length === 0) {
      return NextResponse.json(
        {
          error:
            "Payment method is required. Please add a payment method before completing registration.",
          code: "payment_required",
        },
        { status: 400 },
      );
    }

    // Note: We'll check for email conflicts during auth user creation
    // The createUser call will fail if the email already exists

    // Call the database function to atomically update student, parents, and subjects
    const { data: dbResult, error: dbError } = await supabaseAdmin.rpc(
      "complete_student_registration_public",
      {
        p_token: token,
        p_student_first_name: student.first_name,
        p_student_last_name: student.last_name,
        p_student_email: student.email,
        p_student_phone: student.phone || null,
        p_school: student.school || null,
        p_curriculum: student.curriculum || null,
        p_year_level: student.year_level || null,
        p_availability_monday: student.availability_monday || false,
        p_availability_tuesday: student.availability_tuesday || false,
        p_availability_wednesday: student.availability_wednesday || false,
        p_availability_thursday: student.availability_thursday || false,
        p_availability_friday: student.availability_friday || false,
        p_availability_saturday_am: student.availability_saturday_am || false,
        p_availability_saturday_pm: student.availability_saturday_pm || false,
        p_availability_sunday_am: student.availability_sunday_am || false,
        p_availability_sunday_pm: student.availability_sunday_pm || false,
        p_parents: parents,
        p_subject_ids: subject_ids || [],
      },
    );

    if (dbError) {
      console.error("Database function error:", dbError);
      captureApiError(dbError, "/api/register/complete", {
        journey: "student_registration",
        registration_stage: "registration_write",
        result_code: "registration_write_failed",
      });
      return NextResponse.json(
        {
          error: `Registration failed: ${dbError.message}`,
          code: "registration_write_failed",
        },
        { status: 500 },
      );
    }

    // Type the RPC result properly
    type CompleteRegistrationResult = {
      success: boolean;
      student_id?: string;
      error?: string;
      message?: string;
    };

    const result = dbResult as CompleteRegistrationResult | null;

    if (!result || !result.success) {
      return NextResponse.json(
        {
          error: result?.error || "Registration failed",
          code: "registration_rejected",
        },
        { status: 400 },
      );
    }

    const studentId = result.student_id;

    if (!studentId) {
      return NextResponse.json(
        {
          error: "Registration failed: Student ID not returned",
          code: "missing_student_id",
        },
        { status: 500 },
      );
    }

    // If skipPassword is true, student already has an account - just verify registration completed
    if (skipPassword) {
      // Verify student was updated correctly
      const { data: updatedStudent, error: updateError } = await supabaseAdmin
        .from("students")
        .select("id, user_id, status")
        .eq("id", studentId)
        .single();

      if (updateError) {
        console.error("Failed to verify student update:", updateError);
        captureApiError(updateError, "/api/register/complete", {
          journey: "student_registration",
          registration_stage: "registration_verification",
          result_code: "registration_verification_failed",
        });
        return NextResponse.json(
          {
            error: "Failed to verify registration",
            code: "registration_verification_failed",
          },
          { status: 500 },
        );
      }

      // Verify student has account and is now ACTIVE
      if (!updatedStudent.user_id) {
        return NextResponse.json(
          {
            error: "Student account not found. Please contact support.",
            code: "account_missing",
          },
          { status: 500 },
        );
      }

      const { error: activateError } = await supabaseAdmin
        .from("students")
        .update({ status: "ACTIVE", invite_token: null })
        .eq("id", studentId);

      if (activateError) {
        captureApiError(activateError, "/api/register/complete", {
          journey: "student_registration",
          registration_stage: "activation",
          result_code: "activation_failed",
        });
        return NextResponse.json(
          {
            error: "Failed to activate registration",
            code: "activation_failed",
          },
          { status: 500 },
        );
      }

      // Registration complete - return success (student already has account, no need to sign in)
      return NextResponse.json(
        {
          success: true,
          message: "Registration completed successfully",
          redirectTo: "/dashboard",
        },
        { status: 200 },
      );
    }

    // Create auth user and link it to the student (normal flow)
    const { data: authData, error: createAuthError } =
      await supabaseAdmin.auth.admin.createUser({
        email: student.email,
        password: password!,
        email_confirm: true, // Auto-confirm email (Option A - confirm on link click)
        user_metadata: {
          first_name: student.first_name,
          last_name: student.last_name,
          registration_student_id: studentId,
        },
      });

    if (createAuthError) {
      console.error("Failed to create auth user:", createAuthError);
      // Check if error is due to email already existing
      if (
        createAuthError.message?.includes("already registered") ||
        createAuthError.message?.includes("already exists")
      ) {
        return NextResponse.json(
          {
            error: "An account with this email already exists",
            code: "account_exists",
            alreadyRegistered: true,
          },
          { status: 409 },
        );
      }
      // Note: The database function already updated the student, but we can't rollback
      // In a real scenario, we might want to revert the student status
      // For now, we'll return an error and the student can try again with a new token
      captureApiError(createAuthError, "/api/register/complete", {
        journey: "student_registration",
        registration_stage: "account_creation",
        result_code: "account_creation_failed",
      });
      return NextResponse.json(
        {
          error: `Failed to create account: ${createAuthError.message}`,
          code: "account_creation_failed",
        },
        { status: 500 },
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        {
          error: "Auth user creation succeeded but no user returned",
          code: "account_creation_empty",
        },
        { status: 500 },
      );
    }

    // The link_precreated_user trigger should have linked the user, but let's verify
    // and manually link if needed (in case trigger didn't fire)
    const { data: updatedStudent, error: updateError } = await supabaseAdmin
      .from("students")
      .select("id, user_id, status")
      .eq("id", studentId)
      .single();

    if (updateError) {
      console.error("Failed to verify student update:", updateError);
      captureApiError(updateError, "/api/register/complete", {
        journey: "student_registration",
        registration_stage: "account_link_verification",
        result_code: "account_link_verification_failed",
      });
      // Clean up auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        {
          error: "Failed to verify registration",
          code: "account_link_verification_failed",
        },
        { status: 500 },
      );
    }

    // Link the account, activate the In-person relationship, and retire any
    // now-obsolete account invite. The durable registration link is retained.
    const { error: linkError } = await supabaseAdmin
      .from("students")
      .update({
        user_id: updatedStudent.user_id ?? authData.user.id,
        status: "ACTIVE",
        invite_token: null,
      })
      .eq("id", studentId!);

    if (linkError) {
      console.error("Failed to link user:", linkError);
      captureApiError(linkError, "/api/register/complete", {
        journey: "student_registration",
        registration_stage: "account_link",
        result_code: "account_link_failed",
      });
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: "Failed to link account", code: "account_link_failed" },
        { status: 500 },
      );
    }

    // Return success - the frontend will handle signing in the user
    // This is more secure than generating magic links server-side
    return NextResponse.json(
      {
        success: true,
        message: "Registration completed successfully",
        redirectTo: "/dashboard",
      },
      { status: 200 },
    );
  } catch (error) {
    captureApiError(error, "/api/register/complete", {
      journey: "student_registration",
      registration_stage: "complete_route",
      result_code: "unexpected_error",
    });
    console.error("Unexpected error completing registration:", error);
    return NextResponse.json(
      {
        error: `Unexpected error: ${error instanceof Error ? error.message : "Unknown error"}`,
        code: "unexpected_error",
      },
      { status: 500 },
    );
  }
}
