import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const resetSchema = z.object({
  confirmation: z.literal('RESET'),
});

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: 'School data reset is not configured. Add SUPABASE_SERVICE_ROLE_KEY to the server environment and redeploy.' },
      { status: 500 }
    );
  }

  const authorization = request.headers.get('authorization');
  const accessToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!accessToken) {
    return NextResponse.json({ error: 'Sign in as the school owner to reset school data.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request must contain valid JSON.' }, { status: 400 });
  }
  if (!resetSchema.safeParse(body).success) {
    return NextResponse.json({ error: 'Type RESET to confirm this action.' }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !authData.user) {
      return NextResponse.json({ error: 'Your session has expired. Sign in again.' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile || profile.role !== 'owner') {
      return NextResponse.json({ error: 'Only the school owner can reset school data.' }, { status: 403 });
    }

    const { error: resetError } = await supabase.rpc('reset_school_data');
    if (resetError) throw resetError;

    return NextResponse.json({ message: 'School records were permanently deleted. User accounts and school settings were preserved.' });
  } catch (error) {
    console.error('School data reset failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to reset school data.' },
      { status: 500 }
    );
  }
}
