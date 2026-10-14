# Python sandbox image for CollabSpace execution engine
# Pinned to specific Python 3.11 release on Debian Bookworm slim (no :latest)
FROM python:3.11.8-slim-bookworm

WORKDIR /app

# Create a non-root user for security
RUN groupadd -r sandbox && useradd -r -g sandbox -d /app -s /sbin/nologin sandbox

# Give sandbox user write access to /tmp only
RUN chmod 1777 /tmp

USER sandbox

CMD ["sh"]
