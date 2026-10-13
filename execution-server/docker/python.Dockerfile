# Python sandbox image for CollabSpace execution engine
FROM python:3.11-slim

WORKDIR /app

# Create a non-root user for security
RUN groupadd -r sandbox && useradd -r -g sandbox -d /app -s /sbin/nologin sandbox

# Give sandbox user write access to /tmp only
RUN chmod 1777 /tmp

USER sandbox

CMD ["sh"]
