import os
import json
import logging
import re
from typing import Dict, Any, Optional, List
from app.config import settings

logger = logging.getLogger("ai_provider")

class AIProviderService:
    """
    Robust Gemini AI Provider service with multi-model automatic fallback.
    Supported fallback priority:
      1. User configured model (if valid)
      2. gemini-2.5-flash
      3. gemini-2.0-flash
      4. gemini-1.5-flash
    Never raises unhandled exceptions on missing keys, 404, or 429 quota exhaustion.
    Returns None to allow downstream agents to run their deterministic fallbacks seamlessly.
    """

    CANDIDATE_MODELS = [
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-flash"
    ]

    def __init__(self):
        self.api_key = ""
        self._genai_client = None
        self._legacy_configured = False
        self._init_client()

    def _init_client(self):
        raw_key = settings.GEMINI_API_KEY or os.getenv("GOOGLE_API_KEY", "") or os.getenv("GEMINI_API_KEY", "")
        self.api_key = raw_key.strip().strip('"').strip("'") if raw_key else ""
        if not self.api_key or not self.api_key.startswith("AIza"):
            self._genai_client = None
            self._legacy_configured = False
            return

        # Attempt to init new google.genai
        try:
            from google import genai
            self._genai_client = genai.Client(api_key=self.api_key)
        except Exception:
            self._genai_client = None

        # Attempt to configure legacy google.generativeai as backup
        try:
            import google.generativeai as legacy_genai
            legacy_genai.configure(api_key=self.api_key)
            self._legacy_configured = True
        except Exception:
            self._legacy_configured = False

    def generate_json(self, prompt: str, system_instruction: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Sends structured prompt to Gemini with multi-model fallback and JSON fence stripping.
        Returns parsed dict/list or None if unavailable/quota-limited.
        """
        current_env_key = (settings.GEMINI_API_KEY or os.getenv("GOOGLE_API_KEY", "") or os.getenv("GEMINI_API_KEY", "")).strip().strip('"').strip("'")
        if not self.api_key or self.api_key != current_env_key:
            self._init_client()

        if not self.api_key or not self.api_key.startswith("AIza"):
            logger.debug("Valid GEMINI_API_KEY is not configured; relying on deterministic agent logic.")
            return None

        # Build list of models to try in priority order
        models_to_try = []
        known_valid_prefixes = ("gemini-2.5", "gemini-2.0", "gemini-1.5")
        if settings.GEMINI_MODEL and any(settings.GEMINI_MODEL.startswith(p) for p in known_valid_prefixes):
            if settings.GEMINI_MODEL not in self.CANDIDATE_MODELS:
                models_to_try.append(settings.GEMINI_MODEL)
        models_to_try.extend(self.CANDIDATE_MODELS)

        combined_prompt = ""
        if system_instruction:
            combined_prompt += f"System Instruction:\n{system_instruction}\n\n"
        combined_prompt += f"{prompt}\n\nIMPORTANT: Respond with valid, parseable JSON only. Do NOT include commentary, markdown explanations, or preamble."

        for model_name in models_to_try:
            try:
                raw_text = self._call_gemini_model(model_name, combined_prompt)
                if not raw_text or not raw_text.strip():
                    continue

                # Strip markdown code fences
                clean_text = raw_text.strip()
                clean_text = re.sub(r"^```(?:json)?\s*", "", clean_text, flags=re.MULTILINE)
                clean_text = re.sub(r"\s*```$", "", clean_text, flags=re.MULTILINE)
                clean_text = clean_text.strip()

                # Extract JSON block if surrounded by extra conversational text
                match = re.search(r"(\{.*\}|\[.*\])", clean_text, re.DOTALL)
                if match:
                    clean_text = match.group(1).strip()

                parsed = json.loads(clean_text)
                if isinstance(parsed, (dict, list)):
                    return parsed
            except Exception as e:
                err_str = str(e).lower()
                if "429" in err_str or "quota" in err_str or "rate limit" in err_str:
                    logger.warning(f"Gemini model '{model_name}' quota limited (429). Attempting fallback...")
                elif "404" in err_str or "not found" in err_str:
                    logger.warning(f"Gemini model '{model_name}' not found (404). Attempting fallback...")
                else:
                    logger.warning(f"Gemini model '{model_name}' call failed: {e}")
                continue

        logger.warning("All Gemini candidate models failed or exhausted quota. Triggering deterministic fallback.")
        return None

    def _call_gemini_model(self, model_name: str, prompt: str) -> str:
        # Try google.genai first
        if self._genai_client:
            try:
                resp = self._genai_client.models.generate_content(
                    model=model_name,
                    contents=prompt
                )
                if resp and resp.text:
                    return resp.text
            except Exception as e:
                # If new SDK fails, try legacy
                pass

        # Try legacy google.generativeai
        if self._legacy_configured:
            import google.generativeai as legacy_genai
            model = legacy_genai.GenerativeModel(model_name)
            resp = model.generate_content(prompt)
            if resp and resp.text:
                return resp.text

        return ""

ai_provider = AIProviderService()
