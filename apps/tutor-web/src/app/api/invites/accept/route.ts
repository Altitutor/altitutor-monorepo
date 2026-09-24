import { captureApiError } from '@/lib/sentry/capture-api-error';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database, TablesInsert } from '@altitutor/shared';
import { z } from 'zod';

const PROFILE_IMAGE_BUCKET = 'staff-profile-images';
const PROFILE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;

const availabilitySchema = z.object({
  monday: z.boolean(),
  tuesday: z.boolean(),
  wednesday: z.boolean(),
  thursday: z.boolean(),
  friday: z.boolean(),
  saturday_am: z.boolean(),
  saturday_pm: z.boolean(),
  sunday_am: z.boolean(),
  sunday_pm: z.boolean(),
  drafting: z.boolean(),
});

const acceptInviteSchema = z.object({
  token: z.string().min(1),
  email: z.string().trim().toLowerCase().email(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/)
    .regex(/[a-z]/)
    .regex(/[0-9]/),
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  phone_number: z.string().trim().min(1).max(32).nullable(),
  subject_ids: z.array(z.string().uuid()).min(1),
  availability: availabilitySchema,
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  child_safe_agreement_number: z.string().trim().min(1).max(100),
  child_safe_policy_agreed: z.literal(true),
  profile_bio: z.string().trim().min(1).max(1200),
});

