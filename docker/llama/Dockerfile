FROM ollama/ollama:latest

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh && \
    chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 11434

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
