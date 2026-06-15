#!/bin/sh
set -e

MODEL="${OLLAMA_MODEL:-llama3.2}"

ollama serve &
OLLAMA_PID=$!

until ollama list >/dev/null 2>&1; do
  sleep 1
done

if ! ollama show "$MODEL" >/dev/null 2>&1; then
  echo "Pulling Ollama model: $MODEL (first start may take a few minutes)"
  ollama pull "$MODEL"
fi

wait $OLLAMA_PID
