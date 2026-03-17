'use client';

import { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Input,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Label,
  Switch,
  SearchableSelect,
} from '@altitutor/ui';
import { Edit2, Plus, Trash2, Phone } from 'lucide-react';
import {
  callRoutingApi,
  type CallRoutingRule,
  type CallRoutingRuleType,
  type MessageType,
  type OwnedNumber,
} from '../api/call-routing';
import {
  ExpandButton,
  EXPANDABLE_DIALOG_TRANSITION,
  EXPANDED_DIALOG_CONTENT_CLASS,
} from '@/shared/components/expandable-dialog';
import { cn } from '@/shared/utils';

interface CallRoutingRulesTableProps {
  rules: CallRoutingRule[];
  ownedNumbers: OwnedNumber[];
  onUpdate: () => void;
}

const RULE_TYPES: { id: CallRoutingRuleType; label: string; description: string }[] = [
  { id: 'BUSINESS_HOURS', label: 'Business Hours', description: 'Forward calls during opening hours' },
  { id: 'ON_CALL', label: 'On-Call', description: 'Forward calls to on-call staff when not during business hours' },
  { id: 'DEFAULT', label: 'Default', description: 'Play message when no other rules match' },
];

const MESSAGE_TYPES: { id: MessageType; label: string }[] = [
  { id: 'TTS', label: 'Text-to-Speech' },
  { id: 'AUDIO', label: 'Prerecorded Audio' },
];

const TRIGGER_BUTTON_CLASS = 'w-full justify-start font-normal';

const DEFAULT_PRIORITIES: Record<CallRoutingRuleType, number> = {
  BUSINESS_HOURS: 0,
  ON_CALL: 50,
  DEFAULT: 100,
};

