import React from 'react';
import { Step } from '../types';

interface Props {
  currentStep: Step;
}

const ProgressBar: React.FC<Props> = ({ currentStep }) => {
  const steps = [
    { id: Step.WELCOME, label: 'Start' },
    { id: Step.CLIENT_INFO, label: 'Details' },
    { id: Step.SCOPE, label: 'Scope' },
    { id: Step.TERMS, label: 'Terms' },
    { id: Step.SIGNATURE, label: 'Sign' }
  ];

  const progress = Math.min(((currentStep - 1) / (steps.length - 1)) * 100, 100);

  return (
    <div className="w-full max-w-2xl mx-auto mb-12">
      <div className="relative">
        {/* Background Bar */}
        <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-200 -translate-y-1/2 rounded-full" />
        
        {/* Active Progress Bar */}
        <div 
            className="absolute top-1/2 left-0 h-1 bg-[#d90b2d] -translate-y-1/2 rounded-full transition-all duration-500 ease-in-out" 
            style={{ width: `${progress}%` }}
        />

        {/* Steps */}
        <div className="relative flex justify-between">
          {steps.map((step) => {
            const isActive = currentStep >= step.id;
            const isCurrent = currentStep === step.id;

            return (
              <div key={step.id} className="flex flex-col items-center group">
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 bg-white z-10 
                    ${isActive ? 'border-[#d90b2d] text-[#d90b2d]' : 'border-slate-300 text-slate-300'}
                    ${isCurrent ? 'ring-4 ring-[#d90b2d]/20 scale-110' : ''}
                  `}
                >
                  {isActive ? (
                    <div className="w-2.5 h-2.5 rounded-full bg-[#d90b2d]" />
                  ) : (
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  )}
                </div>
                <span 
                    className={`text-xs font-medium mt-2 transition-colors duration-300 ${isActive ? 'text-[#d90b2d]' : 'text-slate-400'}`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ProgressBar;