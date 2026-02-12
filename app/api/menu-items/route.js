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
    const mealType = searchParams.get('meal_type');
    const organizationId = request.headers.get('x-organization-id');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('menu_items')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_available', true)
      .order('sort_order', { ascending: true });

    // Filter by meal_type: show items with specific meal_type OR items marked as 'all'
    if (mealType && mealType !== 'all') {
      query = query.or(`meal_type.eq.${mealType},meal_type.eq.all`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching menu items:', error);
      return NextResponse.json(
        { error: 'Failed to fetch menu items' },
        { status: 500 }
      );
    }

    return NextResponse.json({ items: data || [] });
  } catch (error) {
    console.error('Error in menu-items API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
