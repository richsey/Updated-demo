-- Table to temporarily hold unverified signups
CREATE TABLE IF NOT EXISTS email_verifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL, -- Storing plain password or hashed if backend hashes it. Since this is temporary, we'll store it as provided, then create user in Supabase with it.
  verification_code TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '15 minutes')
);

-- Index for quick lookup by email and code
CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON email_verifications(email);
