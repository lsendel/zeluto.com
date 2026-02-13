FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    apt-get install -y lsb-release wget gnupg ca-certificates && \
    wget -qO- https://rspamd.com/apt-stable/gpg.key | apt-key add - && \
    echo "deb http://rspamd.com/apt-stable/ $(lsb_release -cs) main" > /etc/apt/sources.list.d/rspamd.list && \
    apt-get update && \
    apt-get install -y rspamd redis-tools && \
    rm -rf /var/lib/apt/lists/*

# Copy local configuration overrides
COPY config/worker-normal.inc /etc/rspamd/local.d/worker-normal.inc
COPY config/milter_headers.conf /etc/rspamd/local.d/milter_headers.conf

EXPOSE 11333 11334

CMD ["rspamd", "-f", "-u", "_rspamd", "-g", "_rspamd"]
