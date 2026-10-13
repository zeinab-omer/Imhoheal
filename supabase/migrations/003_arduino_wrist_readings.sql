-- Store wrist-angle alarm samples collected by the Arduino serial logger.
create table public.wrist_readings (
    id bigint generated always as identity primary key,
    device_id text not null references public.devices(id) on delete cascade,
    sequence bigint not null check (sequence > 0),
    recorded_at timestamptz not null,
    angle_change double precision not null check (angle_change between -180 and 180),
    alarm boolean not null,
    created_at timestamptz not null default now(),
    unique (device_id, sequence)
);

create index wrist_readings_device_time_idx
    on public.wrist_readings (device_id, recorded_at desc);

create or replace function public.store_wrist_readings(
    p_device_id text,
    p_readings jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    reading jsonb;
begin
    if coalesce(jsonb_typeof(p_readings) <> 'array', true)
       or jsonb_array_length(p_readings) < 1
       or jsonb_array_length(p_readings) > 100 then
        raise exception 'A batch must contain between 1 and 100 readings.'
            using errcode = '22023';
    end if;

    for reading in select value from jsonb_array_elements(p_readings)
    loop
        insert into public.wrist_readings (
            device_id, sequence, recorded_at, angle_change, alarm
        )
        values (
            p_device_id,
            (reading ->> 'sequence')::bigint,
            (reading ->> 'recorded_at')::timestamptz,
            (reading ->> 'angle_change')::double precision,
            (reading ->> 'alarm')::boolean
        )
        on conflict (device_id, sequence) do nothing;
    end loop;

    update public.devices
    set last_seen_at = (
        select max((value ->> 'recorded_at')::timestamptz)
        from jsonb_array_elements(p_readings) as item(value)
    )
    where id = p_device_id;
end;
$$;

revoke all on function public.store_wrist_readings(text, jsonb)
    from public, anon, authenticated;
grant execute on function public.store_wrist_readings(text, jsonb)
    to service_role;

alter table public.wrist_readings enable row level security;

create policy "Doctors and owners read Arduino wrist readings"
    on public.wrist_readings for select to authenticated
    using (
        exists (
            select 1 from public.devices d
            where d.id = device_id
              and (select private.can_access_patient(d.patient_id))
        )
    );

grant select on public.wrist_readings to authenticated;
