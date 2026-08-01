-- Make every existing About-page partner block use the configurable carousel.
-- Other pages keep their explicitly selected partner presentation.

UPDATE page_blocks
SET settings = json_set(
  json_insert(
    CASE WHEN json_valid(settings) THEN settings ELSE '{}' END,
    '$.autoPlay', json('true'),
    '$.speed', 'slow',
    '$.direction', 'left',
    '$.pauseOnHover', json('true')
  ),
  '$.variant', 'carousel'
)
WHERE component_type = 'association.partners'
  AND page_version_id IN (
    SELECT page_versions.id
    FROM page_versions
    JOIN page_nodes ON page_nodes.id = page_versions.page_id
    WHERE page_nodes.path = '/about'
  );
