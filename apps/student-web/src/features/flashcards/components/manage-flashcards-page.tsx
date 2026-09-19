'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { FlashcardReviewCard } from '@altitutor/shared';
import { Button } from '@altitutor/ui';
import { StudentPageContainer } from '@/shared/components/layouts';

type HistoryRow={id:string;review_card_id:string;action:string;rating:string|null;answered_at:string;duration_ms:number|null;pre_state:Record<string,unknown>;post_state:Record<string,unknown>;undone_at:string|null};

export function ManageFlashcardsPage(){
  const [cards,setCards]=useState<FlashcardReviewCard[]>([]); const [history,setHistory]=useState<HistoryRow[]>([]);const [showAll,setShowAll]=useState(false);
  const load=useCallback(async()=>{
    const [cardsResponse,historyResponse]=await Promise.all([fetch('/api/flashcards/review-cards?mode=all',{cache:'no-store'}),fetch('/api/flashcards/review-cards/history',{cache:'no-store'})]);
    setCards((await cardsResponse.json()).data ?? []); setHistory((await historyResponse.json()).data ?? []);
  },[]);
  useEffect(()=>{void load();},[load]);
  const command=async(card:FlashcardReviewCard,action:'forget'|'suspend'|'resume'|'bury'|'unbury')=>{
    if(action==='forget'&&!window.confirm('Reset this card to New? Its history will be retained.')) return;
    await fetch(`/api/flashcards/review-cards/${card.id}/manage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,requestId:crypto.randomUUID()})}); await load();
  };
  const managed=showAll?cards:cards.filter(card=>card.suspended_at||card.buried_until||card.leech_at);
  return <StudentPageContainer className="space-y-6">
    <div><Link href="/resources/flashcards" className="text-sm text-muted-foreground">← Flashcards</Link><h1 className="mt-2 text-3xl font-bold">Manage flashcards</h1>
      <p className="text-muted-foreground">Suspended, buried and leech cards. Cards are never suspended automatically.</p></div>
    <div className="flex gap-2">{cards.some(card=>card.buried_until)&&<Button variant="outline" onClick={()=>void Promise.all(cards.filter(c=>c.buried_until).map(c=>command(c,'unbury')))}>Unbury all</Button>}<Button variant="ghost" onClick={()=>setShowAll(value=>!value)}>{showAll?'Show managed cards':'Show all cards and history'}</Button></div>
    <div className="space-y-3">{managed.map(card=><div key={card.id} className="rounded-xl border p-4"><p className="font-medium">{card.cloze_text ?? card.image_alt_text ?? `Card ${card.cloze_index}`}</p>
      <p className="mt-1 text-sm text-muted-foreground">{card.suspended_at?'Suspended ':''}{card.buried_until?`Buried until ${new Date(card.buried_until).toLocaleString()} `:''}{card.leech_at?'Leech':''}</p>
      <div className="mt-3 flex flex-wrap gap-2">{card.suspended_at?<Button size="sm" onClick={()=>void command(card,'resume')}>Resume</Button>:<Button size="sm" variant="outline" onClick={()=>void command(card,'suspend')}>Suspend</Button>}
      {card.buried_until?<Button size="sm" onClick={()=>void command(card,'unbury')}>Unbury</Button>:<Button size="sm" variant="outline" onClick={()=>void command(card,'bury')}>Bury</Button>}
      <Button size="sm" variant="destructive" onClick={()=>void command(card,'forget')}>Forget</Button></div>
      <details className="mt-3"><summary className="cursor-pointer text-sm">History</summary><div className="mt-2 space-y-2 text-xs">{history.filter(row=>row.review_card_id===card.id).map(row=><div key={row.id} className="rounded bg-muted p-2">
        {new Date(row.answered_at).toLocaleString()} · {row.rating ?? row.action}{row.undone_at?' · undone':''} · {row.duration_ms!=null?`${Math.round(row.duration_ms/1000)}s`:''}
        <div>{String(row.pre_state.state)} → {String(row.post_state.state)} · {String(row.pre_state.scheduled_days)}d → {String(row.post_state.scheduled_days)}d</div></div>)}</div></details>
    </div>)}{managed.length===0?<p className="rounded-xl border p-6 text-center text-muted-foreground">No suspended, buried or leech cards.</p>:null}</div>
  </StudentPageContainer>;
}
