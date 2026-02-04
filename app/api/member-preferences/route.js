import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get the table name based on member type
const getTableName = (memberType) => {
  const tables = {
    student: 'student_members',
    faculty: 'faculty_members',
    staff: 'staff_members',
  };
  return tables[memberType] || 'student_members';
};

// PUT - Update member preferences
export async function PUT(request) {
  try {
    const { memberId, memberType, preferences } = await request.json();

    if (!memberId || !memberType || !preferences) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const tableName = getTableName(memberType);

    // Build the update object based on member type
    const updateData = {
      membership_type: preferences.membership_type,
      food_preference: preferences.food_preference,
      has_food_allergies: preferences.has_food_allergies,
      food_allergies_details: preferences.food_allergies_details || null,
      medical_conditions: preferences.medical_conditions || null,
      updated_at: new Date().toISOString(),
    };

    // Handle meal plan field - different tables might use different column names
    if (memberType === 'student') {
      updateData.preferred_meal_plan = preferences.preferred_meal_plan;
    } else if (memberType === 'faculty') {
      updateData.meal_timing_preference = preferences.preferred_meal_plan;
    } else if (memberType === 'staff') {
      updateData.preferred_meal_plan = preferences.preferred_meal_plan;
    }

    const { data, error } = await supabase
      .from(tableName)
      .update(updateData)
      .eq('id', memberId)
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to update preferences' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Preferences updated successfully',
      member: data,
    });
  } catch (error) {
    console.error('Error updating preferences:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - Get member preferences
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');
    const memberType = searchParams.get('memberType');

    if (!memberId || !memberType) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const tableName = getTableName(memberType);

    const { data, error } = await supabase
      .from(tableName)
      .select('membership_type, food_preference, preferred_meal_plan, meal_timing_preference, has_food_allergies, food_allergies_details, medical_conditions')
      .eq('id', memberId)
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch preferences' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      preferences: data,
    });
  } catch (error) {
    console.error('Error fetching preferences:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
