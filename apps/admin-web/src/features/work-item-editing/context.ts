import { createContext, useContext } from "react";
export const WorkItemEditableContext = createContext(true);
export const useWorkItemEditable = () => useContext(WorkItemEditableContext);
