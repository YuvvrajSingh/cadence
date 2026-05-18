# Cadence: GradeAI Microservice

<div align="center">

![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi&logoColor=white)
![Uvicorn](https://img.shields.io/badge/Uvicorn-499848?style=for-the-badge&logo=uvicorn&logoColor=white)
![Ollama](https://img.shields.io/badge/Ollama-000000?style=for-the-badge&logo=ollama&logoColor=white)

</div>

**GradeAI** is the machine learning engine of the Cadence ecosystem. Built on **FastAPI**, it handles digitizing student handwriting using OCR models and assessing answers via local Large Language Models (LLMs).

---

## 🛠️ Model Engine Setup

GradeAI relies on local LLMs orchestrated via **Ollama**. For optimal speed, run Ollama on your host machine to leverage hardware GPU acceleration.

1.  Verify Ollama is installed and running on your system.
2.  Pull the required models:
    ```bash
    # Pull MiniCPM-V (excellent vision & OCR performance under 2GB VRAM)
    ollama pull minicpm-v:latest

    # Pull Mistral (fast, high-precision logic model under 2GB VRAM)
    ollama pull mistral:latest
    ```

---

## 🚀 Setup & Local Installation

### Prerequisites
- Python 3.10+
- Pip package manager

### Installation Steps
1.  Navigate to the directory:
    ```bash
    cd gradeai
    ```
2.  Create and activate a virtual environment:
    ```bash
    python -m venv .venv
    # Windows
    .venv\Scripts\activate
    # macOS/Linux
    source .venv/bin/activate
    ```
3.  Install dependency packages:
    ```bash
    pip install -r requirements.txt
    ```
4.  Configure env variables in a `.env` file (see `.env.example`):
    ```ini
    OLLAMA_BASE_URL=http://localhost:11434
    VISION_MODEL=minicpm-v:latest
    GRADING_MODEL=mistral:latest
    ```
5.  Start the FastAPI development server:
    ```bash
    uvicorn api:app --reload --port 8000
    ```

---

## 🧩 Active API Routes

The microservice exposes standard endpoints consumed by the Express backend API proxy:

| Route | Method | Access | Action |
| :--- | :--- | :--- | :--- |
| `/healthz` | GET | Public | Returns service status and verifies connectivity to local Ollama. |
| `/options` | GET | Public | Lists active vision and reasoning models config. |
| `/api/student/upload` | POST | Student/Faculty | Stream-uploads exam paper files, performs OCR digitization, and saves raw answer structures. |
| `/api/teacher/add-question` | POST | Faculty | Appends master keys, questions, and mark-schemes for exam verification. |
| `/api/teacher/process-pending` | POST | Faculty | Triggers local grading pipelines matching student papers against criteria keys. |
