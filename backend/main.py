from flask import Flask, jsonify, request
from flask_cors import CORS
import sys
import pyperclip
from datetime import datetime
import requests
from youtube_transcript_api import YouTubeTranscriptApi
import subprocess
import json

print("fifi")


#garbage for later
#              {item.description && <div>{item.description}</div>}


#constants

APIK = "YOUTUBE_API_KEY_HERE"
APIOPRTR="OPEN_ROUTER_API_KEY"
conversation_history = []
Transcript = ""  # Global variable to store current video transcript

# Model fallback tries each model in order until one works
# Add or remove models as needed - they will be tried from top to bottom
AI_MODELS = [
    "google/gemini-2.0-flash-exp:free",
    "qwen/qwen3-coder:free",
    "z-ai/glm-4.5-air:free",
    "deepseek/deepseek-chat-v3.1:free",
    "meituan/longcat-flash-chat:free"
]

# Track the currently working model
CURRENT_WORKING_MODEL = None

def call_openrouter_with_fallback(messages, context_name="API"):
    """
    Try each model in AI_MODELS list until one succeeds.
    Prioritizes the currently working model first, then tries others if it fails.
    Returns the AI response text or raises an exception if all fail.
    """
    global CURRENT_WORKING_MODEL
    
    openrouter_url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {APIOPRTR}",
        "HTTP-Referer": "http://localhost",
        "Content-Type": "application/json"
    }
    
    last_error = None
    
    # Create a list of models to try
    # If we have a working model, try it first
    models_to_try = []
    if CURRENT_WORKING_MODEL and CURRENT_WORKING_MODEL in AI_MODELS:
        models_to_try.append(CURRENT_WORKING_MODEL)
        # Add other models (excluding the one we just added)
        models_to_try.extend([m for m in AI_MODELS if m != CURRENT_WORKING_MODEL])
    else:
        models_to_try = AI_MODELS.copy()
    
    for model in models_to_try:
        try:
            # Show if this is the preferred model
            model_status = "✓ (currently working)" if model == CURRENT_WORKING_MODEL else "(trying)"
            print(f"🔄 [{context_name}] Trying model: {model} {model_status}", flush=True)
            
            payload = {
                "model": model,
                "messages": messages
            }
            
            resp = requests.post(openrouter_url, headers=headers, json=payload, timeout=30)
            
            # Check for rate limit
            if resp.status_code == 429:
                print(f"⚠️ [{context_name}] Model {model} is rate limited, trying next...", flush=True)
                # If this was our working model, clear it so we try others
                if model == CURRENT_WORKING_MODEL:
                    print(f"💡 [{context_name}] Clearing {model} as working model due to rate limit", flush=True)
                    CURRENT_WORKING_MODEL = None
                last_error = f"Rate limited: {model}"
                continue
            
            # Check for other errors
            if not resp.ok:
                print(f"⚠️ [{context_name}] Model {model} returned {resp.status_code}, trying next...", flush=True)
                # If this was our working model, clear it
                if model == CURRENT_WORKING_MODEL:
                    print(f"💡 [{context_name}] Clearing {model} as working model due to error", flush=True)
                    CURRENT_WORKING_MODEL = None
                last_error = f"HTTP {resp.status_code}: {model}"
                continue
            
            # Success! Flag this model as working
            response_data = resp.json()
            ai_text = response_data["choices"][0]["message"]["content"]
            
            # Update the working model if it's different
            if model != CURRENT_WORKING_MODEL:
                print(f"✅ [{context_name}] Model {model} works! Flagging as preferred model.", flush=True)
                CURRENT_WORKING_MODEL = model
            else:
                print(f"✅ [{context_name}] Successfully used model: {model}", flush=True)
            
            return ai_text
            
        except requests.exceptions.Timeout:
            print(f"⏱️ [{context_name}] Model {model} timed out, trying next...", flush=True)
            # If this was our working model, clear it
            if model == CURRENT_WORKING_MODEL:
                CURRENT_WORKING_MODEL = None
            last_error = f"Timeout: {model}"
            continue
        except Exception as e:
            print(f"❌ [{context_name}] Model {model} error: {str(e)}, trying next...", flush=True)
            # If this was our working model, clear it
            if model == CURRENT_WORKING_MODEL:
                CURRENT_WORKING_MODEL = None
            last_error = f"Error: {model} - {str(e)}"
            continue
    
    # All models failed
    error_msg = f"All models failed. Last error: {last_error}"
    print(f"💥 [{context_name}] {error_msg}", flush=True)
    raise Exception(error_msg)

