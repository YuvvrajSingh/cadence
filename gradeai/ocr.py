import requests
import base64
import io
import re
import time
from config import OLLAMA_BASE_URL, VISION_MODEL


PRIMARY_PROMPT = """You are reading a handwritten exam answer sheet image.
Extract only what is visibly written in the image.
Include diagram descriptions only if an actual diagram is visible.
Do not invent content, do not output coordinate arrays, and do not use canned/template examples.
If text is unreadable, return exactly: UNREADABLE
Return only the extracted answer text and diagram description."""

RETRY_PROMPT = """Read this exam answer sheet image again.
Return a plain transcription of visible handwritten text.
If there is a diagram, describe only labels and arrows that are clearly visible.
Never return bounding boxes, numbers-only arrays, or generic examples.
If unreadable, return exactly: UNREADABLE"""


def _looks_like_placeholder(text: str) -> bool:
    t = (text or "").strip().strip("'\"")
    if not t:
        return True

    # Pattern like: [0.17, 0.0, 0.83, 0.11]
    if re.fullmatch(r"\[\s*-?\d+(?:\.\d+)?(?:\s*,\s*-?\d+(?:\.\d+)?){2,}\s*\]", t):
        return True

    low = t.lower()
    if low == "unreadable":
        return True

    # Common prompt-leak template from earlier prompt examples.
    if "diagram: box labeled input" in low and "hidden layer" in low and "output" in low:
        return True

    return False


def _call_ocr(prompt: str, image_data: str, max_retries: int = 3) -> str:
    """Call Ollama OCR with automatic retry+backoff on 500 crashes (VRAM exhaustion)."""
    last_exc = None
    for attempt in range(1, max_retries + 1):
        try:
            response = requests.post(
                OLLAMA_BASE_URL + "/api/generate",
                json={
                    "model": VISION_MODEL,
                    "prompt": prompt,
                    "images": [image_data],
                    "stream": False,
                    "keep_alive": 0,  # Unload model immediately after use
                    "options": {
                        "num_ctx": 2048,  # Limit context to prevent CUDA OOM
                        "num_gpu": 1,     # Explicitly use GPU
                        "num_thread": 4,  # Limit CPU threads
                    }
                },
                timeout=1200
            )

            if response.status_code == 500:
                err_text = ""
                try:
                    err_text = response.json().get("error", response.text)
                except Exception:
                    err_text = response.text
                last_exc = Exception(f"Ollama 500: {err_text}")
                wait = 15 * attempt  # 15s, 30s, 45s
                print(f"OCR attempt {attempt}/{max_retries} failed (Ollama 500). Waiting {wait}s for model to recover...", flush=True)
                time.sleep(wait)
                continue

            if response.status_code != 200:
                raise Exception(f"Ollama error: {response.status_code} - {response.text}")

            return (response.json().get("response") or "").strip()

        except requests.exceptions.Timeout:
            last_exc = Exception("Ollama OCR timed out")
            print(f"OCR attempt {attempt}/{max_retries} timed out. Retrying...", flush=True)
            time.sleep(10 * attempt)
        except requests.exceptions.ConnectionError as conn_err:
            last_exc = conn_err
            print(f"OCR attempt {attempt}/{max_retries} connection error: {conn_err}. Retrying...", flush=True)
            time.sleep(10 * attempt)

    raise Exception(f"OCR failed after {max_retries} attempts. Last error: {last_exc}")

def compress_image_for_ocr(image_path: str) -> str:
    """Compress image to 512px max — smaller = less VRAM = fewer OOM crashes."""
    try:
        from PIL import Image as PILImage
        img = PILImage.open(image_path).convert("RGB")
        # 512px is sufficient for handwritten text OCR and uses ~4x less VRAM than 1024px
        if img.width > 512 or img.height > 512:
            img.thumbnail((512, 512), PILImage.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=80)
        return base64.b64encode(buf.getvalue()).decode("utf-8")
    except Exception:
        # Fallback: raw file
        with open(image_path, "rb") as f:
            return base64.b64encode(f.read()).decode("utf-8")

def unload_ocr_model():
    """Explicitly unload the vision model from VRAM so the grader model can load cleanly."""
    try:
        requests.post(
            OLLAMA_BASE_URL + "/api/generate",
            json={"model": VISION_MODEL, "prompt": "", "keep_alive": 0},
            timeout=30,
        )
        print(f"[OCR] Vision model '{VISION_MODEL}' unloaded from VRAM.", flush=True)
        # Give Ollama 10 seconds to fully release GPU memory before grading model loads
        time.sleep(10)
    except Exception as e:
        print(f"[OCR] Warning: could not explicitly unload model: {e}", flush=True)


def extract_text_from_image(image_path):
    print(f"Reading image: {image_path}")
    print(f"Using model: {VISION_MODEL}")

    image_data = compress_image_for_ocr(image_path)

    extracted = _call_ocr(PRIMARY_PROMPT, image_data)
    if _looks_like_placeholder(extracted):
        print("OCR placeholder/template detected, retrying with stricter prompt...")
        extracted = _call_ocr(RETRY_PROMPT, image_data)

    if _looks_like_placeholder(extracted):
        print("OCR remained low-confidence/unusable after retry.")
        extracted = ""

    print("Text extracted!")
    return extracted