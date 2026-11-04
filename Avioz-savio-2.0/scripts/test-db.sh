#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
savio_db_name="savio-test-db-$$"
savio_docker() { env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker --host=unix:///var/run/docker.sock "$@"; }
trap 'savio_docker stop "$savio_db_name" >/dev/null 2>&1 || true' EXIT
savio_docker run --rm --detach --name "$savio_db_name" --env POSTGRES_HOST_AUTH_METHOD=trust postgres:17-alpine >/dev/null
for savio_attempt in {1..30}; do
 if savio_docker exec "$savio_db_name" pg_isready -U postgres >/dev/null 2>&1; then break; fi
 sleep 1
done
savio_docker exec "$savio_db_name" pg_isready -U postgres
cat tests/db-bootstrap.sql supabase/legacy-schema.sql supabase/schema.sql supabase/schema.sql tests/database.sql | savio_docker exec -i "$savio_db_name" psql -X -U postgres -v ON_ERROR_STOP=1
