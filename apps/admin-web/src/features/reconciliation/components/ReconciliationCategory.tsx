'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@altitutor/ui';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@altitutor/ui';
import { cn } from '@/shared/utils/index';
import { ReconciliationItem } from './ReconciliationItem';
import type { ReconciliationCategoryData } from '../types';

interface ReconciliationCategoryProps {
  title: string;
  totalCount: number;
  data: ReconciliationCategoryData;
}

export function ReconciliationCategory({ title, totalCount, data }: ReconciliationCategoryProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (totalCount === 0) {
    return null; // Don't show categories with no items
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
            <CardTitle className="text-xl">{title}</CardTitle>
            <span className="text-sm text-muted-foreground">({totalCount})</span>
          </div>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Uninvoiced Sessions */}
          {data.items.uninvoiced_sessions && data.items.uninvoiced_sessions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">
                Uninvoiced Sessions ({data.items.uninvoiced_sessions.length})
              </h3>
              <div className="space-y-2">
                {data.items.uninvoiced_sessions.map((item) => (
                  <ReconciliationItem
                    key={item.sessions_students_id}
                    type="uninvoiced_sessions"
                    item={item}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Orphaned Invoice Items */}
          {data.items.orphaned_invoice_items && data.items.orphaned_invoice_items.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">
                Orphaned Invoice Items ({data.items.orphaned_invoice_items.length})
              </h3>
              <div className="space-y-2">
                {data.items.orphaned_invoice_items.map((item) => (
                  <ReconciliationItem
                    key={item.invoice_item_id}
                    type="orphaned_invoice_items"
                    item={item}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Unpaid Invoices */}
          {data.items.unpaid_invoices && data.items.unpaid_invoices.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">
                Unpaid Invoices ({data.items.unpaid_invoices.length})
              </h3>
              <div className="space-y-2">
                {data.items.unpaid_invoices.map((item) => (
                  <ReconciliationItem
                    key={item.id}
                    type="unpaid_invoices"
                    item={item}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Students Without Classes */}
          {data.items.students_without_classes && data.items.students_without_classes.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">
                Students Without Classes ({data.items.students_without_classes.length})
              </h3>
              <div className="space-y-2">
                {data.items.students_without_classes.map((item) => (
                  <ReconciliationItem
                    key={item.student_id}
                    type="students_without_classes"
                    item={item}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Unlogged Sessions */}
          {data.items.unlogged_sessions && data.items.unlogged_sessions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">
                Unlogged Sessions ({data.items.unlogged_sessions.length})
              </h3>
              <div className="space-y-2">
                {data.items.unlogged_sessions.map((item) => (
                  <ReconciliationItem
                    key={item.session_id}
                    type="unlogged_sessions"
                    item={item}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Unassigned Classes */}
          {data.items.unassigned_classes && data.items.unassigned_classes.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">
                Unassigned Classes ({data.items.unassigned_classes.length})
              </h3>
              <div className="space-y-2">
                {data.items.unassigned_classes.map((item) => (
                  <ReconciliationItem
                    key={item.class_id}
                    type="unassigned_classes"
                    item={item}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Unread Messages */}
          {data.items.unread_messages && data.items.unread_messages.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">
                Unread Messages ({data.items.unread_messages.length})
              </h3>
              <div className="space-y-2">
                {data.items.unread_messages.map((item) => (
                  <ReconciliationItem
                    key={item.conversation_id}
                    type="unread_messages"
                    item={item}
                  />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
