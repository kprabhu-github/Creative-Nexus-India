import React from 'react';
import { ProjectScope } from '../types';
import { SERVICE_OPTIONS } from '../constants';
import { Check, Upload, FileText, X, Shield, Briefcase, FileCheck, Mic } from 'lucide-react';

interface Props {
  data: ProjectScope;
  updateData: (data: Partial<ProjectScope>) => void;
  onNext: () => void;
  onBack: () => void;
}

const StepScope: React.FC<Props> = ({ data, updateData, onNext, onBack }) => {

  const toggleService = (id: string) => {
    const newServices = data.services.includes(id)
      ? data.services.filter(s => s !== id)
      : [...data.services, id];
    updateData({ services: newServices });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, key: 'sowDocument' | 'msaDocument' | 'ndaDocument' | 'momDocument') => {
    if (e.target.files && e.target.files[0]) {
      updateData({ [key]: e.target.files[0] });
    }
  };

  const removeFile = (key: 'sowDocument' | 'msaDocument' | 'ndaDocument' | 'momDocument') => {
    updateData({ [key]: null });
  };

  const UploadCard = ({ 
    title, 
    subtext,
    file, 
    fileKey, 
    icon: Icon,
    fullWidth = false
  }: { 
    title: string; 
    subtext: string;
    file: File | null; 
    fileKey: 'sowDocument' | 'msaDocument' | 'ndaDocument' | 'momDocument';
    icon: any;
    fullWidth?: boolean;
  }) => (
    <div className={`space-y-3 ${fullWidth ? 'w-full' : ''}`}>
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <Icon className="w-4 h-4 text-[#d90b2d]" /> {title}
        </h3>
        {!file ? (
            <label className={`border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center text-center hover:border-[#d90b2d] hover:bg-[#d90b2d]/5 transition-all cursor-pointer group relative bg-slate-50/50 ${fullWidth ? 'h-32 flex-row gap-6' : 'h-48'}`}>
                <input 
                    type="file" 
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, fileKey)}
                    accept=".pdf,.doc,.docx"
                />
                <div className={`bg-white p-3 rounded-full shadow-sm group-hover:scale-110 transition-transform group-hover:text-[#d90b2d] text-slate-400 ${fullWidth ? 'mb-0' : 'mb-3'}`}>
                    <Upload className="w-6 h-6" />
                </div>
                <div className={fullWidth ? 'text-left' : ''}>
                    <p className="text-sm font-medium text-slate-700 group-hover:text-[#d90b2d]">Upload {title}</p>
                    <p className="text-xs text-slate-400 mt-1">{subtext}</p>
                </div>
            </label>
        ) : (
            <div className={`bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between shadow-sm animate-in fade-in zoom-in-95 relative ${fullWidth ? 'h-32' : 'h-48'}`}>
                <div className="flex items-start gap-3 overflow-hidden">
                    <div className="bg-[#d90b2d]/10 p-2.5 rounded-lg shrink-0 border border-[#d90b2d]/20">
                        <FileText className="w-6 h-6 text-[#d90b2d]" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate" title={file.name}>{file.name}</p>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        <div className="inline-flex items-center gap-1 mt-2 bg-green-50 text-green-700 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border border-green-100">
                             <Check className="w-3 h-3" /> Attached
                        </div>
                    </div>
                </div>
                <button 
                    onClick={() => removeFile(fileKey)}
                    className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                    title="Remove file"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        )}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-slate-900">Project Scope & Documents</h2>
        <p className="text-slate-600">Select services and upload the required project agreements.</p>
      </div>

      {/* Services Selection */}
      <div className="space-y-4">
        <h3 className="font-semibold text-slate-900">Services</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {SERVICE_OPTIONS.map((option) => {
            const isSelected = data.services.includes(option.id);
            return (
              <div
                key={option.id}
                onClick={() => toggleService(option.id)}
                className={`cursor-pointer p-4 rounded-xl border-2 transition-all flex items-center space-x-3 ${
                  isSelected
                    ? 'border-[#d90b2d] bg-[#d90b2d]/5 text-[#d90b2d]'
                    : 'border-slate-200 hover:border-[#d90b2d]/40 bg-white text-slate-600'
                }`}
              >
                <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                  isSelected ? 'bg-[#d90b2d] border-[#d90b2d]' : 'border-slate-400'
                }`}>
                  {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                </div>
                <span className="font-medium text-sm">{option.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-slate-200 my-6"></div>

      {/* Minutes of Meeting Section */}
      <div className="space-y-4">
        <h3 className="font-semibold text-slate-900 mb-2">Meeting Notes</h3>
        <div className="grid grid-cols-1">
            <UploadCard 
                title="Minutes of Meeting (MOM)" 
                subtext="Upload the key takeaways/minutes from the kickoff or discovery call."
                file={data.momDocument} 
                fileKey="momDocument"
                icon={Mic}
                fullWidth={true}
            />
        </div>
      </div>

      {/* Required Documents Upload Section */}
      <div className="space-y-4 pt-4">
        <h3 className="font-semibold text-slate-900 mb-4">Required Documents</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <UploadCard 
                title="SOW" 
                subtext="Scope of Work"
                file={data.sowDocument} 
                fileKey="sowDocument"
                icon={FileCheck}
            />
            <UploadCard 
                title="MSA" 
                subtext="Master Service Agreement"
                file={data.msaDocument} 
                fileKey="msaDocument"
                icon={Briefcase}
            />
            <UploadCard 
                title="NDA" 
                subtext="Non-Disclosure Agreement"
                file={data.ndaDocument} 
                fileKey="ndaDocument"
                icon={Shield}
            />
        </div>
      </div>

      <div className="flex justify-between pt-6">
        <button
          onClick={onBack}
          className="px-6 py-2 text-slate-600 hover:text-slate-900 font-medium transition-colors"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className={`px-8 py-2 rounded-lg font-semibold transition-all bg-[#d90b2d] text-white hover:bg-[#111113] shadow-md`}
        >
          Next: Agreement & Terms
        </button>
      </div>
    </div>
  );
};

export default StepScope;