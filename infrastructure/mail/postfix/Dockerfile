FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    postfix \
    postfix-policyd-spf-python \
    opendkim \
    opendkim-tools \
    ca-certificates \
    libsasl2-modules \
    sasl2-bin \
    && rm -rf /var/lib/apt/lists/*

# Copy Postfix configuration
COPY config/main.cf /etc/postfix/main.cf
COPY config/master.cf /etc/postfix/master.cf

# Create required directories
RUN mkdir -p /etc/opendkim/keys && \
    chown -R opendkim:opendkim /etc/opendkim && \
    mkdir -p /var/spool/postfix/opendkim && \
    chown opendkim:postfix /var/spool/postfix/opendkim

# Generate DKIM key pair if not mounted
RUN echo "#!/bin/bash\n\
set -e\n\
\n\
# Substitute environment variables into Postfix config\n\
if [ -n \"\$HOSTNAME\" ]; then\n\
  postconf -e \"myhostname=\$HOSTNAME\"\n\
fi\n\
if [ -n \"\$DOMAIN\" ]; then\n\
  postconf -e \"mydomain=\$DOMAIN\"\n\
  postconf -e \"myorigin=\$DOMAIN\"\n\
fi\n\
\n\
# Generate DKIM keys if not present\n\
if [ ! -f /etc/opendkim/keys/\${DOMAIN:-default}/mail.private ]; then\n\
  mkdir -p /etc/opendkim/keys/\${DOMAIN:-default}\n\
  opendkim-genkey -b 2048 -d \${DOMAIN:-localhost} -D /etc/opendkim/keys/\${DOMAIN:-default} -s mail -v\n\
  chown -R opendkim:opendkim /etc/opendkim/keys\n\
fi\n\
\n\
# Start OpenDKIM\n\
opendkim -x /etc/opendkim.conf\n\
\n\
# Start Postfix in foreground\n\
exec postfix start-fg\n\
" > /entrypoint.sh && chmod +x /entrypoint.sh

EXPOSE 25 587

ENTRYPOINT ["/entrypoint.sh"]
