import requests
import json
import ast
import re
import time
from sentence_transformers import SentenceTransformer, util
from config import OLLAMA_BASE_URL, GRADING_MODEL

# ✅ all-mpnet-base-v2 — better semantic understanding
# Force to CPU to save GPU VRAM for the big Ollama models.
# Embedding calculation is fast enough on CPU.
embedder = SentenceTransformer("all-mpnet-base-v2", device="cpu")

ENABLE_CLEANING = False


def _grade_from_percentage(percentage):
    if percentage >= 85:
        return "A"
    if percentage >= 70:
        return "B"
    if percentage >= 55:
        return "C"
    if percentage >= 40:
        return "D"
    return "F"


def _extract_json_object(raw_text):
    text = (raw_text or "").replace("```json", "").replace("```", "").strip()
    start = text.find("{")
    if start == -1:
        return None

    in_string = False
    escape = False
    depth = 0

    for i in range(start, len(text)):
        ch = text[i]

        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
            continue

        if ch == '"':
            in_string = True
            continue

        if ch == "{":
            depth += 1
            continue

        if ch == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]

    if depth > 0:
        # Recover from truncated output by appending missing closing braces.
        return text[start:] + ("}" * depth)

    return None


def _try_parse_grade_payload(raw_text):
    obj_text = _extract_json_object(raw_text)

    if obj_text:
        try:
            parsed = json.loads(obj_text)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            try:
                parsed = ast.literal_eval(obj_text)
                if isinstance(parsed, dict):
                    return parsed
            except Exception:
                pass

    marks_match = re.search(r'"?marks_awarded"?\s*:\s*(-?\d+(?:\.\d+)?)', raw_text or "", flags=re.IGNORECASE)
    grade_match = re.search(r'"?grade"?\s*:\s*"?([A-F])"?', raw_text or "", flags=re.IGNORECASE)
    feedback_match = re.search(r'"?feedback"?\s*:\s*"([^\"]*)"', raw_text or "", flags=re.IGNORECASE)

    if marks_match or grade_match or feedback_match:
        return {
            "marks_awarded": float(marks_match.group(1)) if marks_match else None,
            "grade": grade_match.group(1).upper() if grade_match else None,
            "feedback": feedback_match.group(1).strip() if feedback_match else None,
        }

    return None

def clean_ocr_text(raw_text, skip=not ENABLE_CLEANING):
    if skip:
        return raw_text

    prompt = "The following text was extracted from a handwritten exam answer sheet using OCR. It may contain spelling mistakes, garbled words, or OCR errors.\n\nPlease fix ONLY the OCR errors and spelling mistakes. Do NOT add any new information or change the meaning.\nReturn ONLY the corrected text, nothing else.\n\nRaw OCR text:\n" + raw_text

    response = requests.post(
        OLLAMA_BASE_URL + "/api/generate",
        json={"model": GRADING_MODEL, "prompt": prompt, "stream": False}
    )
    if response.status_code != 200:
        return raw_text
    return response.json()["response"].strip()

def get_similarity_score(student_answer, model_answer):
    s_emb = embedder.encode(student_answer, convert_to_tensor=True)
    m_emb = embedder.encode(model_answer, convert_to_tensor=True)
    score = util.cos_sim(s_emb, m_emb).item()
    return round(score * 100, 2)


