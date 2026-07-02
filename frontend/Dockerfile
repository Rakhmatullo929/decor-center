FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 600000

COPY . .

ENV PORT=3000

EXPOSE 3000

CMD ["yarn", "start"]
