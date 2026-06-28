# VPS setup — `165.22.109.245` (staging)

DigitalOcean droplet · **1 vCPU / 512 MB RAM / 10 GB disk**. RAM-tiny — treat as **staging for a
handful of users**, not production (docs/ARCHITECTURE.md §11).

Hard rules:

- **Never build on the box.** The dashboard build will exhaust RAM and hang it. Build locally / in
  CI and ship **prebuilt artifacts** only (see [deploy.sh](deploy.sh)).
- **No DB server.** Use server-side SQLite (already the design). No Mongo/Postgres.
- **Cloudflare in front** (free tier): hides the IP, caching, basic DDoS protection.

## 1. Create swap (mandatory — prevents OOM)

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h   # verify 2.0Gi swap
```

## 2. Install runtime + nginx

```bash
# Node 20 LTS (runtime only — we never build here)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs nginx

# pm2 to keep the gateway alive + restart on reboot
sudo npm i -g pm2
```

## 3. App layout on the box

```
/opt/memoris/
  server/        # prebuilt: dist/ + node_modules (prod) + prisma/ + .env
  dashboard/     # prebuilt static files (served by nginx)
```

```bash
sudo mkdir -p /opt/memoris/server /opt/memoris/dashboard
sudo chown -R "$USER" /opt/memoris
```

## 4. nginx

Copy [nginx.conf](nginx.conf) to `/etc/nginx/sites-available/memoris`, then:

```bash
sudo ln -sf /etc/nginx/sites-available/memoris /etc/nginx/sites-enabled/memoris
sudo nginx -t && sudo systemctl reload nginx
```

## 5. First gateway boot

```bash
cd /opt/memoris/server
cp .env.example .env   # then edit secrets
npx prisma migrate deploy
pm2 start "node --env-file=.env dist/index.js" --name memoris-server
pm2 save && pm2 startup   # run the printed command to enable on boot
```

## 6. Cloudflare

- Add the domain, set an **A record** → `165.22.109.245` (proxied / orange cloud).
- SSL/TLS mode **Full**. Origin: nginx on :80 (or :443 with an origin cert).
- Verify: `curl https://<your-domain>/health` → `{"status":"ok",...}` (the Phase 0 exit criterion).

## Deploying updates

From your laptop / CI (never on the box):

```bash
./deploy/deploy.sh
```
