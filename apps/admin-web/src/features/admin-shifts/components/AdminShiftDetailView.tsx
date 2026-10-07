"use client";
import { formatTime, getDayOfWeek } from "@/shared/utils/datetime";
import { PrimaryEntityBreadcrumb } from "@/shared/components/PrimaryEntityBreadcrumb";

import { useState, useEffect } from "react";

import { SegmentedControl, SegmentedTabPanelContent } from "@altitutor/ui";
import { useToast } from "@altitutor/ui";
import { Button } from "@altitutor/ui";
import { Input } from "@altitutor/ui";
import { Label } from "@altitutor/ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@altitutor/ui";
import { Loader2 } from "lucide-react";
import { ActionsMenu } from "@/shared/components/ActionsMenu";
import { useAdminShiftActions } from "../hooks/useAdminShiftActions";
import { useQueryClient } from "@tanstack/react-query";
import { adminShiftsApi } from "../api";
import {
  useAdminShiftDetails,
  adminShiftsKeys,
  useDeleteAdminShift,
} from "../hooks/useAdminShiftsQuery";
import { useStaff } from "@/features/staff/hooks/useStaffQuery";
import { useUpdateAdminShift } from "../hooks/useAdminShiftsQuery";
import { useCurrentStaff } from "@/shared/hooks";
import type { TablesUpdate } from "@altitutor/shared";
import {
  AdminShiftInfoTab,
  AdminShiftInfoFormData,
} from "./modal/tabs/AdminShiftInfoTab";
import { AdminShiftStaffTab } from "./modal/tabs/AdminShiftStaffTab";
import { AdminShiftSessionsTab } from "./modal/tabs/AdminShiftSessionsTab";
import { AdminShiftActivityTab } from "./modal/tabs/AdminShiftActivityTab";

interface AdminShiftDetailViewProps {
  isOpen: boolean;
  adminShiftId: string | null;
  onClose: () => void;
  onAdminShiftUpdated: () => void;
}

