import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET meal selections for a member
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');
    const memberType = searchParams.get('memberType');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!memberId || !memberType) {
      return NextResponse.json(
        { error: 'Member ID and type are required' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('meal_selections')
      .select('*')
      .eq('member_id', memberId)
      .eq('member_type', memberType)
      .order('date', { ascending: true });

    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data, error } = await query;

    if (error) {
      // If table doesn't exist or other DB error, return empty array
      console.error('Meal selections query error:', error);
      // Return empty selections instead of 500 error for missing table
      // PGRST205 = table not found in schema cache
      if (error.code === '42P01' || error.code === 'PGRST205' || error.message?.includes('does not exist') || error.message?.includes('Could not find')) {
        return NextResponse.json({ selections: [] });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ selections: data || [] });
  } catch (error) {
    console.error('Get meal selections error:', error);
    // Return empty selections on error to prevent UI issues
    return NextResponse.json({ selections: [] });
  }
}

// POST - Create or update meal selections
export async function POST(request) {
  try {
    const body = await request.json();
    const { memberId, memberType, selections } = body;

    if (!memberId || !memberType || !selections || !Array.isArray(selections)) {
      return NextResponse.json(
        { error: 'Member ID, type, and selections array are required' },
        { status: 400 }
      );
    }

    // Get member's organization_id
    const memberTableMap = {
      student: 'student_members',
      faculty: 'faculty_members',
      staff: 'staff_members',
    };

    const memberTable = memberTableMap[memberType];
    if (!memberTable) {
      return NextResponse.json(
        { error: 'Invalid member type' },
        { status: 400 }
      );
    }

    const { data: memberData, error: memberError } = await supabase
      .from(memberTable)
      .select('organization_id')
      .eq('id', memberId)
      .single();

    if (memberError || !memberData) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    const organizationId = memberData.organization_id;

    // Process each selection (upsert)
    const results = [];
    for (const selection of selections) {
      const { date, breakfast, lunch, dinner } = selection;

      // Check if selection exists for this date
      const { data: existing } = await supabase
        .from('meal_selections')
        .select('id')
        .eq('member_id', memberId)
        .eq('member_type', memberType)
        .eq('date', date)
        .single();

      if (existing) {
        // Update existing
        const { data, error } = await supabase
          .from('meal_selections')
          .update({
            breakfast_needed: breakfast,
            lunch_needed: lunch,
            dinner_needed: dinner,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        results.push(data);
      } else {
        // Insert new with organization_id
        const { data, error } = await supabase
          .from('meal_selections')
          .insert({
            member_id: memberId,
            member_type: memberType,
            organization_id: organizationId,
            date: date,
            breakfast_needed: breakfast,
            lunch_needed: lunch,
            dinner_needed: dinner,
          })
          .select()
          .single();

        if (error) throw error;
        results.push(data);
      }
    }

    return NextResponse.json({ success: true, selections: results });
  } catch (error) {
    console.error('Create meal selections error:', error);
    // If table doesn't exist, inform user gracefully
    // PGRST205 = table not found in schema cache
    if (error.code === '42P01' || error.code === 'PGRST205' || error.message?.includes('does not exist') || error.message?.includes('Could not find')) {
      return NextResponse.json(
        { error: 'Meal selections feature is not configured. Please contact admin.' },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: error.message || 'An error occurred' },
      { status: 500 }
    );
  }
}

// DELETE - Cancel meal selection
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const selectionId = searchParams.get('id');

    if (!selectionId) {
      return NextResponse.json(
        { error: 'Selection ID is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('meal_selections')
      .delete()
      .eq('id', selectionId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete meal selection error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
