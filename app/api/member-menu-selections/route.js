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
    const memberId = searchParams.get('memberId');
    const memberType = searchParams.get('memberType');
    const date = searchParams.get('date');
    const organizationId = request.headers.get('x-organization-id');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    if (!memberId || !memberType) {
      return NextResponse.json(
        { error: 'Member ID and member type are required' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('member_menu_selections')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('member_id', memberId)
      .eq('member_type', memberType);

    if (date) {
      query = query.gte('date', date);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching menu selections:', error);
      return NextResponse.json(
        { error: 'Failed to fetch menu selections' },
        { status: 500 }
      );
    }

    return NextResponse.json({ selections: data || [] });
  } catch (error) {
    console.error('Error in member-menu-selections GET API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const organizationId = request.headers.get('x-organization-id');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { member_id, member_type, date, meal_type, menu_option_id } = body;

    if (!member_id || !member_type || !date || !meal_type) {
      return NextResponse.json(
        { error: 'Member ID, member type, date, and meal type are required' },
        { status: 400 }
      );
    }

    // Check if a selection already exists
    const { data: existing, error: fetchError } = await supabase
      .from('member_menu_selections')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('member_id', member_id)
      .eq('member_type', member_type)
      .eq('date', date)
      .eq('meal_type', meal_type)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error checking existing selection:', fetchError);
      return NextResponse.json(
        { error: 'Failed to check existing selection' },
        { status: 500 }
      );
    }

    let result;
    if (existing) {
      // Update existing selection
      const { data, error } = await supabase
        .from('member_menu_selections')
        .update({ menu_option_id })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating menu selection:', error);
        return NextResponse.json(
          { error: 'Failed to update menu selection' },
          { status: 500 }
        );
      }
      result = data;
    } else {
      // Create new selection
      const { data, error } = await supabase
        .from('member_menu_selections')
        .insert([
          {
            organization_id: organizationId,
            member_id,
            member_type,
            date,
            meal_type,
            menu_option_id,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error('Error creating menu selection:', error);
        return NextResponse.json(
          { error: 'Failed to create menu selection' },
          { status: 500 }
        );
      }
      result = data;
    }

    return NextResponse.json({ selection: result });
  } catch (error) {
    console.error('Error in member-menu-selections POST API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
