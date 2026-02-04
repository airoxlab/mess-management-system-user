import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const memberType = searchParams.get('memberType');

    if (!email || !memberType) {
      return NextResponse.json(
        { error: 'Email and memberType are required' },
        { status: 400 }
      );
    }

    const tableName = `${memberType}_members`;

    const { data: member, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('email_address', email.toLowerCase())
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ member });
  } catch (error) {
    console.error('Get member error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
