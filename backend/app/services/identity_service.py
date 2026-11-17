import re
import logging
from typing import Dict, Any, List, Optional, Tuple, Set
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import models

logger = logging.getLogger("identity_service")

# Universal stop words to never classify as entities
COMMON_STOP_WORDS = {
    "the", "a", "an", "then", "there", "when", "while", "after", "before", "as", "it", "they", "he", "she",
    "his", "her", "their", "its", "suddenly", "meanwhile", "finally", "later", "instead", "without",
    "inside", "outside", "under", "over", "behind", "beyond", "through", "across", "although", "even",
    "every", "all", "both", "neither", "either", "someone", "anyone", "no one", "everyone", "something",
    "nothing", "everything", "chapter", "part", "book", "one", "two", "three", "four", "five", "six",
    "seven", "eight", "nine", "ten", "first", "second", "third", "next", "last", "yesterday", "today",
    "tomorrow", "morning", "night", "evening", "now", "soon", "still", "once", "yet", "but", "and", "or",
    "so", "if", "because", "since", "however", "therefore", "perhaps", "maybe", "surely", "indeed",
    "just", "only", "almost", "nearly", "some", "any", "no", "what", "which", "who", "whom", "whose",
    "where", "why", "how", "this", "that", "these", "those", "upon", "into", "onto", "from", "with",
    "about", "against", "between", "during", "towards", "toward", "among", "within",
    # Months / Days
    "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december",
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
    # Emotions / Abstract states
    "anger", "fear", "hope", "dread", "sorrow", "joy", "silence", "darkness", "light", "shadow", "truth", "justice"
}

TITLES_PREFIXES = {
    "King", "Queen", "Prince", "Princess", "Lord", "Lady", "Sir", "Dame",
    "Doctor", "Dr.", "Professor", "Prof.", "Captain", "Capt.", "Commander",
    "General", "Major", "Colonel", "Lieutenant", "Lt.", "Sergeant", "Sgt.",
    "Inspector", "Detective", "Officer", "Agent", "Sheriff", "Marshal",
    "Baron", "Baroness", "Count", "Countess", "Duke", "Duchess", "Emperor", "Empress",
    "Archivist", "Historian", "Keeper", "Master", "Father", "Mother", "Brother", "Sister",
    "Governor", "Senator", "Chancellor", "Priest", "Priestess", "Bishop", "Elder"
}

