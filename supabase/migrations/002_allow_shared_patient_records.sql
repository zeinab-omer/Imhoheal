-- Allow multiple separate patient login accounts to share one patient record.
-- No patient or reading data is copied by this change.
alter table public.profiles
    drop constraint if exists profiles_patient_id_key;
