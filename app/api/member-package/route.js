import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET member's active package with meal counts
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');
    const memberType = searchParams.get('memberType');

    if (!memberId || !memberType) {
      return NextResponse.json(
        { error: 'Member ID and type are required' },
        { status: 400 }
      );
    }

    // Get active package from member_meal_packages table
    const { data: memberPackage, error } = await supabase
      .from('member_meal_packages')
      .select('*')
      .eq('member_id', memberId)
      .eq('member_type', memberType)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!memberPackage) {
      return NextResponse.json({ package: null });
    }

    // Get collected/pending meal tokens count
    const today = new Date().toISOString().split('T')[0];

    // Get all tokens for this member within package validity
    const { data: tokens, error: tokensError } = await supabase
      .from('meal_tokens')
      .select('meal_type, status, token_date')
      .eq('member_id', memberId)
      .gte('token_date', memberPackage.valid_from || today)
      .lte('token_date', memberPackage.valid_until || '2099-12-31');

    if (tokensError) {
      console.error('Tokens fetch error:', tokensError);
    }

    // Helper to parse boolean values (handles string 'true'/'false' from DB)
    const parseBoolean = (value) => {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') return value.toLowerCase() === 'true';
      return Boolean(value);
    };

    // Helper to parse number values (handles string numbers from DB)
    const parseNumber = (value) => {
      if (typeof value === 'number') return value;
      if (typeof value === 'string') return parseInt(value, 10) || 0;
      return 0;
    };

    // Get total meals from package configuration (meals per month)
    const getTotalMeals = (mealType) => {
      const enabled = parseBoolean(memberPackage[`${mealType}_enabled`]);
      if (!enabled) return 0;

      // Support both new (meals_per_month) and old (meals_per_day) column names
      const mealsPerMonth = parseNumber(memberPackage[`${mealType}_meals_per_month`]);
      const mealsPerDay = parseNumber(memberPackage[`${mealType}_meals_per_day`]);

      return mealsPerMonth || mealsPerDay || 0;
    };

    // Normalize boolean fields for frontend
    const normalizedPackage = {
      ...memberPackage,
      breakfast_enabled: parseBoolean(memberPackage.breakfast_enabled),
      lunch_enabled: parseBoolean(memberPackage.lunch_enabled),
      dinner_enabled: parseBoolean(memberPackage.dinner_enabled),
      is_active: parseBoolean(memberPackage.is_active),
      breakfast_meals_per_month: parseNumber(memberPackage.breakfast_meals_per_month),
      lunch_meals_per_month: parseNumber(memberPackage.lunch_meals_per_month),
      dinner_meals_per_month: parseNumber(memberPackage.dinner_meals_per_month),
    };

    // Calculate stats from tokens
    const tokenStats = {
      breakfast: { collected: 0, pending: 0, cancelled: 0, total: getTotalMeals('breakfast') },
      lunch: { collected: 0, pending: 0, cancelled: 0, total: getTotalMeals('lunch') },
      dinner: { collected: 0, pending: 0, cancelled: 0, total: getTotalMeals('dinner') },
    };

    if (tokens) {
      tokens.forEach(token => {
        const mealKey = token.meal_type.toLowerCase();
        if (tokenStats[mealKey]) {
          if (token.status === 'COLLECTED') {
            tokenStats[mealKey].collected++;
          } else if (token.status === 'PENDING') {
            tokenStats[mealKey].pending++;
          } else if (token.status === 'CANCELLED') {
            tokenStats[mealKey].cancelled++;
          }
        }
      });
    }

    // Calculate remaining days
    const packageValidUntil = memberPackage.valid_until ? new Date(memberPackage.valid_until) : null;
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    let daysRemaining = null;
    let isUnlimited = false;
    if (packageValidUntil) {
      const timeDiff = packageValidUntil.getTime() - todayDate.getTime();
      daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
      if (daysRemaining < 0) daysRemaining = 0;
    } else {
      isUnlimited = true;
    }

    return NextResponse.json({
      package: {
        ...normalizedPackage,
        daysRemaining,
        isUnlimited,
        tokenStats,
      }
    });
  } catch (error) {
    console.error('Get member package error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
