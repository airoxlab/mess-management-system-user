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

    // Get active package from member_packages table (correct table with package_type)
    const { data: memberPackage, error } = await supabase
      .from('member_packages')
      .select('*')
      .eq('member_id', memberId)
      .eq('member_type', memberType)
      .eq('is_active', true)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!memberPackage) {
      return NextResponse.json({ package: null });
    }

    const today = new Date().toISOString().split('T')[0];

    // Helper to parse boolean values
    const parseBoolean = (value) => {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') return value.toLowerCase() === 'true';
      return Boolean(value);
    };

    // Helper to parse number values
    const parseNumber = (value) => {
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const parsed = parseFloat(value);
        return isNaN(parsed) ? 0 : parsed;
      }
      return 0;
    };

    // Normalize package data
    const normalizedPackage = {
      ...memberPackage,
      breakfast_enabled: parseBoolean(memberPackage.breakfast_enabled),
      lunch_enabled: parseBoolean(memberPackage.lunch_enabled),
      dinner_enabled: parseBoolean(memberPackage.dinner_enabled),
      is_active: parseBoolean(memberPackage.is_active),
      total_breakfast: parseNumber(memberPackage.total_breakfast),
      total_lunch: parseNumber(memberPackage.total_lunch),
      total_dinner: parseNumber(memberPackage.total_dinner),
      consumed_breakfast: parseNumber(memberPackage.consumed_breakfast),
      consumed_lunch: parseNumber(memberPackage.consumed_lunch),
      consumed_dinner: parseNumber(memberPackage.consumed_dinner),
      balance: parseNumber(memberPackage.balance),
      breakfast_price: parseNumber(memberPackage.breakfast_price),
      lunch_price: parseNumber(memberPackage.lunch_price),
      dinner_price: parseNumber(memberPackage.dinner_price),
      price: parseNumber(memberPackage.price),
    };

    // Calculate meal statistics
    const getMealStats = (mealType) => {
      const total = normalizedPackage[`total_${mealType}`];
      const consumed = normalizedPackage[`consumed_${mealType}`];
      const remaining = total - consumed;

      return {
        total,
        consumed,
        remaining: remaining > 0 ? remaining : 0,
        enabled: normalizedPackage[`${mealType}_enabled`],
      };
    };

    const mealStats = {
      breakfast: getMealStats('breakfast'),
      lunch: getMealStats('lunch'),
      dinner: getMealStats('dinner'),
    };

    // Get meal tokens for today's status
    const { data: todayTokens } = await supabase
      .from('meal_tokens')
      .select('meal_type, status')
      .eq('member_id', memberId)
      .eq('token_date', today);

    const todayMealStatus = {
      breakfast: null,
      lunch: null,
      dinner: null,
    };

    if (todayTokens) {
      todayTokens.forEach(token => {
        const mealKey = token.meal_type.toLowerCase();
        todayMealStatus[mealKey] = token.status;
      });
    }

    // Calculate remaining days
    const packageValidUntil = memberPackage.end_date ? new Date(memberPackage.end_date) : null;
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    let daysRemaining = null;
    let isUnlimited = false;
    let isExpired = false;

    if (packageValidUntil) {
      const timeDiff = packageValidUntil.getTime() - todayDate.getTime();
      daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
      if (daysRemaining < 0) {
        daysRemaining = 0;
        isExpired = true;
      }
    } else {
      isUnlimited = true;
    }

    // Format package type for display
    const packageTypeLabels = {
      full_time: 'Full Time',
      partial_full_time: 'Full Time (Weekend Off)',
      partial: 'Partial',
      daily_basis: 'Daily Basis',
    };

    return NextResponse.json({
      package: {
        ...normalizedPackage,
        daysRemaining,
        isUnlimited,
        isExpired,
        mealStats,
        todayMealStatus,
        packageTypeLabel: packageTypeLabels[memberPackage.package_type] || memberPackage.package_type,
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
