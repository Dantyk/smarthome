FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm i

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_MQTT_BROKER
ARG NEXT_PUBLIC_API_BASE
ARG NEXT_PUBLIC_TZ
ARG NEXT_PUBLIC_LOCATION
ENV NEXT_PUBLIC_MQTT_BROKER=$NEXT_PUBLIC_MQTT_BROKER
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE
ENV NEXT_PUBLIC_TZ=$NEXT_PUBLIC_TZ
ENV NEXT_PUBLIC_LOCATION=$NEXT_PUBLIC_LOCATION
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache curl
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
