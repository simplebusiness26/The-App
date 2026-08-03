-- ============================================================================
-- LEGACY / HISTORICAL ONLY — DO NOT RUN THIS FILE.
--
-- This is the original bootstrap sketch from early in the project. It is NOT
-- the live schema and does not match the database the app actually runs on:
--
--   * `users` and `locations` are referenced by zero migrations and zero app
--     queries — they do not exist in the live database.
--   * `businesses`, `properties` and `reviews` really do exist, but with far
--     more columns, plus foreign keys, indexes and RLS policies that are all
--     missing here. The app selects columns this file does not define.
--   * Nothing here has row-level security, so running it would create tables
--     that are readable by anyone.
--
-- The authoritative schema is `supabase/migrations/`, applied in filename
-- order. Kept in the repo only because it documents the original data model.
-- ============================================================================

CREATE TABLE users (
id uuid PRIMARY KEY,
name text,
email text,
photo text,
created_at timestamp default now()
);


CREATE TABLE locations (
id uuid PRIMARY KEY,
town text,
county text,
latitude float,
longitude float
);


CREATE TABLE businesses (
id uuid PRIMARY KEY,
location_id uuid,
name text,
category text,
description text,
address text,
website text,
latitude float,
longitude float
);


CREATE TABLE properties (
id uuid PRIMARY KEY,
location_id uuid,
name text,
host text,
booking_url text,
description text,
latitude float,
longitude float,
qr_code text
);


CREATE TABLE reviews (
id uuid PRIMARY KEY,
user_id uuid,
business_id uuid,
property_id uuid,
rating integer,
comment text,
created_at timestamp default now()
);