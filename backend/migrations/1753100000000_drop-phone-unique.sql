-- Phone numbers are no longer unique across accounts — only email is. A family
-- can register several students under one phone (the tester's request). The
-- partial unique index on users.phone (created in 1744210000000_phone-identifier)
-- is dropped. Phone-OTP login now only signs a user in when the number maps to
-- exactly ONE account; a shared number is told to use email (enforced in code,
-- POST /api/auth/phone/verify-otp). Idempotent.

DROP INDEX IF EXISTS idx_users_phone_unique;
