FROM oven/bun AS build

WORKDIR /app
ADD ../html ./html

WORKDIR /app/buntimer
ADD package.json .
ADD bun.lockb .
ADD tsconfig.json .
ADD src ./src


RUN bun install
RUN bun run build

FROM debian:bookworm-slim
COPY --from=build /app/buntimer/bundle /
ADD public /public

ENTRYPOINT ["/bundle"]
CMD ["/bin/sh"]