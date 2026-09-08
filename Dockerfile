FROM crpi-qp8hiqijfnilf93t.cn-hangzhou.personal.cr.aliyuncs.com/bulexu/node:20.19.5-alpine AS base
WORKDIR /usr/src
RUN corepack enable
RUN sed -i 's#https\?://dl-cdn.alpinelinux.org/alpine#https://mirrors.aliyun.com/alpine#g' /etc/apk/repositories \
	&& apk add --no-cache python3 make g++
RUN corepack prepare pnpm@10.30.3 --activate
RUN pnpm config set registry https://registry.npmmirror.com

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install

FROM base AS builder
COPY --from=deps /usr/src/node_modules ./node_modules
COPY . .
RUN pnpm run build

FROM crpi-qp8hiqijfnilf93t.cn-hangzhou.personal.cr.aliyuncs.com/bulexu/node:20.19.5-alpine
WORKDIR /usr/app
RUN apk add --no-cache curl
COPY --from=builder /usr/src/dist/output ./output
ENV HOST=0.0.0.0 PORT=4444 NODE_ENV=production
EXPOSE $PORT
CMD ["node", "output/server/index.mjs"]
