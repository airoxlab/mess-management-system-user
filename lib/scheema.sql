create table public.daily_basis_transactions (
  id uuid not null default gen_random_uuid (),
  package_id uuid not null,
  member_id uuid not null,
  transaction_type character varying(20) not null,
  amount numeric(10, 2) not null,
  balance_before numeric(10, 2) not null,
  balance_after numeric(10, 2) not null,
  meal_type character varying(20) null,
  description text null,
  created_at timestamp with time zone null default now(),
  organization_id uuid not null,
  constraint daily_basis_transactions_pkey primary key (id),
  constraint daily_basis_transactions_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint daily_basis_transactions_package_fkey foreign KEY (package_id) references member_packages (id) on delete CASCADE,
  constraint daily_basis_transactions_type_check check (
    (
      (transaction_type)::text = any (
        array[
          ('deposit'::character varying)::text,
          ('meal_deduction'::character varying)::text,
          ('refund'::character varying)::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_daily_transactions_package on public.daily_basis_transactions using btree (package_id) TABLESPACE pg_default;

create index IF not exists idx_daily_transactions_member on public.daily_basis_transactions using btree (member_id) TABLESPACE pg_default;

create index IF not exists idx_daily_transactions_date on public.daily_basis_transactions using btree (created_at) TABLESPACE pg_default;

create index IF not exists idx_daily_transactions_organization on public.daily_basis_transactions using btree (organization_id) TABLESPACE pg_default;

create table public.daily_token_counter (
  id uuid not null default extensions.uuid_generate_v4 (),
  organization_id uuid not null,
  counter_date date not null,
  last_token_no integer null default 0,
  created_at timestamp with time zone null default now(),
  constraint daily_token_counter_pkey primary key (id),
  constraint daily_token_counter_organization_id_counter_date_key unique (organization_id, counter_date),
  constraint daily_token_counter_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_daily_counter_org_date on public.daily_token_counter using btree (organization_id, counter_date) TABLESPACE pg_default;

create table public.faculty_members (
  id uuid not null default extensions.uuid_generate_v4 (),
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  full_name character varying(255) not null,
  department character varying(255) not null,
  designation character varying(255) not null,
  employee_id character varying(100) not null,
  contact_number character varying(20) not null,
  email_address character varying(255) not null,
  date_of_birth date null,
  membership_type character varying(50) not null,
  preferred_meal_plan character varying(50) not null,
  food_preference character varying(50) not null,
  has_food_allergies boolean null default false,
  food_allergies_details text null,
  communication_consent boolean null default false,
  complaint_policy_acknowledged boolean null default false,
  membership_id character varying(100) null,
  fee_category character varying(50) null,
  receipt_no character varying(100) null,
  status character varying(50) null default 'pending'::character varying,
  father_name character varying(255) null,
  cnic_no character varying(15) null,
  residential_address text null,
  organization_id uuid not null,
  constraint faculty_members_pkey primary key (id),
  constraint faculty_members_employee_id_key unique (employee_id),
  constraint faculty_members_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint faculty_members_membership_type_check check (
    (
      (membership_type)::text = any (
        (
          array[
            'full_time'::character varying,
            'partial'::character varying,
            'day_to_day'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint faculty_members_food_preference_check check (
    (
      (food_preference)::text = any (
        (
          array[
            'vegetarian'::character varying,
            'non_vegetarian'::character varying,
            'both'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint faculty_members_fee_category_check check (
    (
      (fee_category)::text = any (
        (
          array[
            'subsidized'::character varying,
            'standard'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint faculty_members_preferred_meal_plan_check check (
    (
      (preferred_meal_plan)::text = any (
        (
          array[
            'lunch'::character varying,
            'dinner'::character varying,
            'full_day'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint faculty_members_status_check check (
    (
      (status)::text = any (
        (
          array[
            'pending'::character varying,
            'approved'::character varying,
            'rejected'::character varying
          ]
        )::text[]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_faculty_email on public.faculty_members using btree (email_address) TABLESPACE pg_default;

create index IF not exists idx_faculty_employee_id on public.faculty_members using btree (employee_id) TABLESPACE pg_default;

create index IF not exists idx_faculty_status on public.faculty_members using btree (status) TABLESPACE pg_default;

create index IF not exists idx_faculty_organization on public.faculty_members using btree (organization_id) TABLESPACE pg_default;

create trigger update_faculty_members_updated_at BEFORE
update on faculty_members for EACH row
execute FUNCTION update_updated_at_column ();

create table public.meal_consumption_history (
  id uuid not null default gen_random_uuid (),
  package_id uuid not null,
  member_id uuid not null,
  member_type character varying(20) not null,
  meal_type character varying(20) not null,
  consumed_at timestamp with time zone null default now(),
  amount_deducted numeric(10, 2) null default 0,
  balance_after numeric(10, 2) null default 0,
  notes text null,
  organization_id uuid not null,
  constraint meal_consumption_history_pkey primary key (id),
  constraint meal_consumption_history_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint meal_consumption_history_package_fkey foreign KEY (package_id) references member_packages (id) on delete CASCADE,
  constraint meal_consumption_history_meal_type_check check (
    (
      (meal_type)::text = any (
        array[
          ('breakfast'::character varying)::text,
          ('lunch'::character varying)::text,
          ('dinner'::character varying)::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_meal_consumption_organization on public.meal_consumption_history using btree (organization_id) TABLESPACE pg_default;

create index IF not exists idx_meal_consumption_package on public.meal_consumption_history using btree (package_id) TABLESPACE pg_default;

create index IF not exists idx_meal_consumption_member on public.meal_consumption_history using btree (member_id, member_type) TABLESPACE pg_default;

create index IF not exists idx_meal_consumption_date on public.meal_consumption_history using btree (consumed_at) TABLESPACE pg_default;

create table public.meal_reports (
  id uuid not null default gen_random_uuid (),
  member_id uuid not null,
  member_type character varying(50) not null,
  member_name character varying(255) null,
  meal_type character varying(20) not null,
  report_date date not null,
  reason text null,
  status character varying(20) null default 'PENDING'::character varying,
  admin_notes text null,
  resolved_at timestamp with time zone null,
  resolved_by uuid null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  organization_id uuid not null,
  constraint meal_reports_pkey primary key (id),
  constraint meal_reports_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_meal_reports_member on public.meal_reports using btree (member_id, member_type) TABLESPACE pg_default;

create index IF not exists idx_meal_reports_date on public.meal_reports using btree (report_date) TABLESPACE pg_default;

create index IF not exists idx_meal_reports_status on public.meal_reports using btree (status) TABLESPACE pg_default;

create index IF not exists idx_meal_reports_organization on public.meal_reports using btree (organization_id) TABLESPACE pg_default;

create table public.meal_selections (
  id uuid not null default gen_random_uuid (),
  member_id uuid not null,
  member_type text not null,
  date date not null,
  breakfast_needed boolean null default true,
  lunch_needed boolean null default true,
  dinner_needed boolean null default true,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  organization_id uuid not null,
  constraint meal_selections_pkey primary key (id),
  constraint meal_selections_member_id_member_type_date_key unique (member_id, member_type, date),
  constraint meal_selections_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_meal_selections_organization on public.meal_selections using btree (organization_id) TABLESPACE pg_default;

create table public.meal_tokens (
  id uuid not null default extensions.uuid_generate_v4 (),
  organization_id uuid not null,
  member_id uuid not null,
  token_no integer not null,
  meal_type character varying(20) not null,
  token_date date not null,
  token_time time without time zone not null,
  status character varying(20) null default 'PENDING'::character varying,
  collected_at timestamp with time zone null,
  collected_by uuid null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint meal_tokens_pkey primary key (id),
  constraint meal_tokens_member_id_fkey foreign KEY (member_id) references members (id) on delete CASCADE,
  constraint meal_tokens_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint meal_tokens_meal_type_check check (
    (
      (meal_type)::text = any (
        (
          array[
            'BREAKFAST'::character varying,
            'LUNCH'::character varying,
            'DINNER'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint meal_tokens_status_check check (
    (
      (status)::text = any (
        (
          array[
            'PENDING'::character varying,
            'COLLECTED'::character varying,
            'CANCELLED'::character varying,
            'EXPIRED'::character varying
          ]
        )::text[]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_tokens_organization on public.meal_tokens using btree (organization_id) TABLESPACE pg_default;

create index IF not exists idx_tokens_member on public.meal_tokens using btree (member_id) TABLESPACE pg_default;

create index IF not exists idx_tokens_date on public.meal_tokens using btree (token_date) TABLESPACE pg_default;

create index IF not exists idx_tokens_status on public.meal_tokens using btree (status) TABLESPACE pg_default;

create trigger update_meal_tokens_updated_at BEFORE
update on meal_tokens for EACH row
execute FUNCTION update_updated_at_column ();

create table public.member_meal_packages (
  id uuid not null default extensions.uuid_generate_v4 (),
  member_id uuid not null,
  member_type character varying(20) not null,
  breakfast_enabled boolean null default false,
  breakfast_days text[] null default '{}'::text[],
  breakfast_meals_per_month integer null default 1,
  lunch_enabled boolean null default false,
  lunch_days text[] null default '{}'::text[],
  lunch_meals_per_month integer null default 1,
  dinner_enabled boolean null default false,
  dinner_days text[] null default '{}'::text[],
  dinner_meals_per_month integer null default 1,
  price numeric(10, 2) not null default 0,
  is_active boolean null default true,
  valid_from date null default CURRENT_DATE,
  valid_until date null,
  notes text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  organization_id uuid not null,
  constraint member_meal_packages_pkey primary key (id),
  constraint member_meal_packages_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_member_meal_packages_member on public.member_meal_packages using btree (member_id, member_type) TABLESPACE pg_default;

create index IF not exists idx_member_meal_packages_active on public.member_meal_packages using btree (is_active) TABLESPACE pg_default;

create index IF not exists idx_member_meal_packages_organization on public.member_meal_packages using btree (organization_id) TABLESPACE pg_default;

create trigger update_member_meal_packages_updated_at BEFORE
update on member_meal_packages for EACH row
execute FUNCTION update_updated_at_column ();

create table public.member_packages (
  id uuid not null default gen_random_uuid (),
  member_id uuid not null,
  member_type character varying(20) not null,
  package_type character varying(20) not null,
  start_date date null,
  end_date date null,
  breakfast_enabled boolean null default false,
  lunch_enabled boolean null default false,
  dinner_enabled boolean null default false,
  total_breakfast integer null default 0,
  total_lunch integer null default 0,
  total_dinner integer null default 0,
  consumed_breakfast integer null default 0,
  consumed_lunch integer null default 0,
  consumed_dinner integer null default 0,
  balance numeric(10, 2) null default 0,
  breakfast_price numeric(10, 2) null default 0,
  lunch_price numeric(10, 2) null default 0,
  dinner_price numeric(10, 2) null default 0,
  price numeric(10, 2) not null default 0,
  carried_over_from_package_id uuid null,
  carried_over_breakfast integer null default 0,
  carried_over_lunch integer null default 0,
  carried_over_dinner integer null default 0,
  status character varying(20) null default 'active'::character varying,
  is_active boolean null default true,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  disabled_meals jsonb null default '{}'::jsonb,
  organization_id uuid not null,
  constraint member_packages_pkey primary key (id),
  constraint member_packages_carried_over_fkey foreign KEY (carried_over_from_package_id) references member_packages (id),
  constraint member_packages_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint member_packages_member_type_check check (
    (
      (member_type)::text = any (
        array[
          ('student'::character varying)::text,
          ('faculty'::character varying)::text,
          ('staff'::character varying)::text
        ]
      )
    )
  ),
  constraint member_packages_package_type_check check (
    (
      (package_type)::text = any (
        array[
          ('full_time'::character varying)::text,
          ('partial_full_time'::character varying)::text,
          ('partial'::character varying)::text,
          ('daily_basis'::character varying)::text
        ]
      )
    )
  ),
  constraint member_packages_status_check check (
    (
      (status)::text = any (
        array[
          ('active'::character varying)::text,
          ('expired'::character varying)::text,
          ('renewed'::character varying)::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_member_packages_member on public.member_packages using btree (member_id, member_type) TABLESPACE pg_default;

create index IF not exists idx_member_packages_active on public.member_packages using btree (is_active) TABLESPACE pg_default;

create index IF not exists idx_member_packages_type on public.member_packages using btree (package_type) TABLESPACE pg_default;

create index IF not exists idx_member_packages_dates on public.member_packages using btree (start_date, end_date) TABLESPACE pg_default;

create index IF not exists idx_member_packages_organization on public.member_packages using btree (organization_id) TABLESPACE pg_default;

create trigger update_member_packages_updated_at BEFORE
update on member_packages for EACH row
execute FUNCTION update_updated_at_column ();

create table public.members (
  id uuid not null default extensions.uuid_generate_v4 (),
  organization_id uuid not null,
  member_id character varying(50) not null,
  name character varying(255) not null,
  contact character varying(20) null,
  email character varying(255) null,
  department character varying(100) null,
  member_type character varying(50) null default 'student'::character varying,
  status character varying(20) null default 'active'::character varying,
  balance_meals integer null default 0,
  valid_until date null,
  photo_url text null,
  qr_code text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint members_pkey primary key (id),
  constraint members_organization_id_member_id_key unique (organization_id, member_id),
  constraint members_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint members_member_type_check check (
    (
      (member_type)::text = any (
        (
          array[
            'student'::character varying,
            'staff'::character varying,
            'faculty'::character varying,
            'guest'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint members_status_check check (
    (
      (status)::text = any (
        (
          array[
            'active'::character varying,
            'inactive'::character varying,
            'suspended'::character varying
          ]
        )::text[]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_members_organization on public.members using btree (organization_id) TABLESPACE pg_default;

create index IF not exists idx_members_member_id on public.members using btree (member_id) TABLESPACE pg_default;

create index IF not exists idx_members_status on public.members using btree (status) TABLESPACE pg_default;

create trigger update_members_updated_at BEFORE
update on members for EACH row
execute FUNCTION update_updated_at_column ();

create table public.menu_categories (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  name character varying(255) not null,
  description text null,
  sort_order integer null default 0,
  is_active boolean null default true,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint menu_categories_pkey primary key (id),
  constraint menu_categories_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_menu_categories_organization on public.menu_categories using btree (organization_id) TABLESPACE pg_default;

create index IF not exists idx_menu_categories_active on public.menu_categories using btree (is_active) TABLESPACE pg_default;

create trigger update_menu_categories_updated_at BEFORE
update on menu_categories for EACH row
execute FUNCTION update_updated_at_column ();

create table public.menu_items (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  category_id uuid not null,
  name character varying(255) not null,
  description text null,
  price numeric(10, 2) not null default 0,
  image_url text null,
  is_available boolean null default true,
  sort_order integer null default 0,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint menu_items_pkey primary key (id),
  constraint menu_items_category_id_fkey foreign KEY (category_id) references menu_categories (id) on delete CASCADE,
  constraint menu_items_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_menu_items_organization on public.menu_items using btree (organization_id) TABLESPACE pg_default;

create index IF not exists idx_menu_items_category on public.menu_items using btree (category_id) TABLESPACE pg_default;

create index IF not exists idx_menu_items_available on public.menu_items using btree (is_available) TABLESPACE pg_default;

create trigger update_menu_items_updated_at BEFORE
update on menu_items for EACH row
execute FUNCTION update_updated_at_column ();

create table public.organizations (
  id uuid not null default extensions.uuid_generate_v4 (),
  name character varying(255) not null,
  slug character varying(100) not null,
  logo_url text null,
  address text null,
  contact_phone character varying(20) null,
  contact_email character varying(255) null,
  settings jsonb null default '{}'::jsonb,
  is_active boolean null default true,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  lost_card_fee numeric(10, 2) null default 500,
  support_phone character varying(50) null,
  support_whatsapp character varying(50) null,
  constraint organizations_pkey primary key (id),
  constraint organizations_slug_key unique (slug)
) TABLESPACE pg_default;

create trigger update_organizations_updated_at BEFORE
update on organizations for EACH row
execute FUNCTION update_updated_at_column ();

create table public.package_disabled_days (
  id uuid not null default gen_random_uuid (),
  package_id uuid not null,
  disabled_date date not null,
  created_at timestamp with time zone null default now(),
  organization_id uuid not null,
  constraint package_disabled_days_pkey primary key (id),
  constraint package_disabled_days_unique unique (package_id, disabled_date),
  constraint package_disabled_days_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint package_disabled_days_package_fkey foreign KEY (package_id) references member_packages (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_package_disabled_days_package on public.package_disabled_days using btree (package_id) TABLESPACE pg_default;

create index IF not exists idx_package_disabled_days_organization on public.package_disabled_days using btree (organization_id) TABLESPACE pg_default;

create table public.package_history (
  id uuid not null default gen_random_uuid (),
  member_id uuid not null,
  member_type character varying(20) not null,
  package_id uuid not null,
  previous_package_id uuid null,
  action character varying(20) not null,
  package_type character varying(20) null,
  total_breakfast integer null,
  total_lunch integer null,
  total_dinner integer null,
  consumed_breakfast integer null,
  consumed_lunch integer null,
  consumed_dinner integer null,
  balance numeric(10, 2) null,
  created_at timestamp with time zone null default now(),
  organization_id uuid not null,
  constraint package_history_pkey primary key (id),
  constraint package_history_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint package_history_package_fkey foreign KEY (package_id) references member_packages (id) on delete CASCADE,
  constraint package_history_previous_fkey foreign KEY (previous_package_id) references member_packages (id),
  constraint package_history_action_check check (
    (
      (action)::text = any (
        array[
          ('created'::character varying)::text,
          ('renewed'::character varying)::text,
          ('expired'::character varying)::text,
          ('cancelled'::character varying)::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_package_history_member on public.package_history using btree (member_id, member_type) TABLESPACE pg_default;

create index IF not exists idx_package_history_package on public.package_history using btree (package_id) TABLESPACE pg_default;

create index IF not exists idx_package_history_organization on public.package_history using btree (organization_id) TABLESPACE pg_default;

create table public.packages (
  id uuid not null default extensions.uuid_generate_v4 (),
  organization_id uuid not null,
  name character varying(100) not null,
  description text null,
  meals_count integer not null,
  price numeric(10, 2) not null,
  validity_days integer null default 30,
  is_active boolean null default true,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint packages_pkey primary key (id),
  constraint packages_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_packages_organization on public.packages using btree (organization_id) TABLESPACE pg_default;

create trigger update_packages_updated_at BEFORE
update on packages for EACH row
execute FUNCTION update_updated_at_column ();

create table public.staff_members (
  id uuid not null default extensions.uuid_generate_v4 (),
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  full_name character varying(255) not null,
  father_name character varying(255) not null,
  cnic_no character varying(20) not null,
  employee_id character varying(100) not null,
  department_section character varying(255) not null,
  designation character varying(255) not null,
  contact_number character varying(20) not null,
  residential_address text not null,
  date_of_birth date null,
  duty_shift character varying(50) not null,
  membership_type character varying(50) not null,
  meal_timing_preference character varying(50) [] not null,
  food_preference character varying(50) not null,
  food_allergies_medical_needs text null,
  emergency_contact_name character varying(255) null,
  emergency_contact_number character varying(20) null,
  fee_payment_method character varying(50) not null,
  fee_payment_other_details text null,
  complaint_policy_acknowledged boolean null default false,
  membership_id character varying(100) null,
  membership_start_date date null,
  fee_amount numeric(10, 2) null,
  additional_discount numeric(10, 2) null,
  receipt_no character varying(100) null,
  status character varying(50) null default 'pending'::character varying,
  email_address text null,
  communication_consent boolean null default false,
  has_food_allergies boolean null default false,
  organization_id uuid not null,
  constraint staff_members_pkey primary key (id),
  constraint staff_members_employee_id_key unique (employee_id),
  constraint staff_members_cnic_no_key unique (cnic_no),
  constraint staff_members_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint staff_members_membership_type_check check (
    (
      (membership_type)::text = any (
        (
          array[
            'full_time'::character varying,
            'partial'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint staff_members_status_check check (
    (
      (status)::text = any (
        (
          array[
            'pending'::character varying,
            'approved'::character varying,
            'rejected'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint staff_members_duty_shift_check check (
    (
      (duty_shift)::text = any (
        (
          array[
            'morning'::character varying,
            'evening'::character varying,
            'night'::character varying,
            'full_day'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint staff_members_fee_payment_method_check check (
    (
      (fee_payment_method)::text = any (
        (
          array[
            'cash'::character varying,
            'online'::character varying,
            'other'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint staff_members_food_preference_check check (
    (
      (food_preference)::text = any (
        (
          array[
            'vegetarian'::character varying,
            'non_vegetarian'::character varying,
            'both'::character varying
          ]
        )::text[]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_staff_employee_id on public.staff_members using btree (employee_id) TABLESPACE pg_default;

create index IF not exists idx_staff_cnic on public.staff_members using btree (cnic_no) TABLESPACE pg_default;

create index IF not exists idx_staff_status on public.staff_members using btree (status) TABLESPACE pg_default;

create index IF not exists idx_staff_organization on public.staff_members using btree (organization_id) TABLESPACE pg_default;

create trigger update_staff_members_updated_at BEFORE
update on staff_members for EACH row
execute FUNCTION update_updated_at_column ();

create table public.student_members (
  id uuid not null default extensions.uuid_generate_v4 (),
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  full_name character varying(255) not null,
  guardian_name character varying(255) not null,
  student_cnic character varying(20) not null,
  roll_number character varying(100) not null,
  department_program character varying(255) not null,
  date_of_birth date not null,
  gender character varying(20) not null,
  contact_number character varying(20) null,
  email_address character varying(255) null,
  residential_address text not null,
  hostel_day_scholar character varying(50) not null,
  membership_type character varying(50) not null,
  preferred_meal_plan character varying(50) [] not null,
  food_preference character varying(50) not null,
  has_food_allergies boolean null default false,
  food_allergies_details text null,
  medical_conditions text null,
  emergency_contact_name character varying(255) not null,
  emergency_contact_number character varying(20) not null,
  payment_method character varying(50) not null,
  payment_other_details text null,
  complaint_policy_acknowledged boolean null default false,
  membership_id character varying(100) null,
  fee_received numeric(10, 2) null,
  receipt_no character varying(100) null,
  status character varying(50) null default 'pending'::character varying,
  communication_consent boolean null default false,
  organization_id uuid not null,
  constraint student_members_pkey primary key (id),
  constraint student_members_roll_number_key unique (roll_number),
  constraint student_members_student_cnic_key unique (student_cnic),
  constraint student_members_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint student_members_food_preference_check check (
    (
      (food_preference)::text = any (
        (
          array[
            'vegetarian'::character varying,
            'non_vegetarian'::character varying,
            'both'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint student_members_status_check check (
    (
      (status)::text = any (
        (
          array[
            'pending'::character varying,
            'approved'::character varying,
            'rejected'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint student_members_payment_method_check check (
    (
      (payment_method)::text = any (
        (
          array[
            'cash'::character varying,
            'online'::character varying,
            'other'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint student_members_gender_check check (
    (
      (gender)::text = any (
        (
          array[
            'male'::character varying,
            'female'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint student_members_hostel_day_scholar_check check (
    (
      (hostel_day_scholar)::text = any (
        (
          array[
            'hostel'::character varying,
            'day_scholar'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint student_members_membership_type_check check (
    (
      (membership_type)::text = any (
        (
          array[
            'full_time'::character varying,
            'partial'::character varying
          ]
        )::text[]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_student_roll_number on public.student_members using btree (roll_number) TABLESPACE pg_default;

create index IF not exists idx_student_cnic on public.student_members using btree (student_cnic) TABLESPACE pg_default;

create index IF not exists idx_student_status on public.student_members using btree (status) TABLESPACE pg_default;

create index IF not exists idx_student_organization on public.student_members using btree (organization_id) TABLESPACE pg_default;

create trigger update_student_members_updated_at BEFORE
update on student_members for EACH row
execute FUNCTION update_updated_at_column ();

create table public.transactions (
  id uuid not null default extensions.uuid_generate_v4 (),
  organization_id uuid not null,
  member_id uuid not null,
  type character varying(20) not null,
  meals_change integer not null,
  balance_after integer not null,
  package_id uuid null,
  token_id uuid null,
  payment_method character varying(50) null,
  payment_reference character varying(100) null,
  amount numeric(10, 2) null,
  notes text null,
  created_by uuid null,
  created_at timestamp with time zone null default now(),
  constraint transactions_pkey primary key (id),
  constraint transactions_member_id_fkey foreign KEY (member_id) references members (id) on delete CASCADE,
  constraint transactions_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint transactions_package_id_fkey foreign KEY (package_id) references packages (id),
  constraint transactions_token_id_fkey foreign KEY (token_id) references meal_tokens (id),
  constraint transactions_type_check check (
    (
      (type)::text = any (
        (
          array[
            'TOPUP'::character varying,
            'DEDUCTION'::character varying,
            'REFUND'::character varying,
            'ADJUSTMENT'::character varying
          ]
        )::text[]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_transactions_organization on public.transactions using btree (organization_id) TABLESPACE pg_default;

create index IF not exists idx_transactions_member on public.transactions using btree (member_id) TABLESPACE pg_default;

create index IF not exists idx_transactions_type on public.transactions using btree (type) TABLESPACE pg_default;

create table public.users (
  id uuid not null default extensions.uuid_generate_v4 (),
  organization_id uuid null,
  email character varying(255) not null,
  password character varying(255) not null,
  full_name character varying(255) null,
  role character varying(50) null default 'admin'::character varying,
  is_active boolean null default true,
  last_login timestamp with time zone null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint users_pkey primary key (id),
  constraint users_email_key unique (email),
  constraint users_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint users_role_check check (
    (
      (role)::text = any (
        (
          array[
            'super_admin'::character varying,
            'admin'::character varying,
            'staff'::character varying,
            'viewer'::character varying
          ]
        )::text[]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_users_organization on public.users using btree (organization_id) TABLESPACE pg_default;

create index IF not exists idx_users_email on public.users using btree (email) TABLESPACE pg_default;