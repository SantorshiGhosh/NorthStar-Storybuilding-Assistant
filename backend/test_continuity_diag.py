import os
import sys
import json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.ai_provider import ai_provider

# Update CANDIDATE_MODELS and remove startswith AIza
ai_provider.CANDIDATE_MODELS = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite"]
ai_provider._init_client()

from app.agents.continuity_agent import continuity_agent

prompt = """
EVALUATE CHAPTER 5 FOR CONTINUITY CONTRADICTIONS:

ESTABLISHED STORY CANON FACTS:
- [LORE_RULE | Ch 1]: The lighthouse door was secured by a mechanical lock. It required two keys turned simultaneously: one held by the keeper and one kept in the town archive. No duplicate keys had ever been made. (Quote: "The lighthouse door was secured by a mechanical lock. It required two keys turned simultaneously: one held by the keeper and one kept in the town archive. No duplicate keys had ever been made.")
- [TIMELINE | Ch 1]: Nera Sol was appointed keeper on 3 June. (Quote: "Nera Sol was appointed keeper on 3 June.")

NEW CHAPTER 5 TEXT:
\"\"\"
At 04:15 the following morning, Nera returned to the lighthouse. The bell rang once. She remembered the note in the underground room: do not trust the second bell.

She used the brass token on the mechanical lock. It turned easily, although the door had no token-shaped keyway. Inside, the staircase descended below ground rather than rising toward the lantern room.

At the bottom, Nera found a flooded chamber. A tide gauge on the wall showed the water level at its lowest point. Beside it lay a ledger listing every keeper since the lighthouse was built.

The entry for Tomas Vale read: "Appointed 3 June, twelve years ago. Resigned 18 November, twelve years ago."

The entry for Nera read: "Appointed 3 June, this year. Resigned 2 June, this year."

Nera closed the ledger. Her appointment letter was dated 3 June.
\"\"\"
"""

res = ai_provider.generate_json(prompt, system_instruction=continuity_agent.SYSTEM_PROMPT)
print("RESULT FROM AI_PROVIDER:")
print(json.dumps(res, indent=2))
