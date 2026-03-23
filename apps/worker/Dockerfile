FROM node:20-bullseye-slim

WORKDIR /app

# Install dependencies needed for node-canvas
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy root configurations and lockfile
COPY package.json package-lock.json ./

# Copy packages
COPY packages/shared ./packages/shared
COPY apps/worker ./apps/worker

# Install dependencies (workspaces will be linked)
RUN npm ci

# Install canvas explicitly for the worker since it's excluded from package.json for Windows devs
RUN npm install canvas --workspace=@esl/worker

# Generate Prisma client
RUN npm run db:generate --workspace=@esl/shared

# Build shared and worker
RUN npm run build --workspace=@esl/shared
RUN npm run build --workspace=@esl/worker

CMD ["npm", "start", "--workspace=@esl/worker"]
