"use client";
import {TasksList} from './TasksList';
export function TasksBoard(props: React.ComponentProps<typeof TasksList>) {return <TasksList {...props} layout="board" />;}
