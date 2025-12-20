import { Navbar } from './components/Navbar';
import { BasicInfo } from './components/BasicInfo';
import { SplitLayout } from './components/SplitLayout';
import { TransactionModal } from './components/TransactionModal';
import { useState, useMemo } from 'react';
import { getUserId } from './api/client';

export default function HomePage({ user }) {
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [isDebitModalOpen, setIsDebitModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const userId = useMemo(() => getUserId(), []);

  const handleTransactionAdded = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="main-container">
      <div className="gradient-blob"></div>
      
      <div className="content-wrapper">
        <Navbar />
        <div className="pt-16">
          <BasicInfo 
            onOpenCreditModal={() => setIsCreditModalOpen(true)}
            onOpenDebitModal={() => setIsDebitModalOpen(true)}
            userId={userId}
            refreshKey={refreshKey}
          />
          <SplitLayout userId={userId} refreshKey={refreshKey} />
        </div>
      </div>

      <TransactionModal 
        isOpen={isCreditModalOpen} 
        onClose={() => setIsCreditModalOpen(false)} 
        type="credit"
        userId={userId}
        onTransactionAdded={handleTransactionAdded}
      />
      <TransactionModal 
        isOpen={isDebitModalOpen} 
        onClose={() => setIsDebitModalOpen(false)} 
        type="debit"
        userId={userId}
        onTransactionAdded={handleTransactionAdded}
      />
    </div>
  );
}
