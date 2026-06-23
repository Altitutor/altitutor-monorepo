'use client';

import { useMemo, useState } from 'react';
import { Button } from '@altitutor/ui';
import { Pencil, Trash2 } from 'lucide-react';
import { getClozeIndexes, renderClozeQuestionText } from '@altitutor/shared';
import { useFlashcardCollections, useFlashcardMutations, useFlashcards } from '../hooks/useFlashcards';

export function FlashcardManager({ topicId }: { topicId: string }) {
  const { data: collections = [] } = useFlashcardCollections(topicId);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const selectedCollectionId = activeCollectionId ?? collections[0]?.id ?? null;
  const selectedCollection = useMemo(
    () => collections.find((collection) => collection.id === selectedCollectionId) ?? null,
    [collections, selectedCollectionId],
  );
  const { data: cards = [] } = useFlashcards(selectedCollectionId);
  const mutations = useFlashcardMutations(topicId, selectedCollectionId);
  const [collectionTitle, setCollectionTitle] = useState('');
  const [collectionDescription, setCollectionDescription] = useState('');
  const [cardTitle, setCardTitle] = useState('');
  const [clozeText, setClozeText] = useState('');
  const [extra, setExtra] = useState('');
  const [csv, setCsv] = useState('');
  const [importMessage, setImportMessage] = useState<string | null>(null);

  return (
    <section className="space-y-5 rounded-lg border bg-card p-5" aria-labelledby="flashcards-heading">
      <div>
        <h2 id="flashcards-heading" className="text-2xl font-semibold">
          Flashcards
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Cloze-only cards linked to this topic.</p>
      </div>

      <form
        className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"
        onSubmit={async (event) => {
          event.preventDefault();
          const created = await mutations.createCollection.mutateAsync({
            topicId,
            title: collectionTitle,
            description: collectionDescription,
          });
          setActiveCollectionId(created.id);
          setCollectionTitle('');
          setCollectionDescription('');
        }}
      >
        <input value={collectionTitle} onChange={(event) => setCollectionTitle(event.target.value)} placeholder="Collection title" className="h-10 rounded-md border bg-background px-3 text-sm" required />
        <input value={collectionDescription} onChange={(event) => setCollectionDescription(event.target.value)} placeholder="Description" className="h-10 rounded-md border bg-background px-3 text-sm" />
        <Button type="submit" disabled={mutations.createCollection.isPending}>Add collection</Button>
      </form>

      {collections.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {collections.map((collection) => (
            <Button key={collection.id} type="button" variant={collection.id === selectedCollectionId ? 'default' : 'outline'} onClick={() => setActiveCollectionId(collection.id)}>
              {collection.title} ({collection.review_card_count ?? 0})
            </Button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No flashcard collections yet.</p>
      )}

      {selectedCollection ? (
        <div className="space-y-5 rounded-lg border p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">{selectedCollection.title}</h3>
              {selectedCollection.description ? <p className="text-sm text-muted-foreground">{selectedCollection.description}</p> : null}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                const title = window.prompt('Collection title', selectedCollection.title);
                if (title == null || !title.trim()) return;
                const description = window.prompt('Description', selectedCollection.description ?? '') ?? '';
                mutations.updateCollection.mutate({ collectionId: selectedCollection.id, title, description });
              }}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
            <Button type="button" variant="outline" size="sm" className="gap-1.5 text-destructive" onClick={() => mutations.deleteCollection.mutate(selectedCollection.id)}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>

          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault();
              await mutations.createCard.mutateAsync({ collectionId: selectedCollection.id, title: cardTitle, clozeText, extra });
              setCardTitle('');
              setClozeText('');
              setExtra('');
            }}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <input value={cardTitle} onChange={(event) => setCardTitle(event.target.value)} placeholder="Card title" className="h-10 rounded-md border bg-background px-3 text-sm" />
              <input value={extra} onChange={(event) => setExtra(event.target.value)} placeholder="Extra context shown after reveal" className="h-10 rounded-md border bg-background px-3 text-sm" />
            </div>
            <textarea value={clozeText} onChange={(event) => setClozeText(event.target.value)} placeholder="The {{c1::mitochondria}} is the powerhouse of the cell." className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm" required />
            <Button type="submit" disabled={mutations.createCard.isPending}>Add cloze card</Button>
          </form>

          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault();
              const result = await mutations.importCsv.mutateAsync({ id: selectedCollection.id, csv });
              setImportMessage(`Imported ${result.inserted} cards${result.rejected.length ? `; rejected ${result.rejected.length} rows` : ''}`);
              setCsv('');
            }}
          >
            <textarea value={csv} onChange={(event) => setCsv(event.target.value)} placeholder={'text,title,order,extra\n"{{c1::Cell membrane}} controls movement",Biology,1,"Remember selective permeability"'} className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm" />
            <div className="flex items-center gap-3">
              <Button type="submit" variant="outline" disabled={!csv.trim() || mutations.importCsv.isPending}>Import CSV</Button>
              {importMessage ? <p className="text-sm text-muted-foreground">{importMessage}</p> : null}
            </div>
          </form>

          <div className="space-y-2">
            {cards.map((card) => (
              <div key={card.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    {card.title ? <p className="font-medium">{card.title}</p> : null}
                    <p className="whitespace-pre-wrap text-muted-foreground">{renderClozeQuestionText(card.cloze_text, getClozeIndexes(card.cloze_text)[0] ?? 1)}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      const title = window.prompt('Card title', card.title ?? '') ?? '';
                      const cloze = window.prompt('Cloze text', card.cloze_text);
                      if (cloze == null || !cloze.trim()) return;
                      const nextExtra = window.prompt('Extra context', card.extra ?? '') ?? '';
                      mutations.updateCard.mutate({ cardId: card.id, title, clozeText: cloze, extra: nextExtra });
                    }}
                    aria-label="Edit flashcard"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => mutations.deleteCard.mutate(card.id)} aria-label="Delete flashcard">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
