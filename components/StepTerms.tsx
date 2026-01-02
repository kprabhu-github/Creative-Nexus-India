import React, { useState, useEffect, useRef } from 'react';
import mammoth from 'mammoth';
import { ClientDetails, ProjectScope, AgreementState } from '../types';
import { ScrollText, FileCheck, Check, Briefcase, Shield, FileText, Download, PenTool, RefreshCcw, CheckCircle, X, Loader2, Mail, Mic, Hash, AlertCircle } from 'lucide-react';
import GeminiAssistant from './GeminiAssistant';
import { sendAgreementEmail, generateSignedPDF } from '../services/pdfService';

interface Props {
  clientDetails: ClientDetails;
  projectScope: ProjectScope;
  agreementData: AgreementState;
  updateAgreement: (data: Partial<AgreementState>) => void;
  onComplete: () => void;
  onBack: () => void;
}

const AGENCY_DETAILS = {
  name: "Creative Nexus India",
  address: "101 Innovation Tower, Cyber City\nGurugram, Haryana, 122002",
  contact: "hello@creativenexus.in",
  phone: "+91 98765 43210"
};

const StepTerms: React.FC<Props> = ({ 
    clientDetails, 
    projectScope, 
    agreementData,
    updateAgreement,
    onComplete, 
    onBack 
}) => {
  const [activeTab, setActiveTab] = useState<string>('summary');
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [docxContent, setDocxContent] = useState<Record<string, string>>({});
  const [pdfError, setPdfError] = useState<boolean>(false);
  
  // Signature State
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [signatureMethod, setSignatureMethod] = useState<'draw' | 'upload'>('draw');
  const [isDrawing, setIsDrawing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusText, setStatusText] = useState("Execute Agreement");
  
  // Auto-fill & Options
  const [usePrimaryContact, setUsePrimaryContact] = useState(!agreementData.signerName);
  const [sendCopy, setSendCopy] = useState(true);

  // Auto-fill Effect
  useEffect(() => {
    if (usePrimaryContact) {
        if (clientDetails.contactName && agreementData.signerName !== clientDetails.contactName) {
            updateAgreement({ signerName: clientDetails.contactName });
        }
        if (clientDetails.designation && agreementData.signerTitle !== clientDetails.designation) {
            updateAgreement({ signerTitle: clientDetails.designation });
        }
    }
  }, [usePrimaryContact, clientDetails.contactName, clientDetails.designation, agreementData.signerName, agreementData.signerTitle, updateAgreement]);

  // Define tabs based on uploaded files
  const tabs = [
    { id: 'summary', label: 'Summary Package', icon: FileText, file: null },
    { id: 'mom', label: 'Minutes of Meeting', icon: Mic, file: projectScope.momDocument },
    { id: 'sow', label: 'Scope of Work', icon: FileCheck, file: projectScope.sowDocument },
    { id: 'msa', label: 'Service Agreement', icon: Briefcase, file: projectScope.msaDocument },
    { id: 'nda', label: 'Non-Disclosure', icon: Shield, file: projectScope.ndaDocument },
  ].filter(t => t.id === 'summary' || t.file !== null);

  // Initialize Previews (PDF & DOCX)
  useEffect(() => {
    const urls: Record<string, string> = {};
    let isMounted = true;

    const loadFiles = async () => {
        for (const tab of tabs) {
            if (tab.file) {
                if (tab.file.type === 'application/pdf') {
                    urls[tab.id] = URL.createObjectURL(tab.file);
                } else if (tab.file.name.endsWith('.docx') || tab.file.type.includes('document')) {
                    try {
                        const arrayBuffer = await tab.file.arrayBuffer();
                        const result = await mammoth.convertToHtml({ arrayBuffer });
                        if(isMounted) {
                            setDocxContent(prev => ({ ...prev, [tab.id]: result.value }));
                        }
                    } catch (err) {
                        console.error("Error converting DOCX", err);
                    }
                }
            }
        }
        if(isMounted) {
            setPreviewUrls(urls);
        }
    };

    loadFiles();

    return () => {
        isMounted = false;
        // Clean up object URLs to prevent memory leaks
        Object.values(urls).forEach(url => URL.revokeObjectURL(url));
    };
  }, [projectScope]);

  // Canvas Setup
  useEffect(() => {
    if (signatureMethod === 'draw' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const ratio = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      ctx.scale(ratio, ratio);
      ctx.strokeStyle = '#d90b2d';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  }, [signatureMethod, activeTab]);

  // Drawing Logic
  const getCoordinates = (event: React.MouseEvent | React.TouchEvent) => {
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
    return { x: clientX - rect.left, y: clientY - rect.top };
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
          updateAgreement({ [type === 'signature' ? 'signatureData' : 'sealData']: reader.result });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFinalize = async () => {
      const now = new Date();
      const signedDate = now.toLocaleString('en-IN', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
      
      updateAgreement({ signedDate });
      setIsSubmitting(true);
      setStatusText("Generating PDF...");

      try {
          const finalAgreementState = { ...agreementData, signedDate };
          const pdfBlob = await generateSignedPDF(clientDetails, projectScope, finalAgreementState);
          
          if (sendCopy) {
            setStatusText(`Emailing Client...`);
            await sendAgreementEmail(clientDetails.contactEmail, pdfBlob);
          }

          setStatusText("Done!");
          setTimeout(onComplete, 800);
      } catch (error) {
          console.error("Error", error);
          setStatusText("Error - Try Again");
          setTimeout(() => setIsSubmitting(false), 2000);
      }
  };

  const activeTabData = tabs.find(t => t.id === activeTab) || tabs[0];
  const isSignatureCaptured = !!agreementData.signatureData;

  // Render Signature Block Component
  const SignatureBlock = () => (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 space-y-6">
        <div className="flex items-center gap-2 mb-2">
             <div className="h-px bg-slate-200 flex-1"></div>
             <span className="text-slate-500 text-xs font-bold uppercase tracking-wider bg-white px-2">Execution & Signature</span>
             <div className="h-px bg-slate-200 flex-1"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-4">
                 <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase">Signer Name</label>
                        <label className="flex items-center gap-1.5 cursor-pointer hover:bg-slate-100 px-1.5 py-0.5 rounded transition-colors group">
                            <input 
                                type="checkbox" 
                                checked={usePrimaryContact}
                                onChange={(e) => setUsePrimaryContact(e.target.checked)}
                                className="w-3.5 h-3.5 text-[#d90b2d] rounded border-slate-300 focus:ring-[#d90b2d] cursor-pointer"
                            />
                            <span className="text-[10px] font-medium text-slate-500 group-hover:text-[#d90b2d]">Same as Primary Contact</span>
                        </label>
                    </div>
                    <input 
                        type="text" 
                        value={agreementData.signerName}
                        onChange={(e) => {
                            setUsePrimaryContact(false);
                            updateAgreement({ signerName: e.target.value });
                        }}
                        placeholder="Full Name"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm outline-none focus:border-[#d90b2d] transition-colors"
                    />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Title / Designation</label>
                    <input 
                        type="text" 
                        value={agreementData.signerTitle}
                        onChange={(e) => updateAgreement({ signerTitle: e.target.value })}
                        placeholder="e.g. Director"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm outline-none focus:border-[#d90b2d] transition-colors"
                    />
                 </div>
             </div>

             <div className="space-y-2">
                 <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Signature</label>
                    <div className="flex gap-2">
                        <button onClick={() => { setSignatureMethod('draw'); updateAgreement({ signatureData: null }); }} className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${signatureMethod === 'draw' ? 'bg-[#d90b2d]/10 text-[#d90b2d]' : 'text-slate-400 hover:text-slate-600'}`}>Draw</button>
                        <button onClick={() => { setSignatureMethod('upload'); updateAgreement({ signatureData: null }); }} className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${signatureMethod === 'upload' ? 'bg-[#d90b2d]/10 text-[#d90b2d]' : 'text-slate-400 hover:text-slate-600'}`}>Upload</button>
                    </div>
                 </div>

                 {/* Signature Area */}
                 <div className="relative h-32 bg-slate-50 rounded-xl border-2 border-dashed border-slate-300 hover:border-[#d90b2d]/40 transition-colors overflow-hidden group">
                     {signatureMethod === 'draw' ? (
                         <>
                             <canvas
                                ref={canvasRef}
                                className="w-full h-full cursor-crosshair touch-none"
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                                onTouchStart={startDrawing}
                                onTouchMove={draw}
                                onTouchEnd={stopDrawing}
                             />
                             {isSignatureCaptured && <div className="absolute bottom-2 right-2 text-[10px] text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Signed</div>}
                             <button onClick={clearSignature} className="absolute top-2 right-2 p-1 bg-slate-200 rounded text-slate-400 hover:text-red-500"><RefreshCcw className="w-3 h-3"/></button>
                         </>
                     ) : (
                         <div className="w-full h-full flex flex-col items-center justify-center relative">
                             {agreementData.signatureData ? (
                                 <>
                                     <img src={agreementData.signatureData} alt="Sig" className="h-full w-full object-contain p-2" />
                                     <button onClick={() => updateAgreement({ signatureData: null })} className="absolute top-2 right-2 p-1 bg-white shadow-sm rounded-full text-red-500"><X className="w-3 h-3"/></button>
                                 </>
                             ) : (
                                 <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100">
                                     <input type="file" className="hidden" onChange={(e) => handleImageUpload(e, 'signature')} accept="image/*" />
                                     <PenTool className="w-5 h-5 text-slate-300 mb-1" />
                                     <span className="text-xs text-slate-400">Click to upload signature</span>
                                 </label>
                             )}
                         </div>
                     )}
                 </div>
             </div>
        </div>

        {/* Seal Upload & Email Copy */}
        <div className="flex flex-col md:flex-row gap-4">
             <div className="flex-1 flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                 <div className="shrink-0 bg-white p-1.5 rounded-lg border border-slate-200 shadow-sm w-12 h-12 flex items-center justify-center overflow-hidden relative">
                     {agreementData.sealData ? (
                         <img src={agreementData.sealData} alt="Seal" className="max-w-full max-h-full object-contain" />
                     ) : (
                         <PenTool className="w-5 h-5 text-slate-300" />
                     )}
                     {agreementData.sealData && (
                         <button onClick={() => updateAgreement({ sealData: null })} className="absolute inset-0 bg-black/50 text-white opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
                             <X className="w-4 h-4" />
                         </button>
                     )}
                 </div>
                 <div className="flex-1">
                     <p className="text-xs font-bold text-slate-700">Company Seal</p>
                     <p className="text-[10px] text-slate-400">Optional</p>
                 </div>
                 <label className="cursor-pointer bg-white border border-slate-300 text-slate-600 px-3 py-1.5 rounded-md text-xs font-medium hover:bg-[#d90b2d]/5 hover:text-[#d90b2d] transition-colors flex items-center gap-1">
                     <PenTool className="w-3 h-3" />
                     Upload
                     <input type="file" className="hidden" onChange={(e) => handleImageUpload(e, 'seal')} accept="image/*" />
                 </label>
            </div>
            
            <div className="flex-1 flex items-center space-x-2 bg-slate-50 px-4 py-3 rounded-lg border border-slate-200">
                <input 
                    type="checkbox" 
                    id="sendCopy"
                    checked={sendCopy}
                    onChange={(e) => setSendCopy(e.target.checked)}
                    className="w-4 h-4 text-[#d90b2d] rounded focus:ring-[#d90b2d] border-gray-300 cursor-pointer"
                />
                <label htmlFor="sendCopy" className="text-xs text-slate-700 cursor-pointer select-none flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <span>Email signed copy to <strong>{clientDetails.contactEmail || 'you'}</strong></span>
                </label>
            </div>
        </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-right-8 duration-500 pb-12">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-900">Review & Execute</h2>
           <p className="text-slate-500 text-sm mt-1">Review your project documents and sign below to proceed.</p>
        </div>
        <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#d90b2d] bg-[#d90b2d]/5 px-4 py-2 rounded-full border border-[#d90b2d]/20 shadow-sm">
                <ScrollText className="w-4 h-4" />
                <span>PREVIEW & SIGN MODE</span>
            </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6 h-[55vh]">
          {/* Sidebar Tabs */}
          <div className="md:w-64 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-row md:flex-col shrink-0 h-fit">
              <div className="p-4 bg-slate-50 border-b border-slate-200 hidden md:block">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Documents</span>
              </div>
              {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all w-full md:w-auto border-b-2 md:border-b-0 md:border-l-2 text-left ${
                        activeTab === tab.id 
                        ? 'border-[#d90b2d] bg-[#d90b2d]/5 text-[#d90b2d]' 
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <tab.icon className={`w-4 h-4 shrink-0 ${activeTab === tab.id ? 'text-[#d90b2d]' : 'text-slate-400'}`} />
                    <span className="truncate">{tab.label}</span>
                  </button>
              ))}
          </div>

          {/* Document Viewer */}
          <div className="flex-1 bg-white rounded-xl shadow-xl shadow-slate-200 border border-slate-200 overflow-hidden flex flex-col relative">
            
            {/* Document Sticky Header */}
            <div className="bg-slate-50/90 backdrop-blur border-b border-slate-200 px-6 py-4 flex justify-between items-center z-10 sticky top-0">
                <div className="flex items-center gap-2">
                    <div className="bg-[#d90b2d] p-1.5 rounded text-white">
                        {activeTabData.icon && <activeTabData.icon className="w-4 h-4" />}
                    </div>
                    <span className="font-bold text-slate-800 text-sm tracking-tight uppercase">
                        {activeTabData.label}
                    </span>
                </div>
                {activeTabData.file && (
                     <a href={previewUrls[activeTab]} download={activeTabData.file.name} className="text-xs text-[#d90b2d] hover:underline flex items-center gap-1">
                         <Download className="w-3 h-3" /> Download
                     </a>
                )}
            </div>

            {/* Content Area */}
            <div className="h-full overflow-y-auto bg-slate-100 flex-1 relative custom-scrollbar flex flex-col">
                
                {/* PDF VIEWER using OBJECT instead of IFRAME */}
                {activeTabData.file && activeTabData.file.type === 'application/pdf' && (
                    <div className="min-h-[500px] bg-white m-4 shadow-sm border border-slate-200 rounded-lg overflow-hidden relative">
                        <object 
                            data={previewUrls[activeTab]} 
                            type="application/pdf"
                            className="w-full h-[600px]"
                            onError={() => setPdfError(true)}
                        >
                            <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-slate-50">
                                <AlertCircle className="w-10 h-10 text-slate-400 mb-2" />
                                <p className="text-slate-600 font-medium">Unable to preview PDF directly.</p>
                                <a 
                                    href={previewUrls[activeTab]} 
                                    download={activeTabData.file.name}
                                    className="mt-4 px-4 py-2 bg-[#d90b2d] text-white rounded-lg text-sm hover:bg-[#111113] transition-colors flex items-center gap-2"
                                >
                                    <Download className="w-4 h-4" /> Download to View
                                </a>
                            </div>
                        </object>
                    </div>
                )}

                {/* DOCX HTML RENDER */}
                {activeTabData.file && docxContent[activeTab] && (
                     <div className="bg-white m-4 md:m-8 p-8 md:p-12 shadow-sm border border-slate-200 rounded-lg min-h-[600px]">
                         <div 
                            className="prose prose-sm md:prose-base max-w-none prose-headings:font-bold prose-a:text-[#d90b2d]"
                            dangerouslySetInnerHTML={{ __html: docxContent[activeTab] }} 
                         />
                     </div>
                )}

                {/* SUMMARY TAB CONTENT */}
                {activeTab === 'summary' && (
                    <div className="bg-white m-4 md:m-8 p-8 md:p-10 shadow-sm border border-slate-200 rounded-lg min-h-[600px] relative">
                        
                        {/* Summary Header without logo */}
                        <div className="mb-8 border-b border-slate-100 pb-6 flex flex-col md:flex-row justify-between items-start gap-4">
                            <div>
                                <h1 className="text-xl font-serif font-bold text-slate-800">
                                    Service Level Agreement {new Date().getFullYear()}
                                </h1>
                                <p className="text-[#d90b2d] text-sm font-bold mt-1 uppercase tracking-widest">Creative Nexus India</p>
                            </div>
                            <div className="text-left md:text-right">
                                <p className="text-slate-500 text-xs font-medium">
                                    Date: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </p>
                                {agreementData.ticketNumber && (
                                    <div className="flex items-center gap-1 md:justify-end text-xs text-slate-400 font-mono mt-1">
                                        <Hash className="w-3 h-3" />
                                        <span>{agreementData.ticketNumber}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                             <div className="p-4 bg-slate-50/50 rounded-lg border border-slate-100">
                                 <h3 className="text-[10px] font-bold uppercase text-slate-400 mb-2 tracking-wider">Agency Provider</h3>
                                 <p className="font-bold text-slate-800 text-sm">{AGENCY_DETAILS.name}</p>
                                 <p className="text-xs text-slate-500 whitespace-pre-line mt-1">{AGENCY_DETAILS.address}</p>
                                 <p className="text-xs text-slate-500 mt-1">{AGENCY_DETAILS.contact}</p>
                             </div>
                             <div className="p-4 bg-slate-50/50 rounded-lg border border-slate-100">
                                 <h3 className="text-[10px] font-bold uppercase text-slate-400 mb-2 tracking-wider">Client</h3>
                                 <p className="font-bold text-slate-800 text-sm">{clientDetails.companyName}</p>
                                 <p className="text-xs text-slate-500 mt-1">{clientDetails.billingAddress || 'Address not provided'}</p>
                                 <p className="text-xs text-slate-500 mt-1">{clientDetails.contactName} ({clientDetails.designation})</p>
                             </div>
                        </div>

                        <div className="bg-[#d90b2d]/5 p-6 rounded-xl border border-[#d90b2d]/10 mb-8">
                            <h3 className="font-bold text-[#d90b2d] text-sm mb-3 flex items-center gap-2">
                                <FileText className="w-4 h-4" /> Package Contents
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {tabs.filter(t => t.id !== 'summary').map(t => (
                                    <div key={t.id} className="flex items-center gap-2 text-xs text-[#d90b2d] bg-white/50 px-3 py-2 rounded-lg border border-[#d90b2d]/20">
                                        <Check className="w-3 h-3 text-[#d90b2d]" />
                                        <span className="font-medium">{t.label}</span>
                                        {t.file && <span className="text-[10px] opacity-60 ml-auto truncate max-w-[80px]">{t.file.name}</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
          </div>
      </div>

      <SignatureBlock />

      <div className="flex flex-col md:flex-row justify-between items-center pt-2 gap-4">
        <button
          onClick={onBack}
          disabled={isSubmitting}
          className="order-2 md:order-1 px-6 py-2.5 text-slate-500 hover:text-slate-800 font-medium transition-colors text-sm hover:bg-slate-100 rounded-lg disabled:opacity-50"
        >
          Modify Details
        </button>
        
        <div className="order-1 md:order-2 flex flex-col md:items-end gap-2 w-full md:w-auto">
             <button
              onClick={handleFinalize}
              disabled={!agreementData.signatureData || !agreementData.signerName || isSubmitting}
              className={`px-10 py-3 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-3 min-w-[240px] ${
                  (!agreementData.signatureData || !agreementData.signerName)
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-[#d90b2d] hover:bg-[#111113] text-white shadow-red-200 hover:shadow-red-300 transform hover:-translate-y-0.5'
              }`}
            >
              {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{statusText}</span>
                  </>
              ) : (
                  <>
                    <PenTool className="w-5 h-5" />
                    <span>Sign & Finalize</span>
                  </>
              )}
            </button>
            <p className="text-[11px] text-slate-400 text-center md:text-right">
                By clicking Finalize, you legally execute the attached agreements.
            </p>
        </div>
      </div>
      
      <GeminiAssistant />
    </div>
  );
};

export default StepTerms;