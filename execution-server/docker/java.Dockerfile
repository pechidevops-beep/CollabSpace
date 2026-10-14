# Java sandbox image for CollabSpace execution engine
# Pinned to specific Eclipse Temurin JDK 17 release on Ubuntu Jammy (no :latest)
FROM eclipse-temurin:17.0.10_7-jdk-jammy

WORKDIR /app

# Create a non-root user for security
RUN groupadd -r sandbox && useradd -r -g sandbox -d /app -s /sbin/nologin sandbox

# Give sandbox user write access to /tmp only
RUN chmod 1777 /tmp

USER sandbox

CMD ["sh"]
