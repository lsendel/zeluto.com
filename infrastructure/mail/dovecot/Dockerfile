FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    dovecot-core \
    dovecot-lmtpd \
    dovecot-imapd \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy Dovecot configuration
COPY config/dovecot.conf /etc/dovecot/dovecot.conf

# Create mail storage directories
RUN mkdir -p /var/mail/vhosts && \
    groupadd -g 5000 vmail && \
    useradd -g vmail -u 5000 vmail -d /var/mail && \
    chown -R vmail:vmail /var/mail

EXPOSE 143 993 24

CMD ["dovecot", "-F"]
