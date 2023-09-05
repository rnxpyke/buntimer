FROM oven/bun AS build

WORKDIR /app
ADD html ./html
WORKDIR /app/html
RUN bun install

WORKDIR /app/buntimer
ADD buntimer/package.json .
ADD buntimer/bun.lockb .
ADD buntimer/tsconfig.json .
ADD buntimer/src ./src


RUN bun install
RUN bun run build

FROM debian:bookworm-slim
COPY --from=build /app/buntimer/bundle /
ADD buntimer/public /public

ENTRYPOINT ["/bundle"]
CMD ["/bin/sh"]