def get_ai_grade(student_answer, model_answer, total_marks=10):
    # 1. Calculate Semantic Similarity first (Crucial for the AI context)
    similarity = get_similarity_score(student_answer, model_answer)
    print(f"📊 Semantic Similarity: {similarity}%")

    prompt = (
        "You are a fair university examiner. Your task is to grade the student's answer against the provided reference answer.\n\n"
        "Reference Answer (Teacher's Answer):\n" + model_answer + "\n\n"
        "Student's Answer:\n" + student_answer + "\n\n"
        "Total marks for this question: " + str(total_marks) + "\n"
        "Semantic similarity score: " + str(similarity) + "%\n\n"
        "GRADING RULES:\n"
        "1. TOPIC CHECK: The topic of the student's answer must be the SAME as the reference answer. If the student is discussing a completely different topic, award 0 marks immediately.\n"
        "2. CONCEPT MATCH: The student's answer must convey the same core concepts, facts, and meaning as the reference answer.\n"
        "3. WORDING & FORMAT VARIATION: Do NOT penalize for different wording, phrasing, or structure. Students may answer in paragraphs, bullet points, or tables (especially for 'differentiate' questions). Accept any format as long as the points match the reference.\n"
        "4. STRICTNESS: Only award marks if the student demonstrates they understand the specific concepts mentioned in the reference answer. If the answer is irrelevant or conceptually wrong, award 0 marks.\n"
        "5. SCORING: Award marks proportional to how many key points/concepts from the reference answer are correctly addressed by the student.\n\n"
        "Respond ONLY in this exact JSON format, no extra text:\n"
        "{\n"
        "    \"marks_awarded\": <number>,\n"
        "    \"grade\": \"<A/B/C/D/F>\",\n"
        "    \"feedback\": \"<2-3 lines explaining the conceptual match or why marks were withheld due to topic/concept/format mismatch>\"\n"
        "}"
    )

    max_retries = 3
    last_exc = None
    for attempt in range(1, max_retries + 1):
        try:
            response = requests.post(
                OLLAMA_BASE_URL + "/api/generate",
                json={
                    "model": GRADING_MODEL, 
                    "prompt": prompt, 
                    "stream": False,
                    "keep_alive": 0,  # Unload model immediately after use
                    "options": {
                        "num_gpu": 1   # Explicitly use GPU
                    }
                },
                timeout=300
            )

            if response.status_code == 500:
                err_text = ""
                try:
                    err_text = response.json().get("error", response.text)
                except Exception:
                    err_text = response.text
                last_exc = Exception(f"Ollama error 500: {err_text}")
                wait = 20 * attempt  # 20s, 40s, 60s
                print(f"⚠️  Grader attempt {attempt}/{max_retries} failed (Ollama 500). Waiting {wait}s...", flush=True)
                time.sleep(wait)
                continue

            if response.status_code != 200:
                error_data = response.json() if response.text else {"error": "Empty response"}
                raise Exception(f"Ollama error {response.status_code}: {error_data.get('error', 'Unknown error')}")

            raw = response.json().get("response", "")
            result = _try_parse_grade_payload(raw)
            if not isinstance(result, dict):
                print(f"❌ AI Output was not JSON: {(raw or '').strip()}")
                return {
                    "marks_awarded": 0.0,
                    "grade": "F",
                    "feedback": "AI output parsing fallback applied due to malformed response.",
                    "similarity_score": similarity,
                }

            marks_awarded = float(result.get("marks_awarded") or 0)
            marks_awarded = max(0.0, min(marks_awarded, float(total_marks)))
            pct = (marks_awarded / float(total_marks) * 100.0) if float(total_marks) > 0 else 0.0

            result["marks_awarded"] = marks_awarded
            result["grade"] = str(result.get("grade") or _grade_from_percentage(pct)).upper()
            result["feedback"] = str(result.get("feedback") or "Concept-level evaluation completed.")
            result["similarity_score"] = similarity
            return result

        except requests.exceptions.Timeout:
            last_exc = Exception("Grader timed out")
            print(f"⚠️  Grader attempt {attempt}/{max_retries} timed out. Retrying...", flush=True)
            time.sleep(15 * attempt)
        except requests.exceptions.ConnectionError as conn_err:
            last_exc = conn_err
            print(f"⚠️  Grader attempt {attempt}/{max_retries} connection error. Retrying...", flush=True)
            time.sleep(15 * attempt)
        except Exception as e:
            # Non-retryable error (e.g. auth, bad request)
            print(f"❌ AI Engine Error: {e}")
            raise e

    print(f"❌ AI Engine Error after {max_retries} attempts: {last_exc}")
    raise Exception(f"Grading failed after {max_retries} attempts: {last_exc}")