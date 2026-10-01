# syntax=docker/dockerfile:1

# ─── Frontend ───────────────────────────────────────────────────────────────────
# `dev` stage: dependencies baked into the image so the bind-mounted source tree
# in docker-compose can overlay /app without shadowing node_modules.
# `prod` stage: build the SPA and serve it with nginx.

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS dev
ENV NODE_ENV=development
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM deps AS build
ENV VITE_API_URL=""
RUN npm run build

FROM nginx:alpine AS prod
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
