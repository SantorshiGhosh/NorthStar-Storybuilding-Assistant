import json
import logging
import re
from typing import Dict, Any, Optional
from app.config import settings

logger = logging.getLogger("ai_provider")

class AIProviderService:
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.model_name = settings.GEMINI_MODEL or "gemini-1.5-flash"
        self._client = None
        self._init_client()

    def _init_client(self):
        self.api_key = settings.GEMINI_API_KEY
        self.model_name = settings.GEMINI_MODEL or "gemini-3.1-flash-lite"
        if not self.api_key:
            return
        try:
            # Try new google-genai
            from google import genai
            self._client = genai.Client(api_key=self.api_key)
            self._sdk_type = "genai"
        except Exception:
            try:
                # Fallback to google.generativeai
                import google.generativeai as legacy_genai
                legacy_genai.configure(api_key=self.api_key)
                self._client = legacy_genai.GenerativeModel(self.model_name)
                self._sdk_type = "legacy"
            except Exception as e:
                logger.warning(f"Could not initialize Gemini client: {e}")
                self._client = None
                self._sdk_type = None

    def generate_json(self, prompt: str, system_instruction: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Sends structured prompt to LLM and parses JSON response.
        Returns parsed dictionary or None on failure/missing key.
        """
        if (
            not self._client or 
            self.api_key != settings.GEMINI_API_KEY or 
            self.model_name != settings.GEMINI_MODEL
        ):
            self._init_client()

        if not self._client:
            return None

        try:
            combined_prompt = ""
            if system_instruction:
                combined_prompt += f"System Instruction: {system_instruction}\n\n"
            combined_prompt += f"{prompt}\n\nIMPORTANT: Respond with valid, parseable JSON only. Do not include markdown ticks (```json ... ```) or conversational commentary."

            raw_text = ""
            if self._sdk_type == "genai":
                response = self._client.models.generate_content(
                    model=self.model_name,
                    contents=combined_prompt
                )
                raw_text = response.text or ""
            elif self._sdk_type == "legacy":
                response = self._client.generate_content(combined_prompt)
                raw_text = response.text or ""

            # Clean markdown code blocks if model included them
            clean_text = raw_text.strip()
            if clean_text.startswith("```"):
                clean_text = re.sub(r"^```(?:json)?\s*", "", clean_text)
                clean_text = re.sub(r"\s*```$", "", clean_text)

            return json.loads(clean_text)
        except Exception as e:
            logger.warning(f"LLM generation call failed: {e}")
            return None

ai_provider = AIProviderService()
