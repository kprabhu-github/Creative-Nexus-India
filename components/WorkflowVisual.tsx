import React from 'react';
import { FileEdit, PenTool, Zap, ShieldCheck, ChevronRight } from 'lucide-react';

const WorkflowVisual: React.FC = () => {
  const workflowSteps = [
    {
      phase: "Prepare",
      title: "Digital Setup",
      desc: "AI-assisted scope & info gathering.",
      icon: FileEdit,
      tasks: ["Digital Form", "AI Refinement"]
    },
    {
      phase: "Sign",
      title: "E-Execution",
      desc: "Instant digital signature & seal.",
      icon: PenTool,
      tasks: ["E-Signature", "Company Seal"]
    },
    {
      phase: "Act",
      title: "Automate",
      desc: "Instant PDF & email triggers.",
      icon: Zap,
      tasks: ["PDF Generation", "Email Routing"]
    },
    {
      phase: "Manage",
      title: "Secure Archive",
      desc: "Digital audit trail & storage.",
      icon: ShieldCheck,
      tasks: ["Audit Trail", "Direct Download"]
    }
  ];

  return (
    <div className="w-full py-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
        {/* Connecting Line (Desktop) */}
        <div className="hidden md:block absolute top-[42px] left-[10%] right-[10%] h-0.5 bg-slate-200 z-0">
          <div className="absolute inset-0 bg-gradient-to-r from-[#d90b2d] to-slate-200 w-[33%] transition-all duration-1000"></div>
        </div>

        {workflowSteps.map((step, idx) => (
          <div key={idx} className="relative z-10 flex flex-col items-center text-center group">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-sm border-2 
              ${idx === 0 
                ? 'bg-[#d90b2d] border-[#d90b2d] text-white' 
                : 'bg-white border-slate-100 text-slate-400 group-hover:border-[#d90b2d]/30 group-hover:text-[#d90b2d]'}`}>
              <step.icon className="w-6 h-6" />
            </div>
            
            <div className="mt-4 space-y-1 px-2">
              <span className={`text-[10px] font-bold uppercase tracking-widest ${idx === 0 ? 'text-[#d90b2d]' : 'text-slate-400'}`}>
                {step.phase}
              </span>
              <h4 className="text-sm font-bold text-slate-900">{step.title}</h4>
              <p className="text-[11px] text-slate-500 leading-tight h-8 line-clamp-2">
                {step.desc}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap justify-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
              {step.tasks.map((task, tidx) => (
                <span key={tidx} className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                  {task}
                </span>
              ))}
            </div>

            {idx < workflowSteps.length - 1 && (
              <div className="md:hidden my-4">
                <ChevronRight className="w-5 h-5 text-slate-300 rotate-90" />
              </div>
            )}
          </div>
        ))}
      </div>
      
      <div className="mt-12 bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-center gap-3">
        <div className="w-2 h-2 rounded-full bg-[#d90b2d] animate-pulse"></div>
        <p className="text-xs font-medium text-slate-600 italic">
          We've eliminated the need for printing, scanning, and physical mailing.
        </p>
      </div>
    </div>
  );
};

export default WorkflowVisual;