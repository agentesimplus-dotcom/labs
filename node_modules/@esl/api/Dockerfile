FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN npm ci
RUN npm run db:generate --workspace=@esl/shared

RUN npm run build --workspace=@esl/shared
RUN npm run build --workspace=@esl/api

EXPOSE 3000

CMD ["npm", "start", "--workspace=@esl/api"]
