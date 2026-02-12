import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
  try {
    const organizationId = request.headers.get('x-organization-id');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    const { data: settings, error } = await supabase
      .from('meal_settings')
      .select('*')
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching meal settings:', error);
      return NextResponse.json(
        { error: 'Failed to fetch meal settings' },
        { status: 500 }
      );
    }

    // If no settings exist, return default (all disabled)
    const defaultSettings = {
      breakfast_enabled: false,
      lunch_enabled: false,
      dinner_enabled: false,
    };

    return NextResponse.json({
      settings: settings || defaultSettings
    });
  } catch (error) {
    console.error('Error in meal-settings API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
