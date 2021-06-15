docker-compose exec --user postgres postgresql psql -tA -d c2corg -P pager=off \
  -c "select o.document_id, o.activities, ST_AsText(g.geom_detail) from guidebook.outings o inner join guidebook.documents_geometries g on o.document_id = g.document_id  where date_end > '2018-01-01' and geom_detail is not null" > /tmp/gps.txt
