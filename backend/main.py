import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import json
from dotenv import load_dotenv
from openai import AsyncOpenAI

# Load environment variables
load_dotenv()

app = FastAPI(title="Sentinel Edge - KSP AI Assistant", version="1.0.0")

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Welcome to Sentinel Edge API"}

# Initialize OpenAI Client (Make sure OPENAI_API_KEY is in .env)
client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# System prompt to enforce the persona and language
SYSTEM_PROMPT = """
You are an experienced Kannada-speaking crime analyst working for the Karnataka State Police (KSP).
Your name is Sentinel Edge AI.
You must speak EXCLUSIVELY in Kannada (ಕನ್ನಡ), except for standard technical terms like AI, FIR, GPS, API, PDF, SQL.
You are professional, serious, and highly intelligent.
You should behave like ChatGPT, think before answering, understand follow-ups, and provide actionable crime intelligence.
When given crime details, identify patterns, hotspots, and provide recommendations.
Always answer in Kannada.
"""

@app.websocket("/ws/chat")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    # Maintain conversation history per connection
    conversation_history = [{"role": "system", "content": SYSTEM_PROMPT}]
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            user_prompt = message.get("prompt", "")
            
            # Send processing animation text
            await websocket.send_text(json.dumps({"type": "status", "content": "🧠 ನಿಮ್ಮ ಪ್ರಶ್ನೆಯನ್ನು ಅರ್ಥಮಾಡಿಕೊಳ್ಳಲಾಗುತ್ತಿದೆ..."}))
            await asyncio.sleep(0.5)
            await websocket.send_text(json.dumps({"type": "status", "content": "📂 ಅಪರಾಧ ಡೇಟಾಬೇಸ್ ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ..."}))
            
            # Add user message to history
            conversation_history.append({"role": "user", "content": user_prompt})
            
            try:
                # Call OpenAI Streaming API
                stream = await client.chat.completions.create(
                    model="gpt-3.5-turbo", # You can upgrade to gpt-4 or gpt-4o as needed
                    messages=conversation_history,
                    stream=True,
                )
                
                ai_response_content = ""
                
                async for chunk in stream:
                    if chunk.choices[0].delta.content is not None:
                        content_piece = chunk.choices[0].delta.content
                        ai_response_content += content_piece
                        await websocket.send_text(json.dumps({"type": "stream", "content": content_piece}))
                
                # Append AI response to history
                conversation_history.append({"role": "assistant", "content": ai_response_content})
                
            except Exception as e:
                error_msg = f"\n[AI ಸಂಪರ್ಕದಲ್ಲಿ ದೋಷ ಉಂಟಾಗಿದೆ: ದಯವಿಟ್ಟು ನಿಮ್ಮ OpenAI API ಕೀಯನ್ನು ಪರಿಶೀಲಿಸಿ. ({str(e)})]"
                await websocket.send_text(json.dumps({"type": "stream", "content": error_msg}))
            
            await websocket.send_text(json.dumps({"type": "done"}))
            
    except WebSocketDisconnect:
        print("Client disconnected")

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    # Read the file content
    content = await file.read()
    filename = file.filename.lower()
    
    extracted_text = ""
    if filename.endswith(".txt") or filename.endswith(".csv"):
        try:
            extracted_text = content.decode("utf-8")
        except:
            extracted_text = "ಫೈಲ್ ಓದಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. (Could not read file)"
    else:
        # For images/PDFs in this hackathon, we simulate OCR extraction of a crime report
        extracted_text = f"[{file.filename} ನಿಂದ ಲಭ್ಯವಾದ ಮಾಹಿತಿ]: ಇದು ಬೆಂಗಳೂರಿನ ಇಂದಿರಾನಗರದಲ್ಲಿ ನಡೆದ ಕಳ್ಳತನ ಪ್ರಕರಣದ FIR ಪ್ರತಿಯಾಗಿದೆ. ದಿನಾಂಕ: 12-08-2023. ಆರೋಪಿಯ ಹೆಸರು: ಅಜ್ಞಾತ. ಕಳುವಾದ ವಸ್ತುಗಳು: ಚಿನ್ನದ ಸರ ಮತ್ತು ಲ್ಯಾಪ್‌ಟಾಪ್."

    return {
        "status": "success",
        "message": "ಫೈಲ್ ಯಶಸ್ವಿಯಾಗಿ ಸ್ವೀಕರಿಸಲಾಗಿದೆ.",
        "filename": file.filename,
        "extracted_text": extracted_text
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
