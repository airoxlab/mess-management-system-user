import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Meal time configuration
const MEAL_CONFIG = {
  breakfast: { time: '07:30:00', endTime: '09:00:00' },
  lunch: { time: '12:30:00', endTime: '14:00:00' },
  dinner: { time: '19:00:00', endTime: '21:00:00' },
};

// Get day name from date
const getDayName = (date) => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
};

// Helper to parse boolean values (handles string 'true'/'false' from DB)
const parseBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return Boolean(value);
};

// POST - Generate tokens for a member
export async function POST(request) {
  try {
    const { memberId, memberType, date } = await request.json();

    if (!memberId || !memberType) {
      return NextResponse.json(
        { error: 'Member ID and type are required' },
        { status: 400 }
      );
    }

    const targetDate = date || new Date().toISOString().split('T')[0];

    // Get member's active package
    const { data: memberPackage, error: pkgError } = await supabase
      .from('member_meal_packages')
      .select('*')
      .eq('member_id', memberId)
      .eq('member_type', memberType)
      .eq('is_active', true)
      .single();

    if (pkgError || !memberPackage) {
      return NextResponse.json(
        { error: 'No active package found for this member' },
        { status: 404 }
      );
    }

    // Get organization_id from organizations table (first active one)
    // Note: member tables don't have organization_id column in this schema
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (orgError && orgError.code !== 'PGRST116') {
      console.error('Organization fetch error:', orgError);
    }

    const organizationId = org?.id;

    if (!organizationId) {
      console.error('No active organization found');
      return NextResponse.json(
        { error: 'No active organization found. Please contact admin.' },
        { status: 400 }
      );
    }

    // Check if date is within package validity
    if (memberPackage.valid_from && targetDate < memberPackage.valid_from) {
      return NextResponse.json(
        { error: 'Date is before package validity' },
        { status: 400 }
      );
    }
    if (memberPackage.valid_until && targetDate > memberPackage.valid_until) {
      return NextResponse.json(
        { error: 'Date is after package validity' },
        { status: 400 }
      );
    }

    // Get meal selections for this date
    const { data: mealSelection } = await supabase
      .from('meal_selections')
      .select('*')
      .eq('member_id', memberId)
      .eq('member_type', memberType)
      .eq('date', targetDate)
      .single();

    const targetDateObj = new Date(targetDate + 'T00:00:00');
    const dayName = getDayName(targetDateObj).toLowerCase();

    const tokensToCreate = [];
    const mealTypes = ['breakfast', 'lunch', 'dinner'];

    for (const mealType of mealTypes) {
      // Check if meal is enabled in package (handle string booleans)
      const isEnabled = parseBoolean(memberPackage[`${mealType}_enabled`]);
      if (!isEnabled) continue;

      // Check if meal is available on this day
      const mealDays = memberPackage[`${mealType}_days`] || [];
      if (mealDays.length > 0 && !mealDays.map(d => d.toLowerCase()).includes(dayName)) {
        continue;
      }

      // Check if member wants this meal (from selections - handle string booleans)
      const wantsMealRaw = mealSelection ? mealSelection[`${mealType}_needed`] : true;
      const wantsMeal = wantsMealRaw === true || wantsMealRaw === 'true' || wantsMealRaw === null || wantsMealRaw === undefined;

      // Check if token already exists for this meal/date
      const { data: existingToken } = await supabase
        .from('meal_tokens')
        .select('id')
        .eq('member_id', memberId)
        .eq('meal_type', mealType.toUpperCase())
        .eq('token_date', targetDate)
        .single();

      if (existingToken) {
        continue; // Token already exists
      }

      // Get next token number
      const { data: lastToken } = await supabase
        .from('meal_tokens')
        .select('token_no')
        .eq('token_date', targetDate)
        .eq('meal_type', mealType.toUpperCase())
        .order('token_no', { ascending: false })
        .limit(1)
        .single();

      const nextTokenNo = (lastToken?.token_no || 0) + 1;

      tokensToCreate.push({
        organization_id: organizationId,
        member_id: memberId,
        token_no: nextTokenNo,
        meal_type: mealType.toUpperCase(),
        token_date: targetDate,
        token_time: MEAL_CONFIG[mealType].time,
        status: wantsMeal ? 'PENDING' : 'CANCELLED',
        created_at: new Date().toISOString(),
      });
    }

    if (tokensToCreate.length === 0) {
      return NextResponse.json({
        message: 'No new tokens to create',
        created: 0,
      });
    }

    // Insert tokens
    const { data: createdTokens, error: insertError } = await supabase
      .from('meal_tokens')
      .insert(tokensToCreate)
      .select();

    if (insertError) {
      console.error('Token creation error:', insertError);
      console.error('Tokens attempted:', JSON.stringify(tokensToCreate, null, 2));
      return NextResponse.json(
        { error: 'Failed to create tokens', details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: `Created ${createdTokens.length} tokens`,
      tokens: createdTokens,
      created: createdTokens.length,
    });
  } catch (error) {
    console.error('Generate tokens POST error:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { error: 'An error occurred', details: error.message },
      { status: 500 }
    );
  }
}

// GET - Generate tokens for multiple days
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');
    const memberType = searchParams.get('memberType');
    const days = parseInt(searchParams.get('days') || '7');

    if (!memberId || !memberType) {
      return NextResponse.json(
        { error: 'Member ID and type are required' },
        { status: 400 }
      );
    }

    const results = [];
    const today = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      // Call the POST logic for each date
      const response = await fetch(new URL('/api/generate-tokens', request.url).origin + '/api/generate-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, memberType, date: dateStr }),
      });

      const data = await response.json();
      results.push({ date: dateStr, ...data });
    }

    return NextResponse.json({
      message: 'Token generation completed',
      results,
    });
  } catch (error) {
    console.error('Generate tokens GET error:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { error: 'An error occurred', details: error.message },
      { status: 500 }
    );
  }
}