export function CallRoutingRulesTable({ rules, ownedNumbers, onUpdate }: CallRoutingRulesTableProps) {
  const [editingRule, setEditingRule] = useState<CallRoutingRule | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editExpanded, setEditExpanded] = useState(false);
  const [addExpanded, setAddExpanded] = useState(false);

  useEffect(() => {
    if (!editingRule) setEditExpanded(false);
  }, [editingRule]);

  useEffect(() => {
    if (!isAddDialogOpen) setAddExpanded(false);
  }, [isAddDialogOpen]);

  // Form state
  const [selectedOwnedNumberId, setSelectedOwnedNumberId] = useState<string>('');
  const [ruleType, setRuleType] = useState<CallRoutingRuleType>('BUSINESS_HOURS');
  const [priority, setPriority] = useState<number>(0);
  const [forwardToPhone, setForwardToPhone] = useState<string>('');
  const [messageType, setMessageType] = useState<MessageType>('TTS');
  const [messageText, setMessageText] = useState<string>('');
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [isActive, setIsActive] = useState<boolean>(true);

  useEffect(() => {
    if (ownedNumbers.length > 0 && !selectedOwnedNumberId) {
      setSelectedOwnedNumberId(ownedNumbers[0].id);
    }
  }, [ownedNumbers, selectedOwnedNumberId]);

  const resetForm = () => {
    setSelectedOwnedNumberId(ownedNumbers[0]?.id || '');
    setRuleType('BUSINESS_HOURS');
    setPriority(DEFAULT_PRIORITIES.BUSINESS_HOURS);
    setForwardToPhone('');
    setMessageType('TTS');
    setMessageText('');
    setAudioUrl('');
    setIsActive(true);
  };

  const handleEdit = (rule: CallRoutingRule) => {
    setEditingRule(rule);
    setSelectedOwnedNumberId(rule.owned_number_id);
    setRuleType(rule.rule_type as CallRoutingRuleType);
    setPriority(rule.priority);
    setForwardToPhone(rule.forward_to_phone || '');
    setMessageType((rule.message_type as MessageType) || 'TTS');
    setMessageText(rule.message_text || '');
    setAudioUrl(rule.audio_url || '');
    setIsActive(rule.is_active ?? true);
  };

  const handleSave = async () => {
    if (!editingRule) return;
    setSaving(true);
    try {
      await callRoutingApi.updateRoutingRule(editingRule.id, {
        rule_type: ruleType,
        priority,
        forward_to_phone: ruleType === 'BUSINESS_HOURS' ? forwardToPhone : null,
        message_type: ruleType === 'DEFAULT' ? messageType : null,
        message_text: ruleType === 'DEFAULT' ? messageText : null,
        audio_url: ruleType === 'DEFAULT' && messageType === 'AUDIO' ? audioUrl : null,
        is_active: isActive,
      });
      setEditingRule(null);
      resetForm();
      onUpdate();
    } catch (e) {
      alert('Failed to update: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    if (!selectedOwnedNumberId) {
      alert('Please select a phone number');
      return;
    }
    setSaving(true);
    try {
      await callRoutingApi.createRoutingRule({
        owned_number_id: selectedOwnedNumberId,
        rule_type: ruleType,
        priority,
        forward_to_phone: ruleType === 'BUSINESS_HOURS' ? forwardToPhone : null,
        message_type: ruleType === 'DEFAULT' ? messageType : null,
        message_text: ruleType === 'DEFAULT' ? messageText : null,
        audio_url: ruleType === 'DEFAULT' && messageType === 'AUDIO' ? audioUrl : null,
        is_active: isActive,
      });
      setIsAddDialogOpen(false);
      resetForm();
      onUpdate();
    } catch (e) {
      alert('Failed to create: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this routing rule?')) return;
    setDeleting(id);
    try {
      await callRoutingApi.deleteRoutingRule(id);
      onUpdate();
    } catch (e) {
      alert('Failed to delete: ' + (e as Error).message);
    } finally {
      setDeleting(null);
    }
  };


  const rulesByNumber = ownedNumbers.map(number => ({
    number,
    rules: rules.filter(r => r.owned_number_id === number.id).sort((a, b) => a.priority - b.priority),
  }));

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">Call Routing Rules</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure how incoming calls are routed. Lower priority numbers are evaluated first.
          </p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Rule
        </Button>
      </div>

      <div className="space-y-6">
        {rulesByNumber.map(({ number, rules: numberRules }) => (
          <div key={number.id} className="border rounded-lg">
            <div className="p-4 bg-muted/50 border-b">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                <span className="font-semibold">{number.label || number.phone_e164}</span>
                {number.is_default && (
                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded">Default</span>
                )}
              </div>
            </div>
            {numberRules.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No routing rules configured. Add a rule to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {numberRules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell className="font-medium">
                        {RULE_TYPES.find(t => t.id === rule.rule_type)?.label || rule.rule_type}
                      </TableCell>
                      <TableCell>{rule.priority}</TableCell>
                      <TableCell>
                        {rule.rule_type === 'BUSINESS_HOURS' && rule.forward_to_phone && (
                          <span className="text-sm">{rule.forward_to_phone}</span>
                        )}
                        {rule.rule_type === 'ON_CALL' && (
                          <span className="text-sm text-muted-foreground">Forward to on-call staff</span>
                        )}
                        {rule.rule_type === 'DEFAULT' && (
                          <span className="text-sm text-muted-foreground">
                            {rule.message_type === 'AUDIO' ? 'Play audio' : 'Text-to-speech'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs ${
                          rule.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {rule.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(rule)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(rule.id)}
                            disabled={deleting === rule.id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingRule} onOpenChange={() => setEditingRule(null)}>
        <DialogContent
          className={cn(
            'max-w-2xl max-h-[90vh] overflow-y-auto',
            EXPANDABLE_DIALOG_TRANSITION,
            editExpanded && EXPANDED_DIALOG_CONTENT_CLASS
          )}
        >
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <DialogTitle>Edit Call Routing Rule</DialogTitle>
                <DialogDescription>
                  Update the routing rule configuration
                </DialogDescription>
              </div>
              <ExpandButton expanded={editExpanded} onToggle={() => setEditExpanded((e) => !e)} />
            </div>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-rule-type">Rule Type</Label>
              <SearchableSelect<(typeof RULE_TYPES)[number]>
                items={RULE_TYPES}
                value={RULE_TYPES.find((t) => t.id === ruleType) ?? null}
                onValueChange={(item) => {
                  if (item) {
                    setRuleType(item.id);
                    setPriority(DEFAULT_PRIORITIES[item.id]);
                  }
                }}
                getItemId={(t) => t.id}
                getItemLabel={(t) => t.label}
                placeholder="Select rule type"
                searchPlaceholder="Search rule types..."
                emptyMessage="No rule types found"
                renderItem={(type, isSelected) => (
                  <div className="flex flex-col gap-0.5">
                    <span className={isSelected ? 'font-medium' : ''}>{type.label}</span>
                    <span className="text-xs text-muted-foreground">{type.description}</span>
                  </div>
                )}
                trigger={
                  <Button variant="outline" id="edit-rule-type" className={TRIGGER_BUTTON_CLASS}>
                    {RULE_TYPES.find((t) => t.id === ruleType)?.label ?? 'Select rule type'}
                  </Button>
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-priority">Priority</Label>
              <Input
                id="edit-priority"
                type="number"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                min={0}
              />
              <p className="text-xs text-muted-foreground">
                Lower numbers are evaluated first. Recommended: Business Hours (0), On-Call (50), Default (100)
              </p>
            </div>

            {ruleType === 'BUSINESS_HOURS' && (
              <div className="space-y-2">
                <Label htmlFor="edit-forward-phone">Forward To Phone (E.164 format)</Label>
                <Input
                  id="edit-forward-phone"
                  type="tel"
                  placeholder="+61468064000"
                  value={forwardToPhone}
                  onChange={(e) => setForwardToPhone(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Phone number in E.164 format (e.g., +61468064000)
                </p>
              </div>
            )}

            {ruleType === 'DEFAULT' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="edit-message-type">Message Type</Label>
                  <SearchableSelect<(typeof MESSAGE_TYPES)[number]>
                    items={MESSAGE_TYPES}
                    value={MESSAGE_TYPES.find((t) => t.id === messageType) ?? null}
                    onValueChange={(item) => item && setMessageType(item.id)}
                    getItemId={(t) => t.id}
                    getItemLabel={(t) => t.label}
                    placeholder="Select message type"
                    searchPlaceholder="Search message types..."
                    emptyMessage="No message types found"
                    trigger={
                      <Button variant="outline" id="edit-message-type" className={TRIGGER_BUTTON_CLASS}>
                        {MESSAGE_TYPES.find((t) => t.id === messageType)?.label ?? 'Select message type'}
                      </Button>
                    }
                  />
                </div>

                {messageType === 'TTS' && (
                  <div className="space-y-2">
                    <Label htmlFor="edit-message-text">Message Text</Label>
                    <Input
                      id="edit-message-text"
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder="Thank you for calling. Our office is currently closed..."
                    />
                  </div>
                )}

                {messageType === 'AUDIO' && (
                  <div className="space-y-2">
                    <Label htmlFor="edit-audio-url">Audio URL</Label>
                    <Input
                      id="edit-audio-url"
                      type="url"
                      value={audioUrl}
                      onChange={(e) => setAudioUrl(e.target.value)}
                      placeholder="https://..."
                    />
                    <p className="text-xs text-muted-foreground">
                      URL to prerecorded audio file (Twilio hosted or external)
                    </p>
                  </div>
                )}
              </>
            )}

            <div className="flex items-center space-x-2">
              <Switch
                id="edit-is-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="edit-is-active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRule(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent
          className={cn(
            'max-w-2xl max-h-[90vh] overflow-y-auto',
            EXPANDABLE_DIALOG_TRANSITION,
            addExpanded && EXPANDED_DIALOG_CONTENT_CLASS
          )}
        >
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <DialogTitle>Add Call Routing Rule</DialogTitle>
                <DialogDescription>
                  Create a new routing rule for incoming calls
                </DialogDescription>
              </div>
              <ExpandButton expanded={addExpanded} onToggle={() => setAddExpanded((e) => !e)} />
            </div>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="add-owned-number">Phone Number</Label>
              <SearchableSelect<OwnedNumber>
                items={ownedNumbers}
                value={ownedNumbers.find((n) => n.id === selectedOwnedNumberId) ?? null}
                onValueChange={(item) => item && setSelectedOwnedNumberId(item.id ?? '')}
                getItemId={(n) => n.id ?? ''}
                getItemLabel={(n) => (n.label || n.phone_e164) ?? ''}
                placeholder="Select phone number"
                searchPlaceholder="Search phone numbers..."
                emptyMessage="No phone numbers found"
                trigger={
                  <Button variant="outline" id="add-owned-number" className={TRIGGER_BUTTON_CLASS}>
                    {(() => {
                      const n = ownedNumbers.find((num) => num.id === selectedOwnedNumberId);
                      return n ? ((n.label || n.phone_e164) ?? '') : 'Select phone number';
                    })()}
                  </Button>
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-rule-type">Rule Type</Label>
              <SearchableSelect<(typeof RULE_TYPES)[number]>
                items={RULE_TYPES}
                value={RULE_TYPES.find((t) => t.id === ruleType) ?? null}
                onValueChange={(item) => {
                  if (item) {
                    setRuleType(item.id);
                    setPriority(DEFAULT_PRIORITIES[item.id]);
                  }
                }}
                getItemId={(t) => t.id}
                getItemLabel={(t) => t.label}
                placeholder="Select rule type"
                searchPlaceholder="Search rule types..."
                emptyMessage="No rule types found"
                renderItem={(type, isSelected) => (
                  <div className="flex flex-col gap-0.5">
                    <span className={isSelected ? 'font-medium' : ''}>{type.label}</span>
                    <span className="text-xs text-muted-foreground">{type.description}</span>
                  </div>
                )}
                trigger={
                  <Button variant="outline" id="add-rule-type" className={TRIGGER_BUTTON_CLASS}>
                    {RULE_TYPES.find((t) => t.id === ruleType)?.label ?? 'Select rule type'}
                  </Button>
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-priority">Priority</Label>
              <Input
                id="add-priority"
                type="number"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                min={0}
              />
              <p className="text-xs text-muted-foreground">
                Lower numbers are evaluated first. Recommended: Business Hours (0), On-Call (50), Default (100)
              </p>
            </div>

            {ruleType === 'BUSINESS_HOURS' && (
              <div className="space-y-2">
                <Label htmlFor="add-forward-phone">Forward To Phone (E.164 format)</Label>
                <Input
                  id="add-forward-phone"
                  type="tel"
                  placeholder="+61468064000"
                  value={forwardToPhone}
                  onChange={(e) => setForwardToPhone(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Phone number in E.164 format (e.g., +61468064000)
                </p>
              </div>
            )}

            {ruleType === 'DEFAULT' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="add-message-type">Message Type</Label>
                  <SearchableSelect<(typeof MESSAGE_TYPES)[number]>
                    items={MESSAGE_TYPES}
                    value={MESSAGE_TYPES.find((t) => t.id === messageType) ?? null}
                    onValueChange={(item) => item && setMessageType(item.id)}
                    getItemId={(t) => t.id}
                    getItemLabel={(t) => t.label}
                    placeholder="Select message type"
                    searchPlaceholder="Search message types..."
                    emptyMessage="No message types found"
                    trigger={
                      <Button variant="outline" id="add-message-type" className={TRIGGER_BUTTON_CLASS}>
                        {MESSAGE_TYPES.find((t) => t.id === messageType)?.label ?? 'Select message type'}
                      </Button>
                    }
                  />
                </div>

                {messageType === 'TTS' && (
                  <div className="space-y-2">
                    <Label htmlFor="add-message-text">Message Text</Label>
                    <Input
                      id="add-message-text"
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder="Thank you for calling. Our office is currently closed..."
                    />
                  </div>
                )}

                {messageType === 'AUDIO' && (
                  <div className="space-y-2">
                    <Label htmlFor="add-audio-url">Audio URL</Label>
                    <Input
                      id="add-audio-url"
                      type="url"
                      value={audioUrl}
                      onChange={(e) => setAudioUrl(e.target.value)}
                      placeholder="https://..."
                    />
                    <p className="text-xs text-muted-foreground">
                      URL to prerecorded audio file (Twilio hosted or external)
                    </p>
                  </div>
                )}
              </>
            )}

            <div className="flex items-center space-x-2">
              <Switch
                id="add-is-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="add-is-active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={saving}>
              {saving ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
