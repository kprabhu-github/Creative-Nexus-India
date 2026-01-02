import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, Bot } from 'lucide-react';
import { askContractQuestion } from '../services/geminiService';

const GeminiAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<{role: 'user' | 'assistant', text: string}[]>([
    { role: 'assistant', text: 'Hi! I can help clarify any terms in the agreement. What would you like to know?' }
  ]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!query.trim()) return;
    
    const userMsg = query;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setQuery('');
    setLoading(true);

    const answer = await askContractQuestion(userMsg);
    
    setMessages(prev => [...prev, { role: 'assistant', text: answer }]);
    setLoading(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSend();
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none">
      {/* Chat Window */}
      <div 
        className={`bg-white rounded-2xl shadow-2xl border border-slate-200 mb-4 w-80 sm:w-96 transition-all duration-300 origin-bottom-right pointer-events-auto overflow-hidden ${
          isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 h-0'
        }`}
      >
        <div className="bg-[#d90b2d] p-4 flex justify-between items-center">
          <div className="flex items-center space-x-2 text-white">
            <Bot className="w-5 h-5" />
            <span className="font-semibold">Contract Assistant</span>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="h-80 overflow-y-auto p-4 space-y-4 bg-slate-50">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                msg.role === 'user' 
                  ? 'bg-[#d90b2d] text-white rounded-br-none' 
                  : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none shadow-sm'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-none px-4 py-2 shadow-sm">
                <Loader2 className="w-4 h-4 animate-spin text-[#d90b2d]" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-3 bg-white border-t border-slate-100 flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Ask about payment, revisions..."
            className="flex-1 px-3 py-2 bg-slate-100 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#d90b2d]"
          />
          <button 
            onClick={handleSend}
            disabled={loading || !query.trim()}
            className="p-2 bg-[#d90b2d] text-white rounded-lg hover:bg-[#111113] disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="pointer-events-auto bg-[#d90b2d] hover:bg-[#111113] text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 flex items-center gap-2 group"
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
        {!isOpen && <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 whitespace-nowrap font-medium pl-0 group-hover:pl-2">Ask AI about terms</span>}
      </button>
    </div>
  );
};

export default GeminiAssistant;