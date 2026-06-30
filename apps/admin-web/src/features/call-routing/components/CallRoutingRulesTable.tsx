'use client';

import { useState, useEffect } from 'react';
import {
  Input,
  Button,
  Label,
  Switch,
  SearchableSelect,
} from '@altitutor/ui';
import { Plus } from 'lucide-react';
import {
  callRoutingApi,
  type CallRoutingRule,
  type CallRoutingRuleType,
  type MessageType,
  type OwnedNumber,
} from '../api/call-routing';
import { AdminDialogShell, SettingsDataTable, type SettingsDataTableColumn } from '@/shared/components';

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


  const getOwnedNumberLabel = (ownedNumberId: string) => {
    const number = ownedNumbers.find((item) => item.id === ownedNumberId);
    return number ? (number.label || number.phone_e164 || ownedNumberId) : ownedNumberId;
  };

  const getRuleTypeLabel = (ruleTypeValue: string) => {
    return RULE_TYPES.find((type) => type.id === ruleTypeValue)?.label || ruleTypeValue;
  };

  const getRoutingActionLabel = (rule: CallRoutingRule) => {
    if (rule.rule_type === 'BUSINESS_HOURS' && rule.forward_to_phone) return rule.forward_to_phone;
    if (rule.rule_type === 'ON_CALL') return 'Forward to on-call staff';
    if (rule.rule_type === 'DEFAULT') return rule.message_type === 'AUDIO' ? 'Play audio' : 'Text-to-speech';
    return '-';
  };

  const columns: SettingsDataTableColumn<CallRoutingRule>[] = [
    {
      key: 'phone_number',
      label: 'Phone Number',
      render: (rule) => {
        const number = ownedNumbers.find((item) => item.id === rule.owned_number_id);
        return (
          <div className="flex items-center gap-2">
            <span className="font-medium">{number ? (number.label || number.phone_e164 || rule.owned_number_id) : rule.owned_number_id}</span>
            {number?.is_default ? (
              <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800">Default</span>
            ) : null}
          </div>
        );
      },
      sortValue: (rule) => getOwnedNumberLabel(rule.owned_number_id),
      filterValue: (rule) => getOwnedNumberLabel(rule.owned_number_id),
      searchValue: (rule) => getOwnedNumberLabel(rule.owned_number_id),
    },
    {
      key: 'rule_type',
      label: 'Type',
      render: (rule) => <span className="font-medium">{getRuleTypeLabel(rule.rule_type)}</span>,
      sortValue: (rule) => getRuleTypeLabel(rule.rule_type),
      filterValue: (rule) => rule.rule_type,
      searchValue: (rule) => getRuleTypeLabel(rule.rule_type),
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (rule) => rule.priority,
      sortValue: (rule) => rule.priority,
      searchValue: (rule) => String(rule.priority),
    },
    {
      key: 'routing',
      label: 'Routing',
      render: (rule) => <span className="text-sm text-muted-foreground">{getRoutingActionLabel(rule)}</span>,
      sortValue: (rule) => getRoutingActionLabel(rule),
      searchValue: (rule) => getRoutingActionLabel(rule),
    },
    {
      key: 'status',
      label: 'Status',
      render: (rule) => (
        <span className={`rounded px-2 py-1 text-xs ${
          rule.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {rule.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
      sortValue: (rule) => Boolean(rule.is_active),
      filterValue: (rule) => rule.is_active ? 'active' : 'inactive',
      searchValue: (rule) => rule.is_active ? 'Active' : 'Inactive',
    },
  ];

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

      <SettingsDataTable
        data={rules}
        columns={columns}
        getRowId={(rule) => rule.id}
        searchPlaceholder="Search routing rules..."
        emptyMessage="No routing rules configured. Add a rule to get started."
        filterKeys={['phone_number', 'rule_type', 'status']}
        filterDefinitions={[
          {
            key: 'phone_number',
            label: 'Phone Number',
            options: ownedNumbers.map((number) => ({
              label: number.label || number.phone_e164 || number.id,
              value: number.label || number.phone_e164 || number.id,
            })),
          },
          {
            key: 'rule_type',
            label: 'Type',
            options: RULE_TYPES.map((type) => ({ label: type.label, value: type.id })),
          },
          {
            key: 'status',
            label: 'Status',
            options: [
              { label: 'Active', value: 'active' },
              { label: 'Inactive', value: 'inactive' },
            ],
          },
        ]}
        defaultSort={{ field: 'priority', direction: 'asc' }}
        getActions={(rule) => [
          {
            id: 'edit',
            label: 'Edit',
            description: 'Update this routing rule',
            onSelect: () => handleEdit(rule),
          },
          {
            id: 'delete',
            label: 'Delete',
            description: 'Remove this routing rule',
            disabled: deleting === rule.id,
            onSelect: () => handleDelete(rule.id),
          },
        ]}
      />

      <AdminDialogShell
        open={!!editingRule}
        onClose={() => setEditingRule(null)}
        title="Edit Call Routing Rule"
        subtitle="Update the routing rule configuration"
        footer={(
          <>
            <Button variant="outline" onClick={() => setEditingRule(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </>
        )}
      >
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
      </AdminDialogShell>

      <AdminDialogShell
        open={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        title="Add Call Routing Rule"
        subtitle="Create a new routing rule for incoming calls"
        footer={(
          <>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={saving}>
              {saving ? 'Creating...' : 'Create'}
            </Button>
          </>
        )}
      >
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
      </AdminDialogShell>
    </>
  );
}
