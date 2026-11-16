# Deploying Secret Santa

Run exactly one continuously running Node.js 24 process. It serves both server-rendered pages and Socket.IO traffic. No database, Redis, persistent volume, worker cluster, or separate frontend service is required.

Every restart, deployment, crash, or container replacement loses all active groups. There is no recovery or rolling handover of in-memory groups. Schedule updates between exchanges where possible.

## Native Node.js

Install dependencies with npm ci, build with npm run build, then start node dist/main.js. Set NODE_ENV=production and PUBLIC_ORIGIN=https://your-domain.example before starting. Production origin must be HTTPS and must match the browser's actual origin exactly.

The server listens on HOST=127.0.0.1 and PORT=3000 by default. Keep the backend private behind the TLS reverse proxy. A container sets HOST=0.0.0.0 internally.

To load a local environment file explicitly, copy [.env.example](../.env.example) to .env, edit it, and run:

```sh
node --env-file=.env dist/main.js
```

The application does not automatically load .env. That file contains deployment configuration only; never put group data in it.

## Container

```sh
docker build -t secret-santa:local .
docker run --rm --name secret-santa -p 127.0.0.1:3000:3000 -e PUBLIC_ORIGIN=https://santa.example.com -e TRUST_PROXY_HOPS=1 secret-santa:local
```

This command assumes a host reverse proxy terminates HTTPS. Replace the origin with your real domain and configure TLS before inviting participants. Secure production cookies will not support a normal exchange over plain HTTP. The unauthenticated health endpoint can still be checked internally.

The image runs as the non-root node user and ships only production dependencies and the compiled application. Do not mount a persistent volume for groups.

Container build/runtime verification remains pending on machines without a running Docker daemon; the native production build and startup are tested separately.

## HTTPS and real-time proxying

Serve pages and sockets from the same origin. Forward WebSocket upgrades and HTTP polling. Keep proxy idle timeouts above the transport heartbeat window; this example uses 75 seconds. The [Socket.IO proxy guide](https://socket.io/docs/v4/reverse-proxy/) documents the upgrade headers and timeout requirement.

Example nginx configuration (supply your own domain and TLS certificate paths):

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}
server {
    listen 443 ssl;
    server_name santa.example.com;
    ssl_certificate /etc/letsencrypt/live/santa.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/santa.example.com/privkey.pem;
    access_log off;
    error_log /dev/null crit;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 75s;
        proxy_buffering off;
    }
}
```

Use TRUST_PROXY_HOPS=1 only when this single trusted proxy is the exclusive path to the backend. It overwrites forwarded client headers instead of preserving attacker-supplied values. Keep the application port private. Other topologies must set the correct trusted-hop count; accepted values are 0–3.

Do not cache personal pages or group mutations. Keep access logs disabled: invitation codes occur in request URLs, and names and CSRF values occur in forms. This example discards proxy error logs too, because raw error entries can contain URLs. Monitor sanitized status counts and health checks instead. Do not enable Socket.IO debug logs or export browser traces containing real exchanges.

## Configuration and limits

| Variable | Default | Meaning |
| --- | --- | --- |
| NODE_ENV | development | Use production in deployed environments. |
| PUBLIC_ORIGIN | http://127.0.0.1:3000 | Explicit HTTPS origin required in production. |
| HOST | 127.0.0.1 | Bind address; image uses 0.0.0.0. |
| PORT | 3000 | Listening port. |
| TRUST_PROXY_HOPS | 0 | Number of trusted proxy hops, 0–3. |
| MAX_GROUPS | 1000 | Concurrent groups. |
| MAX_SESSIONS | 10000 | Temporary browser sessions. |
| MAX_SOCKETS | 10000 | Concurrent transport connections. |
| MAX_SOCKETS_PER_SESSION | 5 | Concurrent tabs/connections per browser session. |
| MAX_MEMBERSHIPS_PER_SESSION | 10 | Active groups retained per browser session. |
| MAX_RATE_KEYS | 20000 | Distinct active keys per HTTP rate-limit store. |
| MAX_BODY_BYTES | 65536 | Maximum URL-encoded request body. |
| MAX_SOCKET_BYTES | 4096 | Maximum incoming Socket.IO message. |

Creation is limited to 10 requests per IP per 10 minutes; mutations to 120 per IP per minute; socket subscription attempts to 30 per connection per minute. These are application defaults, not a tested throughput guarantee. A group contains 2–50 unique names, each at most 80 Unicode code points. The roster is fixed at creation.

The one-hour lifetime is fixed and cannot be configured or extended. Access checks enforce the creation deadline, and a cleanup timer removes each idle group even if the server wall clock moves backwards.

## Operation

- GET /healthz returns {"status":"ok"} without allocating a browser session or revealing group data.
- Monitor memory, active connections, sanitized response counts, and process restarts. Capacity rejections return HTTP 429 or a safe socket error.
- SIGINT/SIGTERM close live transports, timers, HTTP listeners, and in-memory stores. Allow normal shutdown before force-killing the process.
- Browser refresh/reconnect restores an identity and its final result in the same browser before expiry. Clearing cookies or changing devices prevents recovery after drawing.
- Names are self-selected, not verified identities. Share invitation links among people who trust one another. A creator cannot inspect other people's recipients through the application, but the server operator can inspect process memory.
- Presence uses observed connections and heartbeats. A sudden device/network failure may take time to appear offline.
- The application cannot erase a recipient someone already remembered, copied, or photographed.

