import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const { email, credential, userType } = await request.json();

    if (!email || !credential || !userType) {
      return NextResponse.json(
        { error: 'Email, credential, and user type are required' },
        { status: 400 }
      );
    }

    // Normalize credential (remove dashes)
    const normalizedCredential = credential.replace(/-/g, '');

    // Handle login based on user type
    if (userType === 'student') {
      // Student: email_address + student_cnic
      const { data: studentMember, error } = await supabase
        .from('student_members')
        .select('*')
        .eq('email_address', email.toLowerCase())
        .single();

      if (error || !studentMember) {
        return NextResponse.json(
          { error: 'No student account found with this email.' },
          { status: 404 }
        );
      }

      // Verify CNIC
      const studentCnic = studentMember.student_cnic?.replace(/-/g, '');
      if (studentCnic !== normalizedCredential) {
        return NextResponse.json(
          { error: 'Invalid CNIC. Please check and try again.' },
          { status: 401 }
        );
      }

      if (studentMember.status !== 'approved') {
        return NextResponse.json(
          { error: `Your account is ${studentMember.status}. Please contact admin.` },
          { status: 403 }
        );
      }

      return NextResponse.json({
        member: studentMember,
        memberType: 'student',
      });
    }

    if (userType === 'staff') {
      // Staff: email_address + cnic_no
      const { data: staffMember, error } = await supabase
        .from('staff_members')
        .select('*')
        .eq('email_address', email.toLowerCase())
        .single();

      if (error || !staffMember) {
        return NextResponse.json(
          { error: 'No staff account found with this email.' },
          { status: 404 }
        );
      }

      // Verify CNIC
      const staffCnic = staffMember.cnic_no?.replace(/-/g, '');
      if (staffCnic !== normalizedCredential) {
        return NextResponse.json(
          { error: 'Invalid CNIC. Please check and try again.' },
          { status: 401 }
        );
      }

      if (staffMember.status !== 'approved') {
        return NextResponse.json(
          { error: `Your account is ${staffMember.status}. Please contact admin.` },
          { status: 403 }
        );
      }

      return NextResponse.json({
        member: staffMember,
        memberType: 'staff',
      });
    }

    if (userType === 'faculty') {
      // Faculty: email_address + contact_number
      const { data: facultyMember, error } = await supabase
        .from('faculty_members')
        .select('*')
        .eq('email_address', email.toLowerCase())
        .single();

      if (error || !facultyMember) {
        return NextResponse.json(
          { error: 'No faculty account found with this email.' },
          { status: 404 }
        );
      }

      // Verify contact number
      const facultyContact = facultyMember.contact_number?.replace(/-/g, '');
      if (facultyContact !== normalizedCredential) {
        return NextResponse.json(
          { error: 'Invalid contact number. Please check and try again.' },
          { status: 401 }
        );
      }

      if (facultyMember.status !== 'approved') {
        return NextResponse.json(
          { error: `Your account is ${facultyMember.status}. Please contact admin.` },
          { status: 403 }
        );
      }

      return NextResponse.json({
        member: facultyMember,
        memberType: 'faculty',
      });
    }

    return NextResponse.json(
      { error: 'Invalid user type.' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'An error occurred during login' },
      { status: 500 }
    );
  }
}
