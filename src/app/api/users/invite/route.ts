import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const inviteSchema = z.object({
  email: z.string().trim().email().transform((email) => email.toLowerCase()),
  fullName: z.string().trim().min(2).max(120),
  role: z.enum(['owner', 'headmaster', 'teacher']),
  staffId: z.string().trim().optional(),
});

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: 'Server account setup is incomplete. Configure the Supabase service role key.' },
      { status: 500 }
    );
  }

  const authorization = request.headers.get('authorization');
  const accessToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!accessToken) {
    return NextResponse.json({ error: 'Sign in to invite an account.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request must contain valid JSON.' }, { status: 400 });
  }
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a valid name, email, and account role.' }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !authData.user) {
      return NextResponse.json({ error: 'Your session has expired. Sign in again.' }, { status: 401 });
    }

    const { data: inviter, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!inviter || !['admin', 'owner'].includes(inviter.role)) {
      return NextResponse.json({ error: 'Only the platform admin or school owner can invite users.' }, { status: 403 });
    }
    if (inviter.role === 'owner' && parsed.data.role === 'owner') {
      return NextResponse.json({ error: 'Only the platform admin can create another school owner.' }, { status: 403 });
    }

    if (parsed.data.role === 'teacher' && !parsed.data.staffId) {
      return NextResponse.json({ error: 'Select the staff record linked to this teacher account.' }, { status: 400 });
    }
    if (parsed.data.staffId) {
      const { data: staff, error: staffError } = await supabase
        .from('staff')
        .select('id, staff_category')
        .eq('id', parsed.data.staffId)
        .maybeSingle();
      if (staffError) throw staffError;
      if (!staff || (parsed.data.role === 'teacher' && !['teacher', 'headteacher'].includes(staff.staff_category))) {
        return NextResponse.json({ error: 'Select a valid teacher staff record.' }, { status: 400 });
      }

      const { data: linkedProfile, error: linkedProfileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('staff_id', parsed.data.staffId)
        .maybeSingle();
      if (linkedProfileError) throw linkedProfileError;
      if (linkedProfile) {
        return NextResponse.json({ error: 'That staff record is already linked to an account.' }, { status: 409 });
      }
    }

    const redirectTo = new URL('/login', request.url).toString();
    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
      parsed.data.email,
      { data: { full_name: parsed.data.fullName }, redirectTo }
    );
    if (inviteError) {
      return NextResponse.json({ error: inviteError.message }, { status: 400 });
    }
    if (!inviteData.user) {
      return NextResponse.json({ error: 'Supabase did not return the invited account.' }, { status: 502 });
    }

    const { data: updateData, error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: parsed.data.fullName,
        role: parsed.data.role,
        staff_id: parsed.data.staffId || null,
      })
      .eq('id', inviteData.user.id)
      .select('id')
      .maybeSingle();
    if (updateError) {
      const { error: cleanupError } = await supabase.auth.admin.deleteUser(inviteData.user.id);
      if (cleanupError) {
        console.error('Failed to clean up an incomplete invited account', cleanupError);
      }
      throw updateError;
    }
    if (!updateData) {
      const { error: cleanupError } = await supabase.auth.admin.deleteUser(inviteData.user.id);
      if (cleanupError) {
        console.error('Failed to clean up an incomplete invited account', cleanupError);
      }
      throw new Error('The invited account has no profile. Check the Supabase auth profile trigger.');
    }

    return NextResponse.json({
      message: `Invitation sent to ${parsed.data.email}.`,
      userId: inviteData.user.id,
    });
  } catch (error) {
    console.error('User invitation failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to send the invitation.' },
      { status: 500 }
    );
  }
}
