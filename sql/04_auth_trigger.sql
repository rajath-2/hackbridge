-- ============================================================
-- HackBridge — SQL 04: Auth Trigger
-- Run AFTER 03_rls.sql
-- ============================================================
-- This trigger fires when a new user signs up via Supabase Auth.
-- It auto-inserts a row into public.users using metadata passed
-- at signup time: { name, role }
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, role, name, cli_token)
    VALUES (
        NEW.id,
        NEW.email,
        (NEW.raw_user_meta_data->>'role')::public.user_role,
        COALESCE(NEW.raw_user_meta_data->>'name', ''),
        'HB-' || upper(substr(md5(random()::text), 0, 10))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop if already exists (safe to re-run)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE PROCEDURE handle_new_user();