export async function POST(request: NextRequest) {
  const supabaseAdmin = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  try {
    const form = await request.formData();
    const payload = form.get('payload');
    const profileImage = form.get('profile_image');
    if (typeof payload !== 'string') {
      return NextResponse.json({ error: 'Missing onboarding details' }, { status: 400 });
    }
    if (
      !(profileImage instanceof File) ||
      !PROFILE_IMAGE_TYPES.has(profileImage.type) ||
      profileImage.size > MAX_PROFILE_IMAGE_BYTES
    ) {
      return NextResponse.json(
        { error: 'Choose a JPEG, PNG, or WebP profile picture up to 5 MB' },
        { status: 400 },
      );
    }

    let rawInput: unknown;
    try {
      rawInput = JSON.parse(payload);
    } catch {
      return NextResponse.json({ error: 'Invalid onboarding details' }, { status: 400 });
    }
    const parsed = acceptInviteSchema.safeParse(rawInput);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid onboarding details' },
        { status: 400 },
      );
    }

    const input = parsed.data;
    if (input.birthday > new Date().toISOString().slice(0, 10)) {
      return NextResponse.json({ error: 'Birthday cannot be in the future' }, { status: 400 });
    }

    const { data: staffMember, error: fetchError } = await supabaseAdmin
      .from('staff')
      .select('id, role, user_id')
      .eq('invite_token', input.token)
      .maybeSingle();

    if (fetchError) {
      captureApiError(fetchError, '/api/invites/accept');
      return NextResponse.json({ error: 'Failed to validate token' }, { status: 500 });
    }
    if (!staffMember) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 });
    }
    if (staffMember.user_id) {
      return NextResponse.json(
        { error: 'This staff member already has an account' },
        { status: 400 },
      );
    }

    const uniqueSubjectIds = [...new Set(input.subject_ids)];
    const { data: validSubjects, error: subjectValidationError } = await supabaseAdmin
      .from('subjects')
      .select('id')
      .in('id', uniqueSubjectIds);
    if (subjectValidationError || validSubjects?.length !== uniqueSubjectIds.length) {
      return NextResponse.json({ error: 'One or more selected subjects are invalid' }, { status: 400 });
    }

    const profileUpdate: Database['public']['Tables']['staff']['Update'] = {
      first_name: input.first_name,
      last_name: input.last_name,
      email: input.email,
      phone_number: input.phone_number,
      birthday: input.birthday,
      availability_monday: input.availability.monday,
      availability_tuesday: input.availability.tuesday,
      availability_wednesday: input.availability.wednesday,
      availability_thursday: input.availability.thursday,
      availability_friday: input.availability.friday,
      availability_saturday_am: input.availability.saturday_am,
      availability_saturday_pm: input.availability.saturday_pm,
      availability_sunday_am: input.availability.sunday_am,
      availability_sunday_pm: input.availability.sunday_pm,
      drafting_availability: input.availability.drafting,
      child_safe_agreement_number: input.child_safe_agreement_number,
      child_safe_policy_agreed_at: new Date().toISOString(),
    };

    const { error: profileError } = await supabaseAdmin
      .from('staff')
      .update(profileUpdate)
      .eq('id', staffMember.id)
      .eq('invite_token', input.token);
    if (profileError) {
      captureApiError(profileError, '/api/invites/accept');
      return NextResponse.json({ error: 'Failed to save onboarding details' }, { status: 500 });
    }

    const { error: deleteSubjectsError } = await supabaseAdmin
      .from('staff_subjects')
      .delete()
      .eq('staff_id', staffMember.id);
    const { error: insertSubjectsError } = deleteSubjectsError
      ? { error: deleteSubjectsError }
      : await supabaseAdmin.from('staff_subjects').insert(
          uniqueSubjectIds.map((subjectId) => ({
            staff_id: staffMember.id,
            subject_id: subjectId,
          })),
        );
    if (insertSubjectsError) {
      captureApiError(insertSubjectsError, '/api/invites/accept');
      return NextResponse.json({ error: 'Failed to save teaching subjects' }, { status: 500 });
    }

    const { data: authData, error: createAuthError } =
      await supabaseAdmin.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
        user_metadata: {
          first_name: input.first_name,
          last_name: input.last_name,
          invite_token: input.token,
        },
      });
    if (createAuthError || !authData.user) {
      captureApiError(createAuthError, '/api/invites/accept');
      return NextResponse.json(
        { error: `Failed to create account: ${createAuthError?.message ?? 'Unknown error'}` },
        { status: 500 },
      );
    }

    const storagePath = `${staffMember.id}/${Date.now()}_${profileImage.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const { data: uploaded, error: uploadError } = await supabaseAdmin.storage
      .from(PROFILE_IMAGE_BUCKET)
      .upload(storagePath, Buffer.from(await profileImage.arrayBuffer()), {
        cacheControl: '31536000',
        contentType: profileImage.type,
        upsert: false,
      });
    if (uploadError || !uploaded) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      captureApiError(uploadError, '/api/invites/accept');
      return NextResponse.json({ error: 'Failed to upload profile picture' }, { status: 500 });
    }

    const fileInsert: TablesInsert<'files'> = {
      mimetype: profileImage.type,
      filename: profileImage.name,
      size_bytes: profileImage.size,
      metadata: {
        originalName: profileImage.name,
        uploadedAt: new Date().toISOString(),
        purpose: 'staff-profile-image',
      },
      storage_provider: 'supabase',
      bucket: PROFILE_IMAGE_BUCKET,
      storage_path: uploaded.path,
      created_by: staffMember.id,
    };
    const { data: profileImageFile, error: fileError } = await supabaseAdmin
      .from('files')
      .insert(fileInsert)
      .select('id')
      .single();
    if (fileError || !profileImageFile) {
      await Promise.all([
        supabaseAdmin.storage.from(PROFILE_IMAGE_BUCKET).remove([uploaded.path]),
        supabaseAdmin.auth.admin.deleteUser(authData.user.id),
      ]);
      captureApiError(fileError, '/api/invites/accept');
      return NextResponse.json({ error: 'Failed to save profile picture' }, { status: 500 });
    }

    const { data: updatedStaff, error: linkError } = await supabaseAdmin
      .from('staff')
      .update({
        user_id: authData.user.id,
        invite_token: null,
        profile_bio: input.profile_bio,
        profile_image_file_id: profileImageFile.id,
        onboarding_completed_at: new Date().toISOString(),
      })
      .eq('id', staffMember.id)
      .eq('invite_token', input.token)
      .select('id, first_name, last_name, email, role')
      .single();

    if (linkError) {
      await Promise.all([
        supabaseAdmin.from('files').delete().eq('id', profileImageFile.id),
        supabaseAdmin.storage.from(PROFILE_IMAGE_BUCKET).remove([uploaded.path]),
        supabaseAdmin.auth.admin.deleteUser(authData.user.id),
      ]);
      captureApiError(linkError, '/api/invites/accept');
      return NextResponse.json({ error: 'Failed to link account' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Account created successfully',
      data: updatedStaff,
    });
  } catch (error) {
    captureApiError(error, '/api/invites/accept');
    return NextResponse.json({ error: 'Unexpected error accepting invite' }, { status: 500 });
  }
}
