# --- Frontend build ---
FROM node:20-bookworm-slim AS frontend-build
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
ENV NEXT_PUBLIC_API_BASE=
RUN npm run build

# --- Runtime (API + Web + Nginx) ---
FROM python:3.12-slim-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends nginx \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

COPY backend/app ./app
COPY --from=frontend-build /src/frontend/.next/standalone ./
COPY --from=frontend-build /src/frontend/.next/static ./.next/static
COPY --from=frontend-build /src/frontend/public ./public

COPY deploy/nginx.conf /etc/nginx/nginx.conf.template
COPY deploy/start.sh /start.sh
RUN chmod +x /start.sh

ENV STORAGE_DIR=/var/data
ENV PYTHONPATH=/app
ENV NODE_ENV=production

EXPOSE 10000
CMD ["/start.sh"]
