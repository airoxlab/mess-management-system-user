-- Step 1: Check if the scanned members exist in any member table
-- Check student_members
SELECT 'student' as member_type, id, membership_id, full_name, status, organization_id
FROM student_members
WHERE membership_id IN ('012000002090', '1200R25070202');

-- Check faculty_members
SELECT 'faculty' as member_type, id, membership_id, full_name, status, organization_id
FROM faculty_members
WHERE membership_id IN ('012000002090', '1200R25070202');

-- Check staff_members
SELECT 'staff' as member_type, id, membership_id, full_name, status, organization_id
FROM staff_members
WHERE membership_id IN ('012000002090', '1200R25070202');

-- Step 2: Check if these members have any packages (using the IDs from above)
-- Replace 'MEMBER_ID_HERE' and 'MEMBER_TYPE_HERE' with actual values from Step 1
SELECT mp.*, p.name as package_name, p.total_meals, p.duration_days, p.price
FROM member_packages mp
JOIN packages p ON mp.package_id = p.id
WHERE mp.member_id = 'MEMBER_ID_HERE' 
  AND mp.member_type = 'MEMBER_TYPE_HERE'
  AND mp.status = 'active'
ORDER BY mp.created_at DESC;

-- Step 3: If no active package, check all packages for the member
SELECT mp.*, p.name as package_name, p.total_meals, p.duration_days, p.price
FROM member_packages mp
JOIN packages p ON mp.package_id = p.id
WHERE mp.member_id = 'MEMBER_ID_HERE' 
  AND mp.member_type = 'MEMBER_TYPE_HERE'
ORDER BY mp.created_at DESC;
