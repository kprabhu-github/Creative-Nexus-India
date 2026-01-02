
import React, { useState } from 'react';
import { ClientDetails } from '../types';
import { User, Building2, CreditCard, Mail, Phone, MapPin, AlertCircle, Briefcase } from 'lucide-react';

interface Props {
  data: ClientDetails;
  updateData: (data: Partial<ClientDetails>) => void;
  onNext: () => void;
  onBack: () => void;
}

const COUNTRY_CODES = [
  { code: '+91', country: 'IN (+91)' },
  { code: '+1', country: 'US/CA (+1)' },
  { code: '+44', country: 'UK (+44)' },
  { code: '+61', country: 'AU (+61)' },
  { code: '+971', country: 'UAE (+971)' },
  { code: '+65', country: 'SG (+65)' },
  { code: '+81', country: 'JP (+81)' },
  { code: '+49', country: 'DE (+49)' },
];

const StepClientInfo: React.FC<Props> = ({ data, updateData, onNext, onBack }) => {
  const [emailError, setEmailError] = useState('');
  const [financeEmailError, setFinanceEmailError] = useState('');

  const validateEmailFormat = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'contactEmail' && value) {
        if (!validateEmailFormat(value)) {
            setEmailError('Please enter a valid email address.');
        }
    }
    if (name === 'financeEmail' && value) {
        if (!validateEmailFormat(value)) {
            setFinanceEmailError('Please enter a valid email address.');
        }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    if (name === 'contactName') {
      if (value && !/^[a-zA-Z\s]*$/.test(value)) return;
    }

    if (name === 'contactPhone') {
      if (value && !/^\d*$/.test(value)) return;
    }

    if (name === 'contactEmail') setEmailError('');
    if (name === 'financeEmail') setFinanceEmailError('');

    updateData({ [name]: value });
  };

  const isEmailValid = data.contactEmail && validateEmailFormat(data.contactEmail);
  const isFormValid = data.companyName && data.contactName && data.designation && isEmailValid && !emailError;

  // Fix: Making children optional (?) in the Label component definition to resolve TS missing property error
  const Label = ({ children, icon: Icon }: { children?: React.ReactNode, icon: any }) => (
    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] flex items-center gap-2 mb-1.5 ml-1">
        <Icon className="w-3.5 h-3.5 text-slate-300" />
        {children}
    </label>
  );

  const InputClass = "w-full px-4 py-2.5 bg-white text-slate-900 border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-[#d90b2d]/10 focus:border-[#d90b2d] outline-none transition-all placeholder:text-slate-300";

  return (
    <div className="max-w-3xl mx-auto space-y-10 animate-in fade-in slide-in-from-right-8 duration-500">
      <div className="space-y-1 text-center md:text-left">
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Client Information</h2>
        <p className="text-slate-500">Provide your official company details for the billing system.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        <div className="col-span-2 md:col-span-1 space-y-1">
          <Label icon={Building2}>Company Name *</Label>
          <input
            type="text"
            name="companyName"
            value={data.companyName}
            onChange={handleChange}
            placeholder="e.g. Acme Corp"
            className={InputClass}
          />
        </div>

        <div className="col-span-2 md:col-span-1 space-y-1">
          <Label icon={CreditCard}>GST Number (If applicable)</Label>
          <input
            type="text"
            name="gstNumber"
            value={data.gstNumber}
            onChange={handleChange}
            placeholder="GSTIN12345"
            className={InputClass}
          />
        </div>

        <div className="col-span-2 space-y-1">
          <Label icon={MapPin}>Billing Address</Label>
          <input
            type="text"
            name="billingAddress"
            value={data.billingAddress}
            onChange={handleChange}
            placeholder="123 Business Park, Creative Road..."
            className={InputClass}
          />
        </div>

        <div className="col-span-2 py-2 flex items-center gap-4 opacity-50">
            <div className="h-px bg-slate-200 flex-1"></div>
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Contact Person</span>
            <div className="h-px bg-slate-200 flex-1"></div>
        </div>

        <div className="space-y-1">
          <Label icon={User}>Contact Name *</Label>
          <input
            type="text"
            name="contactName"
            value={data.contactName}
            onChange={handleChange}
            placeholder="John Doe"
            className={InputClass}
          />
          <p className="text-[10px] text-slate-300 ml-1">Alphabets only</p>
        </div>

        <div className="space-y-1">
          <Label icon={Briefcase}>Title / Designation *</Label>
          <input
            type="text"
            name="designation"
            value={data.designation}
            onChange={handleChange}
            placeholder="e.g. CEO, Marketing Manager"
            className={InputClass}
          />
        </div>

        <div className="space-y-1">
          <Label icon={Phone}>Phone No.</Label>
          <div className="flex gap-2">
             <select 
                name="phoneCountryCode"
                value={data.phoneCountryCode || '+91'} 
                onChange={handleChange}
                className="w-24 px-2 py-2.5 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-[#d90b2d]/10 focus:border-[#d90b2d] outline-none text-sm"
             >
                {COUNTRY_CODES.map(c => (
                    <option key={c.code} value={c.code}>{c.country}</option>
                ))}
             </select>
             <input
                type="tel"
                name="contactPhone"
                value={data.contactPhone}
                onChange={handleChange}
                placeholder="9876543210"
                className={InputClass}
             />
          </div>
        </div>

        <div className="space-y-1">
          <Label icon={Mail}>Email ID *</Label>
          <input
            type="email"
            name="contactEmail"
            value={data.contactEmail}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="john@example.com"
            className={`${InputClass} ${emailError ? 'border-red-300 bg-red-50 focus:ring-red-100 focus:border-red-400' : ''}`}
          />
          {emailError && (
              <p className="text-[10px] text-red-500 flex items-center gap-1 mt-1 ml-1">
                  <AlertCircle className="w-3 h-3" /> {emailError}
              </p>
          )}
        </div>

        <div className="col-span-2 space-y-1">
          <Label icon={Mail}>Accounts/Finance Email</Label>
          <input
            type="email"
            name="financeEmail"
            value={data.financeEmail}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="finance@example.com"
            className={`${InputClass} ${financeEmailError ? 'border-red-300 bg-red-50 focus:ring-red-100 focus:border-red-400' : ''}`}
          />
           {financeEmailError && (
              <p className="text-[10px] text-red-500 flex items-center gap-1 mt-1 ml-1">
                  <AlertCircle className="w-3 h-3" /> {financeEmailError}
              </p>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center pt-8 border-t border-slate-100">
        <button
          onClick={onBack}
          className="px-6 py-2.5 text-slate-400 hover:text-slate-900 font-bold text-xs uppercase tracking-widest transition-all"
        >
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!isFormValid}
          className={`px-10 py-3 rounded-xl font-bold transition-all ${
            isFormValid 
              ? 'bg-[#d90b2d] text-white hover:bg-[#111113] shadow-lg shadow-red-200 hover:-translate-y-0.5' 
              : 'bg-slate-100 text-slate-300 cursor-not-allowed'
          }`}
        >
          Project Scope
        </button>
      </div>
    </div>
  );
};

export default StepClientInfo;
