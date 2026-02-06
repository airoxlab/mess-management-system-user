import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET() {
  try {
    const { data: org, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (error) {
      console.error('Organization fetch error:', error);
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const settings = org.settings || {};

    // Admin stores meal times in settings jsonb with keys:
    // breakfast_start, breakfast_end, lunch_start, lunch_end, dinner_start, dinner_end
    // Format: 24-hour "HH:MM" (e.g., "19:00", "07:00")
    const mealTimes = {
      breakfast: {
        start: settings.breakfast_start || '07:00',
        end: settings.breakfast_end || '09:00',
      },
      lunch: {
        start: settings.lunch_start || '12:00',
        end: settings.lunch_end || '14:00',
      },
      dinner: {
        start: settings.dinner_start || '19:00',
        end: settings.dinner_end || '21:00',
      },
    };

    return NextResponse.json({
      organization: {
        id: org.id,
        name: org.name,
        mealSkipDeadline: org.meal_skip_deadline ?? 30,
        mealTimes,
        settings,
      },
    });
  } catch (error) {
    console.error('Organization API error:', error);
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}
