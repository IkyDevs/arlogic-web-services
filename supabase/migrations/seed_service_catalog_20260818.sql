-- Seed katalog jasa dari service_items existing.
-- Katalog = baris service_items dengan service_order_id IS NULL + item_type = 'jasa'.
-- Idempotent: skip nama+harga yang sudah ada di katalog.
INSERT INTO service_items (service_order_id, item_type, name, quantity, price, is_final, branch_id, inventory_id)
SELECT NULL, 'jasa', name, 1, price, true, NULL, NULL
FROM (
  SELECT DISTINCT ON (lower(btrim(name)), price) name, price
  FROM service_items
  WHERE item_type = 'jasa'
    AND service_order_id IS NOT NULL
  ORDER BY lower(btrim(name)), price, created_at
) src
WHERE NOT EXISTS (
  SELECT 1 FROM service_items c
  WHERE c.service_order_id IS NULL
    AND c.item_type = 'jasa'
    AND lower(btrim(c.name)) = lower(btrim(src.name))
    AND c.price = src.price
);
