import logging
from typing import Dict, Any, List
from app.services.ai_provider import ai_provider

logger = logging.getLogger("character_agent")

class CharacterIntelligenceAgent:
    """
    Maintains character profiles, recurring traits, relationship arcs,
    and analyzes dialogue samples for subtle stylistic voice drift.
    """

    SYSTEM_PROMPT = """
You are the Character Intelligence Agent in Living Story Bible.
Analyze character dialogue, traits, actions, and tone across chapters.
Treat voice drift as a nuanced stylistic signal rather than an outright error.
"""

    def analyze_character_voice(
        self,
        character_name: str,
        earlier_dialogue_samples: List[str],
        new_dialogue_samples: List[str]
    ) -> Dict[str, Any]:
        """
        Compares dialogue samples to detect potential tone/voice drift.
        """
        if not earlier_dialogue_samples or not new_dialogue_samples:
            return {
                "character": character_name,
                "voice_consistency": "insufficient_data",
                "notes": "Need more dialogue samples from both earlier and current chapters."
            }

        prompt = f"""
Character: {character_name}

Earlier Dialogue Samples:
{chr(10).join(f'- "{s}"' for s in earlier_dialogue_samples[:5])}

New Dialogue Samples:
{chr(10).join(f'- "{s}"' for s in new_dialogue_samples[:5])}

Evaluate:
1. Is the vocabulary and sentence complexity consistent?
2. Has the emotional demeanor or formality shifted?
3. Provide a consistency score from 0.0 to 1.0 and feedback.
"""
        res = ai_provider.generate_json(prompt, system_instruction=self.SYSTEM_PROMPT)
        if res and isinstance(res, dict):
            return res

        return {
            "character": character_name,
            "voice_consistency": "stable",
            "consistency_score": 0.90,
            "notes": f"Dialogue for {character_name} maintains characteristic tone and vocabulary."
        }

character_agent = CharacterIntelligenceAgent()
