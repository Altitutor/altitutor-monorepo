'use client';

import { useState } from 'react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  SearchableSelectInline,
} from "@altitutor/ui";
import { Search, ArrowLeft, Mail, Plus, Filter } from 'lucide-react';
import { cn } from '@/shared/utils';
import { IssuePill } from '@/features/issues';

interface EntityOption {
  id: string;
  label: string;
}

interface FromNumberOption {
  id: string;
  label: string;
}

interface Props {
  title?: string;
  onSearchToggle?: () => void;
  onBack?: () => void;
  showBackButton?: boolean;
  onTitleClick?: () => void;
   isUnread?: boolean;
   onToggleRead?: () => void;
  contact?: {
    id?: string;
    phone_e164?: string | null;
    contact_type: string;
    students?: { id: string } | null;
    parents?: { id: string } | null;
    staff?: { id: string } | null;
  } | null;
  showUnknownNumberActions?: boolean;
  isLinkingPhone?: boolean;
  studentOptionsWithoutPhone?: EntityOption[];
  parentOptionsWithoutPhone?: EntityOption[];
  staffOptionsWithoutPhone?: EntityOption[];
  onCreateStudent?: () => void;
  onCreateParent?: () => void;
  onCreateStaff?: () => void;
  onAssignStudent?: (studentId: string) => Promise<void> | void;
  onAssignParent?: (parentId: string) => Promise<void> | void;
  onAssignStaff?: (staffId: string) => Promise<void> | void;
  fromNumberOptions?: FromNumberOption[];
  selectedFromNumber?: FromNumberOption | null;
  onFromNumberChange?: (option: FromNumberOption | null) => void;
}

