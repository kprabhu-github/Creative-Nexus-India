import React, { useState, useEffect } from 'react';
import { Download, Mail, RefreshCw, Clock, Hash, Loader2, Database, ShieldCheck, ChevronDown, ChevronUp, Code } from 'lucide-react';
import { ClientDetails, ProjectScope, AgreementState, DatabaseRecord } from '../types';
import { generateSignedPDF } from '../services/pdfService';
import JitsiMeetingModule from './JitsiMeetingModule';

interface Props {
  email: string;
  timestamp?: string;
  ticketNumber?: string;
  clientDetails: ClientDetails;
  projectScope: ProjectScope;
  agreement: AgreementState;
}

const Success: React.FC<Props> = ({ 
  email, 
  timestamp, 
  ticketNumber, 
  clientDetails, 
  projectScope, 
  agreement 
}) => {
  const [isResending, setIsResending] = useState(false);
  const [resendStatus, setResendStatus] = useState("Resend Receipt");
  const [isDownloading, setIsDownloading] = useState(false);
  const [isArchiving, setIsArchiving] = useState(true);
  const [showVault, setShowVault] = useState(false);

  // Simulate Database Archiving
  useEffect(() => {
    const timer = setTimeout(() => setIsArchiving(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  const handleResend = () => {
    setIsResending(true);
    setResendStatus("Sending...");
    setTimeout(() => {
        setIsResending(false);
        setResendStatus("Sent!");
        setTimeout(() => setResendStatus("Resend Receipt"), 2000);
    }, 1500);
  };

  const handleDownload = () => {
    setIsDownloading(true);
    setTimeout(async () => {
        try {
            const blob = await generateSignedPDF(clientDetails, projectScope, agreement);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const safeName = clientDetails.companyName.replace(/[^a-zA-Z0-9]/g, '_') || 'Client';
            link.download = `Executed_Agreement_${safeName}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Error generating PDF:", error);
            alert("There was an error generating your PDF. Please try again.");
        } finally {
            setIsDownloading(false);
        }
    }, 100);
  };

  const storageObject: DatabaseRecord = {
    id: ticketNumber || "NEX-000",
    status: 'EXECUTED',
    client: {
        name: clientDetails.companyName,
        email: clientDetails.contactEmail,
        taxId: clientDetails.gstNumber
    },
    deal: {
        services: projectScope.services,
        signedAt: timestamp || new Date().toISOString(),
        signer: `${agreement.signerName} (${agreement.signerTitle})`
    },
    audit: {
        originIp: "182.70.xx.xx (Masked)",
        platform: "Creative Nexus Digital Onboarding v2.5",
        hash: `SHA256:${Math.random().toString(36).substring(2, 15)}`
    }
  };

  if (isArchiving) {
    return (
        <div className="flex flex-col items-center justify-center py-24 space-y-6 animate-pulse">
            <div className="relative">
                <Database className="w-16 h-16 text-[#d90b2d]" />
                <div className="absolute inset-0 border-4 border-[#d90b2d] border-t-transparent rounded-full animate-spin"></div>
            </div>
            <div className="text-center">
                <h2 className="text-xl font-bold text-slate-800 tracking-tight">Securing Digital Vault...</h2>
                <p className="text-sm text-slate-500 mt-2">Indexing contract {ticketNumber} for secure archival.</p>
            </div>
        </div>
    );
  }

  return (
    <div className="text-center space-y-8 animate-in fade-in zoom-in duration-500 py-6">
      <div className="space-y-4">
        <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-4 py-1.5 rounded-full border border-green-100 text-sm font-bold animate-bounce mb-2">
            <ShieldCheck className="w-4 h-4" />
            RECORD SUCCESSFULLY ARCHIVED
        </div>
        <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Onboarding Complete</h1>
        <p className="text-lg text-slate-600 max-w-xl mx-auto leading-relaxed">
          The agreement for <span className="font-bold text-slate-900">{clientDetails.companyName}</span> has been digitally executed and safely stored in our secure database.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-left">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <div className="w-2 h-4 bg-[#d90b2d] rounded-full"></div>
                Action Items
            </h3>
            <ul className="space-y-3 text-sm text-slate-600">
                <li className="flex items-start gap-3">
                    <span className="bg-slate-100 text-slate-500 w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold shrink-0 mt-0.5">01</span>
                    PDF Copy sent to: <span className="font-medium text-slate-900 truncate max-w-[120px]">{email}</span>
                </li>
                <li className="flex items-start gap-3">
                    <span className="bg-slate-100 text-slate-500 w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold shrink-0 mt-0.5">02</span>
                    50% Advance Invoice generated.
                </li>
                <li className="flex items-start gap-3">
                    <span className="bg-slate-100 text-slate-500 w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold shrink-0 mt-0.5">03</span>
                    Project timeline added to internal CRM.
                </li>
            </ul>
          </div>

          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4 text-left text-slate-300">
            <h3 className="font-bold text-white flex items-center gap-2">
                <Hash className="w-4 h-4 text-[#d90b2d]" />
                Audit Trail
            </h3>
            <div className="space-y-3 text-[11px] font-mono">
                <div className="flex justify-between border-b border-slate-800 pb-2">
                    <span className="text-slate-500">REF NUMBER</span>
                    <span className="text-white">{ticketNumber}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-2">
                    <span className="text-slate-500">SIGNED AT</span>
                    <span className="text-white">{timestamp?.split(',')[0]}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-2">
                    <span className="text-slate-500">SIGNER IP</span>
                    <span className="text-white">182.70.xx.xx</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-slate-500">STATUS</span>
                    <span className="text-green-400 font-bold">LEGALLY BINDING</span>
                </div>
            </div>
          </div>
      </div>

      <div className="max-w-3xl mx-auto">
          <button 
            onClick={() => setShowVault(!showVault)}
            className="flex items-center gap-2 mx-auto text-xs font-bold text-slate-400 hover:text-[#d90b2d] transition-colors"
          >
              <Code className="w-3 h-3" />
              {showVault ? "HIDE STORAGE OBJECT" : "VIEW DATABASE STRUCTURE (MANAGE PHASE)"}
              {showVault ? <ChevronDown className="w-3 h-3 rotate-180" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          
          {showVault && (
              <div className="mt-4 text-left bg-slate-50 border border-slate-200 rounded-xl p-4 font-mono text-[10px] overflow-x-auto animate-in slide-in-from-top-2">
                  <pre className="text-slate-600">
                    {JSON.stringify(storageObject, null, 2)}
                  </pre>
              </div>
          )}
      </div>

      <div className="flex justify-center space-x-4">
        <button 
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex items-center space-x-2 px-6 py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-slate-700 font-medium disabled:opacity-70 disabled:cursor-wait"
        >
            {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>{isDownloading ? 'Downloading...' : 'Download PDF'}</span>
        </button>
        <button 
            onClick={handleResend}
            disabled={isResending}
            className={`flex items-center space-x-2 px-6 py-2.5 rounded-lg transition-colors font-medium min-w-[160px] justify-center ${
                resendStatus === 'Sent!' 
                ? 'bg-green-600 text-white' 
                : 'bg-[#d90b2d] text-white hover:bg-[#111113]'
            }`}
        >
            {isResending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            <span>{resendStatus}</span>
        </button>
      </div>


      <JitsiMeetingModule />
    </div>
  );
};

export default Success;