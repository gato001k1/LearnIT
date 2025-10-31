import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import Hls from 'hls.js';
import SplitText from './components/SplitText.jsx';
import TargetCursor from './components/TargetCursor/TargetCursor.jsx';
import TiltedCard from './components/TiltedCard/TiltedCard.jsx';
import ScrambledText from './components/ScrambledText/ScrambledText.jsx';
import ScrollVelocity from './components/ScrollVelocity/ScrollVelocity.jsx';
import Squares from './components/Squares/Squares.jsx';


const isdevmodeenabled = true;

const DEFAULT_BACKEND_BASE = 'http://127.0.0.1:5001';  // Changed from 5000 to avoid AirPlay conflict

let envApiBase = undefined;
try {
  envApiBase = import.meta?.env?.VITE_API_BASE_URL;
} catch (err) {
  envApiBase = undefined;
}
//solving api issue thing 

const API_BASE = envApiBase
  || (typeof window !== 'undefined' && window.location.protocol === 'file:' ? DEFAULT_BACKEND_BASE : '');

function HomePage() {

  const navigate = useNavigate();

  useEffect(() => {
    if (localStorage.getItem('skipHome') === 'true') {
      navigate('/main');
    }
  }, [navigate]);

  function handleStartClick() {
    localStorage.setItem('skipHome', 'true');
    navigate('/main');
  }

  return (
    <div className="app-container">
      {/* Background layer - behind everything */}
      <div className="background-layer">
        <Squares 
          speed={0.2} 
          squareSize={40}
          direction='up'
          borderColor='#fff'
          hoverFillColor='#222'
        />
      </div>
      
      {/* Content layer - on top */}
      <div className="welcome-shell">
        <div className="titlebar">
  <span></span>
</div>



        <SplitText
          text="Welcome to LearnIT"
          className="welcome-headline"
          delay={100}
          duration={0.6}
          ease="power3.out"
          splitType="words,chars"
          from={{ opacity: 0, y: 36 }}
          to={{ opacity: 1, y: 0 }}
          threshold={0.1}
          rootMargin="-100px"
          textAlign="center"
          tag="h1"
        />
        <p className="welcome-note">Learn more about the topics that you like Powered by AI.</p>
        <p className="welcome-tagline">Developed by Eduardo Almeyda</p>
        <div>
          <TargetCursor spinDuration={2} hideDefaultCursor={true} />
          <button id="start-button" className="cursor-target" onClick={handleStartClick}>Start Here</button>
        </div>
      </div>
    </div>
  );
}


