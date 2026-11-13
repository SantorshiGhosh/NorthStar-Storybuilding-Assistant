import re
import io
from typing import List, Dict, Any, Tuple
import docx
import pymupdf

class DocumentParser:
    @staticmethod
    def extract_text_from_bytes(file_bytes: bytes, file_ext: str) -> str:
        """
        Extracts clean plain text from raw bytes based on file extension.
        """
        ext = file_ext.lower().replace(".", "")
        if ext == "docx":
            doc = docx.Document(io.BytesIO(file_bytes))
            full_text = []
            for para in doc.paragraphs:
                if para.text.strip():
                    full_text.append(para.text)
            text = "\n\n".join(full_text)
        elif ext == "pdf":
            doc = pymupdf.open(stream=file_bytes, filetype="pdf")
            pages = []
            for page in doc:
                text = page.get_text()
                if text.strip():
                    pages.append(text.strip())
            text = "\n\n".join(pages)
        elif ext in ["txt", "md", "markdown"]:
            try:
                text = file_bytes.decode("utf-8")
            except UnicodeDecodeError:
                text = file_bytes.decode("latin-1", errors="ignore")
        else:
            try:
                text = file_bytes.decode("utf-8")
            except Exception:
                text = str(file_bytes)

        return text.replace("\r\n", "\n").replace("\r", "\n")

    @staticmethod
    def segment_into_chapters(text: str) -> List[Dict[str, Any]]:
        """
        Splits manuscript text into chapters preserving title, chapter number, and body.
        Handles Markdown headers (# Chapter 1), plain text (Chapter 1:, CHAPTER TWO), etc.
        """
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        # Regex patterns for chapter headers
        chapter_regex = re.compile(
            r'(?:^|\n+)(?:#+\s*)?(Chapter\s+([0-9IVXLCDM]+|[A-Za-z]+)(?:\s*[:—\–\-]\s*|\s+)([^\n]*)|CHAPTER\s+([0-9IVXLCDM]+|[A-Za-z]+)(?:\s*[:—\–\-]\s*|\s+)([^\n]*))',
            re.IGNORECASE
        )

        matches = list(chapter_regex.finditer(text))

        chapters = []
        if not matches:
            # If no chapter patterns matched, treat whole text or divide by double-line breaks
            paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
            if len(paragraphs) > 8:
                # Group every ~5 paragraphs as a scene / chapter
                chunk_size = max(4, len(paragraphs) // 4)
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
                    "content": text.strip()
                })
            return chapters

        for idx, match in enumerate(matches):
            start = match.start()
            end = matches[idx + 1].start() if idx + 1 < len(matches) else len(text)
            section = text[start:end].strip()

            lines = section.split("\n", 1)
            raw_title_line = lines[0].replace("#", "").strip()
            content = lines[1].strip() if len(lines) > 1 else ""

            # Try to extract chapter number
            num_match = re.search(r'Chapter\s+([0-9]+)', raw_title_line, re.IGNORECASE)
            if num_match:
                ch_num = int(num_match.group(1))
            else:
                ch_num = idx + 1

            chapters.append({
                "chapter_number": ch_num,
                "title": raw_title_line or f"Chapter {ch_num}",
                "content": content
            })

        return chapters

    @staticmethod
    def chunk_into_passages(chapter_content: str, max_chars: int = 500) -> List[Dict[str, Any]]:
        """
        Segments chapter content into discrete passages for fine-grained citation and vector search.
        """
        paragraphs = [p.strip() for p in chapter_content.split("\n\n") if p.strip()]
        passages = []
        current_offset = 0

        for p_idx, para in enumerate(paragraphs):
            p_len = len(para)
            passages.append({
                "passage_index": p_idx + 1,
                "content": para,
                "char_start": current_offset,
                "char_end": current_offset + p_len
            })
            current_offset += p_len + 2

        return passages

document_parser = DocumentParser()
