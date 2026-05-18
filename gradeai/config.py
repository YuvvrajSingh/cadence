import os

# Ollama settings
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
VISION_MODEL = os.getenv("VISION_MODEL", "minicpm-v:latest")
GRADING_MODEL = os.getenv("GRADING_MODEL", "mistral:latest")