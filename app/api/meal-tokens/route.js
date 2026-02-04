import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET meal tokens for a member with history
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');
    const mealType = searchParams.get('mealType');

    if (!memberId) {
      return NextResponse.json(
        { error: 'Member ID is required' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('meal_tokens')
      .select('*')
      .eq('member_id', memberId)
      .order('token_date', { ascending: false })
      .order('token_time', { ascending: false });

    if (startDate) {
      query = query.gte('token_date', startDate);
    }
    if (endDate) {
      query = query.lte('token_date', endDate);
    }
    if (status) {
      query = query.eq('status', status.toUpperCase());
    }
    if (mealType) {
      query = query.eq('meal_type', mealType.toUpperCase());
    }

    const { data: tokens, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Calculate summary stats
    const stats = {
      total: tokens?.length || 0,
      collected: 0,
      pending: 0,
      cancelled: 0,
      expired: 0,
      breakfast: { collected: 0, pending: 0, total: 0 },
      lunch: { collected: 0, pending: 0, total: 0 },
      dinner: { collected: 0, pending: 0, total: 0 },
    };

    if (tokens) {
      tokens.forEach(token => {
        const mealKey = token.meal_type.toLowerCase();

        // Overall status counts
        if (token.status === 'COLLECTED') stats.collected++;
        else if (token.status === 'PENDING') stats.pending++;
        else if (token.status === 'CANCELLED') stats.cancelled++;
        else if (token.status === 'EXPIRED') stats.expired++;

        // Per meal type counts
        if (stats[mealKey]) {
          stats[mealKey].total++;
          if (token.status === 'COLLECTED') {
            stats[mealKey].collected++;
          } else if (token.status === 'PENDING') {
            stats[mealKey].pending++;
          }
        }
      });
    }

    return NextResponse.json({
      tokens: tokens || [],
      stats,
    });
  } catch (error) {
    console.error('Get meal tokens error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