app = Flask(__name__)
CORS(app)
# if retrieved info from frontend
@app.route("/api/youtube/search", methods=["GET", "POST"], strict_slashes=False)
def youtube_search():
    data = request.json
    query = data.get("query", "")
    parse_this = requests.get(f"https://youtube.googleapis.com/youtube/v3/search?part=snippet&q={query}&key={APIK}")
    if parse_this.status_code == 200:
        yt_data = parse_this.json()
        results = []
        for item in yt_data.get("items", []):
            snippet = item.get("snippet", {})
            results.append({
                "high": snippet.get("thumbnails", {}).get("high", {}).get("url", ""),
                "title": snippet.get("title", ""),
                "description": snippet.get("description", ""),
                "videoId": item.get("id", {}).get("videoId", ""),
            })
        return jsonify({"results": results})
        
    
    else:
        return jsonify({"error": "Failed to fetch data from YouTube API"}), 500








@app.route('/', methods=['GET'])
def health_check():
    return jsonify({"status": "LearnIT backend is running!", "timestamp": datetime.now().isoformat()})

#python youtube video stream handler
@app.route('/api/youtube/stream', methods=['POST'], strict_slashes=False)
def get_video_stream():
    """Get direct video stream URL using yt-dlp"""
    data = request.json
    video_id = data.get("videoId", "")
    
    if not video_id:
        return jsonify({"error": "No video ID provided"}), 400
    
    try:
        # Get the path to yt-dlp in different environments
        import sys
        import os
        
        ytdlp_cmd = None
        
        # Check if running as PyInstaller bundle
        if getattr(sys, 'frozen', False):
            # Running as compiled executable - check bundle directory
            bundle_dir = os.path.dirname(sys.executable)
            bundled_ytdlp = os.path.join(bundle_dir, 'yt-dlp')
            if os.path.exists(bundled_ytdlp):
                ytdlp_cmd = bundled_ytdlp
                print(f"Using bundled yt-dlp: {ytdlp_cmd}")
        
        # If not found in bundle, try virtual environment
        if not ytdlp_cmd:
            venv_ytdlp = os.path.join(os.path.dirname(sys.executable), 'yt-dlp')
            if os.path.exists(venv_ytdlp):
                ytdlp_cmd = venv_ytdlp
                print(f"Using venv yt-dlp: {ytdlp_cmd}")
        
        # Fall back to system yt-dlp
        if not ytdlp_cmd:
            ytdlp_cmd = 'yt-dlp'
            print("Using system yt-dlp")
        
        # Get both video URL and format info
        cmd = [
            ytdlp_cmd,
            '-f', 'best[ext=mp4]/best',  # Get best mp4 or any best format
            '-g',  # Get URL only
            '--no-check-certificate',  # Skip SSL verification
            f'https://www.youtube.com/watch?v={video_id}'
        ]
        
        print(f"Running command: {' '.join(cmd)}", flush=True)  # Debug logging
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
        
        print(f"yt-dlp stdout: {result.stdout}", flush=True)  # Debug logging
        print(f"yt-dlp stderr: {result.stderr}", flush=True)  # Debug logging
        
        # Try to fetch transcript but don't fail if it's not available
        global Transcript
        try:
            print(f"Attempting to fetch transcript for video ID: {video_id}", flush=True)
            ytt_api = YouTubeTranscriptApi()
            transcript_list = ytt_api.fetch(video_id)
            #transcript_text = " ".join([entry['text'] for entry in transcript_list])
            Transcript = transcript_list
            print(f"✓ Transcript fetched successfully! Length: {len(Transcript)} characters", flush=True)
            print(f"First 200 chars: {Transcript[:200]}...", flush=True)
        except Exception as e:
            print(f"✗ Could not fetch transcript: {str(e)}", flush=True)
            Transcript = ""  # Set to empty if transcript not available
        
        if result.returncode == 0 and result.stdout.strip():
            stream_url = result.stdout.strip().split('\n')[0]  # Get first URL
            print(f"Stream URL: {stream_url}", flush=True) 

            return jsonify({
                "streamUrl": stream_url, 
                "videoId": video_id,
                "embedUrl": f"https://www.youtube.com/embed/{video_id}"
            })
        else:
            error_msg = result.stderr or "Unknown error"
            print(f"yt-dlp error: {error_msg}")  # Debug logging
            return jsonify({"error": f"yt-dlp failed: {error_msg}"}), 500
            
    except subprocess.TimeoutExpired:
        return jsonify({"error": "Request timeout - video extraction took too long"}), 504
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Exception in get_video_stream: {str(e)}")
        print(f"Traceback: {error_trace}")
        return jsonify({"error": str(e)}), 500








