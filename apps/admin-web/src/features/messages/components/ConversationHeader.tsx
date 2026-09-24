'use client';

import { useLayoutEffect, useMemo, useRef, useState, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@altitutor/ui";
import { Search, ArrowLeft, Mail, Plus, Filter, MoreHorizontal } from 'lucide-react';
import { cn } from '@/shared/utils';
import { IssuePill } from '@/features/issues';
import { BookMeetingMenu } from './BookMeetingMenu';
import { getBookMeetingOptions } from '../utils/getBookMeetingOptions';

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
    students?: { id: string; first_name?: string | null; last_name?: string | null } | null;
    parents?: { id: string; first_name?: string | null; last_name?: string | null } | null;
    staff?: { id: string; first_name?: string | null; last_name?: string | null; role?: string | null } | null;
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
  extraActions?: ReactNode;
  extraMenuItems?: ReactNode;
  compactActions?: boolean;
  backButtonClassName?: string;
}

const TITLE_MIN_WIDTH = 128;
const ICON_ACTION_WIDTH = 36;
const ACTION_GAP = 8;
const LABELED_WIDTHS = {
  fromNumber: 168,
  read: 152,
  extra: 100,
  bookMeeting: 132,
  search: 92,
  link: 128,
} as const;

function ActionLabel({
  expanded,
  label,
  children,
}: {
  expanded: boolean;
  label: string;
  children: ReactNode;
}) {
  if (expanded) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex flex-shrink-0">{children}</span>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
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
  extraActions,
  extraMenuItems,
  compactActions = false,
  backButtonClassName,
}: Props) {
  const [isLinkMenuOpen, setIsLinkMenuOpen] = useState(false);
  const [isFromNumberMenuOpen, setIsFromNumberMenuOpen] = useState(false);
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const [selectedStudentOption, setSelectedStudentOption] = useState<EntityOption | null>(null);
  const [selectedParentOption, setSelectedParentOption] = useState<EntityOption | null>(null);
  const [selectedStaffOption, setSelectedStaffOption] = useState<EntityOption | null>(null);
  const [showLabels, setShowLabels] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

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
  const hasBookMeeting = getBookMeetingOptions(contact).length > 0;
  const readLabel = isUnread ? 'Mark as read' : 'Mark as unread';
  const fromNumberLabel = selectedFromNumber ? `From: ${selectedFromNumber.label}` : 'From number';

  const labeledToolbarWidth = useMemo(() => {
    const widths: number[] = [];
    if (onFromNumberChange) widths.push(LABELED_WIDTHS.fromNumber);
    if (onToggleRead) widths.push(LABELED_WIDTHS.read);
    if (extraActions) widths.push(LABELED_WIDTHS.extra);
    if (hasBookMeeting) widths.push(LABELED_WIDTHS.bookMeeting);
    if (onSearchToggle) widths.push(LABELED_WIDTHS.search);
    if (canShowLinkActions) widths.push(LABELED_WIDTHS.link);
    if (widths.length === 0) return 0;
    return widths.reduce((sum, width) => sum + width, 0) + (widths.length - 1) * ACTION_GAP;
  }, [onFromNumberChange, onToggleRead, extraActions, hasBookMeeting, onSearchToggle, canShowLinkActions]);

  const hasOverflowActions = Boolean(
    onSearchToggle ||
    onFromNumberChange ||
    extraMenuItems ||
    hasBookMeeting ||
    canShowLinkActions
  );

  useLayoutEffect(() => {
    if (compactActions) {
      setShowLabels(false);
      return;
    }
    const row = rowRef.current;
    if (!row) return;

    const update = () => {
      const reserved = TITLE_MIN_WIDTH + (showBackButton ? ICON_ACTION_WIDTH + ACTION_GAP : 0);
      const available = row.clientWidth - reserved;
      setShowLabels(available >= labeledToolbarWidth);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(row);
    return () => observer.disconnect();
  }, [compactActions, showBackButton, labeledToolbarWidth]);

  const handleAssignStudent = async (option: EntityOption | null) => {
    setSelectedStudentOption(option);
    if (!option || !onAssignStudent) return;
    await onAssignStudent(option.id);
    setSelectedStudentOption(null);
    setIsLinkMenuOpen(false);
    setIsOverflowOpen(false);
  };

  const handleAssignParent = async (option: EntityOption | null) => {
    setSelectedParentOption(option);
    if (!option || !onAssignParent) return;
    await onAssignParent(option.id);
    setSelectedParentOption(null);
    setIsLinkMenuOpen(false);
    setIsOverflowOpen(false);
  };

  const handleAssignStaff = async (option: EntityOption | null) => {
    setSelectedStaffOption(option);
    if (!option || !onAssignStaff) return;
    await onAssignStaff(option.id);
    setSelectedStaffOption(null);
    setIsLinkMenuOpen(false);
    setIsOverflowOpen(false);
  };

  const fromNumberMenu = onFromNumberChange ? (
    <SearchableSelectInline<FromNumberOption>
      items={fromNumberOptions}
      value={selectedFromNumber}
      onValueChange={(option) => {
        onFromNumberChange(option);
        setIsFromNumberMenuOpen(false);
        setIsOverflowOpen(false);
      }}
      getItemId={(item) => item.id}
      getItemLabel={(item) => item.label}
      searchPlaceholder="Search from number..."
      emptyMessage="No numbers found"
      allowClear
      clearLabel="All numbers"
    />
  ) : null;

  const linkMenuItems = (
    <>
      <DropdownMenuItem
        disabled={isLinkingPhone}
        onSelect={(event) => {
          event.preventDefault();
          onCreateStudent?.();
          setIsLinkMenuOpen(false);
          setIsOverflowOpen(false);
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
          setIsOverflowOpen(false);
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
          setIsOverflowOpen(false);
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
    </>
  );

  const actionButtonClass = (active?: boolean) =>
    cn('flex-shrink-0', showLabels && 'gap-1.5', active && 'border-primary text-primary');

  return (
    <TooltipProvider delayDuration={200}>
    <div className="px-6 py-3 border-b dark:border-brand-dark-border flex flex-col gap-2 flex-shrink-0">
      {/* Row 1: back | contact name (truncate) | actions */}
      <div ref={rowRef} className="flex items-center gap-2 min-w-0 flex-nowrap">
        {showBackButton && onBack && (
          <Button variant="outline" size="icon" onClick={onBack} className={cn('flex-shrink-0', backButtonClassName)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="min-w-0 flex-1 flex items-center justify-start" style={{ minWidth: TITLE_MIN_WIDTH }}>
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
        {!compactActions && onFromNumberChange && (
          <ActionLabel expanded={showLabels} label={fromNumberLabel}>
            <DropdownMenu open={isFromNumberMenuOpen} onOpenChange={setIsFromNumberMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size={showLabels ? 'sm' : 'icon'}
                  className={cn(actionButtonClass(Boolean(selectedFromNumber)), !showLabels && 'relative')}
                  aria-label={fromNumberLabel}
                >
                  <Filter className="h-4 w-4" />
                  {showLabels && <span className="max-w-[9rem] truncate">{fromNumberLabel}</span>}
                  {!showLabels && selectedFromNumber && (
                    <span className="absolute top-1.5 right-1.5 inline-block h-2 w-2 rounded-full bg-primary" aria-hidden />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 p-0">
                {fromNumberMenu}
              </DropdownMenuContent>
            </DropdownMenu>
          </ActionLabel>
        )}
        {onToggleRead && (
          <ActionLabel expanded={showLabels && !compactActions} label={readLabel}>
            <Button
              variant={isUnread ? 'default' : 'outline'}
              size={showLabels && !compactActions ? 'sm' : 'icon'}
              onClick={onToggleRead}
              className={cn(
                actionButtonClass(),
                'transition-none',
                isUnread && "bg-red-500 text-white hover:bg-red-600 border-transparent"
              )}
              aria-label={readLabel}
            >
              <Mail className="h-4 w-4" />
              {showLabels && !compactActions && <span>{readLabel}</span>}
            </Button>
          </ActionLabel>
        )}
        {!compactActions && extraActions && (
          isValidElement(extraActions)
            ? cloneElement(extraActions as ReactElement<{ expanded?: boolean }>, { expanded: showLabels })
            : extraActions
        )}
        {!compactActions && hasBookMeeting && (
          <BookMeetingMenu contact={contact} expanded={showLabels} />
        )}
        {!compactActions && onSearchToggle && (
          <ActionLabel expanded={showLabels} label="Search">
            <Button
              variant="outline"
              size={showLabels ? 'sm' : 'icon'}
              onClick={onSearchToggle}
              className={actionButtonClass()}
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
              {showLabels && <span>Search</span>}
            </Button>
          </ActionLabel>
        )}
        {!compactActions && canShowLinkActions && (
          <ActionLabel expanded={showLabels} label="Link number">
            <DropdownMenu open={isLinkMenuOpen} onOpenChange={setIsLinkMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size={showLabels ? 'sm' : 'icon'}
                  className={actionButtonClass()}
                  aria-label="Link this number"
                  disabled={isLinkingPhone}
                >
                  <Plus className="h-4 w-4" />
                  {showLabels && <span>Link number</span>}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                {linkMenuItems}
              </DropdownMenuContent>
            </DropdownMenu>
          </ActionLabel>
        )}
        {compactActions && hasOverflowActions && (
          <DropdownMenu open={isOverflowOpen} onOpenChange={setIsOverflowOpen}>
            <ActionLabel expanded={false} label="More actions">
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="flex-shrink-0" aria-label="More actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
            </ActionLabel>
            <DropdownMenuContent align="end" className="w-64">
              {onSearchToggle && (
                <DropdownMenuItem
                  onSelect={() => {
                    onSearchToggle();
                    setIsOverflowOpen(false);
                  }}
                >
                  Search
                </DropdownMenuItem>
              )}
              {onFromNumberChange && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    {selectedFromNumber ? `From: ${selectedFromNumber.label}` : 'From number'}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-80 p-0">
                    {fromNumberMenu}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              {extraMenuItems}
              {hasBookMeeting && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>Book meeting</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-56">
                    <BookMeetingMenu
                      contact={contact}
                      variant="menu"
                      onAction={() => setIsOverflowOpen(false)}
                    />
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              {canShowLinkActions && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger disabled={isLinkingPhone}>
                    Link this number
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-64">
                    {linkMenuItems}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
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
    </TooltipProvider>
  );
}
