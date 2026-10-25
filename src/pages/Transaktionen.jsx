/* Transaktionsüberwachung: Journal aller Buchungen */
import React, { useState } from 'react';
import { PageHead } from '../components/ui.jsx';
import { Journal, TxDetail } from '../components/bank.jsx';

export default function Transaktionen() {
  const [detail, setDetail] = useState(null);
  const [tick, setTick] = useState(0);
  return (
    <div className="stack-lg">
      <PageHead title="Transaktionsüberwachung" sub="Alle Maisdollar-Buchungen · Klick auf eine Zeile öffnet Ledger, Audit und Storno" />
      <Journal onOpen={setDetail} refreshKey={tick} />
      {detail && <TxDetail id={detail} onClose={() => setDetail(null)} onChanged={() => setTick((x) => x + 1)} />}
    </div>
  );
}