export function AdminShiftDetailView({
  isOpen,
  adminShiftId,
  onClose,
  onAdminShiftUpdated,
}: AdminShiftDetailViewProps) {
  // Use React Query hooks for data fetching
  const { data: adminShiftDetails, isLoading } = useAdminShiftDetails(
    adminShiftId || "",
    isOpen && !!adminShiftId,
  );
  const { data: allStaffData = [] } = useStaff();
  const updateAdminShiftMutation = useUpdateAdminShift();

  // Extract data from adminShiftDetails
  const adminShiftData = adminShiftDetails?.adminShift || null;
  const adminShiftStaff = adminShiftDetails?.staff || [];
  const adminShiftSessions = adminShiftDetails?.sessions || [];
  const staffToAdminShiftStaffId =
    adminShiftDetails?.staffToAdminShiftStaffId || {};

  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const { toast } = useToast();
  const { data: currentStaff } = useCurrentStaff();
  const queryClient = useQueryClient();
  const deleteAdminShiftMutation = useDeleteAdminShift();

  // Centralized action handlers
  const adminShiftActions = useAdminShiftActions({
    adminShiftId: adminShiftId || "",
    onDelete: () => {
      setDeleteConfirmText("");
      setIsDeleteDialogOpen(true);
    },
  });

  // Reset states when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsEditing(false);
      setActiveTab("details");
    }
  }, [isOpen]);

  // Update admin shift handler
  const handleAdminShiftUpdate = async (data: AdminShiftInfoFormData) => {
    if (!adminShiftData) return;

    try {
      const updateData: TablesUpdate<"admin_shifts"> = {
        day_of_week: data.dayOfWeek,
        start_time: data.startTime,
        end_time: data.endTime,
        status: data.status,
        session_start_date: data.sessionStartDate || null,
        session_end_date: data.sessionEndDate || null,
      };
      await updateAdminShiftMutation.mutateAsync({
        id: adminShiftData.id,
        data: updateData,
      });

      // Invalidate admin shift details to refetch full data
      queryClient.invalidateQueries({
        queryKey: adminShiftsKeys.detailFull(adminShiftData.id),
      });

      // Reset edit mode
      setIsEditing(false);

      // Notify parent of update
      onAdminShiftUpdated();

      toast({
        title: "Admin shift updated",
        description: "Admin shift has been updated successfully.",
      });
    } catch (err) {
      console.error("Failed to update admin shift:", err);
      toast({
        title: "Update failed",
        description:
          "There was an error updating the admin shift. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle staff assignment
  const handleAssignStaff = async (staffId: string) => {
    if (!adminShiftData || !currentStaff?.id) return;

    try {
      await adminShiftsApi.assignStaff(
        adminShiftData.id,
        staffId,
        currentStaff.id,
      );
      // Invalidate and refetch admin shift details immediately
      await queryClient.invalidateQueries({
        queryKey: adminShiftsKeys.detailFull(adminShiftData.id),
      });
      await queryClient.refetchQueries({
        queryKey: adminShiftsKeys.detailFull(adminShiftData.id),
      });
      queryClient.invalidateQueries({ queryKey: adminShiftsKeys.minimal() });
      onAdminShiftUpdated();
      toast({
        title: "Success",
        description: "Staff assigned successfully.",
      });
    } catch (err) {
      console.error("Failed to assign staff:", err);
      toast({
        title: "Assignment failed",
        description:
          "There was an error assigning the staff. Please try again.",
        variant: "destructive",
      });
      throw err;
    }
  };

  // Handle staff removal
  const handleRemoveStaff = async (adminShiftStaffId: string) => {
    if (!adminShiftData) return;

    try {
      await adminShiftsApi.unassignStaff(adminShiftStaffId);
      // Invalidate and refetch admin shift details immediately
      await queryClient.invalidateQueries({
        queryKey: adminShiftsKeys.detailFull(adminShiftData.id),
      });
      await queryClient.refetchQueries({
        queryKey: adminShiftsKeys.detailFull(adminShiftData.id),
      });
      queryClient.invalidateQueries({ queryKey: adminShiftsKeys.minimal() });
      onAdminShiftUpdated();
      toast({
        title: "Success",
        description: "Staff removed successfully.",
      });
    } catch (err) {
      console.error("Failed to remove staff:", err);
      toast({
        title: "Removal failed",
        description: "There was an error removing the staff. Please try again.",
        variant: "destructive",
      });
      throw err;
    }
  };

  // Handle admin shift deletion
  const handleDeleteAdminShift = async () => {
    if (!adminShiftData) return;

    try {
      setIsDeleting(true);
      await deleteAdminShiftMutation.mutateAsync(adminShiftData.id);
      onClose();
      onAdminShiftUpdated();
      toast({
        title: "Admin shift deleted",
        description: "Admin shift has been deleted successfully.",
      });
    } catch (err) {
      console.error("Failed to delete admin shift:", err);
      toast({
        title: "Delete failed",
        description:
          "There was an error deleting the admin shift. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Early return if no admin shift data loaded
  if (!adminShiftData) {
    return (
      <>
        <div>
          <div className="p-6">
            <div>
              <h1 className="text-xl font-semibold">Loading admin shift...</h1>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div>
        <div className="flex min-h-0 w-full flex-col p-0">
          <div className="flex flex-col h-full min-h-0">
            {/* Sticky Header */}
            <div className="flex-shrink-0 border-b bg-card sticky top-0 z-10">
              <div className="px-4 pt-4 pb-3">
                <div className="flex items-center justify-between gap-2">
                  <PrimaryEntityBreadcrumb label={`${getDayOfWeek(adminShiftData.day_of_week)} ${formatTime(adminShiftData.start_time)} - ${formatTime(adminShiftData.end_time)}`} />
                  {adminShiftId && (
                    <ActionsMenu
                      type="adminShift"
                      entityId={adminShiftId}
                      {...adminShiftActions}
                      onOpenInPage={undefined}
                    />
                  )}
                </div>
              </div>
              <div className="px-6 pb-4">
                <SegmentedControl
                  fullWidth
                  value={activeTab}
                  onValueChange={setActiveTab}
                  options={[
                    { value: "details", label: "Details" },
                    { value: "staff", label: "Staff" },
                    { value: "sessions", label: "Sessions" },
                    { value: "activity", label: "Activity" },
                  ]}
                />
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 min-h-0 relative">
              <SegmentedTabPanelContent
                when="details"
                activeTab={activeTab}
                className="relative"
              >
                <div className="p-6">
                  <AdminShiftInfoTab
                    adminShiftData={adminShiftData}
                    isEditing={isEditing}
                    isLoading={isLoading}
                    onEdit={() => setIsEditing(true)}
                    onCancelEdit={() => setIsEditing(false)}
                    onSubmit={handleAdminShiftUpdate}
                  />
                </div>
              </SegmentedTabPanelContent>

              <SegmentedTabPanelContent
                when="staff"
                activeTab={activeTab}
                className="relative"
              >
                <div className="p-6">
                  <AdminShiftStaffTab
                    adminShiftData={adminShiftData}
                    adminShiftStaff={adminShiftStaff}
                    allStaff={allStaffData}
                    loadingStaff={false}
                    staffToAdminShiftStaffId={staffToAdminShiftStaffId}
                    onAssignStaff={handleAssignStaff}
                    onRemoveStaff={handleRemoveStaff}
                  />
                </div>
              </SegmentedTabPanelContent>

              <SegmentedTabPanelContent
                when="sessions"
                activeTab={activeTab}
                className="relative flex flex-col"
              >
                <div className="h-full p-6">
                  <AdminShiftSessionsTab
                    adminShiftData={adminShiftData}
                    adminShiftStaff={adminShiftStaff}
                    adminShiftSessions={adminShiftSessions}
                  />
                </div>
              </SegmentedTabPanelContent>

              <SegmentedTabPanelContent
                when="activity"
                activeTab={activeTab}
                className="relative"
              >
                <div className="p-6">
                  {adminShiftId && (
                    <AdminShiftActivityTab
                      adminShiftId={adminShiftId}
                      isOpen={isOpen}
                    />
                  )}
                </div>
              </SegmentedTabPanelContent>
            </div>
          </div>

          {/* Sticky Footer with Buttons */}
          {adminShiftData && isEditing && activeTab === "details" && (
            <div className="sticky bottom-0 left-0 right-0 p-6 border-t bg-background mt-auto shrink-0">
              <div className="flex w-full justify-end">
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setIsEditing(false)}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    disabled={isLoading}
                    onClick={() => {
                      const form = document.getElementById(
                        "admin-shift-edit-form",
                      ) as HTMLFormElement;
                      if (form) {
                        form.requestSubmit();
                      }
                    }}
                  >
                    {isLoading && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Save Changes
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteConfirmText("");
          }
          setIsDeleteDialogOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              admin shift and all associated data from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <Label>
                Type <strong>DELETE</strong> to confirm deletion
              </Label>
              <Input
                type="text"
                placeholder="Type DELETE to confirm"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                handleDeleteAdminShift();
                setIsDeleteDialogOpen(false);
                setDeleteConfirmText("");
              }}
              disabled={isDeleting || deleteConfirmText !== "DELETE"}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