//VIDEO PAGE CONPONENTS
function VideoPage() {
  const navigate = useNavigate();
  const [videoId, setVideoId] = useState('');
  const [title, setTitle] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [streamUrl, setStreamUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const videoRef = React.useRef(null);
  const hlsRef = React.useRef(null);
  
  // Chat state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatMessagesEndRef = React.useRef(null);
  
  // Video summary state
  const [videoSummary, setVideoSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  
  // Quiz state
  const [quizMode, setQuizMode] = useState(false); 
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState([]); 
  const [showExplanation, setShowExplanation] = useState(false);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizComplete, setQuizComplete] = useState(false);

  useEffect(() => {
    // Load video data from localStorage
    const currentLesson = JSON.parse(localStorage.getItem('currentLesson'));
    
    if (currentLesson) {
      setVideoId(currentLesson.videoId);
      console.log("Video ID set to:", currentLesson.videoId);
      setTitle(currentLesson.title);
      
      // Load saved timestamp if exists
      const savedProgress = localStorage.getItem(`progress_${currentLesson.videoId}`);
      if (savedProgress) {
        setCurrentTime(parseInt(savedProgress));
      }
      
      // Fetch stream URL
      fetchStreamUrl(currentLesson.videoId);
    }

    return () => {
      // Clean up HLS instance
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
      // Save current time when leaving
      if (currentLesson && videoRef.current) {
        localStorage.setItem(`progress_${currentLesson.videoId}`, Math.floor(videoRef.current.currentTime).toString());
      }
    };
  }, []);

  const fetchStreamUrl = async (vid) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/api/youtube/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: vid }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setStreamUrl(data.streamUrl);
        // Delay summary to avoid rate limiting (wait 5 seconds)
        setTimeout(() => {
          fetchVideoSummary();
        }, 5000);
      } else {
        setError(data.error || 'Failed to load video');
      }
    } catch (err) {
      setError('Failed to connect to backend');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchVideoSummary = async () => {
    setSummaryLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/video/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (response.ok) {
        const data = await response.json();
        setVideoSummary(data.summary);
      } else {
        console.error('Failed to load video summary');
      }
    } catch (err) {
      console.error('Error fetching video summary:', err);
    } finally {
      setSummaryLoading(false);
    }
  };

  // Initialize HLS player when streamUrl changes
  useEffect(() => {
    if (!streamUrl || !videoRef.current) return;

    const video = videoRef.current;

    // Check if HLS is supported
    if (Hls.isSupported()) {
      // Destroy previous instance if exists
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }

      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90
      });
      
      hlsRef.current = hls;
      
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('HLS manifest parsed, starting playback');
        // Set saved time after manifest is ready
        if (currentTime > 0) {
          video.currentTime = currentTime;
        }
        video.play().catch(err => console.log('Autoplay prevented:', err));
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('HLS error:', data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log('Network error, trying to recover...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('Media error, trying to recover...');
              hls.recoverMediaError();
              break;
            default:
              console.log('Fatal error, destroying HLS instance');
              hls.destroy();
              setError('Failed to play video stream');
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // For Safari (native HLS support)
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        if (currentTime > 0) {
          video.currentTime = currentTime;
        }
      });
    } else {
      setError('HLS not supported in this browser');
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, [streamUrl, currentTime]);

  // Auto-save progress every 5 seconds
  useEffect(() => {
    if (!videoId || !videoRef.current) return;

    const interval = setInterval(() => {
      if (videoRef.current && !videoRef.current.paused) {
        const time = Math.floor(videoRef.current.currentTime);
        localStorage.setItem(`progress_${videoId}`, time.toString());
        console.log(`Progress saved: ${time} seconds`);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [videoId, streamUrl]);
  
  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Chat functions
  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;
    
    // Get current video timestamp
    const currentTimestamp = videoRef.current ? Math.floor(videoRef.current.currentTime) : 0;
    const minutes = Math.floor(currentTimestamp / 60);
    const seconds = currentTimestamp % 60;
    const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    // Add user message to chat
    const userMsg = { role: 'user', text: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/AIP`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `[Timestamp ${timeString}] ${chatInput}`
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to get response from AI');
      }
      
      const data = await response.json();
      const aiMsg = { role: 'assistant', text: data.reply };
      setChatMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      console.error('Chat error:', err);
      setChatMessages(prev => [...prev, { 
        role: 'error', 
        text: 'Failed to get response from AI. Please try again.' 
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  const clearChat = () => {
    setChatMessages([]);
  };

  // Quiz functions
  const startQuiz = async (personalized = false) => {
    setQuizLoading(true);
    setQuizMode(true);
    setQuizComplete(false);
    
    try {
      // Get current video timestamp
      const currentTimestamp = videoRef.current ? Math.floor(videoRef.current.currentTime) : 0;
      const minutes = Math.floor(currentTimestamp / 60);
      const seconds = currentTimestamp % 60;
      const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      
      const endpoint = personalized ? '/api/quiz/personalized' : '/api/quiz/generate';
      const body = personalized 
        ? JSON.stringify({ previousAnswers: quizAnswers, timestamp: timeString }) 
        : JSON.stringify({ timestamp: timeString });
      
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate quiz');
      }
      
      const data = await response.json();
      setQuizQuestions(data.questions || []);
      setCurrentQuestionIndex(0);
      setSelectedAnswer(null);
      setShowExplanation(false);
    } catch (err) {
      console.error('Quiz error:', err);
      alert('Failed to generate quiz. Please try again.');
      setQuizMode(false);
    } finally {
      setQuizLoading(false);
    }
  };

  const selectQuizAnswer = (optionIndex) => {
    if (showExplanation) return; // Can't change answer after seeing explanation
    setSelectedAnswer(optionIndex);
  };

  const submitQuizAnswer = () => {
    if (selectedAnswer === null) return;
    
    const currentQuestion = quizQuestions[currentQuestionIndex];
    const isCorrect = selectedAnswer === currentQuestion.correct;
    
    // Record the answer
    setQuizAnswers(prev => [...prev, {
      question: currentQuestion.question,
      correct: isCorrect,
      topic: currentQuestion.question.split(' ').slice(0, 5).join(' '), // First few words as topic
    }]);
    
    setShowExplanation(true);
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < quizQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    } else {
      // Quiz complete
      setQuizComplete(true);
    }
  };

  const exitQuiz = () => {
    setQuizMode(false);
    setQuizQuestions([]);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setQuizComplete(false);
  };

//funcs here


  return (





    
    <div style={{ padding: 24 }}>
      <div className="titlebar">
        <span></span>
      </div>
      

      <button 
        onClick={() => navigate(-1)}
        style={{
          background: '#2a2a2a',
          border: '1px solid #c0c0c0',
          padding: '8px 12px',
          color: '#fff',
          fontSize: '20px',
          cursor: 'pointer',
          borderRadius: '6px',
          marginBottom: '20px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: '40px',
          transition: 'all 0.2s ease'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.background = '#3a3a3a';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.background = '#2a2a2a';
        }}
      >
        ←
      </button>
      
      <h1>Video Feed Page</h1>
      <h1>{title}</h1>
      <p>Current Progress: {videoRef.current ? Math.floor(videoRef.current.currentTime / 60) : 0}:{videoRef.current ? (Math.floor(videoRef.current.currentTime) % 60).toString().padStart(2, '0') : '00'}</p>
      <p style={{ fontSize: '12px', color: '#888' }}>Video ID: {videoId}</p>
      
      {loading && <p>Loading video...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      
      <div className="video-chat-wrapper">
        {streamUrl && !loading && (
          <div className="video-section">
            <video 
              ref={videoRef}
              width="800" 
              height="500" 
              controls
              style={{ backgroundColor: '#000', maxWidth: '100%', height: 'auto' }}
            />
          </div>
        )}

        {/* chat quiz container -----------------------------------------*/}
        <div className="ChatContainer">
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '10px'
        }}>
          <h3 style={{ margin: 0, color: '#fff' }}>
            {quizMode ? 'Quiz Mode' : 'Ask AI about this video'}
          </h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            {!quizMode && (
              <>
                <button onClick={() => startQuiz(false)} className="quiz-button">
                  Test Understanding
                </button>
                <button onClick={() => startQuiz(true)} className="quiz-button-personalized">
                  Personalized Test
                </button>
              </>
            )}
            {quizMode && (
              <button onClick={exitQuiz} className="chat-clear-button">
                Exit Quiz
              </button>
            )}
            {!quizMode && chatMessages.length > 0 && (
              <button onClick={clearChat} className="chat-clear-button">
                Clear Chat
              </button>
            )}
          </div>
        </div>
        
        {/* Quiz Mode UI */}
        {quizMode && quizLoading && (
          <div className="quiz-loading">
            <p>🤔 Generating quiz questions...</p>
          </div>
        )}
        
        {quizMode && !quizLoading && quizComplete && (
          <div className="quiz-complete">
            <h2>Quiz Completed!</h2>
            <p>You answered {quizAnswers.filter(a => a.correct).length} out of {quizQuestions.length} correctly</p>
            <p>Score: {Math.round((quizAnswers.filter(a => a.correct).length / quizQuestions.length) * 100)}%</p>
            <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={() => startQuiz(false)} className="quiz-button">
                Try Again
              </button>
              <button onClick={() => startQuiz(true)} className="quiz-button-personalized">
                Personalized Test
              </button>
              <button onClick={exitQuiz} className="chat-send-button">
                Back to Chat
              </button>
            </div>
          </div>
        )}
        
        {quizMode && !quizLoading && !quizComplete && quizQuestions.length > 0 && (
          <div className="quiz-question-container">
            <div className="quiz-progress">
              Question {currentQuestionIndex + 1} of {quizQuestions.length}
            </div>
            
            <div className="quiz-question">
              {quizQuestions[currentQuestionIndex].question}
            </div>
            
            <div className="quiz-options">
              {quizQuestions[currentQuestionIndex].options.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => selectQuizAnswer(idx)}
                  className={`quiz-option ${
                    selectedAnswer === idx ? 'selected' : ''
                  } ${
                    showExplanation && idx === quizQuestions[currentQuestionIndex].correct ? 'correct' : ''
                  } ${
                    showExplanation && selectedAnswer === idx && idx !== quizQuestions[currentQuestionIndex].correct ? 'incorrect' : ''
                  }`}
                  disabled={showExplanation}
                >
                  {option}
                </button>
              ))}
            </div>
            
            {showExplanation && (
              <div className="quiz-explanation">
                <strong>{selectedAnswer === quizQuestions[currentQuestionIndex].correct ? '✅ Correct!' : '❌ Incorrect'}</strong>
                <p>{quizQuestions[currentQuestionIndex].explanation}</p>
              </div>
            )}
            
            <div className="quiz-actions">
              {!showExplanation && (
                <button 
                  onClick={submitQuizAnswer} 
                  disabled={selectedAnswer === null}
                  className="chat-send-button"
                >
                  Submit Answer
                </button>
              )}
              {showExplanation && (
                <button onClick={nextQuestion} className="chat-send-button">
                  {currentQuestionIndex < quizQuestions.length - 1 ? 'Next Question' : 'Finish Quiz'}
                </button>
              )}
            </div>
          </div>
        )}
        
        {/* Chat messages display */}
        {!quizMode && (
        <>
        <div className="chat-messages-area">
          {chatMessages.length === 0 && (
            <div className="chat-empty-state">
              Start a conversation about the video...
            </div>
          )}
          
          {chatMessages.map((msg, idx) => (
            <div key={idx} className={`chat-message ${msg.role}`}>
              <div className="chat-message-role">
                {msg.role === 'user' ? '👤 You' : msg.role === 'error' ? '⚠️ Error' : '🤖 AI'}:
              </div>
              <div className="chat-message-text">
                {msg.text}
              </div>
            </div>
          ))}
          
          {chatLoading && (
            <div style={{ 
              textAlign: 'center', 
              padding: '10px',
              fontStyle: 'italic',
              color: '#666'
            }}>
              🤔 AI is thinking...
            </div>
          )}
          
          <div ref={chatMessagesEndRef} />
        </div>

        {/* Chat input */}
        <div className="chat-input-area">
          <input
            type="text"
            className="chat-input"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();
              }
            }}
            placeholder="Ask a question about the video..."
            disabled={chatLoading}
          />
          <button 
            onClick={sendChatMessage}
            disabled={chatLoading || !chatInput.trim()}
            className="chat-send-button"
          >
            {chatLoading ? 'Sending...' : 'Send'}
          </button>
        </div>
        </>
        )}
      </div>
      </div> 

      {/* Video summary thing */}



      {summaryLoading && (
        <div style={{
          marginTop: '40px',
          padding: '20px 0',
          textAlign: 'center',
          color: '#888',
          fontSize: '16px',
          fontStyle: 'italic'
        }}>
          <div style={{ fontSize: '24px', marginBottom: '10px' }}>🔄</div>
          Generating video overview and key terms...
        </div>
      )}
      
      {videoSummary && (
        <div style={{
          marginTop: '50px',
          paddingTop: '30px',
          borderTop: '2px solid #333'
        }}>
          <div style={{
            fontSize: '28px',
            fontWeight: '700',
            color: '#fff',
            marginBottom: '20px',
            letterSpacing: '0.5px'
          }}>
            📚 Video Overview
          </div>
          <div style={{
            color: '#ddd',
            fontSize: '16px',
            lineHeight: '1.8',
            whiteSpace: 'pre-wrap',
            fontFamily: 'inherit',
            maxWidth: '900px'
          }}>
            {videoSummary}
          </div>
        </div>
      )}

    </div>
  );
}
//remember to resize this thing later on css












//------------------------------END YOUTUBE-----------------------
function CreditsPage() {
  const navigate = useNavigate();
  
  return (
    <div style={{ padding: 24 }}>
      <div className="titlebar">
  <span></span>
</div>
      
      {/* Back Button */}
      <button 
        onClick={() => navigate('/main')} 
        style={{ 
          marginBottom: '20px',
          padding: '10px 20px',
          background: '#444',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: '600'
        }}
      >
        ← Back to Dashboard
      </button>
      
      <h1>Credits Page</h1>
      <p>This project was made for the Congressional App Project.</p>
      <img src="https://www.congressionalappchallenge.us/wp-content/uploads/2018/08/logo_white.png" className="cimg" />
      <p>Samples From:</p>
      <img src="https://reactbits.dev/assets/react-bits-logo-BEVRCkxh.svg" className="rimg" />
      <ScrollVelocity
        texts={['Eduardo Almeyda']}
        velocity={100}
        className="custom-scroll-text"
      />
      </div>
  );
}



function MainPage() {

  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState("");

  function handleBack() {
    localStorage.removeItem('skipHome');
    navigate('/');
  }

  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleEnter(value) {
    const query = value.trim() + " course";
    if (!query) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/youtube/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error(`Backend responded with ${response.status}`);
      }

      const json = await response.json();

      setResults(json.results ?? []);
    } catch (err) {
      console.error('Failed to fetch results', err);
      setError(err.message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function selectlesson(title, high, videoId) {

let lessons = JSON.parse(localStorage.getItem('lessons')) || [];
    let exists = lessons.some(lesson => lesson.title === title);

 if (!exists) {
    let lessons = JSON.parse(localStorage.getItem('lessons')) || [];
    lessons.push({ title, high, videoId });
    console.log("Selected lesson:", title, high, videoId, "MEMDAT: ", JSON.stringify(lessons));
    localStorage.setItem('lessons', JSON.stringify(lessons));
  } else {
    console.log("Lesson Already exists, not adding duplicate");
  }
navigate('/main', { state: { refresh: Date.now() } });
}


  return (
    <div style={{ padding: 24 }}>
      <div className="titlebar">
  <span></span>
</div>
      <h1>Current Lessons</h1>
      <p className="LessonTitle"> </p>
      <div className="Selected-lessons-container"> 
      {JSON.parse(localStorage.getItem('lessons'))?.map((lesson, index) => (
        <div key={index} className="Selected-lesson-item" onClick={() => {
          // Store the current lesson being viewed
          localStorage.setItem('currentLesson', JSON.stringify(lesson));
          navigate('/video');
        }}>
                      <TiltedCard
                imageSrc={lesson.high}
                altText={lesson.title}
                captionText={lesson.title}
                containerHeight="300px"
                containerWidth="400px"
                imageHeight="300px"
                imageWidth="400px"
                rotateAmplitude={12}
                scaleOnHover={1.2}
                showMobileWarning={false}
                showTooltip={true}
                displayOverlayContent={true}
                overlayContent={
                <p className="tilted--demo-text">
               {lesson.title}card
               </p>
                }
              />
        </div>
      ))}

      </div>
      <input
        className="search-input"
        type="text"
        placeholder="What do you want to learn?"
        value={inputValue}
        onChange={e => setInputValue(e.target.value)}
        onKeyDown={e => e.key === "Enter" && handleEnter(e.target.value) && e.currentTarget.classList.toggle('clicked-style')}
      />


      {loading && <p>Searching…</p>}
      {error && <p role="alert">Error: {error}</p>}
      
      {results.length > 0 && (
        console.log(results),
        <ul>
          <div className="results-container">
          {results.map((item, idx) => (
            <div className="result-items" key={idx}>
              <div onClick={() => selectlesson(item.title, item.high, item.videoId)}>
              <TiltedCard
                imageSrc={item.high}
                altText={item.title}
                captionText={item.title}
                containerHeight="300px"
                containerWidth="400px"
                imageHeight="300px"
                imageWidth="400px"
                rotateAmplitude={12}
                scaleOnHover={1.2}
                showMobileWarning={false}
                showTooltip={true}
                displayOverlayContent={true}
                overlayContent={
                <p className="tilted-card-demo-text">
               {item.title}
               </p>
                }
              />
              </div>
            </div>
          ))}
          </div>
        </ul>
      )}
      




            <div style={{ marginTop: '40px', borderTop: '1px solid #333', paddingTop: '20px' }}>
        <button onClick={() => navigate('/credits')} style={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          border: 'none',
          padding: '12px 24px',
          color: 'white',
          fontWeight: 'bold',
          cursor: 'pointer',
          borderRadius: '8px',
          fontSize: '14px'
        }}>
          Credit
        </button>
      </div>

      {isdevmodeenabled && (
        <div style={{ marginTop: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={handleBack}>BTM WIP (clear skip)</button>
          <button onClick={() => navigate('/video')}>GOTOVID (go to test video feed page)</button>
          <button onClick={() => {
            if (window.confirm('Are you sure you want to clear all data? This will delete all lessons and progress.')) {
              localStorage.clear();
              navigate('/');
              window.location.reload();
              
            }
          }}>Flush All Memory</button>
        </div>
      )}
      

    </div>
  );
}


const App = () => (
  <Router>
    <Routes>
      <Route path="/video" element={<VideoPage />} />
      <Route path="/" element={<HomePage />} />
      <Route path="/main" element={<MainPage />} />
      <Route path='/credits' element={<CreditsPage />} />
    </Routes>
  </Router>
);

export default App;

