#!/bin/bash

# Generate encryption key
echo "Generating encryption key..."
ENCRYPTION_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")

# Create .env file
cat > .env << EOF
# Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
ENCRYPTION_KEY=${ENCRYPTION_KEY}

DATABASE_URL=sqlite+aiosqlite:///./data/pz_webadmin.db

API_HOST=0.0.0.0
API_PORT=8000

RCON_TIMEOUT=10
RCON_RECONNECT_DELAY=5
EOF

echo "✅ .env file created with encryption key"
echo ""
echo "Next steps:"
echo "1. Review .env file"
echo "2. Run: docker-compose up -d"
echo "3. Access API at http://localhost:8000"
