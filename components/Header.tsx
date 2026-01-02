import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="bg-white border-b border-slate-100 py-3 px-6 sticky top-0 z-40 bg-opacity-90 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <span className="font-bold text-xl tracking-tight text-slate-900">
            Creative <span className="text-[#d90b2d]">Nexus</span>
          </span>
        </div>
      </div>
    </header>
  );
};

export default Header;