import { Navbar } from './components/Navbar';
import { BasicInfo } from './components/BasicInfo';
import { SplitLayout } from './components/SplitLayout';
import { TransactionModal } from './components/TransactionModal';
import { useState } from 'react';

export default function App() {
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [isDebitModalOpen, setIsDebitModalOpen] = useState(false);

  return (
    <div className="main-container">
      <div className="gradient-blob"></div>
      
      <div className="content-wrapper">
        <Navbar />
        <div className="pt-16">
          <BasicInfo 
            onOpenCreditModal={() => setIsCreditModalOpen(true)}
            onOpenDebitModal={() => setIsDebitModalOpen(true)}
          />
          <SplitLayout />
        </div>
      </div>

      <TransactionModal 
        isOpen={isCreditModalOpen} 
        onClose={() => setIsCreditModalOpen(false)} 
        type="credit"
      />
      <TransactionModal 
        isOpen={isDebitModalOpen} 
        onClose={() => setIsDebitModalOpen(false)} 
        type="debit"
      />
    </div>
  );
}