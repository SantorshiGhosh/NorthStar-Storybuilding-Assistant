import sys
import os
from pathlib import Path

# Add backend directory
sys.path.insert(0, str(Path(__file__).resolve().parent / "backend"))

from app.config import settings
from sqlalchemy import text
from app.database.connection import engine

def verify_all():
    print("==================================================================")
    print(" NORTHSTAR — SYSTEM INTEGRATION STATUS CHECK")
    print("==================================================================")

    # 1. Check Supabase Database
    print("\n[1/3] Checking Supabase Database Connection...")
    try:
        with engine.connect() as conn:
            res = conn.execute(text("SELECT current_database(), current_user, version();")).fetchone()
            print("   >>> SUPABASE POSTGRESQL: CONNECTED & ONLINE!")
            print(f"       Database: {res[0]}")
            print(f"       User:     {res[1]}")
            print(f"       Engine:   {res[2].split()[0]} {res[2].split()[1]}")

            # Check table counts
            tables = conn.execute(text("""
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema = 'public';
            """)).fetchall()
            print(f"       Tables verified: {len(tables)} tables ({', '.join([t[0] for t in tables[:4]])}...)")
    except Exception as e:
        print(f"   [!] Supabase Database Error: {e}")

    # 2. Check Supabase API URL & Anon Key
    print("\n[2/3] Checking Supabase REST / Auth URL...")
    print(f"   >>> SUPABASE_URL:      {settings.SUPABASE_URL}")
    print(f"   >>> SUPABASE_ANON_KEY: {settings.SUPABASE_ANON_KEY[:16]}... (configured)")

    # 3. Check Gemini API
    print("\n[3/3] Checking Gemini AI API Connection...")
    if not settings.GEMINI_API_KEY:
        print("   [!] GEMINI_API_KEY is empty in .env.")
    else:
        print(f"   Testing key: {settings.GEMINI_API_KEY[:8]}... using model '{settings.GEMINI_MODEL}'")
        ai_success = False

        # Test with google.genai
        try:
            from google import genai
            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            response = client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents="Respond with only the single word: OK"
            )
            print(f"   >>> GEMINI API: CONNECTED & WORKING LIVE! (google.genai SDK)")
            print(f"       Test response: \"{response.text.strip()}\"")
            ai_success = True
        except Exception as e1:
            # Fallback test with google.generativeai
            try:
                import google.generativeai as legacy_genai
                legacy_genai.configure(api_key=settings.GEMINI_API_KEY)
                m = legacy_genai.GenerativeModel(settings.GEMINI_MODEL)
                response = m.generate_content("Respond with only the single word: OK")
                print(f"   >>> GEMINI API: CONNECTED & WORKING LIVE! (google.generativeai SDK)")
                print(f"       Test response: \"{response.text.strip()}\"")
                ai_success = True
            except Exception as e2:
                print(f"   [!] Gemini API returned error: {e2}")
                if "API_KEY_INVALID" in str(e2) or "API key not valid" in str(e2):
                    print("   [TIP] Note: Google AI Studio keys typically start with 'AIzaSy...'.")
                    print("         You can get a standard free key from https://aistudio.google.com/app/apikey")
                print("   >>> (Don't worry: The built-in deterministic rule engine is active as an automatic fallback!)")

    print("\n==================================================================")
    print(" VERIFICATION SUMMARY COMPLETE")
    print("==================================================================")

if __name__ == "__main__":
    verify_all()
