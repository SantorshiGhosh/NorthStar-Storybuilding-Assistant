"""
Narrative Mention Classifier Service
Scans text passages to extract and classify entity mentions:
- proper_name (characters, locations, distinct artifacts)
- pronoun (personal, possessive, reflexive)
- descriptive_ref (role/title/profession based referents)
- incidental_noun (common nouns and props)
Accurately detects grammatical roles and prevents sentence-initial capitalization false-positives.
"""
import re
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field


@dataclass
class TextMention:
    text_span: str
    mention_type: str        # proper_name, pronoun, descriptive_ref, incidental_noun
    char_start: int
    char_end: int
    grammatical_role: str    # subject, direct_object, indirect_object, possessive, prepositional
    context_sentence: str
    confidence: float = 1.0
    gender_bias: str = "unknown"      # male, female, neutral, inanimate
    number_bias: str = "singular"     # singular, plural
    is_sentence_initial: bool = False
    attributes: Dict[str, Any] = field(default_factory=dict)


class NarrativeMentionClassifier:
    """
    Extracts and classifies entity mentions and pronouns across manuscript chapters and passages.
    """

    PRONOUNS_MALE = {"he", "him", "his", "himself"}
    PRONOUNS_FEMALE = {"she", "her", "hers", "herself"}
    PRONOUNS_INANIMATE = {"it", "its", "itself"}
    PRONOUNS_PLURAL = {"they", "them", "their", "theirs", "themselves"}

    HONORIFIC_TITLES = {
        "inspector", "detective", "captain", "sergeant", "doctor", "dr.", "dr", "prof.", "professor",
        "lord", "lady", "king", "queen", "prince", "princess", "duke", "duchess", "count", "countess",
        "sir", "madam", "master", "father", "mother", "sister", "brother", "elder", "officer", "agent"
    }

    ROLE_DESCRIPTORS = {
        "detective", "investigator", "officer", "captain", "doctor", "healer", "scholar",
        "blacksmith", "assassin", "killer", "thief", "merchant", "stranger", "woman",
        "man", "boy", "girl", "youth", "child", "elder", "king", "queen", "lord", "lady",
        "priest", "monk", "soldier", "warrior", "knight", "guard", "prisoner", "friend"
    }

    INCIDENTAL_COMMON_NOUNS = {
        "chair", "table", "cup", "tea", "coffee", "wine", "door", "window", "wall", "floor",
        "bed", "desk", "room", "hallway", "corridor", "stairs", "street", "carriage", "horse",
        "shirt", "coat", "boots", "shoes", "bread", "meal", "paper", "pen", "candle", "lamp"
    }

    PREPOSITIONS = {
        "in", "on", "at", "to", "into", "onto", "from", "with", "by", "for", "about",
        "against", "between", "through", "during", "before", "after", "above", "below",
        "under", "behind", "near", "upon", "towards", "beside"
    }

    def __init__(self):
        # Regex for sentence splitting that handles common abbreviations
        self._sentence_regex = re.compile(r'(?<!\w\.\w.)(?<![A-Z][a-z]\.)(?<=\.|\?|!)\s+')

    def split_sentences(self, text: str) -> List[Tuple[str, int, int]]:
        """Splits text into sentences, returning (sentence_text, start_offset, end_offset)."""
        sentences = []
        start = 0
        raw_sentences = self._sentence_regex.split(text)
        
        for s in raw_sentences:
            s_clean = s.strip()
            if not s_clean:
                continue
            idx = text.find(s_clean, start)
            if idx == -1:
                idx = start
            end = idx + len(s_clean)
            sentences.append((s_clean, idx, end))
            start = end
        return sentences

    def classify_mention(
        self,
        span: str,
        is_at_sentence_start: bool = False,
        context_sentence: str = ""
    ) -> Dict[str, Any]:
        """
        Classifies a text span into mention_type, gender_bias, number_bias, confidence.
        """
        clean_span = span.strip()
        lower_span = clean_span.lower()
        stripped_noun = re.sub(r'^(the|a|an)\s+', '', lower_span).strip()

        # 1. Pronoun check
        if lower_span in self.PRONOUNS_MALE:
            return {
                "mention_type": "pronoun",
                "gender_bias": "male",
                "number_bias": "singular",
                "confidence": 0.99
            }
        if lower_span in self.PRONOUNS_FEMALE:
            return {
                "mention_type": "pronoun",
                "gender_bias": "female",
                "number_bias": "singular",
                "confidence": 0.99
            }
        if lower_span in self.PRONOUNS_INANIMATE:
            return {
                "mention_type": "pronoun",
                "gender_bias": "inanimate",
                "number_bias": "singular",
                "confidence": 0.99
            }
        if lower_span in self.PRONOUNS_PLURAL:
            return {
                "mention_type": "pronoun",
                "gender_bias": "neutral",
                "number_bias": "plural",
                "confidence": 0.95
            }

        # 2. Descriptive referent check (e.g., "the detective", "the old scholar")
        words = lower_span.split()
        if any(role in words for role in self.ROLE_DESCRIPTORS):
            return {
                "mention_type": "descriptive_ref",
                "gender_bias": "male" if any(w in words for w in ["man", "boy", "king", "lord", "prince"]) else ("female" if any(w in words for w in ["woman", "girl", "queen", "lady", "princess"]) else "unknown"),
                "number_bias": "singular",
                "confidence": 0.88
            }

        # 3. Incidental noun check
        if stripped_noun in self.INCIDENTAL_COMMON_NOUNS:
            return {
                "mention_type": "incidental_noun",
                "gender_bias": "inanimate",
                "number_bias": "singular",
                "confidence": 0.95
            }

        # 4. Proper name check
        tokens = clean_span.split()
        if is_at_sentence_start and len(tokens) == 1:
            # Single word capitalized at sentence start may just be capitalization rule
            first_word_lower = tokens[0].lower()
            if first_word_lower in self.INCIDENTAL_COMMON_NOUNS:
                return {
                    "mention_type": "incidental_noun",
                    "gender_bias": "inanimate",
                    "number_bias": "singular",
                    "confidence": 0.90
                }
            # Common dictionary word check (e.g. "Morning", "Suddenly", "Yesterday")
            if first_word_lower in {"morning", "evening", "suddenly", "yesterday", "tomorrow", "sometimes", "perhaps"}:
                return {
                    "mention_type": "incidental_noun",
                    "gender_bias": "inanimate",
                    "number_bias": "singular",
                    "confidence": 0.90
                }

        # Check for title + name (e.g. "Inspector Vance", "Lady Catherine")
        if any(t.lower() in self.HONORIFIC_TITLES for t in tokens):
            return {
                "mention_type": "proper_name",
                "gender_bias": "female" if any(t.lower() in ["lady", "queen", "princess", "duchess", "countess", "sister", "mother", "madam"] for t in tokens) else ("male" if any(t.lower() in ["lord", "king", "prince", "duke", "sir", "father", "brother"] for t in tokens) else "unknown"),
                "number_bias": "singular",
                "confidence": 0.95
            }

        # If capitalized
        if tokens and all(t[0].isupper() for t in tokens if t.lower() not in ("of", "the", "in", "and")):
            return {
                "mention_type": "proper_name",
                "gender_bias": "unknown",
                "number_bias": "singular",
                "confidence": 0.90
            }

        return {
            "mention_type": "incidental_noun",
            "gender_bias": "inanimate",
            "number_bias": "singular",
            "confidence": 0.70
        }

    def infer_grammatical_role(self, span: str, sentence: str) -> str:
        """
        Infers the grammatical role of a mention span in a sentence.
        """
        clean_span = span.strip()
        lower_span = clean_span.lower()
        lower_sent = sentence.lower()

        # Check possessive
        if lower_span in {"his", "her", "their", "its", "my", "your"} or clean_span.endswith("'s") or clean_span.endswith("’s"):
            return "possessive"

        idx = lower_sent.find(lower_span)
        if idx == -1:
            return "subject"

        # Check if preceded by preposition
        prefix = lower_sent[:idx].strip()
        last_word_prefix = prefix.split()[-1] if prefix.split() else ""
        if last_word_prefix in self.PREPOSITIONS:
            return "prepositional"

        # Rough heuristic: if span is in first half of sentence before a common verb, it's subject
        words_before = len(prefix.split())
        words_after = len(lower_sent[idx + len(lower_span):].split())

        if words_before <= 2:
            return "subject"
        if words_after <= 2:
            return "direct_object"

        # Check verb proximity
        common_verbs = ["entered", "saw", "said", "asked", "held", "took", "gave", "killed", "walked", "opened", "spoke", "struck", "pulled"]
        for v in common_verbs:
            v_idx = lower_sent.find(v)
            if v_idx != -1:
                if idx < v_idx:
                    return "subject"
                else:
                    return "direct_object"

        return "subject" if words_before < words_after else "direct_object"

    def extract_mentions_from_text(
        self,
        text: str,
        known_canonical_names: Optional[List[str]] = None
    ) -> List[TextMention]:
        """
        Extracts all candidate mentions (proper names, pronouns, descriptive refs, incidental nouns)
        from a block of text, calculating exact character offsets.
        """
        mentions: List[TextMention] = []
        if not text:
            return mentions

        known_names = known_canonical_names or []
        sentences = self.split_sentences(text)

        # Build regex for known names
        name_patterns = []
        for kn in sorted(known_names, key=len, reverse=True):
            if kn:
                name_patterns.append(re.escape(kn))

        # Patterns for pronouns
        all_pronouns = (
            self.PRONOUNS_MALE | self.PRONOUNS_FEMALE |
            self.PRONOUNS_INANIMATE | self.PRONOUNS_PLURAL
        )
        pronoun_regex = re.compile(rf'\b({"|".join(all_pronouns)})\b', re.IGNORECASE)

        # Descriptive role pattern
        role_regex = re.compile(rf'\b(the|a|an)\s+([a-zA-Z]+\s+)?({"|".join(self.ROLE_DESCRIPTORS)})\b', re.IGNORECASE)

        # Capitalized multi-word or single-word proper noun pattern
        proper_regex = re.compile(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b')

        for sent_text, sent_start, sent_end in sentences:
            found_spans = set()

            # 1. Known canonical entities
            if name_patterns:
                kn_regex = re.compile(rf'\b({"|".join(name_patterns)})\b', re.IGNORECASE)
                for m in kn_regex.finditer(sent_text):
                    s_idx = sent_start + m.start()
                    e_idx = sent_start + m.end()
                    span = m.group(0)
                    found_spans.add((m.start(), m.end()))
                    role = self.infer_grammatical_role(span, sent_text)
                    mentions.append(TextMention(
                        text_span=span,
                        mention_type="proper_name",
                        char_start=s_idx,
                        char_end=e_idx,
                        grammatical_role=role,
                        context_sentence=sent_text,
                        confidence=0.98,
                        gender_bias="unknown",
                        is_sentence_initial=(m.start() == 0)
                    ))

            # 2. Pronouns
            for m in pronoun_regex.finditer(sent_text):
                # Avoid overlapping with existing
                if any(start <= m.start() < end for start, end in found_spans):
                    continue
                s_idx = sent_start + m.start()
                e_idx = sent_start + m.end()
                span = m.group(0)
                classification = self.classify_mention(span, is_at_sentence_start=(m.start() == 0), context_sentence=sent_text)
                role = self.infer_grammatical_role(span, sent_text)
                found_spans.add((m.start(), m.end()))

                mentions.append(TextMention(
                    text_span=span,
                    mention_type=classification["mention_type"],
                    char_start=s_idx,
                    char_end=e_idx,
                    grammatical_role=role,
                    context_sentence=sent_text,
                    confidence=classification["confidence"],
                    gender_bias=classification["gender_bias"],
                    number_bias=classification["number_bias"],
                    is_sentence_initial=(m.start() == 0)
                ))

            # 3. Descriptive references
            for m in role_regex.finditer(sent_text):
                if any(start <= m.start() < end for start, end in found_spans):
                    continue
                s_idx = sent_start + m.start()
                e_idx = sent_start + m.end()
                span = m.group(0)
                classification = self.classify_mention(span, is_at_sentence_start=(m.start() == 0), context_sentence=sent_text)
                role = self.infer_grammatical_role(span, sent_text)
                found_spans.add((m.start(), m.end()))

                mentions.append(TextMention(
                    text_span=span,
                    mention_type=classification["mention_type"],
                    char_start=s_idx,
                    char_end=e_idx,
                    grammatical_role=role,
                    context_sentence=sent_text,
                    confidence=classification["confidence"],
                    gender_bias=classification["gender_bias"],
                    number_bias=classification["number_bias"],
                    is_sentence_initial=(m.start() == 0)
                ))

            # 4. Other Proper Names
            for m in proper_regex.finditer(sent_text):
                if any(start <= m.start() < end for start, end in found_spans):
                    continue
                span = m.group(0)
                is_start = (m.start() == 0)
                classification = self.classify_mention(span, is_at_sentence_start=is_start, context_sentence=sent_text)
                if classification["mention_type"] == "proper_name":
                    s_idx = sent_start + m.start()
                    e_idx = sent_start + m.end()
                    role = self.infer_grammatical_role(span, sent_text)
                    found_spans.add((m.start(), m.end()))

                    mentions.append(TextMention(
                        text_span=span,
                        mention_type="proper_name",
                        char_start=s_idx,
                        char_end=e_idx,
                        grammatical_role=role,
                        context_sentence=sent_text,
                        confidence=classification["confidence"],
                        gender_bias=classification["gender_bias"],
                        number_bias=classification["number_bias"],
                        is_sentence_initial=is_start
                    ))

        # Sort by char_start
        mentions.sort(key=lambda x: x.char_start)
        return mentions


narrative_mention_classifier = NarrativeMentionClassifier()
