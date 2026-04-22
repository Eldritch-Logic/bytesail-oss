FROM moby/buildkit:latest AS buildkit

FROM ghcr.io/railwayapp/railpack-mise:latest
RUN mise use -g github:railwayapp/railpack@latest
ENV PATH="/root/.local/share/mise/shims:${PATH}"

COPY --from=buildkit /usr/bin/buildkitd /usr/local/bin/buildkitd
COPY --from=buildkit /usr/bin/buildctl /usr/local/bin/buildctl
COPY --from=buildkit /usr/bin/buildkit-runc /usr/local/bin/runc
