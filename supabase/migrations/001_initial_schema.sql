-- ImhoHeal application schema.
-- Apply once from the Supabase SQL Editor for the empty project.

create schema if not exists private;

create table public.patients (
    id text primary key,
    name text not null,
    age integer not null check (age between 0 and 125),
    sex text not null,
    injury text not null,
    implant text not null,
    surgeon text not null default 'Dr. Amira Khalil',
    surgery_date date not null,
    weeks_since_surgery integer not null check (weeks_since_surgery >= 0),
    created_at timestamptz not null default now()
);

create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    name text not null,
    role text not null default 'patient' check (role in ('doctor', 'patient')),
    patient_id text references public.patients(id) on delete set null,
    created_at timestamptz not null default now()
);

create table public.weekly_readings (
    id bigint generated always as identity primary key,
    patient_id text not null references public.patients(id) on delete cascade,
    week integer not null check (week > 0),
    recorded_at date not null,
    strain_load double precision not null check (strain_load between 0 and 150),
    bone_density double precision not null check (bone_density between 50 and 800),
    data_source text not null default 'demo' check (data_source in ('demo', 'research')),
    created_at timestamptz not null default now(),
    unique (patient_id, week)
);

create table public.devices (
    id text primary key check (id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
    patient_id text not null references public.patients(id) on delete cascade,
    token_hash text not null,
    created_at timestamptz not null default now(),
    last_seen_at timestamptz
);

create table public.motion_readings (
    id bigint generated always as identity primary key,
    device_id text not null references public.devices(id) on delete cascade,
    sequence bigint not null check (sequence > 0),
    recorded_at timestamptz not null,
    acceleration_x_g double precision not null check (acceleration_x_g between -16 and 16),
    acceleration_y_g double precision not null check (acceleration_y_g between -16 and 16),
    acceleration_z_g double precision not null check (acceleration_z_g between -16 and 16),
    gyroscope_x_dps double precision not null check (gyroscope_x_dps between -2000 and 2000),
    gyroscope_y_dps double precision not null check (gyroscope_y_dps between -2000 and 2000),
    gyroscope_z_dps double precision not null check (gyroscope_z_dps between -2000 and 2000),
    created_at timestamptz not null default now(),
    unique (device_id, sequence)
);

create table public.public_reviews (
    id bigint generated always as identity primary key,
    author text not null,
    review_text text not null,
    rating integer not null check (rating between 1 and 5),
    data_source text not null default 'demo' check (data_source = 'demo'),
    created_at timestamptz not null default now()
);

create index weekly_readings_patient_week_idx
    on public.weekly_readings (patient_id, week);
create index devices_patient_idx on public.devices (patient_id);
create index motion_readings_device_time_idx
    on public.motion_readings (device_id, recorded_at desc);

create or replace function public.store_motion_reading(
    p_device_id text,
    p_sequence bigint,
    p_recorded_at timestamptz,
    p_acceleration_x_g double precision,
    p_acceleration_y_g double precision,
    p_acceleration_z_g double precision,
    p_gyroscope_x_dps double precision,
    p_gyroscope_y_dps double precision,
    p_gyroscope_z_dps double precision
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    insert into public.motion_readings (
        device_id, sequence, recorded_at,
        acceleration_x_g, acceleration_y_g, acceleration_z_g,
        gyroscope_x_dps, gyroscope_y_dps, gyroscope_z_dps
    )
    values (
        p_device_id, p_sequence, p_recorded_at,
        p_acceleration_x_g, p_acceleration_y_g, p_acceleration_z_g,
        p_gyroscope_x_dps, p_gyroscope_y_dps, p_gyroscope_z_dps
    );

    update public.devices
    set last_seen_at = p_recorded_at
    where id = p_device_id;
end;
$$;

revoke all on function public.store_motion_reading(
    text, bigint, timestamptz, double precision, double precision, double precision,
    double precision, double precision, double precision
) from public, anon, authenticated;
grant execute on function public.store_motion_reading(
    text, bigint, timestamptz, double precision, double precision, double precision,
    double precision, double precision, double precision
) to service_role;

create or replace function private.is_doctor()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select exists (
        select 1 from public.profiles
        where id = (select auth.uid()) and role = 'doctor'
    );
$$;

create or replace function private.can_access_patient(target_patient_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select private.is_doctor() or exists (
        select 1 from public.profiles
        where id = (select auth.uid()) and patient_id = target_patient_id
    );
$$;

revoke all on function private.is_doctor() from public, anon;
revoke all on function private.can_access_patient(text) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_doctor() to authenticated;
grant execute on function private.can_access_patient(text) to authenticated;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    insert into public.profiles (id, name, role)
    values (
        new.id,
        coalesce(
            nullif(new.raw_user_meta_data ->> 'name', ''),
            split_part(new.email, '@', 1)
        ),
        'patient'
    );
    return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_auth_user();

alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.weekly_readings enable row level security;
alter table public.devices enable row level security;
alter table public.motion_readings enable row level security;
alter table public.public_reviews enable row level security;

create policy "Users can read their own profile; doctors can read all"
    on public.profiles for select to authenticated
    using (id = (select auth.uid()) or (select private.is_doctor()));

create policy "Doctors read all patients; patients read their linked record"
    on public.patients for select to authenticated
    using ((select private.can_access_patient(id)));

create policy "Doctors and owners read weekly readings"
    on public.weekly_readings for select to authenticated
    using ((select private.can_access_patient(patient_id)));

create policy "Doctors and owners read paired devices"
    on public.devices for select to authenticated
    using ((select private.can_access_patient(patient_id)));

create policy "Doctors and owners read motion readings"
    on public.motion_readings for select to authenticated
    using (
        exists (
            select 1 from public.devices d
            where d.id = device_id
              and (select private.can_access_patient(d.patient_id))
        )
    );

create policy "Anyone can read fictional demo reviews"
    on public.public_reviews for select to anon, authenticated
    using (data_source = 'demo');

grant select on public.profiles, public.patients, public.weekly_readings,
    public.motion_readings to authenticated;
grant select on public.public_reviews to anon, authenticated;
grant select (id, patient_id, created_at, last_seen_at)
    on public.devices to authenticated;

-- Fictional demo cohort used only by the prototype UI.
insert into public.patients
    (id, name, age, sex, injury, implant, surgery_date, weeks_since_surgery)
values
    ('P-1001', 'Omar Hassan', 34, 'Male', 'Tibial shaft fracture (right)', 'EH-Plate T4, tibia', current_date - 70, 10),
    ('P-1002', 'Layla Mahmoud', 28, 'Female', 'Distal radius fracture (left)', 'EH-Plate R2, radius', current_date - 42, 6),
    ('P-1003', 'Youssef Nabil', 52, 'Male', 'Femoral neck fracture (left)', 'EH-Plate F6, femur', current_date - 56, 8),
    ('P-1004', 'Nour El-Din', 41, 'Female', 'Clavicle fracture (right)', 'EH-Plate C1, clavicle', current_date - 84, 12),
    ('P-1005', 'Karim Adel', 19, 'Male', 'Humeral shaft fracture (right)', 'EH-Plate H3, humerus', current_date - 28, 4),
    ('P-1006', 'Mariam Fathy', 63, 'Female', 'Tibial plateau fracture (left)', 'EH-Plate T7, tibia', current_date - 63, 9);

insert into public.weekly_readings
    (patient_id, week, recorded_at, strain_load, bone_density, data_source)
values
    ('P-1001', 1, current_date - 63, 74, 182, 'demo'),
    ('P-1001', 2, current_date - 56, 70, 196, 'demo'),
    ('P-1001', 3, current_date - 49, 66, 212, 'demo'),
    ('P-1001', 4, current_date - 42, 61, 231, 'demo'),
    ('P-1001', 5, current_date - 35, 56, 252, 'demo'),
    ('P-1001', 6, current_date - 28, 50, 274, 'demo'),
    ('P-1001', 7, current_date - 21, 45, 296, 'demo'),
    ('P-1001', 8, current_date - 14, 41, 318, 'demo'),
    ('P-1001', 9, current_date - 7, 37, 338, 'demo'),
    ('P-1001', 10, current_date, 33, 357, 'demo'),
    ('P-1002', 1, current_date - 35, 78, 175, 'demo'),
    ('P-1002', 2, current_date - 28, 76, 183, 'demo'),
    ('P-1002', 3, current_date - 21, 73, 194, 'demo'),
    ('P-1002', 4, current_date - 14, 70, 205, 'demo'),
    ('P-1002', 5, current_date - 7, 67, 218, 'demo'),
    ('P-1002', 6, current_date, 64, 230, 'demo'),
    ('P-1003', 1, current_date - 49, 72, 190, 'demo'),
    ('P-1003', 2, current_date - 42, 68, 203, 'demo'),
    ('P-1003', 3, current_date - 35, 63, 219, 'demo'),
    ('P-1003', 4, current_date - 28, 59, 232, 'demo'),
    ('P-1003', 5, current_date - 21, 57, 238, 'demo'),
    ('P-1003', 6, current_date - 14, 66, 239, 'demo'),
    ('P-1003', 7, current_date - 7, 78, 236, 'demo'),
    ('P-1003', 8, current_date, 86, 233, 'demo'),
    ('P-1004', 1, current_date - 77, 70, 185, 'demo'),
    ('P-1004', 2, current_date - 70, 63, 205, 'demo'),
    ('P-1004', 3, current_date - 63, 56, 230, 'demo'),
    ('P-1004', 4, current_date - 56, 49, 258, 'demo'),
    ('P-1004', 5, current_date - 49, 43, 288, 'demo'),
    ('P-1004', 6, current_date - 42, 37, 318, 'demo'),
    ('P-1004', 7, current_date - 35, 32, 347, 'demo'),
    ('P-1004', 8, current_date - 28, 28, 374, 'demo'),
    ('P-1004', 9, current_date - 21, 24, 398, 'demo'),
    ('P-1004', 10, current_date - 14, 21, 419, 'demo'),
    ('P-1004', 11, current_date - 7, 19, 436, 'demo'),
    ('P-1004', 12, current_date, 17, 450, 'demo'),
    ('P-1005', 1, current_date - 21, 80, 170, 'demo'),
    ('P-1005', 2, current_date - 14, 79, 176, 'demo'),
    ('P-1005', 3, current_date - 7, 77, 183, 'demo'),
    ('P-1005', 4, current_date, 75, 190, 'demo'),
    ('P-1006', 1, current_date - 56, 76, 178, 'demo'),
    ('P-1006', 2, current_date - 49, 75, 184, 'demo'),
    ('P-1006', 3, current_date - 42, 74, 189, 'demo'),
    ('P-1006', 4, current_date - 35, 73, 194, 'demo'),
    ('P-1006', 5, current_date - 28, 72, 198, 'demo'),
    ('P-1006', 6, current_date - 21, 71, 201, 'demo'),
    ('P-1006', 7, current_date - 14, 70, 204, 'demo'),
    ('P-1006', 8, current_date - 7, 70, 206, 'demo'),
    ('P-1006', 9, current_date, 69, 208, 'demo');

insert into public.public_reviews (author, review_text, rating, data_source)
values
    ('Orthopedic surgeon, Cairo',
     'Seeing strain on the plate week by week changed how I decide when to allow weight bearing.',
     5, 'demo'),
    ('Physiotherapist, Alexandria',
     'Patients stay motivated when they can see their bone density rising on a chart.',
     5, 'demo'),
    ('Patient, Giza',
     'I always knew whether my recovery was on track without waiting for the next appointment.',
     4, 'demo');
