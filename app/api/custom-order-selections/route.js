import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET custom order selections with items
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');
    const memberType = searchParams.get('memberType');
    const date = searchParams.get('date');
    const mealType = searchParams.get('mealType');
    const organizationId = request.headers.get('x-organization-id');

    if (!organizationId || !memberId || !memberType) {
      return NextResponse.json(
        { error: 'Organization ID, member ID, and member type are required' },
        { status: 400 }
      );
    }

    // Build query for custom_order_items
    let query = supabase
      .from('custom_order_items')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('member_id', memberId)
      .eq('member_type', memberType);

    if (date) {
      query = query.eq('date', date);
    }

    if (mealType) {
      query = query.eq('meal_type', mealType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching custom order items:', error);
      return NextResponse.json(
        { error: 'Failed to fetch custom order items' },
        { status: 500 }
      );
    }

    return NextResponse.json({ items: data || [] });
  } catch (error) {
    console.error('Error in custom-order-selections GET API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST save custom order with multiple items
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
    const { member_id, member_type, meal_type, date, items } = body;

    if (!member_id || !member_type || !meal_type || !date || !items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: 'Member ID, member type, meal type, date, and items array are required' },
        { status: 400 }
      );
    }

    if (items.length === 0) {
      return NextResponse.json(
        { error: 'At least one item is required' },
        { status: 400 }
      );
    }

    // Calculate totals
    const totalAmount = items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    // Delete existing items for this meal
    await supabase
      .from('custom_order_items')
      .delete()
      .eq('organization_id', organizationId)
      .eq('member_id', member_id)
      .eq('member_type', member_type)
      .eq('meal_type', meal_type)
      .eq('date', date);

    // Insert new items
    const itemsToInsert = items.map(item => ({
      organization_id: organizationId,
      member_id,
      member_type,
      date,
      meal_type,
      menu_item_id: item.menu_item_id,
      item_name: item.item_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.unit_price * item.quantity,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const { data: insertedItems, error: itemsError } = await supabase
      .from('custom_order_items')
      .insert(itemsToInsert)
      .select();

    if (itemsError) {
      console.error('Error inserting custom order items:', itemsError);
      return NextResponse.json(
        { error: 'Failed to save custom order items' },
        { status: 500 }
      );
    }

    // Upsert custom_order_selections record
    const { data: selection, error: selectionError } = await supabase
      .from('custom_order_selections')
      .upsert(
        {
          organization_id: organizationId,
          member_id,
          member_type,
          meal_type,
          date,
          total_amount: totalAmount,
          item_count: itemCount,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'member_id,member_type,meal_type,date',
          ignoreDuplicates: false,
        }
      )
      .select()
      .single();

    if (selectionError) {
      console.error('Error upserting custom order selection:', selectionError);
      return NextResponse.json(
        { error: 'Failed to save custom order selection' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      selection,
      items: insertedItems,
      total_amount: totalAmount,
      item_count: itemCount
    });
  } catch (error) {
    console.error('Error in custom-order-selections POST API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE custom order selection and all items
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');
    const memberType = searchParams.get('memberType');
    const mealType = searchParams.get('mealType');
    const date = searchParams.get('date');
    const organizationId = request.headers.get('x-organization-id');

    if (!organizationId || !memberId || !memberType || !mealType || !date) {
      return NextResponse.json(
        { error: 'All parameters are required' },
        { status: 400 }
      );
    }

    // Delete all items
    const { error: itemsError } = await supabase
      .from('custom_order_items')
      .delete()
      .eq('organization_id', organizationId)
      .eq('member_id', memberId)
      .eq('member_type', memberType)
      .eq('meal_type', mealType)
      .eq('date', date);

    if (itemsError) {
      console.error('Error deleting custom order items:', itemsError);
      return NextResponse.json(
        { error: 'Failed to delete custom order items' },
        { status: 500 }
      );
    }

    // Delete selection record
    const { error: selectionError } = await supabase
      .from('custom_order_selections')
      .delete()
      .eq('organization_id', organizationId)
      .eq('member_id', memberId)
      .eq('member_type', memberType)
      .eq('meal_type', mealType)
      .eq('date', date);

    if (selectionError) {
      console.error('Error deleting custom order selection:', selectionError);
      return NextResponse.json(
        { error: 'Failed to delete custom order selection' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in custom-order-selections DELETE API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