class IdentityService:
    """
    Advanced Narrative Entity Resolution, Alias Management, Coreference & Dialogue Attribution.
    Completely isolated from hardcoded character names or demo universes.
    """

    def __init__(self):
        self._spacy_nlp = None
        self._project_sessions: Dict[str, Dict[str, Any]] = {}
        self._init_spacy()

    def preload_project_identities(self, db: Session, project_id: str):
        """
        Preloads all entities and aliases for a project into a fast in-memory session index.
        Eliminates N+1 database queries across batch chapter ingestion.
        """
        pid = str(project_id)
        ents = db.query(models.Entity).filter(models.Entity.project_id == project_id).all()
        aliases = db.query(models.EntityAlias).filter(models.EntityAlias.project_id == project_id).all()

        alias_to_ent: Dict[str, models.Entity] = {}
        alias_obj_map: Dict[Tuple[str, str], models.EntityAlias] = {}
        ent_by_id = {str(e.id): e for e in ents}

        for a in aliases:
            canon = getattr(a, "canonical_entity", None) or ent_by_id.get(str(getattr(a, "canonical_entity_id", None)))
            if canon:
                alias_name = getattr(a, "alias_name", "") or ""
                alias_to_ent[alias_name.lower().strip()] = canon
            canon_id = str(getattr(a, "canonical_entity_id", ""))
            alias_str = (getattr(a, "alias_name", "") or "").lower().strip()
            alias_obj_map[(canon_id, alias_str)] = a

        canonical_by_name: Dict[str, models.Entity] = {e.name.lower().strip(): e for e in ents}
        ents_by_type: Dict[str, List[models.Entity]] = {}
        for e in ents:
            ents_by_type.setdefault(e.entity_type.lower().strip(), []).append(e)

        self._project_sessions[pid] = {
            "canonical_by_name": canonical_by_name,
            "alias_to_ent": alias_to_ent,
            "alias_obj_map": alias_obj_map,
            "ents_by_type": ents_by_type,
            "ent_by_id": ent_by_id
        }

    def clear_project_identities(self, project_id: Optional[str] = None):
        """
        Clears the in-memory identity session index for a project or all projects.
        """
        if project_id:
            self._project_sessions.pop(str(project_id), None)
        else:
            self._project_sessions.clear()

    def _init_spacy(self):
        try:
            import spacy
            # Try loading English model if downloaded, otherwise blank
            try:
                self._spacy_nlp = spacy.load("en_core_web_sm")
            except Exception:
                self._spacy_nlp = spacy.blank("en")
        except Exception:
            self._spacy_nlp = None

    # -------------------------------------------------------------------------
    # 1. HYBRID NAMED ENTITY RECOGNITION
    # -------------------------------------------------------------------------
    def extract_named_entities(self, text: str, chapter_number: int = 1) -> List[Dict[str, Any]]:
        """
        Extracts narrative entities across characters, locations, objects, and organizations
        using grammatical analysis, title recognition, and dialogue attribution patterns.
        Does NOT rely on hardcoded demonstration names.
        """
        entities: Dict[str, Dict[str, Any]] = {}

        def register(name: str, ent_type: str, confidence: float = 0.85, desc: str = "") -> None:
            clean = name.strip()
            if not clean or len(clean) < 2:
                return
            # Filter pure stop words
            words = clean.split()
            if all(w.lower() in COMMON_STOP_WORDS for w in words):
                return
            if words[0].lower() in COMMON_STOP_WORDS and len(words) == 1:
                return

            key = clean.lower()
            if key in entities:
                if confidence > entities[key]["confidence"]:
                    entities[key]["confidence"] = confidence
                if desc and not entities[key]["description"]:
                    entities[key]["description"] = desc
                return

            entities[key] = {
                "name": clean,
                "entity_type": ent_type,
                "confidence": confidence,
                "description": desc or f"{ent_type.capitalize()} appearing in Chapter {chapter_number}",
                "traits": [],
                "first_appearance_chapter": chapter_number
            }

        # Pattern 1: Titled figures (e.g. 'Dr. Elena Vance', 'Captain Vance', 'Princess Elara')
        titles_regex = r'\b(' + '|'.join(re.escape(t) for t in TITLES_PREFIXES) + r')\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b'
        for title, rest in re.findall(titles_regex, text):
            words = rest.split()
            if not any(w.lower() in COMMON_STOP_WORDS for w in words):
                full_name = f"{title} {rest}"
                register(full_name, "character", confidence=0.95, desc=f"Titled figure ({title})")
                # Also register the base name as an entity/alias candidate
                register(rest, "character", confidence=0.85)

        # Pattern 2: Dialogue attribution speakers ("..." said X / X replied / whispered X)
        speaker_patterns = [
            r'["\'”]\s+(?:said|replied|whispered|shouted|asked|muttered|gasped|commanded|yelled)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b',
            r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:said|replied|whispered|shouted|asked|muttered|gasped|commanded|yelled)\s*[,:][\s"\']'
        ]
        for pat in speaker_patterns:
            for cand in re.findall(pat, text):
                words = cand.split()
                if not any(w.lower() in COMMON_STOP_WORDS for w in words) and len(cand) >= 3:
                    register(cand, "character", confidence=0.92, desc=f"Character speaking in Chapter {chapter_number}")

        # Pattern 3: Proper names with character actions and possessives
        action_verb_names = re.findall(
            r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:stepped|walked|ran|turned|reached|pulled|drew|stood|sat|looked|stared|watched|glanced|smiled|frowned|hesitated|grabbed|held|opened|closed|entered|left|returned|felt|knew|thought|wondered|remembered|noticed)\b',
            text
        )
        for cand in action_verb_names:
            words = cand.split()
            if len(cand) >= 3 and not any(w.lower() in COMMON_STOP_WORDS for w in words):
                register(cand, "character", confidence=0.88)

        # Possessive patterns: Arin's hand, Mira's blade
        possessive_names = re.findall(
            r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*[\'’]s\s+(?:hand|arm|eye|face|sword|cloak|voice|shoulder|chest|pocket|fingers|blade|notebook|heart|wound|scar)\b',
            text
        )
        for cand in possessive_names:
            words = cand.split()
            if len(cand) >= 3 and not any(w.lower() in COMMON_STOP_WORDS for w in words):
                register(cand, "character", confidence=0.90)

        # Pattern 4: Locations (Kingdom of X, City of Y, Fortress of Z, X Tower, Y Citadel)
        loc_patterns = [
            r'\b(?:kingdom|fortress|city|village|town|capital|island|mountains?|sea|river|forest|sanctuary|citadel|station|sector|tower|harbor|port|chamber|temple)\s+of\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b',
            r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:Castle|Fortress|Tower|Citadel|Palace|Station|Harbor|Port|Inn|Tavern|Square|Gate|Bridge|Forest|Mountains?|Valley|Sea|Ocean|River|Cliffs?|Island|Quarter|District)\b'
        ]
        for pat in loc_patterns:
            for loc in re.findall(pat, text, re.IGNORECASE):
                cand = loc.strip()
                if not any(w.lower() in COMMON_STOP_WORDS for w in cand.split()) and len(cand) >= 3:
                    register(cand, "location", confidence=0.90, desc=f"Location in Chapter {chapter_number}")

        # Pattern 5: Key narrative objects (The Crown Seal, The Ancient Gate, The Brass Key)
        obj_matches = re.findall(
            r'\b(?:the|a|an|his|her|their)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+(?:Key|Token|Seal|Amulet|Ring|Blade|Sword|Dagger|Gun|Pistol|Rifle|Journal|Diary|Notebook|Letter|Scroll|Parchment|Device|Cylinder|Compass|Watch|Lantern|Cloak|Mask|Pendant|Lock|Vault|Gate|Door))\b',
            text
        )
        for obj in obj_matches:
            cand = obj.strip()
            if not any(w.lower() in COMMON_STOP_WORDS for w in cand.split()):
                register(cand, "object", confidence=0.88, desc=f"Object appearing in Chapter {chapter_number}")

        return list(entities.values())

    # -------------------------------------------------------------------------
    # 2. ENTITY RESOLUTION & ALIAS MANAGEMENT
    # -------------------------------------------------------------------------
    def resolve_entity_identity(
        self,
        db: Session,
        project_id: str,
        extracted_name: str,
        entity_type: str = "character",
        source_quote: Optional[str] = None,
        chapter_id: Optional[str] = None
    ) -> models.Entity:
        """
        Resolves an extracted name string to its canonical Entity record using alias matching,
        title stripping, and identity mapping. If no high-confidence canonical match exists,
        creates a new Entity and registers its primary alias.
        """
        name_clean = extracted_name.strip()
        name_lower = name_clean.lower()
        session = self._project_sessions.get(str(project_id))

        # 1. Fast in-memory session index lookup (canonical name or registered alias)
        if session:
            if name_lower in session["canonical_by_name"]:
                return session["canonical_by_name"][name_lower]
            if name_lower in session["alias_to_ent"]:
                return session["alias_to_ent"][name_lower]

        # 2. Database exact match on canonical entity name
        exact_ent = db.query(models.Entity).filter(
            models.Entity.project_id == project_id,
            models.Entity.name.ilike(name_clean)
        ).first()
        if exact_ent:
            if session:
                session["canonical_by_name"][name_lower] = exact_ent
                session["canonical_by_name"][exact_ent.name.lower().strip()] = exact_ent
                session["ent_by_id"][str(exact_ent.id)] = exact_ent
            return exact_ent

        # 3. Database match on registered entity aliases

        alias_record = db.query(models.EntityAlias).filter(
            models.EntityAlias.project_id == project_id,
            models.EntityAlias.alias_name.ilike(name_clean)
        ).first()
        if alias_record and alias_record.canonical_entity:
            if session:
                session["alias_to_ent"][name_lower] = alias_record.canonical_entity
            return alias_record.canonical_entity

        # 2b. Context-based alias resolution from source quote
        # (e.g. "Commander Katherine Vance, known to her closest friends simply as Kit")
        if source_quote:
            existing_ents = db.query(models.Entity).filter(
                models.Entity.project_id == project_id,
                models.Entity.entity_type == entity_type
            ).all()
            for ent in existing_ents:
                if ent.name.lower() in source_quote.lower() and ent.name.lower() != name_lower:
                    self.register_alias(
                        db=db,
                        project_id=project_id,
                        canonical_entity_id=ent.id,
                        alias_name=name_clean,
                        alias_type="nickname",
                        confidence=0.95,
                        source_quote=source_quote
                    )
                    return ent

        # 3. Strip title prefixes: 'Dr. Elena Vance' -> 'Elena Vance' or 'Commander Vance' -> 'Vance'
        stripped_name = name_clean
        matched_title = None
        for t in TITLES_PREFIXES:
            if name_clean.lower().startswith(f"{t.lower()} "):
                stripped_name = name_clean[len(t)+1:].strip()
                matched_title = t
                break

        if stripped_name != name_clean:
            # 3a. Exact match on stripped name
            match_stripped = db.query(models.Entity).filter(
                models.Entity.project_id == project_id,
                models.Entity.name.ilike(stripped_name)
            ).first()

            # 3b. Match if stripped_name is the surname or token of an existing character
            if not match_stripped:
                candidates = db.query(models.Entity).filter(
                    models.Entity.project_id == project_id,
                    models.Entity.entity_type == entity_type
                ).all()
                matching_cands = [
                    c for c in candidates
                    if stripped_name.lower() in [w.lower() for w in c.name.split()]
                ]
                if len(matching_cands) == 1:
                    match_stripped = matching_cands[0]

            if match_stripped:
                self.register_alias(
                    db=db,
                    project_id=project_id,
                    canonical_entity_id=match_stripped.id,
                    alias_name=name_clean,
                    alias_type="title",
                    confidence=0.95,
                    source_quote=source_quote
                )
                return match_stripped

        # 4. Check if single first name matches an existing multi-part name (e.g. 'Elena' -> 'Dr. Elena Vance')
        # Only merge if there is exactly ONE unique candidate with this first name in the project
        words = name_clean.split()
        if len(words) == 1:
            candidate_ents = db.query(models.Entity).filter(
                models.Entity.project_id == project_id,
                models.Entity.entity_type == entity_type,
                models.Entity.name.ilike(f"%{name_clean}%")
            ).all()

            # Filter candidates where name_clean is an exact token word in the canonical name
            token_candidates = [
                cand for cand in candidate_ents
                if name_lower in [w.lower() for w in cand.name.split()]
            ]

            if len(token_candidates) == 1:
                canonical = token_candidates[0]
                self.register_alias(
                    db=db,
                    project_id=project_id,
                    canonical_entity_id=canonical.id,
                    alias_name=name_clean,
                    alias_type="nickname" if len(words) == 1 else "alias",
                    confidence=0.90,
                    source_quote=source_quote
                )
                return canonical
            elif len(token_candidates) > 1:
                logger.info(f"Multiple candidates found for ambiguous name '{name_clean}'. Preserving separate identity.")

        # 5. Create new canonical Entity
        canonical_name = stripped_name if (matched_title and len(stripped_name.split()) >= 2) else name_clean

        new_ent = models.Entity(
            id=models.gen_uuid(),
            project_id=project_id,
            name=canonical_name,
            entity_type=entity_type.lower().strip(),
            description="",
            traits=[],
            first_appearance_chapter_id=chapter_id,
            meta_info={}
        )
        db.add(new_ent)
        db.flush()

        # Register primary alias
        self.register_alias(
            db=db,
            project_id=project_id,
            canonical_entity_id=new_ent.id,
            alias_name=canonical_name,
            alias_type="full_name",
            confidence=1.0,
            source_quote=source_quote
        )

        # If created with title, register original name as title alias
        if canonical_name != name_clean:
            self.register_alias(
                db=db,
                project_id=project_id,
                canonical_entity_id=new_ent.id,
                alias_name=name_clean,
                alias_type="title",
                confidence=0.98,
                source_quote=source_quote
            )

        if session:
            session["canonical_by_name"][canonical_name.lower().strip()] = new_ent
            session["canonical_by_name"][name_lower] = new_ent
            session["ent_by_id"][str(new_ent.id)] = new_ent
            session["ents_by_type"].setdefault(entity_type.lower().strip(), []).append(new_ent)

        db.commit()
        db.refresh(new_ent)
        return new_ent

    def register_alias(
        self,
        db: Session,
        project_id: str,
        canonical_entity_id: str,
        alias_name: str,
        alias_type: str = "nickname",
        confidence: float = 1.0,
        source_quote: Optional[str] = None
    ) -> models.EntityAlias:
        """
        Saves or updates an alias linked to a canonical entity.
        """
        session = self._project_sessions.get(str(project_id))
        clean_alias = alias_name.strip()
        alias_key = (str(canonical_entity_id), clean_alias.lower())

        if session and alias_key in session["alias_obj_map"]:
            existing = session["alias_obj_map"][alias_key]
            existing.confidence = max(existing.confidence, confidence)
            if source_quote and not existing.source_quote:
                existing.source_quote = source_quote
            return existing

        existing = db.query(models.EntityAlias).filter(
            models.EntityAlias.project_id == project_id,
            models.EntityAlias.canonical_entity_id == canonical_entity_id,
            models.EntityAlias.alias_name.ilike(clean_alias)
        ).first()

        if existing:
            existing.confidence = max(existing.confidence, confidence)
            if source_quote and not existing.source_quote:
                existing.source_quote = source_quote
            if session:
                session["alias_obj_map"][alias_key] = existing
                canon = session["ent_by_id"].get(str(canonical_entity_id))
                if canon:
                    session["alias_to_ent"][clean_alias.lower()] = canon
            return existing

        alias = models.EntityAlias(
            id=models.gen_uuid(),
            project_id=project_id,
            canonical_entity_id=canonical_entity_id,
            alias_name=clean_alias,
            alias_type=alias_type,
            confidence=confidence,
            source_quote=source_quote
        )
        db.add(alias)
        if session:
            session["alias_obj_map"][alias_key] = alias
            canon = session["ent_by_id"].get(str(canonical_entity_id))
            if canon:
                session["alias_to_ent"][clean_alias.lower()] = canon
        return alias

    # -------------------------------------------------------------------------
    # 3. COREFERENCE RESOLUTION (Pronoun & Epithet Linking)
    # -------------------------------------------------------------------------
    def resolve_pronouns_and_epithets(
        self,
        passage_text: str,
        candidate_entities: List[models.Entity]
    ) -> List[Dict[str, Any]]:
        """
        Attempts to resolve pronouns (he, she, they, his, her) and role epithets (the captain, the doctor)
        to candidate entities in the active context window.
        Returns resolutions with confidence, candidates, and ambiguity flags.
        """
        resolutions = []
        sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', passage_text) if s.strip()]

        # Maintain recency stack of mentioned entities
        recent_male: List[models.Entity] = []
        recent_female: List[models.Entity] = []
        recent_general: List[models.Entity] = []

        for sent_idx, sent in enumerate(sentences):
            # 1. Identify which candidate entities are explicitly mentioned in this sentence
            current_sent_ents = []
            for ent in candidate_entities:
                if re.search(rf'\b{re.escape(ent.name)}\b', sent, re.IGNORECASE):
                    current_sent_ents.append(ent)
                    # Check gender cues from traits or titles
                    ent_str = (ent.name + " " + " ".join(ent.traits or [])).lower()
                    if any(m in ent_str for m in ["king", "prince", "lord", "sir", "father", "brother", "himself", "male", "he"]):
                        if ent not in recent_male:
                            recent_male.insert(0, ent)
                    elif any(f in ent_str for f in ["queen", "princess", "lady", "dame", "mother", "sister", "herself", "female", "she"]):
                        if ent not in recent_female:
                            recent_female.insert(0, ent)
                    else:
                        if ent not in recent_general:
                            recent_general.insert(0, ent)

            # 2. Check pronouns in sentence
            s_low = sent.lower()

            # Male pronouns: he, him, his
            if re.search(r'\b(he|him|his)\b', s_low):
                if len(recent_male) == 1:
                    resolutions.append({
                        "referent": "he/him/his",
                        "sentence_index": sent_idx,
                        "sentence": sent,
                        "resolved_entity": recent_male[0],
                        "confidence": 0.85,
                        "is_ambiguous": False
                    })
                elif len(recent_male) > 1:
                    resolutions.append({
                        "referent": "he/him/his",
                        "sentence_index": sent_idx,
                        "sentence": sent,
                        "resolved_entity": None,
                        "candidate_entities": recent_male[:2],
                        "confidence": 0.40,
                        "is_ambiguous": True
                    })

            # Female pronouns: she, her, hers
            if re.search(r'\b(she|her|hers)\b', s_low):
                if len(recent_female) == 1:
                    resolutions.append({
                        "referent": "she/her",
                        "sentence_index": sent_idx,
                        "sentence": sent,
                        "resolved_entity": recent_female[0],
                        "confidence": 0.85,
                        "is_ambiguous": False
                    })
                elif len(recent_female) > 1:
                    resolutions.append({
                        "referent": "she/her",
                        "sentence_index": sent_idx,
                        "sentence": sent,
                        "resolved_entity": None,
                        "candidate_entities": recent_female[:2],
                        "confidence": 0.40,
                        "is_ambiguous": True
                    })

        return resolutions

    # -------------------------------------------------------------------------
    # 4. DIALOGUE ATTRIBUTION
    # -------------------------------------------------------------------------
    def attribute_dialogue(
        self,
        chapter_content: str,
        known_characters: List[models.Entity]
    ) -> List[Dict[str, Any]]:
        """
        Extracts dialogue quotes and attributes speaker identity with confidence and verbatim passage.
        Handles:
          - "Quote" said Character.
          - Character replied, "Quote".
          - "Quote," she/he whispered.
        """
        dialogue_items = []
        name_to_ent = {e.name.lower(): e for e in known_characters}

        # Regex: dialogue surrounded by quotation marks
        dialogue_regex = re.compile(
            r'["“]([^"”]{3,500})["”]\s*(?:([,.]?\s*(?:said|whispered|shouted|asked|muttered|yelled|replied|demanded|gasped)\s+([A-Za-z\s]+))|([A-Za-z\s]+)\s+(?:said|whispered|shouted|asked|muttered|yelled|replied))?',
            re.IGNORECASE
        )

        for match in dialogue_regex.finditer(chapter_content):
            quote = match.group(1).strip()
            speaker_post = (match.group(3) or "").strip()
            speaker_pre = (match.group(4) or "").strip()
            speaker_candidate = speaker_post or speaker_pre

            matched_entity = None
            confidence = 0.50

            if speaker_candidate:
                # Check against known characters
                clean_cand = re.sub(r'[,.!?]', '', speaker_candidate).strip()
                for name, ent in name_to_ent.items():
                    if clean_cand.lower() == name or clean_cand.lower() in name.split():
                        matched_entity = ent
                        confidence = 0.95
                        break

            if matched_entity:
                dialogue_items.append({
                    "quote": quote,
                    "speaker_name": matched_entity.name,
                    "speaker_entity_id": matched_entity.id,
                    "confidence": confidence,
                    "attribution_status": "attributed"
                })
            elif quote:
                dialogue_items.append({
                    "quote": quote,
                    "speaker_name": None,
                    "speaker_entity_id": None,
                    "confidence": 0.0,
                    "attribution_status": "unattributed"
                })

        return dialogue_items

identity_service = IdentityService()
