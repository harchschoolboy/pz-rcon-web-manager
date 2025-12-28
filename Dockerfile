# ================================
# Stage 1: Build Frontend
# ================================
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend

# Copy package files
COPY frontend/package*.json ./

# Install dependencies (npm install for flexibility without lock file)
RUN npm install

# Copy source
COPY frontend/ ./

# Build
RUN npm run build


# ================================
# Stage 2: Final Image (Python Alpine + Static)
# ================================
FROM python:3.11-alpine AS final

# Metadata
LABEL maintainer="german.ivan.86@gmail.com"
LABEL description="Project Zomboid Server Management"

WORKDIR /app

# Copy requirements first for caching
COPY backend/requirements.txt .

# Install deps in one layer, then cleanup
RUN apk add --no-cache --virtual .build-deps gcc musl-dev libffi-dev && \
    pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    apk del .build-deps && \
    rm -rf /root/.cache /tmp/*

# Copy backend code
COPY backend/app ./app

# Copy frontend build from stage 1
COPY --from=frontend-builder /frontend/dist ./static

# Create data directory for SQLite (will be mounted as volume)
RUN mkdir -p /data

# Environment
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DATABASE_URL=sqlite+aiosqlite:///data/pz_webadmin.db

# Expose port
EXPOSE 8000

# Health check (using wget instead of python for smaller footprint)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget -q --spider http://localhost:8000/api/health || exit 1

# Run
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
