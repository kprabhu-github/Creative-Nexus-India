import React, { useState, useRef, useEffect } from 'react';
import { AgreementState, ClientDetails, ProjectScope } from '../types';
import { PenTool, CheckCircle, RefreshCcw, Mail, Loader2, ShieldCheck, Upload, Image as ImageIcon, X } from 'lucide-react';
import { sendAgreementEmail, generateSignedPDF } from '../services/pdfService';

interface Props {
  clientName: string;
  email: string;
  agreementData: AgreementState;
  updateAgreement: (data: Partial<AgreementState>) => void;
  onSubmit: () => void;
  onBack: () => void;
  fullClientData?: ClientDetails;
  projectScope?: ProjectScope;
}

type SignatureMethod = 'draw' | 'upload';

const StepSignature: React.FC<Props> = ({ 
    clientName, 
    email,
    agreementData, 
    updateAgreement, 
    onSubmit, 
    onBack,
    fullClientData,
    projectScope
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [signatureMethod, setSignatureMethod] = useState<SignatureMethod>('draw');
  const [isDrawing, setIsDrawing] = useState(false);
  const [sendCopy, setSendCopy] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusText, setStatusText] = useState("Finalize Agreement");

  // Initialize canvas if in draw mode
  useEffect(() => {
    if (signatureMethod === 'draw' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const ratio = window.devicePixelRatio || 1;
      // Set display size (css pixels)
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      
      ctx.scale(ratio, ratio);
      ctx.strokeStyle = '#d90b2d';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  }, [signatureMethod]);

  const getCoordinates = (event: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in event) {
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
    } else {
        clientX = (event as React.MouseEvent).clientX;
        clientY = (event as React.MouseEvent).clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext('2d');
    ctx?.beginPath();
    ctx?.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
     e.preventDefault(); 
    if (!isDrawing) return;
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext('2d');
    ctx?.lineTo(x, y);
    ctx?.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (canvasRef.current) {
        updateAgreement({ signatureData: canvasRef.current.toDataURL() });
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      updateAgreement({ signatureData: null });
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'signature' | 'seal') => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          if (type === 'signature') {
            updateAgreement({ signatureData: reader.result });
          } else {
            updateAgreement({ sealData: reader.result });
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleComplete = async () => {
      // Set the timestamp immediately when user clicks finalize
      const now = new Date();
      const signedDate = now.toLocaleString('en-IN', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
      
      updateAgreement({ signedDate });

      if (!fullClientData || !projectScope) {
          onSubmit();
          return;
      }

      setIsSubmitting(true);
      setStatusText("Packaging Documents...");

      try {
          // Use the timestamp we just created
          const finalAgreementState = { ...agreementData, signedDate };
          const pdfBlob = await generateSignedPDF(fullClientData, projectScope, finalAgreementState);
          
          if (sendCopy) {
              setStatusText(`Emailing Documents...`);
              await sendAgreementEmail(email, pdfBlob);
          }
          
          setStatusText("All Done!");
          setTimeout(() => {
              onSubmit();
          }, 500);

      } catch (error) {
          console.error("Submission error", error);
          setStatusText("Error sending email");
          setTimeout(() => onSubmit(), 1000); 
      }
  };

  const today = new Date().toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const isSignatureCaptured = !!agreementData.signatureData;

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-slate-900">Sign & Execute</h2>
        <p className="text-slate-600">Please provide your signature and optional company seal to execute the agreements.</p>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
        
        {/* Document Status Indicators */}
        <div className="flex justify-center gap-4 text-xs font-semibold text-green-700 bg-green-50 p-3 rounded-lg border border-green-100">
             <span className="flex items-center gap-1"><ShieldCheck className="w-4 h-4" /> MSA Ready</span>
             <span className="w-px bg-green-200"></span>
             <span className="flex items-center gap-1"><ShieldCheck className="w-4 h-4" /> SOW Ready</span>
             <span className="w-px bg-green-200"></span>
             <span className="flex items-center gap-1"><ShieldCheck className="w-4 h-4" /> NDA Ready</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Authorized Name *</label>
                <input 
                    type="text" 
                    value={agreementData.signerName}
                    onChange={(e) => updateAgreement({ signerName: e.target.value })}
                    placeholder="Full Name"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-[#d90b2d]"
                    disabled={isSubmitting}
                />
             </div>
             <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title / Designation *</label>
                <input 
                    type="text" 
                    value={agreementData.signerTitle}
                    onChange={(e) => updateAgreement({ signerTitle: e.target.value })}
                    placeholder="e.g. CEO, Director"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-[#d90b2d]"
                    disabled={isSubmitting}
                />
             </div>
        </div>

        <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between mb-4">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <PenTool className="w-4 h-4" /> Signature *
                </label>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button 
                        onClick={() => { setSignatureMethod('draw'); updateAgreement({ signatureData: null }); }}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${signatureMethod === 'draw' ? 'bg-white text-[#d90b2d] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        disabled={isSubmitting}
                    >
                        Draw
                    </button>
                    <button 
                        onClick={() => { setSignatureMethod('upload'); updateAgreement({ signatureData: null }); }}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${signatureMethod === 'upload' ? 'bg-white text-[#d90b2d] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        disabled={isSubmitting}
                    >
                        Upload
                    </button>
                </div>
            </div>

            {/* DRAW MODE */}
            {signatureMethod === 'draw' && (
                <div className="relative">
                    <div className={`border-2 ${isSignatureCaptured ? 'border-green-500 bg-green-50/10' : 'border-dashed border-slate-300'} rounded-xl overflow-hidden bg-slate-50 touch-none relative transition-colors duration-300 ${isSubmitting ? 'opacity-75 pointer-events-none' : ''}`}>
                        <canvas
                            ref={canvasRef}
                            className="w-full h-40 cursor-crosshair block"
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                            onTouchStart={startDrawing}
                            onTouchMove={draw}
                            onTouchEnd={stopDrawing}
                        />
                        <button 
                            onClick={clearSignature}
                            className="absolute top-2 right-2 text-xs text-red-500 hover:text-red-700 flex items-center gap-1 bg-white px-2 py-1 rounded shadow-sm border border-slate-200"
                            disabled={isSubmitting}
                        >
                            <RefreshCcw className="w-3 h-3" /> Clear
                        </button>
                    </div>
                    <div className="flex justify-between items-center mt-2 h-6">
                         <p className="text-xs text-slate-400">Draw your signature above using your mouse or finger.</p>
                         {isSignatureCaptured && (
                             <div className="flex items-center gap-1.5 text-xs font-bold text-green-600 bg-green-100 px-2.5 py-1 rounded-full animate-in fade-in slide-in-from-bottom-1">
                                 <CheckCircle className="w-3.5 h-3.5" />
                                 <span>Captured</span>
                             </div>
                         )}
                    </div>
                </div>
            )}

            {/* UPLOAD MODE */}
            {signatureMethod === 'upload' && (
                <div className="space-y-3">
                    {!agreementData.signatureData ? (
                        <label className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:border-[#d90b2d] hover:bg-[#d90b2d]/10 transition-all cursor-pointer bg-slate-50">
                            <input 
                                type="file" 
                                className="hidden"
                                onChange={(e) => handleImageUpload(e, 'signature')}
                                accept="image/png, image/jpeg"
                            />
                            <Upload className="w-6 h-6 text-slate-400 mb-2" />
                            <p className="text-sm font-medium text-slate-700">Upload Signature Image</p>
                            <p className="text-xs text-slate-400">PNG or JPG (Transparent background recommended)</p>
                        </label>
                    ) : (
                        <div className="relative border-2 border-green-500 rounded-xl p-4 bg-green-50/10 flex items-center justify-center h-40 animate-in fade-in zoom-in-95 duration-300">
                             <img src={agreementData.signatureData} alt="Uploaded Signature" className="max-h-full max-w-full object-contain" />
                             <div className="absolute top-3 left-3 flex items-center gap-1.5 text-xs font-bold text-green-600 bg-white/90 backdrop-blur px-2.5 py-1 rounded-full shadow-sm">
                                 <CheckCircle className="w-3.5 h-3.5" />
                                 <span>Uploaded</span>
                             </div>
                             <button 
                                onClick={() => updateAgreement({ signatureData: null })}
                                className="absolute top-2 right-2 p-1.5 bg-white text-red-500 rounded-full hover:bg-red-50 border border-slate-100 shadow-sm"
                             >
                                 <X className="w-4 h-4" />
                             </button>
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* SEAL UPLOAD */}
        <div className="border-t border-slate-100 pt-4">
             <label className="text-sm font-medium text-slate-700 flex items-center gap-2 mb-3">
                <ImageIcon className="w-4 h-4" /> Company Seal / Stamp (Optional)
            </label>
            {!agreementData.sealData ? (
                 <label className="border border-slate-200 border-dashed rounded-lg p-4 flex items-center justify-center gap-3 hover:bg-slate-50 cursor-pointer transition-colors group">
                     <input 
                        type="file" 
                        className="hidden"
                        onChange={(e) => handleImageUpload(e, 'seal')}
                        accept="image/png, image/jpeg"
                     />
                     <div className="bg-[#d90b2d]/10 p-2 rounded-full text-[#d90b2d] group-hover:scale-110 transition-transform">
                         <Upload className="w-4 h-4" />
                     </div>
                     <div className="text-left">
                         <p className="text-sm font-medium text-slate-600 group-hover:text-[#d90b2d] transition-colors">Click to upload seal</p>
                         <p className="text-[10px] text-slate-400">PNG/JPG</p>
                     </div>
                 </label>
            ) : (
                 <div className="relative border border-green-200 bg-green-50/30 rounded-lg p-2 flex items-center gap-3 animate-in fade-in slide-in-from-left-2">
                     <div className="h-12 w-12 border border-green-200 rounded bg-white flex items-center justify-center overflow-hidden">
                        <img src={agreementData.sealData} alt="Seal" className="max-full max-h-full object-contain" />
                     </div>
                     <div className="flex-1">
                         <p className="text-sm font-bold text-green-700 flex items-center gap-1.5">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Seal Attached
                         </p>
                     </div>
                     <button 
                        onClick={() => updateAgreement({ sealData: null })}
                        className="p-1.5 text-slate-400 hover:text-red-500"
                     >
                         <X className="w-4 h-4" />
                     </button>
                 </div>
            )}
        </div>
        
        <div className="pt-4 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center text-sm gap-4">
             <div className="flex flex-col md:flex-row gap-4 text-slate-500">
                <span>Date: <span className="text-slate-900 font-medium">{today}</span></span>
                <span>For: <span className="text-slate-900 font-medium">{clientName || '[Company Name]'}</span></span>
             </div>
             
             <div className="flex items-center space-x-2 bg-[#d90b2d]/10 px-3 py-1.5 rounded-lg border border-[#d90b2d]/20">
                <input 
                    type="checkbox" 
                    id="sendCopy"
                    checked={sendCopy}
                    onChange={(e) => setSendCopy(e.target.checked)}
                    className="w-4 h-4 text-[#d90b2d] rounded focus:ring-[#d90b2d] border-gray-300"
                    disabled={isSubmitting}
                />
                <label htmlFor="sendCopy" className="text-sm text-[#d90b2d] cursor-pointer select-none flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" />
                    Receive Signed Copies via Email
                </label>
             </div>
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <button
          onClick={onBack}
          disabled={isSubmitting}
          className="px-6 py-2 text-slate-600 hover:text-slate-900 font-medium transition-colors disabled:opacity-50"
        >
          Back
        </button>
        <button
          onClick={handleComplete}
          disabled={!agreementData.signatureData || !agreementData.signerName || !agreementData.signerTitle || isSubmitting}
          className={`flex items-center space-x-2 px-8 py-3 rounded-lg font-semibold transition-all min-w-[200px] justify-center ${
             agreementData.signatureData && agreementData.signerName && !isSubmitting
              ? 'bg-[#d90b2d] text-white hover:bg-[#111113] shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
              : isSubmitting 
                ? 'bg-[#d90b2d]/80 text-white cursor-wait'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{statusText}</span>
              </>
          ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                <span>Execute Agreements</span>
              </>
          )}
        </button>
      </div>
    </div>
  );
};

export default StepSignature;