export function ConversationHeader({ 
  title, 
  onSearchToggle, 
  onBack,
  showBackButton = false,
  onTitleClick,
  isUnread,
  onToggleRead,
  contact,
  showUnknownNumberActions = false,
  isLinkingPhone = false,
  studentOptionsWithoutPhone = [],
  parentOptionsWithoutPhone = [],
  staffOptionsWithoutPhone = [],
  onCreateStudent,
  onCreateParent,
  onCreateStaff,
  onAssignStudent,
  onAssignParent,
  onAssignStaff,
  fromNumberOptions = [],
  selectedFromNumber = null,
  onFromNumberChange,
}: Props) {
  const [isLinkMenuOpen, setIsLinkMenuOpen] = useState(false);
  const [isFromNumberMenuOpen, setIsFromNumberMenuOpen] = useState(false);
  const [selectedStudentOption, setSelectedStudentOption] = useState<EntityOption | null>(null);
  const [selectedParentOption, setSelectedParentOption] = useState<EntityOption | null>(null);
  const [selectedStaffOption, setSelectedStaffOption] = useState<EntityOption | null>(null);

  const getIssuePillProps = () => {
    if (!contact) return null;
    
    if (contact.contact_type === 'STUDENT' && contact.students?.id) {
      return { entityType: 'student' as const, entityId: contact.students.id };
    }
    if (contact.contact_type === 'STAFF' && contact.staff?.id) {
      return { entityType: 'staff' as const, entityId: contact.staff.id };
    }
    if (contact.contact_type === 'PARENT' && contact.parents?.id) {
      return { entityType: 'parent' as const, entityId: contact.parents.id };
    }
    return null;
  };

  const issuePillProps = getIssuePillProps();
  const hasUnknownPhone = Boolean(contact?.phone_e164);
  const canShowLinkActions = showUnknownNumberActions && hasUnknownPhone;

  const handleAssignStudent = async (option: EntityOption | null) => {
    setSelectedStudentOption(option);
    if (!option || !onAssignStudent) return;
    await onAssignStudent(option.id);
    setSelectedStudentOption(null);
    setIsLinkMenuOpen(false);
  };

  const handleAssignParent = async (option: EntityOption | null) => {
    setSelectedParentOption(option);
    if (!option || !onAssignParent) return;
    await onAssignParent(option.id);
    setSelectedParentOption(null);
    setIsLinkMenuOpen(false);
  };

  const handleAssignStaff = async (option: EntityOption | null) => {
    setSelectedStaffOption(option);
    if (!option || !onAssignStaff) return;
    await onAssignStaff(option.id);
    setSelectedStaffOption(null);
    setIsLinkMenuOpen(false);
  };

  return (
    <div className="px-6 py-3 border-b dark:border-brand-dark-border flex flex-col gap-2 flex-shrink-0">
      {/* Row 1: back | contact name (truncate) | search - always one line */}
      <div className="flex items-center gap-2 min-w-0 flex-nowrap">
        {showBackButton && onBack && (
          <Button variant="outline" size="icon" onClick={onBack} className="flex-shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="min-w-0 flex-1 flex items-center justify-start">
          {onTitleClick ? (
            <button
              onClick={onTitleClick}
              className="font-medium hover:underline cursor-pointer truncate text-left w-full"
              title={title || 'Conversation'}
            >
              {title || 'Conversation'}
            </button>
          ) : (
            <div className="font-medium truncate" title={title || 'Conversation'}>
              {title || 'Conversation'}
            </div>
          )}
        </div>
        {onFromNumberChange && (
          <DropdownMenu open={isFromNumberMenuOpen} onOpenChange={setIsFromNumberMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-9 px-2 flex-shrink-0 gap-1",
                  selectedFromNumber && "border-primary text-primary"
                )}
                title={selectedFromNumber ? `Filter: ${selectedFromNumber.label}` : 'Filter by from number'}
              >
                <Filter className="h-4 w-4" />
                {selectedFromNumber && (
                  <span className="inline-block h-2 w-2 rounded-full bg-primary" aria-hidden />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0">
              <SearchableSelectInline<FromNumberOption>
                items={fromNumberOptions}
                value={selectedFromNumber}
                onValueChange={(option) => {
                  onFromNumberChange(option);
                  setIsFromNumberMenuOpen(false);
                }}
                getItemId={(item) => item.id}
                getItemLabel={(item) => item.label}
                searchPlaceholder="Search from number..."
                emptyMessage="No numbers found"
                allowClear
                clearLabel="All numbers"
              />
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {onToggleRead && (
          <Button
            variant={isUnread ? 'default' : 'outline'}
            size="icon"
            onClick={onToggleRead}
            className={cn(
              "flex-shrink-0",
              isUnread && "bg-red-500 text-white hover:bg-red-600 border-transparent"
            )}
            title={isUnread ? "Mark as read" : "Mark as unread"}
          >
            <Mail className="h-4 w-4" />
          </Button>
        )}
        {onSearchToggle && (
          <Button variant="outline" size="icon" onClick={onSearchToggle} className="flex-shrink-0">
            <Search className="h-4 w-4" />
          </Button>
        )}
        {canShowLinkActions && (
          <DropdownMenu open={isLinkMenuOpen} onOpenChange={setIsLinkMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="flex-shrink-0"
                title="Link this number"
                disabled={isLinkingPhone}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem
                disabled={isLinkingPhone}
                onSelect={(event) => {
                  event.preventDefault();
                  onCreateStudent?.();
                  setIsLinkMenuOpen(false);
                }}
              >
                Create new student
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={isLinkingPhone}
                onSelect={(event) => {
                  event.preventDefault();
                  onCreateParent?.();
                  setIsLinkMenuOpen(false);
                }}
              >
                Create new parent
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={isLinkingPhone}
                onSelect={(event) => {
                  event.preventDefault();
                  onCreateStaff?.();
                  setIsLinkMenuOpen(false);
                }}
              >
                Create new staff member
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger disabled={isLinkingPhone}>
                  Add to existing student
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-80 p-0">
                  <SearchableSelectInline<EntityOption>
                    items={studentOptionsWithoutPhone}
                    value={selectedStudentOption}
                    onValueChange={handleAssignStudent}
                    getItemId={(item) => item.id}
                    getItemLabel={(item) => item.label}
                    searchPlaceholder="Search students..."
                    emptyMessage="No students without mobile number"
                  />
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger disabled={isLinkingPhone}>
                  Add to existing parent
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-80 p-0">
                  <SearchableSelectInline<EntityOption>
                    items={parentOptionsWithoutPhone}
                    value={selectedParentOption}
                    onValueChange={handleAssignParent}
                    getItemId={(item) => item.id}
                    getItemLabel={(item) => item.label}
                    searchPlaceholder="Search parents..."
                    emptyMessage="No parents without mobile number"
                  />
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger disabled={isLinkingPhone}>
                  Add to existing staff member
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-80 p-0">
                  <SearchableSelectInline<EntityOption>
                    items={staffOptionsWithoutPhone}
                    value={selectedStaffOption}
                    onValueChange={handleAssignStaff}
                    getItemId={(item) => item.id}
                    getItemLabel={(item) => item.label}
                    searchPlaceholder="Search staff..."
                    emptyMessage="No staff without mobile number"
                  />
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {/* Row 2: issue pills - inline, max width, truncate with full name on hover */}
      {issuePillProps && (
        <div className="flex items-center gap-2 min-w-0 max-w-full">
          <IssuePill
            entityType={issuePillProps.entityType}
            entityId={issuePillProps.entityId}
            className="min-w-0 max-w-full flex-wrap"
            truncateWithTitle
          />
        </div>
      )}
    </div>
  );
}


