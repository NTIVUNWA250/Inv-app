-- =============================================================================
-- 0015_add_product_image_column.sql
-- =============================================================================

ALTER TABLE public.corporate_transactions 
  ADD COLUMN IF NOT EXISTS product_image_base64 TEXT;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'test') THEN
    ALTER TABLE test.corporate_transactions 
      ADD COLUMN IF NOT EXISTS product_image_base64 TEXT;
  END IF;
END
$do$;
