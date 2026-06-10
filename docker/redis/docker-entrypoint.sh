#!/bin/sh
set -e

USERNAME="${REDIS_USERNAME:-kavoru}"
PASSWORD="${REDIS_PASSWORD:-kavoru}"
ACL_FILE="/data/users.acl"

mkdir -p /data
cat > "$ACL_FILE" <<EOF
user default off
user ${USERNAME} on >${PASSWORD} ~* &* +@all
EOF

exec redis-server --aclfile "$ACL_FILE"
