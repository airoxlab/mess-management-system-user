import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// POST - Create a meal report
export async function POST(request) {
  try {
    const { memberId, memberType, memberName, mealType, date, reason } = await request.json();

    if (!memberId || !memberType || !mealType || !date) {
      return NextResponse.json(
        { error: 'Member ID, type, meal type, and date are required' },
        { status: 400 }
      );
    }

    // Check if report already exists for this meal today
    const { data: existingReport } = await supabase
      .from('meal_reports')
      .select('id')
      .eq('member_id', memberId)
      .eq('member_type', memberType)
      .eq('meal_type', mealType.toUpperCase())
      .eq('report_date', date)
      .single();

    if (existingReport) {
      return NextResponse.json(
        { error: 'You have already reported this meal for today' },
        { status: 400 }
      );
    }

    // Create the report
    const { data: report, error } = await supabase
      .from('meal_reports')
      .insert({
        member_id: memberId,
        member_type: memberType,
        member_name: memberName,
        meal_type: mealType.toUpperCase(),
        report_date: date,
        reason: reason || 'Did not receive meal',
        status: 'PENDING',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating meal report:', error);
      return NextResponse.json(
        { error: 'Failed to create report' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Report submitted successfully',
      report,
    });
  } catch (error) {
    console.error('Meal report error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}

// GET - Get meal reports for a member
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

    const { data: reports, error } = await supabase
      .from('meal_reports')
      .select('*')
      .eq('member_id', memberId)
      .eq('member_type', memberType)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching meal reports:', error);
      return NextResponse.json(
        { error: 'Failed to fetch reports' },
        { status: 500 }
      );
    }

    return NextResponse.json({ reports: reports || [] });
  } catch (error) {
    console.error('Get meal reports error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
