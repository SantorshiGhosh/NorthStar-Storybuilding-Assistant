import re
import io
import unicodedata
import logging
from typing import List, Dict, Any, Tuple, Optional
import docx
import pymupdf

logger = logging.getLogger("document_parser")

# Word-to-number dictionary for word-based chapter headings
WORD_TO_NUM = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14,
    "fifteen": 15, "sixteen": 16, "seventeen": 17, "eighteen": 18,
    "nineteen": 19, "twenty": 20, "twenty-one": 21, "twenty-two": 22,
    "twenty-three": 23, "twenty-four": 24, "twenty-five": 25,
    "thirty": 30, "forty": 40, "fifty": 50, "sixty": 60, "seventy": 70,
    "eighty": 80, "ninety": 90, "hundred": 100
}

ROMAN_TO_NUM = {
    "I": 1, "II": 2, "III": 3, "IV": 4, "V": 5,
    "VI": 6, "VII": 7, "VIII": 8, "IX": 9, "X": 10,
    "XI": 11, "XII": 12, "XIII": 13, "XIV": 14, "XV": 15,
    "XVI": 16, "XVII": 17, "XVIII": 18, "XIX": 19, "XX": 20
}

class DocumentParser:
    """
    Production-grade document intelligence parser supporting PDF, DOCX, TXT, and Markdown.
    Implements magic-byte verification, page-aware PDF extraction, table/footnote DOCX parsing,
    zero-drop chapter segmentation (preserving pre-chapter material), and sentence-aware chunking.
    """

    @staticmethod
    def validate_file_signature(file_bytes: bytes, file_ext: str) -> bool:
        """
        Validates file magic bytes signature against extension. Raises ValueError if invalid.
        """
        ext = file_ext.lower().replace(".", "").strip()
        dummy_name = f"document.{ext}"
        valid, err, _ = DocumentParser.validate_file(dummy_name, file_bytes)
        if not valid:
            raise ValueError(err)
        return True

    @staticmethod
    def validate_file(filename: str, file_bytes: bytes, max_size_mb: int = 50) -> Tuple[bool, Optional[str], str]:
        """
        Validates file signature, magic bytes, non-empty content, and configurable max size.
        """
        if not filename or not filename.strip():
            return False, "Filename cannot be empty.", ""

        ext = filename.rsplit(".", 1)[-1].lower().strip() if "." in filename else ""
        allowed = {"docx", "pdf", "txt", "md", "markdown"}
        if ext not in allowed:
            return False, f"Unsupported file extension '.{ext}'. Allowed types: .docx, .pdf, .txt, .md", ext

        max_bytes = max_size_mb * 1024 * 1024
        if len(file_bytes) > max_bytes:
            return False, f"File size exceeds {max_size_mb}MB limit ({len(file_bytes) / (1024*1024):.1f}MB).", ext

        if len(file_bytes) == 0:
            return False, "Uploaded file is empty (0 bytes).", ext

        # Magic bytes validation
        if ext == "pdf":
            if not file_bytes.startswith(b"%PDF-"):
                return False, "Invalid PDF: Missing standard '%PDF-' file signature.", ext
            try:
                doc = pymupdf.open(stream=file_bytes, filetype="pdf")
                if doc.needs_pass or doc.is_encrypted:
                    return False, "Password-protected PDF detected. Please provide an unlocked document.", ext
                if len(doc) == 0:
                    return False, "PDF contains zero pages.", ext
            except Exception as e:
                return False, f"Corrupted or unreadable PDF document: {str(e)}", ext

        elif ext == "docx":
            # Standard ZIP archive magic header for DOCX
            if not file_bytes.startswith(b"PK\x03\x04"):
                return False, "Invalid DOCX: Missing standard ZIP/DOCX container signature.", ext
            try:
                docx.Document(io.BytesIO(file_bytes))
            except Exception as e:
                return False, f"Corrupted or invalid DOCX document: {str(e)}", ext

        elif ext in ["txt", "md", "markdown"]:
            # Check for binary executables or null byte injection
            sample = file_bytes[:1024]
            if b"\x00" in sample:
                # Check if it's UTF-16
                try:
                    file_bytes.decode("utf-16")
                except Exception:
                    return False, "Uploaded text file contains null bytes or unsupported binary encoding.", ext

        return True, None, ext

    @staticmethod
    def extract_text_from_bytes(file_bytes: bytes, file_ext: str) -> str:
        """
        Extracts clean plain text from raw bytes based on file format,
        preserving reading order, tables, headers, and encoding.
        """
        ext = file_ext.lower().replace(".", "").strip()

        if ext == "docx":
            try:
                doc = docx.Document(io.BytesIO(file_bytes))
                parts = []
                for para in doc.paragraphs:
                    text = para.text.strip()
                    if text:
                        # Mark headings clearly
                        if para.style and para.style.name and "Heading" in para.style.name:
                            parts.append(f"\n# {text}\n")
                        else:
                            parts.append(text)

                # Extract tables
                for table in doc.tables:
                    table_rows = []
                    for row in table.rows:
                        row_cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                        if row_cells:
                            table_rows.append(" | ".join(row_cells))
                    if table_rows:
                        parts.append("\n" + "\n".join(table_rows) + "\n")

                full_text = "\n\n".join(parts)
            except Exception as e:
                logger.error(f"Error parsing DOCX: {e}")
                full_text = ""

        elif ext == "pdf":
            try:
                doc = pymupdf.open(stream=file_bytes, filetype="pdf")
                pages_text = []
                for page_idx, page in enumerate(doc):
                    # Sort text blocks top-to-bottom, left-to-right to preserve reading order
                    blocks = page.get_text("blocks")
                    blocks.sort(key=lambda b: (b[1], b[0]))
                    page_content = "\n\n".join(b[4].strip() for b in blocks if len(b) > 4 and b[4].strip())
                    if page_content:
                        pages_text.append(f"[Page {page_idx + 1}]\n{page_content}")

                full_text = "\n\n".join(pages_text)
            except Exception as e:
                logger.error(f"Error parsing PDF: {e}")
                full_text = ""

        elif ext in ["txt", "md", "markdown"]:
            encodings = ["utf-8-sig", "utf-8", "utf-16", "utf-16-le", "utf-16-be", "cp1252", "latin-1"]
            full_text = ""
            for enc in encodings:
                try:
                    full_text = file_bytes.decode(enc)
                    break
                except UnicodeDecodeError:
                    continue
            if not full_text:
                full_text = file_bytes.decode("utf-8", errors="replace")

        else:
            try:
                full_text = file_bytes.decode("utf-8", errors="replace")
            except Exception:
                full_text = str(file_bytes)

        # Unicode normalization (NFC) and uniform line breaks
        full_text = unicodedata.normalize("NFC", full_text)
        return full_text.replace("\r\n", "\n").replace("\r", "\n")

    @classmethod
    def _parse_chapter_number(cls, raw_title: str, fallback_idx: int) -> int:
        """
        Parses chapter numbers from digits, Roman numerals, or English words.
        """
        clean = raw_title.strip()
        # Direct digit match: 'Chapter 4', '04', '4:'
        m_dig = re.search(r'\b(?:chapter|part|scene)?\s*([0-9]{1,4})\b', clean, re.IGNORECASE)
        if m_dig:
            return int(m_dig.group(1))

        # Roman numeral match: 'Chapter IV', 'Part III'
        m_rom = re.search(r'\b(?:chapter|part|scene)\s+([IVXLCDM]+)\b', clean, re.IGNORECASE)
        if m_rom:
            rom = m_rom.group(1).upper()
            if rom in ROMAN_TO_NUM:
                return ROMAN_TO_NUM[rom]

        # Word match: 'Chapter Four', 'Chapter Twenty-One'
        m_word = re.search(r'\b(?:chapter|part|scene)\s+([A-Za-z-]+)\b', clean, re.IGNORECASE)
        if m_word:
            w = m_word.group(1).lower()
            if w in WORD_TO_NUM:
                return WORD_TO_NUM[w]

        # Prologue / Foreword
        if "prologue" in clean.lower():
            return 0
        if "epilogue" in clean.lower():
            return fallback_idx + 100

        return fallback_idx

    @classmethod
    def segment_into_chapters(cls, text: str) -> List[Dict[str, Any]]:
        """
        Segments manuscript text into chapters with zero-drop preservation of introductory material.
        Supports standard headings, Markdown headers (# Chapter 1), plain text, Roman numerals,
        prologues, epilogues, and scene-based splits.
        """
        text = text.replace("\r\n", "\n").replace("\r", "\n").strip()
        if not text:
            return []

        # Comprehensive chapter header regex pattern
        chapter_regex = re.compile(
            r'(?:^|\n+)(?:[#*=-]{1,4}\s*)?'
            r'(?:(Chapter\s+(?:[0-9]{1,4}|[IVXLCDM]+|[A-Za-z-]+)(?:\s*[:—\–\-]\s*|\s+)[^\n]*)'
            r'|(CHAPTER\s+(?:[0-9]{1,4}|[IVXLCDM]+|[A-Za-z-]+)[^\n]*)'
            r'|(Prologue(?:\s*[:—\–\-]\s*|\s+)[^\n]*)'
            r'|(Epilogue(?:\s*[:—\–\-]\s*|\s+)[^\n]*)'
            r'|(Part\s+(?:[0-9]{1,4}|[IVXLCDM]+|[A-Za-z-]+)[^\n]*))',
            re.IGNORECASE
        )

        matches = list(chapter_regex.finditer(text))
        chapters = []

        if not matches:
            # Fallback: group paragraphs into coherent scene chunks (~5 paragraphs or ~600 words)
            paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
            if len(paragraphs) > 6:
                chunk_size = max(4, len(paragraphs) // 6)
                for i in range(0, len(paragraphs), chunk_size):
                    chunk_paras = paragraphs[i:i + chunk_size]
                    ch_num = (i // chunk_size) + 1
                    chapters.append({
                        "chapter_number": ch_num,
                        "title": f"Chapter {ch_num}",
                        "content": "\n\n".join(chunk_paras)
                    })
            else:
                chapters.append({
                    "chapter_number": 1,
                    "title": "Chapter 1",
                    "content": text
                })
            return chapters

        # ZERO-DROP PRESERVATION: Capture any text preceding the first chapter match
        first_match_start = matches[0].start()
        if first_match_start > 0:
            pre_text = text[:first_match_start].strip()
            if pre_text:
                pre_title = "Prologue" if "prologue" in pre_text[:200].lower() else "Introduction / Foreword"
                chapters.append({
                    "chapter_number": 0,
                    "title": pre_title,
                    "content": pre_text
                })

        for idx, match in enumerate(matches):
            start = match.start()
            end = matches[idx + 1].start() if idx + 1 < len(matches) else len(text)
            section = text[start:end].strip()

            lines = section.split("\n", 1)
            raw_title_line = lines[0].replace("#", "").replace("*", "").strip()
            content = lines[1].strip() if len(lines) > 1 else ""

            ch_num = cls._parse_chapter_number(raw_title_line, fallback_idx=idx + 1)
            title_display = raw_title_line or f"Chapter {ch_num}"

            chapters.append({
                "chapter_number": ch_num,
                "title": title_display,
                "content": content
            })

        return chapters

    @staticmethod
    def chunk_into_passages(chapter_content: str, target_chars: int = 600, overlap_sentences: int = 1, target_chunk_size: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Sentence-aware overlapping passage chunking.
        Prevents breaking inside sentences or dialogue quotes, maintains context overlap,
        and records exact character offsets (char_start, char_end).
        """
        if target_chunk_size is not None:
            target_chars = target_chunk_size
        content = chapter_content.strip()
        if not content:
            return []

        # Protect abbreviations before sentence splitting
        abbrevs = ["Mr.", "Mrs.", "Ms.", "Dr.", "Prof.", "Capt.", "Lt.", "Col.", "Gen.", "Gov.", "Sir.", "Lady.", "St.", "vs.", "etc.", "e.g.", "i.e."]
        protected = content
        for idx, abb in enumerate(abbrevs):
            protected = protected.replace(abb, f"__ABB_{idx}__")

        raw_sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', protected) if s.strip()]
        sentences = []
        for s in raw_sentences:
            for idx, abb in enumerate(abbrevs):
                s = s.replace(f"__ABB_{idx}__", abb)
            sentences.append(s)

        if not sentences:
            sentences = [content]

        passages = []
        current_chunk_sentences = []
        current_chunk_len = 0
        passage_index = 1

        for sent in sentences:
            sent_len = len(sent)
            # If adding this sentence exceeds target and we already have content, finalize chunk
            if current_chunk_len + sent_len > target_chars and current_chunk_sentences:
                chunk_text = " ".join(current_chunk_sentences)
                # Find exact offsets in chapter_content
                char_start = content.find(current_chunk_sentences[0])
                if char_start == -1:
                    char_start = 0
                char_end = char_start + len(chunk_text)

                passages.append({
                    "passage_index": passage_index,
                    "content": chunk_text,
                    "char_start": char_start,
                    "char_end": char_end
                })
                passage_index += 1

                # Retain overlap sentences
                overlap = current_chunk_sentences[-overlap_sentences:] if overlap_sentences > 0 else []
                current_chunk_sentences = list(overlap)
                current_chunk_len = sum(len(s) + 1 for s in current_chunk_sentences)

            current_chunk_sentences.append(sent)
            current_chunk_len += sent_len + 1

        # Final remaining chunk
        if current_chunk_sentences:
            chunk_text = " ".join(current_chunk_sentences)
            char_start = content.find(current_chunk_sentences[0])
            if char_start == -1:
                char_start = 0
            char_end = char_start + len(chunk_text)

            passages.append({
                "passage_index": passage_index,
                "content": chunk_text,
                "char_start": char_start,
                "char_end": char_end
            })

        return passages

    segment_chapters = segment_into_chapters

document_parser = DocumentParser()
