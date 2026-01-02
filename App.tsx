import React, { useState, useEffect } from 'react';
import { OnboardingData, Step } from './types';
import Header from './components/Header';
import ProgressBar from './components/ProgressBar';
import StepWelcome from './components/StepWelcome';
import StepClientInfo from './components/StepClientInfo';
import StepScope from './components/StepScope';
import StepTerms from './components/StepTerms';
import Success from './components/Success';

const initialData: OnboardingData = {
  step: Step.WELCOME,
  clientDetails: {
    companyName: '',
    gstNumber: '',
    billingAddress: '',
    contactName: '',
    designation: '',
    contactEmail: '',
    contactPhone: '',
    phoneCountryCode: '+91',
    financeEmail: ''
  },
  projectScope: {
    services: [],
    deliverables: '',
    customRequirements: '',
    momDocument: null,
    sowDocument: null,
    msaDocument: null,
    ndaDocument: null
  },
  agreement: {
    signatureData: null,
    sealData: null,
    signedDate: '',
    signerName: '',
    signerTitle: '',
    ticketNumber: ''
  }
};

const STORAGE_KEY = 'creative_nexus_onboarding_data';

const App: React.FC = () => {
  const [data, setData] = useState<OnboardingData>(() => {
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                return {
                    ...initialData,
                    ...parsed,
                    clientDetails: { 
                        ...initialData.clientDetails, 
                        ...parsed.clientDetails
                    },
                    projectScope: { 
                        ...initialData.projectScope, 
                        ...parsed.projectScope, 
                        momDocument: null, 
                        sowDocument: null, 
                        msaDocument: null, 
                        ndaDocument: null 
                    },
                    agreement: { ...initialData.agreement, ...parsed.agreement }
                };
            } catch (error) {
                console.error("Failed to load persistence data:", error);
                return initialData;
            }
        }
    }
    return initialData;
  });

  useEffect(() => {
    const dataToSave = {
        ...data,
        projectScope: {
            ...data.projectScope,
            momDocument: null,
            sowDocument: null,
            msaDocument: null,
            ndaDocument: null 
        }
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
  }, [data]);

  const nextStep = () => {
    setData(prev => {
      const nextState = { ...prev, step: prev.step + 1 };
      if (prev.step === Step.CLIENT_INFO && !prev.agreement.ticketNumber) {
          const company = prev.clientDetails.companyName || 'CLI';
          const shortCode = company.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase().padEnd(3, 'X');
          const date = new Date();
          const year = date.getFullYear();
          const day = String(date.getDate()).padStart(2, '0');
          const ticketNumber = `${shortCode}/${year}/${day}/101a`;
          nextState.agreement = { ...prev.agreement, ticketNumber };
      }
      return nextState;
    });
  };

  const prevStep = () => setData(prev => ({ ...prev, step: prev.step - 1 }));
  const jumpToSuccess = () => setData(prev => ({ ...prev, step: Step.SUCCESS }));

  const updateClientDetails = (details: Partial<typeof data.clientDetails>) => {
    setData(prev => ({ ...prev, clientDetails: { ...prev.clientDetails, ...details } }));
  };

  const updateScope = (scope: Partial<typeof data.projectScope>) => {
    setData(prev => ({ ...prev, projectScope: { ...prev.projectScope, ...scope } }));
  };

  const updateAgreement = (agreement: Partial<typeof data.agreement>) => {
    setData(prev => ({ ...prev, agreement: { ...prev.agreement, ...agreement } }));
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-8 md:py-12">
        {data.step !== Step.SUCCESS && <ProgressBar currentStep={data.step} />}
        <div className="bg-white/50 backdrop-blur-xl rounded-3xl p-6 md:p-10 shadow-xl shadow-slate-200/50 border border-white">
          {data.step === Step.WELCOME && <StepWelcome onNext={nextStep} />}
          {data.step === Step.CLIENT_INFO && (
            <StepClientInfo 
              data={data.clientDetails} 
              updateData={updateClientDetails} 
              onNext={nextStep} 
              onBack={prevStep} 
            />
          )}
          {data.step === Step.SCOPE && (
            <StepScope 
              data={data.projectScope} 
              updateData={updateScope} 
              onNext={nextStep} 
              onBack={prevStep} 
            />
          )}
          {data.step === Step.TERMS && (
            <StepTerms 
              clientDetails={data.clientDetails}
              projectScope={data.projectScope}
              agreementData={data.agreement}
              updateAgreement={updateAgreement}
              onComplete={jumpToSuccess} 
              onBack={prevStep} 
            />
          )}
          {data.step === Step.SUCCESS && (
            <Success 
              email={data.clientDetails.contactEmail} 
              timestamp={data.agreement.signedDate}
              ticketNumber={data.agreement.ticketNumber}
              clientDetails={data.clientDetails}
              projectScope={data.projectScope}
              agreement={data.agreement}
            />
          )}
        </div>
      </main>
      <footer className="py-6 text-center text-slate-400 text-sm">
        &copy; {new Date().getFullYear()} Creative Nexus India. All rights reserved.
      </footer>
    </div>
  );
};

export default App;