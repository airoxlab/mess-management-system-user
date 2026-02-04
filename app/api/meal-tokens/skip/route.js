import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// POST - Skip/Cancel a meal token (preserves quota)
export async function POST(request) {
  try {
    const body = await request.json();
    const { memberId, memberType, date, mealType, action } = body;

    if (!memberId || !mealType || !date) {
      return NextResponse.json(
        { error: 'Member ID, meal type, and date are required' },
        { status: 400 }
      );
    }

    // Find the token for this date and meal type
    const { data: existingToken, error: findError } = await supabase
      .from('meal_tokens')
      .select('*')
      .eq('member_id', memberId)
      .eq('token_date', date)
      .eq('meal_type', mealType.toUpperCase())
      .single();

    if (findError && findError.code !== 'PGRST116') {
      console.error('Find token error:', findError);
      return NextResponse.json({ error: findError.message }, { status: 500 });
    }

    if (!existingToken) {
      return NextResponse.json(
        { error: 'No meal token found for this date and meal type' },
        { status: 404 }
      );
    }

    // Only allow skipping PENDING tokens
    if (existingToken.status !== 'PENDING') {
      return NextResponse.json(
        { error: `Cannot skip a meal that is already ${existingToken.status.toLowerCase()}` },
        { status: 400 }
      );
    }

    if (action === 'skip') {
      // Mark the token as CANCELLED (DB only allows: PENDING, COLLECTED, CANCELLED, EXPIRED)
      // Skip and Cancel are treated the same in the database
      const { data: updatedToken, error: updateError } = await supabase
        .from('meal_tokens')
        .update({
          status: 'CANCELLED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingToken.id)
        .select()
        .single();

      if (updateError) {
        console.error('Update token error:', updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Meal skipped successfully.',
        token: updatedToken,
      });
    } else if (action === 'cancel') {
      // Mark the token as CANCELLED
      const { data: updatedToken, error: updateError } = await supabase
        .from('meal_tokens')
        .update({
          status: 'CANCELLED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingToken.id)
        .select()
        .single();

      if (updateError) {
        console.error('Update token error:', updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Meal cancelled.',
        token: updatedToken,
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "skip" or "cancel"' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Skip meal error:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred' },
      { status: 500 }
    );
  }
}
