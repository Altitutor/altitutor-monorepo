'use client';

import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from '@altitutor/ui';
import { Code } from 'lucide-react';
import { STUDENT_SUB_VARIABLES, getStudentSubVariableName, canGenerateStudentVariable } from '../utils/variableConfig';
import type { Tables } from '@altitutor/shared';
import type { TemplateVariable } from '../utils/variableConfig';

interface ComposerVariablesDropdownProps {
  availableVariables: readonly TemplateVariable[];
  parentStudents: Tables<'students'>[];
  studentHasClasses: Record<string, boolean>;
  contactType: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsertVariable: (variable: string) => Promise<void>;
  canExpand: boolean;
  disabled: boolean;
}

export function ComposerVariablesDropdown({
  availableVariables,
  parentStudents,
  studentHasClasses,
  contactType,
  open,
  onOpenChange,
  onInsertVariable,
  canExpand,
  disabled,
}: ComposerVariablesDropdownProps) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        {canExpand ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onMouseDown={(e) => e.preventDefault()}
            disabled={disabled}
            className="h-10"
          >
            <Code className="h-4 w-4 mr-2" />
            Variables
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onMouseDown={(e) => e.preventDefault()}
            disabled={disabled}
            className="h-10"
            aria-label="Insert variable"
          >
            <Code className="h-4 w-4" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {availableVariables.map((variable) => (
          <DropdownMenuItem
            key={variable.name}
            onSelect={(e) => {
              e.preventDefault();
              onInsertVariable(variable.name);
            }}
            className="flex flex-col items-start"
          >
            <span className="text-sm font-medium">{`{${variable.name}}`}</span>
            <span className="text-xs text-muted-foreground">{variable.description}</span>
          </DropdownMenuItem>
        ))}
        {contactType === 'PARENT' && parentStudents.length > 0 && (
          <>
            <DropdownMenuSeparator />
            {parentStudents.map((student, index) => {
              const studentIndex = index + 1;
              const studentName = `${student.first_name || ''} ${student.last_name || ''}`.trim() || `Student ${studentIndex}`;
              const hasClasses = studentHasClasses[student.id] ?? false;
              const availableSubVariables = STUDENT_SUB_VARIABLES.filter((subVariable) =>
                canGenerateStudentVariable(subVariable.name, student, hasClasses)
              );
              if (availableSubVariables.length === 0) return null;
              return (
                <DropdownMenuSub key={student.id}>
                  <DropdownMenuSubTrigger>
                    <span className="text-sm">Student {studentIndex}: {studentName}</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {availableSubVariables.map((subVariable) => {
                      const fullVariableName = getStudentSubVariableName(studentIndex, subVariable.name);
                      return (
                        <DropdownMenuItem
                          key={fullVariableName}
                          onSelect={(e) => {
                            e.preventDefault();
                            onInsertVariable(fullVariableName);
                          }}
                          className="flex flex-col items-start"
                        >
                          <span className="text-sm font-medium">{`{${fullVariableName}}`}</span>
                          <span className="text-xs text-muted-foreground">{subVariable.description}</span>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              );
            })}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
