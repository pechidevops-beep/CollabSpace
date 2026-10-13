# Java sandbox image for CollabSpace execution engine
# eclipse-temurin is the official successor to openjdk Docker images
FROM eclipse-temurin:17-jdk-jammy

WORKDIR /app

# Create a non-root user for security
RUN groupadd -r sandbox && useradd -r -g sandbox -d /app -s /sbin/nologin sandbox

# Give sandbox user write access to /tmp only
RUN chmod 1777 /tmp

USER sandbox

CMD ["sh"]
