-- =============================================================================
-- 0015_add_product_image_column.sql
-- =============================================================================
-- Alters corporate_transactions table to add product_image_base64 column.
-- =============================================================================

alter table public.corporate_transactions add column if not exists product_image_base64 text;

do $do$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'test') then
    alter table test.corporate_transactions add column if not exists product_image_base64 text;
  end if;
end
$do$;