# Quiz generation endpoints
quiz_history = []  # Store user's quiz answers for personalization

@app.route('/api/quiz/generate', methods=['POST'], strict_slashes=False)
def generate_quiz():
    """Generate multiple choice questions from the video transcript"""
    global Transcript
    
    if not Transcript:
        return jsonify({"error": "No video transcript available. Please load a video first."}), 400
    
    try:
        data = request.json
        timestamp = data.get('timestamp', 'N/A')
        
        prompt = f"""Based on the following video transcript, generate 5 multiple choice questions to test understanding.

Current Video Timestamp: {timestamp}

Video Transcript:
{Transcript[:3000]}

IMPORTANT: Respond ONLY with valid JSON in this exact format (no markdown, no extra text):
{{
  "questions": [
    {{
      "question": "What is the main topic discussed?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": 0,
      "explanation": "Brief explanation of why this is correct"
    }}
  ]
}}

Generate 5 questions covering key concepts from the video. Focus on content covered up to the current timestamp ({timestamp}). Make sure the JSON is valid."""

        messages = [
            {"role": "system", "content": "You are a quiz generator. Respond ONLY with valid JSON, no markdown formatting."},
            {"role": "user", "content": prompt}
        ]
        
        # Use fallback function
        ai_response = call_openrouter_with_fallback(messages, context_name="Quiz Generation")
        
        # Clean up response - remove markdown code blocks if present
        ai_response = ai_response.strip()
        if ai_response.startswith("```json"):
            ai_response = ai_response[7:]
        if ai_response.startswith("```"):
            ai_response = ai_response[3:]
        if ai_response.endswith("```"):
            ai_response = ai_response[:-3]
        ai_response = ai_response.strip()
        
        # Parse JSON response
        quiz_data = json.loads(ai_response)
        
        return jsonify(quiz_data)
        
    except json.JSONDecodeError as e:
        print(f"JSON parse error: {str(e)}")
        print(f"AI response was: {ai_response}")
        return jsonify({"error": "Failed to parse quiz data"}), 500
    except Exception as e:
        print(f"Quiz generation error: {str(e)}")
        return jsonify({"error": f"Failed to generate quiz: {str(e)}"}), 500


