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
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const organizationId = request.headers.get('x-organization-id');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('menu_options')
      .select('*')
      .eq('organization_id', organizationId)
      .order('date', { ascending: true })
      .order('meal_type', { ascending: true })
      .order('option_name', { ascending: true });

    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching menu options:', error);
      return NextResponse.json(
        { error: 'Failed to fetch menu options' },
        { status: 500 }
      );
    }

    return NextResponse.json({ options: data || [] });
  } catch (error) {
    console.error('Error in menu-options API:', error);
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
    const { date, meal_type, option_name } = body;

    if (!date || !meal_type || !option_name) {
      return NextResponse.json(
        { error: 'Date, meal type, and option name are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('menu_options')
      .insert([
        {
          organization_id: organizationId,
          date,
          meal_type,
          option_name,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating menu option:', error);
      return NextResponse.json(
        { error: 'Failed to create menu option' },
        { status: 500 }
      );
    }

    return NextResponse.json({ option: data });
  } catch (error) {
    console.error('Error in menu-options POST API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
