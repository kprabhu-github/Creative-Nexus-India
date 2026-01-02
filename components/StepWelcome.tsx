import React from 'react';
import { ArrowRight } from 'lucide-react';

interface Props {
  onNext: () => void;
}

const StepWelcome: React.FC<Props> = ({ onNext }) => {
  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700 py-8">
      <div className="text-center space-y-6">
        <div className="space-y-3">
          <h1 className="text-5xl font-bold text-slate-900 tracking-tight">Digital Client Onboarding</h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Welcome to <span className="text-[#d90b2d] font-semibold">Creative Nexus India</span>. 
            We've modernized our onboarding to be fast, secure, and completely paperless.
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-6 pt-4">
        <button
          onClick={onNext}
          className="group flex items-center space-x-3 bg-[#d90b2d] hover:bg-[#111113] text-white px-12 py-5 rounded-full font-bold text-xl transition-all hover:shadow-2xl hover:shadow-[#d90b2d]/20 active:scale-95"
        >
          <span>Start Onboarding</span>
          <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
        </button>
        
        <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-slate-400">Estimated time to complete: <span className="font-semibold text-slate-600">4 minutes</span></p>
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-[#d90b2d] animate-pulse"></div>
                <p className="text-xs font-medium text-slate-500 italic">
                    Fast, secure, and legally binding digital execution.
                </p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default StepWelcome;