@app.route('/api/quiz/personalized', methods=['POST'], strict_slashes=False)
def generate_personalized_quiz():
    """Generate personalized quiz based on previous answers"""
    global Transcript, quiz_history
    
    if not Transcript:
        return jsonify({"error": "No video transcript available. Please load a video first."}), 400
    
    data = request.json
    previous_answers = data.get('previousAnswers', [])
    timestamp = data.get('timestamp', 'N/A')
    
    # Add to quiz history
    quiz_history.extend(previous_answers)
    
    try:
        openrouter_url = "https://openrouter.ai/api/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {APIOPRTR}",
            "HTTP-Referer": "http://localhost",
            "Content-Type": "application/json"
        }
        
        # Build context from previous answers
        weak_areas = []
        strong_areas = []
        for answer in previous_answers:
            if not answer.get('correct', True):
                weak_areas.append(answer.get('topic', ''))
            else:
                strong_areas.append(answer.get('topic', ''))
        
        personalization_context = ""
        if weak_areas:
            personalization_context = f"\n\nThe student struggled with: {', '.join(weak_areas)}. Focus more questions on these areas to help them improve."
        
        prompt = f"""Based on the following video transcript, generate 5 personalized multiple choice questions.

Current Video Timestamp: {timestamp}

Video Transcript:
{Transcript[:3000]}
{personalization_context}

Generate challenging questions that help the student master the material. If they struggled with certain topics, create questions to reinforce those concepts. Focus on content covered up to the current timestamp ({timestamp}).

IMPORTANT: Respond ONLY with valid JSON in this exact format (no markdown, no extra text):
{{
  "questions": [
    {{
      "question": "What is the main topic discussed?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": 0,
      "explanation": "Brief explanation of why this is correct"
    }}
  ]
}}

Generate 5 questions. Make sure the JSON is valid."""

        messages = [
            {"role": "system", "content": "You are a quiz generator. Respond ONLY with valid JSON, no markdown formatting."},
            {"role": "user", "content": prompt}
        ]
        
        # Use fallback function
        ai_response = call_openrouter_with_fallback(messages, context_name="Personalized Quiz")
        
        # Clean up response
        ai_response = ai_response.strip()
        if ai_response.startswith("```json"):
            ai_response = ai_response[7:]
        if ai_response.startswith("```"):
            ai_response = ai_response[3:]
        if ai_response.endswith("```"):
            ai_response = ai_response[:-3]
        ai_response = ai_response.strip()
        
        # Parse JSON response
        quiz_data = json.loads(ai_response)
        
        return jsonify(quiz_data)
        
    except json.JSONDecodeError as e:
        print(f"JSON parse error: {str(e)}")
        print(f"AI response was: {ai_response}")
        return jsonify({"error": "Failed to parse quiz data"}), 500
    except Exception as e:
        print(f"Personalized quiz error: {str(e)}")
        return jsonify({"error": f"Failed to generate quiz: {str(e)}"}), 500


@app.route('/api/video/summary', methods=['POST'], strict_slashes=False)
def generate_video_summary():
    """Generate a summary and key terms when video starts"""
    global Transcript
    
    print(f"📝 Summary request received. Transcript type: {type(Transcript)}, Length: {len(Transcript) if Transcript else 0}", flush=True)
    
    if not Transcript:
        print("⚠️ No transcript available!", flush=True)
        return jsonify({"error": "No video transcript available."}), 400
    
    try:
        # Convert transcript list to string if needed
        if isinstance(Transcript, list):
            print(f"Converting transcript list with {len(Transcript)} entries to string...", flush=True)
            transcript_text = " ".join([entry.get('text', '') if isinstance(entry, dict) else str(entry) for entry in Transcript])
            print(f"✓ Transcript converted. Text length: {len(transcript_text)} characters", flush=True)
        else:
            transcript_text = str(Transcript)
            print(f"Transcript is already a string: {len(transcript_text)} characters", flush=True)
        
        if not transcript_text or len(transcript_text) < 50:
            print(f"⚠️ Transcript too short: {transcript_text[:100]}", flush=True)
            return jsonify({"error": "Transcript is too short or empty"}), 400
        
        prompt = f"""Based on the following video transcript, provide a comprehensive learning guide with the following structure:

1. **Overview** (2-3 sentences): Brief summary starting with "This video covers..."

2. **Key Terms & Concepts**: List 5-8 main topics/concepts covered

3. **Deep Dive**: This should be a DETAILED, PRACTICAL breakdown including:
   
   **What You'll Learn:**
   - Step-by-step list of specific skills/concepts taught
   - Prerequisites (if any)
   - Learning objectives
   
   **Topics Covered in Detail:**
   For EACH major topic mentioned in the video, provide:
   - Clear explanation of what it is
   - Why it's important/useful
   - Syntax or structure (if applicable)
   - A simple code example or use case (if it's a programming/technical topic)
   - Common mistakes or tips
   
   **Practical Examples:**
   - If it's a tutorial: Show actual syntax, commands, or code patterns discussed
   - If it's a concept: Provide real-world analogies or applications
   - Include any specific tools, libraries, or methods mentioned
   
   **Key Takeaways:**
   - Main points to remember
   - Next steps for learners

Video Transcript:
{transcript_text[:6000]}

Make the Deep Dive section ACTIONABLE and SPECIFIC. If the video teaches programming concepts (loops, functions, data types, etc.), show the syntax and explain it. If it's about tools, list them with their purposes. Make it feel like a complete study guide, not just a summary."""

        messages = [
            {"role": "system", "content": "You are a helpful AI assistant that creates clear, concise video summaries and identifies key learning concepts."},
            {"role": "user", "content": prompt}
        ]
        
        # Use fallback function
        summary_text = call_openrouter_with_fallback(messages, context_name="Video Summary")
        
        print(f"✓ Video summary generated successfully! Preview: {summary_text[:150]}...", flush=True)
        
        return jsonify({
            "summary": summary_text
        })
        
    except Exception as e:
        print(f"❌ Summary generation error: {str(e)}", flush=True)
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Failed to generate summary: {str(e)}"}), 500


@app.route('/api/AIP', methods=['POST'], strict_slashes=False)
def chat():
    global conversation_history, Transcript
    
    user_message = request.json.get('message')
    
    if not user_message:
        return jsonify({"error": "No message provided"}), 400

    print(f"💬 Chat request received. Message: {user_message[:100]}...", flush=True)
    print(f"📝 Current Transcript length: {len(Transcript)} characters", flush=True)
    if Transcript:
        print(f"📝 Transcript preview: {Transcript[:200]}...", flush=True)
    else:
        print("⚠️ WARNING: No transcript available!", flush=True)

    # Append the new user message to conversation history
    conversation_history.append({"role": "user", "content": user_message})
    
    openrouter_url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {APIOPRTR}",
        "HTTP-Referer": "http://localhost",
        "Content-Type": "application/json"
    }
    
    # Build messages array with system prompt, transcript, and conversation history
    messages = [
        {"role":"system", "content": """You are LearnIT, a friendly AI tutor helping students learn from educational videos. 

Your style:
- Be conversational and warm, like a helpful study buddy
- Use simple, everyday language instead of overly formal or technical terms
- Break down complex topics into easy-to-understand explanations
- Use analogies and examples when helpful
- Keep responses concise but thorough (2-4 short paragraphs max)
- Use natural formatting: short paragraphs, occasional bullet points only when listing 3+ items

What you have access to:
- Full transcript of the video the student is watching
- Timestamps in the student's questions (format: [Timestamp MM:SS])

How to respond:
- When given a timestamp, reference what's happening at that specific point in the video
- Explain concepts as if you're having a conversation, not writing a textbook
- If the student asks "what's happening now" or similar, describe that section of the video clearly
- Use "the instructor" or "the speaker" instead of passive voice
- Avoid excessive markdown formatting - write naturally
- Don't number everything unless it's truly a step-by-step process

Remember: You're helping them understand the video better, not replacing it. Be helpful, clear, and friendly!"""},
    ]
    
    # Add transcript if available
    if Transcript:
        messages.append({"role": "user", "content": f"Video Transcript: {Transcript}"})
    
    # Add all conversation history to maintain context
    messages.extend(conversation_history)
    
    try:
        # Use fallback function
        ai_reply = call_openrouter_with_fallback(messages, context_name="Chat")
        
        # Append AI response to conversation history
        conversation_history.append({"role": "assistant", "content": ai_reply})
        
        return jsonify({"reply": ai_reply})
    except Exception as e:
        print(f"OpenRouter API error: {str(e)}")
        return jsonify({"error": f"AI service error: {str(e)}"}), 500









if __name__ == '__main__':
    # Determine the port from command-line arguments passed by Electron
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5001
    print(f"LearnIT backend port: {port}...")
    app.run(port=port, debug=False)
                    



                    ##notes 
                #take the items from the loaded itm clicked and save it into the file and at the start of dashboard load the itms indivually and dejsit thig yea

#                TODO a lot of stuff here
 #   add the ai thing training
  #  add the local storage of the things
   # add the transcript 
    #timestamps of the watched video
    #watchplayer 
    #question system
    #parsing ai output formatting
    #ai chat box div
    #description and summary made by ai
    #ai itself
    #css fine shi
    #make the window draggable DONE

  #    function iframeHandler() {
  #  let lessons = JSON.parse(localStorage.getItem('lessons')) || [];
   # if (lessons.length === 0) {
    #  return "https://www.youtube.com/embed/dQw4w9WgXcQ"; // Default video if no lessons
    # }
    # 
    # 
    # 
    #         